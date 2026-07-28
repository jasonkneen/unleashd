import { type ChildProcess, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import type {
  BuddyContext,
  ConfigResolution,
  ConversationConfig,
  ConversationConfigState,
  Conversation as ConversationData,
  DiscoveredConversation,
  Message,
  ModelId,
  OompaCycle,
  OompaReviewLog,
  OompaRuntimeSnapshot,
  OompaStarted,
  OompaStopped,
  OompaWorkerStatus,
  Provider as ProviderName,
  QueuedMessage,
  ResolvedExecutionConfig,
  ServerMessage,
  SubAgent,
} from '@unleashd/shared';
import {
  ConversationConfigSchema,
  FORK_CAPABLE_PROVIDERS,
  PROTOCOL_INFO,
  buildMergeReviewPrompt,
  createDefaultConversationConfig,
  mergeReviewDocPath,
  normalizeModelId,
  providerSupportsFork,
  safeParseClientMessage,
} from '@unleashd/shared';

type MergeParentMeta = {
  children: Array<{
    sourceConversationId: string;
    childConversationId: string;
    reviewUuid: string;
    childWorkingDirectory: string;
  }>;
  prefixInjected: boolean;
};

type MergeChildMeta = {
  parentConversationId: string;
  reviewUuid: string;
};
import { executeCommand } from '@nbardy/agent-cli';
import express, { type Request, type Response } from 'express';
import { validate as isUuid, v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';
import { loadAllConversations, pollForChanges } from './adapters/loader';
import { formatToolUse, isCompletionOnlyToolUse } from './adapters/tool-format';
import { setIgnorePatterns } from './config';
import {
  EXTERNAL_GRACE_MS,
  FILE_POLL_INTERVAL_MS,
  HOT_RELOAD_DRAIN_MS,
  HOT_RELOAD_FORCE_EXIT_GRACE_MS,
  LOCAL_COMPLETION_SUPPRESS_MS,
  PALETTE_GENERATION_TIMEOUT_MS,
  SWARM_CONTEXT_COMMAND_TIMEOUT_MS,
  SWARM_POLL_INTERVAL_MS,
  SWARM_POLL_THROTTLE_MS,
  TURN_IDLE_TIMEOUT_MS,
  TURN_MAX_RUNTIME_MS,
  TURN_TIMEOUT_KILL_GRACE_MS,
} from './constants/timeouts';
import {
  ConversationConfigService,
  ConversationTombstonedError,
  type HydratedConversationConfig,
} from './conversations/config-service';
import { ConversationConfigStore } from './conversations/config-store';
import { registerFilesystemRoutes } from './http/filesystem-routes';
import { isPathWithin, resolveWorkingDirectoryInput } from './http/path-utils';
import { PersistedServerState } from './http/persisted-state';
import { registerSearchRoutes } from './http/search-routes';
import { registerUploadRoutes } from './http/upload-routes';
import { registerUsageRoutes } from './http/usage-routes';
import { resolveListenHost } from './network';
import { type ProviderEvent, getProvider, providers } from './providers';
import {
  createProviderCatalog,
  resolveConfigAgainstProviderCatalog,
} from './providers/catalog-service';
import {
  extractCodexCollabToolInput,
  getCodexSubagentCurrentAction,
  getSubagentDescription,
  isCodexCollabToolName,
  isSubagentSpawnTool,
  isTerminalSubagentStatus,
  normalizeCodexSubagentStatus,
} from './subagent-tools';
import {
  sendCommandRejected,
  sendProtocolError,
  sendToClient,
  validateWorkingDirectory,
} from './transport/websocket';

import { auditLocalAgents } from './audit.js';
import type {
  BuddiesModule,
  BuddiesStorePort,
  BuddyAutomation,
  BuddyAutomationRun,
} from './buddies/contract';
import { registerBuddyRoutes } from './buddies/routes';
import {
  type BuddyAutomationConversation,
  BuddyScheduler,
  nextAutomationRunAt,
} from './buddies/scheduler';

let startupAuditResults: ReturnType<typeof auditLocalAgents> = [];

const VERBOSE = process.env.VERBOSE === '1' || process.argv.includes('--verbose');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const APP_DATA_DIR = path.resolve(
  process.env.UNLEASHD_DATA_DIR ?? path.join(os.homedir(), '.agent-viewer')
);
const conversationConfigStore = new ConversationConfigStore({
  appDataRoot: APP_DATA_DIR,
  logger: {
    warn: (warning) => console.warn('[conversation-config]', warning),
  },
});
const conversationConfigService = new ConversationConfigService({
  store: conversationConfigStore,
  resolver: {
    resolve: async (config) => resolveConfigAgainstProviderCatalog(config),
  },
});
const persistedServerState = new PersistedServerState(APP_DATA_DIR, setIgnorePatterns);
const BUDDIES_PACKAGE_NAME: string = '@nbardy/buddies';
let buddiesStorePromise: Promise<BuddiesStorePort> | null = null;
let buddyScheduler: BuddyScheduler | null = null;

class BuddiesUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      'Buddies integration is unavailable. Install the optional @nbardy/buddies package to enable it.',
      { cause }
    );
    this.name = 'BuddiesUnavailableError';
  }
}

function getBuddiesStore() {
  buddiesStorePromise ??= import(BUDDIES_PACKAGE_NAME).then(
    (loadedModule: unknown) => {
      const { BuddiesStore } = loadedModule as BuddiesModule;
      if (typeof BuddiesStore !== 'function') {
        throw new Error('The Buddies package does not export BuddiesStore');
      }
      return new BuddiesStore();
    },
    (error) => {
      throw new BuddiesUnavailableError(error);
    }
  );
  return buddiesStorePromise;
}

function sendBuddiesError(res: Response, error: unknown, fallbackStatus: number): void {
  const status = error instanceof BuddiesUnavailableError ? 503 : fallbackStatus;
  res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
}

type ResolvedBuddyConversation = {
  context: BuddyContext;
  briefing: string;
  workingDirectory: string;
  provider: ProviderName;
  model?: ModelId;
  reasoningEffort?: string;
};

async function resolveBuddyConversation(
  requested: BuddyContext
): Promise<ResolvedBuddyConversation> {
  const buddies = await getBuddiesStore();
  const detail = buddies.getBuddyContext(requested.buddyId, {
    workspace: requested.workspaceId,
    project: requested.buddyProjectId ?? undefined,
  });
  if (!detail.workspace) throw new Error('Buddy workspace not found');
  if (detail.buddy.status !== 'active') {
    throw new Error(`Buddy is ${detail.buddy.status}; only active Buddies can start conversations`);
  }
  if (requested.legacyWorkItemId) {
    const legacy = buddies.getWorkItem(requested.legacyWorkItemId);
    if (
      !legacy ||
      legacy.buddy_id !== detail.buddy.id ||
      legacy.project_id !== detail.workspace.id
    ) {
      throw new Error('Legacy work item does not belong to this Buddy and workspace');
    }
  }
  if (requested.delegatedByBuddyId) {
    buddies.getBuddyContext(requested.delegatedByBuddyId, {
      workspace: detail.workspace.id,
    });
    if (requested.parentBuddyConversationId) {
      const parent = conversations.get(requested.parentBuddyConversationId);
      if (
        !parent?.buddyContext ||
        parent.buddyContext.buddyId !== requested.delegatedByBuddyId ||
        parent.buddyContext.workspaceId !== detail.workspace.id
      ) {
        throw new Error('Parent Buddy conversation does not match the delegating Buddy scope');
      }
    }
  }
  const context: BuddyContext = {
    buddyId: detail.buddy.id,
    workspaceId: detail.workspace.id,
    buddyProjectId: detail.project?.id ?? null,
    legacyWorkItemId: requested.legacyWorkItemId ?? null,
    automationRunId: requested.automationRunId ?? null,
    delegatedByBuddyId: requested.delegatedByBuddyId ?? null,
    parentBuddyConversationId: requested.parentBuddyConversationId ?? null,
  };
  const skillBriefings = detail.skills.map((skill) => {
    if (skill.mode !== 'always') {
      return `${skill.name} (on demand; instructions: ${skill.instruction_path})`;
    }
    try {
      return `${skill.name} (always)\n${fs.readFileSync(skill.instruction_path, 'utf8')}`;
    } catch {
      return `${skill.name} (always; instructions unavailable at ${skill.instruction_path})`;
    }
  });
  const briefing = [
    `You are ${detail.buddy.name}, the ${detail.buddy.role} Buddy.`,
    `Workspace: ${detail.workspace.name} (${detail.workspace.root_path})`,
    '',
    'BUDDY_SOUL.md',
    detail.soul || '(No Buddy soul has been configured.)',
    '',
    'RELATIONSHIPS AND SKILLS',
    JSON.stringify(detail.relationships, null, 2),
    ...skillBriefings,
    '',
    'BUDDY MEMORY',
    detail.memory.summary || '(No curated memory yet.)',
    ...detail.memory.recentJournal.map(
      (entry: { path: string; content: string }) =>
        `\nRecent journal ${path.basename(entry.path)}\n${entry.content}`
    ),
    '',
    'CURRENT SPRINT / OWNED WORK',
    JSON.stringify(
      {
        sprint: detail.sprint,
        selectedProject: detail.project,
        projects: detail.projects,
        legacyWorkItems: detail.legacyWorkItems,
      },
      null,
      2
    ),
    '',
    'BUDDY OPERATIONS',
    'Use the `buddies` CLI for durable employee state; never edit its SQLite database directly.',
    'The public operations are new_project, update_project, and remember.',
    'Close, cancel, block, or reopen project todos through an atomic `buddies project update` call.',
    'Write durable personal handoffs through `buddies remember`.',
  ].join('\n');
  return {
    context,
    briefing,
    workingDirectory: detail.workspace.root_path,
    provider: (detail.buddy.provider || 'codex') as ProviderName,
    model: detail.buddy.model || undefined,
    reasoningEffort: detail.buddy.reasoning_effort || undefined,
  };
}

function updateBuddyConversationLink(
  conversation: Conversation,
  status: 'active' | 'complete' | 'failed' | 'cancelled'
): void {
  if (!conversation.buddyContext) return;
  void getBuddiesStore()
    .then((buddies) =>
      buddies.updateConversationLink(conversation.id, {
        status,
        providerSessionId: conversation.sessionId,
      })
    )
    .catch((error) =>
      console.warn(`[buddies] Failed to update conversation ${conversation.id}:`, error)
    );
}

function settleBuddyDelegation(
  conversation: Conversation,
  status: 'complete' | 'failed' | 'cancelled',
  outcome?: string
): void {
  if (!conversation.buddyContext?.delegatedByBuddyId) return;
  void getBuddiesStore()
    .then((buddies) => {
      const delegation = buddies
        .listDelegations({ buddy: conversation.buddyContext!.buddyId })
        .find((item) => item.child_conversation_id === conversation.id);
      if (!delegation) return;
      buddies.updateDelegation(delegation.id, { status, outcome });
    })
    .catch((error) =>
      console.warn(`[buddies] Failed to settle delegation for ${conversation.id}:`, error)
    );
}

async function createBuddyConversationLink(conversation: Conversation): Promise<void> {
  const context = conversation.buddyContext;
  if (!context) return;
  const buddies = await getBuddiesStore();
  buddies.linkConversation({
    buddy: context.buddyId,
    workspace: context.workspaceId,
    project: context.buddyProjectId ?? undefined,
    workItem: context.legacyWorkItemId ?? undefined,
    provider: conversation.provider,
    providerSessionId: conversation.sessionId,
    unleashdConversationId: conversation.id,
    status: 'active',
  });
}

// Store active conversations
const conversations = new Map<string, Conversation>();

// Mtime index for JSONL file polling (filepath → mtime ms)
let fileMtimes = new Map<string, number>();

// Track conversations detected as running by an external process (not launched by us).
// Maps session ID → timestamp (ms) of last detected file activity.
// A session is marked running when its JSONL file changes between polls.
// Marked idle only after EXTERNAL_GRACE_MS with no file changes, to avoid
// flicker during gaps in Claude's output (thinking, API calls, tool use).
const externallyRunning = new Map<string, number>();
// Session IDs that were just completed by a local process.
// Suppresses false "external running" detection from trailing disk writes.
const localCompletionSuppressUntil = new Map<string, number>();

// All sessionIds belonging to known conversations (including rotated ones from resetProcess).
// Prevents the file poller from importing an orphaned JSONL as a duplicate conversation.
const knownSessionIds = new Set<string>();
// Session IDs of deliberately deleted conversations. Prevents the file poller
// from re-importing orphaned JSONL files that still exist on disk.
const deletedSessionIds = new Set<string>();
// Provider session IDs can differ from UI conversation IDs (notably Gemini).
// This alias map resolves provider-session identity back to canonical conversation IDs.
const sessionAliasToConversationId = new Map<string, string>();

// Track initial load readiness. Resolved immediately at startup so WebSocket
// handlers can send init right away. Conversations stream in progressively
// via conversations_updated as batches are parsed from disk.
let resolveInitialLoad!: () => void;
// Resolved by startServer after loadExistingConversations.
const initialLoadComplete = new Promise<void>((resolve) => {
  resolveInitialLoad = resolve;
});

// =============================================================================
// Types for WebSocket Messages
// =============================================================================

interface ChunkData {
  type: 'chunk';
  conversationId: string;
  text: string;
}

interface MessageCompleteData {
  type: 'message_complete';
  conversationId: string;
  reason?: 'success' | 'error' | 'out_of_tokens' | 'killed';
}

