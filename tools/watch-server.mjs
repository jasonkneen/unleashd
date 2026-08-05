#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingRuntimeArtifacts } from './watch-runtime-readiness.mjs';
import { snapshotDirectory } from './watch-snapshot.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.join(repositoryRoot, 'server');
const serverSourceRoot = path.join(serverRoot, 'src');
const watchedRoots = [
  serverSourceRoot,
  path.join(repositoryRoot, 'shared', 'dist'),
  path.join(repositoryRoot, 'vendor', 'agent-cli-tool', 'dist'),
];
const requiredRuntimeArtifacts = [
  path.join(repositoryRoot, 'shared', 'dist', 'index.js'),
  path.join(repositoryRoot, 'shared', 'dist', 'cjs', 'index.js'),
  path.join(repositoryRoot, 'shared', 'dist', 'cjs', 'package.json'),
  path.join(repositoryRoot, 'vendor', 'agent-cli-tool', 'dist', 'index.js'),
  path.join(repositoryRoot, 'vendor', 'agent-cli-tool', 'dist', 'package.json'),
];
const POLL_INTERVAL_MS = 300;
const RELOAD_SETTLE_MS = 600;
const RELOAD_MESSAGE = 'unleashd:dev-reload';
const RUNTIME_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.json']);

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
function isRuntimeRelevant(file) {
  if (file.startsWith(`${serverSourceRoot}${path.sep}`)) return true;
  return RUNTIME_EXTENSIONS.has(path.extname(file));
}

async function takeSnapshot(previousSnapshot = new Map()) {
  const snapshot = new Map();
  await Promise.all(
    watchedRoots.map((root) =>
      snapshotDirectory(root, snapshot, previousSnapshot, isRuntimeRelevant)
    )
  );
  return snapshot;
}

function snapshotsMatch(left, right) {
  if (left.size !== right.size) return false;
  for (const [file, fingerprint] of left) {
    if (right.get(file)?.digest !== fingerprint.digest) return false;
  }
  return true;
}

let child = null;
let stopping = false;
let reloadPending = false;
let reloadTimer = null;
let fatalError = false;
let pollInFlight = false;
let snapshot = await takeSnapshot();
let waitingForArtifacts = false;

function failWatcher(error) {
  console.error('[server-watch] Could not queue backend reload; stopping dev runtime:', error);
  stopping = true;
  fatalError = true;
  clearInterval(pollTimer);
  if (reloadTimer) clearTimeout(reloadTimer);
  if (child?.exitCode === null) {
    child.kill('SIGTERM');
    return;
  }
  process.exitCode = 1;
}

function scheduleReload(delayMs = RELOAD_SETTLE_MS) {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    void queueReload().catch(failWatcher);
  }, delayMs);
}

async function startServer() {
  const missing = await missingRuntimeArtifacts(requiredRuntimeArtifacts);
  if (missing.length > 0) {
    if (!waitingForArtifacts) {
      console.log(
        `[server-watch] Waiting for ${missing.length} runtime artifact(s) before starting backend`
      );
      waitingForArtifacts = true;
    }
    reloadPending = true;
    scheduleReload(POLL_INTERVAL_MS);
    return;
  }
  if (waitingForArtifacts) {
    console.log('[server-watch] Runtime artifacts restored; starting backend');
    waitingForArtifacts = false;
  }
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
      process.exitCode = fatalError || signal ? 1 : (code ?? 0);
      return;
    }
    if (reloadPending) {
      console.log('[server-watch] Active turns finished; starting the updated backend');
      void startServer().catch(failWatcher);
      return;
    }
    stopping = true;
    clearInterval(pollTimer);
    console.error(
      `[server-watch] Backend exited unexpectedly${
        signal ? ` from ${signal}` : ` with code ${code ?? 1}`
      }; stopping dev runtime`
    );
    process.exitCode = code && code > 0 ? code : 1;
  });
}

async function poll() {
  const nextSnapshot = await takeSnapshot(snapshot);
  if (snapshotsMatch(snapshot, nextSnapshot)) return;
  snapshot = nextSnapshot;

  if (reloadPending) return;
  scheduleReload();
}

async function queueReload() {
  reloadTimer = null;
  const missing = await missingRuntimeArtifacts(requiredRuntimeArtifacts);
  if (missing.length > 0) {
    if (!waitingForArtifacts) {
      console.log(
        `[server-watch] Deferring backend reload until ${missing.length} runtime artifact(s) are rebuilt`
      );
      waitingForArtifacts = true;
    }
    scheduleReload(POLL_INTERVAL_MS);
    return;
  }
  if (waitingForArtifacts) {
    console.log('[server-watch] Runtime artifacts restored; backend reload may proceed');
    waitingForArtifacts = false;
  }
  if (!child) {
    console.log('[server-watch] Source changed; starting backend');
    await startServer();
    return;
  }

  reloadPending = true;
  console.log('[server-watch] Backend change detected; reload queued after active turns complete');
  try {
    child.send({ type: RELOAD_MESSAGE }, (error) => {
      if (error) failWatcher(error);
    });
  } catch (error) {
    failWatcher(error);
  }
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (reloadTimer) clearTimeout(reloadTimer);
  if (child?.exitCode === null) {
    child.kill(signal);
    return;
  }
  clearInterval(pollTimer);
  process.exitCode = 0;
}

const pollTimer = setInterval(() => {
  // Hashing can take longer than one interval on a busy checkout. One poll at
  // a time keeps snapshots ordered and guarantees a change queues at most one
  // reload request.
  if (pollInFlight) return;
  pollInFlight = true;
  void poll()
    .catch(failWatcher)
    .finally(() => {
      pollInFlight = false;
    });
}, POLL_INTERVAL_MS);

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

void startServer().catch(failWatcher);
