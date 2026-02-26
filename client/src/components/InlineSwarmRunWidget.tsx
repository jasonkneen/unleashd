import { useMemo } from 'react';
import { useSwarmRuntimeSnapshots } from '../hooks/useSwarmRuntimeSnapshots';
import './InlineSwarmRunWidget.css';

interface InlineSwarmRunWidgetProps {
  workingDirectory: string;
}

export function InlineSwarmRunWidget({ workingDirectory }: InlineSwarmRunWidgetProps) {
  const snapshots = useSwarmRuntimeSnapshots(useMemo(() => [workingDirectory], [workingDirectory]));
  
  const snapshot = snapshots[workingDirectory];
  const run = snapshot?.run;

  if (!run) {
    return (
      <div className="inline-swarm-run inline-swarm-run--empty">
        <span className="inline-swarm-label">▶️ oompa run</span>
        <span className="inline-swarm-status status-unknown">Initializing...</span>
      </div>
    );
  }

  const isRunning = run.isRunning;
  const workers = run.totalWorkers ?? 0;
  const active = run.activeWorkers ?? 0;
  const done = run.doneWorkers ?? 0;

  return (
    <div className={`inline-swarm-run ${isRunning ? 'running' : 'completed'}`}>
      <div className="inline-swarm-run-header">
        <span className="inline-swarm-label">🚀 SWARM RUN</span>
        <span className="inline-swarm-id">{run.swarmId ?? run.runId}</span>
        <span className={`inline-swarm-status status-${isRunning ? 'running' : 'stopped'}`}>
          {isRunning ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>
      <div className="inline-swarm-run-stats">
        <div className="swarm-run-stat">
          <span className="stat-value">{workers}</span>
          <span className="stat-label">Workers</span>
        </div>
        <div className="swarm-run-stat">
          <span className="stat-value stat-success">{active}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="swarm-run-stat">
          <span className="stat-value">{done}</span>
          <span className="stat-label">Done</span>
        </div>
      </div>
    </div>
  );
}
