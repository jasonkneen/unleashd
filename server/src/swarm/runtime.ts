import fs from 'node:fs';
import path from 'node:path';
import type {
  OompaCycle,
  OompaRuntimeSnapshot,
  OompaStarted,
  OompaStopped,
  OompaWorkerStatus,
} from '@unleashd/shared';

export interface SwarmRuntimeDependencies {
  isProcessAlive(pid: number): boolean;
  now(): number;
}

export interface SwarmRunDirectory {
  id: string;
  path: string;
  mtimeMs: number;
}

const DEFAULT_DEPENDENCIES: SwarmRuntimeDependencies = {
  isProcessAlive,
  now: Date.now,
};

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readLatestRunDirectory(runsDirectory: string): SwarmRunDirectory | null {
  try {
    const entries = fs
      .readdirSync(runsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const runPath = path.join(runsDirectory, entry.name);
        return {
          id: entry.name,
          path: runPath,
          mtimeMs: fs.statSync(runPath).mtimeMs,
        };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);
    return entries[0] ?? null;
  } catch {
    return null;
  }
}

export function isTerminalWorkerStatus(status: OompaWorkerStatus): boolean {
  return status === 'done' || status === 'error';
}

export function normalizeWorkerStatus(rawStatus: unknown): OompaWorkerStatus {
  if (typeof rawStatus !== 'string') return 'starting';
  const status = rawStatus.toLowerCase();
  if (status === 'done' || status === 'completed' || status === 'exhausted') return 'done';
  if (status === 'idle') return 'idle';
  if (status === 'error' || status === 'failed' || status === 'fatal') return 'error';
  if (
    [
      'working',
      'running',
      'merged',
      'rejected',
      'no-changes',
      'executor-done',
      'claimed',
      'sync-failed',
      'merge-failed',
    ].includes(status)
  ) {
    return 'running';
  }
  return 'starting';
}

