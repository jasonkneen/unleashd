/**
 * DiskAdapter — shared interface for reading persisted CLI agent sessions from disk.
 *
 * Design: One DiskAdapter per CLI provider (Claude, Codex, OpenCode, Gemini, …).
 * Adding a new provider = one new file implementing DiskAdapter. Zero changes to
 * the core load/poll loop in loader.ts.
 *
 * Flow:
 *   DiskAdapter.discoverFiles() → string[]    (paths to scan)
 *   DiskAdapter.parseFile(path) → ParsedSession | null  (null = skip)
 *   sessionToConversation(ParsedSession) → Conversation | null  (null = hidden)
 */

import type {
  BuddyContext,
  Conversation,
  DiscoveredConversation,
  Message,
  Provider,
  SubAgent,
} from '@unleashd/shared';
import {
  ModelIdSchema,
  buddyKindFromContext,
  conversationKindFromLegacy,
  fromCodexModelId,
  isModelIdValidForProvider,
  normalizeModelId,
} from '@unleashd/shared';
import {
  extractBuddyBuilderPurpose,
  extractBuddyContext,
  extractSwarmDebugPrefix,
  extractWorkerMetadata,
} from './jsonl';

// =============================================================================
// Normalized session output — all adapters produce this before conversion
// =============================================================================

/**
 * Normalized representation of a parsed CLI session — output of every DiskAdapter.parseFile().
 * All provider-specific types (JsonlSession, CodexSession, etc.) convert to this before
 * reaching the shared sessionToConversation() function.
 */
export interface ParsedSession {
  sessionId: string;
  filePath: string; // path used for mtime tracking
  workingDirectory: string;
  provider: Provider; // set by the adapter (claude may use inferProviderFromModel)
  model: string; // 'unknown' if unavailable
  createdAt: Date;
  modifiedAt: Date;
  messages: Message[];
  subAgents?: SubAgent[]; // Claude only — extracted from JSONL entries
  parentSessionId?: string | null; // Codex only — for nested thread display
  buddyContext?: BuddyContext | null;
  swarmDebugPrefix?: string | null;
  resumedFromConversationId?: string | null;
  purpose?: string | null;
}

// =============================================================================
// DiskAdapter interface
// =============================================================================

/**
 * One implementation per CLI agent. Adding a new provider = one new file implementing this.
 * discoverFiles() returns paths to session files/dirs (whatever parseFile() expects).
 * parseFile() returns null for empty/invalid sessions (caller skips them).
 */
export interface DiskAdapter {
  provider: Provider;
  discoverFiles(): Promise<string[]>;
  parseFile(filePath: string): Promise<ParsedSession | null>;
}

// =============================================================================
// Shared result types (used by loader.ts)
// =============================================================================

export interface LoadResult {
  conversations: Map<string, DiscoveredConversation>;
  mtimes: Map<string, number>; // filepath → mtime ms
}

export interface PollResult {
  updated: Map<string, DiscoveredConversation>; // changed or new conversations
  mtimes: Map<string, number>; // full updated mtime index
  // Changed sources skipped because their session is active. Callers must keep
  // the previous baseline for these paths so the final persisted state is
  // guaranteed to be reconciled after the process stops.
  deferredDirtyPaths: Set<string>;
}

export type LoadProgressCallback = (
  batch: DiscoveredConversation[],
  progress: { loaded: number; total: number }
) => void | Promise<void>;

// =============================================================================
// Shared session → Conversation conversion
// =============================================================================

/**
 * Convert a ParsedSession to a Conversation.
 * Returns null for [_HIDE_TEST_] conversations (dropped at ingestion).
 * Detects oompa workers by checking for "[oompa...]" tag in the first user message.
 *
 * This is the single canonical conversion function replacing the four near-identical
 * jsonlSessionToConversation / codexSessionToConversation / openCodeSessionToConversation /
 * geminiSessionToConversation functions that previously existed in jsonl.ts.
 */
