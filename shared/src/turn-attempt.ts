import { z } from 'zod';

export const TurnAttemptStateSchema = z.enum([
  'queued',
  'starting',
  'running',
  'stopping',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
]);
export type TurnAttemptState = z.infer<typeof TurnAttemptStateSchema>;
export const TerminalTurnAttemptStateSchema = z.enum([
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
]);
export type TerminalTurnAttemptState = z.infer<typeof TerminalTurnAttemptStateSchema>;
export const TurnTerminalCauseSchema = z.enum([
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
  'timeout',
  'server_restart',
  'unknown',
]);
export type TurnTerminalCause = z.infer<typeof TurnTerminalCauseSchema>;
export const TurnActivitySourceSchema = z.enum([
  'runtime',
  'provider_event',
  'agent_cli_heartbeat',
  'native_session',
  'legacy_unknown',
]);
export type TurnActivitySource = z.infer<typeof TurnActivitySourceSchema>;

export const TurnAttemptActivitySchema = z.object({
  source: TurnActivitySourceSchema,
  providerEventType: z.string(),
  providerEventSource: z.string().optional(),
  heartbeat: z
    .object({
      unifiedEventSilentSeconds: z.number().nonnegative().optional(),
      rawStdoutSilentSeconds: z.number().nonnegative().optional(),
      phase: z.enum(['startup', 'running']).optional(),
      stdoutStreamEvent: z.enum(['attached', 'resume', 'pause', 'close']).optional(),
      stdoutReadableFlowing: z.boolean().nullable().optional(),
      stdoutReadableLengthBytes: z.number().nonnegative().optional(),
      nativeSessionAvailable: z.boolean().optional(),
      nativeSessionAdvanced: z.boolean().optional(),
      nativeSessionSilentSeconds: z.number().nonnegative().optional(),
      nativeSessionSizeBytes: z.number().nonnegative().optional(),
    })
    .optional(),
});
export type TurnAttemptActivity = z.infer<typeof TurnAttemptActivitySchema>;

const AttemptBase = z.object({
  attemptId: z.string(),
  conversationId: z.string(),
  queueMessageId: z.string().optional(),
  providerSessionId: z.string().optional(),
  originServerBootId: z.string(),
  stateTimestamps: z.record(TurnAttemptStateSchema, z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivityAt: z.string().optional(),
  lastActivity: TurnAttemptActivitySchema.optional(),
  lastBridgeActivityAt: z.string().optional(),
  lastProviderProgressAt: z.string().optional(),
  startedAt: z.string().optional(),
  terminalAt: z.string().optional(),
});

export interface TurnAttemptSnapshot {
  attemptId: string;
  conversationId: string;
  queueMessageId?: string;
  providerSessionId?: string;
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

// Pattern: sum-types (docs/patterns.md#sum-types)
// A finished attempt has a cause. An active attempt cannot claim one.
export const TurnAttemptSnapshotSchema: z.ZodType<TurnAttemptSnapshot> = z.union([
  AttemptBase.extend({
    state: z.enum(['queued', 'starting', 'running', 'stopping']),
    terminalCause: z.never().optional(),
  }),
  AttemptBase.extend({
    state: TerminalTurnAttemptStateSchema,
    terminalCause: TurnTerminalCauseSchema,
    terminalAt: z.string(),
  }),
]);

export function isTerminalAttemptState(state: TurnAttemptState): state is TerminalTurnAttemptState {
  return (
    state === 'succeeded' || state === 'failed' || state === 'cancelled' || state === 'interrupted'
  );
}