interface MessageData {
  type: 'message';
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type BroadcastData = ServerMessage | ChunkData | MessageCompleteData | MessageData;

// =============================================================================
// Helper Functions
// =============================================================================

const LOG_CONTENT_PREVIEW_CHARS = 140;
const STARTUP_INITIAL_LOAD_LIMIT = readPositiveIntEnv('CWV_STARTUP_INITIAL_LOAD_LIMIT', 500);
const STARTUP_PARSE_CONCURRENCY = readPositiveIntEnv('CWV_STARTUP_PARSE_CONCURRENCY', 16);
const STARTUP_LOAD_BATCH_SIZE = readPositiveIntEnv('CWV_STARTUP_BATCH_SIZE', 100);
const STARTUP_PROGRESS_FILE_STEP = readPositiveIntEnv('CWV_STARTUP_LOG_EVERY_FILES', 500);
const AGENT_CLI_DEBUG_EVENTS = process.env.AGENT_CLI_DEBUG_EVENTS === '1';

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function formatLogPreview(content: string, maxChars = LOG_CONTENT_PREVIEW_CHARS): string {
  return content.replace(/\s+/g, ' ').slice(0, maxChars);
}

function registerSessionAlias(sessionId: string | null | undefined, conversationId: string): void {
  if (!sessionId) return;
  sessionAliasToConversationId.set(sessionId, conversationId);
  knownSessionIds.add(sessionId);
}

function unregisterSessionAlias(
  sessionId: string | null | undefined,
  options: { keepKnown?: boolean } = {}
): void {
  if (!sessionId) return;
  sessionAliasToConversationId.delete(sessionId);
  if (!options.keepKnown) {
    knownSessionIds.delete(sessionId);
  }
}

function unregisterConversationAliases(
  conversationId: string,
  options: { keepKnown?: boolean } = {}
): void {
  for (const [sessionId, mappedConversationId] of sessionAliasToConversationId) {
    if (mappedConversationId !== conversationId) continue;
    unregisterSessionAlias(sessionId, options);
  }
}

function clearExternalRunningStatus(...ids: Array<string | null | undefined>): void {
  for (const id of ids) {
    if (!id) continue;
    externallyRunning.delete(id);
  }
}

function markLocalCompletionSuppression(...ids: Array<string | null | undefined>): void {
  const until = Date.now() + LOCAL_COMPLETION_SUPPRESS_MS;
  for (const id of ids) {
    if (!id) continue;
    localCompletionSuppressUntil.set(id, until);
  }
}

function clearLocalCompletionSuppression(...ids: Array<string | null | undefined>): void {
  for (const id of ids) {
    if (!id) continue;
    localCompletionSuppressUntil.delete(id);
  }
}

function isLocalCompletionSuppressed(sessionId: string, now: number): boolean {
  const until = localCompletionSuppressUntil.get(sessionId);
  if (until === undefined) return false;
  if (now >= until) {
    localCompletionSuppressUntil.delete(sessionId);
    return false;
  }
  return true;
}

function pruneLocalCompletionSuppressions(now: number): void {
  for (const [sessionId, until] of localCompletionSuppressUntil) {
    if (now >= until) {
      localCompletionSuppressUntil.delete(sessionId);
    }
  }
}

/**
 * Broadcast data to all connected WebSocket clients.
 * Serializes once and sends the same string to all — avoids redundant JSON.stringify
 * calls per client (matters during progressive load: 30 batches × N tabs).
 */
function broadcastToAll(data: BroadcastData): void {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastToAllExcept(excludedClient: WebSocket, data: BroadcastData): void {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client !== excludedClient && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function stripAnsi(value: string): string {
  const ansiEscapeSequence = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
  return value.replace(ansiEscapeSequence, '');
}

function stderrSnippet(value: string, maxLength = 400): string {
  const cleaned = stripAnsi(value).replace(/\r/g, '\n').trim();
  if (!cleaned) return '';
  const tail = cleaned.slice(-1200).replace(/\s+/g, ' ').trim();
  if (!tail) return '';
  return tail.length > maxLength ? `${tail.slice(0, maxLength - 3)}...` : tail;
}

const OUT_OF_TOKENS_PATTERN =
  /out of tokens|token limit|usage limit|insufficient (?:credits|balance)|exceeded(?: your)?(?: current)? quota|credit balance|rate limit exceeded/i;

function normalizeProviderErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'Unknown provider error';
  if (!OUT_OF_TOKENS_PATTERN.test(trimmed)) return trimmed;
  if (/^out of tokens:/i.test(trimmed)) return trimmed;
  return `Out of tokens: ${trimmed}`;
}

// =============================================================================
// Process Spawning Mutex
// =============================================================================
// Prevents concurrent CLI executions from fighting over token refresh logic on startup.
const _globalSpawnMutex = {
  queue: Promise.resolve(),
  lock: function () {
    let resolve!: () => void;
    const next = new Promise<void>((setResolved) => {
      resolve = setResolved;
    });
    const current = this.queue;
    this.queue = this.queue.then(() => next);
    return { wait: current, release: resolve };
  },
};

// =============================================================================
// Conversation Class
// =============================================================================

/**
 * id and sessionId start equal, but can diverge if resetProcess() is called
 * (loop engine with clearContext). sessionId is what the CLI uses for
 * --session-id/--resume and what JSONL files are named after.
 * knownSessionIds tracks all sessionIds (including rotated ones) so the
 * file poller doesn't import orphaned JSONL files as duplicates.
 */
// STATE MACHINE
// =============
// Server-side (authoritative, broadcast to clients via 'status' events):
//   isRunning   — process is alive (spawn → true, turn.complete/close → false)
//   isStreaming  — assistant is producing content (first text_delta → true, message_complete/close → false)
//                  INVARIANT: !isRunning → !isStreaming (enforced in close handler)
//   queue[]     — server-owned FIFO (pending → sending → removed on close)
//
// Client-side (derived, NOT in this class):
//   confirmed   — server has confirmed this conversation exists (optimistic stub = false)
//
// Broadcast sequence on normal completion:
//   1. message_complete  → client stops streaming indicator
//   2. status:false      → client marks turn complete (from turn.complete)
//   3. queue_updated     → client mirrors updated queue (from close handler)
//   4. processQueue()    → server spawns next message if queued (after close)
//
// Kill paths (all lead to close handler):
//   stop_conversation WS → stop() → SIGTERM → close
//   delete_conversation WS → stop() + delete → close
//   resetProcess (loop) → kill → _isResetting skips close handler
//   SIGINT (Ctrl-C) → SIGKILL all children
interface ConversationOptions {
  id: string;
  workingDirectory?: string | null;
  configState: ConversationConfigState;
  existingSessionId?: string;
  isWorker?: boolean;
  swarmId?: string | null;
  workerId?: string | null;
  workerRole?: 'work' | 'review' | 'fix' | null;
  parentConversationId?: string | null;
  resumedFromConversationId?: string | null;
  modelName?: string | null;
  swarmDebugPrefix?: string | null;
  buddyContext?: BuddyContext | null;
  buddyBriefing?: string | null;
  mergeParentMeta?: MergeParentMeta | null;
  mergeChildMeta?: MergeChildMeta | null;
}

function configFromProviderPreferences(input: {
  provider: ProviderName;
  model?: ModelId;
  reasoningEffort?: string | null;
}): ConversationConfig {
  const normalizedModel = normalizeModelId(input.provider, input.model);
  return {
    ...createDefaultConversationConfig(input.provider),
    model:
      normalizedModel === undefined
        ? { mode: 'default' }
        : { mode: 'explicit', modelId: normalizedModel },
    reasoning:
      input.reasoningEffort === null
        ? { mode: 'disabled' }
        : input.reasoningEffort !== undefined
          ? { mode: 'explicit', effort: input.reasoningEffort }
          : { mode: 'default' },
  };
}

class Conversation extends EventEmitter {
  id: string; // UI conversation ID (persists across resets)
  sessionId: string; // Provider CLI session ID (can be reset for fresh context)
  messages: Message[];
  process: ChildProcess | null;
  isRunning: boolean;
  // Server-authoritative: assistant is actively producing content.
  // INVARIANT: !isRunning → !isStreaming (enforced in message_complete/close handlers).
  isStreaming: boolean;
  createdAt: Date;
  workingDirectory: string;
  config: ConversationConfig;
  configRevision: number;
  configResolution: ConfigResolution;
  // Oompa worker detection — true if first user message started with "[oompa]".
  // Set during JSONL loading, preserved across restarts.
  isWorker: boolean;
  // Swarm grouping: shared across all workers in the same oompa run.
  swarmId: string | null;
  // Worker identity within a swarm (e.g., "w0", "claude-0").
  workerId: string | null;
  // Worker role within the swarm: "work" (task execution), "review" (code review), "fix" (fixing review feedback).
  workerRole: 'work' | 'review' | 'fix' | null;
  // Parent conversation id for provider-native spawned sub-agent threads.
  // For Codex this is resolved from thread_spawn.parent_thread_id.
  parentConversationId: string | null;
  // Source conversation id for user-created fork/resume threads.
  resumedFromConversationId: string | null;
  // Full model name from CLI (e.g., "claude-sonnet-4-5-20250929") — more specific than provider.
  modelName: string | null;
  // Debug prefix for swarm conversations — prepended to first CLI message.
  // Stays on the object (never cleared) so toJSON() includes it for client rendering.
  swarmDebugPrefix: string | null;
  buddyContext: BuddyContext | null;
  // Hidden first-turn context. Never serialized to clients; the typed
  // buddyContext is the durable/UI-facing metadata.
  private _buddyBriefing: string | null;
  // Merge feature: set on a "parent" thread that aggregates review docs from
  // N forked children. Children have mergeChildMeta instead.
  mergeParentMeta: MergeParentMeta | null;
  mergeChildMeta: MergeChildMeta | null;
  // Sub-agent tracking
  subAgents: SubAgent[];
  // Server-owned message queue — persists across client navigation/refresh.
  // Client mirrors this state via queue_updated broadcasts.
  queue: QueuedMessage[];
  // Track pending tool_use blocks that might be Task tools
  private _pendingTaskTools: Map<string, { id: string; startedAt: Date }>;
  // Track if we've started a CLI session (for --resume vs --session-id)
  private _hasStartedSession: boolean;
  // Buffer stderr for this process run so silent failures can be surfaced to UI.
  private _stderrBuffer: string;
  // Tracks whether we received provider stream events for this process run.
  private _sawStdoutEventThisRun: boolean;
  // When true, close handler is a no-op — resetProcess() handles its own cleanup.
  // Prevents duplicate broadcasts and spurious dequeue during loop context resets.
  private _isResetting: boolean;
  // Sticky flag set alongside _isResetting in resetProcess(). Unlike _isResetting
  // (which is cleared in the close handler), this stays true until the *next*
  // spawnForMessage() call. Prevents ghost errors when the consumeEvents iterator
  // rejects after the close handler has already cleared _isResetting.
  private _wasResetDuringThisRun: boolean;
  // Start time of the current CLI process run (for duration tracking).
  private _processStartTime = 0;
  // Last provider event timestamp for idle-hang detection.
  private _lastTurnEventAt = 0;
  // Per-turn watchdog timers.
  private _turnIdleTimer: NodeJS.Timeout | null = null;
  private _turnMaxTimer: NodeJS.Timeout | null = null;
  // Track last known swarm run ID to detect newly launched swarms.
  private _lastSwarmRunId: string | null = null;
  // Whether _lastSwarmRunId was explicitly baselined for the current turn.
  // Distinguishes "no baseline yet" from "baseline exists and no prior run".
  private _hasSwarmBaseline = false;
  // Throttle _pollForNewSwarms() — synchronous fs I/O called from _noteTurnActivity().
  private _lastSwarmPollAt = 0;
  // Periodic swarm poller running during active turns (catches launches that happen
  // after the last text/tool event).
  private _swarmPollTimer: NodeJS.Timeout | null = null;
  // When true, message_complete already performed state cleanup (isStreaming/isRunning/broadcast).
  // The close handler checks this to skip redundant work on normal completion, while still
  // running full cleanup on crash/kill/error paths where message_complete never fired.
  private _turnCompletedCleanly = false;

  constructor(opts: ConversationOptions) {
    super();
    const {
      id,
      workingDirectory = null,
      configState,
      existingSessionId,
      isWorker = false,
      swarmId = null,
      workerId = null,
      workerRole = null,
      parentConversationId = null,
      resumedFromConversationId = null,
      modelName = null,
      swarmDebugPrefix = null,
      buddyContext = null,
      buddyBriefing = null,
      mergeParentMeta = null,
      mergeChildMeta = null,
    } = opts;
    this.id = id;
    // sessionId defaults to id so JSONL filename matches Map key (no poller mismatch).
    // Only differs from id after resetProcess() rotates it for fresh CLI context.
    this.sessionId = existingSessionId ?? id;
    registerSessionAlias(this.sessionId, this.id);
    this.messages = [];
    this.process = null;
    this.isRunning = false;
    this.isStreaming = false;
    this.createdAt = new Date();
    // Resolve to absolute path: sessions are identified by absolute path in oompa
    this.workingDirectory = path.resolve(workingDirectory || process.cwd());
    this.config = configState.config;
    this.configRevision = configState.revision;
    this.configResolution = configState.resolution;
    this.isWorker = isWorker;
    this.swarmId = swarmId;
    this.workerId = workerId;
    this.workerRole = workerRole;
    this.parentConversationId = parentConversationId;
    this.resumedFromConversationId = resumedFromConversationId;
    this.modelName = modelName;
    this.swarmDebugPrefix = swarmDebugPrefix;
    this.buddyContext = buddyContext;
    this._buddyBriefing = buddyBriefing;
    this.mergeParentMeta = mergeParentMeta;
    this.mergeChildMeta = mergeChildMeta;
    this.subAgents = [];
    this.queue = [];
    this._pendingTaskTools = new Map();
    // Mark session as started if loading existing (use --resume for next message)
    this._hasStartedSession = existingSessionId !== undefined;
    this._stderrBuffer = '';
    this._sawStdoutEventThisRun = false;
    this._isResetting = false;
    this._wasResetDuringThisRun = false;
    this._lastSwarmRunId = null;
    this._hasSwarmBaseline = false;
  }

  /**
   * Send a message via executeCommand (conversation mode).
   *
   * HYBRID SYNC STRATEGY:
   * 1. Event stream (live): drives UI text streaming in real time.
   * 2. Disk poller (persistence): rehydrates sessions/history across restarts.
   *
   * First turn omits resumeSessionId; subsequent turns resume with the captured session ID.
   */
  private spawnForMessage(
    content: string,
    executionConfig: ResolvedExecutionConfig,
    forkSourceSessionId?: string
  ): void {
    if (this.process || this.isRunning) {
      console.warn(`[${this.id}] Already processing a message, ignoring`);
      return;
    }

    // This session is now being handled locally; clear any stale external flags.
    clearExternalRunningStatus(this.id, this.sessionId);
    clearLocalCompletionSuppression(this.id, this.sessionId);

    const forking = !!forkSourceSessionId;
    const shouldResume = !forking && this._hasStartedSession;
    console.log(
      `[${this.id}] Spawning ${this.provider} (provider-session=${this.sessionId.substring(0, 8)}..., resume=${shouldResume}, fork=${forking})`
    );
    console.log(`[${this.id}] Message: "${content.substring(0, 50)}"`);

    // Reset per-run buffers
    this._stderrBuffer = '';
    this._sawStdoutEventThisRun = false;
    this._turnCompletedCleanly = false;
    this._wasResetDuringThisRun = false;
    this._processStartTime = Date.now();
    this._primeSwarmBaseline();

    // Per-provider narrowing: ExecuteCommandRequest is a discriminated union
    // keyed on `harness`. Reasoning effort is a pass-through string — the
    // Configuration validation rejects any level not accepted by the target
    // provider before we get here. The submodule
    // harness wraps the string in the correct CLI flag.
    const baseRequest = {
      mode: 'conversation' as const,
      prompt: content,
      cwd: this.workingDirectory,
      model: executionConfig.modelId,
      resumeSessionId: shouldResume ? this.sessionId : undefined,
      forkSessionId: forking ? forkSourceSessionId : undefined,
      yolo: true,
      detached: true,
      debugRawEvents: AGENT_CLI_DEBUG_EVENTS,
    };
    const turn = executeCommand(
      executionConfig.provider === 'claude'
        ? {
            harness: 'claude',
            ...baseRequest,
            reasoningEffort: executionConfig.reasoningEffort,
          }
        : executionConfig.provider === 'codex'
          ? {
              harness: 'codex',
              ...baseRequest,
              reasoningEffort: executionConfig.reasoningEffort,
            }
          : { harness: executionConfig.provider, ...baseRequest }
    );

    this.process = turn.child;
    this.isRunning = true;
    updateBuddyConversationLink(this, 'active');
    this.emit('buddy-turn-started');
    this._hasStartedSession = true; // Mark session as started for next message
    this._startTurnWatchdogs();
    this.broadcastStatus();

    const consumeEvents = async (): Promise<void> => {
      for await (const event of turn.events) {
        this._noteTurnActivity();
        switch (event.type) {
          case 'session.started': {
            if (event.sessionId !== this.sessionId) {
              console.log(`[${this.id}] Session captured: ${event.sessionId}`);
            }
            const oldSessionId = this.sessionId;
            this.sessionId = event.sessionId;
            if (oldSessionId !== event.sessionId) {
              unregisterSessionAlias(oldSessionId, { keepKnown: true });
            }
            registerSessionAlias(event.sessionId, this.id);
            await persistCurrentConversationSession(this, event.sessionId);
            broadcastToAll({
              type: 'session_bound',
              conversationId: this.id,
              sessionId: this.sessionId,
            });
            break;
          }
          case 'text.delta': {
            this._sawStdoutEventThisRun = true;
            this.handleOutput({ type: 'text_delta', text: event.text });
            break;
          }
          case 'tool.use': {
            this._sawStdoutEventThisRun = true;
            this.handleOutput({
              type: 'tool_use',
              name: event.name,
              input: event.input,
              displayText: event.displayText,
            });
            break;
          }
          case 'turn.complete': {
            this.handleOutput({ type: 'message_complete', reason: event.reason });
            break;
          }
          case 'out_of_tokens': {
            this.handleOutput({
              type: 'error',
              message: normalizeProviderErrorMessage(event.message),
            });
            break;
          }
          case 'error': {
            this.handleOutput({
              type: 'error',
              message: normalizeProviderErrorMessage(event.message),
            });
            break;
          }
          case 'stderr': {
            this._stderrBuffer = (this._stderrBuffer + event.text).slice(-4096);
            if (VERBOSE) console.error(`[${this.id}] stderr:`, event.text);
            break;
          }
          case 'progress': {
            // Always log provider warnings (network retries, etc.) — these are
            // operational signals, not debug noise. Other progress events
            // (heartbeats, non-assistant messages) only log with debug flag.
            if (event.source === 'gemini.warning') {
              console.warn(
                `[${this.id}] provider warning:`,
                event.data?.message ?? JSON.stringify(event)
              );
            } else if (AGENT_CLI_DEBUG_EVENTS) {
              console.error(`[${this.id}] progress:`, JSON.stringify(event));
            }
            break;
          }
          case 'turn.started': {
            this._ensureAssistantMessage();
            break;
          }
          default:
            break;
        }
      }
    };

    void consumeEvents().catch((err: unknown) => {
      // Intentional kill from resetProcess(). _isResetting is live during async
      // close; _wasResetDuringThisRun is sticky and catches late rejections that
      // arrive after the close handler has already cleared _isResetting.
      if (this._isResetting || this._wasResetDuringThisRun) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${this.id}] Event stream error: ${message}`);
      this.handleOutput({ type: 'error', message: normalizeProviderErrorMessage(message) });
    });

    void turn.completed
      .then(async ({ exitCode, sessionId, reason }) => {
        this._clearTurnWatchdogs();
        if (sessionId && sessionId !== this.sessionId) {
          const oldSessionId = this.sessionId;
          this.sessionId = sessionId;
          unregisterSessionAlias(oldSessionId, { keepKnown: true });
          registerSessionAlias(sessionId, this.id);
          await persistCurrentConversationSession(this, sessionId);
        }

        const durationMs = Date.now() - this._processStartTime;
        console.log(
          `[${this.id}] Process closed with code ${exitCode} (reason=${reason}) after ${durationMs}ms`
        );

        // resetProcess() handles its own cleanup. If _isResetting, the kill was
        // intentional (loop context clear) and the loop engine will immediately
        // call sendMessage() and spawn the next iteration. Skip all cleanup here.
        // NOTE: _isResetting is cleared HERE (not in resetProcess) because
        // process.kill() triggers this close handler asynchronously via the
        // turn.completed promise. Clearing it synchronously in resetProcess()
        // races: by the time this .then() fires, the flag is already false.
        if (this._isResetting) {
          this._isResetting = false;
          return;
        }

        // message_complete already handled state cleanup and broadcast.
        // Just null the process ref, dequeue, and continue.
        if (this._turnCompletedCleanly) {
          this.process = null;
          this._pendingTaskTools.clear();
          clearExternalRunningStatus(this.id, this.sessionId);
          markLocalCompletionSuppression(this.id, this.sessionId);
          if (this.queue.length > 0 && this.queue[0].status === 'sending') {
            this.queue.shift();
            this.broadcastQueue();
          }
          this.processQueue();
          return;
        }

        const emitSystemMessage = (content: string): void => {
          this.messages.push({ role: 'system', content, timestamp: new Date() });
          broadcastToAll({
            type: 'message',
            conversationId: this.id,
            role: 'system',
            content,
          });
        };

        const details = stderrSnippet(this._stderrBuffer);
        // Use executeCommand completion reason first; it carries protocol-level failures
        // that can otherwise look like successful exits.
        if (reason === 'killed') {
          const killedMsg = details
            ? `Process interrupted before completion: ${details}`
            : 'Process interrupted before completion';
          console.error(`[${this.id}] ${killedMsg}`);
          emitSystemMessage(killedMsg);
        } else if (reason === 'error') {
          const errorMsg =
            exitCode !== null && exitCode !== 0
              ? details
                ? `Process exited with code ${exitCode}: ${details}`
                : `Process exited with code ${exitCode}`
              : details
                ? `Provider exited before completing the turn: ${details}`
                : 'Provider exited before completing the turn';
          console.error(`[${this.id}] ${errorMsg}`);
          emitSystemMessage(errorMsg);
        } else if (exitCode === 0 && !this._sawStdoutEventThisRun) {
          // Silent zero-exit without any streamed output is treated as provider failure.
          const content = details
            ? `Provider reported an error without response output: ${details}`
            : 'Provider exited without response output';
          console.error(`[${this.id}] ${content}`);
          emitSystemMessage(content);
        } else if (reason !== 'out_of_tokens') {
          // Successful completion - add a system message with duration
          const durationSec = (durationMs / 1000).toFixed(1);
          const successMsg = `Process completed successfully in ${durationSec}s`;
          emitSystemMessage(successMsg);
        }

        // INVARIANT: dead process can't stream. Clear both atomically.
        // This is the safety net for crash/kill/OOM — all paths that skip message_complete.

        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.completedAt) {
          lastMsg.completedAt = new Date();
          lastMsg.completionReason = reason || (exitCode === 0 ? 'success' : 'error');
        }

        this.isStreaming = false;
        this.isRunning = false;
        this.process = null;
        // Clear pending task tools — message_complete handles the normal path, but
        // kills/crashes skip it, leaving stale entries that accumulate across runs.
        this._pendingTaskTools.clear();
        // Suppress external-running detection for trailing disk writes from this
        // just-finished local run. Also clear any stale external flag immediately.
        clearExternalRunningStatus(this.id, this.sessionId);
        markLocalCompletionSuppression(this.id, this.sessionId);
        this.broadcastStatus();
        updateBuddyConversationLink(this, reason === 'killed' ? 'cancelled' : 'failed');
        settleBuddyDelegation(this, reason === 'killed' ? 'cancelled' : 'failed', reason);
        this.emit('buddy-turn-failed', reason);
        // Dequeue the "sending" message (completed or crashed) and process next.
        // This is the SINGLE code path for dequeue — not split between
        // message_complete and close. Handles both success and crash.
        if (this.queue.length > 0 && this.queue[0].status === 'sending') {
          this.queue.shift();
          this.broadcastQueue();
        }
        // WS message ordering guarantees clients see status:false before the
        // next spawn's status:true. No delay needed.
        this.processQueue();
      })
      .catch((err: unknown) => {
        this._clearTurnWatchdogs();
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${this.id}] Process completion error: ${message}`);
        this.handleOutput({ type: 'error', message: normalizeProviderErrorMessage(message) });
        this.isStreaming = false;
        this.isRunning = false;
        this.process = null;
        this._pendingTaskTools.clear();
        this.broadcastStatus();
        updateBuddyConversationLink(this, 'failed');
        settleBuddyDelegation(this, 'failed', message);
        this.emit('buddy-turn-failed', message);
        if (this.queue.length > 0) {
          const removed = this.queue.length;
          this.queue = [];
          console.warn(
            `[${this.id}] Cleared ${removed} pending message(s) due to process error to prevent retry loops.`
          );
          this.broadcastQueue();
        }
      });
  }

  private _ensureAssistantMessage(): void {
    const lastMsg = this.messages[this.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') {
      console.log(`[${this.id}] Creating NEW assistant message (msg #${this.messages.length + 1})`);
      const newMsg: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      this.messages.push(newMsg);
      this.broadcastMessage({
        type: 'message',
        role: 'assistant',
        content: '',
        conversationId: this.id,
      });
      if (!this.isStreaming) {
        this.isStreaming = true;
        this.broadcastStatus();
      }
    }
  }

  private _findSubAgentByRuntimeId(id: string): SubAgent | undefined {
    return this.subAgents.find((agent) => agent.id === id || agent.providerThreadId === id);
  }

  private _broadcastSubAgentUpdate(agent: SubAgent): void {
    broadcastToAll({
      type: 'subagent_update',
      conversationId: this.id,
      subAgentId: agent.id,
      toolUses: agent.toolUses,
      tokens: agent.tokens,
      currentAction: agent.currentAction,
      status: agent.status,
      rawStatus: agent.rawStatus,
      statusSource: agent.statusSource,
    });
  }

  private _completeNativeCodexSubAgent(agent: SubAgent, completedAt = new Date()): void {
    if (agent.status === 'completed' || agent.status === 'error') {
      agent.completedAt = completedAt;
      agent.currentAction = agent.status === 'error' ? 'Error' : 'Done';
      broadcastToAll({
        type: 'subagent_complete',
        conversationId: this.id,
        subAgentId: agent.id,
        status: agent.status,
        completedAt,
      });
    }
  }

  private _createOrUpdateCodexNativeSubAgent(
    childThreadId: string,
    toolName: string,
    prompt: string | undefined,
    rawStatus: string | undefined,
    statusMessage: string | null | undefined
  ): { agent: SubAgent; isNew: boolean; wasTerminal: boolean } {
    const description = getSubagentDescription(this.provider, toolName, {
      ...(prompt ? { prompt } : {}),
    });
    const fallbackStatus = toolName === 'spawn_agent' ? 'pending' : 'running';
    const normalizedStatus = normalizeCodexSubagentStatus(rawStatus, fallbackStatus);
    const currentAction = getCodexSubagentCurrentAction(toolName, rawStatus, statusMessage);
    let agent = this._findSubAgentByRuntimeId(childThreadId);
    const isNew = !agent;
    const wasTerminal = !!agent && isTerminalSubagentStatus(agent.status);

    if (!agent) {
      agent = {
        id: childThreadId,
        description,
        status: normalizedStatus,
        toolUses: 0,
        tokens: 0,
        currentAction,
        startedAt: new Date(),
        providerThreadId: childThreadId,
        rawStatus,
        statusSource: 'native',
      };
      this.subAgents.push(agent);
    } else {
      agent.providerThreadId = childThreadId;
      if (!agent.description || agent.description.startsWith('Running ')) {
        agent.description = description;
      }
      agent.status = normalizedStatus;
      agent.rawStatus = rawStatus;
      agent.statusSource = 'native';
      if (currentAction) {
        agent.currentAction = currentAction;
      } else if (normalizedStatus === 'completed' || normalizedStatus === 'error') {
        agent.currentAction = undefined;
      }
      if (normalizedStatus === 'completed' || normalizedStatus === 'error') {
        agent.completedAt ??= new Date();
      }
    }

    return { agent, isNew, wasTerminal };
  }

  private _handleCodexCollabToolUse(
    event: Extract<ProviderEvent, { type: 'tool_use' }>
  ): { suppressGenericSubagentHandling: boolean; suppressFormattedOutput: boolean } | null {
    if (this.provider !== 'codex' || !isCodexCollabToolName(event.name)) {
      return null;
    }

    const { phase, receiverThreadIds, prompt, agentStates } = extractCodexCollabToolInput(
      event.input
    );
    if (phase !== 'completed') {
      return {
        suppressGenericSubagentHandling: true,
        suppressFormattedOutput: false,
      };
    }

    const childIds = new Set<string>(receiverThreadIds);
    for (const childId of Object.keys(agentStates)) {
      childIds.add(childId);
    }

    for (const childId of childIds) {
      const agentState = agentStates[childId];
      const { agent, isNew, wasTerminal } = this._createOrUpdateCodexNativeSubAgent(
        childId,
        event.name,
        prompt,
        agentState?.status,
        agentState?.message
      );

      if (event.name !== 'spawn_agent') {
        agent.toolUses += 1;
      }

      if (isNew) {
        console.log(
          `[${this.id}] Codex sub-agent started: ${agent.id.substring(0, 8)} - "${agent.description.substring(0, 50)}"`
        );
        broadcastToAll({
          type: 'subagent_start',
          conversationId: this.id,
          subAgent: agent,
        });
      } else {
        this._broadcastSubAgentUpdate(agent);
      }

      if (agentState?.message !== undefined && agentState.message !== null) {
        this._broadcastSubAgentUpdate(agent);
      }

      if (isTerminalSubagentStatus(agent.status)) {
        if (!agent.completedAt) {
          agent.completedAt = new Date();
        }
        if (agent.status === 'error') {
          agent.currentAction = 'Error';
        } else if (!agent.currentAction) {
          agent.currentAction = 'Done';
        }
        this._broadcastSubAgentUpdate(agent);
        if (!wasTerminal) {
          this._completeNativeCodexSubAgent(agent, agent.completedAt);
        }
      }
    }

    return {
      suppressGenericSubagentHandling: true,
      suppressFormattedOutput: true,
    };
  }

