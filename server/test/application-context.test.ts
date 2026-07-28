import assert from 'node:assert/strict';
import test from 'node:test';
import type { WebSocketServer } from 'ws';
import { createConversationApplicationContext } from '../src/application/context';

test('application context owns conversation identity and session tracking', () => {
  const context = createConversationApplicationContext<{ id: string; sessionId: string }>({
    webSocketServer: { clients: new Set() } as unknown as WebSocketServer,
    completionSuppressionMs: 100,
  });
  const conversation = { id: 'conversation-1', sessionId: 'session-1' };

  context.registry.set(conversation);
  context.sessions.registerAlias(conversation.sessionId, conversation.id);

  assert.equal(context.registry.get(conversation.id), conversation);
  assert.equal(context.sessions.aliasFor(conversation.sessionId), conversation.id);
  assert.equal(context.sessions.isKnown(conversation.sessionId), true);

  context.sessions.unregisterConversationAliases(conversation.id, { keepKnown: true });
  assert.equal(context.sessions.hasAlias(conversation.sessionId), false);
  assert.equal(context.sessions.isKnown(conversation.sessionId), true);

  context.sessions.markDeleted(conversation.sessionId);
  assert.equal(context.sessions.isDeleted(conversation.sessionId), true);
});

test('completion suppression expires deterministically', () => {
  let now = 1_000;
  const context = createConversationApplicationContext<{ id: string; sessionId: string }>({
    webSocketServer: { clients: new Set() } as unknown as WebSocketServer,
    completionSuppressionMs: 100,
    now: () => now,
  });

  context.completionSuppression.mark('session-1');
  assert.equal(context.completionSuppression.isSuppressed('session-1', now), true);

  now += 100;
  assert.equal(context.completionSuppression.isSuppressed('session-1', now), false);
  assert.equal(context.completionSuppression.isSuppressed('session-1', now), false);
});
