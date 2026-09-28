import { isTerminalAttemptState } from '@unleashd/shared';
import type { TurnAttemptJournalEvent, TurnAttemptSnapshot } from './types';

/** One observation applied to one snapshot; storage owns the resulting value. */
export function foldAttempt(
  current: TurnAttemptSnapshot | undefined,
  event: TurnAttemptJournalEvent
): TurnAttemptSnapshot | undefined {
  if (event.kind === 'server_boot') return current;
  if (event.kind === 'attempt_created') {
    return {
      attemptId: event.attemptId,
      conversationId: event.conversationId,
      ...(event.queueMessageId ? { queueMessageId: event.queueMessageId } : {}),
      ...(event.providerSessionId ? { providerSessionId: event.providerSessionId } : {}),
      originServerBootId: event.serverBootId,
      state: 'queued',
      stateTimestamps: { queued: event.timestamp },
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };
  }
  // A rotated v1 file may begin after its creation event. Keep the partial
  // historical attempt explicit rather than dropping the surviving events.
  const priorState =
    event.kind === 'attempt_provider_session_bound' || event.kind === 'attempt_activity'
      ? event.state
      : event.previousState;
  const next: TurnAttemptSnapshot = current
    ? {
        ...current,
        stateTimestamps: { ...current.stateTimestamps },
      }
    : {
        attemptId: event.attemptId,
        conversationId: event.conversationId,
        ...(event.queueMessageId ? { queueMessageId: event.queueMessageId } : {}),
        ...(event.providerSessionId ? { providerSessionId: event.providerSessionId } : {}),
        originServerBootId:
          event.kind === 'attempt_recovered' ? event.originServerBootId : event.serverBootId,
        state: priorState,
        stateTimestamps: { [priorState]: event.timestamp },
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
  next.state = event.state;
  if (event.kind !== 'attempt_provider_session_bound' && event.kind !== 'attempt_activity') {
    next.stateTimestamps[event.state] = event.timestamp;
  }
  if (event.kind === 'attempt_activity') {
    next.lastActivityAt = event.timestamp;
    next.lastActivity = {
      ...event.activity,
      ...(event.activity.heartbeat ? { heartbeat: { ...event.activity.heartbeat } } : {}),
    };
    next.lastBridgeActivityAt = event.timestamp;
    if (event.activity.source === 'provider_event' || event.activity.source === 'native_session') {
      next.lastProviderProgressAt = event.timestamp;
    }
  }
  next.updatedAt = event.timestamp;
  if (event.providerSessionId) next.providerSessionId = event.providerSessionId;
  if (event.state === 'running' && !next.startedAt) next.startedAt = event.timestamp;
  if (isTerminalAttemptState(event.state)) {
    next.terminalAt = event.timestamp;
    if ('terminalCause' in event) next.terminalCause = event.terminalCause;
  }
  return next;
}