export function readCycleFiles(directory: string): OompaCycle[] {
  try {
    return fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .flatMap((file) => {
        try {
          return [JSON.parse(fs.readFileSync(path.join(directory, file), 'utf-8')) as OompaCycle];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export function readLatestSwarmRuntime(
  projectRoot: string,
  dependencies: SwarmRuntimeDependencies = DEFAULT_DEPENDENCIES
): OompaRuntimeSnapshot {
  const runsDirectory = path.join(projectRoot, 'runs');
  if (!fs.existsSync(runsDirectory)) {
    return { available: false, run: null, reason: 'No runs directory found' };
  }

  const latestRun = readLatestRunDirectory(runsDirectory);
  if (!latestRun) {
    return { available: false, run: null, reason: 'No run directories found' };
  }

  const started = (safeReadJson(path.join(latestRun.path, 'started.json')) ??
    safeReadJson(path.join(latestRun.path, 'run.json')) ??
    {}) as Partial<OompaStarted>;
  const stopped = safeReadJson(path.join(latestRun.path, 'stopped.json')) as OompaStopped | null;
  const cyclesDirectory = path.join(latestRun.path, 'cycles');
  const iterationsDirectory = path.join(latestRun.path, 'iterations');
  const eventDirectory = fs.existsSync(cyclesDirectory)
    ? cyclesDirectory
    : fs.existsSync(iterationsDirectory)
      ? iterationsDirectory
      : null;
  const cycles = eventDirectory ? readCycleFiles(eventDirectory) : [];

  const configuredWorkers = (started.workers ?? [])
    .map((worker) => worker.id)
    .filter((id): id is string => Boolean(id));
  const latestCycleByWorker = new Map<string, OompaCycle>();
  for (const cycle of cycles) {
    const workerId = cycle['worker-id'];
    if (!workerId) continue;
    const existing = latestCycleByWorker.get(workerId);
    if (!existing || cycleNumber(cycle) > cycleNumber(existing)) {
      latestCycleByWorker.set(workerId, cycle);
    }
  }

  const workerIds = new Set([...configuredWorkers, ...latestCycleByWorker.keys()]);
  const isStopped = stopped !== null;
  const pid = started.pid;
  const isLive =
    !isStopped &&
    ((typeof pid === 'number' && dependencies.isProcessAlive(pid)) ||
      isLegacyOompaProcessAlive(projectRoot, dependencies));
  const startedAt = Date.parse(String(started['started-at'] ?? ''));
  const runAge = dependencies.now() - startedAt;

  const workersStateDirectory = path.join(latestRun.path, 'workers');
  const workers = Array.from(workerIds)
    .map((id) => {
      const cycle = latestCycleByWorker.get(id);
      // Oompa (since 2026-08-07) writes runs/<id>/workers/<worker>.json at every
      // cycle start and at worker terminal exit. This is the liveness authority:
      // cycle files are only written at cycle END, so deriving status from the
      // latest cycle rendered a mid-cycle worker as dead/red for the whole cycle.
      const state = safeReadJson(path.join(workersStateDirectory, `${id}.json`));
      let status: OompaWorkerStatus;
      let lastEvent: string;
      if (state && typeof state.status === 'string') {
        if (state.status === 'running' && isLive) {
          status = 'running';
          lastEvent = cycle
            ? `Cycle ${state.cycle ?? '?'} in progress (cycle ${cycleNumber(cycle) || '?'}: ${cycle.outcome ?? 'unknown'})`
            : `Cycle ${state.cycle ?? '?'} in progress`;
        } else if (state.status === 'stopped') {
          status = normalizeWorkerStatus(String(state.reason ?? 'done'));
          lastEvent = `Stopped after cycle ${state.cycle ?? '?'}: ${state.reason ?? 'unknown'}`;
        } else {
          // state says running but the swarm process is gone — crashed mid-cycle
          status = 'done';
          lastEvent = `Swarm exited mid-cycle ${state.cycle ?? '?'}`;
        }
      } else if (cycle) {
        // Legacy runs without worker state files: last cycle outcome is the best
        // available signal, but on a live run a finished cycle means the worker
        // is already in its next cycle (or backing off) — render it as running.
        status = isLive ? 'running' : normalizeWorkerStatus(cycle.outcome);
        lastEvent = `Cycle ${cycleNumber(cycle) || '?'}: ${cycle.outcome ?? 'unknown'}`;
      } else if (isLive) {
        status = !Number.isFinite(runAge) || runAge > 60_000 ? 'running' : 'starting';
        lastEvent = 'Starting';
      } else {
        status = 'done';
        lastEvent = isStopped ? 'Worker completed' : 'No data';
      }
      if (!isLive && !isTerminalWorkerStatus(status)) status = 'done';

      return { id, status, lastEvent };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const doneWorkers = workers.filter((worker) => isTerminalWorkerStatus(worker.status)).length;
  const activeWorkers = workers.length - doneWorkers;
  return {
    available: true,
    run: {
      runId: latestRun.id,
      swarmId: started['swarm-id'] ?? latestRun.id,
      isRunning: isLive && activeWorkers > 0,
      totalWorkers: Math.max(workerIds.size, configuredWorkers.length),
      activeWorkers,
      doneWorkers,
      configPath: started['config-file'] ?? null,
      logFile: null,
      workers,
      runCount: countRunDirectories(runsDirectory),
    },
    reason: null,
  };
}

function cycleNumber(cycle: OompaCycle): number {
  const legacyIteration = (cycle as unknown as Record<string, unknown>).iteration;
  return cycle.cycle ?? (typeof legacyIteration === 'number' ? legacyIteration : 0);
}

function countRunDirectories(runsDirectory: string): number {
  try {
    return fs
      .readdirSync(runsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

function isLegacyOompaProcessAlive(
  projectRoot: string,
  dependencies: SwarmRuntimeDependencies
): boolean {
  const logsDirectory = path.join(projectRoot, 'oompa', 'logs');
  try {
    for (const file of fs
      .readdirSync(logsDirectory)
      .filter((name) => /^run_.+\.meta$/.test(name))) {
      const metadata = parseMetadata(fs.readFileSync(path.join(logsDirectory, file), 'utf-8'));
      for (const value of [metadata.script_pid, metadata.bb_pid]) {
        const pid = Number.parseInt(value ?? '', 10);
        if (Number.isFinite(pid) && pid > 0 && dependencies.isProcessAlive(pid)) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function parseMetadata(content: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return metadata;
}
