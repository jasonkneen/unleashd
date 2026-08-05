import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { StructuredObservabilityLogger } from './structured-logger';
import { createStructuredObservabilityLogger } from './structured-logger';
import {
  type AttemptQuery,
  type RecentEventQuery,
  TERMINAL_TURN_ATTEMPT_STATES,
  TURN_ACTIVITY_SOURCES,
  TURN_TERMINAL_CAUSES,
  type TerminalTurnAttemptState,
  type TurnAttemptActivity,
  type TurnAttemptIdentity,
  type TurnAttemptJournalEvent,
  type TurnAttemptSnapshot,
  type TurnAttemptState,
  type TurnTerminalCause,
  isTerminalAttemptState,
} from './types';

type NonterminalTurnAttemptState = Exclude<TurnAttemptState, TerminalTurnAttemptState>;

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_ROTATED_FILES = 4;
const DEFAULT_QUERY_LIMIT = 100;
const MAX_QUERY_LIMIT = 1_000;

const ALLOWED_TRANSITIONS: Readonly<Record<TurnAttemptState, readonly TurnAttemptState[]>> = {
  queued: ['starting', 'failed', 'cancelled', 'interrupted'],
  starting: ['running', 'failed', 'cancelled', 'interrupted'],
  running: ['stopping', 'succeeded', 'failed', 'cancelled', 'interrupted'],
  stopping: ['succeeded', 'failed', 'cancelled', 'interrupted'],
  succeeded: [],
  failed: [],
  cancelled: [],
  interrupted: [],
};

export interface TurnAttemptJournalOptions {
  directory: string;
  fileName?: string;
  maxBytes?: number;
  maxRotatedFiles?: number;
  serverBootId?: string;
  now?: () => Date;
  createId?: () => string;
  logger?: StructuredObservabilityLogger;
}

export interface StartTurnAttemptInput {
  attemptId?: string;
  conversationId: string;
  queueMessageId?: string;
  providerSessionId?: string;
}

export interface TransitionTurnAttemptInput {
  attemptId: string;
  state: 'starting' | 'running' | 'stopping';
  providerSessionId?: string;
}

export interface FinishTurnAttemptInput {
  attemptId: string;
  state: TerminalTurnAttemptState;
  terminalCause: TurnTerminalCause;
  providerSessionId?: string;
}

export interface BindTurnAttemptProviderSessionInput {
  attemptId: string;
  providerSessionId: string;
}

export interface TouchTurnAttemptInput {
  attemptId: string;
  activity: TurnAttemptActivity;
  providerSessionId?: string;
}

export class TurnAttemptJournal {
  readonly serverBootId: string;

  private readonly filePath: string;
  private readonly maxBytes: number;
  private readonly maxRotatedFiles: number;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly logger: StructuredObservabilityLogger;
  private readonly attempts = new Map<string, TurnAttemptSnapshot>();
  private events: TurnAttemptJournalEvent[] = [];
  private initialized = false;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(options: TurnAttemptJournalOptions) {
    if (!path.isAbsolute(options.directory)) {
      throw new Error('Turn-attempt journal directory must be absolute');
    }
    this.filePath = path.join(options.directory, options.fileName ?? 'turn-attempts.jsonl');
    this.maxBytes = Math.max(1_024, options.maxBytes ?? DEFAULT_MAX_BYTES);
    this.maxRotatedFiles = Math.max(0, options.maxRotatedFiles ?? DEFAULT_MAX_ROTATED_FILES);
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? crypto.randomUUID;
    this.serverBootId = options.serverBootId ?? this.createId();
    this.logger = options.logger ?? createStructuredObservabilityLogger();
  }

