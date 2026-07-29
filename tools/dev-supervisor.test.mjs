import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEV_BOOT_FILENAME,
  DEV_LOCK_FILENAME,
  DuplicateDevRuntimeError,
  acquireSupervisorLease,
  assertDevPortsAvailable,
  createExecutionPhases,
  findOccupiedDevPorts,
  inspectSupervisorOwner,
  isProcessGroupAlive,
  parseSupervisorArgs,
  resolveDefaultReplaceTimeoutMs,
  signalProcessGroup,
} from './dev-supervisor.mjs';

function temporaryDirectory(context) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'unleashd-dev-supervisor-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('argument parser requires explicit replace mode and preserves custom commands', () => {
  assert.deepEqual(
    parseSupervisorArgs(['--skip-bootstrap', '--replace-timeout=250', '--', 'node', 'fixture.mjs']),
    {
      replace: false,
      skipBootstrap: true,
      task: 'custom',
      dataDirectory: undefined,
      replaceTimeoutMs: 250,
      command: ['node', 'fixture.mjs'],
    }
  );
  assert.equal(parseSupervisorArgs(['--replace']).task, 'dev');
  assert.throws(
    () => parseSupervisorArgs(['--task', 'build', '--replace']),
    /--replace is only valid for dev/
  );
  assert.throws(() => parseSupervisorArgs(['--unknown']), /Unknown dev supervisor option/);
});

test('default replacement window includes the server force-exit grace period', () => {
  assert.equal(
    resolveDefaultReplaceTimeoutMs({
      CWV_HOT_RELOAD_FORCE_EXIT_GRACE_MS: '300',
    }),
    5300
  );
});

test('execution plans keep destructive and partial-dev work behind the supervisor', () => {
  assert.deepEqual(
    createExecutionPhases({
      task: 'build',
      skipBootstrap: false,
      command: [],
    }).map((phase) => phase.name),
    ['build-shared', 'build-agent-cli', 'build-server', 'build-client']
  );
  assert.deepEqual(
    createExecutionPhases({
      task: 'typecheck',
      skipBootstrap: false,
      command: [],
    }).map((phase) => phase.name),
    ['build-shared', 'typecheck-server', 'typecheck-client', 'typecheck-agent-cli']
  );
  assert.deepEqual(
    createExecutionPhases({
      task: 'dev-server',
      skipBootstrap: false,
      command: [],
    }).map((phase) => phase.name),
    ['build-shared', 'build-agent-cli', 'running-server']
  );
  const devEnvironment = createExecutionPhases({
    task: 'dev',
    skipBootstrap: true,
    command: [],
    localDomainEnabled: true,
  })[0].specification.environment;
  assert.equal(devEnvironment.UNLEASHD_LOCAL_DOMAIN_ENABLED, '1');
});

test('owner inspection validates both PID liveness and cwd identity', () => {
  const owner = {
    schemaVersion: 1,
    bootId: 'boot-1',
    pid: 123,
    cwd: '/workspace/unleashd',
  };
  assert.deepEqual(
    inspectSupervisorOwner(owner, {
      processAlive: () => true,
      processWorkingDirectory: () => '/workspace/unleashd',
    }),
    { active: true, verified: true, reason: 'PID and cwd match' }
  );
  assert.equal(
    inspectSupervisorOwner(owner, {
      processAlive: () => true,
      processWorkingDirectory: () => '/workspace/another-repository',
    }).active,
    false
  );
  assert.equal(
    inspectSupervisorOwner(owner, {
      processAlive: () => false,
      processWorkingDirectory: () => owner.cwd,
    }).active,
    false
  );
});

test('unmanaged listener detection reports occupied ports and listener PIDs', async () => {
  const occupied = await findOccupiedDevPorts([7489, 7499], {
    run: (_command, arguments_) => ({
      status: arguments_.some((argument) => argument === '-iTCP:7489') ? 0 : 1,
      stdout: '123\n456\n123\n',
    }),
    portAvailable: async (port) => port !== 7499,
  });
  assert.deepEqual(occupied, [
    { port: 7489, pids: [123, 456] },
    { port: 7499, pids: [] },
  ]);

  await assert.rejects(
    assertDevPortsAvailable('dev', {
      findOccupied: async () => occupied,
    }),
    /port 7489 \(PID 123, 456\).*port 7499 \(PID unknown\).*no process was signaled/
  );
});

