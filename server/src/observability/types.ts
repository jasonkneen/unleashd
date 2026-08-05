export const TURN_ATTEMPT_STATES = [
  'queued',
  'starting',
  'running',
  'stopping',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
] as const;

export type TurnAttemptState = (typeof TURN_ATTEMPT_STATES)[number];

export const TERMINAL_TURN_ATTEMPT_STATES = [
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
] as const;

export type TerminalTurnAttemptState = (typeof TERMINAL_TURN_ATTEMPT_STATES)[number];

export const TURN_TERMINAL_CAUSES = [
  'provider_complete',
  'provider_error',
  'out_of_tokens',
  'user_stop',
  'process_killed',
  'process_exit',
  'spawn_failed',
  'idle_timeout',
  'bridge_timeout',
  'provider_idle_timeout',
  'max_runtime_timeout',
  // Kept for backwards compatibility with journals written before timeout
  // causes were split by watchdog.
  'timeout',
  'server_restart',
  'unknown',
] as const;

export type TurnTerminalCause = (typeof TURN_TERMINAL_CAUSES)[number];

export const TURN_ACTIVITY_SOURCES = [
  'runtime',
  'provider_event',
  'agent_cli_heartbeat',
  'native_session',
  'legacy_unknown',
] as const;

export type TurnActivitySource = (typeof TURN_ACTIVITY_SOURCES)[number];

export interface TurnHeartbeatDiagnostics {
  unifiedEventSilentSeconds?: number;
  rawStdoutSilentSeconds?: number;
  phase?: 'startup' | 'running';
  stdoutStreamEvent?: 'attached' | 'resume' | 'pause' | 'close';
  stdoutReadableFlowing?: boolean | null;
  stdoutReadableLengthBytes?: number;
  nativeSessionAvailable?: boolean;
  nativeSessionAdvanced?: boolean;
  nativeSessionSilentSeconds?: number;
  nativeSessionSizeBytes?: number;
}

/**
 * Privacy-safe metadata describing the event that proved a turn was alive.
 * Prompt, response, tool input, stderr, and other content never belong here.
 */
export interface TurnAttemptActivity {
  source: TurnActivitySource;
  providerEventType: string;
  providerEventSource?: string;
  heartbeat?: TurnHeartbeatDiagnostics;
}

export interface TurnAttemptIdentity {
  attemptId: string;
  conversationId: string;
  queueMessageId?: string;
  providerSessionId?: string;
}

export interface TurnAttemptSnapshot extends TurnAttemptIdentity {
  originServerBootId: string;
  state: TurnAttemptState;
  stateTimestamps: Partial<Record<TurnAttemptState, string>>;
  terminalCause?: TurnTerminalCause;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  lastActivity?: TurnAttemptActivity;
  lastBridgeActivityAt?: string;
  lastProviderProgressAt?: string;
  startedAt?: string;
  terminalAt?: string;
}

interface JournalEventBase {
  schemaVersion: 1;
  eventId: string;
  serverBootId: string;
  timestamp: string;
}

export interface ServerBootEvent extends JournalEventBase {
  kind: 'server_boot';
}

export interface AttemptCreatedEvent extends JournalEventBase, TurnAttemptIdentity {
  kind: 'attempt_created';
  state: 'queued';
}

export interface AttemptStateChangedEvent extends JournalEventBase, TurnAttemptIdentity {
  kind: 'attempt_state_changed';
  previousState: TurnAttemptState;
  state: Exclude<TurnAttemptState, TerminalTurnAttemptState | 'queued'>;
}

export interface AttemptProviderSessionBoundEvent extends JournalEventBase, TurnAttemptIdentity {
  kind: 'attempt_provider_session_bound';
  providerSessionId: string;
  state: TurnAttemptState;
}

export interface AttemptActivityEvent extends JournalEventBase, TurnAttemptIdentity {
  kind: 'attempt_activity';
  state: TurnAttemptState;
  activity: TurnAttemptActivity;
}

export interface AttemptTerminalEvent extends JournalEventBase, TurnAttemptIdentity {
  kind: 'attempt_terminal';
  previousState: Exclude<TurnAttemptState, TerminalTurnAttemptState>;
  state: TerminalTurnAttemptState;
  terminalCause: TurnTerminalCause;
}

export interface AttemptRecoveredEvent extends JournalEventBase, TurnAttemptIdentity {
  kind: 'attempt_recovered';
  originServerBootId: string;
  previousState: Exclude<TurnAttemptState, TerminalTurnAttemptState>;
  state: 'interrupted';
  terminalCause: 'server_restart';
}

export type TurnAttemptJournalEvent =
  | ServerBootEvent
  | AttemptCreatedEvent
  | AttemptStateChangedEvent
  | AttemptProviderSessionBoundEvent
  | AttemptActivityEvent
  | AttemptTerminalEvent
  | AttemptRecoveredEvent;

export interface AttemptQuery {
  conversationId?: string;
  queueMessageId?: string;
  providerSessionId?: string;
  state?: TurnAttemptState;
  terminalCause?: TurnTerminalCause;
  limit?: number;
}

export interface RecentEventQuery {
  attemptId?: string;
  conversationId?: string;
  since?: string;
  limit?: number;
}

export function isTerminalAttemptState(state: TurnAttemptState): state is TerminalTurnAttemptState {
  return (TERMINAL_TURN_ATTEMPT_STATES as readonly string[]).includes(state);
}
