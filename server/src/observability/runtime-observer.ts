import type { StructuredObservabilityLogger } from './structured-logger';
import { createStructuredObservabilityLogger } from './structured-logger';
import type { TurnAttemptJournal } from './turn-attempt-journal';
import type { TerminalTurnAttemptState, TurnTerminalCause } from './types';

export interface RuntimeTurnAttemptObserver {
  queued(input: {
    attemptId: string;
    conversationId: string;
    queueMessageId?: string;
    providerSessionId?: string;
  }): void;
  starting(attemptId: string): void;
  running(attemptId: string, providerSessionId?: string): void;
  bindProviderSession(attemptId: string, providerSessionId: string): void;
  activity(attemptId: string, providerSessionId?: string): void;
  stopping(attemptId: string): void;
  terminal(input: {
    attemptId: string;
    state: TerminalTurnAttemptState;
    terminalCause: TurnTerminalCause;
    providerSessionId?: string;
  }): void;
}

export function createJournalTurnAttemptObserver(
  journal: TurnAttemptJournal,
  logger: StructuredObservabilityLogger = createStructuredObservabilityLogger()
): RuntimeTurnAttemptObserver {
  const observe = (attemptId: string, operation: Promise<unknown>): void => {
    void operation.catch(() => {
      logger.error('attempt_observation_failed', {
        serverBootId: journal.serverBootId,
        attemptId,
      });
    });
  };
  return {
    queued(input) {
      observe(input.attemptId, journal.startAttempt(input));
    },
    starting(attemptId) {
      observe(attemptId, journal.transitionAttempt({ attemptId, state: 'starting' }));
    },
    running(attemptId, providerSessionId) {
      observe(
        attemptId,
        journal.transitionAttempt({ attemptId, state: 'running', providerSessionId })
      );
    },
    bindProviderSession(attemptId, providerSessionId) {
      observe(attemptId, journal.bindProviderSession({ attemptId, providerSessionId }));
    },
    activity(attemptId, providerSessionId) {
      observe(attemptId, journal.touchAttempt({ attemptId, providerSessionId }));
    },
    stopping(attemptId) {
      observe(attemptId, journal.transitionAttempt({ attemptId, state: 'stopping' }));
    },
    terminal(input) {
      observe(input.attemptId, journal.finishAttempt(input));
    },
  };
}
