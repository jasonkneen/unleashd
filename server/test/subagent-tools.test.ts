import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractCodexCollabToolInput,
  getCodexSubagentCurrentAction,
  isCodexCollabToolName,
  normalizeCodexSubagentStatus,
} from '../src/subagent-tools';

test('extractCodexCollabToolInput preserves phase, receiver ids, and per-child agent states', () => {
  const parsed = extractCodexCollabToolInput({
    _phase: 'completed',
    prompt: 'Write file_1.md',
    sender_thread_id: 'thread-parent',
    status: 'completed',
    receiver_thread_ids: ['thread-child-1'],
    agents_states: {
      'thread-child-1': { status: 'pending_init', message: null },
      'thread-child-2': { status: 'completed', message: 'SUBAGENTS_OK' },
      ignore_me: 'not-an-object',
    },
  });

  assert.equal(parsed.phase, 'completed');
  assert.equal(parsed.prompt, 'Write file_1.md');
  assert.equal(parsed.senderThreadId, 'thread-parent');
  assert.deepStrictEqual(parsed.receiverThreadIds, ['thread-child-1']);
  assert.deepStrictEqual(parsed.agentStates, {
    'thread-child-1': { status: 'pending_init', message: null },
    'thread-child-2': { status: 'completed', message: 'SUBAGENTS_OK' },
  });
});

test('normalizeCodexSubagentStatus folds codex runtime states into shared UI statuses', () => {
  assert.equal(normalizeCodexSubagentStatus('pending_init', 'running'), 'pending');
  assert.equal(normalizeCodexSubagentStatus('in_progress', 'pending'), 'running');
  assert.equal(normalizeCodexSubagentStatus('completed', 'running'), 'completed');
  assert.equal(normalizeCodexSubagentStatus('failed', 'running'), 'error');
  assert.equal(normalizeCodexSubagentStatus('cancelled_by_parent', 'running'), 'error');
  assert.equal(normalizeCodexSubagentStatus(undefined, 'running'), 'running');
  assert.equal(normalizeCodexSubagentStatus('mystery_state', 'pending'), 'pending');
});

test('getCodexSubagentCurrentAction prefers child messages and otherwise returns human-readable fallbacks', () => {
  assert.equal(getCodexSubagentCurrentAction('wait', 'completed', 'SUBAGENTS_OK'), 'SUBAGENTS_OK');
  assert.equal(
    getCodexSubagentCurrentAction('spawn_agent', 'pending_init', null),
    'Pending initialization'
  );
  assert.equal(getCodexSubagentCurrentAction('wait', 'in_progress', null), 'Waiting');
  assert.equal(
    getCodexSubagentCurrentAction('send_input', 'in_progress', null),
    'Sending follow-up'
  );
  assert.equal(getCodexSubagentCurrentAction('wait', 'failed', null), 'Error');
  assert.equal(getCodexSubagentCurrentAction('wait', 'completed', null), undefined);
});

test('isCodexCollabToolName recognizes the codex native sub-agent control tools', () => {
  assert.equal(isCodexCollabToolName('spawn_agent'), true);
  assert.equal(isCodexCollabToolName('wait'), true);
  assert.equal(isCodexCollabToolName('send_input'), true);
  assert.equal(isCodexCollabToolName('shell'), false);
});
