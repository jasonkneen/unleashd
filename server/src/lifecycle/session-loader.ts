import type {
  BuddyContext,
  Conversation as ConversationData,
  DiscoveredConversation,
  Message,
} from '@unleashd/shared';
import { validate as isUuid } from 'uuid';
import type { loadAllConversations, pollForChanges } from '../adapters/loader';
import type {
  CompletionSuppression,
  ConversationRegistry,
  ExternalActivity,
  SessionTracking,
} from '../application/context';
import {
  type ConversationConfigService,
  ConversationTombstonedError,
  type HydratedConversationConfig,
} from '../conversations/config-service';
import type { ConversationConfigStore } from '../conversations/config-store';
import type {
  ConversationBroadcast,
  ConversationOptions,
  ConversationRuntime,
} from '../conversations/runtime';
import { summarizeConversation } from '../conversations/serialization';
import { createFilePoller } from './file-poller';
import { loadProgressively } from './progressive-loader';

export interface SessionLoaderOptions {
  startupLimit: number;
  startupConcurrency: number;
  startupBatchSize: number;
  startupInitialBatchSize: number;
  startupLogEveryFiles: number;
  pollIntervalMs: number;
  externalGraceMs: number;
  verbose: boolean;
}

export interface SessionLoaderDependencies {
  options: SessionLoaderOptions;
  registry: ConversationRegistry<ConversationRuntime>;
  sessions: SessionTracking;
  externalActivity: ExternalActivity;
  completionSuppression: CompletionSuppression;
  configStore: ConversationConfigStore;
  configService: ConversationConfigService;
  loadConversations: typeof loadAllConversations;
  pollConversations: typeof pollForChanges;
  createConversation(options: ConversationOptions): ConversationRuntime;
  createId(): string;
  resolveBuddyConversation(
    context: BuddyContext
  ): Promise<{ context: BuddyContext; briefing: string }>;
  dispatchInitialMessage(conversation: ConversationRuntime): Promise<void>;
  persistCurrentSession(conversation: ConversationRuntime, sessionId: string): Promise<void>;
  broadcast(data: ConversationBroadcast): void;
  logger?: Pick<Console, 'error' | 'log' | 'warn'>;
}

export interface SessionLoader {
  loadExistingConversations(): Promise<void>;
  startFilePolling(): void;
}

