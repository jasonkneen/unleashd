import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BuddiesStore } from '@nbardy/buddies';
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

test('human approval routes list pending requests and persist one terminal owner decision', async () => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-approval-routes-'));
  const store = new BuddiesStore(':memory:');
  const workspace = store.createWorkspace({ name: 'Workspace', rootPath: root });
  const buddy = store.createBuddy({
    project: workspace.id,
    name: 'Lead',
    role: 'Own outcomes',
  });
  const approval = store.createApprovalRequest({
    buddy: buddy.id,
    workspace: workspace.id,
    action: 'Publish campaign',
    reason: 'Internal checks passed.',
    risk: 'Changes public state.',
  });
  const app = express();
  app.use(express.json());
  registerBuddyRoutes(app, {
    getStore: async () => store as unknown as BuddiesStorePort,
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
    const pending = await fetch(
      `http://127.0.0.1:${port}/api/buddies/approvals?buddyId=${encodeURIComponent(buddy.id)}&status=pending`
    );
    assert.equal(pending.status, 200);
    assert.equal(((await pending.json()) as Array<{ id: string }>)[0]?.id, approval.id);

    const resolved = await fetch(
      `http://127.0.0.1:${port}/api/buddies/approvals/${encodeURIComponent(approval.id)}/resolve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          resolvedBy: 'Owner',
          note: 'Approved for this action only.',
        }),
      }
    );
    assert.equal(resolved.status, 200);
    assert.equal(((await resolved.json()) as { status: string }).status, 'approved');

    const secondDecision = await fetch(
      `http://127.0.0.1:${port}/api/buddies/approvals/${encodeURIComponent(approval.id)}/resolve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'rejected', resolvedBy: 'Owner' }),
      }
    );
    assert.equal(secondDecision.status, 400);
    assert.equal(store.getApprovalRequest(approval.id)?.status, 'approved');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
