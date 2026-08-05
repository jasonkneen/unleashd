import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { snapshotDirectory } from './watch-snapshot.mjs';

const fileEntry = (name) => ({ name, isDirectory: () => false, isFile: () => true });

test('snapshot tolerates a dist file disappearing between readdir and stat', async () => {
  const root = path.resolve('/fixture/dist');
  const snapshot = new Map();
  await snapshotDirectory(root, snapshot, new Map(), () => true, {
    readdir: async () => [fileEntry('removed.js'), fileEntry('stable.js')],
    stat: async (file) => {
      if (file.endsWith('removed.js')) {
        throw Object.assign(new Error('removed during rebuild'), { code: 'ENOENT' });
      }
      return { mtimeMs: 1, size: 6 };
    },
    readFile: async () => Buffer.from('stable'),
  });

  assert.deepEqual([...snapshot.keys()], [path.join(root, 'stable.js')]);
});

test('snapshot tolerates replacement after stat but preserves real errors', async () => {
  const root = path.resolve('/fixture/dist');
  const disappearingIo = {
    readdir: async () => [fileEntry('removed.js')],
    stat: async () => ({ mtimeMs: 1, size: 6 }),
    readFile: async () => {
      throw Object.assign(new Error('removed during digest'), { code: 'ENOENT' });
    },
  };
  const snapshot = new Map();
  await snapshotDirectory(root, snapshot, new Map(), () => true, disappearingIo);
  assert.equal(snapshot.size, 0);

  await assert.rejects(
    snapshotDirectory(root, new Map(), new Map(), () => true, {
      ...disappearingIo,
      stat: async () => {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      },
    }),
    /permission denied/
  );
});