  /**
   * Unified output handler from executeCommand normalized events.
   */
  handleOutput(event: ProviderEvent): void {
    switch (event.type) {
      case 'message_start':
        // Only create assistant message if we don't have one pending
        // The actual message creation happens when we get text content
        break;

      case 'text_delta': {
        this._ensureAssistantMessage();

        // Accumulate content server-side too (for debugging)
        const currentMsg = this.messages[this.messages.length - 1];
        if (currentMsg.role === 'assistant') {
          currentMsg.content += event.text;
        }
        // Now send the text chunk - client will append to the assistant message
        if (VERBOSE)
          console.log(
            `[${this.id}] chunk (${event.text.length} chars): "${event.text.substring(0, 30).replace(/\n/g, '\\n')}..."`
          );
        this.broadcastChunk({
          type: 'chunk',
          conversationId: this.id,
          text: event.text,
        });
        break;
      }

      case 'tool_use': {
        this._ensureAssistantMessage();
        const codexCollabHandling = this._handleCodexCollabToolUse(event);
        // Check if this tool spawns a sub-agent
        if (!codexCollabHandling && isSubagentSpawnTool(this.provider, event.name)) {
          const description = getSubagentDescription(this.provider, event.name, event.input);
          const blockId = (event.input as { _blockId?: string })._blockId || uuidv4();

          // Create a new sub-agent
          const subAgent: SubAgent = {
            id: blockId,
            description,
            status: 'running',
            toolUses: 0,
            tokens: 0,
            currentAction: undefined,
            startedAt: new Date(),
          };

          this.subAgents.push(subAgent);
          this._pendingTaskTools.set(blockId, { id: blockId, startedAt: new Date() });

          console.log(
            `[${this.id}] Sub-agent started: ${blockId.substring(0, 8)} - "${description.substring(0, 50)}"`
          );

          // Broadcast sub-agent start
          broadcastToAll({
            type: 'subagent_start',
            conversationId: this.id,
            subAgent,
          });
        } else if (!codexCollabHandling?.suppressGenericSubagentHandling) {
          // For non-Task tools, check if we have an active sub-agent and update its current action
          if (this.subAgents.length > 0) {
            const activeAgent = this.subAgents.find((a) => a.status === 'running');
            if (activeAgent) {
              // Format the current action based on tool name
              let actionDisplay = event.name;
              if (event.input) {
                // Extract file path if present
                const filePath =
                  (event.input as { file_path?: string; path?: string }).file_path ||
                  (event.input as { file_path?: string; path?: string }).path;
                if (filePath) {
                  // Show just the filename for brevity
                  const fileName = filePath.split('/').pop() || filePath;
                  actionDisplay = `${event.name}: ${fileName}`;
                }
              }

              activeAgent.toolUses += 1;
              activeAgent.currentAction = actionDisplay;

              // Broadcast sub-agent update
              broadcastToAll({
                type: 'subagent_update',
                conversationId: this.id,
                subAgentId: activeAgent.id,
                toolUses: activeAgent.toolUses,
                currentAction: activeAgent.currentAction,
              });
            }
          }

          // Normalize tool line formatting across providers (Claude/Gemini/Codex).
          // Suppress Codex shell completion-only events to avoid duplicate lines.
          if (
            !codexCollabHandling?.suppressFormattedOutput &&
            !isCompletionOnlyToolUse(event.name, event.input, event.displayText)
          ) {
            const formattedTool = formatToolUse(event.name, event.input, event.displayText);
            if (formattedTool) {
              const currentMsg = this.messages[this.messages.length - 1];
              const needsLeadingNewline =
                !formattedTool.startsWith('<!--ask_user_question:') &&
                currentMsg?.role === 'assistant' &&
                currentMsg.content.length > 0 &&
                !currentMsg.content.endsWith('\n');
              const chunkText = formattedTool.startsWith('<!--ask_user_question:')
                ? formattedTool
                : `${needsLeadingNewline ? '\n' : ''}${formattedTool}\n`;
              if (currentMsg?.role === 'assistant') {
                // Keep server-side message text aligned with streamed chunks.
                currentMsg.content += chunkText;
              }
              this.broadcastChunk({
                type: 'chunk',
                conversationId: this.id,
                text: chunkText,
              });
            }
          }
        } else if (
          !codexCollabHandling.suppressFormattedOutput &&
          !isCompletionOnlyToolUse(event.name, event.input, event.displayText)
        ) {
          const formattedTool = formatToolUse(event.name, event.input, event.displayText);
          if (formattedTool) {
            const currentMsg = this.messages[this.messages.length - 1];
            const needsLeadingNewline =
              !formattedTool.startsWith('<!--ask_user_question:') &&
              currentMsg?.role === 'assistant' &&
              currentMsg.content.length > 0 &&
              !currentMsg.content.endsWith('\n');
            const chunkText = formattedTool.startsWith('<!--ask_user_question:')
              ? formattedTool
              : `${needsLeadingNewline ? '\n' : ''}${formattedTool}\n`;
            if (currentMsg?.role === 'assistant') {
              currentMsg.content += chunkText;
            }
            this.broadcastChunk({
              type: 'chunk',
              conversationId: this.id,
              text: chunkText,
            });
          }
        }
        break;
      }

      case 'message_complete': {
        // Clear watchdog timers immediately — the turn completed normally.
        // Without this they dangle until process close, risking a spurious timeout.
        this._clearTurnWatchdogs();
        // Mark all running sub-agents as complete
        const completedAt = new Date();

        // Update the last assistant message with completion metadata
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.completedAt) {
          lastMsg.completedAt = completedAt;
          lastMsg.completionReason = event.reason;
        }

        for (const agent of this.subAgents) {
          if (agent.status === 'running') {
            if (this.provider === 'codex' && agent.providerThreadId) {
              continue;
            }
            agent.status = 'completed';
            agent.completedAt = completedAt;
            if (!agent.statusSource) {
              agent.statusSource = 'inferred_parent_completion';
            }
            agent.currentAction = 'Done';

            console.log(`[${this.id}] Sub-agent completed: ${agent.id.substring(0, 8)}`);

            // Broadcast sub-agent complete
            broadcastToAll({
              type: 'subagent_complete',
              conversationId: this.id,
              subAgentId: agent.id,
              status: 'completed',
              completedAt,
            });
          }
        }

        // Clear pending task tools
        this._pendingTaskTools.clear();

        // Broadcast message_complete BEFORE status(isStreaming=false).
        // Client's message_complete handler calls flushChunkBuffer() — the last
        // buffered text must be flushed before isStreaming=false triggers a re-render
        // that hides typing dots. Preserves the documented broadcast sequence.
        this.broadcastChunk({
          type: 'message_complete',
          conversationId: this.id,
          reason: event.reason,
        });

        // turn.complete means the assistant has finished this turn from the
        // user's perspective; clear busy state now instead of waiting for
        // child-process teardown.
        this.isStreaming = false;
        this.isRunning = false;
        clearExternalRunningStatus(this.id, this.sessionId);
        markLocalCompletionSuppression(this.id, this.sessionId);
        this.broadcastStatus();

        broadcastToAll({
          type: 'conversations_updated',
          conversations: [this.toJSON()],
        });

        // Signal to the close handler that cleanup already happened.
        // Close handler will skip redundant state changes and broadcasts.
        this._turnCompletedCleanly = true;
        updateBuddyConversationLink(this, 'active');
        const completedAssistant = [...this.messages]
          .reverse()
          .find((message) => message.role === 'assistant');
        this.emit('buddy-turn-complete', completedAssistant?.content ?? '');
        settleBuddyDelegation(this, 'complete', completedAssistant?.content);

        // Merge feature: if this is a review child, scan the final assistant
        // message for the sentinel `merge_review_docs/REVIEW_DOC_<uuid>.txt`.
        // Presence → complete; absence → error. Either way, broadcast once so
        // the parent's progress strip updates.
        if (this.mergeChildMeta) {
          const expectedPath = mergeReviewDocPath(this.mergeChildMeta.reviewUuid);
          const lastAssistant = [...this.messages].reverse().find((m) => m.role === 'assistant');
          const found = !!lastAssistant && lastAssistant.content.includes(expectedPath);
          broadcastToAll({
            type: 'merge_child_status',
            parentConversationId: this.mergeChildMeta.parentConversationId,
            childConversationId: this.id,
            reviewUuid: this.mergeChildMeta.reviewUuid,
            status: found ? 'complete' : 'error',
            reviewDocPath: found ? expectedPath : null,
          });
        }

        break;
      }

      case 'error': {
        // Surface provider errors (usage limits, auth failures, turn errors)
        // to the client as a system message so the user sees what happened.
        console.error(`[${this.id}] Provider error: ${event.message}`);
        const errorMessage: Message = {
          role: 'system',
          content: event.message,
          timestamp: new Date(),
        };
        this.messages.push(errorMessage);
        broadcastToAll({
          type: 'message',
          conversationId: this.id,
          role: 'system',
          content: event.message,
        });
        break;
      }

      default: {
        // TypeScript exhaustive check - this should never happen
        const _exhaustive: never = event;
        throw new Error(`Unhandled event type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  sendMessage(content: string): void {
    console.log(
      `[${this.id}] sendMessage called, isRunning=${this.isRunning}, hasProcess=${this.process !== null}, queueDepth=${this.queue.length}, contentLen=${content.length}, preview="${formatLogPreview(content)}"`
    );

    if (this.process || this.isRunning) {
      console.warn(`[${this.id}] Already processing a message, ignoring`);
      return;
    }

    const executionConfig = this.preflightExecution();
    if (!executionConfig) return;

    // Prepend swarm debug prefix on first message only.
    // UI sees clean content; CLI process gets the full context.
    // Sentinel markers let disk-adapter.ts recover swarmDebugPrefix after server restart
    // (the JSONL stores CLI content, not the clean UI message).
    let cliContent = content;
    if (this.swarmDebugPrefix !== null && this.messages.length === 0) {
      cliContent = `<!-- unleashd:swarm-prefix -->\n${this.swarmDebugPrefix}\n<!-- /unleashd:swarm-prefix -->\n\n${content}`;
    }
    if (this.buddyContext !== null && this._buddyBriefing !== null && this.messages.length === 0) {
      const serializedContext = JSON.stringify(this.buddyContext);
      cliContent = `<!-- unleashd:buddy-context ${serializedContext} -->\n${this._buddyBriefing}\n<!-- /unleashd:buddy-context -->\n\n${cliContent}`;
    }

    // Merge feature: on the very first user send of a merge parent thread,
    // inject a prefix containing the contents of each child's review doc.
    // Loaded synchronously from each child's working directory. Missing files
    // become inline placeholders so the injection always succeeds even if a
    // child errored. Sentinel markers let a future restart path recover the
    // injected context the same way swarmDebugPrefix does.
    if (
      this.mergeParentMeta !== null &&
      !this.mergeParentMeta.prefixInjected &&
      this.messages.length === 0
    ) {
      // Race guard: even though the client disables Send until all children
      // settle via allMergeChildrenSettledAtomFamily, a server restart or a
      // WS reconnect could briefly put the client's view ahead of reality.
      // If any child is still running we reject with a clear system message
      // so the user retries rather than getting placeholder-injected reviews.
      const stillRunning: string[] = [];
      for (const child of this.mergeParentMeta.children) {
        const childConv = conversations.get(child.childConversationId);
        if (childConv?.isRunning) stillRunning.push(child.childConversationId.substring(0, 8));
      }
      if (stillRunning.length > 0) {
        const msg = `Merge send blocked — ${stillRunning.length} review fork(s) still running: ${stillRunning.join(', ')}. Wait for the progress strip to settle.`;
        console.warn(`[${this.id}] ${msg}`);
        const systemMessage: Message = {
          role: 'system',
          content: msg,
          timestamp: new Date(),
        };
        broadcastToAll({
          type: 'message',
          conversationId: this.id,
          role: 'system',
          content: msg,
        });
        // Do NOT push into this.messages — leaving messages empty preserves
        // prefixInjected=false so a retry re-enters this branch cleanly.
        void systemMessage;
        return;
      }
      const parts: string[] = [
        'This is a merge thread that should take all the "reviews" below from other agent conversations as context',
      ];
      for (const child of this.mergeParentMeta.children) {
        const docRel = mergeReviewDocPath(child.reviewUuid);
        const docAbs = path.join(child.childWorkingDirectory, docRel);
        let body: string;
        try {
          body = fs.readFileSync(docAbs, 'utf-8');
        } catch {
          body = `[review doc not found: ${docRel} — child ${child.childConversationId.substring(0, 8)} may have errored]`;
        }
        parts.push(
          `--- review ${child.reviewUuid} (source conversation ${child.sourceConversationId.substring(0, 8)}) ---\n${body}`
        );
      }
      const mergePrefix = parts.join('\n\n');
      cliContent = `<!-- unleashd:merge-prefix -->\n${mergePrefix}\n<!-- /unleashd:merge-prefix -->\n\n${content}`;
      this.mergeParentMeta.prefixInjected = true;
    }

    // Add user message to history (clean content for UI)
    const userMessage: Message = {
      role: 'user',
      content: content,
      timestamp: new Date(),
    };
    this.messages.push(userMessage);

    // Broadcast user message to clients (clean content)
    this.broadcastMessage({
      type: 'message',
      role: 'user',
      content: content,
      conversationId: this.id,
    });

    // Spawn CLI process with possibly-prefixed content
    this.spawnForMessage(cliContent, executionConfig);
  }

  /**
   * Merge feature: spawn a CLI turn by FORKING from another session.
   * `forkSourceSessionId` is the provider session id of the source conversation
   * (NOT its UI id). The CLI harness inherits the full transcript (tool_use
   * + tool_result) into a new session id without polluting the source.
   * Requires the provider to have sessionForkFlags defined (claude, opencode).
   *
   * Only safe to call on a fresh Conversation (no prior messages). The user
   * message is recorded and broadcast exactly like sendMessage.
   */
  spawnMergeReviewFork(content: string, forkSourceSessionId: string): void {
    if (this.process || this.isRunning) {
      console.warn(`[${this.id}] spawnMergeReviewFork: already running, ignoring`);
      return;
    }
    const executionConfig = this.preflightExecution();
    if (!executionConfig) return;
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
    };
    this.messages.push(userMessage);
    this.broadcastMessage({
      type: 'message',
      role: 'user',
      content,
      conversationId: this.id,
    });
    // Native vs cp+resume emulation is decided inside agent-cli-tool based
    // on the harness config. From here it's opaque: pass the source session
    // id through, let the library handle the rest. Mark _hasStartedSession
    // false so spawnForMessage treats this as a first-turn fork.
    this._hasStartedSession = false;
    this.spawnForMessage(content, executionConfig, forkSourceSessionId);
  }

  private preflightExecution(): ResolvedExecutionConfig | undefined {
    // Resolve immediately before any message, merge-prefix, or queue mutation.
    // Catalog changes may affect defaults without changing durable intent.
    const resolution = this.refreshConfigResolution();
    if (resolution.status === 'resolved') return resolution.value;

    const errorMessage = `Configuration unavailable: ${resolution.error.message}`;
    console.error(`[${this.id}] ${errorMessage}`);
    this.messages.push({
      role: 'system',
      content: errorMessage,
      timestamp: new Date(),
      completionReason: 'error',
    });
    const queued = this.queue[0];
    if (queued?.status === 'sending') {
      queued.status = 'pending';
      this.broadcastQueue();
    }
    broadcastToAll({
      type: 'conversation_updated',
      reason: 'config',
      conversation: this.toJSON(),
    });
    return undefined;
  }

  stop(): void {
    this._clearTurnWatchdogs();
    if (!this.process) return;

    const proc = this.process;
    // CRITICAL: Don't set isRunning here. The 'close' handler does that.
    // This ensures atomicity: process exits → state updated → queue dequeued →
    // processQueue() spawns next. If we set state here, processQueue could fire
    // while the old process is still alive, and spawnForMessage's isRunning
    // guard would silently drop the queued message.
    proc.kill('SIGTERM');
    updateBuddyConversationLink(this, 'cancelled');
    settleBuddyDelegation(this, 'cancelled');

    const killTimer = setTimeout(() => {
      if (proc.exitCode === null && !proc.killed) {
        console.warn(`[${this.id}] Process did not exit after SIGTERM, sending SIGKILL`);
        proc.kill('SIGKILL');
      }
    }, 3000);

    proc.once('close', () => clearTimeout(killTimer));
  }

  // Reset process for fresh context (used in loop with clearContext).
  // Generates new CLI session ID while keeping conversation ID for UI continuity.
  // Sets _isResetting so the close handler skips cleanup — we handle it here
  // because the loop engine immediately spawns the next iteration.
  // _isResetting stays true until the async close handler (.then on turn.completed)
  // fires and clears it. Clearing it synchronously here would race: the .then()
  // callback runs on the next microtask, after this function returns, so it would
  // see _isResetting=false and run full cleanup (duplicate broadcasts + spurious dequeue).
  resetProcess(): void {
    this._clearTurnWatchdogs();
    if (this.process) {
      this._isResetting = true;
      this._wasResetDuringThisRun = true;
      this.process.kill();
      this.process = null;
      this.isStreaming = false;
      this.isRunning = false;
      this.broadcastStatus();
      // DO NOT clear _isResetting here — the close handler clears it when it
      // fires and sees the flag. See the guard in turn.completed.then().
    }
    // Generate new session ID for fresh context
    const oldSessionId = this.sessionId;
    this.sessionId = uuidv4();
    unregisterSessionAlias(oldSessionId, { keepKnown: true });
    registerSessionAlias(this.sessionId, this.id);
    // This UUID is provisional until the provider confirms it. Persisting it
    // as current here would make restart treat a never-started session as
    // resumable.
    this._hasStartedSession = false;
    console.log(
      `[${this.id}] Reset session: ${oldSessionId.substring(0, 8)}... -> ${this.sessionId.substring(0, 8)}...`
    );
  }

  private _startTurnWatchdogs(): void {
    this._clearTurnWatchdogs();
    this._lastTurnEventAt = Date.now();
    this._refreshIdleWatchdog();
    this._startSwarmPoller();
    this._turnMaxTimer = setTimeout(() => {
      this._handleTurnTimeout('max');
    }, TURN_MAX_RUNTIME_MS);
  }

  private _noteTurnActivity(): void {
    if (!this.isRunning) return;
    this._lastTurnEventAt = Date.now();
    this._refreshIdleWatchdog();
    this._pollForNewSwarms();
  }

  private _refreshIdleWatchdog(): void {
    if (this._turnIdleTimer) {
      clearTimeout(this._turnIdleTimer);
      this._turnIdleTimer = null;
    }
    if (!this.isRunning) return;
    this._turnIdleTimer = setTimeout(() => {
      this._handleTurnTimeout('idle');
    }, TURN_IDLE_TIMEOUT_MS);
  }

  /**
   * Detects if the assistant launched a new Oompa Loompa Swarm by checking
   * the local runs directory for a new ID compared to what we saw previously.
   */
  private _pollForNewSwarms(options?: { force?: boolean }): void {
    // Throttle: _noteTurnActivity() fires on every text_delta/tool_use (100+ per response).
    // Avoid synchronous fs I/O (readdirSync, statSync, readFileSync) on every event.
    const now = Date.now();
    if (!options?.force && now - this._lastSwarmPollAt < SWARM_POLL_THROTTLE_MS) return;
    this._lastSwarmPollAt = now;

    const snapshot = readLatestOompaRuntime(this.workingDirectory);
    if (!snapshot.available || !snapshot.run) return;

    const run = snapshot.run;
    const currentRunId = snapshot.run.runId;
    if (!this._hasSwarmBaseline) {
      // Safety fallback: baseline if a turn starts without _primeSwarmBaseline.
      this._lastSwarmRunId = currentRunId;
      this._hasSwarmBaseline = true;
      return;
    }

    const previousRunId = this._lastSwarmRunId;
    if (previousRunId && previousRunId !== currentRunId) {
      this._completeSwarmSubAgent(previousRunId);
    }

    if (currentRunId !== previousRunId) {
      this._lastSwarmRunId = currentRunId;
      if (!run.isRunning) return;
      this._startSwarmSubAgent(run);
      return;
    }

    if (!run.isRunning) {
      this._completeSwarmSubAgent(currentRunId);
    }
  }

  private _clearTurnWatchdogs(): void {
    this._stopSwarmPoller();
    if (this._turnIdleTimer) {
      clearTimeout(this._turnIdleTimer);
      this._turnIdleTimer = null;
    }
    if (this._turnMaxTimer) {
      clearTimeout(this._turnMaxTimer);
      this._turnMaxTimer = null;
    }
  }

  private _handleTurnTimeout(kind: 'idle' | 'max'): void {
    if (!this.process || !this.isRunning) return;
    const now = Date.now();
    const elapsedSec = Math.round((now - this._processStartTime) / 1000);
    const idleSec = Math.round((now - this._lastTurnEventAt) / 1000);
    const sawContent = this._sawStdoutEventThisRun;
    const detail = !sawContent ? ' (no content ever received — likely API-level hang)' : '';
    const message =
      kind === 'idle'
        ? `Turn stalled: no provider events for ${idleSec}s${detail} (timed out)`
        : `Turn exceeded max runtime after ${elapsedSec}s${detail} (timed out)`;

    console.error(
      `[${this.id}] ${message} | sawContent=${sawContent} elapsed=${elapsedSec}s idle=${idleSec}s stderr=${this._stderrBuffer.length > 0 ? 'yes' : 'no'}`
    );
    this._clearTurnWatchdogs();
    this.handleOutput({ type: 'error', message });
    // Clear busy state now so processQueue() sees isRunning=false and can dequeue.
    // Without this, the close handler's fast path (_turnCompletedCleanly) skips
    // state reset, leaving isRunning=true and stalling the queue permanently.
    this.isStreaming = false;
    this.isRunning = false;
    this.broadcastStatus();
    // Mark turn as cleanly completed so the close handler (triggered by SIGTERM
    // below) takes the fast path and doesn't emit a duplicate system message.
    this._turnCompletedCleanly = true;

    const proc = this.process;
    proc.kill('SIGTERM');
    const killTimer = setTimeout(() => {
      if (proc.exitCode === null && !proc.killed) {
        console.warn(`[${this.id}] Timeout kill escalation: sending SIGKILL`);
        proc.kill('SIGKILL');
      }
    }, TURN_TIMEOUT_KILL_GRACE_MS);
    proc.once('close', () => clearTimeout(killTimer));
  }

  private _primeSwarmBaseline(): void {
    const snapshot = readLatestOompaRuntime(this.workingDirectory);
    this._lastSwarmRunId = snapshot.available && snapshot.run ? snapshot.run.runId : null;
    this._hasSwarmBaseline = true;
    this._lastSwarmPollAt = 0;
  }

  private _startSwarmPoller(): void {
    this._stopSwarmPoller();
    if (!this.isRunning) return;
    this._swarmPollTimer = setInterval(() => {
      this._pollForNewSwarms({ force: true });
    }, SWARM_POLL_INTERVAL_MS);
    this._swarmPollTimer.unref?.();
    this._pollForNewSwarms({ force: true });
  }

  private _stopSwarmPoller(): void {
    if (!this._swarmPollTimer) return;
    clearInterval(this._swarmPollTimer);
    this._swarmPollTimer = null;
  }

  private _startSwarmSubAgent(run: NonNullable<OompaRuntimeSnapshot['run']>): void {
    const agentId = `swarm-${run.runId}`;
    if (this.subAgents.some((a) => a.id === agentId)) return;

    const swarmId = run.swarmId ?? run.runId;
    console.log(`[${this.id}] Detected new running swarm: ${swarmId}`);

    const newAgent: SubAgent = {
      id: agentId,
      description: `Swarm Run: ${swarmId} (${run.totalWorkers} workers)`,
      status: 'running',
      toolUses: 0,
      tokens: 0,
      currentAction: 'Running swarm...',
      startedAt: new Date(),
    };

    this.subAgents.push(newAgent);
    broadcastToAll({
      type: 'subagent_start',
      conversationId: this.id,
      subAgent: newAgent,
    });
  }

  private _completeSwarmSubAgent(runId: string): void {
    const agentId = `swarm-${runId}`;
    const swarmAgent = this.subAgents.find((a) => a.id === agentId);
    if (!swarmAgent || swarmAgent.status !== 'running') return;

    const completedAt = new Date();
    swarmAgent.status = 'completed';
    swarmAgent.currentAction = 'Done';
    swarmAgent.completedAt = completedAt;

    broadcastToAll({
      type: 'subagent_complete',
      conversationId: this.id,
      subAgentId: agentId,
      status: 'completed',
      completedAt,
    });
  }

  broadcastChunk(data: ChunkData | MessageCompleteData): void {
    broadcastToAll(data);
  }

  broadcastMessage(data: MessageData): void {
    broadcastToAll(data);
  }

  broadcastStatus(): void {
    broadcastToAll({
      type: 'status',
      conversationId: this.id,
      isRunning: this.isRunning,
      isStreaming: this.isStreaming,
    });
  }

  broadcastQueue(): void {
    broadcastToAll({
      type: 'queue_updated',
      conversationId: this.id,
      queue: this.queue,
    });
  }

  /**
   * Add a message to the queue. If the conversation is ready and idle,
   * process immediately. Otherwise it sits until the next status/ready change.
   */
  enqueueMessage(content: string): void {
    const queueDepthBefore = this.queue.length;
    const msg: QueuedMessage = {
      id: crypto.randomUUID(),
      content,
      queuedAt: new Date(),
      status: 'pending',
    };
    this.queue.push(msg);
    console.log(
      `[${this.id}] Queued message id=${msg.id.substring(0, 8)}, queueDepth=${queueDepthBefore}->${this.queue.length}, contentLen=${content.length}, preview="${formatLogPreview(content)}"`
    );
    this.broadcastQueue();
    this.processQueue();
  }

  /**
   * Atomically stop the active turn, flush pending queued work using server-side
   * state, and enqueue the user's final interruption message as the next task.
   */
  interruptAndSend(content: string): void {
    const pendingQueuedMessages = this.queue.filter((m) => m.status === 'pending');
    const hasPendingTasks = pendingQueuedMessages.length > 0;

    if (hasPendingTasks) {
      this.queue = this.queue.filter((m) => m.status === 'sending');
      console.log(
        `[${this.id}] interrupt_and_send flushed ${pendingQueuedMessages.length} pending queued message(s)`
      );
      this.broadcastQueue();
    }

    if (this.process) {
      this.stop();
    }

    this.enqueueMessage(content);
  }

  /**
   * Cancel a pending queued message by ID. Cannot cancel messages already sending.
   */
  cancelQueuedMessage(messageId: string): void {
    const idx = this.queue.findIndex((m) => m.id === messageId && m.status === 'pending');
    if (idx !== -1) {
      console.log(`[${this.id}] Cancelled queued message: ${messageId.substring(0, 8)}`);
      this.queue.splice(idx, 1);
      this.broadcastQueue();
    }
  }

  /**
   * Clear all pending messages from the queue. Messages currently sending are kept.
   */
  clearQueue(): void {
    const before = this.queue.length;
    this.queue = this.queue.filter((m) => m.status === 'sending');
    console.log(`[${this.id}] Cleared queue: removed ${before - this.queue.length} messages`);
    this.broadcastQueue();
  }

  /**
   * Process the next queued message if the conversation is idle.
   * Called from: close handler (after process exits), enqueueMessage (new message).
   */
  processQueue(): void {
    if (this.process || this.isRunning) return;
    if (this.queue.length === 0) return;

    const next = this.queue[0];
    if (next.status === 'sending') return; // already in flight

    next.status = 'sending';
    console.log(
      `[${this.id}] processQueue sending id=${next.id.substring(0, 8)}, queueDepth=${this.queue.length}, contentLen=${next.content.length}, preview="${formatLogPreview(next.content)}"`
    );
    this.broadcastQueue();
    this.sendMessage(next.content);
  }

  hasActiveProcess(): boolean {
    return this.process !== null;
  }

  hasStartedSession(): boolean {
    return this._hasStartedSession;
  }

  get provider(): ProviderName {
    return this.config.provider;
  }

  private get effectiveConfig() {
    return this.configResolution.status === 'resolved'
      ? this.configResolution.value
      : this.configResolution.lastResolved;
  }

  get model(): ModelId | undefined {
    return this.effectiveConfig?.modelId;
  }

  get reasoningEffort(): string | undefined {
    return this.effectiveConfig?.reasoningEffort;
  }

  applyConfigState(state: ConversationConfigState): void {
    this.config = state.config;
    this.configRevision = state.revision;
    this.configResolution = state.resolution;
  }

  refreshConfigResolution(): ConfigResolution {
    const lastResolved =
      this.configResolution.status === 'resolved'
        ? this.configResolution.value
        : this.configResolution.lastResolved;
    this.configResolution = resolveConfigAgainstProviderCatalog(this.config, lastResolved);
    return this.configResolution;
  }

  // Harness/provider can only be changed before the first turn has started.
  // Once a session has started, provider-specific state (session files, resume
  // IDs, and message history) is no longer safely interchangeable.
  canChangeProvider(): boolean {
    return (
      !this._hasStartedSession &&
      this.messages.length === 0 &&
      this.queue.length === 0 &&
      !this.isRunning &&
      !this.isStreaming
    );
  }

  toJSON(): ConversationData {
    return {
      id: this.id,
      sessionId: this.sessionId,
      messages: this.messages,
      isRunning: this.isRunning,
      isStreaming: this.isStreaming,
      confirmed: true,
      createdAt: this.createdAt,
      workingDirectory: this.workingDirectory,
      provider: this.provider,
      model: this.model,
      reasoningEffort: this.reasoningEffort,
      config: this.config,
      configRevision: this.configRevision,
      configResolution: this.configResolution,
      reportedModel: this.modelName,
      subAgents: this.subAgents,
      queue: this.queue,
      isWorker: this.isWorker,
      swarmId: this.swarmId,
      workerId: this.workerId,
      workerRole: this.workerRole,
      parentConversationId: this.parentConversationId,
      resumedFromConversationId: this.resumedFromConversationId,
      modelName: this.modelName,
      swarmDebugPrefix: this.swarmDebugPrefix,
      buddyContext: this.buddyContext,
      mergeParentMeta: this.mergeParentMeta,
      mergeChildMeta: this.mergeChildMeta,
    };
  }
}

async function persistCurrentConversationSession(
  conversation: Conversation,
  sessionId: string
): Promise<void> {
  try {
    await conversationConfigService.setCurrentSession(conversation.id, {
      provider: conversation.config.provider,
      sessionId,
    });
  } catch (error) {
    console.warn(
      `[conversation-config] Failed to bind session ${sessionId} to ${conversation.id}:`,
      error
    );
  }
}

function creationFingerprint(input: {
  workingDirectory: string;
  config: ConversationConfig;
  initialMessage?: string;
  swarmDebugPrefix?: string;
  resumedFromConversationId?: string;
  buddyContext?: BuddyContext;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        workingDirectory: input.workingDirectory,
        config: input.config,
        initialMessage: input.initialMessage ?? null,
        swarmDebugPrefix: input.swarmDebugPrefix ?? null,
        resumedFromConversationId: input.resumedFromConversationId ?? null,
        buddyContext: input.buddyContext ?? null,
      })
    )
    .digest('hex');
}

async function dispatchCreationMessageIfPending(conversation: Conversation): Promise<void> {
  const claimed = await conversationConfigService.claimInitialMessageDispatch(conversation.id);
  const initialMessage = claimed?.creation?.initialMessage;
  if (initialMessage) conversation.enqueueMessage(initialMessage);
}

async function createAutomationConversation(
  automation: BuddyAutomation,
  run: BuddyAutomationRun
): Promise<BuddyAutomationConversation> {
  if (!automation.workspace_id) {
    throw new Error('Automation must have one workspace scope before it can run');
  }
  const resolved = await resolveBuddyConversation({
    buddyId: automation.buddy_id,
    workspaceId: automation.workspace_id,
    buddyProjectId: automation.buddy_project_id,
    automationRunId: run.id,
  });
  if (!(resolved.provider in providers)) {
    throw new Error(`Buddy provider is unavailable: ${resolved.provider}`);
  }
  const model = normalizeModelId(resolved.provider, resolved.model);
  const config = configFromProviderPreferences({
    provider: resolved.provider,
    model,
    reasoningEffort: resolved.reasoningEffort,
  });
  const conversationId = uuidv4();
  const workingDirectory = resolveWorkingDirectoryInput(resolved.workingDirectory);
  const fingerprint = creationFingerprint({
    workingDirectory,
    config,
    buddyContext: resolved.context,
  });
  const creation = await conversationConfigService.createOrReplay({
    conversationId,
    config,
    workingDirectory,
    creation: {
      commandId: `buddy-automation-${run.id}`,
      fingerprint,
      buddyContext: resolved.context,
    },
  });
  const conversation = new Conversation({
    id: conversationId,
    workingDirectory,
    configState: creation.state,
    buddyContext: resolved.context,
    buddyBriefing: resolved.briefing,
  });
  conversations.set(conversation.id, conversation);
  await createBuddyConversationLink(conversation);
  broadcastToAll({
    type: 'conversations_updated',
    conversations: [conversation.toJSON()],
  });

  return {
    conversationId,
    runTurn(prompt: string) {
      return new Promise<string>((resolve, reject) => {
        const onComplete = (output: string) => {
          cleanup();
          resolve(output);
        };
        const onFailure = (reason: string) => {
          cleanup();
          reject(new Error(reason || 'Buddy automation turn failed'));
        };
        const cleanup = () => {
          conversation.off('buddy-turn-complete', onComplete);
          conversation.off('buddy-turn-failed', onFailure);
        };
        conversation.once('buddy-turn-complete', onComplete);
        conversation.once('buddy-turn-failed', onFailure);
        conversation.sendMessage(prompt);
      });
    },
    stop() {
      conversation.stop();
    },
    finish(status) {
      updateBuddyConversationLink(conversation, status);
    },
  };
}

async function createServerBuddyConversation(input: {
  context: BuddyContext;
  initialMessage: string;
  commandId: string;
  conversationId?: string;
}): Promise<Conversation> {
  const resolved = await resolveBuddyConversation(input.context);
  if (!(resolved.provider in providers)) {
    throw new Error(`Buddy provider is unavailable: ${resolved.provider}`);
  }
  const config = configFromProviderPreferences({
    provider: resolved.provider,
    model: normalizeModelId(resolved.provider, resolved.model),
    reasoningEffort: resolved.reasoningEffort,
  });
  const conversationId = input.conversationId ?? uuidv4();
  const workingDirectory = resolveWorkingDirectoryInput(resolved.workingDirectory);
  const fingerprint = creationFingerprint({
    workingDirectory,
    config,
    initialMessage: input.initialMessage,
    buddyContext: resolved.context,
  });
  const creation = await conversationConfigService.createOrReplay({
    conversationId,
    config,
    workingDirectory,
    creation: {
      commandId: input.commandId,
      fingerprint,
      initialMessage: input.initialMessage,
      buddyContext: resolved.context,
    },
  });
  const conversation = new Conversation({
    id: conversationId,
    workingDirectory,
    configState: creation.state,
    buddyContext: resolved.context,
    buddyBriefing: resolved.briefing,
  });
  conversations.set(conversation.id, conversation);
  await createBuddyConversationLink(conversation);
  broadcastToAll({
    type: 'conversations_updated',
    conversations: [conversation.toJSON()],
  });
  await dispatchCreationMessageIfPending(conversation);
  return conversation;
}

// =============================================================================
// WebSocket Handler
// =============================================================================

wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket connection');

  // Wait for initialLoadComplete (resolves immediately at startup).
  // Clients get init with whatever conversations are loaded so far — remaining
  // conversations stream in via conversations_updated as batches are parsed.
  // Late-connecting clients get more in init; early ones get progressive updates.
  (async () => {
    await initialLoadComplete;

    // Guard: client may have disconnected while we were waiting
    if (ws.readyState !== WebSocket.OPEN) return;

    // Send current state (include external running status for accurate initial render)
    sendToClient(ws, {
      type: 'init',
      conversations: Array.from(conversations.values()).map((c) => {
        const json = c.toJSON();
        if (externallyRunning.has(c.sessionId) || externallyRunning.has(c.id)) {
          json.isRunning = true;
        }
        return json;
      }),
      defaultCwd: process.cwd(),
      uiState: persistedServerState.getUIState(),
      protocol: PROTOCOL_INFO,
    });
  })();

  ws.on('message', async (message: Buffer | string) => {
    let activeCommand: { commandId: string; conversationId?: string } | null = null;
    try {
      const parsed = JSON.parse(message.toString());
      const result = safeParseClientMessage(parsed);
      if (!result.success) {
        const issueSummary = result.error.issues
          .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
          .join('; ');
        console.error(`[WS] Invalid client message: ${issueSummary}`);
        const commandId =
          typeof parsed === 'object' &&
          parsed !== null &&
          'commandId' in parsed &&
          typeof parsed.commandId === 'string' &&
          parsed.commandId.length > 0
            ? parsed.commandId
            : null;
        if (commandId) {
          sendCommandRejected(ws, {
            commandId,
            error: { code: 'invalid_message', message: `Invalid message: ${issueSummary}` },
          });
        } else {
          sendProtocolError(ws, `Invalid message: ${issueSummary}`);
        }
        return;
      }
      const data = result.data;
      if ('commandId' in data) {
        activeCommand = {
          commandId: data.commandId,
          ...('conversationId' in data ? { conversationId: data.conversationId } : {}),
        };
      }
      if (data.type === 'queue_message') {
        console.log(
          `[WS] Received queue_message conversationId=${data.conversationId}, contentLen=${data.content.length}, preview="${formatLogPreview(data.content)}"`
        );
      } else {
        console.log(
          `[WS] Received message type: ${data.type}`,
          JSON.stringify(data).substring(0, 200)
        );
      }

      switch (data.type) {
        case 'create_conversation': {
          let buddyResolution: ResolvedBuddyConversation | null = null;
          try {
            buddyResolution = data.buddyContext
              ? await resolveBuddyConversation(data.buddyContext)
              : null;
          } catch (error) {
            sendCommandRejected(ws, {
              commandId: data.commandId,
              conversationId: data.conversationId,
              error: {
                code: 'create_failed',
                message: error instanceof Error ? error.message : String(error),
              },
            });
            break;
          }
          const workingDir = resolveWorkingDirectoryInput(
            buddyResolution?.workingDirectory ?? data.workingDirectory
          );
          const fingerprint = creationFingerprint({
            workingDirectory: workingDir,
            config: data.config,
            initialMessage: data.initialMessage,
            swarmDebugPrefix: data.swarmDebugPrefix,
            resumedFromConversationId: data.resumedFromConversationId,
            buddyContext: buddyResolution?.context,
          });
          const existingConversation = conversations.get(data.conversationId);
          if (existingConversation) {
            try {
              await conversationConfigService.createOrReplay({
                conversationId: data.conversationId,
                config: data.config,
                workingDirectory: workingDir,
                creation: {
                  commandId: data.commandId,
                  fingerprint,
                  initialMessage: data.initialMessage,
                  swarmDebugPrefix: data.swarmDebugPrefix,
                  resumedFromConversationId: data.resumedFromConversationId,
                  buddyContext: buddyResolution?.context,
                },
              });
              sendToClient(ws, {
                type: 'conversation_created',
                commandId: data.commandId,
                conversation: existingConversation.toJSON(),
              });
              await dispatchCreationMessageIfPending(existingConversation);
            } catch {
              sendCommandRejected(ws, {
                commandId: data.commandId,
                conversationId: data.conversationId,
                error: {
                  code: 'create_failed',
                  message: 'Conversation ID already exists with different configuration',
                },
                authoritativeConversation: existingConversation.toJSON(),
              });
            }
            break;
          }

          try {
            const persisted = await conversationConfigService.getRecord(data.conversationId);
            if (!persisted) {
              const directoryError = validateWorkingDirectory(workingDir);
              if (directoryError) {
                sendCommandRejected(ws, {
                  commandId: data.commandId,
                  conversationId: data.conversationId,
                  error: directoryError,
                });
                break;
              }
            }

            const creation = await conversationConfigService.createOrReplay({
              conversationId: data.conversationId,
              config: data.config,
              workingDirectory: workingDir,
              creation: {
                commandId: data.commandId,
                fingerprint,
                initialMessage: data.initialMessage,
                swarmDebugPrefix: data.swarmDebugPrefix,
                resumedFromConversationId: data.resumedFromConversationId,
                buddyContext: buddyResolution?.context,
              },
            });
            const conv = new Conversation({
              id: data.conversationId,
              workingDirectory: creation.record.workingDirectory ?? workingDir,
              configState: creation.state,
              existingSessionId: creation.record.currentSession?.sessionId,
              swarmDebugPrefix: data.swarmDebugPrefix ?? null,
              resumedFromConversationId: data.resumedFromConversationId ?? null,
              buddyContext: buddyResolution?.context ?? null,
              buddyBriefing: buddyResolution?.briefing ?? null,
            });
            conversations.set(conv.id, conv);
            await createBuddyConversationLink(conv);
            sendToClient(ws, {
              type: 'conversation_created',
              commandId: data.commandId,
              conversation: conv.toJSON(),
            });
            broadcastToAllExcept(ws, {
              type: 'conversation_updated',
              reason: 'status',
              conversation: conv.toJSON(),
            });
            await dispatchCreationMessageIfPending(conv);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendCommandRejected(ws, {
              commandId: data.commandId,
              conversationId: data.conversationId,
              error: { code: 'create_failed', message },
            });
          }
          break;
        }

        case 'send_message': {
          console.log(
            `[WS] send_message for ${data.conversationId}: "${data.content.substring(0, 50)}"`
          );
          const conversation = conversations.get(data.conversationId);
          if (conversation) {
            console.log('[WS] Found conversation, calling sendMessage');
            conversation.sendMessage(data.content);
          } else {
            console.error(`[WS] Conversation not found: ${data.conversationId}`);
            console.error('[WS] Available conversations:', Array.from(conversations.keys()));
          }
          break;
        }

        case 'stop_conversation': {
          const convToStop = conversations.get(data.conversationId);
          if (convToStop) {
            convToStop.stop();
          }
          break;
        }

        case 'delete_conversation': {
          const convToDelete = conversations.get(data.conversationId);
          const deletedDurably = await conversationConfigService.delete(data.conversationId);
          if (convToDelete) {
            convToDelete.stop();
            conversations.delete(data.conversationId);
            // Tombstone all session IDs (current + rotated) so the poller never
            // re-imports the orphaned JSONL files that still exist on disk.
            deletedSessionIds.add(convToDelete.sessionId);
            for (const [sid, cid] of sessionAliasToConversationId) {
              if (cid === convToDelete.id) deletedSessionIds.add(sid);
            }
            // Evict session IDs so the orphan-detection guard doesn't accumulate forever
            unregisterConversationAliases(convToDelete.id);
            clearExternalRunningStatus(convToDelete.sessionId, convToDelete.id);
            clearLocalCompletionSuppression(convToDelete.sessionId, convToDelete.id);
          }
          if (convToDelete || deletedDurably) {
            broadcastToAll({
              type: 'conversation_deleted',
              conversationId: data.conversationId,
            });
          }
          break;
        }

        case 'set_conversation_config': {
          const conv = conversations.get(data.conversationId);
          if (!conv) {
            sendCommandRejected(ws, {
              commandId: data.commandId,
              conversationId: data.conversationId,
              error: { code: 'conversation_not_found', message: 'Conversation not found' },
            });
            break;
          }
          const result = await conversationConfigService.update(
            {
              config: conv.config,
              revision: conv.configRevision,
              resolution: conv.configResolution,
            },
            {
              isRunning: conv.isRunning,
              queueDepth: conv.queue.length,
              hasStartedSession: conv.hasStartedSession(),
            },
            data
          );
          if (!result.ok) {
            sendCommandRejected(ws, {
              commandId: data.commandId,
              conversationId: data.conversationId,
              error: result.error,
              authoritativeConversation: conv.toJSON(),
            });
            break;
          }
          conv.applyConfigState(result.value.next);
          broadcastToAll({
            type: 'conversation_updated',
            commandId: data.commandId,
            reason: 'config',
            conversation: conv.toJSON(),
          });
          break;
        }

        case 'queue_message': {
          const conv = conversations.get(data.conversationId);
          if (conv) {
            conv.enqueueMessage(data.content);
          }
          break;
        }

        case 'interrupt_and_send': {
          const conv = conversations.get(data.conversationId);
          if (conv) {
            conv.interruptAndSend(data.content);
          }
          break;
        }

        case 'cancel_queued_message': {
          const conv = conversations.get(data.conversationId);
          if (conv) {
            conv.cancelQueuedMessage(data.messageId);
          }
          break;
        }

        case 'clear_queue': {
          const conv = conversations.get(data.conversationId);
          if (conv) {
            conv.clearQueue();
          }
          break;
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
      const message = e instanceof Error ? e.message : String(e);
      if (activeCommand) {
        sendCommandRejected(ws, {
          ...activeCommand,
          error: { code: 'command_failed', message },
        });
      } else {
        sendProtocolError(ws, `Failed to handle message: ${message}`);
      }
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// =============================================================================
// Express Routes
// =============================================================================

// JSON body parser for API routes.
// Default limit is 100kb which is far too small — queue-message, merge, and
// other endpoints routinely carry pasted content, inline images, or full
// conversation histories. Matches client uploads already sized in MB.
app.use(express.json({ limit: '50mb' }));

const UPLOADS_DIR = path.join(APP_DATA_DIR, 'uploads');
registerUploadRoutes(app, UPLOADS_DIR);

app.get('/api/audit', (_req: Request, res: Response) => {
  res.json(startupAuditResults);
});

persistedServerState.registerRoutes(app);

// Model list API — returns ModelInfo[] for the given provider.
// Used by the Sidebar model dropdown to show available models per provider.
app.get('/api/provider-catalog', (_req: Request, res: Response) => {
  res.json(createProviderCatalog());
});

registerBuddyRoutes(app, {
  getStore: getBuddiesStore,
  getScheduler: () => buddyScheduler,
  createConversation: createServerBuddyConversation,
  sendError: sendBuddiesError,
  getNextAutomationRunAt: nextAutomationRunAt,
  createId: uuidv4,
});

app.get('/api/models', (req: Request, res: Response) => {
  const providerName = (req.query.provider as string) || 'claude';
  if (!(providerName in providers)) {
    res.status(400).json({
      error: `Invalid provider: ${providerName}. Must be one of: ${Object.keys(providers).join(', ')}.`,
    });
    return;
  }
  const provider = getProvider(providerName as ProviderName);
  res.json(provider.listModels());
});

registerSearchRoutes(app, () => conversations.values());

registerFilesystemRoutes(app, {
  uploadsDirectory: UPLOADS_DIR,
  isUnderKnownProject,
});

/** Check if a resolved path is within any known conversation directory. */
function isUnderKnownProject(resolved: string): boolean {
  for (const conv of conversations.values()) {
    if (isPathWithin(conv.workingDirectory, resolved)) return true;
  }
  return false;
}

type OompaRunDir = {
  id: string;
  path: string;
  mtimeMs: number;
};

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readLatestRunDir(runsDir: string): OompaRunDir | null {
  try {
    const entries = fs
      .readdirSync(runsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const runPath = path.join(runsDir, entry.name);
        return {
          id: entry.name,
          path: runPath,
          mtimeMs: fs.statSync(runPath).mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return entries[0] ?? null;
  } catch {
    return null;
  }
}

function isTerminalWorkerStatus(status: OompaWorkerStatus): boolean {
  return status === 'done' || status === 'error';
}

function normalizeStatus(rawStatus: unknown): OompaWorkerStatus {
  if (!rawStatus || typeof rawStatus !== 'string') return 'starting';
  const status = rawStatus.toLowerCase();
  if (status === 'done' || status === 'completed' || status === 'exhausted') return 'done';
  if (status === 'idle') return 'idle';
  if (status === 'error' || status === 'failed' || status === 'fatal') return 'error';
  if (
    status === 'working' ||
    status === 'running' ||
    status === 'merged' ||
    status === 'rejected' ||
    status === 'no-changes' ||
    status === 'executor-done' ||
    status === 'claimed' ||
    status === 'sync-failed' ||
    status === 'merge-failed' ||
    status === 'starting'
  ) {
    return status === 'starting' ? 'starting' : 'running';
  }
  return 'starting';
}

/**
 * Read all JSON files from a cycles/ (or iterations/) directory.
 * Returns parsed OompaCycle objects sorted by filename.
 * NOTE: Old runs may use 'iteration' instead of 'cycle' field — the OompaCycle
 * type uses 'cycle' (authoritative from schema). Callers must handle the legacy field.
 */
function readCycleFiles(dir: string): OompaCycle[] {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    return files
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as OompaCycle;
        } catch {
          return null;
        }
      })
      .filter((x): x is OompaCycle => x !== null);
  } catch {
    return [];
  }
}

/**
 * Check if a process is alive via signal 0 (doesn't kill, just tests).
 */
function isPidAlive(pidValue: string | undefined): boolean {
  if (!pidValue) return false;
  const pid = Number.parseInt(pidValue, 10);
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the oompa orchestrator process is alive by reading meta files.
 * Returns true if any meta file's script_pid or bb_pid is alive.
 */
function isOompaProcessAlive(projectRoot: string): boolean {
  const logsDir = path.join(projectRoot, 'oompa', 'logs');
  try {
    const metaFiles = fs
      .readdirSync(logsDir)
      .filter((f) => /^run_.+\.meta$/.test(f))
      .map((f) => path.join(logsDir, f));

    for (const metaFile of metaFiles) {
      const content = fs.readFileSync(metaFile, 'utf-8');
      const meta: Record<string, string> = {};
      for (const line of content.split(/\r?\n/)) {
        if (!line) continue;
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
      if (isPidAlive(meta.script_pid) || isPidAlive(meta.bb_pid)) {
        return true;
      }
    }
  } catch {
    // No oompa/logs directory — can't confirm liveness from PIDs
  }
  return false;
}

/**
 * Event-sourced runtime reader: scans started.json + stopped.json + cycles/
 * directory to derive swarm state. Uses PID from started.json for liveness.
 * Backward-compatible with old format (run.json + iterations/).
 */
function readLatestOompaRuntime(projectRoot: string): OompaRuntimeSnapshot {
  const runsDir = path.join(projectRoot, 'runs');
  if (!fs.existsSync(runsDir)) {
    return { available: false, run: null, reason: 'No runs directory found' };
  }

  const latestRun = readLatestRunDir(runsDir);
  if (!latestRun) {
    return { available: false, run: null, reason: 'No run directories found' };
  }

  let runCount = 0;
  try {
    runCount = fs
      .readdirSync(runsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).length;
  } catch {
    runCount = 0;
  }

  const runId = latestRun.id;

  // Read event files: started.json (new) or run.json (old backward compat)
  // Cast to OompaStarted — safeReadJson returns Record<string,unknown> but the
  // schema-generated type is authoritative. Old run.json has the same shape.
  const startedData = (safeReadJson(path.join(latestRun.path, 'started.json')) ??
    safeReadJson(path.join(latestRun.path, 'run.json')) ??
    {}) as Partial<OompaStarted>;
  const stoppedData = safeReadJson(
    path.join(latestRun.path, 'stopped.json')
  ) as OompaStopped | null;

  // Scan cycles/ (new) or iterations/ (old backward compat)
  const cyclesDir = path.join(latestRun.path, 'cycles');
  const iterationsDir = path.join(latestRun.path, 'iterations');
  const scanDir = fs.existsSync(cyclesDir)
    ? cyclesDir
    : fs.existsSync(iterationsDir)
      ? iterationsDir
      : null;

  const cycleFiles = scanDir ? readCycleFiles(scanDir) : [];

  // Worker IDs from started.json config
  const configuredWorkers: string[] = [];
  if (startedData.workers) {
    for (const w of startedData.workers) {
      if (w.id) configuredWorkers.push(w.id);
    }
  }

  // Latest cycle per worker (handles both 'cycle' and legacy 'iteration' field names)
  // NOTE: OompaCycle uses 'cycle' (schema-authoritative). Old runs may have 'iteration'
  // instead — we cast to OompaCycle but tolerate the legacy field via bracket access.
  const latestCycleByWorker = new Map<string, OompaCycle>();
  for (const cycle of cycleFiles) {
    const wid = cycle['worker-id'];
    if (!wid) continue;
    const existing = latestCycleByWorker.get(wid);
    // Legacy compat: old runs used 'iteration' field instead of 'cycle'
    // Legacy compat: old runs used 'iteration' instead of 'cycle'
    const cycleNum =
      cycle.cycle ??
      ((cycle as unknown as Record<string, unknown>).iteration as number | undefined) ??
      0;
    const existingNum =
      existing?.cycle ??
      ((existing as unknown as Record<string, unknown>)?.iteration as number | undefined) ??
      0;
    if (!existing || cycleNum > existingNum) {
      latestCycleByWorker.set(wid, cycle);
    }
  }

  // Union of all known worker IDs
  const workerIds = new Set<string>([...configuredWorkers, ...latestCycleByWorker.keys()]);
  const totalWorkers = Math.max(workerIds.size, configuredWorkers.length);

  // Liveness: stopped.json present = swarm finished.
  // Otherwise check PID from started.json, with isOompaProcessAlive() as fallback
  // for old runs that don't have PID in started.json.
  const swarmStopped = stoppedData !== null;
  const pid = startedData.pid;
  const pidAlive = !swarmStopped && typeof pid === 'number' && isPidAlive(String(pid));
  const fallbackAlive = !swarmStopped && !pidAlive && isOompaProcessAlive(projectRoot);
  const isLive = !swarmStopped && (pidAlive || fallbackAlive);
  const startedAtMs = Date.parse(String(startedData['started-at'] ?? ''));
  const liveNoCycleGraceMs = 60_000;

  // Build worker snapshots from cycle data
  const swarmId = startedData['swarm-id'] ?? runId;
  const configPath = startedData['config-file'] ?? null;

  const workerSnapshots = Array.from(workerIds).map((id) => {
    const cycle = latestCycleByWorker.get(id);
    let status: OompaWorkerStatus;

    if (cycle) {
      status = normalizeStatus(cycle.outcome);
    } else if (isLive) {
      // Avoid "eternal starting": once the swarm is live past a short grace period,
      // workers with no completed cycles yet should be shown as running.
      const noCycleShouldBeRunning =
        !Number.isFinite(startedAtMs) || Date.now() - startedAtMs > liveNoCycleGraceMs;
      status = noCycleShouldBeRunning ? 'running' : 'starting';
    } else {
      status = 'done';
    }

    // If swarm is not live (clean stop OR crashed without stopped.json),
    // force all non-terminal workers to done — their "running" status is stale.
    if (!isLive && status !== 'done' && status !== 'error') {
      status = 'done';
    }

    return {
      id,
      status,
      lastEvent: cycle
        ? `Cycle ${cycle.cycle ?? '?'}: ${cycle.outcome ?? 'unknown'}`
        : swarmStopped
          ? 'Worker completed'
          : isLive
            ? 'Starting'
            : 'No data',
    };
  });

  const states = workerSnapshots.sort((a, b) => a.id.localeCompare(b.id));
  const doneWorkers = states.filter((w) => isTerminalWorkerStatus(w.status)).length;
  const activeWorkers = states.filter((w) => !isTerminalWorkerStatus(w.status)).length;

  return {
    available: true,
    run: {
      runId,
      swarmId,
      isRunning: isLive && activeWorkers > 0,
      totalWorkers,
      activeWorkers,
      doneWorkers,
      configPath,
      logFile: null,
      workers: states,
      runCount,
    },
    reason: null,
  };
}

const SWARM_CONTEXT_MAX_OUTPUT_CHARS = 8_000;
const SWARM_CONTEXT_MAX_DOC_CHARS = 3_000;
const SWARM_CONTEXT_MAX_DOC_FILES = 6;

function clip(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...<truncated>`;
}

function runCommandCapture(command: string, cwd: string): string {
  try {
    return execSync(command, {
      cwd,
      timeout: SWARM_CONTEXT_COMMAND_TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    const e = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stdout = typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString('utf-8') ?? '');
    const stderr = typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString('utf-8') ?? '');
    const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    return combined || e.message || `Command failed: ${command}`;
  }
}

function findDocCandidates(projectRoot: string): string[] {
  const candidates = [
    'README.md',
    'AGENTS.md',
    'CLAUDE.md',
    'docs/agent_client_spec.md',
    'docs/README.md',
    'docs/SWARM_GUIDE.md',
    'docs/OOMPA.md',
    'docs/JSON_TICKETS.md',
  ];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rel of candidates) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    result.push(abs);
  }

  const docsDir = path.join(projectRoot, 'docs');
  if (fs.existsSync(docsDir)) {
    try {
      const files = fs
        .readdirSync(docsDir)
        .filter((f) => f.toLowerCase().endsWith('.md'))
        .sort((a, b) => a.localeCompare(b));
      for (const file of files) {
        const abs = path.join(docsDir, file);
        if (seen.has(abs)) continue;
        seen.add(abs);
        result.push(abs);
      }
    } catch {
      // Ignore docs directory read failures
    }
  }

  return result.slice(0, SWARM_CONTEXT_MAX_DOC_FILES);
}

function listAvailableConfigFiles(projectRoot: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const addPath = (absPath: string) => {
    if (!absPath.toLowerCase().endsWith('.json')) return;
    if (seen.has(absPath)) return;
    seen.add(absPath);
    result.push(absPath);
  };

  try {
    for (const file of fs.readdirSync(projectRoot)) {
      if (!file.toLowerCase().startsWith('oompa')) continue;
      addPath(path.join(projectRoot, file));
    }
  } catch {
    // Ignore root listing failures
  }

  const oompaDir = path.join(projectRoot, 'oompa');
  if (fs.existsSync(oompaDir)) {
    try {
      for (const file of fs.readdirSync(oompaDir)) {
        if (!file.toLowerCase().startsWith('oompa')) continue;
        addPath(path.join(oompaDir, file));
      }
    } catch {
      // Ignore oompa/ listing failures
    }
  }

  return result.sort((a, b) => a.localeCompare(b));
}

app.get('/api/oompa-swarm-context', (req: Request, res: Response) => {
  const dir = typeof req.query.dir === 'string' ? req.query.dir : '';
  if (!dir.trim()) {
    res.status(400).json({ error: 'Directory path required' });
    return;
  }

  const projectRoot = resolveWorkingDirectoryInput(dir);
  if (!fs.existsSync(projectRoot)) {
    res.status(404).json({ error: 'Directory does not exist' });
    return;
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(projectRoot);
  } catch (error) {
    res.status(500).json({ error: `Failed to stat directory: ${(error as Error).message}` });
    return;
  }

  if (!stats.isDirectory()) {
    res.status(400).json({ error: 'Path must be a directory' });
    return;
  }

  const availableConfigs = listAvailableConfigFiles(projectRoot);
  const configPath = path.join(projectRoot, 'oompa.json');
  let oompaConfigSummary = 'No oompa.json found';
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      const workers = Array.isArray(config.workers)
        ? (config.workers as Array<Record<string, unknown>>)
        : [];
      const reviewer = config.reviewer && typeof config.reviewer === 'object';
      const planner = config.planner && typeof config.planner === 'object';
      const workerSummary =
        workers.length === 0
          ? 'workers=0'
          : `workers=${workers.length} (${workers
              .map((w, i) => {
                const harness = typeof w.harness === 'string' ? w.harness : 'default';
                const model = typeof w.model === 'string' ? w.model : 'default';
                const count = typeof w.count === 'number' ? `x${w.count}` : '';
                return `w${i}:${harness}:${model}${count}`;
              })
              .join(', ')})`;
      oompaConfigSummary = `${workerSummary}; reviewer=${reviewer ? 'yes' : 'no'}; planner=${
        planner ? 'yes' : 'no'
      }`;
    } catch (error) {
      oompaConfigSummary = `Failed to parse oompa.json: ${(error as Error).message}`;
    }
  }