test('maintenance tasks do not inspect or act on dev ports', async () => {
  let calls = 0;
  await assertDevPortsAvailable('build', {
    findOccupied: async () => {
      calls += 1;
      return [{ port: 7489, pids: [123] }];
    },
  });
  assert.equal(calls, 0);
});

test('lease refuses a verified duplicate and cleans a stale lock', async (context) => {
  const dataDirectory = temporaryDirectory(context);
  const staleOwner = {
    schemaVersion: 1,
    bootId: 'stale-boot',
    pid: 999_999,
    cwd: '/stale/repository',
    startedAt: '2026-01-01T00:00:00.000Z',
  };
  writeFileSync(
    path.join(dataDirectory, DEV_LOCK_FILENAME),
    `${JSON.stringify(staleOwner)}\n`,
    'utf8'
  );

  const lease = await acquireSupervisorLease({
    dataDirectory,
    cwd: '/workspace/current',
    task: 'dev',
    inspectOwner: () => ({ active: false, verified: true, reason: 'stale fixture' }),
  });
  const activeOwner = JSON.parse(readFileSync(path.join(dataDirectory, DEV_LOCK_FILENAME), 'utf8'));
  assert.equal(activeOwner.bootId, lease.bootId);

  await assert.rejects(
    acquireSupervisorLease({
      dataDirectory,
      cwd: '/workspace/current',
      task: 'build',
      inspectOwner: () => ({ active: true, verified: true, reason: 'fixture is active' }),
    }),
    DuplicateDevRuntimeError
  );
  lease.release({ phase: 'stopped' });
  const durableBoot = JSON.parse(readFileSync(path.join(dataDirectory, DEV_BOOT_FILENAME), 'utf8'));
  assert.equal(durableBoot.phase, 'stopped');
  assert.equal(durableBoot.bootId, lease.bootId);
});

test('root scripts do not expose destructive or partial-dev bypasses', () => {
  const packageJson = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
  );
  for (const script of ['build', 'typecheck', 'dev:server', 'dev:client']) {
    assert.match(packageJson.scripts[script], /^node tools\/dev-supervisor\.mjs --task /);
  }
  for (const workspace of ['client', 'server']) {
    const workspacePackage = JSON.parse(
      readFileSync(fileURLToPath(new URL(`../${workspace}/package.json`, import.meta.url)), 'utf8')
    );
    assert.match(
      workspacePackage.scripts.dev,
      new RegExp(`^node \\.\\./tools/dev-supervisor\\.mjs --task dev-${workspace}$`)
    );
  }
});

test('replace mode signals a verified owner before acquiring the lock', async (context) => {
  const dataDirectory = temporaryDirectory(context);
  const lockPath = path.join(dataDirectory, DEV_LOCK_FILENAME);
  const previousOwner = {
    schemaVersion: 1,
    bootId: 'previous-boot',
    pid: 456,
    cwd: '/workspace/previous',
    startedAt: '2026-01-01T00:00:00.000Z',
  };
  writeFileSync(lockPath, `${JSON.stringify(previousOwner)}\n`, 'utf8');
  const signals = [];
  let alive = true;

  const lease = await acquireSupervisorLease({
    dataDirectory,
    cwd: '/workspace/current',
    replace: true,
    inspectOwner: () => ({ active: true, verified: true, reason: 'fixture is active' }),
    processAlive: () => alive,
    kill: (pid, signal) => {
      signals.push([pid, signal]);
      alive = false;
    },
    wait: async () => undefined,
  });

  assert.deepEqual(signals, [[456, 'SIGTERM']]);
  assert.notEqual(lease.bootId, previousOwner.bootId);
  lease.release({ phase: 'stopped' });
});

