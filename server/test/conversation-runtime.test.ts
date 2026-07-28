import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultConversationConfig } from '@unleashd/shared';
import { createConversationRuntime } from '../src/conversations/runtime';
import { resolveConfigAgainstProviderCatalog } from '../src/providers/catalog-service';

test('conversation runtime binds server capabilities without importing server orchestration', () => {
  const aliases: Array<[string, string]> = [];
  const broadcasts: unknown[] = [];
  const config = createDefaultConversationConfig('codex');
  const Conversation = createConversationRuntime({
    broadcast: (message) => broadcasts.push(message),
    registerSessionAlias: (sessionId, conversationId) => {
      if (sessionId) aliases.push([sessionId, conversationId]);
    },
    unregisterSessionAlias: () => undefined,
    clearExternalRunningStatus: () => undefined,
    clearLocalCompletionSuppression: () => undefined,
    markLocalCompletionSuppression: () => undefined,
    persistCurrentSession: async () => undefined,
    updateBuddyStatus: () => undefined,
    settleBuddyDelegation: () => undefined,
    getConversation: () => undefined,
    readLatestOompaRuntime: () => ({
      available: false,
      run: null,
      reason: 'No runs directory found',
    }),
    createSessionId: () => 'rotated-session',
  });

  const conversation = new Conversation({
    id: 'conversation-id',
    workingDirectory: '/tmp',
    configState: {
      config,
      revision: 0,
      resolution: resolveConfigAgainstProviderCatalog(config),
    },
  });

  assert.deepEqual(aliases, [['conversation-id', 'conversation-id']]);
  assert.equal(broadcasts.length, 0);
  assert.equal(conversation.provider, 'codex');
  assert.equal(conversation.toJSON().id, 'conversation-id');

  conversation.resetProcess();
  assert.equal(conversation.sessionId, 'rotated-session');
  assert.deepEqual(aliases.at(-1), ['rotated-session', 'conversation-id']);
});
