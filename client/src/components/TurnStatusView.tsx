import { createElement } from 'react';
import type { TurnDiagnosticsViewModel } from './turn-diagnostics';

export interface TurnStatusViewProps {
  view: TurnDiagnosticsViewModel;
  className?: string;
}

export function TurnStatusView({ view, className = '' }: TurnStatusViewProps) {
  const classes = ['turn-status', `turn-status--${view.tone}`, className].filter(Boolean).join(' ');
  return createElement(
    'output',
    { className: classes, 'aria-live': 'polite', title: view.title },
    createElement('span', { className: 'turn-status__indicator', 'aria-hidden': true }),
    createElement('span', { className: 'turn-status__label' }, view.label),
    view.duration
      ? createElement('span', { className: 'turn-status__duration' }, view.duration)
      : null,
    view.lastActivity
      ? createElement('span', { className: 'turn-status__activity' }, view.lastActivity)
      : null,
    view.reason ? createElement('span', { className: 'turn-status__reason' }, view.reason) : null
  );
}
