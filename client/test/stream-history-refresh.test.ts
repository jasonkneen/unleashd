import assert from 'node:assert/strict';
import test from 'node:test';
import type { Message, ServerMessage } from '@unleashd/shared';
import { handleMessage, refreshTranscript } from '../src/atoms/actions';
import { groupsFamily } from '../src/atoms/conversations';
import { jotaiStore } from '../src/atoms/store';
import { setLoaded, setRows } from './fixtures/client-store';
import { syntheticConversation } from './fixtures/synthetic-conversations';

/**
 * Regression (#bugfixes 2026-09-29): a Codex DM showed every paragraph twice, glued
 * ("…local workBy …"). A history refresh landed mid-reply with the server's text, which already
 * held the chunks the client was still keeping in its stream atom, so the tail drew them again and
 * the next tool frame committed the double. A refresh must keep only chunks the server lacks.
 */

// requestAnimationFrame drives the chunk flush; node has none. Run it at once, as a frame would.
globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 0;
};

const id = '41111111-1111-4111-8111-111111111111';
const at = new Date('2026-09-29T00:00:00.000Z');
const said = (role: Message['role'], text: string): Message => ({
  role,
  body: { t: 'text', text },
  timestamp: at,
});

function shownText(): string {
  return jotaiStore
    .get(groupsFamily(id))
    .flatMap((group) => group.messages)
    .map((message) => (message.body.t === 'text' ? message.body.text : ''))
    .join('|');
}

test('a history refresh during a streamed reply does not draw the streamed text twice', async () => {
  const realFetch = globalThis.fetch;
  // The server folded " world" before answering; "!" arrives after its snapshot.
  const page = { epoch: 0, total: 2, afterSeq: 0, messages: [said('assistant', 'Hello world')] };
  globalThis.fetch = (async () => new Response(JSON.stringify(page))) as typeof fetch;
  try {
    setRows([syntheticConversation(1, { id, messageCount: 2 })]);
    setLoaded(id, [said('user', 'hi'), said('assistant', 'Hello')]);
    handleMessage({ type: 'chunk', conversationId: id, text: ' world' } as ServerMessage);
    handleMessage({ type: 'chunk', conversationId: id, text: '!' } as ServerMessage);
    await refreshTranscript(id);
    assert.equal(shownText(), 'hi|Hello world!');
    handleMessage({ type: 'message_complete', conversationId: id } as ServerMessage);
    assert.equal(shownText(), 'hi|Hello world!');
  } finally {
    globalThis.fetch = realFetch;
  }
});