  const oompaStatus = clip(
    runCommandCapture('oompa status', projectRoot),
    SWARM_CONTEXT_MAX_OUTPUT_CHARS
  );
  const oompaInfo = clip(
    runCommandCapture('oompa info', projectRoot),
    SWARM_CONTEXT_MAX_OUTPUT_CHARS
  );
  const docCandidates = findDocCandidates(projectRoot);
  const docBlocks = docCandidates.map((absPath) => {
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const rel = path.relative(projectRoot, absPath) || path.basename(absPath);
      return `### ${rel}\n${clip(content, SWARM_CONTEXT_MAX_DOC_CHARS)}`;
    } catch (error) {
      const rel = path.relative(projectRoot, absPath) || path.basename(absPath);
      return `### ${rel}\nFailed to read file: ${(error as Error).message}`;
    }
  });

  const lines: string[] = [
    'You are helping create and run a NEW oompa swarm configuration.',
    'Use this context before writing or editing swarm config files.',
    '',
    '## Project Context',
    `- Project: ${projectRoot}`,
    `- Generated At: ${new Date().toISOString()}`,
    `- Primary Config: ${fs.existsSync(configPath) ? configPath : 'not found'}`,
    `- Oompa Config Summary: ${oompaConfigSummary}`,
    '',
    '## Available Oompa Config Files',
  ];

  if (availableConfigs.length === 0) {
    lines.push('- (none found)');
  } else {
    for (const cfg of availableConfigs) {
      lines.push(`- ${cfg}`);
    }
  }

  lines.push(
    '',
    '## Command Output: oompa status',
    '```',
    oompaStatus || '(no output)',
    '```',
    '',
    '## Command Output: oompa info',
    '```',
    oompaInfo || '(no output)',
    '```',
    '',
    '## Docs To Follow For Good Oompa Agents',
    ...(docBlocks.length > 0
      ? docBlocks.flatMap((block) => ['```markdown', block, '```'])
      : ['No docs discovered (look for README.md, AGENTS.md, and docs/*.md).']),
    '',
    'When the user asks for a new swarm config, follow these docs and command outputs exactly.',
    'Prefer editing or creating oompa config files and explain why each worker/planner/reviewer setting exists.'
  );

  res.json({ prefix: lines.join('\n') });
});

