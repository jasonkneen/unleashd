import type { ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { executeCommand } from '@nbardy/agent-cli';
import type {
  BuddyContext,
  ConfigResolution,
  ConversationConfig,
  ConversationConfigState,
  Conversation as ConversationData,
  Message,
  ModelId,
  OompaRuntimeSnapshot,
  Provider as ProviderName,
  QueuedMessage,
  ResolvedExecutionConfig,
  ServerMessage,
  SubAgent,
} from '@unleashd/shared';
import { mergeReviewDocPath } from '@unleashd/shared';
import { formatToolUse, isCompletionOnlyToolUse } from '../adapters/tool-format';
import { buddyCodexMcpArgs } from '../buddies/mcp-config';
import {
  SWARM_POLL_INTERVAL_MS,
  SWARM_POLL_THROTTLE_MS,
  TURN_IDLE_TIMEOUT_MS,
  TURN_MAX_RUNTIME_MS,
  TURN_TIMEOUT_KILL_GRACE_MS,
} from '../constants/timeouts';
import type { ProviderEvent } from '../providers';
import { resolveConfigAgainstProviderCatalog } from '../providers/catalog-service';
import {
  extractCodexCollabToolInput,
  getCodexSubagentCurrentAction,
  getSubagentDescription,
  isCodexCollabToolName,
  isSubagentSpawnTool,
  isTerminalSubagentStatus,
  normalizeCodexSubagentStatus,
} from '../subagent-tools';

export type MergeParentMeta = {
  children: Array<{
    sourceConversationId: string;
    childConversationId: string;
    reviewUuid: string;
    childWorkingDirectory: string;
  }>;
  prefixInjected: boolean;
};

export type MergeChildMeta = {
  parentConversationId: string;
  reviewUuid: string;
};

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
export type ConversationBroadcast = ServerMessage | ChunkData | MessageCompleteData | MessageData;

export interface ConversationRuntimeView {
  id: string;
  sessionId: string;
  config: ConversationConfig;
  readonly provider: ProviderName;
  buddyContext: BuddyContext | null;
  isRunning: boolean;
  toJSON(): ConversationData;
}

export interface ConversationRuntimeDependencies {
  broadcast(data: ConversationBroadcast): void;
  registerSessionAlias(sessionId: string | null | undefined, conversationId: string): void;
  unregisterSessionAlias(
    sessionId: string | null | undefined,
    options?: { keepKnown?: boolean }
  ): void;
  clearExternalRunningStatus(...ids: Array<string | null | undefined>): void;
  clearLocalCompletionSuppression(...ids: Array<string | null | undefined>): void;
  markLocalCompletionSuppression(...ids: Array<string | null | undefined>): void;
  persistCurrentSession(conversation: ConversationRuntimeView, sessionId: string): Promise<void>;
  updateBuddyStatus(
    conversation: ConversationRuntimeView,
    status: 'active' | 'complete' | 'failed' | 'cancelled'
  ): void;
  settleBuddyDelegation(
    conversation: ConversationRuntimeView,
    status: 'complete' | 'failed' | 'cancelled',
    outcome?: string
  ): void;
  getConversation(id: string): { isRunning: boolean } | undefined;
  readLatestOompaRuntime(projectRoot: string): OompaRuntimeSnapshot;
  createSessionId(): string;
}

const VERBOSE = process.env.VERBOSE === '1' || process.argv.includes('--verbose');
const AGENT_CLI_DEBUG_EVENTS = process.env.AGENT_CLI_DEBUG_EVENTS === '1';
const LOG_CONTENT_PREVIEW_CHARS = 140;

function formatLogPreview(content: string, maxChars = LOG_CONTENT_PREVIEW_CHARS): string {
  return content.replace(/\s+/g, ' ').slice(0, maxChars);
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
export interface ConversationOptions {
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

export interface ConversationRuntime extends EventEmitter, ConversationRuntimeView {
  messages: Message[];
  process: ChildProcess | null;
  isStreaming: boolean;
  createdAt: Date;
  workingDirectory: string;
  configRevision: number;
  configResolution: ConfigResolution;
  isWorker: boolean;
  swarmId: string | null;
  workerId: string | null;
  workerRole: 'work' | 'review' | 'fix' | null;
  parentConversationId: string | null;
  resumedFromConversationId: string | null;
  modelName: string | null;
  swarmDebugPrefix: string | null;
  mergeParentMeta: MergeParentMeta | null;
  mergeChildMeta: MergeChildMeta | null;
  subAgents: SubAgent[];
  queue: QueuedMessage[];
  readonly provider: ProviderName;
  readonly model: ModelId | undefined;
  readonly reasoningEffort: string | undefined;
  sendMessage(content: string): void;
  spawnMergeReviewFork(content: string, forkSourceSessionId: string): void;
  stop(): void;
  resetProcess(): void;
  enqueueMessage(content: string): void;
  interruptAndSend(content: string): void;
  cancelQueuedMessage(messageId: string): void;
  clearQueue(): void;
  processQueue(): void;
  hasActiveProcess(): boolean;
  hasStartedSession(): boolean;
  applyConfigState(state: ConversationConfigState): void;
  refreshConfigResolution(): ConfigResolution;
  canChangeProvider(): boolean;
  toJSON(): ConversationData;
}

export type ConversationConstructor = new (options: ConversationOptions) => ConversationRuntime;

export function buildFirstTurnCliContent(input: {
  content: string;
  messageCount: number;
  hasStartedSession: boolean;
  buddyContext: BuddyContext | null;
  buddyBriefing: string | null;
  swarmDebugPrefix: string | null;
}): string {
  const firstUnstartedTurn = input.messageCount === 0 && !input.hasStartedSession;
  // Buddy and Swarm are mutually exclusive conversation modes. If malformed
  // legacy state supplies both, the typed Buddy context wins and no Swarm
  // prefix reaches the provider.
  if (input.buddyContext !== null) {
    if (!firstUnstartedTurn || input.buddyBriefing === null) return input.content;
    const serializedContext = JSON.stringify(input.buddyContext);
    return `<!-- unleashd:buddy-context ${serializedContext} -->\n${input.buddyBriefing}\n<!-- /unleashd:buddy-context -->\n\n${input.content}`;
  }
  if (input.swarmDebugPrefix !== null && firstUnstartedTurn) {
    return `<!-- unleashd:swarm-prefix -->\n${input.swarmDebugPrefix}\n<!-- /unleashd:swarm-prefix -->\n\n${input.content}`;
  }
  return input.content;
}

export function createConversationRuntime(
  dependencies: ConversationRuntimeDependencies
): ConversationConstructor {
  const {
    broadcast,
    registerSessionAlias,
    unregisterSessionAlias,
    clearExternalRunningStatus,
    clearLocalCompletionSuppression,
    markLocalCompletionSuppression,
    persistCurrentSession: persistCurrentConversationSession,
    updateBuddyStatus: updateBuddyConversationLink,
    settleBuddyDelegation,
    getConversation,
    readLatestOompaRuntime,
    createSessionId,
  } = dependencies;

  return class Conversation extends EventEmitter {
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
      const isBuddyConversation = buddyContext !== null;
      this.isWorker = isBuddyConversation ? false : isWorker;
      this.swarmId = isBuddyConversation ? null : swarmId;
      this.workerId = isBuddyConversation ? null : workerId;
      this.workerRole = isBuddyConversation ? null : workerRole;
      this.parentConversationId = parentConversationId;
      this.resumedFromConversationId = resumedFromConversationId;
      this.modelName = modelName;
      this.swarmDebugPrefix = isBuddyConversation ? null : swarmDebugPrefix;
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
                extraArgs:
                  this.buddyContext !== null
                    ? buddyCodexMcpArgs(this.buddyContext, this.id)
                    : undefined,
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
              broadcast({
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
            broadcast({
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
        console.log(
          `[${this.id}] Creating NEW assistant message (msg #${this.messages.length + 1})`
        );
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
      broadcast({
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
        broadcast({
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
          broadcast({
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
            const blockId = (event.input as { _blockId?: string })._blockId || createSessionId();

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
            broadcast({
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
                broadcast({
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
              broadcast({
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

          broadcast({
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
            broadcast({
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
          broadcast({
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

      // UI/history retain clean user text. Only the first unstarted provider
      // turn receives a hidden context prefix.
      let cliContent = buildFirstTurnCliContent({
        content,
        messageCount: this.messages.length,
        hasStartedSession: this._hasStartedSession,
        buddyContext: this.buddyContext,
        buddyBriefing: this._buddyBriefing,
        swarmDebugPrefix: this.swarmDebugPrefix,
      });

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
          const childConv = getConversation(child.childConversationId);
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
          broadcast({
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
      broadcast({
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
      this.sessionId = createSessionId();
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
      broadcast({
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

      broadcast({
        type: 'subagent_complete',
        conversationId: this.id,
        subAgentId: agentId,
        status: 'completed',
        completedAt,
      });
    }

    broadcastChunk(data: ChunkData | MessageCompleteData): void {
      broadcast(data);
    }

    broadcastMessage(data: MessageData): void {
      broadcast(data);
    }

    broadcastStatus(): void {
      broadcast({
        type: 'status',
        conversationId: this.id,
        isRunning: this.isRunning,
        isStreaming: this.isStreaming,
      });
    }

    broadcastQueue(): void {
      broadcast({
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
  };
}
