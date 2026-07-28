import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTurnDiagnosticsViewModel,
  isActiveTurnStatus,
  isNonterminalAttemptState,
  shouldPresentTurnAttempt,
  turnDiagnosticsFromAttempt,
  turnDiagnosticsPollDelay,
} from '../src/components/turn-diagnostics';

const baseAttempt = {
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:02.000Z',
};

test('attempt projection preserves every nonterminal lifecycle state', () => {
  for (const state of ['queued', 'starting', 'running', 'stopping'] as const) {
    const diagnostics = turnDiagnosticsFromAttempt({ ...baseAttempt, state });
    const view = buildTurnDiagnosticsViewModel(
      diagnostics,
      new Date('2026-07-29T00:00:05.000Z').getTime()
    );
    const expected = state[0].toUpperCase() + state.slice(1);
    assert.equal(diagnostics.status, state);
    assert.equal(view.label, expected);
    assert.equal(view.duration, '5s');
    assert.equal(isActiveTurnStatus(diagnostics.status), true);
    assert.equal(isNonterminalAttemptState(state), true);
  }
});

test('active runtime suppresses a stale terminal attempt until the current attempt appears', () => {
  const previousTerminal = { ...baseAttempt, state: 'succeeded' } as const;
  const currentRunning = { ...baseAttempt, state: 'running' } as const;

  assert.equal(shouldPresentTurnAttempt(previousTerminal, true), false);
  assert.equal(shouldPresentTurnAttempt(currentRunning, true), true);
  assert.equal(shouldPresentTurnAttempt(previousTerminal, false), true);
});

test('diagnostics polling retries 404 with bounded exponential backoff', () => {
  assert.equal(turnDiagnosticsPollDelay(false, null, 1), 1_000);
  assert.equal(turnDiagnosticsPollDelay(false, null, 2), 2_000);
  assert.equal(turnDiagnosticsPollDelay(false, null, 6), 30_000);
  assert.equal(turnDiagnosticsPollDelay(false, null, 20), 30_000);
  assert.equal(turnDiagnosticsPollDelay(true, null, 0), 2_000);
  assert.equal(turnDiagnosticsPollDelay(false, 'running', 0), 2_000);
  assert.equal(turnDiagnosticsPollDelay(false, 'succeeded', 0), 30_000);
});

test('terminal projection remains distinct from active lifecycle states', () => {
  const interrupted = turnDiagnosticsFromAttempt({
    ...baseAttempt,
    state: 'interrupted',
    terminalCause: 'server_restart',
    terminalAt: '2026-07-29T00:00:04.000Z',
  });
  const view = buildTurnDiagnosticsViewModel(interrupted);

  assert.equal(interrupted.status, 'aborted');
  assert.equal(view.label, 'Interrupted by restart');
  assert.equal(view.duration, '4s');
  assert.equal(isActiveTurnStatus(interrupted.status), false);
  assert.equal(isNonterminalAttemptState('interrupted'), false);
});