app.get('/api/git-log', (req: Request, res: Response) => {
  const dir = req.query.dir as string;
  if (!dir || !dir.startsWith('/')) {
    res.status(400).json({ error: 'Absolute directory path required' });
    return;
  }

  const resolved = path.resolve(dir);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ error: 'Directory not associated with any conversation' });
    return;
  }

  // Use tab delimiter — tabs never appear in commit messages, unlike |
  try {
    const raw = execSync('git log --oneline -20 --format="%H\t%s\t%aI\t%an"', {
      cwd: resolved,
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .toString()
      .trim();

    const entries = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\t');
        if (parts.length < 4) return { hash: parts[0] ?? '', message: line, date: '', author: '' };
        return { hash: parts[0], message: parts[1], date: parts[2], author: parts[3] };
      });

    res.json(entries);
  } catch {
    res.json([]);
  }
});

app.get('/api/oompa-config', (req: Request, res: Response) => {
  const dir = req.query.dir as string;
  if (!dir || !dir.startsWith('/')) {
    res.status(400).json({ error: 'Absolute directory path required' });
    return;
  }

  const resolved = path.resolve(dir);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ error: 'Directory not associated with any conversation' });
    return;
  }

  const configPath = path.join(resolved, 'oompa.json');
  if (!fs.existsSync(configPath)) {
    res.status(404).json({ error: 'No oompa.json found' });
    return;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (e) {
    res.status(500).json({ error: `Failed to parse oompa.json: ${(e as Error).message}` });
  }
});

// =============================================================================
// Swarm Run Data API — serves structured run/review/summary JSON from
// runs/{swarm-id}/ written by oompa's agentnet.runs module.
// =============================================================================

/**
 * Synthesize a SwarmRunSummary from run.json (or started.json) worker configs + review files.
 *
 * Keep this synthesis path for compatibility with older runs or environments
 * where summary.json is missing; otherwise prefer live/final summary data from
 * runs/{swarm-id}/summary.json when available.
 * NOTE: New event-sourced runs use started.json instead of run.json.
 *
 * Verdict buckets:
 *   "approved"      → merges (iteration merged to main)
 *   "rejected"      → rejections (iteration permanently rejected)
 *   "needs-changes" → neither (iteration sent back for another round)
 */
