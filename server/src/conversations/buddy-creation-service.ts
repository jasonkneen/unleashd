import crypto from 'node:crypto';
import type { BuddyContext, ConversationConfig, Provider } from '@unleashd/shared';
import { normalizeModelId } from '@unleashd/shared';
import type { BuddyAutomation, BuddyAutomationRun } from '../buddies/contract';
import type { ResolvedBuddyConversation } from '../buddies/integration';
import type { BuddyAutomationConversation } from '../buddies/scheduler';
import { configFromProviderPreferences } from './config-mapping';
import type { ConversationConfigService } from './config-service';
import type {
  ConversationBroadcast,
  ConversationOptions,
  ConversationRuntime,
  ConversationRuntimeView,
} from './runtime';

export interface CreationFingerprintInput {
  workingDirectory: string;
  config: ConversationConfig;
  initialMessage?: string;
  swarmDebugPrefix?: string;
  resumedFromConversationId?: string;
  buddyContext?: BuddyContext;
}

export interface CreateServerBuddyConversationInput {
  context: BuddyContext;
  initialMessage: string;
  commandId: string;
  conversationId?: string;
}

export interface BuddyCreationServicePorts {
  configService: Pick<
    ConversationConfigService,
    'claimInitialMessageDispatch' | 'createOrReplay' | 'setCurrentSession'
  >;
  resolveBuddyConversation(context: BuddyContext): Promise<ResolvedBuddyConversation>;
  resolveWorkingDirectory(input: string): string;
  isProviderAvailable(provider: Provider): boolean;
  createId(): string;
  createConversation(options: ConversationOptions): ConversationRuntime;
  registerConversation(conversation: ConversationRuntime): void;
  createConversationLink(conversation: ConversationRuntime): Promise<void>;
  updateConversationStatus(
    conversation: ConversationRuntime,
    status: 'active' | 'complete' | 'failed' | 'cancelled'
  ): void;
  broadcast(data: ConversationBroadcast): void;
  logger?: Pick<Console, 'warn'>;
}

export interface BuddyCreationService {
  creationFingerprint(input: CreationFingerprintInput): string;
  persistCurrentSession(conversation: ConversationRuntimeView, sessionId: string): Promise<void>;
  dispatchInitialMessageIfPending(conversation: ConversationRuntime): Promise<void>;
  createAutomationConversation(
    automation: BuddyAutomation,
    run: BuddyAutomationRun
  ): Promise<BuddyAutomationConversation>;
  createServerBuddyConversation(
    input: CreateServerBuddyConversationInput
  ): Promise<ConversationRuntime>;
}

export function creationFingerprint(input: CreationFingerprintInput): string {
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

export function createBuddyCreationService(ports: BuddyCreationServicePorts): BuddyCreationService {
  const logger = ports.logger ?? console;

  async function persistCurrentSession(
    conversation: ConversationRuntimeView,
    sessionId: string
  ): Promise<void> {
    try {
      await ports.configService.setCurrentSession(conversation.id, {
        provider: conversation.config.provider,
        sessionId,
      });
    } catch (error) {
      logger.warn(
        `[conversation-config] Failed to bind session ${sessionId} to ${conversation.id}:`,
        error
      );
    }
  }

  async function dispatchInitialMessageIfPending(conversation: ConversationRuntime): Promise<void> {
    const claimed = await ports.configService.claimInitialMessageDispatch(conversation.id);
    const initialMessage = claimed?.creation?.initialMessage;
    if (initialMessage) conversation.enqueueMessage(initialMessage);
  }

  function resolveConfig(resolved: ResolvedBuddyConversation): ConversationConfig {
    if (!ports.isProviderAvailable(resolved.provider)) {
      throw new Error(`Buddy provider is unavailable: ${resolved.provider}`);
    }
    return configFromProviderPreferences({
      provider: resolved.provider,
      model: normalizeModelId(resolved.provider, resolved.model),
      reasoningEffort: resolved.reasoningEffort,
    });
  }

  async function createAndRegister(input: {
    conversationId: string;
    workingDirectory: string;
    resolved: ResolvedBuddyConversation;
    config: ConversationConfig;
    commandId: string;
    initialMessage?: string;
  }): Promise<ConversationRuntime> {
    const fingerprint = creationFingerprint({
      workingDirectory: input.workingDirectory,
      config: input.config,
      initialMessage: input.initialMessage,
      buddyContext: input.resolved.context,
    });
    const creation = await ports.configService.createOrReplay({
      conversationId: input.conversationId,
      config: input.config,
      workingDirectory: input.workingDirectory,
      creation: {
        commandId: input.commandId,
        fingerprint,
        ...(input.initialMessage === undefined ? {} : { initialMessage: input.initialMessage }),
        buddyContext: input.resolved.context,
      },
    });
    const conversation = ports.createConversation({
      id: input.conversationId,
      workingDirectory: input.workingDirectory,
      configState: creation.state,
      buddyContext: input.resolved.context,
      buddyBriefing: input.resolved.briefing,
    });
    ports.registerConversation(conversation);
    await ports.createConversationLink(conversation);
    ports.broadcast({
      type: 'conversations_updated',
      conversations: [conversation.toJSON()],
    });
    return conversation;
  }

  async function createAutomationConversation(
    automation: BuddyAutomation,
    run: BuddyAutomationRun
  ): Promise<BuddyAutomationConversation> {
    if (!automation.workspace_id) {
      throw new Error('Automation must have one workspace scope before it can run');
    }
    const resolved = await ports.resolveBuddyConversation({
      buddyId: automation.buddy_id,
      workspaceId: automation.workspace_id,
      buddyProjectId: automation.buddy_project_id,
      automationRunId: run.id,
    });
    const config = resolveConfig(resolved);
    const conversationId = ports.createId();
    const workingDirectory = ports.resolveWorkingDirectory(resolved.workingDirectory);
    const conversation = await createAndRegister({
      conversationId,
      workingDirectory,
      resolved,
      config,
      commandId: `buddy-automation-${run.id}`,
    });

    return {
      conversationId,
      runTurn(prompt: string) {
        return new Promise<string>((resolve, reject) => {
          const cleanup = () => {
            conversation.off('buddy-turn-complete', onComplete);
            conversation.off('buddy-turn-failed', onFailure);
          };
          const onComplete = (output: string) => {
            cleanup();
            resolve(output);
          };
          const onFailure = (reason: string) => {
            cleanup();
            reject(new Error(reason || 'Buddy automation turn failed'));
          };
          conversation.once('buddy-turn-complete', onComplete);
          conversation.once('buddy-turn-failed', onFailure);
          conversation.sendMessage(prompt);
        });
      },
      stop: () => conversation.stop(),
      finish: (status) => ports.updateConversationStatus(conversation, status),
    };
  }

  async function createServerBuddyConversation(
    input: CreateServerBuddyConversationInput
  ): Promise<ConversationRuntime> {
    const resolved = await ports.resolveBuddyConversation(input.context);
    const conversation = await createAndRegister({
      conversationId: input.conversationId ?? ports.createId(),
      workingDirectory: ports.resolveWorkingDirectory(resolved.workingDirectory),
      resolved,
      config: resolveConfig(resolved),
      commandId: input.commandId,
      initialMessage: input.initialMessage,
    });
    await dispatchInitialMessageIfPending(conversation);
    return conversation;
  }

  return {
    creationFingerprint,
    persistCurrentSession,
    dispatchInitialMessageIfPending,
    createAutomationConversation,
    createServerBuddyConversation,
  };
}