test('replace mode waits for the recorded child process group to disappear', async (context) => {
  const dataDirectory = temporaryDirectory(context);
  const lockPath = path.join(dataDirectory, DEV_LOCK_FILENAME);
  const previousOwner = {
    schemaVersion: 1,
    bootId: 'previous-boot',
    pid: 456,
    childPgid: 789,
    cwd: '/workspace/previous',
    task: 'dev',
    startedAt: '2026-01-01T00:00:00.000Z',
  };
  writeFileSync(lockPath, `${JSON.stringify(previousOwner)}\n`, 'utf8');
  const signals = [];
  let ownerAlive = true;
  let childGroupAlive = true;

  const lease = await acquireSupervisorLease({
    dataDirectory,
    cwd: '/workspace/current',
    replace: true,
    replaceTimeoutMs: 0,
    inspectOwner: () => ({ active: true, verified: true, reason: 'fixture is active' }),
    processAlive: () => ownerAlive,
    processGroupAlive: () => childGroupAlive,
    kill: (pid, signal) => {
      signals.push(['process', pid, signal]);
      ownerAlive = false;
    },
    signalGroup: (pgid, signal) => {
      signals.push(['group', pgid, signal]);
      childGroupAlive = false;
    },
    wait: async () => undefined,
  });

  assert.deepEqual(signals, [
    ['process', 456, 'SIGTERM'],
    ['group', 789, 'SIGKILL'],
    ['process', 456, 'SIGKILL'],
  ]);
  assert.notEqual(lease.bootId, previousOwner.bootId);
  lease.release({ phase: 'stopped' });
});

test('replace mode never terminates a protected maintenance task', async (context) => {
  const dataDirectory = temporaryDirectory(context);
  const previousOwner = {
    schemaVersion: 1,
    bootId: 'build-boot',
    pid: 456,
    cwd: '/workspace/previous',
    task: 'build',
    startedAt: '2026-01-01T00:00:00.000Z',
  };
  writeFileSync(
    path.join(dataDirectory, DEV_LOCK_FILENAME),
    `${JSON.stringify(previousOwner)}\n`,
    'utf8'
  );
  let signalCalls = 0;

  await assert.rejects(
    acquireSupervisorLease({
      dataDirectory,
      cwd: '/workspace/current',
      task: 'dev',
      replace: true,
      inspectOwner: () => ({ active: true, verified: true, reason: 'fixture is active' }),
      kill: () => {
        signalCalls += 1;
      },
    }),
    /Refusing to replace active task "build"/
  );
  assert.equal(signalCalls, 0);
});

test('POSIX child signaling targets the entire process group', () => {
  const calls = [];
  assert.equal(
    signalProcessGroup(321, 'SIGTERM', {
      platform: 'darwin',
      kill: (pid, signal) => calls.push([pid, signal]),
    }),
    true
  );
  assert.deepEqual(calls, [[-321, 'SIGTERM']]);
});

test('POSIX process-group liveness probes the negative process-group id', () => {
  const calls = [];
  assert.equal(
    isProcessGroupAlive(321, {
      platform: 'darwin',
      kill: (pid, signal) => calls.push([pid, signal]),
    }),
    true
  );
  assert.deepEqual(calls, [[-321, 0]]);
});

test('supervisor subprocess removes its lock and preserves boot metadata', (context) => {
  const dataDirectory = temporaryDirectory(context);
  const supervisorPath = fileURLToPath(new URL('./dev-supervisor.mjs', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      supervisorPath,
      '--data-dir',
      dataDirectory,
      '--skip-bootstrap',
      '--',
      process.execPath,
      '-e',
      'process.exit(0)',
    ],
    // Full validation runs this process test beside TypeScript builds and the
    // server integration suite. Leave enough room for a busy local machine;
    // the child itself still exits immediately.
    { encoding: 'utf8', timeout: 20_000 }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.throws(
    () => readFileSync(path.join(dataDirectory, DEV_LOCK_FILENAME), 'utf8'),
    (error) => error.code === 'ENOENT'
  );
  const durableBoot = JSON.parse(readFileSync(path.join(dataDirectory, DEV_BOOT_FILENAME), 'utf8'));
  assert.equal(durableBoot.phase, 'stopped');
  assert.equal(durableBoot.exitCode, 0);
  assert.equal(durableBoot.childPid, null);
  assert.equal(durableBoot.task, 'custom');
  assert.equal(typeof durableBoot.startedAt, 'string');
  assert.equal(typeof durableBoot.endedAt, 'string');
});
