import type { Conversation } from '@unleashd/shared';
import type { OompaRuntimeSnapshot } from '@unleashd/shared';

export interface WorkerVisibilitySummary {
  sessionCount: number;
  hasWorkers: boolean;
  totalWorkers: number;
  runningWorkers: number;
}

export function getWorkerVisibilitySummary(
  workers: readonly Conversation[],
  runtimeSnapshot: OompaRuntimeSnapshot | null | undefined,
  isRunning: (worker: Conversation) => boolean = (worker) => worker.isRunning
): WorkerVisibilitySummary {
  const sessionCount = workers.length;
  const workerIds = workers.map((worker) => worker.workerId || worker.id);
  const distinctWorkerIds = new Set(workerIds);

  if (runtimeSnapshot?.available && runtimeSnapshot.run) {
    const totalWorkers = runtimeSnapshot.run.totalWorkers;
    const runningWorkers = Math.min(runtimeSnapshot.run.activeWorkers, totalWorkers);
    return {
      sessionCount,
      hasWorkers: sessionCount > 0 || totalWorkers > 0,
      totalWorkers,
      runningWorkers,
    };
  }

  const runningWorkers = new Set(
    workers.filter(isRunning).map((worker) => worker.workerId || worker.id)
  ).size;
  return {
    sessionCount,
    hasWorkers: sessionCount > 0,
    totalWorkers: distinctWorkerIds.size || sessionCount,
    runningWorkers,
  };
}
