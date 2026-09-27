import assert from 'node:assert/strict';
import test from 'node:test';
import { type Message, type ServerMessage, encodeRows } from '@unleashd/shared';
import { handleMessage, loadConversationDetails, refreshTranscript } from '../src/atoms/actions';
import { messagesOf, rowFamily, transcriptFamily } from '../src/atoms/conversations';
import { jotaiStore } from '../src/atoms/store';
import { bodiesStep } from '../src/hooks/useConversationBodies';
import { setLoaded, setRows } from './fixtures/client-store';
import { syntheticConversation, syntheticDetail } from './fixtures/synthetic-conversations';

/**
 * The disk poller broadcasts rows only (2026-09-25: full histories of growing
 * external transcripts were pushed to every client every 5s). A row keeps the
 * client's loaded transcript, so without a refresh an open chat never showed
 * new messages written by an external CLI session. Since T19 the open view
 * (useConversationBodies) compares the row's messageCount with the messages
 * it holds and pages in only the tail; the WS spine never fetches bodies.
 */

const openId = '21111111-1111-4111-8111-111111111111';

function message(content: string): Message {
  return { role: 'assistant', body: { t: 'text', text: content }, timestamp: new Date('2026-09-25T00:00:00.000Z') };
}

test('a moved message count pages in the open chat tail and keeps its history on screen', () => {
  const fetched: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((url: string) => {
    fetched.push(url);
    return new Promise(() => {});
  }) as typeof fetch;
  try {
    setRows([syntheticConversation(1, { id: openId, messageCount: 2 })]);
    setLoaded(openId, [message('one'), message('two')]);
    handleMessage({
      type: 'rows',
      ...encodeRows([syntheticConversation(1, { id: openId, messageCount: 3 })]),
    } as unknown as ServerMessage);
    assert.deepEqual(fetched, [], 'the rows handler fetches nothing');

    const count = jotaiStore.get(rowFamily(openId))?.messageCount ?? -1;
    const transcript = jotaiStore.get(transcriptFamily(openId));
    assert.equal(bodiesStep(transcript, count), 'refresh');
    void refreshTranscript(openId);
    assert.deepEqual(fetched, [`/api/conversations/${openId}/messages?afterSeq=0&limit=500`]);
    // Regression (review of c21b131): unloading made every reopened external
    // chat flash "Loading conversation history…".
    assert.deepEqual(
      messagesOf(jotaiStore.get(transcriptFamily(openId))).map((entry) => entry.body.t === 'text' ? entry.body.text : ''),
      ['one', 'two']
    );
    assert.equal(bodiesStep(transcript, 2), 'none', 'a current chat is not refetched');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a terminal attempt patch during detail loading survives a slower history response', async () => {
  const raceId = '31111111-1111-4111-8111-111111111111';
  const realFetch = globalThis.fetch;
  let releaseHistory: ((response: Response) => void) | undefined;
  let detailParsed: (() => void) | undefined;
  const history = new Promise<Response>((resolve) => {
    releaseHistory = resolve;
  });
  const detailComplete = new Promise<void>((resolve) => {
    detailParsed = resolve;
  });
  const attempt = {
    attemptId: 'attempt-restarted',
    conversationId: raceId,
    originServerBootId: 'old-boot',
    state: 'interrupted' as const,
    terminalCause: 'server_restart' as const,
    stateTimestamps: {
      queued: '2026-09-25T00:00:00.000Z',
      interrupted: '2026-09-25T00:00:01.000Z',
    },
    createdAt: '2026-09-25T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:01.000Z',
    terminalAt: '2026-09-25T00:00:01.000Z',
  };
  globalThis.fetch = ((url: string) =>
    url.endsWith('/messages?afterSeq=-1&limit=500')
      ? history
      : Promise.resolve({
          ok: true,
          json: async () => {
            const staleDetail = syntheticDetail(raceId, { latestAttempt: null });
            detailParsed?.();
            return staleDetail;
          },
        } as Response)) as typeof fetch;
  try {
    setRows([syntheticConversation(1, { id: raceId, messageCount: 0 })]);
    const loading = loadConversationDetails(raceId);
    await detailComplete;
    await new Promise<void>((resolve) => setImmediate(resolve)); // detail GET settled; history remains held.
    handleMessage({ type: 'patch', id: raceId, patch: { t: 'attempt', latestAttempt: attempt } });
    assert.equal(jotaiStore.get(transcriptFamily(raceId)).tag, 'loading');
    releaseHistory?.(
      new Response(JSON.stringify({ epoch: 0, total: 0, afterSeq: -1, messages: [] }))
    );
    await loading;
    const transcript = jotaiStore.get(transcriptFamily(raceId));
    assert.equal(
      transcript.tag === 'loaded' ? transcript.detail.latestAttempt?.terminalCause : null,
      'server_restart'
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
