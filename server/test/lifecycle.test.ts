import assert from 'node:assert/strict';
import test from 'node:test';
import { createFilePoller } from '../src/lifecycle/file-poller';
import { ensureAvailablePort } from '../src/lifecycle/port-guard';
import { loadProgressively } from '../src/lifecycle/progressive-loader';

test('progressive loader hydrates, stores, and broadcasts each non-null item', async () => {
  const stored: number[] = [];
  const broadcasts: string[][] = [];
  const mtimes = new Map([['session', 1]]);
  const result = await loadProgressively(
    { limit: 10, concurrency: 2, batchSize: 5, logEveryFiles: 10 },
    {
      load: async ({ onProgress }) => {
        await onProgress([1, 2, 3], { loaded: 3, total: 3 });
        return { mtimes };
      },
      hydrate: async (source) => (source === 2 ? null : source * 10),
      store: (hydrated) => stored.push(hydrated),
      serialize: (hydrated) => String(hydrated),
      broadcast: (batch) => broadcasts.push(batch),
      count: () => stored.length,
    }
  );

  assert.equal(result, mtimes);
  assert.deepEqual(stored, [10, 30]);
  assert.deepEqual(broadcasts, [['10', '30']]);
});

test('file poller delegates application updates and external status through ports', async () => {
  let currentMtimes = new Map<string, number>();
  const external = new Map<string, number>();
  const statuses: Array<[string, boolean]> = [];
  const broadcasts: string[][] = [];
  const poller = createFilePoller<string, string>(
    { intervalMs: 5_000, externalGraceMs: 30_000, verbose: false },
    {
      getMtimes: () => currentMtimes,
      setMtimes: (mtimes) => {
        currentMtimes = mtimes;
      },
      collectActiveIds: () => new Set(),
      poll: async () => ({
        updated: new Map([['session-1', 'update']]),
        mtimes: new Map([['file', 2]]),
      }),
      pruneCompletionSuppressions: () => undefined,
      isCompletionSuppressed: () => false,
      externalActivity: {
        entries: () => external.entries(),
        has: (sessionId) => external.has(sessionId),
        set: (sessionId, lastSeen) => external.set(sessionId, lastSeen),
        delete: (sessionId) => external.delete(sessionId),
      },
      findConversationId: () => 'conversation-1',
      broadcastStatus: (conversationId, running) => statuses.push([conversationId, running]),
      applyUpdate: async (sessionId, update) => `${sessionId}:${update}`,
      broadcastUpdates: (updates) => broadcasts.push(updates),
      pruneTracking: () => undefined,
    }
  );

  await poller.runOnce();

  assert.deepEqual(statuses, [['conversation-1', true]]);
  assert.deepEqual(broadcasts, [['session-1:update']]);
  assert.equal(currentMtimes.get('file'), 2);
  assert.equal(external.has('session-1'), true);
});

test('file poller coalesces overlapping cycles', async () => {
  let resolvePoll:
    | ((result: { updated: Map<string, string>; mtimes: Map<string, number> }) => void)
    | undefined;
  let pollCalls = 0;
  const poller = createFilePoller<string, string>(
    { intervalMs: 5_000, externalGraceMs: 30_000, verbose: false },
    {
      getMtimes: () => new Map(),
      setMtimes: () => undefined,
      collectActiveIds: () => new Set(),
      poll: async () => {
        pollCalls += 1;
        return await new Promise((resolve) => {
          resolvePoll = resolve;
        });
      },
      pruneCompletionSuppressions: () => undefined,
      isCompletionSuppressed: () => false,
      externalActivity: {
        entries: () => new Map<string, number>().entries(),
        has: () => false,
        set: () => undefined,
        delete: () => undefined,
      },
      findConversationId: () => undefined,
      broadcastStatus: () => undefined,
      applyUpdate: async () => null,
      broadcastUpdates: () => undefined,
      pruneTracking: () => undefined,
    }
  );

  const first = poller.runOnce();
  const second = poller.runOnce();
  assert.equal(first, second);
  assert.equal(pollCalls, 1);

  assert.ok(resolvePoll);
  resolvePoll({ updated: new Map(), mtimes: new Map() });
  await Promise.all([first, second]);

  const third = poller.runOnce();
  assert.equal(pollCalls, 2);
  assert.ok(resolvePoll);
  resolvePoll({ updated: new Map(), mtimes: new Map() });
  await third;
});

test('file poller preserves dirty baselines until an active session can be reconciled', async () => {
  let active = true;
  let currentMtimes = new Map([['session-file', 1]]);
  const applied: string[] = [];
  const seenBaselines: number[] = [];
  const external = new Map<string, number>();
  const poller = createFilePoller<string, string>(
    { intervalMs: 5_000, externalGraceMs: 30_000, verbose: false },
    {
      getMtimes: () => currentMtimes,
      setMtimes: (mtimes) => {
        currentMtimes = mtimes;
      },
      collectActiveIds: () => (active ? new Set(['session-1']) : new Set()),
      poll: async (mtimes) => {
        seenBaselines.push(mtimes.get('session-file') ?? -1);
        return active
          ? {
              updated: new Map(),
              mtimes: new Map([['session-file', 2]]),
              deferredDirtyPaths: new Set(['session-file']),
            }
          : {
              updated: new Map([['session-1', 'final-update']]),
              mtimes: new Map([['session-file', 2]]),
            };
      },
      pruneCompletionSuppressions: () => undefined,
      isCompletionSuppressed: () => false,
      externalActivity: {
        entries: () => external.entries(),
        has: (sessionId) => external.has(sessionId),
        set: (sessionId, lastSeen) => external.set(sessionId, lastSeen),
        delete: (sessionId) => external.delete(sessionId),
      },
      findConversationId: () => undefined,
      broadcastStatus: () => undefined,
      applyUpdate: async (sessionId, update) => {
        applied.push(`${sessionId}:${update}`);
        return null;
      },
      broadcastUpdates: () => undefined,
      pruneTracking: () => undefined,
    }
  );

  await poller.runOnce();
  assert.equal(currentMtimes.get('session-file'), 1);
  assert.deepEqual(applied, []);

  active = false;
  await poller.runOnce();
  assert.deepEqual(seenBaselines, [1, 1]);
  assert.equal(currentMtimes.get('session-file'), 2);
  assert.deepEqual(applied, ['session-1:final-update']);
});

test('port guard kills an approved listener and verifies release', async () => {
  const calls: string[] = [];
  let checks = 0;
  await ensureAvailablePort(3000, {
    checkPort: async () => {
      checks += 1;
      return checks > 1;
    },
    askQuestion: async () => 'yes',
    killProcessOnPort: () => {
      calls.push('kill');
      return true;
    },
    wait: async () => {
      calls.push('wait');
    },
    exit: (code) => {
      throw new Error(`unexpected exit ${code}`);
    },
  });

  assert.deepEqual(calls, ['kill', 'wait']);
  assert.equal(checks, 2);
});
