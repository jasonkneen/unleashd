import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { DiskAdapter, ParsedSession } from '../src/adapters/disk-adapter';
import { loadAllConversations } from '../src/adapters/loader';

function parsedSession(filePath: string): ParsedSession {
  const now = new Date();
  return {
    sessionId: path.basename(filePath),
    filePath,
    workingDirectory: '/tmp/project',
    provider: 'claude',
    model: 'unknown',
    createdAt: now,
    modifiedAt: now,
    messages: [{ role: 'user', content: 'hello' }],
  };
}

test('startup limit hydrates only the requested files but baselines every discovered source', async (t) => {
  const fixtureDir = await fs.mkdtemp(path.join(tmpdir(), 'unleashd-loader-'));
  t.after(() => fs.rm(fixtureDir, { recursive: true, force: true }));
  const files = await Promise.all(
    ['one.jsonl', 'two.jsonl', 'three.jsonl'].map(async (name, index) => {
      const filePath = path.join(fixtureDir, name);
      await fs.writeFile(filePath, 'x'.repeat(index + 1));
      return filePath;
    })
  );
  let parseCalls = 0;
  const adapter: DiskAdapter = {
    provider: 'claude',
    discoverFiles: async () => files,
    parseFile: async (filePath) => {
      parseCalls += 1;
      return parsedSession(filePath);
    },
  };

  const result = await loadAllConversations({ adapters: [adapter], limit: 1 });

  assert.equal(parseCalls, 1);
  assert.equal(result.conversations.size, 1);
  assert.equal(result.mtimes.size, 3);
  for (const filePath of files) assert.equal(result.mtimes.has(filePath), true);
});

test('startup parser respects the aggregate in-flight source byte budget', async (t) => {
  const fixtureDir = await fs.mkdtemp(path.join(tmpdir(), 'unleashd-loader-budget-'));
  t.after(() => fs.rm(fixtureDir, { recursive: true, force: true }));
  const files = await Promise.all(
    ['one.jsonl', 'two.jsonl', 'three.jsonl'].map(async (name) => {
      const filePath = path.join(fixtureDir, name);
      await fs.writeFile(filePath, '1234');
      return filePath;
    })
  );
  let activeParsers = 0;
  let maxActiveParsers = 0;
  const adapter: DiskAdapter = {
    provider: 'claude',
    discoverFiles: async () => files,
    parseFile: async (filePath) => {
      activeParsers += 1;
      maxActiveParsers = Math.max(maxActiveParsers, activeParsers);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeParsers -= 1;
      return parsedSession(filePath);
    },
  };

  await loadAllConversations({
    adapters: [adapter],
    concurrency: 3,
    maxInFlightParseBytes: 5,
  });

  assert.equal(maxActiveParsers, 1);
});
