import type {
  ConfigResolution,
  ConversationConfig,
  ConversationConfigState,
  Conversation as ConversationData,
  Provider,
  ServerMessage,
} from '@unleashd/shared';
import { ConversationConfigSchema } from '@unleashd/shared';
import type { Application, RequestHandler } from 'express';

export interface MergeConversation {
  readonly id: string;
  readonly provider: Provider;
  readonly isRunning: boolean;
  readonly workingDirectory: string;
  readonly sessionId: string;
  readonly config: ConversationConfig;
  readonly configRevision: number;
  readonly configResolution: ConfigResolution;
  toJSON(): ConversationData;
  spawnMergeReviewFork(prompt: string, sourceSessionId: string): void;
}

export interface MergeParentMetadata {
  children: Array<{
    sourceConversationId: string;
    childConversationId: string;
    reviewUuid: string;
    childWorkingDirectory: string;
  }>;
  prefixInjected: boolean;
}

export interface MergeChildMetadata {
  parentConversationId: string;
  reviewUuid: string;
}

export interface MergeConversationOptions {
  id: string;
  workingDirectory: string;
  configState: ConversationConfigState;
  resumedFromConversationId?: string;
  mergeParentMeta?: MergeParentMetadata;
  mergeChildMeta?: MergeChildMetadata;
}

export interface MergeConfigService {
  create(input: {
    conversationId: string;
    config: ConversationConfig;
    workingDirectory: string;
  }): Promise<ConversationConfigState>;
  fork(input: {
    conversationId: string;
    source: ConversationConfigState;
    workingDirectory: string;
  }): Promise<ConversationConfigState>;
  purge(conversationId: string): Promise<unknown>;
}

export interface MergeRouteDependencies {
  getConversation(id: string): MergeConversation | undefined;
  createAndAddConversation(options: MergeConversationOptions): MergeConversation;
  configService: MergeConfigService;
  providerSupportsFork(provider: Provider): boolean;
  forkCapableProviders: Iterable<Provider>;
  buildReviewPrompt(reviewUuid: string): string;
  createId(): string;
  broadcast(message: ServerMessage): void;
  logger?: Pick<Console, 'error'>;
}

interface MergeSource {
  id: string;
  conversation: MergeConversation;
}

interface MergeChildPlan {
  sourceConversationId: string;
  childConversationId: string;
  reviewUuid: string;
  childWorkingDirectory: string;
}

export function createMergeConversationsHandler(
  dependencies: MergeRouteDependencies
): RequestHandler {
  const logger = dependencies.logger ?? console;

  return async (request, response) => {
    const body: unknown = request.body;
    const objectBody =
      body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const parsedParentConfig = ConversationConfigSchema.safeParse(objectBody.parentConfig);
    const sourceIds = objectBody.sourceIds;
    const workingDirectory = objectBody.workingDirectory;

    if (!parsedParentConfig.success) {
      response.status(400).json({ error: 'Invalid or missing parentConfig' });
      return;
    }
    if (!Array.isArray(sourceIds) || sourceIds.length === 0 || !sourceIds.every(isString)) {
      response.status(400).json({ error: 'sourceIds must be a non-empty string array' });
      return;
    }
    if (typeof workingDirectory !== 'string' || workingDirectory.length === 0) {
      response.status(400).json({ error: 'workingDirectory required' });
      return;
    }

    const sources = resolveSources(sourceIds, dependencies, response);
    if (!sources) return;

    const parentId = dependencies.createId();
    const children: MergeChildPlan[] = sources.map((source) => ({
      sourceConversationId: source.id,
      childConversationId: dependencies.createId(),
      reviewUuid: dependencies.createId(),
      childWorkingDirectory: source.conversation.workingDirectory,
    }));

    const createdConfigIds: string[] = [];
    const childConfigStates: ConversationConfigState[] = [];
    let parentConfigState: ConversationConfigState;
    try {
      parentConfigState = await dependencies.configService.create({
        conversationId: parentId,
        config: parsedParentConfig.data,
        workingDirectory,
      });
      createdConfigIds.push(parentId);

      for (let index = 0; index < children.length; index += 1) {
        const source = sources[index].conversation;
        const child = children[index];
        const state = await dependencies.configService.fork({
          conversationId: child.childConversationId,
          source: {
            config: source.config,
            revision: source.configRevision,
            resolution: source.configResolution,
          },
          workingDirectory: child.childWorkingDirectory,
        });
        childConfigStates.push(state);
        createdConfigIds.push(child.childConversationId);
      }
    } catch (error) {
      await Promise.allSettled(createdConfigIds.map((id) => dependencies.configService.purge(id)));
      response.status(400).json({ error: errorMessage(error) });
      return;
    }

    const parent = dependencies.createAndAddConversation({
      id: parentId,
      workingDirectory,
      configState: parentConfigState,
      mergeParentMeta: {
        children,
        prefixInjected: false,
      },
    });
    publishConversation(parent, dependencies);

    for (let index = 0; index < children.length; index += 1) {
      const plan = children[index];
      const source = sources[index].conversation;
      const child = dependencies.createAndAddConversation({
        id: plan.childConversationId,
        workingDirectory: source.workingDirectory,
        configState: childConfigStates[index],
        resumedFromConversationId: source.id,
        mergeChildMeta: {
          parentConversationId: parentId,
          reviewUuid: plan.reviewUuid,
        },
      });
      publishConversation(child, dependencies);

      try {
        child.spawnMergeReviewFork(
          dependencies.buildReviewPrompt(plan.reviewUuid),
          source.sessionId
        );
      } catch (error) {
        logger.error(`[merge] Failed to spawn fork for source ${source.id}:`, error);
        dependencies.broadcast({
          type: 'merge_child_status',
          parentConversationId: parentId,
          childConversationId: child.id,
          reviewUuid: plan.reviewUuid,
          status: 'error',
          errorMessage: errorMessage(error),
        });
      }
    }

    response.json({
      parentId,
      children: children.map((child) => ({
        sourceId: child.sourceConversationId,
        childId: child.childConversationId,
        reviewUuid: child.reviewUuid,
      })),
    });
  };
}

export function registerMergeRoutes(app: Application, dependencies: MergeRouteDependencies): void {
  app.post('/api/conversations/merge', createMergeConversationsHandler(dependencies));
}

function resolveSources(
  sourceIds: string[],
  dependencies: MergeRouteDependencies,
  response: Parameters<RequestHandler>[1]
): MergeSource[] | undefined {
  const sources: MergeSource[] = [];
  for (const id of sourceIds) {
    const conversation = dependencies.getConversation(id);
    if (!conversation) {
      response.status(404).json({ error: `Source conversation not found: ${id}` });
      return undefined;
    }
    if (!dependencies.providerSupportsFork(conversation.provider)) {
      response.status(400).json({
        error: `Provider "${conversation.provider}" does not support fork yet. Supported: ${Array.from(dependencies.forkCapableProviders).join(', ')}.`,
        conversationId: id,
      });
      return undefined;
    }
    if (conversation.isRunning) {
      response.status(409).json({
        error: `Source conversation is still running: ${id}. Stop it first.`,
        conversationId: id,
      });
      return undefined;
    }
    sources.push({ id, conversation });
  }
  return sources;
}

function publishConversation(
  conversation: MergeConversation,
  dependencies: MergeRouteDependencies
): void {
  dependencies.broadcast({
    type: 'conversations_updated',
    conversations: [conversation.toJSON()],
  });
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