  initialize(): Promise<{ recoveredAttempts: number }> {
    return this.runExclusive(async () => {
      if (this.initialized) return { recoveredAttempts: 0 };
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      await this.reloadFromDisk();
      this.initialized = true;

      const recoverable = Array.from(this.attempts.values()).filter(
        (
          attempt
        ): attempt is TurnAttemptSnapshot & {
          state: NonterminalTurnAttemptState;
        } =>
          attempt.originServerBootId !== this.serverBootId && !isTerminalAttemptState(attempt.state)
      );
      await this.appendUnlocked(this.baseEvent({ kind: 'server_boot' }));
      for (const attempt of recoverable) {
        const event = this.baseEvent({
          kind: 'attempt_recovered',
          attemptId: attempt.attemptId,
          conversationId: attempt.conversationId,
          ...(attempt.queueMessageId ? { queueMessageId: attempt.queueMessageId } : {}),
          ...(attempt.providerSessionId ? { providerSessionId: attempt.providerSessionId } : {}),
          originServerBootId: attempt.originServerBootId,
          previousState: attempt.state,
          state: 'interrupted',
          terminalCause: 'server_restart',
        });
        await this.appendUnlocked(event);
        this.logger.warn('attempt_recovered', {
          serverBootId: this.serverBootId,
          attemptId: attempt.attemptId,
          conversationId: attempt.conversationId,
          terminalCause: 'server_restart',
        });
      }
      this.logger.info('journal_initialized', {
        serverBootId: this.serverBootId,
        count: recoverable.length,
      });
      return { recoveredAttempts: recoverable.length };
    });
  }

