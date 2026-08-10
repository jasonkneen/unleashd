#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
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
export const POLL_INTERVAL_MS = 300;
export const RELOAD_SETTLE_MS = 600;
export const RELOAD_MESSAGE = 'unleashd:dev-reload';
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
 * `child.once('close', ...)` below for the recovery heuristic and its tradeoff.
 */
export function isRuntimeRelevant(file) {
  if (file.startsWith(`${serverSourceRoot}${path.sep}`)) return true;
  return RUNTIME_EXTENSIONS.has(path.extname(file));
}

export function snapshotsMatch(left, right) {
  if (left.size !== right.size) return false;
  for (const [file, fingerprint] of left) {
    if (right.get(file)?.digest !== fingerprint.digest) return false;
  }
  return true;
}

export function createWatchServer(overrides = {}) {
  const spawnFn = overrides.spawn ?? spawn;
  const snapshotDirectoryFn = overrides.snapshotDirectory ?? snapshotDirectory;
  const missingRuntimeArtifactsFn = overrides.missingRuntimeArtifacts ?? missingRuntimeArtifacts;
  const nowFn = overrides.now ?? Date.now;
  const setTimeoutFn = overrides.setTimeout ?? setTimeout;
  const clearTimeoutFn = overrides.clearTimeout ?? clearTimeout;
  const setIntervalFn = overrides.setInterval ?? setInterval;
  const clearIntervalFn = overrides.clearInterval ?? clearInterval;
  const proc = overrides.process ?? process;
  const consoleLog = overrides.consoleLog ?? console.log.bind(console);
  const consoleError = overrides.consoleError ?? console.error.bind(console);
  const stderrWrite = overrides.stderrWrite ?? ((chunk) => proc.stderr?.write?.(chunk) ?? process.stderr.write(chunk));
  const watchedRootsOverride = overrides.watchedRoots ?? watchedRoots;
  const requiredRuntimeArtifactsOverride = overrides.requiredRuntimeArtifacts ?? requiredRuntimeArtifacts;
  const pollIntervalMs = overrides.pollIntervalMs ?? POLL_INTERVAL_MS;
  const reloadSettleMs = overrides.reloadSettleMs ?? RELOAD_SETTLE_MS;
  const backendDownRetryDelayMs = overrides.backendDownRetryDelayMs ?? 5000;
  const backendDownReminderIntervalMs = overrides.backendDownReminderIntervalMs ?? 30000;

  let child = null;
  let childStartMs = 0;
  let stopping = false;
  let reloadPending = false;
  let reloadTimer = null;
  let fatalError = false;
  let pollInFlight = false;
  let snapshot = new Map();
  let waitingForArtifacts = false;
  let backendDownRetryTimer = null;
  let backendDownReminderTimer = null;
  let backendDownRetryCount = 0;
  // Whether the last quick failure was an esbuild Transform error (a source typo)
  // rather than a runtime/env error (EADDRINUSE, bad config). Transform errors are
  // self-healing — the developer fixes the file — so they must NOT consume the
  // 3-strike escalation budget, which exists for failures that never recover.
  let lastQuickFailureWasTransform = false;
  let failWatcherConsecutive = 0;
  let lastStderr = '';
  const STDERR_RING_LIMIT = 32768;
  let pollTimer = null;
  let sigintHandler = null;
  let sigtermHandler = null;

  // --- Option D: Pre-flight esbuild transform check (2026-08-06) ---
  // Before spawning `node --import tsx`, run a no-emit esbuild transform check on
  // server/src. On Transform failure, skip spawn, keep old healthy child running,
  // log with vite-like overlay semantics, and retry on next file change.
  // Composes with B-minus stderr classification; preserves drain guarantee
  // (wait-for-exit-then-spawn) — check runs BEFORE sending IPC reload, so the
  // old child stays alive. See `queueReload` and `startServer` below.
  let cachedEsbuild = overrides.esbuild !== undefined ? overrides.esbuild : undefined;
  let esbuildTried = false;
  let esbuildResolveWarningShown = false;
  const readFileFn = overrides.readFile ?? readFile;
  const readdirFn = overrides.readdir ?? readdir;
  const serverSourceRootOverride = overrides.serverSourceRoot ?? serverSourceRoot;
  const repositoryRootOverride = overrides.repositoryRoot ?? repositoryRoot;
  const preflightTransformCheckFn = overrides.preflightTransformCheck;

  function getEsbuild() {
    if (cachedEsbuild !== undefined) return cachedEsbuild;
    if (esbuildTried) return cachedEsbuild;
    esbuildTried = true;
    try {
      const require = createRequire(import.meta.url);
      try {
        cachedEsbuild = require('esbuild');
        return cachedEsbuild;
      } catch {}
      const tsxPath = require.resolve('tsx');
      const tsxRequire = createRequire(tsxPath);
      cachedEsbuild = tsxRequire('esbuild');
      return cachedEsbuild;
    } catch (e) {
      if (!esbuildResolveWarningShown) {
        consoleError(`[server-watch] Pre-flight check unavailable (esbuild not resolved): ${e.message}`);
        esbuildResolveWarningShown = true;
      }
      cachedEsbuild = null;
      return null;
    }
  }

  async function collectTsFiles(dir, out) {
    const entries = await readdirFn(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectTsFiles(absolutePath, out);
      } else if (entry.isFile() && /\.(ts|mts|cts|tsx)$/.test(entry.name)) {
        out.push(absolutePath);
      }
    }
  }

  async function preflightTransformCheck() {
    if (preflightTransformCheckFn) return preflightTransformCheckFn();
    const esbuild = getEsbuild();
    if (!esbuild) return { ok: true };
    const files = [];
    try {
      await collectTsFiles(serverSourceRootOverride, files);
    } catch {
      return { ok: true };
    }
    const errors = [];
    await Promise.all(
      files.map(async (file) => {
        let content;
        try {
          content = await readFileFn(file, 'utf8');
        } catch (e) {
          if (e?.code === 'ENOENT') return;
          return;
        }
        const loader = file.endsWith('.tsx') ? 'tsx' : 'ts';
        const rel = path.relative(repositoryRootOverride, file);
        try {
          await esbuild.transform(content, {
            loader,
            sourcemap: false,
            sourcefile: rel,
            target: 'esnext',
            format: 'cjs',
          });
        } catch (e) {
          let formatted;
          try {
            if (e.errors) {
              formatted = (await esbuild.formatMessages(e.errors, { kind: 'error', color: false })).join('\n');
            }
          } catch {}
          const message = (formatted && formatted.trim()) || e.message || String(e);
          const withPrefix = /Transform failed/i.test(message) ? message : `Transform failed: ${message}`;
          errors.push({ file, message: withPrefix });
        }
      })
    );
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true };
  }

  function logPreflightErrors(errors) {
    consoleError('');
    consoleError('[server-watch] ──────────────────────────────────────────────────');
    consoleError('[server-watch] Pre-flight transform check failed — keeping previous backend alive');
    for (const { file, message } of errors) {
      const rel = path.relative(repositoryRootOverride, file);
      consoleError(`[server-watch] ${rel}:`);
      for (const line of message.split('\n')) {
        consoleError(`[server-watch]   ${line}`);
      }
    }
    consoleError('[server-watch] Fix the error and save to retry (vite-like overlay)');
    consoleError('[server-watch] ──────────────────────────────────────────────────');
    consoleError('');
  }

  async function takeSnapshot(previousSnapshot = new Map()) {
    const next = new Map();
    await Promise.all(
      watchedRootsOverride.map((root) =>
        snapshotDirectoryFn(root, next, previousSnapshot, isRuntimeRelevant)
      )
    );
    return next;
  }

  function failWatcher(error) {
    failWatcherConsecutive += 1;
    if (failWatcherConsecutive >= 20) {
      consoleError(
        `[server-watch] Transient watcher error persisted for ${failWatcherConsecutive} attempts — escalating to fatal:`,
        error
      );
      stopping = true;
      fatalError = true;
      if (pollTimer !== null) {
        clearIntervalFn(pollTimer);
        pollTimer = null;
      }
      if (reloadTimer) clearTimeoutFn(reloadTimer);
      if (backendDownRetryTimer) clearTimeoutFn(backendDownRetryTimer);
      if (backendDownReminderTimer) clearIntervalFn(backendDownReminderTimer);
      if (child?.exitCode === null) {
        child.kill('SIGTERM');
        return;
      }
      proc.exitCode = 1;
      return;
    }
    const backoffMs = Math.min(5000, pollIntervalMs * 2 ** (failWatcherConsecutive - 1));
    consoleError(
      `[server-watch] Transient watcher error (attempt ${failWatcherConsecutive}/20, retry in ${backoffMs}ms):`,
      error
    );
    if (reloadTimer) clearTimeoutFn(reloadTimer);
    scheduleReload(backoffMs);
  }

  function scheduleReload(delayMs = reloadSettleMs) {
    if (reloadTimer) clearTimeoutFn(reloadTimer);
    reloadTimer = setTimeoutFn(() => {
      void queueReload().catch(failWatcher);
    }, delayMs);
  }

  async function startServer() {
    const missing = await missingRuntimeArtifactsFn(requiredRuntimeArtifactsOverride);
    if (missing.length > 0) {
      if (!waitingForArtifacts) {
        consoleLog(
          `[server-watch] Waiting for ${missing.length} runtime artifact(s) before starting backend`
        );
        waitingForArtifacts = true;
      }
      reloadPending = true;
      scheduleReload(pollIntervalMs);
      return;
    }
    if (waitingForArtifacts) {
      consoleLog('[server-watch] Runtime artifacts restored; starting backend');
      waitingForArtifacts = false;
    }
    // Option D: pre-flight check before spawn. If transform fails, skip spawn,
    // keep poll loop alive, and wait for next file change to retry. This
    // composes with B-minus (which handles runtime failures after spawn).
    const preflight = await preflightTransformCheck();
    if (!preflight.ok) {
      logPreflightErrors(preflight.errors);
      consoleError('[server-watch] Pre-flight failed — waiting for file change to retry');
      return;
    }
    reloadPending = false;
    childStartMs = nowFn();
    lastStderr = '';
    failWatcherConsecutive = 0;
    // NOTE: do NOT reset backendDownRetryCount unconditionally here. startServer()
    // is also the body of the backend-down retry timer, so zeroing the budget on
    // every spawn made the "3 quick failures then escalate to fatal" guard
    // unreachable — an EADDRINUSE port retried forever (the exact bug c7040ee
    // meant to fix). The budget counts consecutive *unrecoverable* quick failures;
    // it is cleared by a source-typo retry (below) or a real file change (poll()).
    if (lastQuickFailureWasTransform) {
      lastQuickFailureWasTransform = false;
      backendDownRetryCount = 0;
    }
    if (backendDownRetryTimer) {
      clearTimeoutFn(backendDownRetryTimer);
      backendDownRetryTimer = null;
    }
    if (backendDownReminderTimer) {
      clearIntervalFn(backendDownReminderTimer);
      backendDownReminderTimer = null;
    }
    child = spawnFn(proc.execPath ?? process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      cwd: serverRoot,
      env: { ...proc.env, NODE_ENV: 'development' },
      stdio: ['inherit', 'inherit', 'pipe', 'ipc'],
    });
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderrWrite(chunk);
        lastStderr = (lastStderr + chunk.toString()).slice(-STDERR_RING_LIMIT);
      });
    }
    child.once('close', (code, signal) => {
      child = null;
      if (stopping) {
        if (pollTimer !== null) {
          clearIntervalFn(pollTimer);
          pollTimer = null;
        }
        proc.exitCode = fatalError || signal ? 1 : (code ?? 0);
        return;
      }
      if (reloadPending) {
        consoleLog('[server-watch] Active turns finished; starting the updated backend');
        void startServer().catch(failWatcher);
        return;
      }
      const uptimeMs = nowFn() - childStartMs;
      const isTransformFailure =
        /Transform failed/i.test(lastStderr) || /ERROR:\s+Expected/i.test(lastStderr);
      const isQuickBuildFailure =
        !signal && code !== 0 && code !== null && (isTransformFailure || uptimeMs < 3000);
      if (isQuickBuildFailure) {
        lastQuickFailureWasTransform = isTransformFailure;
        const reason = isTransformFailure ? 'Transform failure' : `quick exit after ${uptimeMs}ms`;
        consoleError(
          `[server-watch] Backend failed to start (exit ${code}, ${reason}) — likely a syntax/type error. Waiting for file change to retry...`
        );
        if (backendDownRetryCount >= 3) {
          consoleError(
            `[server-watch] Backend quick-failed ${backendDownRetryCount} times (last exit ${code}) — escalating to fatal. Fix the port/env error and use pnpm dev:replace`
          );
          if (backendDownReminderTimer) {
            clearIntervalFn(backendDownReminderTimer);
            backendDownReminderTimer = null;
          }
          stopping = true;
          if (pollTimer !== null) {
            clearIntervalFn(pollTimer);
            pollTimer = null;
          }
          proc.exitCode = 1;
          return;
        }
        if (!backendDownRetryTimer) {
          backendDownRetryCount += 1;
          backendDownRetryTimer = setTimeoutFn(() => {
            backendDownRetryTimer = null;
            if (!stopping && !child) {
              consoleLog(
                `[server-watch] Retrying backend after quick failure (attempt ${backendDownRetryCount}/3)...`
              );
              void startServer().catch(failWatcher);
            }
          }, backendDownRetryDelayMs);
        }
        if (!backendDownReminderTimer) {
          backendDownReminderTimer = setIntervalFn(() => {
            if (!stopping && !child) {
              consoleError(
                `[server-watch] Backend is DOWN (last exit ${code} after ${uptimeMs}ms) — fix the error or touch a server file to retry`
              );
            } else {
              clearIntervalFn(backendDownReminderTimer);
              backendDownReminderTimer = null;
            }
          }, backendDownReminderIntervalMs);
        }
        return;
      }
      stopping = true;
      if (pollTimer !== null) {
        clearIntervalFn(pollTimer);
        pollTimer = null;
      }
      consoleError(
        `[server-watch] Backend exited unexpectedly${
          signal ? ` from ${signal}` : ` with code ${code ?? 1}`
        }; stopping dev runtime`
      );
      proc.exitCode = code && code > 0 ? code : 1;
    });
  }

  async function poll() {
    if (failWatcherConsecutive > 0 && reloadTimer) return;
    const nextSnapshot = await takeSnapshot(snapshot);
    if (snapshotsMatch(snapshot, nextSnapshot)) {
      failWatcherConsecutive = 0;
      return;
    }
    snapshot = nextSnapshot;
    failWatcherConsecutive = 0;
    // A real source change means the developer is actively fixing the failure:
    // give the backend a fresh quick-failure budget and drop the stale DOWN
    // reminder so it can't log after the file is already fixed. The retry timer
    // is intentionally left alone — it will spawn, or the reload will.
    if (backendDownRetryCount > 0 || backendDownReminderTimer) {
      backendDownRetryCount = 0;
      if (backendDownReminderTimer) {
        clearIntervalFn(backendDownReminderTimer);
        backendDownReminderTimer = null;
      }
    }
    if (reloadPending) return;
    scheduleReload();
  }

  async function queueReload() {
    reloadTimer = null;
    const missing = await missingRuntimeArtifactsFn(requiredRuntimeArtifactsOverride);
    if (missing.length > 0) {
      if (!waitingForArtifacts) {
        consoleLog(
          `[server-watch] Deferring backend reload until ${missing.length} runtime artifact(s) are rebuilt`
        );
        waitingForArtifacts = true;
      }
      scheduleReload(pollIntervalMs);
      return;
    }
    if (waitingForArtifacts) {
      consoleLog('[server-watch] Runtime artifacts restored; backend reload may proceed');
      waitingForArtifacts = false;
    }
    if (!child) {
      consoleLog('[server-watch] Source changed; starting backend');
      await startServer();
      return;
    }
    // Option D: pre-flight check BEFORE draining. On Transform failure, keep
    // the old healthy child running and wait for next file change. This
    // preserves the drain guarantee (wait-for-exit-then-spawn) — we never
    // send the reload IPC if the new code would fail to transform.
    const preflight = await preflightTransformCheck();
    if (!preflight.ok) {
      logPreflightErrors(preflight.errors);
      consoleError('[server-watch] Pre-flight failed — keeping previous backend alive; fix and save to retry');
      return;
    }
    reloadPending = true;
    consoleLog('[server-watch] Backend change detected; reload queued after active turns complete');
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
    if (reloadTimer) {
      clearTimeoutFn(reloadTimer);
      reloadTimer = null;
    }
    if (backendDownRetryTimer) {
      clearTimeoutFn(backendDownRetryTimer);
      backendDownRetryTimer = null;
    }
    if (backendDownReminderTimer) {
      clearIntervalFn(backendDownReminderTimer);
      backendDownReminderTimer = null;
    }
    if (child?.exitCode === null) {
      child.kill(signal);
      return;
    }
    if (pollTimer !== null) {
      clearIntervalFn(pollTimer);
      pollTimer = null;
    }
    proc.exitCode = 0;
  }

  async function start() {
    snapshot = await takeSnapshot();
    // set up poll timer
    pollTimer = setIntervalFn(() => {
      if (pollInFlight) return;
      pollInFlight = true;
      void poll()
        .catch(failWatcher)
        .finally(() => {
          pollInFlight = false;
        });
    }, pollIntervalMs);
    sigintHandler = () => stop('SIGINT');
    sigtermHandler = () => stop('SIGTERM');
    // support both real process and fake EventEmitter for tests
    if (proc.on) {
      proc.on('SIGINT', sigintHandler);
      proc.on('SIGTERM', sigtermHandler);
    }
    await startServer().catch(failWatcher);
  }

  function destroy() {
    if (pollTimer !== null) {
      clearIntervalFn(pollTimer);
      pollTimer = null;
    }
    if (reloadTimer) {
      clearTimeoutFn(reloadTimer);
      reloadTimer = null;
    }
    if (backendDownRetryTimer) {
      clearTimeoutFn(backendDownRetryTimer);
      backendDownRetryTimer = null;
    }
    if (backendDownReminderTimer) {
      clearIntervalFn(backendDownReminderTimer);
      backendDownReminderTimer = null;
    }
    if (sigintHandler && proc.off) {
      proc.off('SIGINT', sigintHandler);
      proc.off('SIGTERM', sigtermHandler);
    } else if (sigintHandler && proc.removeListener) {
      proc.removeListener('SIGINT', sigintHandler);
      proc.removeListener('SIGTERM', sigtermHandler);
    }
    reloadTimer = null;
    backendDownRetryTimer = null;
    backendDownReminderTimer = null;
  }

  return {
    start,
    startServer,
    poll,
    queueReload,
    failWatcher,
    scheduleReload,
    stop,
    destroy,
    preflightTransformCheck,
    logPreflightErrors,
    getEsbuild,
    getState: () => ({
      child,
      childStartMs,
      stopping,
      reloadPending,
      reloadTimer,
      fatalError,
      pollInFlight,
      snapshot,
      waitingForArtifacts,
      backendDownRetryTimer,
      backendDownReminderTimer,
      backendDownRetryCount,
      failWatcherConsecutive,
      lastStderr,
      pollTimer,
    }),
    setSnapshot: (next) => { snapshot = next; },
    getSnapshot: () => snapshot,
    _internals: {
      takeSnapshot,
      collectTsFiles,
      preflightTransformCheck,
      logPreflightErrors,
      getEsbuild,
    },
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const server = createWatchServer();
  void server.start().catch((error) => {
    console.error('[server-watch] Failed to start:', error);
    process.exitCode = 1;
  });
}