async function synthesizeSummary(
  runDir: string,
  swarmId: string,
  run: OompaStarted
): Promise<Record<string, unknown>> {
  // Read cycle files — these are the primary source of truth for worker progress
  const cyclesDir = path.join(runDir, 'cycles');
  const iterationsDir = path.join(runDir, 'iterations');
  let cycleFileDir: string | null = null;
  try {
    await fs.promises.access(cyclesDir);
    cycleFileDir = cyclesDir;
  } catch {
    try {
      await fs.promises.access(iterationsDir);
      cycleFileDir = iterationsDir;
    } catch {
      // No cycle data at all
    }
  }

  // OompaCycle is the schema-authoritative type. Old runs may use 'iteration' instead of 'cycle'.
  const cyclesByWorker = new Map<string, OompaCycle[]>();

  if (cycleFileDir) {
    const cycleFileNames = (await fs.promises.readdir(cycleFileDir)).filter((f) =>
      f.endsWith('.json')
    );
    await Promise.all(
      cycleFileNames.map(async (cf) => {
        try {
          const content = await fs.promises.readFile(path.join(cycleFileDir!, cf), 'utf-8');
          const cycle = JSON.parse(content) as OompaCycle;
          const wid = cycle['worker-id'];
          if (!wid) return;
          if (!cyclesByWorker.has(wid)) cyclesByWorker.set(wid, []);
          cyclesByWorker.get(wid)!.push(cycle);
        } catch {
          // Skip malformed cycle files
        }
      })
    );
  }

  // Read review files
  const reviewsDir = path.join(runDir, 'reviews');
  let reviewFileNames: string[] = [];
  try {
    reviewFileNames = (await fs.promises.readdir(reviewsDir)).filter((f) => f.endsWith('.json'));
  } catch {
    // No reviews directory
  }

  const reviewsByWorker = new Map<string, OompaReviewLog[]>();

  await Promise.all(
    reviewFileNames.map(async (rf) => {
      try {
        const content = await fs.promises.readFile(path.join(reviewsDir, rf), 'utf-8');
        const review = JSON.parse(content) as OompaReviewLog;
        const wid = review['worker-id'];
        if (!wid) return;
        if (!reviewsByWorker.has(wid)) reviewsByWorker.set(wid, []);
        reviewsByWorker.get(wid)!.push(review);
      } catch {
        // Skip malformed review files
      }
    })
  );

  // Check liveness: stopped.json present = done, else check PID
  const stoppedFile = path.join(runDir, 'stopped.json');
  let isStopped = false;
  try {
    await fs.promises.access(stoppedFile);
    isStopped = true;
  } catch {
    // No stopped.json — check PID
  }

  let isLive = false;
  if (!isStopped) {
    const pid = run.pid;
    if (typeof pid === 'number') {
      isLive = isPidAlive(String(pid));
    }
  }
  const startedAtMs = Date.parse(String(run['started-at'] ?? ''));
  const liveNoCycleGraceMs = 60_000;

  const workers = (run.workers ?? []).map((w) => {
    const wid = w.id;
    const workerCycles = cyclesByWorker.get(wid) ?? [];
    const workerReviews = reviewsByWorker.get(wid) ?? [];

    // Count outcomes from cycle data
    let merges = 0;
    let rejections = 0;
    let errors = 0;
    let latestOutcome: OompaCycle['outcome'] | null = null;
    let latestCycleNum = 0;

    for (const c of workerCycles) {
      const num = c.cycle ?? 0;
      if (num > latestCycleNum) {
        latestCycleNum = num;
        latestOutcome = c.outcome;
      }
      if (c.outcome === 'merged') merges++;
      else if (c.outcome === 'rejected') rejections++;
      else if (c.outcome === 'error' || c.outcome === 'sync-failed' || c.outcome === 'merge-failed')
        errors++;
    }

    // Derive status from what we actually know — never fabricate
    let status: string;
    if (workerCycles.length === 0 && !isLive) {
      status = 'unknown'; // No data and not running — don't pretend we know
    } else if (workerCycles.length === 0 && isLive) {
      const noCycleShouldBeRunning =
        !Number.isFinite(startedAtMs) || Date.now() - startedAtMs > liveNoCycleGraceMs;
      status = noCycleShouldBeRunning ? 'running' : 'starting';
    } else if (latestOutcome === 'done' || latestOutcome === 'executor-done') {
      status = 'completed';
    } else if (latestOutcome === 'error') {
      status = 'error';
    } else if (isLive) {
      status = 'running';
    } else if (isStopped) {
      status = 'completed';
    } else {
      status = 'unknown'; // Not running, no stopped.json, ambiguous — say so
    }

    // needs-changes from reviews
    let needsChanges = 0;
    // OompaReviewLog uses 'cycle' (schema-authoritative), keyed per-cycle for last verdict
    const cycleVerdicts = new Map<number, OompaReviewLog['verdict']>();
    for (const r of workerReviews) {
      cycleVerdicts.set(r.cycle, r.verdict);
    }
    for (const verdict of cycleVerdicts.values()) {
      if (verdict === 'needs-changes') needsChanges++;
    }

    return {
      id: wid,
      harness: w.harness ?? 'default',
      model: w.model ?? 'unknown',
      status,
      completed: merges + rejections,
      iterations: w.iterations ?? 0,
      merges,
      rejections,
      'needs-changes': needsChanges,
      errors,
      'review-rounds-total': workerReviews.length,
    };
  });

  // Timestamps: only report what we actually have
  let latestTimestamp = '';
  for (const cycles of cyclesByWorker.values()) {
    for (const c of cycles) {
      if (c.timestamp && c.timestamp > latestTimestamp) {
        latestTimestamp = c.timestamp;
      }
    }
  }
  for (const reviews of reviewsByWorker.values()) {
    for (const r of reviews) {
      if (r.timestamp && r.timestamp > latestTimestamp) {
        latestTimestamp = r.timestamp;
      }
    }
  }

  return {
    'swarm-id': swarmId,
    // Don't fabricate finished-at from started-at — null means "we don't know"
    'finished-at': isStopped ? latestTimestamp || null : isLive ? null : latestTimestamp || null,
    'total-workers': workers.length,
    'total-completed': workers.reduce((s, w) => s + w.completed, 0),
    'total-iterations': workers.reduce((s, w) => s + w.iterations, 0),
    'status-counts': {},
    workers,
  };
}

app.get('/api/swarm-runs', async (req: Request, res: Response) => {
  const dir = req.query.dir as string;
  if (!dir || !dir.startsWith('/')) {
    res.status(400).json({ error: 'Absolute directory path required' });
    return;
  }

  const resolved = path.resolve(dir);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ error: 'Directory not associated with any conversation' });
    return;
  }

  const runsDir = path.join(resolved, 'runs');
  try {
    await fs.promises.access(runsDir);
  } catch {
    res.json({ runs: [] });
    return;
  }

  const entries = await fs.promises.readdir(runsDir, { withFileTypes: true });
  const runs = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        const runDir = path.join(runsDir, e.name);
        const startedFile = path.join(runDir, 'started.json');
        const runFile = path.join(runDir, 'run.json'); // backward compat
        const summaryFile = path.join(runDir, 'summary.json');

        let run: OompaStarted | null = null;
        let summary = null;

        // New format: started.json; old format: run.json (same shape = OompaStarted)
        try {
          run = JSON.parse(await fs.promises.readFile(startedFile, 'utf-8')) as OompaStarted;
        } catch {
          try {
            run = JSON.parse(await fs.promises.readFile(runFile, 'utf-8')) as OompaStarted;
          } catch {
            // No started.json or run.json — skip
          }
        }
        try {
          summary = JSON.parse(await fs.promises.readFile(summaryFile, 'utf-8'));
        } catch {
          // No summary.json — synthesize below
        }

        if (!summary && run) {
          summary = await synthesizeSummary(runDir, e.name, run);
        }

        return { swarmId: e.name, run, summary };
      })
  );

  runs.sort((a, b) => {
    const aTime = a.run?.['started-at'] ?? '';
    const bTime = b.run?.['started-at'] ?? '';
    return bTime.localeCompare(aTime);
  });

  res.json({ runs });
});

// Count .json files added in merge commits during a swarm run's time window.
// Uses git log --merges with the run's started-at / finished-at to scope commits,
// then --diff-filter=A --name-only to find added .json files across those merges.
app.get('/api/swarm-new-files', async (req: Request, res: Response) => {
  const dir = req.query.dir as string;
  const swarmId = req.query.swarmId as string;
  if (!dir || !dir.startsWith('/') || !swarmId) {
    res.status(400).json({ error: 'Absolute directory path and swarmId required' });
    return;
  }

  const resolved = path.resolve(dir);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ error: 'Directory not associated with any conversation' });
    return;
  }

  const runDir = path.join(resolved, 'runs', swarmId);

  // Read start time from started.json or run.json (backward compat)
  let startedAt: string | null = null;
  for (const filename of ['started.json', 'run.json']) {
    try {
      const data = JSON.parse(
        await fs.promises.readFile(path.join(runDir, filename), 'utf-8')
      ) as Record<string, unknown>;
      if (typeof data['started-at'] === 'string') {
        startedAt = data['started-at'];
        break;
      }
    } catch {
      // try next file
    }
  }

  if (!startedAt) {
    res.json({ count: 0, files: [] });
    return;
  }

  // Read finish time from summary.json or stopped.json (open-ended if still running)
  let finishedAt: string | null = null;
  for (const filename of ['summary.json', 'stopped.json']) {
    try {
      const data = JSON.parse(
        await fs.promises.readFile(path.join(runDir, filename), 'utf-8')
      ) as Record<string, unknown>;
      const t = data['finished-at'] ?? data['stopped-at'];
      if (typeof t === 'string') {
        finishedAt = t;
        break;
      }
    } catch {
      // try next file
    }
  }

  try {
    // Sanitize ISO 8601 timestamps — only allow digits, T, :, Z, ., +, -
    const safeStart = startedAt.replace(/[^0-9T:Z.+\-]/g, '');
    const beforeFlag = finishedAt ? `--before="${finishedAt.replace(/[^0-9T:Z.+\-]/g, '')}"` : '';

    const raw = execSync(
      `git log --merges --after="${safeStart}" ${beforeFlag} --diff-filter=A --name-only --pretty=format: -- "*.json"`,
      { cwd: resolved, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    )
      .toString()
      .trim();

    const files = raw.split('\n').filter((l) => l.trim().length > 0);
    res.json({ count: files.length, files });
  } catch {
    res.json({ count: 0, files: [] });
  }
});

app.get('/api/swarm-runtime', (req: Request, res: Response) => {
  const dir = req.query.dir as string;
  if (!dir || !dir.startsWith('/')) {
    res.status(400).json({ error: 'Absolute directory path required' });
    return;
  }

  const resolved = path.resolve(dir);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ error: 'Directory not associated with any conversation' });
    return;
  }

  const snapshot = readLatestOompaRuntime(resolved);
  res.json(snapshot);
});

/**
 * Discover all projects that have oompa runs/ directories.
 * This is the primary swarm discovery mechanism — derived from oompa's own
 * event-sourced run data, not from conversation files. Projects appear here
 * even when workers use non-Claude harnesses (gemini, codex, etc.) that
 * don't produce JSONL conversation files.
 */
app.get('/api/swarm-projects', (_req: Request, res: Response) => {
  // Collect unique project roots from all conversations
  const projectRoots = new Set<string>();
  for (const conv of conversations.values()) {
    if (conv.workingDirectory) {
      projectRoots.add(path.resolve(conv.workingDirectory));
    }
  }

  const projects: Array<{
    projectRoot: string;
    projectName: string;
    runtime: ReturnType<typeof readLatestOompaRuntime>;
  }> = [];

  for (const root of projectRoots) {
    const runsDir = path.join(root, 'runs');
    try {
      if (!fs.existsSync(runsDir)) continue;
      const latestRun = readLatestRunDir(runsDir);
      if (!latestRun) continue;
      // Verify it has a started.json (not just a random directory)
      const startedPath = path.join(latestRun.path, 'started.json');
      if (!fs.existsSync(startedPath)) continue;

      const runtime = readLatestOompaRuntime(root);
      projects.push({
        projectRoot: root,
        projectName: root.split('/').filter(Boolean).pop() ?? root,
        runtime,
      });
    } catch {
      // Skip projects where runs/ scan fails
    }
  }

  res.json({ projects });
});

/**
 * Send stop (SIGTERM) or kill (SIGKILL) signal to a running oompa swarm.
 * - 'stop': graceful — workers finish current cycle then exit
 * - 'kill': immediate — SIGKILL bypasses shutdown hooks, so we write stopped.json
 */
app.post('/api/swarm-signal', (req: Request, res: Response) => {
  const { dir, signal, swarmId } = req.body as {
    dir?: string;
    signal?: 'stop' | 'kill';
    swarmId?: string;
  };

  if (!dir || !dir.startsWith('/')) {
    res.status(400).json({ ok: false, message: 'Absolute directory path required' });
    return;
  }
  if (signal !== 'stop' && signal !== 'kill') {
    res.status(400).json({ ok: false, message: 'signal must be "stop" or "kill"' });
    return;
  }

  const resolved = path.resolve(dir);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ ok: false, message: 'Directory not associated with any conversation' });
    return;
  }

  // Find the run directory
  const runsDir = path.join(resolved, 'runs');
  let runDir: string;
  if (swarmId) {
    // Prevent path traversal — swarmId must not escape runsDir
    const candidate = path.resolve(runsDir, swarmId);
    if (!candidate.startsWith(runsDir + path.sep)) {
      res.status(400).json({ ok: false, message: 'Invalid swarmId' });
      return;
    }
    runDir = candidate;
  } else {
    const latest = readLatestRunDir(runsDir);
    if (!latest) {
      res.status(404).json({ ok: false, message: 'No runs found' });
      return;
    }
    runDir = latest.path;
  }

  // Check if already stopped
  const stoppedPath = path.join(runDir, 'stopped.json');
  if (fs.existsSync(stoppedPath)) {
    res.json({ ok: false, message: 'Swarm already stopped' });
    return;
  }

  // Read PID from started.json
  const startedData = safeReadJson(path.join(runDir, 'started.json')) as Record<
    string,
    unknown
  > | null;
  const pid = startedData?.pid as number | undefined;
  if (!pid || !Number.isFinite(pid) || pid <= 0) {
    res.json({ ok: false, message: 'No valid PID found in started.json' });
    return;
  }

  // Check if PID is alive
  if (!isPidAlive(String(pid))) {
    // Stale PID — write stopped.json to clean up
    const stoppedEvent = {
      'swarm-id': startedData?.['swarm-id'] ?? 'unknown',
      'stopped-at': new Date().toISOString(),
      reason: 'interrupted',
      error: 'Process was not running (stale PID)',
    };
    fs.writeFileSync(stoppedPath, JSON.stringify(stoppedEvent, null, 2));
    res.json({ ok: true, message: 'Swarm was not running (stale PID). Marked as stopped.' });
    return;
  }

  // Send the signal
  try {
    if (signal === 'stop') {
      process.kill(pid, 'SIGTERM');
      res.json({
        ok: true,
        message: `SIGTERM sent to PID ${pid}. Workers will finish current cycle.`,
      });
    } else {
      process.kill(pid, 'SIGKILL');
      // SIGKILL bypasses shutdown hooks — write stopped.json ourselves
      const stoppedEvent = {
        'swarm-id': startedData?.['swarm-id'] ?? 'unknown',
        'stopped-at': new Date().toISOString(),
        reason: 'interrupted',
      };
      fs.writeFileSync(stoppedPath, JSON.stringify(stoppedEvent, null, 2));
      res.json({ ok: true, message: `SIGKILL sent to PID ${pid}. Swarm terminated.` });
    }
  } catch (err) {
    res.status(500).json({ ok: false, message: `Failed to send signal: ${err}` });
  }
});

app.get('/api/swarm-reviews', (req: Request, res: Response) => {
  const dir = req.query.dir as string;
  const swarmId = req.query.swarmId as string;
  if (!dir || !dir.startsWith('/') || !swarmId) {
    res.status(400).json({ error: 'dir (absolute path) and swarmId required' });
    return;
  }

  const resolved = path.resolve(dir);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ error: 'Directory not associated with any conversation' });
    return;
  }

  // Prevent path traversal — swarmId must not escape runsDir (mirrors /api/swarm-signal)
  const runsDir = path.join(resolved, 'runs');
  const swarmRunDir = path.resolve(runsDir, swarmId);
  if (!swarmRunDir.startsWith(runsDir + path.sep)) {
    res.status(400).json({ error: 'Invalid swarmId' });
    return;
  }

  const reviewsDir = path.join(swarmRunDir, 'reviews');
  if (!fs.existsSync(reviewsDir)) {
    res.json({ reviews: [] });
    return;
  }

  const files = fs
    .readdirSync(reviewsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  // Per-file try/catch so one bad file doesn't crash the whole endpoint
  const reviews: OompaReviewLog[] = files.flatMap((f) => {
    try {
      const content = fs.readFileSync(path.join(reviewsDir, f), 'utf-8');
      return [JSON.parse(content) as OompaReviewLog];
    } catch {
      return [];
    }
  });

  res.json({ reviews });
});

app.get('/api/read-file', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath || !filePath.startsWith('/')) {
    res.status(400).json({ error: 'Absolute path required' });
    return;
  }

  const resolved = path.resolve(filePath);
  if (!isUnderKnownProject(resolved)) {
    res.status(403).json({ error: 'Path not under any known project directory' });
    return;
  }

  if (!fs.existsSync(resolved)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  res.json({ content });
});