export function createSessionLoader(dependencies: SessionLoaderDependencies): SessionLoader {
  const logger = dependencies.logger ?? console;
  let fileMtimes = new Map<string, number>();

  function findBySessionId(sessionId: string): ConversationRuntime | undefined {
    const direct = dependencies.registry.get(sessionId);
    if (direct) {
      dependencies.sessions.registerAlias(sessionId, direct.id);
      return direct;
    }
    const mappedId = dependencies.sessions.aliasFor(sessionId);
    if (mappedId) {
      const mapped = dependencies.registry.get(mappedId);
      if (mapped) {
        dependencies.sessions.registerAlias(sessionId, mapped.id);
        return mapped;
      }
      dependencies.sessions.unregisterAlias(sessionId);
    }
    for (const conversation of dependencies.registry.values()) {
      if (conversation.sessionId !== sessionId) continue;
      dependencies.sessions.registerAlias(sessionId, conversation.id);
      return conversation;
    }
    return undefined;
  }

  function findByCurrentSessionId(sessionId: string): ConversationRuntime | undefined {
    for (const conversation of dependencies.registry.values()) {
      if (conversation.sessionId === sessionId) return conversation;
    }
    return undefined;
  }

  function resolveParentConversationId(parentSessionId: string | null | undefined): string | null {
    if (!parentSessionId) return null;
    return findBySessionId(parentSessionId)?.id ?? parentSessionId;
  }

  async function hydrate(source: DiscoveredConversation): Promise<ConversationRuntime | null> {
    const sessionId = source.sessionId;
    const existingRecord = await dependencies.configStore.findBySession(source.provider, sessionId);
    let conversationId =
      existingRecord?.conversationId ?? (isUuid(sessionId) ? sessionId : dependencies.createId());
    if (existingRecord?.status === 'active' && !isUuid(existingRecord.conversationId)) {
      const replacementId = dependencies.createId();
      await dependencies.configStore.rekeyConversation(
        existingRecord.conversationId,
        replacementId
      );
      conversationId = replacementId;
    }

    let hydratedConfig: HydratedConversationConfig;
    try {
      hydratedConfig = await dependencies.configService.hydrate({
        conversationId,
        sessionBindings: [{ provider: source.provider, sessionId }],
        currentSession: { provider: source.provider, sessionId },
        workingDirectory: source.workingDirectory,
        legacy: {
          provider: source.provider,
          reportedModel: source.modelName ?? source.model,
          reasoningEffort: source.reasoningEffort,
          source: 'external_session',
        },
      });
    } catch (error) {
      if (error instanceof ConversationTombstonedError) return null;
      throw error;
    }

    const currentSession = hydratedConfig.record.currentSession;
    if (
      currentSession &&
      (currentSession.provider !== source.provider || currentSession.sessionId !== sessionId)
    ) {
      return null;
    }
    if (hydratedConfig.migrated && hydratedConfig.diagnostics.length > 0) {
      logger.warn(
        `[conversation-config] Migrated ${sessionId}: ${hydratedConfig.diagnostics
          .map((diagnostic) => diagnostic.message)
          .join('; ')}`
      );
    }

    const conversation = dependencies.createConversation({
      id: hydratedConfig.record.conversationId,
      workingDirectory: hydratedConfig.record.workingDirectory ?? source.workingDirectory,
      configState: hydratedConfig.state,
      existingSessionId: sessionId,
      isWorker: source.isWorker,
      swarmId: source.swarmId ?? null,
      workerId: source.workerId ?? null,
      workerRole: source.workerRole ?? null,
      parentConversationId: resolveParentConversationId(source.parentConversationId),
      resumedFromConversationId: source.resumedFromConversationId ?? null,
      modelName: source.modelName ?? null,
      mergeParentMeta: source.mergeParentMeta ?? null,
      mergeChildMeta: source.mergeChildMeta ?? null,
      buddyContext: source.buddyContext ?? hydratedConfig.record.creation?.buddyContext ?? null,
      purpose: source.purpose ?? hydratedConfig.record.creation?.purpose ?? 'general',
    });
    conversation.messages = source.messages;
    conversation.createdAt = source.createdAt;
    conversation.subAgents = source.subAgents;
    return conversation;
  }

  async function recoverConversationsWithoutTranscripts(): Promise<void> {
    for (const record of await dependencies.configService.listRecoverable()) {
      if (dependencies.registry.has(record.conversationId) || !record.workingDirectory) {
        continue;
      }
      const hydrated = await dependencies.configService.hydrate({
        conversationId: record.conversationId,
        sessionBindings: [],
        legacy: {
          provider: record.config.provider,
          reportedModel: record.lastResolvedConfig?.modelId,
          source: 'external_session',
        },
      });
      const recoveredBuddy = record.creation?.buddyContext
        ? await dependencies
            .resolveBuddyConversation(record.creation.buddyContext)
            .catch((error) => {
              logger.warn(`[buddies] Could not rebuild ${record.conversationId} briefing:`, error);
              return null;
            })
        : null;
      const recovered = dependencies.createConversation({
        id: record.conversationId,
        workingDirectory: record.workingDirectory,
        configState: hydrated.state,
        existingSessionId: record.currentSession?.sessionId,
        swarmDebugPrefix: record.creation?.swarmDebugPrefix ?? null,
        resumedFromConversationId: record.creation?.resumedFromConversationId ?? null,
        buddyContext: recoveredBuddy?.context ?? record.creation?.buddyContext ?? null,
        buddyBriefing: recoveredBuddy?.briefing ?? null,
        purpose: record.creation?.purpose ?? 'general',
      });
      dependencies.registry.set(recovered);
      await dependencies.dispatchInitialMessage(recovered);
    }
  }

  function reresolveParentIds(): void {
    const changed: ConversationData[] = [];
    for (const conversation of dependencies.registry.values()) {
      if (!conversation.parentConversationId) continue;
      const resolved = resolveParentConversationId(conversation.parentConversationId);
      if (resolved === conversation.parentConversationId) continue;
      conversation.parentConversationId = resolved;
      changed.push(summarizeConversation(conversation.toJSON()));
    }
    if (changed.length > 0) {
      dependencies.broadcast({
        type: 'conversations_updated',
        conversations: changed,
        summaries: true,
      });
    }
  }

  async function loadExistingConversations(): Promise<void> {
    logger.log('Loading conversations from persisted session files...');
    try {
      fileMtimes = await loadProgressively<
        DiscoveredConversation,
        ConversationRuntime,
        ConversationData
      >(
        {
          limit: dependencies.options.startupLimit,
          concurrency: dependencies.options.startupConcurrency,
          batchSize: dependencies.options.startupBatchSize,
          initialBatchSize: dependencies.options.startupInitialBatchSize,
          logEveryFiles: dependencies.options.startupLogEveryFiles,
        },
        {
          load: dependencies.loadConversations,
          hydrate,
          // Creation is allowed while old history hydrates. A live runtime
          // created after discovery is authoritative and must never be replaced
          // by the older disk snapshot.
          store: (conversation) => {
            if (dependencies.registry.has(conversation.id)) return false;
            dependencies.registry.set(conversation);
            return true;
          },
          serialize: (conversation) => summarizeConversation(conversation.toJSON()),
          broadcast: (conversations) =>
            dependencies.broadcast({
              type: 'conversations_updated',
              conversations,
              summaries: true,
            }),
          count: () => dependencies.registry.size,
        }
      );
      await recoverConversationsWithoutTranscripts();
      reresolveParentIds();
      logger.log(`Loaded ${dependencies.registry.size} conversations from persisted session files`);
    } catch (error) {
      logger.error('Failed to load conversations from persisted sessions:', error);
      throw error;
    }
  }

  function collectActiveIds(): Set<string> {
    const activeIds = new Set<string>();
    for (const [id, conversation] of dependencies.registry.entries()) {
      if (!conversation.hasActiveProcess()) continue;
      activeIds.add(id);
      activeIds.add(conversation.sessionId);
    }
    return activeIds;
  }

  function findBootstrapMatch(
    sessionId: string,
    source: DiscoveredConversation
  ): ConversationRuntime | undefined {
    const importedLastUser = getLastUserMessageContent(source.messages);
    if (!importedLastUser) return undefined;
    const importedCreatedMs = new Date(source.createdAt).getTime();

    for (const conversation of dependencies.registry.values()) {
      if (conversation.provider !== source.provider || conversation.id === sessionId) continue;
      if (conversation.sessionId !== conversation.id && conversation.provider !== 'gemini') {
        continue;
      }
      if (
        (conversation.provider === 'opencode' && conversation.sessionId.startsWith('ses_')) ||
        conversation.workingDirectory !== source.workingDirectory
      ) {
        continue;
      }
      const existingLastUser = getLastUserMessageContent(conversation.messages);
      if (!existingLastUser || existingLastUser !== importedLastUser) continue;
      const existingCreatedMs = conversation.createdAt.getTime();
      if (
        Number.isFinite(importedCreatedMs) &&
        Math.abs(existingCreatedMs - importedCreatedMs) > 5 * 60_000
      ) {
        continue;
      }
      return conversation;
    }
    return undefined;
  }

  async function applyPolledUpdate(
    sessionId: string,
    source: DiscoveredConversation
  ): Promise<ConversationData | null> {
    let existing = findByCurrentSessionId(sessionId);
    if (!existing) {
      const reconciled = findBootstrapMatch(sessionId, source);
      if (reconciled) {
        const oldSessionId = reconciled.sessionId;
        reconciled.sessionId = sessionId;
        if (oldSessionId !== sessionId) {
          dependencies.sessions.unregisterAlias(oldSessionId, { keepKnown: true });
        }
        dependencies.sessions.registerAlias(sessionId, reconciled.id);
        await dependencies.persistCurrentSession(reconciled, sessionId);
        existing = reconciled;
        logger.log(
          `[Poll] Reconciled session ${sessionId.substring(0, 8)} with conversation ${reconciled.id.substring(0, 8)} (old session ${oldSessionId.substring(0, 8)})`
        );
      }
    }

    if (existing && !existing.hasActiveProcess()) {
      dependencies.sessions.registerAlias(sessionId, existing.id);
      const trailingSystemMessages = existing.messages.filter(
        (message, index) => message.role === 'system' && index >= source.messages.length
      );
      existing.messages =
        trailingSystemMessages.length > 0
          ? [...source.messages, ...trailingSystemMessages]
          : source.messages;
      existing.subAgents = source.subAgents;
      existing.createdAt = source.createdAt;
      existing.isWorker = source.isWorker;
      existing.swarmId = source.swarmId ?? null;
      existing.workerId = source.workerId ?? null;
      existing.workerRole = source.workerRole ?? null;
      existing.parentConversationId = resolveParentConversationId(source.parentConversationId);
      existing.resumedFromConversationId = source.resumedFromConversationId ?? null;
      existing.buddyContext = source.buddyContext ?? existing.buddyContext;
      existing.purpose = source.purpose ?? existing.purpose;
      existing.modelName = source.modelName ?? source.model ?? null;
      existing.refreshConfigResolution();
      const serialized = existing.toJSON();
      if (dependencies.externalActivity.has(sessionId)) serialized.isRunning = true;
      return serialized;
    }

    if (
      existing ||
      dependencies.sessions.isKnown(sessionId) ||
      dependencies.sessions.isDeleted(sessionId)
    ) {
      return null;
    }
    const conversation = await hydrate(source);
    if (!conversation) return null;
    dependencies.registry.set(conversation);
    const serialized = conversation.toJSON();
    if (dependencies.externalActivity.has(sessionId)) serialized.isRunning = true;
    return serialized;
  }

  function pruneSessionTracking(): void {
    dependencies.sessions.prune(dependencies.registry);
  }

  function startFilePolling(): void {
    createFilePoller<DiscoveredConversation, ConversationData>(
      {
        intervalMs: dependencies.options.pollIntervalMs,
        externalGraceMs: dependencies.options.externalGraceMs,
        verbose: dependencies.options.verbose,
      },
      {
        getMtimes: () => fileMtimes,
        setMtimes: (mtimes) => {
          fileMtimes = mtimes;
        },
        collectActiveIds,
        poll: dependencies.pollConversations,
        pruneCompletionSuppressions: (now) => dependencies.completionSuppression.prune(now),
        isCompletionSuppressed: (sessionId, now) =>
          dependencies.completionSuppression.isSuppressed(sessionId, now),
        externalActivity: {
          entries: () => dependencies.externalActivity.entries(),
          has: (sessionId) => dependencies.externalActivity.has(sessionId),
          set: (sessionId, lastSeen) => dependencies.externalActivity.set(sessionId, lastSeen),
          delete: (sessionId) => dependencies.externalActivity.delete(sessionId),
        },
        findConversationId: (sessionId) => findByCurrentSessionId(sessionId)?.id,
        broadcastStatus: (conversationId, isRunning) =>
          dependencies.broadcast({
            type: 'status',
            conversationId,
            isRunning,
            isStreaming: false,
          }),
        applyUpdate: applyPolledUpdate,
        broadcastUpdates: (conversations) =>
          dependencies.broadcast({ type: 'conversations_updated', conversations }),
        pruneTracking: pruneSessionTracking,
      }
    ).start();
  }

  return { loadExistingConversations, startFilePolling };
}

function getLastUserMessageContent(messages: Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role !== 'user') continue;
    const content = messages[index].content.trim();
    return content.length > 0 ? content : null;
  }
  return null;
}
