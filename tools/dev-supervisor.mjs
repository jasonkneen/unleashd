#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  constants,
  closeSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE_REPLACE_TIMEOUT_MS = 2_000;
const POLL_INTERVAL_MS = 100;
const REPLACE_EXIT_MARGIN_MS = 5_000;
const DEFAULT_HOT_RELOAD_FORCE_EXIT_GRACE_MS = 3_000;
export function resolveDefaultReplaceTimeoutMs(environment = process.env) {
  const readPositiveInteger = (name, fallback) => {
    const value = Number.parseInt(environment[name] ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return (
    readPositiveInteger(
      'CWV_HOT_RELOAD_FORCE_EXIT_GRACE_MS',
      DEFAULT_HOT_RELOAD_FORCE_EXIT_GRACE_MS
    ) + REPLACE_EXIT_MARGIN_MS
  );
}
const DEFAULT_REPLACE_TIMEOUT_MS = resolveDefaultReplaceTimeoutMs();
const SUPERVISOR_TASKS = new Set(['build', 'dev', 'dev-client', 'dev-server', 'typecheck']);
const DEV_PORTS_BY_TASK = {
  dev: [7489, 7499],
  'dev-client': [7489],
  'dev-server': [7499],
};

export const DEV_LOCK_FILENAME = 'dev-supervisor.lock.json';
export const DEV_BOOT_FILENAME = 'dev-supervisor.boot.json';

export class DuplicateDevRuntimeError extends Error {
  constructor(owner, inspection) {
    const started = owner.startedAt ? ` since ${owner.startedAt}` : '';
    super(
      `Unleashd task "${owner.task ?? 'dev'}" is already owned by PID ${owner.pid} in ${owner.cwd}${started} ` +
        `(${inspection.reason}). Use "pnpm dev:replace" only to intentionally replace a dev runtime.`
    );
    this.name = 'DuplicateDevRuntimeError';
    this.owner = owner;
    this.inspection = inspection;
  }
}

export function parseSupervisorArgs(argv) {
  const separator = argv.indexOf('--');
  const supervisorArgs = separator === -1 ? argv : argv.slice(0, separator);
  const command = separator === -1 ? [] : argv.slice(separator + 1);
  let replace = false;
  let skipBootstrap = false;
  let task = 'dev';
  let dataDirectory;
  let replaceTimeoutMs = DEFAULT_REPLACE_TIMEOUT_MS;

  for (let index = 0; index < supervisorArgs.length; index += 1) {
    const argument = supervisorArgs[index];
    if (argument === '--replace') {
      replace = true;
      continue;
    }
    if (argument === '--skip-bootstrap') {
      skipBootstrap = true;
      continue;
    }
    if (argument === '--task') {
      task = supervisorArgs[index + 1];
      index += 1;
      if (!SUPERVISOR_TASKS.has(task)) {
        throw new Error(`--task must be one of: ${Array.from(SUPERVISOR_TASKS).join(', ')}`);
      }
      continue;
    }
    if (argument === '--data-dir') {
      dataDirectory = supervisorArgs[index + 1];
      index += 1;
      if (!dataDirectory) throw new Error('--data-dir requires a path');
      continue;
    }
    if (argument.startsWith('--replace-timeout=')) {
      replaceTimeoutMs = Number.parseInt(argument.slice('--replace-timeout='.length), 10);
      if (!Number.isFinite(replaceTimeoutMs) || replaceTimeoutMs < 0) {
        throw new Error('--replace-timeout must be a non-negative integer');
      }
      continue;
    }
    throw new Error(`Unknown dev supervisor option: ${argument}`);
  }

  if (separator !== -1 && command.length === 0) {
    throw new Error('Expected a command after --');
  }
  if (command.length > 0) task = 'custom';
  if (replace && !task.startsWith('dev')) {
    throw new Error('--replace is only valid for dev, dev-server, or dev-client tasks');
  }
  if (skipBootstrap && !task.startsWith('dev') && task !== 'custom') {
    throw new Error('--skip-bootstrap is only valid for dev tasks or a custom command');
  }

  return { replace, skipBootstrap, task, dataDirectory, replaceTimeoutMs, command };
}

export function resolveSupervisorPaths(dataDirectory) {
  const resolvedDataDirectory = path.resolve(
    dataDirectory ?? process.env.UNLEASHD_DATA_DIR ?? path.join(os.homedir(), '.agent-viewer')
  );
  return {
    dataDirectory: resolvedDataDirectory,
    lockPath: path.join(resolvedDataDirectory, DEV_LOCK_FILENAME),
    bootPath: path.join(resolvedDataDirectory, DEV_BOOT_FILENAME),
  };
}

export function isProcessAlive(pid, kill = process.kill) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function isProcessGroupAlive(
  childPgid,
  { platform = process.platform, processAlive = isProcessAlive, kill = process.kill } = {}
) {
  if (!Number.isSafeInteger(childPgid) || childPgid <= 0) return false;
  if (platform === 'win32') return processAlive(childPgid);
  try {
    kill(-childPgid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function readProcessWorkingDirectory(
  pid,
  {
    platform = process.platform,
    currentPid = process.pid,
    currentWorkingDirectory = process.cwd(),
    readlink = readlinkSync,
    run = spawnSync,
  } = {}
) {
  if (pid === currentPid) return path.resolve(currentWorkingDirectory);

  if (platform === 'linux') {
    try {
      return path.resolve(readlink(`/proc/${pid}/cwd`));
    } catch {
      return null;
    }
  }

  if (platform === 'darwin') {
    const result = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0) return null;
    const cwdLine = result.stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith('n') && line.length > 1);
    return cwdLine ? path.resolve(cwdLine.slice(1)) : null;
  }

  return null;
}

export function inspectSupervisorOwner(
  owner,
  { processAlive = isProcessAlive, processWorkingDirectory = readProcessWorkingDirectory } = {}
) {
  if (
    !owner ||
    owner.schemaVersion !== 1 ||
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 0 ||
    typeof owner.cwd !== 'string' ||
    owner.cwd.length === 0 ||
    typeof owner.bootId !== 'string' ||
    owner.bootId.length === 0
  ) {
    return { active: false, verified: false, reason: 'invalid lock metadata' };
  }
  if (!processAlive(owner.pid)) {
    return { active: false, verified: true, reason: 'owner PID is not running' };
  }

  const observedCwd = processWorkingDirectory(owner.pid);
  if (observedCwd === null) {
    return {
      active: true,
      verified: false,
      reason: 'owner PID is running; cwd could not be inspected',
    };
  }
  if (path.resolve(observedCwd) !== path.resolve(owner.cwd)) {
    return {
      active: false,
      verified: true,
      reason: `PID cwd changed to ${observedCwd}`,
    };
  }
  return { active: true, verified: true, reason: 'PID and cwd match' };
}

export function signalProcessGroup(
  childPid,
  signal,
  { platform = process.platform, kill = process.kill, run = spawnSync } = {}
) {
  if (!Number.isSafeInteger(childPid) || childPid <= 0) return false;
  try {
    if (platform === 'win32') {
      const arguments_ = ['/PID', String(childPid), '/T'];
      if (signal === 'SIGKILL') arguments_.push('/F');
      return run('taskkill', arguments_, { stdio: 'ignore' }).status === 0;
    }
    kill(-childPid, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

function probePortAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}

function listenerPidsFromSystem(port, run) {
  const lsof = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (lsof.status === 0) {
    return Array.from(
      new Set(
        lsof.stdout
          .split(/\s+/)
          .map((value) => Number.parseInt(value, 10))
          .filter((pid) => Number.isSafeInteger(pid) && pid > 0)
      )
    );
  }

  if (process.platform === 'linux' && lsof.error?.code === 'ENOENT') {
    const sockets = run('ss', ['-ltnp', `sport = :${port}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (sockets.status === 0) {
      return Array.from(
        new Set(Array.from(sockets.stdout.matchAll(/pid=(\d+)/g), (match) => Number(match[1])))
      );
    }
  }
  return [];
}

export async function findOccupiedDevPorts(
  ports,
  { run = spawnSync, portAvailable = probePortAvailable } = {}
) {
  const occupied = [];
  for (const port of ports) {
    const pids = listenerPidsFromSystem(port, run);
    if (pids.length > 0 || !(await portAvailable(port))) {
      occupied.push({ port, pids });
    }
  }
  return occupied;
}

export async function assertDevPortsAvailable(task, { findOccupied = findOccupiedDevPorts } = {}) {
  const ports = DEV_PORTS_BY_TASK[task];
  if (!ports) return;
  const occupied = await findOccupied(ports);
  if (occupied.length === 0) return;

  const details = occupied
    .map(
      ({ port, pids }) =>
        `port ${port} (${pids.length > 0 ? `PID ${pids.join(', ')}` : 'PID unknown'})`
    )
    .join(', ');
  const inspectionCommands = occupied
    .map(({ port }) => `lsof -nP -iTCP:${port} -sTCP:LISTEN`)
    .join(' ; ');
  throw new Error(
    `Cannot start ${task}: ${details} already listening without a supervisor lock. This is likely a legacy or unmanaged dev runtime. Inspect it with: ${inspectionCommands}. Stop the verified process explicitly, then retry; no process was signaled.`
  );
}

function writeJsonDurably(targetPath, value) {
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const descriptor = openSync(
    temporaryPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600
  );
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporaryPath, targetPath);
  fsyncParentDirectory(targetPath);
}

function createJsonExclusively(targetPath, value) {
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.claim`;
  const descriptor = openSync(
    temporaryPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600
  );
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }

  try {
    linkSync(temporaryPath, targetPath);
    fsyncParentDirectory(targetPath);
  } finally {
    unlinkSync(temporaryPath);
  }
}

function fsyncParentDirectory(targetPath) {
  let descriptor;
  try {
    descriptor = openSync(path.dirname(targetPath), constants.O_RDONLY);
    fsyncSync(descriptor);
  } catch {
    // Some filesystems do not support fsync on directories. The file itself
    // was still synced before its atomic link/rename.
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readLock(lockPath) {
  try {
    const raw = readFileSync(lockPath, 'utf8');
    return { raw, owner: JSON.parse(raw) };
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) {
      return { raw: readFileSync(lockPath, 'utf8'), owner: null };
    }
    throw error;
  }
}

function removeLockIfUnchanged(lockPath, expectedRaw) {
  try {
    if (readFileSync(lockPath, 'utf8') !== expectedRaw) return false;
    unlinkSync(lockPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw error;
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function stopExistingOwner(owner, timeoutMs, dependencies) {
  const stopped = () =>
    !dependencies.processAlive(owner.pid) &&
    (!owner.childPgid || !dependencies.processGroupAlive(owner.childPgid));

  try {
    dependencies.kill(owner.pid, 'SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  const gracefulDeadline = Date.now() + timeoutMs;
  while (Date.now() < gracefulDeadline) {
    if (stopped()) return;
    await dependencies.wait(POLL_INTERVAL_MS);
  }

  if (owner.childPgid) {
    dependencies.signalGroup(owner.childPgid, 'SIGKILL');
  }
  try {
    dependencies.kill(owner.pid, 'SIGKILL');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }

  const forceDeadline = Date.now() + FORCE_REPLACE_TIMEOUT_MS;
  for (;;) {
    if (stopped()) return;
    if (Date.now() >= forceDeadline) break;
    await dependencies.wait(POLL_INTERVAL_MS);
  }
  const childGroup = owner.childPgid ? ` or child process group ${owner.childPgid}` : '';
  throw new Error(`Could not replace dev supervisor PID ${owner.pid}${childGroup}`);
}

export async function acquireSupervisorLease({
  dataDirectory,
  cwd = repositoryRoot,
  task = 'dev',
  replace = false,
  replaceTimeoutMs = DEFAULT_REPLACE_TIMEOUT_MS,
  pid = process.pid,
  now = () => new Date(),
  inspectOwner = inspectSupervisorOwner,
  processAlive = isProcessAlive,
  processGroupAlive = isProcessGroupAlive,
  kill = process.kill,
  signalGroup = signalProcessGroup,
  wait = sleep,
} = {}) {
  const paths = resolveSupervisorPaths(dataDirectory);
  mkdirSync(paths.dataDirectory, { recursive: true, mode: 0o700 });
  const bootId = randomUUID();
  const startedAt = now().toISOString();
  const initialMetadata = {
    schemaVersion: 1,
    bootId,
    pid,
    cwd: path.resolve(cwd),
    task,
    startedAt,
    updatedAt: startedAt,
    phase: 'starting',
    childPid: null,
    childPgid: null,
    command: null,
  };

  for (;;) {
    try {
      createJsonExclusively(paths.lockPath, initialMetadata);
      writeJsonDurably(paths.bootPath, initialMetadata);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }

    const existing = readLock(paths.lockPath);
    if (!existing) continue;
    const inspection = inspectOwner(existing.owner);
    if (!inspection.active) {
      removeLockIfUnchanged(paths.lockPath, existing.raw);
      continue;
    }
    if (!replace) throw new DuplicateDevRuntimeError(existing.owner, inspection);
    if (!(existing.owner.task ?? 'dev').startsWith('dev')) {
      throw new Error(
        `Refusing to replace active task "${existing.owner.task}" owned by PID ${existing.owner.pid}; wait for it to finish.`
      );
    }
    if (!inspection.verified) {
      throw new Error(
        `Refusing to replace PID ${existing.owner.pid}: ${inspection.reason}. Remove the lock manually only after verifying the process identity.`
      );
    }

    await stopExistingOwner(existing.owner, replaceTimeoutMs, {
      processAlive,
      processGroupAlive,
      kill,
      signalGroup,
      wait,
    });
    removeLockIfUnchanged(paths.lockPath, existing.raw);
  }

  let metadata = initialMetadata;
  let released = false;
  return {
    paths,
    bootId,
    get metadata() {
      return metadata;
    },
    update(update) {
      if (released) throw new Error('Cannot update a released dev supervisor lease');
      metadata = {
        ...metadata,
        ...update,
        bootId,
        pid,
        cwd: path.resolve(cwd),
        updatedAt: now().toISOString(),
      };
      writeJsonDurably(paths.lockPath, metadata);
      writeJsonDurably(paths.bootPath, metadata);
    },
    release(update = {}) {
      if (released) return;
      metadata = {
        ...metadata,
        ...update,
        bootId,
        pid,
        cwd: path.resolve(cwd),
        updatedAt: now().toISOString(),
      };
      writeJsonDurably(paths.bootPath, metadata);
      const current = readLock(paths.lockPath);
      if (current?.owner?.bootId === bootId) {
        unlinkSync(paths.lockPath);
      }
      released = true;
    },
  };
}

function resolvePnpmCommand(arguments_) {
  const npmExecutable = process.env.npm_execpath;
  if (npmExecutable?.includes('pnpm')) {
    return { command: process.execPath, arguments: [npmExecutable, ...arguments_] };
  }
  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    arguments: arguments_,
  };
}

function resolveConcurrentlyCommand() {
  const packageRoot = path.dirname(require.resolve('concurrently/package.json'));
  return {
    command: process.execPath,
    arguments: [
      path.join(packageRoot, 'dist', 'bin', 'concurrently.js'),
      '--kill-others-on-fail',
      '-n',
      'shared-esm,shared-cjs,cli,server,client',
      '-c',
      'yellow,yellow,magenta,blue,green',
      'pnpm --filter @unleashd/shared watch:esm',
      'pnpm --filter @unleashd/shared watch:cjs',
      'pnpm --dir vendor/agent-cli-tool watch',
      'node tools/watch-server.mjs',
      'pnpm --filter @unleashd/client exec vite',
    ],
    environment: { NODE_ENV: 'development' },
  };
}

export function createExecutionPhases(options) {
  if (options.command.length > 0) {
    return [
      {
        name: 'custom',
        specification: { command: options.command[0], arguments: options.command.slice(1) },
      },
    ];
  }

  const sharedBuild = {
    name: 'build-shared',
    specification: resolvePnpmCommand(['--filter', '@unleashd/shared', 'build']),
  };
  const agentCliBuild = {
    name: 'build-agent-cli',
    specification: resolvePnpmCommand(['--dir', 'vendor/agent-cli-tool', 'build']),
  };

  switch (options.task) {
    case 'build':
      return [
        sharedBuild,
        agentCliBuild,
        {
          name: 'build-server',
          specification: resolvePnpmCommand(['--filter', '@unleashd/server', 'build']),
        },
        {
          name: 'build-client',
          specification: resolvePnpmCommand(['--filter', '@unleashd/client', 'build']),
        },
      ];
    case 'typecheck':
      return [
        sharedBuild,
        {
          name: 'typecheck-server',
          specification: resolvePnpmCommand(['--filter', '@unleashd/server', 'typecheck']),
        },
        {
          name: 'typecheck-client',
          specification: resolvePnpmCommand(['--filter', '@unleashd/client', 'exec', 'tsc', '-b']),
        },
        {
          name: 'typecheck-agent-cli',
          specification: resolvePnpmCommand(['--dir', 'vendor/agent-cli-tool', 'typecheck']),
        },
      ];
    case 'dev-server':
      return [
        ...(options.skipBootstrap ? [] : [sharedBuild, agentCliBuild]),
        {
          name: 'running-server',
          specification: {
            command: process.execPath,
            arguments: [path.join(repositoryRoot, 'tools', 'watch-server.mjs')],
            environment: { NODE_ENV: 'development' },
          },
        },
      ];
    case 'dev-client':
      return [
        ...(options.skipBootstrap ? [] : [sharedBuild]),
        {
          name: 'running-client',
          specification: resolvePnpmCommand(['--filter', '@unleashd/client', 'exec', 'vite']),
        },
      ];
    case 'dev':
      return [
        ...(options.skipBootstrap ? [] : [sharedBuild, agentCliBuild]),
        { name: 'running', specification: resolveConcurrentlyCommand() },
      ];
    default:
      throw new Error(`Unsupported supervisor task: ${options.task}`);
  }
}

function spawnManagedChild(specification, cwd) {
  return spawn(specification.command, specification.arguments, {
    cwd,
    detached: process.platform !== 'win32',
    stdio: 'inherit',
    env: { ...process.env, ...specification.environment },
  });
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

function signalExitCode(signal) {
  const signalNumbers = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
  return 128 + (signalNumbers[signal] ?? 1);
}

export async function runSupervisor(options) {
  const lease = await acquireSupervisorLease({
    dataDirectory: options.dataDirectory,
    cwd: repositoryRoot,
    task: options.task,
    replace: options.replace,
    replaceTimeoutMs: options.replaceTimeoutMs,
  });
  let activeChild = null;
  let forwardedSignal = null;

  const forwardSignal = (signal) => {
    if (forwardedSignal && activeChild?.pid) {
      signalProcessGroup(activeChild.pid, 'SIGKILL');
      return;
    }
    forwardedSignal = signal;
    if (activeChild?.pid) signalProcessGroup(activeChild.pid, signal);
  };
  const signalHandlers = new Map(
    ['SIGHUP', 'SIGINT', 'SIGTERM'].map((signal) => [signal, () => forwardSignal(signal)])
  );
  for (const [signal, handler] of signalHandlers) process.on(signal, handler);

  try {
    await assertDevPortsAvailable(options.task);
    for (const phase of createExecutionPhases(options)) {
      if (forwardedSignal) break;
      activeChild = spawnManagedChild(phase.specification, repositoryRoot);
      lease.update({
        phase: phase.name,
        childPid: activeChild.pid ?? null,
        childPgid: activeChild.pid ?? null,
        command: [phase.specification.command, ...phase.specification.arguments],
      });
      const result = await waitForChild(activeChild);
      activeChild = null;
      if (result.code !== 0 || result.signal) {
        const exitCode =
          result.code ?? (result.signal ? signalExitCode(result.signal) : (process.exitCode ?? 1));
        lease.release({
          phase: forwardedSignal ? 'stopped' : 'failed',
          endedAt: new Date().toISOString(),
          exitCode,
          signal: forwardedSignal ?? result.signal,
          childPid: null,
          childPgid: null,
        });
        process.exitCode = forwardedSignal ? signalExitCode(forwardedSignal) : exitCode;
        return;
      }
    }

    lease.release({
      phase: 'stopped',
      endedAt: new Date().toISOString(),
      exitCode: forwardedSignal ? signalExitCode(forwardedSignal) : 0,
      signal: forwardedSignal,
      childPid: null,
      childPgid: null,
    });
    process.exitCode = forwardedSignal ? signalExitCode(forwardedSignal) : 0;
  } catch (error) {
    if (activeChild?.pid) signalProcessGroup(activeChild.pid, 'SIGTERM');
    lease.release({
      phase: 'failed',
      endedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      childPid: null,
      childPgid: null,
    });
    throw error;
  } finally {
    for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await runSupervisor(parseSupervisorArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`[dev-supervisor] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