// =============================================================================
// Merge API — fork N source conversations, aggregate review docs into a parent
// =============================================================================
//
// Flow:
//  1. Client selects N source conversations (all providers must support fork).
//  2. Server mints parentId + per-child (childId, reviewUuid).
//  3. Server creates a parent Conversation (mergeParentMeta set).
//  4. For each source, server creates a child Conversation (mergeChildMeta set)
//     and immediately spawns a fork with the verbatim review prompt.
//  5. As each child completes, server scans final assistant content for the
//     sentinel `merge_review_docs/REVIEW_DOC_<uuid>.txt` and broadcasts
//     merge_child_status { complete | error } (see Conversation.handleOutput).
//  6. Client enables the parent's send button once all children settled; on
//     first user send, server injects a prefix with review doc contents.
//
// Validation:
//  - sourceIds must all exist in the conversations Map.
//  - Every source provider must pass providerSupportsFork() (claude, opencode
//    only for now — codex/gemini/cursor throw until cp+resume lands).
//  - No source may be currently running (fork of a mid-flight transcript
//    produces junk). Returns 409 if so.
app.post('/api/conversations/merge', express.json(), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const parsedParentConfig = ConversationConfigSchema.safeParse(body.parentConfig);
  const parentConfig = parsedParentConfig.success ? parsedParentConfig.data : undefined;
  const sourceIds = body.sourceIds as string[] | undefined;
  const workingDirectory = body.workingDirectory as string | undefined;

  if (!parentConfig) {
    res.status(400).json({ error: 'Invalid or missing parentConfig' });
    return;
  }
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    res.status(400).json({ error: 'sourceIds must be a non-empty array' });
    return;
  }
  if (!workingDirectory) {
    res.status(400).json({ error: 'workingDirectory required' });
    return;
  }

  // Resolve + validate every source up front. If any fails, abort without
  // creating any conversations — the merge must be atomic from the client's
  // point of view.
  const sources: Array<{ id: string; conv: Conversation }> = [];
  for (const sid of sourceIds) {
    const conv = conversations.get(sid);
    if (!conv) {
      res.status(404).json({ error: `Source conversation not found: ${sid}` });
      return;
    }
    if (!providerSupportsFork(conv.provider)) {
      res.status(400).json({
        error: `Provider "${conv.provider}" does not support fork yet. Supported: ${[...FORK_CAPABLE_PROVIDERS].join(', ')}.`,
        conversationId: sid,
      });
      return;
    }
    if (conv.isRunning) {
      res.status(409).json({
        error: `Source conversation is still running: ${sid}. Stop it first.`,
        conversationId: sid,
      });
      return;
    }
    sources.push({ id: sid, conv });
  }

  // Mint all ids atomically.
  const parentId = uuidv4();
  const children = sources.map((src) => ({
    sourceConversationId: src.id,
    childConversationId: uuidv4(),
    reviewUuid: uuidv4(),
    childWorkingDirectory: src.conv.workingDirectory,
  }));

  // Resolve and persist every config before exposing any of the merge
  // conversations in memory. This keeps the visible merge creation atomic.
  const createdConfigIds: string[] = [];
  let parentConfigState: ConversationConfigState;
  const childConfigStates: ConversationConfigState[] = [];
  try {
    parentConfigState = await conversationConfigService.create({
      conversationId: parentId,
      config: parentConfig,
      workingDirectory,
    });
    createdConfigIds.push(parentId);

    for (let index = 0; index < children.length; index += 1) {
      const childId = children[index].childConversationId;
      const source = sources[index].conv;
      const state = await conversationConfigService.fork({
        conversationId: childId,
        source: {
          config: source.config,
          revision: source.configRevision,
          resolution: source.configResolution,
        },
        workingDirectory: children[index].childWorkingDirectory,
      });
      childConfigStates.push(state);
      createdConfigIds.push(childId);
    }
  } catch (error) {
    await Promise.all(createdConfigIds.map((id) => conversationConfigService.purge(id)));
    res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  // Create parent conversation. It has no fork seed — it's an ordinary chat
  // whose only peculiarity is mergeParentMeta + the one-time prefix injection
  // on first send (see sendMessage).
  const parent = new Conversation({
    id: parentId,
    workingDirectory,
    configState: parentConfigState,
    mergeParentMeta: {
      children: children.map((c) => ({
        sourceConversationId: c.sourceConversationId,
        childConversationId: c.childConversationId,
        reviewUuid: c.reviewUuid,
        childWorkingDirectory: c.childWorkingDirectory,
      })),
      prefixInjected: false,
    },
  });
  conversations.set(parentId, parent);
  broadcastToAll({
    type: 'conversations_updated',
    conversations: [parent.toJSON()],
  });

  // Create each child conversation and immediately spawn the review fork.
  // Each child inherits the source's provider + model + cwd so the forked
  // session resumes under the same CLI harness.
  //
  // Strategy per provider:
  //   native   → spawn with forkSessionId=src.sessionId; CLI flags handle it
  //   emulated → cp the source session file to a new uuid on disk, then
  //              spawn a plain --resume on the clone. Source file untouched.
  for (let i = 0; i < children.length; i++) {
    const meta = children[i];
    const src = sources[i].conv;
    const child = new Conversation({
      id: meta.childConversationId,
      workingDirectory: src.workingDirectory,
      configState: childConfigStates[i],
      resumedFromConversationId: src.id,
      mergeChildMeta: {
        parentConversationId: parentId,
        reviewUuid: meta.reviewUuid,
      },
    });
    conversations.set(child.id, child);
    broadcastToAll({
      type: 'conversations_updated',
      conversations: [child.toJSON()],
    });

    const prompt = buildMergeReviewPrompt(meta.reviewUuid);
    try {
      // Opaque call: the shared agent-cli library handles native vs
      // cp+resume emulation transparently based on the harness config.
      child.spawnMergeReviewFork(prompt, src.sessionId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[merge] Failed to spawn fork for source ${src.id}:`, err);
      broadcastToAll({
        type: 'merge_child_status',
        parentConversationId: parentId,
        childConversationId: child.id,
        reviewUuid: meta.reviewUuid,
        status: 'error',
        errorMessage,
      });
    }
  }

  res.json({
    parentId,
    children: children.map((c) => ({
      sourceId: c.sourceConversationId,
      childId: c.childConversationId,
      reviewUuid: c.reviewUuid,
    })),
  });
});

// =============================================================================
// Custom Palette API — AI-generated color palettes stored as plain .json files
// Palettes are saved in ~/.agent-viewer/palettes/palette_{N}.json
// Each file stores a Palette16 (14 color keys + name + description).
//
// Palette16 keys: base03, base02, base01, base00, base0, base1,
//                 yellow, orange, red, magenta, violet, blue, cyan, green
// =============================================================================

const PALETTES_DIR = path.join(APP_DATA_DIR, 'palettes');

/** The 14 semantic keys that make up a Palette16 (excluding 'name') */
const PALETTE16_KEYS = [
  'bgCanvas',
  'bgSurface',
  'textMuted',
  'textSubtle',
  'textBody',
  'textBright',
  'primary',
  'user',
  'ai',
  'success',
  'warning',
  'queue',
  'danger',
  'meta',
] as const;

/** Shape stored on disk — Palette16 values plus description for provenance */
interface StoredPalette {
  name: string;
  description: string;
  bgCanvas: string;
  bgSurface: string;
  textMuted: string;
  textSubtle: string;
  textBody: string;
  textBright: string;
  primary: string;
  user: string;
  ai: string;
  success: string;
  warning: string;
  queue: string;
  danger: string;
  meta: string;
}

// =============================================================================
// Palette Cache — initialized once at startup, updated on generate
// =============================================================================

/** In-memory cache of custom palettes (keyed by "custom_N") */
let paletteCache: Record<string, Record<string, string>> = {};
/** Next available palette number (incremented after each generation) */
let nextPaletteNumber = 1;

/**
 * Initialize palette cache from disk. Called once at startup.
 * Reads all palette_N.json files and builds the cache.
 */
async function initPaletteCache(): Promise<void> {
  paletteCache = {};
  nextPaletteNumber = 1;

  try {
    const entries = await fs.promises.readdir(PALETTES_DIR, { withFileTypes: true });

    // Parse all palette files in parallel
    const parsePromises = entries
      .filter((entry) => entry.isFile() && /^palette_\d+\.json$/.test(entry.name))
      .map(async (entry) => {
        const match = entry.name.match(/^palette_(\d+)\.json$/);
        if (!match) return null;

        const n = Number.parseInt(match[1], 10);
        const filePath = path.join(PALETTES_DIR, entry.name);

        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const stored = JSON.parse(content) as StoredPalette;
          const palette: Record<string, string> = { name: stored.name };
          for (const key of PALETTE16_KEYS) {
            palette[key] = stored[key];
          }
          return { key: `custom_${n}`, palette, n };
        } catch (e) {
          console.error(`Failed to parse palette file ${entry.name}:`, e);
          return null;
        }
      });

    const results = await Promise.all(parsePromises);

    for (const result of results) {
      if (result) {
        paletteCache[result.key] = result.palette;
        if (result.n >= nextPaletteNumber) {
          nextPaletteNumber = result.n + 1;
        }
      }
    }

    console.log(
      `Palette cache initialized: ${Object.keys(paletteCache).length} palettes, next number: ${nextPaletteNumber}`
    );
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      // Directory doesn't exist — no palettes yet
      console.log('Palettes directory not found, starting with empty cache');
    } else {
      throw new Error(`Failed to initialize palette cache: ${(e as Error).message}`);
    }
  }
}

// GET /api/custom-palettes — returns Record<string, Palette16> of saved custom palettes
// Each entry has { name, base03, base02, ..., green } matching the Palette16 interface.
// Reads from in-memory cache (zero I/O).
app.get('/api/custom-palettes', (_req: Request, res: Response) => {
  res.json(paletteCache);
});

// DELETE /api/custom-palettes/:key — remove a custom palette from cache and disk
app.delete('/api/custom-palettes/:key', (req: Request, res: Response) => {
  const { key } = req.params;
  if (!paletteCache[key]) {
    res.status(404).json({ error: 'Palette not found' });
    return;
  }

  // Extract number from key (custom_N -> N)
  const match = key.match(/^custom_(\d+)$/);
  delete paletteCache[key];

  // Fire-and-forget disk delete
  if (match) {
    const filePath = path.join(PALETTES_DIR, `palette_${match[1]}.json`);
    fs.promises.unlink(filePath).catch((err) => {
      console.error(`[delete-palette] Failed to delete ${filePath}:`, err);
    });
  }

  res.json({ ok: true });
});

// POST /api/generate-palette — run executeCommand in single-shot mode to generate a palette.
// Query param ?provider=... selects the harness (defaults to 'claude').
// Query param ?provider=codex to use a different agent (defaults to 'claude').
app.post('/api/generate-palette', (req: Request, res: Response) => {
  const { description } = req.body as { description?: string };
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    res.status(400).json({ error: 'description is required' });
    return;
  }

  // Allow choosing which agent generates the palette (default: claude)
  const providerName = (req.query.provider as string) || 'claude';
  getProvider(providerName as ProviderName);

  // Example palettes spanning both polarities so the AI has references for dark AND light
  const examplePalettes = `
Here are 6 example palettes from our library for reference. Keys are semantic roles, not literal colors.
The system supports BOTH dark and light palettes — the UI auto-adapts based on bgCanvas luminance.

DARK EXAMPLES (bgCanvas is darkest, text is light):

Solarized Dark:
{"name":"Solarized Dark","bgCanvas":"#002b36","bgSurface":"#073642","textMuted":"#586e75","textSubtle":"#657b83","textBody":"#839496","textBright":"#93a1a1","primary":"#6c71c4","user":"#268bd2","ai":"#2aa198","success":"#859900","warning":"#b58900","queue":"#cb4b16","danger":"#dc322f","meta":"#d33682"}

Tokyo Night:
{"name":"Tokyo Night","bgCanvas":"#1a1b26","bgSurface":"#24283b","textMuted":"#414868","textSubtle":"#565f89","textBody":"#a9b1d6","textBright":"#c0caf5","primary":"#7aa2f7","user":"#7dcfff","ai":"#7dcfff","success":"#9ece6a","warning":"#e0af68","queue":"#ff9e64","danger":"#f7768e","meta":"#bb9af7"}

Catppuccin Mocha:
{"name":"Catppuccin Mocha","bgCanvas":"#1e1e2e","bgSurface":"#313244","textMuted":"#45475a","textSubtle":"#6c7086","textBody":"#cdd6f4","textBright":"#bac2de","primary":"#89b4fa","user":"#89dceb","ai":"#94e2d5","success":"#a6e3a1","warning":"#f9e2af","queue":"#fab387","danger":"#f38ba8","meta":"#cba6f7"}

LIGHT EXAMPLES (bgCanvas is lightest, text is dark):

Solarized Light:
{"name":"Solarized Light","bgCanvas":"#fdf6e3","bgSurface":"#eee8d5","textMuted":"#93a1a1","textSubtle":"#839496","textBody":"#586e75","textBright":"#073642","primary":"#6c71c4","user":"#268bd2","ai":"#2aa198","success":"#859900","warning":"#b58900","queue":"#cb4b16","danger":"#dc322f","meta":"#d33682"}

Catppuccin Latte:
{"name":"Catppuccin Latte","bgCanvas":"#eff1f5","bgSurface":"#e6e9ef","textMuted":"#9ca0b0","textSubtle":"#7c7f93","textBody":"#4c4f69","textBright":"#303446","primary":"#7287fd","user":"#209fb5","ai":"#179299","success":"#40a02b","warning":"#df8e1d","queue":"#fe640b","danger":"#d20f39","meta":"#8839ef"}

GitHub Light:
{"name":"GitHub Light","bgCanvas":"#ffffff","bgSurface":"#f6f8fa","textMuted":"#8b949e","textSubtle":"#656d76","textBody":"#1f2328","textBright":"#0d1117","primary":"#0969da","user":"#0550ae","ai":"#1a7f37","success":"#1a7f37","warning":"#9a6700","queue":"#bc4c00","danger":"#cf222e","meta":"#8250df"}`;

  // Detect polarity and expressiveness from the description.
  // The palette system is polarity-agnostic — this only steers the prompt
  // so the LLM generates appropriate luminance ordering and contrast.
  const lightKeywords =
    /\blight\b|\bbright\b|\bpastel\b|\bwhite\b|\bcream\b|\blatte\b|\bday\b|\bsnow\b|\bpaper\b|\bchalk\b|\bmorning\b/i;
  const wildKeywords =
    /\brainbow\b|\bneon\b|\bchaos\b|\bwild\b|\bcrazy\b|\bfun\b|\bvaporwave\b|\bpsychedelic\b|\bglitch\b|\bacid\b|\bfunky\b|\bparty\b|\bmatrix\b|\bcyberpunk\b|\bretro\b|\b80s\b|\b90s\b|\bunreadable\b/i;
  const isLightRequest = lightKeywords.test(description);
  const isWildRequest = wildKeywords.test(description);

  const prompt = `Design a 14-token semantic color palette for a code editor UI based on this description: "${description.trim()}"
${examplePalettes}

## Color theory guidelines for healthy palettes

These are the default principles for producing readable, balanced palettes.
Apply them unless the user's description explicitly asks for something expressive or extreme.

STRUCTURAL TONES (bgCanvas, bgSurface, textMuted, textSubtle, textBody, textBright):
- These 6 values form a luminance ramp from background to foreground.
- bgCanvas and bgSurface should be close in luminance (delta ~5-10%) for subtle elevation.
- textMuted through textBright should span a wider range for clear hierarchy.
- The ramp should feel even — no large jumps between adjacent steps.

INTENT COLORS (primary, user, ai, success, warning, queue, danger, meta):
- Distribute accents around the hue wheel for maximum distinctness.
  Good starting points: split-complementary, triadic, or tetradic harmony.
- Keep all 8 accents at roughly equal perceived lightness (OKLCH L* ~0.65-0.75 for dark mode, ~0.45-0.55 for light mode).
  This prevents some accents from visually dominating others.
- Saturation should be moderate-high (OKLCH C ~0.12-0.18). Too low = muddy. Too high = fatiguing.
- For monochromatic/analogous themes (e.g. "forest", "ocean"), vary hue within a 60-90° arc
  and use saturation + lightness shifts to maintain distinctness.

LIGHT vs DARK:
- Dark palettes: cool-tinted canvas (blue, teal, purple undertones) reduces eye strain.
  Warm accents pop more against cool backgrounds.
- Light palettes: warm-tinted canvas (cream, ivory, warm gray) feels softer than pure white.
  Use medium-saturated accents (not washed-out pastels) — they need contrast against the light bg.
- In both modes, bgCanvas ↔ textBright should have >= 7:1 contrast ratio (WCAG AAA for body text).
  Intent accents against bgCanvas should be >= 4.5:1 (WCAG AA).

${
  isWildRequest
    ? `## CREATIVE MODE — rules are suggestions, not constraints

The user is asking for something expressive, fun, or extreme. Lean into it hard:
- Colored/tinted backgrounds are encouraged (neon green canvas, deep purple, hot pink — whatever fits).
- Accents can clash, oversaturate, or cluster in hue if that serves the vibe.
- Luminance ramps can be compressed (low contrast) or blown out (extreme contrast).
- Readability is secondary to aesthetics — the user knows what they're asking for.
- bgCanvas can be ANY color. bgSurface should still be visually distinguishable from it.
- Have fun. Be bold. If "rainbow" is requested, actually use the full spectrum, not pastel approximations.
- The only hard rule: all 14 values must be valid #RRGGBB hex and all 8 accents should be visually
  distinguishable from each other (even if they're all neon).`
    : ''
}
You MUST respond with ONLY a JSON object (no markdown, no explanation) with exactly these 15 keys:
{
  "name": "Palette Name",
  "bgCanvas": "#hex",
  "bgSurface": "#hex",
  "textMuted": "#hex",
  "textSubtle": "#hex",
  "textBody": "#hex",
  "textBright": "#hex",
  "primary": "#hex",
  "user": "#hex",
  "ai": "#hex",
  "success": "#hex",
  "warning": "#hex",
  "queue": "#hex",
  "danger": "#hex",
  "meta": "#hex"
}

Requirements:
- All values must be valid #RRGGBB hex strings.
- bgCanvas is the outermost background. bgSurface is the surface/card background (one step toward text).
- textMuted = muted/comment text. textSubtle = secondary text. textBody = primary body text. textBright = emphasis text.
${
  isLightRequest
    ? `- LIGHT MODE: bgCanvas should be the lightest value. bgSurface slightly darker.
- Monotonic luminance: bgCanvas (lightest) > bgSurface > textMuted > textSubtle > textBody >= textBright (darkest).
- Intent colors should have good contrast (WCAG AA, >= 4.5:1) against the LIGHT bgCanvas background.
  For pastels/light palettes, use medium-saturated accent colors (not washed-out pastels) so text remains readable.
- bgCanvas should be very light (white, cream, or pale tint).`
    : `- DARK MODE: bgCanvas should be the darkest value. bgSurface slightly lighter.
- Monotonic luminance: bgCanvas (darkest) < bgSurface < textMuted < textSubtle < textBody <= textBright (lightest).
- Intent colors should have good contrast (WCAG AA, >= 4.5:1) against the DARK bgCanvas background.
- bgCanvas should be very dark (suitable for long coding sessions).`
}
- The 8 intent colors (primary, user, ai, success, warning, queue, danger, meta) should be visually distinct.`;

  // Use cached counter instead of scanning filesystem
  const n = nextPaletteNumber;
  nextPaletteNumber++;

  void (async () => {
    let stdout = '';
    let stderr = '';
    let responded = false;

    // Guard: only send one HTTP response per request
    const sendError = (status: number, error: string) => {
      if (responded) return;
      responded = true;
      console.error(`[generate-palette] Error: ${error}`);
      res.status(status).json({ error });
    };

    const turn = executeCommand({
      harness: providerName as 'claude' | 'codex' | 'gemini' | 'opencode',
      mode: 'single-shot',
      prompt,
      cwd: process.cwd(),
      yolo: true,
      debugRawEvents: AGENT_CLI_DEBUG_EVENTS,
    });

    // Timeout: kill the process if it takes longer than 90 seconds
    const timeout = setTimeout(() => {
      console.error(
        `[generate-palette] Timed out after ${PALETTE_GENERATION_TIMEOUT_MS / 1000}s — killing process`
      );
      turn.stop('SIGTERM');
      sendError(504, `Palette generation timed out after ${PALETTE_GENERATION_TIMEOUT_MS / 1000}s`);
    }, PALETTE_GENERATION_TIMEOUT_MS);

    try {
      for await (const event of turn.events) {
        switch (event.type) {
          case 'text.delta':
            stdout += event.text;
            break;
          case 'stderr':
            stderr += event.text;
            break;
          case 'out_of_tokens':
          case 'error':
            stderr += `${event.message}\n`;
            break;
          default:
            break;
        }
      }

      const completion = await turn.completed;
      clearTimeout(timeout);

      if (completion.exitCode !== 0 || completion.reason !== 'success') {
        sendError(
          500,
          `${providerName} process failed (exit code ${completion.exitCode})${stderr ? `: ${stderr.slice(0, 500)}` : ''}`
        );
        return;
      }

      let parsed: Record<string, string>;
      try {
        const trimmed = stdout.trim();
        // Strip markdown fences if the agent added them despite instructions
        const jsonStr = trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
        parsed = JSON.parse(jsonStr) as Record<string, string>;
        if (!parsed.name) {
          throw new Error('Missing "name" field');
        }
        // Validate all 14 palette keys are present and are valid hex
        for (const key of PALETTE16_KEYS) {
          if (!parsed[key] || !/^#[0-9a-fA-F]{6}$/.test(parsed[key])) {
            throw new Error(`Missing or invalid hex for key "${key}": ${parsed[key]}`);
          }
        }
      } catch (parseErr) {
        console.error('[generate-palette] Raw stdout (first 500 chars):', stdout.substring(0, 500));
        const msg = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';
        sendError(500, `Failed to parse palette from ${providerName} response: ${msg}`);
        return;
      }

      // Build StoredPalette (Palette16 + description for provenance)
      const stored: StoredPalette = {
        name: parsed.name,
        description: description.trim(),
        bgCanvas: parsed.bgCanvas,
        bgSurface: parsed.bgSurface,
        textMuted: parsed.textMuted,
        textSubtle: parsed.textSubtle,
        textBody: parsed.textBody,
        textBright: parsed.textBright,
        primary: parsed.primary,
        user: parsed.user,
        ai: parsed.ai,
        success: parsed.success,
        warning: parsed.warning,
        queue: parsed.queue,
        danger: parsed.danger,
        meta: parsed.meta,
      };

      // Build Palette16 shape for client and cache
      const key = `custom_${n}`;
      const palette: Record<string, string> = { name: parsed.name };
      for (const k of PALETTE16_KEYS) {
        palette[k] = parsed[k];
      }

      // Update cache immediately
      paletteCache[key] = palette;

      // Fire-and-forget disk write. On failure, roll back cache entry so a
      // restart doesn't silently lose the palette (the client still has it for
      // this session, but won't survive a server restart without the file).
      void (async () => {
        try {
          await fs.promises.mkdir(PALETTES_DIR, { recursive: true });
          const filePath = path.join(PALETTES_DIR, `palette_${n}.json`);
          await fs.promises.writeFile(filePath, JSON.stringify(stored, null, 2));
          console.log(`[generate-palette] Saved palette to ${filePath}`);
        } catch (writeErr) {
          console.error('[generate-palette] Failed to save palette file:', writeErr);
          delete paletteCache[key];
        }
      })();

      // Return Palette16 shape to client
      if (responded) return; // timeout already fired
      responded = true;
      console.log(`[generate-palette] Success: "${parsed.name}" -> ${key}`);
      res.json({ key, palette });
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : String(err);
      sendError(500, `Palette generation failed: ${message}`);
    }
  })();
});

registerUsageRoutes(app, Object.keys(providers) as ProviderName[]);
// Serve static files from client build
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// =============================================================================
// Server Lifecycle
// =============================================================================

// Signal Handlers — split behavior for intentional shutdown vs hot-reload.
//
// SIGINT (Ctrl-C): Intentional shutdown. Kill all child processes immediately.
// SIGTERM (tsx watch, kill, pm2, Docker stop): Defer restart while active turns
//   are running so long tasks don't get cut off mid-flight.
//
// If the drain timeout is reached, active turns are interrupted with a system
// message and shutdown proceeds after a short grace period.

function getActiveConversationRuns(): Conversation[] {
  const active: Conversation[] = [];
  for (const conversation of conversations.values()) {
    if (conversation.hasActiveProcess()) {
      active.push(conversation);
    }
  }
  return active;
}

function interruptActiveConversationsForShutdown(reason: string): void {
  for (const conversation of getActiveConversationRuns()) {
    const content = `Server is restarting (${reason}); interrupted current turn.`;
    conversation.messages.push({ role: 'system', content, timestamp: new Date() });
    broadcastToAll({
      type: 'message',
      conversationId: conversation.id,
      role: 'system',
      content,
    });
    conversation.stop();
  }
}

let sigtermDrainInterval: NodeJS.Timeout | null = null;
let sigtermForceTimeout: NodeJS.Timeout | null = null;
let sigtermDraining = false;

function clearSigtermDrainTimers(): void {
  if (sigtermDrainInterval) {
    clearInterval(sigtermDrainInterval);
    sigtermDrainInterval = null;
  }
  if (sigtermForceTimeout) {
    clearTimeout(sigtermForceTimeout);
    sigtermForceTimeout = null;
  }
}

process.on('SIGINT', () => {
  console.log('SIGINT — killing child processes and shutting down...');
  buddyScheduler?.stop();
  for (const conv of conversations.values()) {
    if (conv.process) {
      conv.process.kill('SIGKILL');
    }
  }
  persistedServerState.flushUIStateSync();
  process.exit();
});

process.on('SIGTERM', () => {
  buddyScheduler?.stop();
  persistedServerState.flushUIStateSync();
  const activeRuns = getActiveConversationRuns();
  if (activeRuns.length === 0) {
    console.log('SIGTERM — no active turns, exiting for restart');
    process.exit();
    return;
  }

  if (sigtermDraining) {
    console.warn(
      `SIGTERM received again with ${activeRuns.length} active turn(s); forcing shutdown now`
    );
    clearSigtermDrainTimers();
    interruptActiveConversationsForShutdown('forced restart');
    setTimeout(() => process.exit(), HOT_RELOAD_FORCE_EXIT_GRACE_MS);
    return;
  }

  sigtermDraining = true;
  console.warn(
    `SIGTERM deferred: waiting for ${activeRuns.length} active turn(s) to finish (timeout ${Math.round(HOT_RELOAD_DRAIN_MS / 1000)}s)`
  );

  sigtermDrainInterval = setInterval(() => {
    const remaining = getActiveConversationRuns().length;
    if (remaining === 0) {
      clearSigtermDrainTimers();
      console.log('SIGTERM — active turns drained, exiting for restart');
      process.exit();
    }
  }, 500);

  sigtermForceTimeout = setTimeout(() => {
    const remaining = getActiveConversationRuns().length;
    if (remaining > 0) {
      console.warn(
        `SIGTERM drain timeout reached with ${remaining} active turn(s); interrupting and exiting`
      );
      interruptActiveConversationsForShutdown('hot-reload timeout');
    }
    clearSigtermDrainTimers();
    setTimeout(() => process.exit(), HOT_RELOAD_FORCE_EXIT_GRACE_MS);
  }, HOT_RELOAD_DRAIN_MS);
});

const DEV_CLIENT_PORT = 7489;
const DEV_API_PORT = 7499;
const LOCAL_DOMAIN = 'unleashd.localhost';
const LOCAL_HTTP_PORT = 80;
const PORT =
  process.env.PORT || (process.env.NODE_ENV === 'development' ? DEV_API_PORT : DEV_CLIENT_PORT);
const LISTEN_HOST = resolveListenHost();
const SETUP_SCRIPT = path.join(__dirname, '../../tools/setup-domain.sh');

function canReachBareLocalDomain(callback: (useBareDomain: boolean) => void): void {
  const socket = net.connect({ host: '127.0.0.1', port: LOCAL_HTTP_PORT });
  const finish = (result: boolean) => {
    socket.removeAllListeners();
    socket.destroy();
    callback(result);
  };

  socket.setTimeout(250);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
}

function ensureBareLocalDomain(callback: (useBareDomain: boolean) => void): void {
  canReachBareLocalDomain((useBareDomain) => {
    if (useBareDomain) {
      console.log(`[unleashd] Local port-80 routing active for http://${LOCAL_DOMAIN}`);
      callback(true);
      return;
    }

    if (process.platform !== 'darwin' || !process.stdin.isTTY || !process.stdout.isTTY) {
      console.log(
        '[unleashd] Skipping automatic local domain setup: requires macOS + interactive TTY'
      );
      callback(false);
      return;
    }

    try {
      console.log('[unleashd] Attempting automatic local domain setup...');
      execSync(`sudo bash ${JSON.stringify(SETUP_SCRIPT)}`, { stdio: 'inherit' });
    } catch {
      console.log('[unleashd] Automatic local domain setup failed or was cancelled');
      callback(false);
      return;
    }

    console.log('[unleashd] Re-checking local domain after setup');
    canReachBareLocalDomain(callback);
  });
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function killProcessOnPort(port: number): boolean {
  try {
    // Get the PID
    const pidCmd = `lsof -i :${port} | grep LISTEN | awk '{print $2}'`;
    const pid = execSync(pidCmd, { stdio: 'pipe' }).toString().trim();

    if (!pid) {
      process.stdout.write('port already free\n');
      return true;
    }

    execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
    process.stdout.write(`killed PID ${pid}\n`);
    return true;
  } catch (err) {
    console.error(`✗ Failed to kill process on port ${port}:`, (err as Error).message);
    return false;
  }
}

/**
 * Hydrate a server-side Conversation instance from shared ConversationData.
 * Used by both initial load (progressive batches) and file polling (new sessions).
 */
async function hydrateConversation(convData: DiscoveredConversation): Promise<Conversation | null> {
  const sessionId = convData.sessionId;
  const existingRecord = await conversationConfigStore.findBySession(convData.provider, sessionId);
  let candidateConversationId =
    existingRecord?.conversationId ?? (isUuid(sessionId) ? sessionId : uuidv4());
  if (existingRecord?.status === 'active' && !isUuid(existingRecord.conversationId)) {
    candidateConversationId = uuidv4();
    await conversationConfigStore.rekeyConversation(
      existingRecord.conversationId,
      candidateConversationId
    );
  }
  let hydratedConfig: HydratedConversationConfig;
  try {
    hydratedConfig = await conversationConfigService.hydrate({
      conversationId: candidateConversationId,
      sessionBindings: [{ provider: convData.provider, sessionId }],
      currentSession: { provider: convData.provider, sessionId },
      workingDirectory: convData.workingDirectory,
      legacy: {
        provider: convData.provider,
        reportedModel: convData.modelName ?? convData.model,
        reasoningEffort: convData.reasoningEffort,
        source: 'external_session',
      },
    });
  } catch (error) {
    if (error instanceof ConversationTombstonedError) return null;
    throw error;
  }
  if (
    hydratedConfig.record.currentSession &&
    (hydratedConfig.record.currentSession.provider !== convData.provider ||
      hydratedConfig.record.currentSession.sessionId !== sessionId)
  ) {
    // This file is a historical alias after a session rotation. It remains
    // indexed for discovery, but only the explicit current session is resumed.
    return null;
  }
  if (hydratedConfig.migrated && hydratedConfig.diagnostics.length > 0) {
    console.warn(
      `[conversation-config] Migrated ${sessionId}: ${hydratedConfig.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join('; ')}`
    );
  }
  // The application-owned ID remains stable even when the provider creates or
  // rotates a native session ID. On restart, recover that ID through the
  // durable session index instead of turning the session ID into a new thread.
  const conversationId = hydratedConfig.record.conversationId;
  const conversation = new Conversation({
    id: conversationId,
    workingDirectory: hydratedConfig.record.workingDirectory ?? convData.workingDirectory,
    configState: hydratedConfig.state,
    existingSessionId: sessionId,
    isWorker: convData.isWorker,
    swarmId: convData.swarmId ?? null,
    workerId: convData.workerId ?? null,
    workerRole: convData.workerRole ?? null,
    parentConversationId: resolveParentConversationId(convData.parentConversationId ?? null),
    resumedFromConversationId: convData.resumedFromConversationId ?? null,
    modelName: convData.modelName ?? null,
    mergeParentMeta: convData.mergeParentMeta ?? null,
    mergeChildMeta: convData.mergeChildMeta ?? null,
    buddyContext: convData.buddyContext ?? hydratedConfig.record.creation?.buddyContext ?? null,
  });
  conversation.messages = convData.messages;
  conversation.createdAt = convData.createdAt;
  conversation.subAgents = convData.subAgents;
  return conversation;
}

/**
 * Load existing conversations from persisted Claude/Codex/OpenCode files.
 * Called on server startup to hydrate the in-memory Map.
 *
 * Progressive loading: files are sorted by mtime descending (most recent first)
 * and broadcast to connected clients in batches as they're parsed. This lets the
 * UI stream in conversations instead of blocking until all 1500+ files are loaded.
 */
async function loadExistingConversations(): Promise<void> {
  console.log('Loading conversations from persisted session files...');

  try {
    const { mtimes } = await loadAllConversations({
      limit: STARTUP_INITIAL_LOAD_LIMIT,
      concurrency: STARTUP_PARSE_CONCURRENCY,
      batchSize: STARTUP_LOAD_BATCH_SIZE,
      onProgress: async (batch, progress) => {
        // Hydrate each batch into server-side Conversation instances
        const broadcastBatch: ConversationData[] = [];
        for (const convData of batch) {
          const conversation = await hydrateConversation(convData);
          if (!conversation) continue;
          conversations.set(conversation.id, conversation);
          broadcastBatch.push(conversation.toJSON());
        }

        // Stream batch to all connected clients (most recent conversations arrive first)
        if (broadcastBatch.length > 0) {
          broadcastToAll({
            type: 'conversations_updated',
            conversations: broadcastBatch,
          });
        }

        if (
          progress.loaded % STARTUP_PROGRESS_FILE_STEP === 0 ||
          progress.loaded === progress.total
        ) {
          console.log(
            `[startup] Parsed ${progress.loaded}/${progress.total} files (${conversations.size} conversations)...`
          );
        }
      },
    });

    fileMtimes = mtimes;

    // Recover app-owned conversations that have no native transcript yet (or
    // whose transcript fell outside the progressive loader limit).
    for (const record of await conversationConfigService.listRecoverable()) {
      if (conversations.has(record.conversationId) || !record.workingDirectory) continue;
      const hydrated = await conversationConfigService.hydrate({
        conversationId: record.conversationId,
        sessionBindings: [],
        legacy: {
          provider: record.config.provider,
          reportedModel: record.lastResolvedConfig?.modelId,
          source: 'external_session',
        },
      });
      const recoveredBuddy = record.creation?.buddyContext
        ? await resolveBuddyConversation(record.creation.buddyContext).catch((error) => {
            console.warn(`[buddies] Could not rebuild ${record.conversationId} briefing:`, error);
            return null;
          })
        : null;
      const recovered = new Conversation({
        id: record.conversationId,
        workingDirectory: record.workingDirectory,
        configState: hydrated.state,
        existingSessionId: record.currentSession?.sessionId,
        swarmDebugPrefix: record.creation?.swarmDebugPrefix ?? null,
        resumedFromConversationId: record.creation?.resumedFromConversationId ?? null,
        buddyContext: recoveredBuddy?.context ?? record.creation?.buddyContext ?? null,
        buddyBriefing: recoveredBuddy?.briefing ?? null,
      });
      conversations.set(recovered.id, recovered);
      await dispatchCreationMessageIfPending(recovered);
    }

    // Second pass: re-resolve parentConversationId now that all conversations are loaded.
    // During progressive loading, child conversations (sub-agent threads) may have been
    // hydrated before their parent, leaving parentConversationId as an unresolved raw
    // session ID. Re-resolve and broadcast corrections so clients update sub-agent hierarchy.
    const reresolvedBatch: ConversationData[] = [];
    for (const conv of conversations.values()) {
      if (conv.parentConversationId) {
        const resolved = resolveParentConversationId(conv.parentConversationId);
        if (resolved !== conv.parentConversationId) {
          conv.parentConversationId = resolved;
          reresolvedBatch.push(conv.toJSON());
        }
      }
    }
    if (reresolvedBatch.length > 0) {
      broadcastToAll({ type: 'conversations_updated', conversations: reresolvedBatch });
    }

    console.log(`Loaded ${conversations.size} conversations from persisted session files`);
  } catch (error) {
    console.error('Failed to load conversations from persisted sessions:', error);
    // Continue anyway - server can still work without historical data
  }
}

function findConversationBySessionId(sessionId: string): Conversation | undefined {
  const direct = conversations.get(sessionId);
  if (direct) {
    registerSessionAlias(sessionId, direct.id);
    return direct;
  }

  const mappedConversationId = sessionAliasToConversationId.get(sessionId);
  if (mappedConversationId) {
    const mappedConversation = conversations.get(mappedConversationId);
    if (mappedConversation) {
      registerSessionAlias(sessionId, mappedConversation.id);
      return mappedConversation;
    }
    unregisterSessionAlias(sessionId);
  }

  for (const conversation of conversations.values()) {
    if (conversation.sessionId === sessionId) {
      registerSessionAlias(sessionId, conversation.id);
      return conversation;
    }
  }

  return undefined;
}

function findConversationByCurrentSessionId(sessionId: string): Conversation | undefined {
  for (const conversation of conversations.values()) {
    if (conversation.sessionId === sessionId) return conversation;
  }
  return undefined;
}

function collectActiveConversationAndSessionIds(): Set<string> {
  const activeIds = new Set<string>();
  for (const [id, conversation] of conversations) {
    if (!conversation.hasActiveProcess()) continue;
    activeIds.add(id);
    activeIds.add(conversation.sessionId);
  }
  return activeIds;
}

function getLastUserMessageContent(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const content = messages[i].content.trim();
      return content.length > 0 ? content : null;
    }
  }
  return null;
}

