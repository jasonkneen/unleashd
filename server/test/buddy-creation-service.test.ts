import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createDefaultConversationConfig } from '@unleashd/shared';
import {
  type BuddyCreationServicePorts,
  createBuddyCreationService,
  creationFingerprint,
} from '../src/conversations/buddy-creation-service';
import type { ConversationOptions, ConversationRuntime } from '../src/conversations/runtime';

const context = {
  buddyId: 'buddy-1',
  workspaceId: 'workspace-1',
  buddyProjectId: null,
};

test('creation fingerprint is stable and covers message intent', () => {
  const base = {
    workingDirectory: '/workspace',
    config: createDefaultConversationConfig('codex'),
    buddyContext: context,
  };
  assert.equal(creationFingerprint(base), creationFingerprint({ ...base }));
  assert.notEqual(
    creationFingerprint(base),
    creationFingerprint({ ...base, initialMessage: 'Ship it' })
  );
});

test('server Buddy creation persists, registers, broadcasts, links, and dispatches once', async () => {
  const registered: ConversationRuntime[] = [];
  const broadcasts: unknown[] = [];
  const linked: string[] = [];
  const queued: string[] = [];
  const creates: unknown[] = [];
  let claimed = false;

  class FakeConversation extends EventEmitter {
    readonly id: string;
    readonly sessionId: string;
    readonly provider = 'codex' as const;
    readonly config = createDefaultConversationConfig('codex');
    readonly buddyContext = context;
    readonly messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    constructor(options: ConversationOptions) {
      super();
      this.id = options.id;
      this.sessionId = options.id;
    }

    enqueueMessage(message: string): void {
      queued.push(message);
    }

    toJSON() {
      return { id: this.id };
    }
  }

  const config = createDefaultConversationConfig('codex');
  const ports = {
    configService: {
      async createOrReplay(input: unknown) {
        creates.push(input);
        return {
          state: {
            config,
            revision: 0,
            resolution: {
              status: 'resolved',
              value: { provider: 'codex', model: 'gpt-5.6-sol' },
            },
          },
        };
      },
      async claimInitialMessageDispatch() {
        if (claimed) return undefined;
        claimed = true;
        return {
          creation: {
            initialMessage: 'Start here',
            initialMessageDispatchClaimedAt: new Date().toISOString(),
            initialMessageDispatchClaimToken: 'claim-1',
          },
        };
      },
      async completeInitialMessageDispatch() {
        return {
          creation: {
            initialMessage: 'Start here',
            initialMessageDispatchedAt: new Date().toISOString(),
          },
        };
      },
      async getRecord() {
        return {
          creation: {
            initialMessage: 'Start here',
            initialMessageDispatchedAt: claimed ? new Date().toISOString() : undefined,
          },
        };
      },
      async setCurrentSession() {},
    },
    resolveBuddyConversation: async () => ({
      context,
      briefing: 'briefing',
      workingDirectory: '/workspace',
      provider: 'codex' as const,
      model: 'gpt-5.6-sol',
    }),
    resolveWorkingDirectory: (directory: string) => directory,
    isProviderAvailable: () => true,
    createId: () => 'conversation-1',
    createConversation: (options: ConversationOptions) =>
      new FakeConversation(options) as unknown as ConversationRuntime,
    registerConversation: (conversation: ConversationRuntime) => registered.push(conversation),
    createConversationLink: async (conversation: ConversationRuntime) => {
      linked.push(conversation.id);
    },
    updateConversationStatus: () => undefined,
    broadcast: (message: unknown) => broadcasts.push(message),
  } as unknown as BuddyCreationServicePorts;

  const service = createBuddyCreationService(ports);
  const conversation = await service.createServerBuddyConversation({
    context,
    initialMessage: 'Start here',
    commandId: 'command-1',
  });
  await service.dispatchInitialMessageIfPending(conversation);

  assert.equal(conversation.id, 'conversation-1');
  assert.equal(creates.length, 1);
  assert.deepEqual(registered, [conversation]);
  assert.deepEqual(linked, ['conversation-1']);
  assert.equal(broadcasts.length, 1);
  assert.deepEqual(queued, ['Start here']);
});
