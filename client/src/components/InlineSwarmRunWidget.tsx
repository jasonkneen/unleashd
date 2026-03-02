import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwarmRuntimeSnapshots } from '../hooks/useSwarmRuntimeSnapshots';
import './InlineSwarmRunWidget.css';

interface InlineSwarmRunWidgetProps {
  workingDirectory: string;
}

export function InlineSwarmRunWidget({ workingDirectory }: InlineSwarmRunWidgetProps) {
  const navigate = useNavigate();
  const snapshots = useSwarmRuntimeSnapshots(useMemo(() => [workingDirectory], [workingDirectory]));
  
  const snapshot = snapshots[workingDirectory];
  const run = snapshot?.run;

  const handleClick = () => {
    navigate(`/workers/detail?project=${encodeURIComponent(workingDirectory)}`);
  };

  if (!run) {
    return (
      <div className="inline-swarm-run inline-swarm-run--empty" onClick={handleClick} role="button" tabIndex={0}>
        <div className="inline-swarm-run-content">
          <div className="inline-swarm-run-header">
            <span className="inline-swarm-label">▶️ oompa run</span>
            <div className="inline-swarm-status-container">
              <span className="inline-swarm-status status-unknown">Initializing...</span>
              <div className="inline-swarm-nav-arrow">→</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = run.isRunning;
  const workers = run.totalWorkers ?? 0;
  const active = run.activeWorkers ?? 0;
  const done = run.doneWorkers ?? 0;

  return (
    <div className={`inline-swarm-run ${isRunning ? 'running' : 'completed'}`} onClick={handleClick} role="button" tabIndex={0}>
      <div className="inline-swarm-run-content">
        <div className="inline-swarm-run-header">
          <span className="inline-swarm-label">🚀 SWARM RUN</span>
          <span className="inline-swarm-id">{run.swarmId ?? run.runId}</span>
          <div className="inline-swarm-status-container">
            <span className={`inline-swarm-status status-${isRunning ? 'running' : 'stopped'}`}>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
            <div className="inline-swarm-nav-arrow">→</div>
          </div>
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
    </div>
  );
}