function isOpenCodeSessionLike(sessionId: string): boolean {
  return sessionId.startsWith('ses_');
}

/**
 * Reconcile sessions when the CLI created a real id in local
 * storage but did not emit JSON events (so we could not capture sessionID on stdout)
 * or the file poller ran before the event was processed.
 *
 * Without this, file polling imports the new file as a duplicate conversation.
 */
function findBootstrapMatch(
  sessionId: string,
  convData: DiscoveredConversation
): Conversation | undefined {
  const importedLastUser = getLastUserMessageContent(convData.messages);
  if (!importedLastUser) return undefined;

  const importedCreatedMs = new Date(convData.createdAt).getTime();

  for (const conv of conversations.values()) {
    if (conv.provider !== convData.provider) continue;
    if (conv.id === sessionId) continue;

    // If the conversation already has a provider session ID assigned, skip it.
    // We know it's unassigned if sessionId === id (the UI-generated UUID).
    // Exception: Gemini's CLI emits a session.started event with a random UUID
    // that differs from the actual UUID written to the JSON file. We must allow
    // findBootstrapMatch to re-bind Gemini sessions to their true on-disk ID.
    if (conv.sessionId !== conv.id && conv.provider !== 'gemini') continue;

    if (conv.provider === 'opencode' && isOpenCodeSessionLike(conv.sessionId)) continue;
    if (conv.workingDirectory !== convData.workingDirectory) continue;

    const existingLastUser = getLastUserMessageContent(conv.messages);
    if (!existingLastUser || existingLastUser !== importedLastUser) continue;

    const existingCreatedMs = conv.createdAt.getTime();
    if (
      Number.isFinite(importedCreatedMs) &&
      Math.abs(existingCreatedMs - importedCreatedMs) > 5 * 60_000
    ) {
      continue;
    }

    return conv;
  }

  return undefined;
}

function resolveParentConversationId(parentSessionId: string | null | undefined): string | null {
  if (!parentSessionId) {
    return null;
  }
  const parentConversation = findConversationBySessionId(parentSessionId);
  return parentConversation?.id ?? parentSessionId;
}

/**
 * Prevent unbounded growth of deletedSessionIds and knownSessionIds.
 * deletedSessionIds: hard cap — worst case a very old deleted JSONL gets re-imported once.
 * knownSessionIds: evict entries that have no active conversation or alias mapping.
 */
function pruneSessionSets(): void {
  if (deletedSessionIds.size > 10000) {
    deletedSessionIds.clear();
  }
  for (const sid of knownSessionIds) {
    if (!conversations.has(sid) && !sessionAliasToConversationId.has(sid)) {
      knownSessionIds.delete(sid);
    }
  }
}

/**
 * Poll persisted session files every 5s for external changes (e.g., user ran
 * `claude`, `codex`, or `opencode` in terminal).
 * Only re-parses files with newer mtimes. Skips running conversations (launched by us).
 * Detects externally-running sessions: if a file's mtime changed between polls and
 * we didn't cause it, an external provider process is writing to it.
 * Broadcasts `conversations_updated` and `status` changes to all connected clients.
 */
function startFilePolling(): void {
  setInterval(async () => {
    try {
      // Snapshot active IDs for pollForChanges skip-list.
      const activeIdsAtPollStart = collectActiveConversationAndSessionIds();
      const { updated, mtimes } = await pollForChanges(fileMtimes, activeIdsAtPollStart);
      fileMtimes = mtimes;
      // Re-snapshot after poll returns to catch session ID changes during an active run,
      // then union with the pre-poll snapshot so both old/new IDs are treated as active.
      const activeIds = collectActiveConversationAndSessionIds();
      for (const activeId of activeIdsAtPollStart) {
        activeIds.add(activeId);
      }

      // --- External process detection ---
      // Sessions in `updated` had their files modified this cycle.
      // If we didn't launch them (not in activeIds), an external process wrote to them.
      const now = Date.now();
      pruneLocalCompletionSuppressions(now);

      for (const sessionId of updated.keys()) {
        if (activeIds.has(sessionId)) continue;
        // This session just completed locally; ignore file-tail writes.
        if (isLocalCompletionSuppressed(sessionId, now)) continue;

        const existingConversation = findConversationByCurrentSessionId(sessionId);

        // File changed and we didn't cause it — refresh the "last seen" timestamp
        if (!externallyRunning.has(sessionId)) {
          // Newly detected external activity
          if (VERBOSE)
            console.log(`[Poll] External activity detected: ${sessionId.substring(0, 8)}`);
          if (existingConversation) {
            broadcastToAll({
              type: 'status',
              conversationId: existingConversation.id,
              isRunning: true,
              isStreaming: false, // External activity — we don't know if streaming, but safe default
            });
          }
        }
        externallyRunning.set(sessionId, now);
      }

      // Check grace period: only mark idle after EXTERNAL_GRACE_MS with no file changes.
      // This prevents flicker during gaps in Claude's output (thinking, API calls, tool use).
      for (const [sessionId, lastSeen] of externallyRunning) {
        if (isLocalCompletionSuppressed(sessionId, now)) {
          externallyRunning.delete(sessionId);
          continue;
        }
        if (now - lastSeen >= EXTERNAL_GRACE_MS) {
          externallyRunning.delete(sessionId);
          const existingConversation = findConversationByCurrentSessionId(sessionId);
          if (VERBOSE)
            console.log(`[Poll] External activity stopped: ${sessionId.substring(0, 8)}`);
          if (existingConversation) {
            broadcastToAll({
              type: 'status',
              conversationId: existingConversation.id,
              isRunning: false,
              isStreaming: false,
            });
          }
        }
      }

      if (updated.size === 0) return;

      if (VERBOSE) console.log(`[Poll] ${updated.size} conversation(s) changed`);

      const changedForBroadcast: ConversationData[] = [];

      for (const [sessionId, convData] of updated) {
        // Never let disk updates clobber active in-memory streaming turns.
        if (activeIds.has(sessionId)) {
          continue;
        }

        let existing = findConversationByCurrentSessionId(sessionId);

        if (!existing) {
          const reconciled = findBootstrapMatch(sessionId, convData);
          if (reconciled) {
            const oldSessionId = reconciled.sessionId;
            reconciled.sessionId = sessionId;
            if (oldSessionId !== sessionId) {
              unregisterSessionAlias(oldSessionId, { keepKnown: true });
            }
            registerSessionAlias(sessionId, reconciled.id);
            await persistCurrentConversationSession(reconciled, sessionId);
            existing = reconciled;
            console.log(
              `[Poll] Reconciled session ${sessionId.substring(0, 8)} with conversation ${reconciled.id.substring(0, 8)} (old session ${oldSessionId.substring(0, 8)})`
            );
          }
        }

        if (existing && !existing.hasActiveProcess()) {
          registerSessionAlias(sessionId, existing.id);
          // Update existing conversation in-place (preserve process handles).
          // Preserve server-injected system messages (error reports, exit info) that
          // exist only in memory — disk files don't contain these. Without this,
          // the poller would nuke error messages like "usage limit" within one poll cycle.
          const trailingSystemMessages = existing.messages.filter(
            (m, i) => m.role === 'system' && i >= convData.messages.length
          );
          existing.messages =
            trailingSystemMessages.length > 0
              ? [...convData.messages, ...trailingSystemMessages]
              : convData.messages;
          existing.subAgents = convData.subAgents;
          existing.createdAt = convData.createdAt;
          existing.isWorker = convData.isWorker;
          existing.swarmId = convData.swarmId ?? null;
          existing.workerId = convData.workerId ?? null;
          existing.workerRole = convData.workerRole ?? null;
          existing.parentConversationId = resolveParentConversationId(
            convData.parentConversationId ?? null
          );
          existing.resumedFromConversationId = convData.resumedFromConversationId ?? null;
          existing.buddyContext = convData.buddyContext ?? existing.buddyContext;
          // Native session files report runtime facts; they do not own user
          // selection intent. Keep the durable config intact and record only
          // the provider-observed model.
          existing.modelName = convData.modelName ?? convData.model ?? null;
          existing.refreshConfigResolution();
          const json = existing.toJSON();
          // Mark as running if externally active
          if (externallyRunning.has(sessionId)) {
            json.isRunning = true;
          }
          changedForBroadcast.push(json);
        } else if (
          !existing &&
          !knownSessionIds.has(sessionId) &&
          !deletedSessionIds.has(sessionId)
        ) {
          // New conversation (not an orphaned JSONL from resetProcess or a deleted one) — create fresh instance
          const conversation = await hydrateConversation(convData);
          if (!conversation) continue;
          conversations.set(conversation.id, conversation);
          const json = conversation.toJSON();
          if (externallyRunning.has(sessionId)) {
            json.isRunning = true;
          }
          changedForBroadcast.push(json);
        }
      }

      if (changedForBroadcast.length > 0) {
        broadcastToAll({
          type: 'conversations_updated',
          conversations: changedForBroadcast,
        });
      }

      // Evict stale entries from session tracking sets to prevent unbounded growth
      pruneSessionSets();
    } catch (error) {
      console.error('[Poll] Error during file polling:', error);
    }
  }, FILE_POLL_INTERVAL_MS);
}

async function startServer(): Promise<void> {
  startupAuditResults = auditLocalAgents();

  // Initialize caches before opening the port
  await persistedServerState.initialize();
  await initPaletteCache();
  try {
    buddyScheduler = new BuddyScheduler({
      store: await getBuddiesStore(),
      createConversation: createAutomationConversation,
    });
    buddyScheduler.start();
    console.log('Buddy scheduler started');
  } catch (error) {
    console.warn('[buddies] Scheduler unavailable:', error);
  }

  const portNumber = typeof PORT === 'string' ? Number.parseInt(PORT, 10) : PORT;
  let isPortAvailable = await checkPort(portNumber);

  if (!isPortAvailable) {
    console.log(`\nPort ${PORT} is already in use.`);
    const answer = await askQuestion(`Kill the process using port ${PORT}? [y/N] `);

    if (answer === 'y' || answer === 'yes') {
      process.stdout.write('Killing... ');
      const killed = killProcessOnPort(portNumber);
      if (killed) {
        // Wait a moment for port to be released
        await new Promise((resolve) => setTimeout(resolve, 500));
        isPortAvailable = await checkPort(portNumber);

        if (!isPortAvailable) {
          console.error(`\n✗ Port ${PORT} still in use. Try manually or use a different port.`);
          process.exit(1);
        }
        console.log('✓ Done\n');
      } else {
        process.exit(1);
      }
    } else {
      console.log('\nAlternatives:');
      console.log(
        `  1. Kill manually: lsof -i :${PORT} | grep LISTEN | awk '{print $2}' | xargs kill -9`
      );
      console.log('  2. Use different port: PORT=3001 pnpm dev:server\n');
      process.exit(1);
    }
  }

  // Start listening FIRST so the Vite proxy can connect immediately.
  server.listen(portNumber, LISTEN_HOST, () => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const domainUrl = `http://${LOCAL_DOMAIN}`;
    const fallbackUrl = isDevelopment
      ? `http://localhost:${DEV_CLIENT_PORT}`
      : `http://localhost:${portNumber}`;

    // Use the bare localhost alias when port-80 routing is active, or set it up on demand.
    ensureBareLocalDomain((useDomain) => {
      const startUrl = useDomain ? domainUrl : fallbackUrl;
      if (isDevelopment) {
        console.log(`Server running on http://localhost:${portNumber} (frontend on ${startUrl})`);
        return;
      }
      console.log(`Server running on ${startUrl} (backend on ${LISTEN_HOST}:${portNumber})`);
      const startCmd =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      require('node:child_process').exec(`${startCmd} ${startUrl}`);
    });
  });

  // Unblock WebSocket handlers immediately — clients get an init with whatever
  // conversations have been loaded so far (initially empty). As loadExistingConversations
  // parses files in mtime-descending order, it broadcasts batches via conversations_updated
  // so the UI streams in progressively (most recent first).
  resolveInitialLoad();
  console.log('WebSocket handlers unblocked, loading conversations progressively...');

  // Load existing conversations — broadcasts batches to connected clients as they parse.
  await loadExistingConversations();
  console.log('Initial load complete');

  // Start file polling AFTER initial load so mtimes are populated.
  // If poller starts before loadExistingConversations completes, the first poll
  // would see empty mtimes and re-broadcast all conversations.
  startFilePolling();
  console.log('File polling started (5s interval)');
}

startServer();
