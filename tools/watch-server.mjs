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
 *
 * Resilience to transient build failures (2026-08-06):
 * `node --import tsx src/server.ts` does an esbuild transform on startup.
 * A typo (e.g. `jsonl.ts:13:42 Expected ";" but found "is"`) makes that
 * transform fail and the child exits 1 in <1s. Previously the `exit` handler
 * treated every non-zero exit as fatal (`stopping=true`, `process.exitCode=1`),
 * and `dev-supervisor`'s `concurrently --kill-others-on-fail` then SIGTERM'd
 * shared-esm/shared-cjs/cli/client — requiring `pnpm dev:replace` for every
 * typo. That is inconsistent with vite HMR for the client, which overlays the
 * error and recovers on the next save. See the quick-exit guard in
 * `child.once('exit', ...)` below for the recovery heuristic and its tradeoff.
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
let childStartMs = 0;
let stopping = false;
let reloadPending = false;
let reloadTimer = null;
let fatalError = false;
let pollInFlight = false;
let snapshot = await takeSnapshot();
let waitingForArtifacts = false;
let backendDownRetryTimer = null;
let backendDownReminderTimer = null;
let failWatcherConsecutive = 0;
let lastStderr = '';
const STDERR_RING_LIMIT = 8192;

function failWatcher(error) {
  // Poll/snapshot errors are transient (e.g. transient FS race during a save).
  // Previously this killed the entire dev runtime via `concurrently --kill-others-on-fail`,
  // requiring `pnpm dev:replace` for what should be a retryable tick.
  // Now we log and schedule a retry, keeping the poll loop alive — consistent
  // with the quick-exit recovery above and with vite HMR.
  // Only `stop()` / SIGINT/SIGTERM set `stopping`; this handler never does.
  failWatcherConsecutive += 1;
  if (failWatcherConsecutive >= 20) {
    console.error(
      `[server-watch] Transient watcher error persisted for ${failWatcherConsecutive} attempts — escalating to fatal:`,
      error
    );
    stopping = true;
    fatalError = true;
    clearInterval(pollTimer);
    if (reloadTimer) clearTimeout(reloadTimer);
    if (backendDownRetryTimer) clearTimeout(backendDownRetryTimer);
    if (backendDownReminderTimer) clearInterval(backendDownReminderTimer);
    if (child?.exitCode === null) {
      child.kill('SIGTERM');
      return;
    }
    process.exitCode = 1;
    return;
  }
  const backoffMs = Math.min(5000, POLL_INTERVAL_MS * 2 ** (failWatcherConsecutive - 1));
  console.error(
    `[server-watch] Transient watcher error (attempt ${failWatcherConsecutive}/20, retry in ${backoffMs}ms):`,
    error
  );
  if (reloadTimer) clearTimeout(reloadTimer);
  // Don't clear pollTimer, don't set fatalError, don't kill child.
  // Backoff prevents 3.3Hz spew on persistent EACCES; poll will self-heal.
  scheduleReload(backoffMs);
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
  childStartMs = Date.now();
  lastStderr = '';
  // A successful spawn resets the transient-error counters and clears any
  // backend-down reminders from a prior quick failure.
  failWatcherConsecutive = 0;
  if (backendDownRetryTimer) {
    clearTimeout(backendDownRetryTimer);
    backendDownRetryTimer = null;
  }
  if (backendDownReminderTimer) {
    clearInterval(backendDownReminderTimer);
    backendDownReminderTimer = null;
  }
  child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: serverRoot,
    env: { ...process.env, NODE_ENV: 'development' },
    // Pipe stderr so we can classify Transform failures (B-minus). Tee to parent so logs are still visible.
    stdio: ['inherit', 'inherit', 'pipe', 'ipc'],
  });
  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      lastStderr = (lastStderr + chunk.toString()).slice(-STDERR_RING_LIMIT);
    });
  }
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
    // --- Transient build failure recovery (B-minus: stderr classification) ---
    // Why: `tsx` transforms the server on every fresh `node --import tsx` spawn.
    // A syntax typo causes an immediate `Transform failed ...` and exit 1.
    // Killing the watcher here would cascade via `concurrently --kill-others-on-fail`
    // and require a manual `pnpm dev:replace` for every typo (the 2026-08-06 incident).
    // So we keep the poll loop alive and retry on the next file change, matching vite HMR.
    //
    // Classification: B-minus pipes stderr (tee'd to parent) into a ring buffer and
    // matches `Transform failed` / `ERROR: Expected` as the primary signal. Uptime
    // <3s is kept only as a fallback for crashes that don't emit that string.
    // This avoids the false premise that `tsc` never emits bad dist and distinguishes
    // env crashes (EADDRINUSE) that also happen quickly but don't match Transform.
    const uptimeMs = Date.now() - childStartMs;
    const isTransformFailure =
      /Transform failed/i.test(lastStderr) || /ERROR:\s+Expected/i.test(lastStderr);
    const isQuickBuildFailure =
      !signal && code !== 0 && code !== null && (isTransformFailure || uptimeMs < 3000);
    if (isQuickBuildFailure) {
      const reason = isTransformFailure ? 'Transform failure' : `quick exit after ${uptimeMs}ms`;
      console.error(
        `[server-watch] Backend failed to start (exit ${code}, ${reason}) — likely a syntax/type error. Waiting for file change to retry...`
      );
      // Intentionally do NOT set stopping/fatalError, do NOT clear pollTimer, do NOT set exitCode.
      // `poll()` will call `startServer()` again when `snapshot` changes.
      // HIGH finding: an environmental quick crash (e.g. EADDRINUSE on 7499 via
      // handleStartupFailure) also looks like a build failure and would otherwise
      // leave the backend silently DOWN with no file change to trigger a retry.
      // Schedule one delayed retry and a periodic reminder so the failure is visible.
      if (!backendDownRetryTimer) {
        backendDownRetryTimer = setTimeout(() => {
          backendDownRetryTimer = null;
          if (!stopping && !child) {
            console.log('[server-watch] Retrying backend after quick failure...');
            void startServer().catch(failWatcher);
          }
        }, 5000);
      }
      if (!backendDownReminderTimer) {
        backendDownReminderTimer = setInterval(() => {
          if (!stopping && !child) {
            console.error(
              `[server-watch] Backend is DOWN (last exit ${code} after ${uptimeMs}ms) — fix the error or touch a server file to retry`
            );
          } else {
            clearInterval(backendDownReminderTimer);
            backendDownReminderTimer = null;
          }
        }, 30000);
      }
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
  if (snapshotsMatch(snapshot, nextSnapshot)) {
    // Successful poll — reset transient-error backoff.
    failWatcherConsecutive = 0;
    return;
  }
  snapshot = nextSnapshot;
  // Successful snapshot — reset backoff.
  failWatcherConsecutive = 0;

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
  if (backendDownRetryTimer) clearTimeout(backendDownRetryTimer);
  if (backendDownReminderTimer) clearInterval(backendDownReminderTimer);
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
