import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readLatestSwarmRuntime } from '../src/swarm/runtime';

test('runtime derives live worker state through injected process liveness', async (context) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'unleashd-swarm-runtime-'));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));
  const runDirectory = path.join(projectRoot, 'runs', 'run-1');
  await mkdir(path.join(runDirectory, 'cycles'), { recursive: true });
  await writeFile(
    path.join(runDirectory, 'started.json'),
    JSON.stringify({
      'swarm-id': 'swarm-1',
      'started-at': '2026-01-01T00:00:00.000Z',
      'config-file': '/tmp/oompa.json',
      pid: 123,
      workers: [
        { id: 'worker-a', harness: 'codex', model: 'gpt-5.6-sol', iterations: 2 },
        { id: 'worker-b', harness: 'claude', model: 'opus', iterations: 2 },
      ],
    })
  );
  await writeFile(
    path.join(runDirectory, 'cycles', 'worker-a-1.json'),
    JSON.stringify({
      'worker-id': 'worker-a',
      cycle: 1,
      outcome: 'merged',
      timestamp: '2026-01-01T00:01:00.000Z',
    })
  );

  const snapshot = readLatestSwarmRuntime(projectRoot, {
    isProcessAlive: (pid) => pid === 123,
    now: () => Date.parse('2026-01-01T00:02:00.000Z'),
  });

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.run?.swarmId, 'swarm-1');
  assert.equal(snapshot.run?.isRunning, true);
  assert.equal(snapshot.run?.activeWorkers, 2);
  assert.deepEqual(
    snapshot.run?.workers.map((worker) => [worker.id, worker.status]),
    [
      ['worker-a', 'running'],
      ['worker-b', 'running'],
    ]
  );
});

test('stopped event is authoritative over a still-live pid', async (context) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'unleashd-swarm-stopped-'));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));
  const runDirectory = path.join(projectRoot, 'runs', 'run-2');
  await mkdir(runDirectory, { recursive: true });
  await writeFile(
    path.join(runDirectory, 'started.json'),
    JSON.stringify({
      'swarm-id': 'swarm-2',
      'started-at': '2026-01-01T00:00:00.000Z',
      pid: 456,
      workers: [{ id: 'worker-a', harness: 'codex', model: 'gpt-5.6-sol', iterations: 1 }],
    })
  );
  await writeFile(
    path.join(runDirectory, 'stopped.json'),
    JSON.stringify({
      'swarm-id': 'swarm-2',
      'stopped-at': '2026-01-01T00:03:00.000Z',
      reason: 'completed',
    })
  );

  const snapshot = readLatestSwarmRuntime(projectRoot, {
    isProcessAlive: () => true,
    now: () => Date.parse('2026-01-01T00:04:00.000Z'),
  });

  assert.equal(snapshot.run?.isRunning, false);
  assert.equal(snapshot.run?.doneWorkers, 1);
  assert.equal(snapshot.run?.workers[0]?.status, 'done');
});