export function sessionToConversation(session: ParsedSession): DiscoveredConversation | null {
  // Both extractors mutate messages (strip markers from first user message).
  // Buddy and swarm metadata have independent sentinels. Buddy extraction runs
  // first because its hidden block is outermost for a Buddy's first turn.
  // Typed Buddy ownership is authoritative and mutually exclusive with Oompa:
  // do not interpret the visible Buddy prompt as a worker tag.
  // Muse durable path: record.creation.buddyContext is authoritative when present
  // (new sessions store buddy metadata in durable record, not hidden prefix).
  // Legacy fallback: hidden prefix in first message (extractBuddyContext).
  const durableBuddy = session.buddyContext ?? null;
  const durableSwarmPrefix = session.swarmDebugPrefix ?? null;
  const durableResumed = session.resumedFromConversationId ?? null;
  const durablePurpose = session.purpose ?? null;

  const extractedBuddy = extractBuddyContext(session.messages);
  const buddyContext = durableBuddy ?? extractedBuddy;
  const isBuddyBuilder = buddyContext
    ? false
    : durablePurpose === 'buddy_builder'
      ? true
      : extractBuddyBuilderPurpose(session.messages);
  const extractedSwarmPrefix = extractSwarmDebugPrefix(session.messages);
  const swarmDebugPrefix =
    buddyContext || isBuddyBuilder ? null : (durableSwarmPrefix ?? extractedSwarmPrefix);
  // Resumed lineage durable wins; otherwise keep any prefix-extracted lineage
  // (none currently from extractors, but preserve future extraction).
  const resumedFromConversationId = durableResumed ?? null;
  const worker =
    buddyContext || isBuddyBuilder
      ? {
          isWorker: false,
          isHidden: false,
          swarmId: null,
          workerId: null,
          workerRole: null,
        }
      : extractWorkerMetadata(session.messages);
  if (worker.isHidden) return null;

  // Recover the canonical ModelId when session.model parses against the schema.
  // For codex, decompose any legacy composite (e.g. "gpt-5.4-xhigh") into its
  // base + reasoningEffort so they live as separate fields (matches claude shape).
  const { model: recoveredModel, reasoningEffort } = recoverModelAndEffort(session);

  // Holistic kind — migration on load from hidden markers or durable record.
  const durableKindPurpose = durablePurpose as 'buddy_builder' | null;
  const kind = conversationKindFromLegacy({
    buddyContext,
    purpose: isBuddyBuilder ? 'buddy_builder' : durableKindPurpose,
    kind: null,
  });

  return {
    sessionId: session.sessionId,
    messages: session.messages,
    isRunning: false,
    isStreaming: false, // Loaded from disk — process is dead
    confirmed: true,
    createdAt: session.createdAt,
    workingDirectory: session.workingDirectory,
    provider: session.provider,
    model: recoveredModel,
    reasoningEffort,
    subAgents: session.subAgents ?? [],
    queue: [],
    isWorker: worker.isWorker,
    swarmId: worker.swarmId ?? null,
    workerId: worker.workerId ?? null,
    workerRole: worker.workerRole ?? null,
    parentConversationId: session.parentSessionId ?? null,
    modelName: session.model !== 'unknown' ? session.model : null,
    swarmDebugPrefix: swarmDebugPrefix ?? null,
    resumedFromConversationId,
    kind,
    buddyContext,
    purpose: isBuddyBuilder ? 'buddy_builder' : (durablePurpose as 'buddy_builder' | 'general' | undefined) ?? undefined,
  };
}

/**
 * Recover canonical ModelId + reasoningEffort from a ParsedSession.model string.
 *
 * Codex: legacy composite strings ("gpt-5.4-xhigh") are split into base model +
 * reasoningEffort via fromCodexModelId. Native codex session files already store
 * base IDs, so this is a no-op for non-legacy data.
 *
 * Claude/opencode/gemini/cursor: session files don't persist --effort, so
 * reasoningEffort is always undefined here. Hydration preserves that absence;
 * it must not invent a new flag for an existing provider session.
 */
function recoverModelAndEffort(session: ParsedSession): {
  model: Conversation['model'];
  reasoningEffort: string | undefined;
} {
  if (session.model === 'unknown') {
    return { model: undefined, reasoningEffort: undefined };
  }

  if (session.provider === 'codex') {
    const { baseModel, effort } = fromCodexModelId(session.model);
    const canonical = normalizeModelId(session.provider, baseModel) ?? baseModel;
    const parsedBase = ModelIdSchema.safeParse(canonical);
    return {
      model:
        parsedBase.success && isModelIdValidForProvider(session.provider, parsedBase.data)
          ? parsedBase.data
          : undefined,
      reasoningEffort: effort ?? undefined,
    };
  }

  const canonical = normalizeModelId(session.provider, session.model) ?? session.model;
  const parsed = ModelIdSchema.safeParse(canonical);
  return {
    model:
      parsed.success && isModelIdValidForProvider(session.provider, parsed.data)
        ? parsed.data
        : undefined,
    reasoningEffort: undefined,
  };
}
