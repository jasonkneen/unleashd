#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.join(repositoryRoot, 'server');
const watchedRoots = [
  path.join(serverRoot, 'src'),
  path.join(repositoryRoot, 'shared', 'dist'),
  path.join(repositoryRoot, 'vendor', 'agent-cli-tool', 'dist'),
];
const POLL_INTERVAL_MS = 300;
const RELOAD_MESSAGE = 'unleashd:dev-reload';

/**
 * Backend reload deliberately differs from process shutdown:
 *
 * - source changes send one IPC reload request and are then coalesced;
 * - the current server remains the sole owner of every active provider stream;
 * - the replacement starts only after those turns finish and the server exits.
 *
 * This avoids orphaning a detached CLI or losing its final events while still
 * giving idle backend edits a normal fast reload.
 */
async function snapshotDirectory(directory, snapshot) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await snapshotDirectory(absolutePath, snapshot);
        return;
      }
      if (!entry.isFile()) return;
      const metadata = await stat(absolutePath);
      snapshot.set(absolutePath, `${metadata.mtimeMs}:${metadata.size}`);
    })
  );
}

async function takeSnapshot() {
  const snapshot = new Map();
  await Promise.all(watchedRoots.map((root) => snapshotDirectory(root, snapshot)));
  return snapshot;
}

function snapshotsMatch(left, right) {
  if (left.size !== right.size) return false;
  for (const [file, signature] of left) {
    if (right.get(file) !== signature) return false;
  }
  return true;
}

let child = null;
let stopping = false;
let reloadPending = false;
let snapshot = await takeSnapshot();

function startServer() {
  reloadPending = false;
  child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: serverRoot,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });
  child.once('exit', (code, signal) => {
    child = null;
    if (stopping) {
      clearInterval(pollTimer);
      process.exitCode = signal ? 1 : (code ?? 0);
      return;
    }
    if (reloadPending) {
      console.log('[server-watch] Active turns finished; starting the updated backend');
      startServer();
      return;
    }
    console.warn(
      `[server-watch] Backend exited${signal ? ` from ${signal}` : ` with code ${code ?? 1}`}; waiting for a source change`
    );
  });
}

async function poll() {
  const nextSnapshot = await takeSnapshot();
  if (snapshotsMatch(snapshot, nextSnapshot)) return;
  snapshot = nextSnapshot;

  if (!child) {
    console.log('[server-watch] Source changed; starting backend');
    startServer();
    return;
  }
  if (reloadPending) return;

  reloadPending = true;
  console.log('[server-watch] Backend change detected; reload queued after active turns complete');
  try {
    child.send({ type: RELOAD_MESSAGE });
  } catch (error) {
    console.error('[server-watch] Could not queue backend reload:', error);
  }
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (child?.exitCode === null) {
    child.kill(signal);
    return;
  }
  clearInterval(pollTimer);
  process.exitCode = 0;
}

const pollTimer = setInterval(() => {
  void poll().catch((error) => {
    console.error('[server-watch] Failed to inspect source changes:', error);
  });
}, POLL_INTERVAL_MS);

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

startServer();
