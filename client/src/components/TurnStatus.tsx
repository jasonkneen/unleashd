import { useEffect, useState } from 'react';
import {
  type TurnDiagnosticsInput,
  buildTurnDiagnosticsViewModel,
  isActiveTurnStatus,
} from './turn-diagnostics';
import './TurnStatus.css';

export interface TurnStatusProps {
  diagnostics: TurnDiagnosticsInput;
  className?: string;
  now?: number;
  refreshIntervalMs?: number;
}

export function TurnStatus({
  diagnostics,
  className = '',
  now,
  refreshIntervalMs = 1_000,
}: TurnStatusProps) {
  const [clock, setClock] = useState(() => now ?? Date.now());

  useEffect(() => {
    if (now !== undefined) {
      setClock(now);
      return;
    }
    if (!isActiveTurnStatus(diagnostics.status)) {
      setClock(Date.now());
      return;
    }
    const timer = window.setInterval(() => setClock(Date.now()), refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [diagnostics.status, now, refreshIntervalMs]);

  const view = buildTurnDiagnosticsViewModel(diagnostics, now ?? clock);
  const classes = ['turn-status', `turn-status--${view.tone}`, className].filter(Boolean).join(' ');

  return (
    <output className={classes} aria-live="polite" title={view.title}>
      <span className="turn-status__indicator" aria-hidden="true" />
      <span className="turn-status__label">{view.label}</span>
      {view.duration && <span className="turn-status__duration">{view.duration}</span>}
      {view.lastActivity && <span className="turn-status__activity">{view.lastActivity}</span>}
      {view.reason && <span className="turn-status__reason">{view.reason}</span>}
    </output>
  );
}