  startAttempt(input: StartTurnAttemptInput): Promise<TurnAttemptSnapshot> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const attemptId = input.attemptId ?? this.createId();
      if (this.attempts.has(attemptId)) throw new Error(`Attempt already exists: ${attemptId}`);
      const event = this.baseEvent({
        kind: 'attempt_created',
        attemptId,
        conversationId: requiredId(input.conversationId, 'conversationId'),
        ...(optionalId(input.queueMessageId, 'queueMessageId')
          ? { queueMessageId: input.queueMessageId }
          : {}),
        ...(optionalId(input.providerSessionId, 'providerSessionId')
          ? { providerSessionId: input.providerSessionId }
          : {}),
        state: 'queued',
      });
      await this.appendUnlocked(event);
      this.logger.info('attempt_created', {
        serverBootId: this.serverBootId,
        attemptId,
        conversationId: input.conversationId,
        ...(input.queueMessageId ? { queueMessageId: input.queueMessageId } : {}),
        ...(input.providerSessionId ? { providerSessionId: input.providerSessionId } : {}),
        state: 'queued',
      });
      return cloneAttempt(this.attempts.get(attemptId)!);
    });
  }

  transitionAttempt(input: TransitionTurnAttemptInput): Promise<TurnAttemptSnapshot> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const current = this.requireAttempt(input.attemptId);
      assertTransition(current.state, input.state);
      const identity = mergeIdentity(current, input.providerSessionId);
      const event = this.baseEvent({
        kind: 'attempt_state_changed',
        ...identity,
        previousState: current.state as Exclude<TurnAttemptState, TerminalTurnAttemptState>,
        state: input.state,
      });
      await this.appendUnlocked(event);
      this.logger.info('attempt_state_changed', {
        serverBootId: this.serverBootId,
        attemptId: input.attemptId,
        conversationId: current.conversationId,
        state: input.state,
      });
      return cloneAttempt(this.attempts.get(input.attemptId)!);
    });
  }

  finishAttempt(input: FinishTurnAttemptInput): Promise<TurnAttemptSnapshot> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const current = this.requireAttempt(input.attemptId);
      assertTransition(current.state, input.state);
      if (isTerminalAttemptState(current.state)) {
        throw new Error(`Attempt is already terminal: ${input.attemptId}`);
      }
      const event = this.baseEvent({
        kind: 'attempt_terminal',
        ...mergeIdentity(current, input.providerSessionId),
        previousState: current.state,
        state: input.state,
        terminalCause: input.terminalCause,
      });
      await this.appendUnlocked(event);
      this.logger.info('attempt_terminal', {
        serverBootId: this.serverBootId,
        attemptId: input.attemptId,
        conversationId: current.conversationId,
        state: input.state,
        terminalCause: input.terminalCause,
      });
      return cloneAttempt(this.attempts.get(input.attemptId)!);
    });
  }

  bindProviderSession(input: BindTurnAttemptProviderSessionInput): Promise<TurnAttemptSnapshot> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const current = this.requireAttempt(input.attemptId);
      const providerSessionId = requiredId(input.providerSessionId, 'providerSessionId');
      const event = this.baseEvent({
        kind: 'attempt_provider_session_bound',
        ...mergeIdentity(current, providerSessionId),
        providerSessionId,
        state: current.state,
      });
      await this.appendUnlocked(event);
      return cloneAttempt(this.attempts.get(input.attemptId)!);
    });
  }

  touchAttempt(input: TouchTurnAttemptInput): Promise<TurnAttemptSnapshot> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const current = this.requireAttempt(input.attemptId);
      const previousActivitySource = current.lastActivity?.source;
      const event = this.baseEvent({
        kind: 'attempt_activity',
        ...mergeIdentity(current, input.providerSessionId),
        state: current.state,
        activity: input.activity,
      });
      await this.appendUnlocked(event);
      if (
        input.activity.source === 'agent_cli_heartbeat' ||
        previousActivitySource !== input.activity.source
      ) {
        this.logger.info('attempt_activity', {
          serverBootId: this.serverBootId,
          attemptId: input.attemptId,
          conversationId: current.conversationId,
          activitySource: input.activity.source,
          providerEventType: input.activity.providerEventType,
          ...(input.activity.providerEventSource
            ? { providerEventSource: input.activity.providerEventSource }
            : {}),
          ...(input.activity.heartbeat?.phase
            ? { heartbeatPhase: input.activity.heartbeat.phase }
            : {}),
          ...(input.activity.heartbeat?.unifiedEventSilentSeconds !== undefined
            ? {
                unifiedEventSilentSeconds: input.activity.heartbeat.unifiedEventSilentSeconds,
              }
            : {}),
          ...(input.activity.heartbeat?.rawStdoutSilentSeconds !== undefined
            ? { rawStdoutSilentSeconds: input.activity.heartbeat.rawStdoutSilentSeconds }
            : {}),
          ...(input.activity.heartbeat?.stdoutStreamEvent !== undefined
            ? { stdoutStreamEvent: input.activity.heartbeat.stdoutStreamEvent }
            : {}),
          ...(input.activity.heartbeat?.stdoutReadableFlowing !== undefined
            ? { stdoutReadableFlowing: input.activity.heartbeat.stdoutReadableFlowing }
            : {}),
          ...(input.activity.heartbeat?.stdoutReadableLengthBytes !== undefined
            ? {
                stdoutReadableLengthBytes: input.activity.heartbeat.stdoutReadableLengthBytes,
              }
            : {}),
          ...(input.activity.heartbeat?.nativeSessionAvailable !== undefined
            ? { nativeSessionAvailable: input.activity.heartbeat.nativeSessionAvailable }
            : {}),
          ...(input.activity.heartbeat?.nativeSessionAdvanced !== undefined
            ? { nativeSessionAdvanced: input.activity.heartbeat.nativeSessionAdvanced }
            : {}),
          ...(input.activity.heartbeat?.nativeSessionSilentSeconds !== undefined
            ? {
                nativeSessionSilentSeconds: input.activity.heartbeat.nativeSessionSilentSeconds,
              }
            : {}),
          ...(input.activity.heartbeat?.nativeSessionSizeBytes !== undefined
            ? { nativeSessionSizeBytes: input.activity.heartbeat.nativeSessionSizeBytes }
            : {}),
        });
      }
      return cloneAttempt(this.attempts.get(input.attemptId)!);
    });
  }

  getAttempt(attemptId: string): Promise<TurnAttemptSnapshot | undefined> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const attempt = this.attempts.get(attemptId);
      return attempt ? cloneAttempt(attempt) : undefined;
    });
  }

  queryAttempts(query: AttemptQuery = {}): Promise<TurnAttemptSnapshot[]> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const limit = normalizeLimit(query.limit);
      return Array.from(this.attempts.values())
        .filter(
          (attempt) =>
            (!query.conversationId || attempt.conversationId === query.conversationId) &&
            (!query.queueMessageId || attempt.queueMessageId === query.queueMessageId) &&
            (!query.providerSessionId || attempt.providerSessionId === query.providerSessionId) &&
            (!query.state || attempt.state === query.state) &&
            (!query.terminalCause || attempt.terminalCause === query.terminalCause)
        )
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.attemptId.localeCompare(left.attemptId)
        )
        .slice(0, limit)
        .map(cloneAttempt);
    });
  }

  recentEvents(query: RecentEventQuery = {}): Promise<TurnAttemptJournalEvent[]> {
    return this.runExclusive(async () => {
      this.assertInitialized();
      const limit = normalizeLimit(query.limit);
      return this.events
        .filter(
          (event) =>
            (!query.attemptId || ('attemptId' in event && event.attemptId === query.attemptId)) &&
            (!query.conversationId ||
              ('conversationId' in event && event.conversationId === query.conversationId)) &&
            (!query.since || event.timestamp >= query.since)
        )
        .slice(-limit)
        .map((event) => ({ ...event }));
    });
  }

  flush(): Promise<void> {
    return this.runExclusive(async () => undefined);
  }

  private requireAttempt(attemptId: string): TurnAttemptSnapshot {
    const attempt = this.attempts.get(requiredId(attemptId, 'attemptId'));
    if (!attempt) throw new Error(`Attempt not found: ${attemptId}`);
    return attempt;
  }

  private baseEvent(event: JournalEventInput): TurnAttemptJournalEvent {
    return {
      ...event,
      schemaVersion: 1,
      eventId: this.createId(),
      serverBootId: this.serverBootId,
      timestamp: this.now().toISOString(),
    };
  }

  private async appendUnlocked(event: TurnAttemptJournalEvent): Promise<void> {
    await this.repairActiveFileTerminator();
    const line = `${JSON.stringify(event)}\n`;
    const rotated = await this.rotateIfNeeded(Buffer.byteLength(line));
    if (rotated) await this.reloadFromDisk();
    try {
      await fs.promises.appendFile(this.filePath, line, { encoding: 'utf8', mode: 0o600 });
    } catch {
      this.logger.error('journal_write_failed', { serverBootId: this.serverBootId });
      throw new Error('Failed to write turn-attempt journal');
    }
    this.events.push(event);
    applyEvent(this.attempts, event);
  }

  private async repairActiveFileTerminator(): Promise<void> {
    const handle = await fs.promises.open(this.filePath, 'a+', 0o600);
    try {
      await handle.chmod(0o600);
      const stat = await handle.stat();
      if (stat.size === 0) return;
      const lastByte = Buffer.allocUnsafe(1);
      await handle.read(lastByte, 0, 1, stat.size - 1);
      if (lastByte[0] !== 10) await handle.appendFile('\n', 'utf8');
    } finally {
      await handle.close();
    }
  }

  private async rotateIfNeeded(incomingBytes: number): Promise<boolean> {
    const currentBytes = await fs.promises
      .stat(this.filePath)
      .then((stat) => stat.size)
      .catch(() => 0);
    if (currentBytes === 0 || currentBytes + incomingBytes <= this.maxBytes) return false;

    if (this.maxRotatedFiles === 0) {
      await fs.promises.truncate(this.filePath, 0);
    } else {
      await fs.promises.rm(`${this.filePath}.${this.maxRotatedFiles}`, { force: true });
      for (let index = this.maxRotatedFiles - 1; index >= 1; index -= 1) {
        await fs.promises
          .rename(`${this.filePath}.${index}`, `${this.filePath}.${index + 1}`)
          .catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
      }
      await fs.promises.rename(this.filePath, `${this.filePath}.1`);
    }
    this.logger.info('journal_rotated', {
      serverBootId: this.serverBootId,
      fileIndex: 1,
    });
    return true;
  }

  private async reloadFromDisk(): Promise<void> {
    const events: TurnAttemptJournalEvent[] = [];
    for (const file of this.journalFilesOldestFirst()) {
      const content = await fs.promises.readFile(file, 'utf8').catch(() => '');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        const event = parseJournalEvent(line);
        if (event) {
          events.push(event);
        } else {
          this.logger.warn('journal_corrupt_line', { serverBootId: this.serverBootId });
        }
      }
    }
    this.events = events;
    this.attempts.clear();
    for (const event of events) applyEvent(this.attempts, event);
  }

  private journalFilesOldestFirst(): string[] {
    const files: string[] = [];
    for (let index = this.maxRotatedFiles; index >= 1; index -= 1) {
      files.push(`${this.filePath}.${index}`);
    }
    files.push(this.filePath);
    return files;
  }

  private assertInitialized(): void {
    if (!this.initialized) throw new Error('Initialize the turn-attempt journal first');
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

type JournalGeneratedFields = {
  schemaVersion: 1;
  eventId: string;
  serverBootId: string;
  timestamp: string;
};

type JournalEventInput = TurnAttemptJournalEvent extends infer Event
  ? Event extends TurnAttemptJournalEvent
    ? Omit<Event, keyof JournalGeneratedFields>
    : never
  : never;

function applyEvent(
  attempts: Map<string, TurnAttemptSnapshot>,
  event: TurnAttemptJournalEvent
): void {
  if (event.kind === 'server_boot') return;
  if (event.kind === 'attempt_created') {
    attempts.set(event.attemptId, {
      attemptId: event.attemptId,
      conversationId: event.conversationId,
      ...(event.queueMessageId ? { queueMessageId: event.queueMessageId } : {}),
      ...(event.providerSessionId ? { providerSessionId: event.providerSessionId } : {}),
      originServerBootId: event.serverBootId,
      state: event.state,
      stateTimestamps: { queued: event.timestamp },
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    });
    return;
  }
  let current = attempts.get(event.attemptId);
  if (!current) {
    const priorState =
      event.kind === 'attempt_provider_session_bound' || event.kind === 'attempt_activity'
        ? event.state
        : event.previousState;
    current = {
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
    attempts.set(event.attemptId, current);
  }
  current.state = event.state;
  if (event.kind !== 'attempt_provider_session_bound' && event.kind !== 'attempt_activity') {
    current.stateTimestamps[event.state] = event.timestamp;
  }
  if (event.kind === 'attempt_activity') {
    current.lastActivityAt = event.timestamp;
    current.lastActivity = cloneActivity(event.activity);
    current.lastBridgeActivityAt = event.timestamp;
    if (event.activity.source === 'provider_event' || event.activity.source === 'native_session') {
      current.lastProviderProgressAt = event.timestamp;
    }
  }
  current.updatedAt = event.timestamp;
  if (event.providerSessionId) current.providerSessionId = event.providerSessionId;
  if (event.state === 'running' && !current.startedAt) current.startedAt = event.timestamp;
  if (isTerminalAttemptState(event.state)) {
    current.terminalAt = event.timestamp;
    if ('terminalCause' in event) current.terminalCause = event.terminalCause;
  }
}

function parseJournalEvent(line: string): TurnAttemptJournalEvent | undefined {
  try {
    const value: unknown = JSON.parse(line);
    if (!isRecord(value) || value.schemaVersion !== 1) return undefined;
    if (
      typeof value.eventId !== 'string' ||
      typeof value.serverBootId !== 'string' ||
      typeof value.timestamp !== 'string' ||
      typeof value.kind !== 'string'
    ) {
      return undefined;
    }
    const base: JournalGeneratedFields = {
      schemaVersion: 1,
      eventId: value.eventId,
      serverBootId: value.serverBootId,
      timestamp: value.timestamp,
    };
    if (value.kind === 'server_boot') return { kind: 'server_boot', ...base };

    const identity = parseIdentity(value);
    if (!identity) return undefined;
    if (value.kind === 'attempt_created' && value.state === 'queued') {
      return { kind: 'attempt_created', ...identity, state: 'queued', ...base };
    }
    if (
      value.kind === 'attempt_state_changed' &&
      isNonterminalState(value.previousState) &&
      (value.state === 'starting' || value.state === 'running' || value.state === 'stopping')
    ) {
      return {
        kind: 'attempt_state_changed',
        ...identity,
        previousState: value.previousState,
        state: value.state,
        ...base,
      };
    }
    if (
      value.kind === 'attempt_provider_session_bound' &&
      typeof value.providerSessionId === 'string' &&
      value.providerSessionId.length > 0 &&
      isAttemptState(value.state)
    ) {
      return {
        kind: 'attempt_provider_session_bound',
        ...identity,
        providerSessionId: value.providerSessionId,
        state: value.state,
        ...base,
      };
    }
    if (value.kind === 'attempt_activity' && isAttemptState(value.state)) {
      const activity = parseActivity(value.activity);
      if (!activity) return undefined;
      return {
        kind: 'attempt_activity',
        ...identity,
        state: value.state,
        activity,
        ...base,
      };
    }
    if (
      value.kind === 'attempt_terminal' &&
      isNonterminalState(value.previousState) &&
      isOneOf(value.state, TERMINAL_TURN_ATTEMPT_STATES) &&
      isOneOf(value.terminalCause, TURN_TERMINAL_CAUSES)
    ) {
      return {
        kind: 'attempt_terminal',
        ...identity,
        previousState: value.previousState,
        state: value.state,
        terminalCause: value.terminalCause,
        ...base,
      };
    }
    if (
      value.kind === 'attempt_recovered' &&
      typeof value.originServerBootId === 'string' &&
      isNonterminalState(value.previousState) &&
      value.state === 'interrupted' &&
      value.terminalCause === 'server_restart'
    ) {
      return {
        kind: 'attempt_recovered',
        ...identity,
        originServerBootId: value.originServerBootId,
        previousState: value.previousState,
        state: 'interrupted',
        terminalCause: 'server_restart',
        ...base,
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function parseIdentity(value: Record<string, unknown>): TurnAttemptIdentity | undefined {
  if (
    typeof value.attemptId !== 'string' ||
    !value.attemptId ||
    typeof value.conversationId !== 'string' ||
    !value.conversationId
  ) {
    return undefined;
  }
  if (
    (value.queueMessageId !== undefined && typeof value.queueMessageId !== 'string') ||
    (value.providerSessionId !== undefined && typeof value.providerSessionId !== 'string')
  ) {
    return undefined;
  }
  return {
    attemptId: value.attemptId,
    conversationId: value.conversationId,
    ...(value.queueMessageId ? { queueMessageId: value.queueMessageId } : {}),
    ...(value.providerSessionId ? { providerSessionId: value.providerSessionId } : {}),
  };
}

function isNonterminalState(value: unknown): value is NonterminalTurnAttemptState {
  return value === 'queued' || value === 'starting' || value === 'running' || value === 'stopping';
}

function isAttemptState(value: unknown): value is TurnAttemptState {
  return isNonterminalState(value) || isOneOf(value, TERMINAL_TURN_ATTEMPT_STATES);
}

function parseActivity(value: unknown): TurnAttemptActivity | undefined {
  // Version-1 journals originally omitted source metadata. Preserve those
  // records while making the uncertainty explicit in the projection.
  if (value === undefined) {
    return { source: 'legacy_unknown', providerEventType: 'unknown' };
  }
  if (!isRecord(value)) return undefined;
  if (
    !isOneOf(value.source, TURN_ACTIVITY_SOURCES) ||
    typeof value.providerEventType !== 'string' ||
    !value.providerEventType ||
    (value.providerEventSource !== undefined && typeof value.providerEventSource !== 'string')
  ) {
    return undefined;
  }
  const heartbeat = parseHeartbeat(value.heartbeat);
  if (value.heartbeat !== undefined && !heartbeat) return undefined;
  return {
    source: value.source,
    providerEventType: value.providerEventType,
    ...(value.providerEventSource ? { providerEventSource: value.providerEventSource } : {}),
    ...(heartbeat ? { heartbeat } : {}),
  };
}

function parseHeartbeat(value: unknown): TurnAttemptActivity['heartbeat'] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;
  const unified = optionalNonnegativeNumber(value.unifiedEventSilentSeconds);
  const stdout = optionalNonnegativeNumber(value.rawStdoutSilentSeconds);
  const stdoutReadableLength = optionalNonnegativeNumber(value.stdoutReadableLengthBytes);
  const nativeSilent = optionalNonnegativeNumber(value.nativeSessionSilentSeconds);
  const nativeSize = optionalNonnegativeNumber(value.nativeSessionSizeBytes);
  if (
    (value.unifiedEventSilentSeconds !== undefined && unified === undefined) ||
    (value.rawStdoutSilentSeconds !== undefined && stdout === undefined) ||
    (value.stdoutReadableLengthBytes !== undefined && stdoutReadableLength === undefined) ||
    (value.stdoutStreamEvent !== undefined &&
      value.stdoutStreamEvent !== 'attached' &&
      value.stdoutStreamEvent !== 'resume' &&
      value.stdoutStreamEvent !== 'pause' &&
      value.stdoutStreamEvent !== 'close') ||
    (value.stdoutReadableFlowing !== undefined &&
      value.stdoutReadableFlowing !== null &&
      typeof value.stdoutReadableFlowing !== 'boolean') ||
    (value.nativeSessionSilentSeconds !== undefined && nativeSilent === undefined) ||
    (value.nativeSessionSizeBytes !== undefined && nativeSize === undefined) ||
    (value.nativeSessionAvailable !== undefined &&
      typeof value.nativeSessionAvailable !== 'boolean') ||
    (value.nativeSessionAdvanced !== undefined &&
      typeof value.nativeSessionAdvanced !== 'boolean') ||
    (value.phase !== undefined && value.phase !== 'startup' && value.phase !== 'running')
  ) {
    return undefined;
  }
  return {
    ...(unified !== undefined ? { unifiedEventSilentSeconds: unified } : {}),
    ...(stdout !== undefined ? { rawStdoutSilentSeconds: stdout } : {}),
    ...(value.phase === 'startup' || value.phase === 'running' ? { phase: value.phase } : {}),
    ...(value.stdoutStreamEvent === 'attached' ||
    value.stdoutStreamEvent === 'resume' ||
    value.stdoutStreamEvent === 'pause' ||
    value.stdoutStreamEvent === 'close'
      ? { stdoutStreamEvent: value.stdoutStreamEvent }
      : {}),
    ...(typeof value.stdoutReadableFlowing === 'boolean' || value.stdoutReadableFlowing === null
      ? { stdoutReadableFlowing: value.stdoutReadableFlowing }
      : {}),
    ...(stdoutReadableLength !== undefined
      ? { stdoutReadableLengthBytes: stdoutReadableLength }
      : {}),
    ...(typeof value.nativeSessionAvailable === 'boolean'
      ? { nativeSessionAvailable: value.nativeSessionAvailable }
      : {}),
    ...(typeof value.nativeSessionAdvanced === 'boolean'
      ? { nativeSessionAdvanced: value.nativeSessionAdvanced }
      : {}),
    ...(nativeSilent !== undefined ? { nativeSessionSilentSeconds: nativeSilent } : {}),
    ...(nativeSize !== undefined ? { nativeSessionSizeBytes: nativeSize } : {}),
  };
}

function optionalNonnegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values
): value is Values[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function mergeIdentity(
  attempt: TurnAttemptSnapshot,
  providerSessionId: string | undefined
): TurnAttemptIdentity {
  const sessionId = optionalId(providerSessionId, 'providerSessionId')
    ? providerSessionId
    : attempt.providerSessionId;
  return {
    attemptId: attempt.attemptId,
    conversationId: attempt.conversationId,
    ...(attempt.queueMessageId ? { queueMessageId: attempt.queueMessageId } : {}),
    ...(sessionId ? { providerSessionId: sessionId } : {}),
  };
}

function assertTransition(current: TurnAttemptState, next: TurnAttemptState): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid attempt transition: ${current} -> ${next}`);
  }
}

function requiredId(value: string, name: string): string {
  if (!value.trim()) throw new Error(`${name} must not be empty`);
  return value;
}

function optionalId(value: string | undefined, name: string): boolean {
  if (value === undefined) return false;
  requiredId(value, name);
  return true;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_QUERY_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_QUERY_LIMIT;
  return Math.min(Math.floor(limit), MAX_QUERY_LIMIT);
}

function cloneAttempt(attempt: TurnAttemptSnapshot): TurnAttemptSnapshot {
  return {
    ...attempt,
    stateTimestamps: { ...attempt.stateTimestamps },
    ...(attempt.lastActivity ? { lastActivity: cloneActivity(attempt.lastActivity) } : {}),
  };
}

function cloneActivity(activity: TurnAttemptActivity): TurnAttemptActivity {
  return {
    ...activity,
    ...(activity.heartbeat ? { heartbeat: { ...activity.heartbeat } } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
