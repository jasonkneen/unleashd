import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import type { BuddiesStorePort } from '../src/buddies/contract';
import { registerBuddyRoutes } from '../src/buddies/routes';

test('Buddy overview route forwards the optional cutoff and returns one projection', async () => {
  const app = express();
  app.use(express.json());
  const calls: Array<Date | string | undefined> = [];
  const overview = {
    generatedAt: '2026-07-28T00:00:00.000Z',
    employees: [],
    topLevel: [],
    recentRuns: [],
  };
  const store = {
    overview(options?: { recentSince?: Date | string }) {
      calls.push(options?.recentSince);
      return overview;
    },
  } as unknown as BuddiesStorePort;
  registerBuddyRoutes(app, {
    getStore: async () => store,
    getScheduler: () => null,
    createConversation: async () => {
      throw new Error('not used');
    },
    sendError(response, error, fallbackStatus) {
      response
        .status(fallbackStatus)
        .json({ error: error instanceof Error ? error.message : String(error) });
    },
    getNextAutomationRunAt: () => '2026-07-29T00:00:00.000Z',
    createId: () => 'test-id',
  });

  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const { port } = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${port}/api/buddies/overview?recentSince=2026-07-01T00%3A00%3A00.000Z`
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), overview);
    assert.deepEqual(calls, ['2026-07-01T00:00:00.000Z']);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
