import assert from 'node:assert/strict';
import test from 'node:test';
import { createParser } from '@nbardy/agent-cli';

// The raw shape is interpreted by the harness boundary, never by app helpers.
test('native sub-agent ingress handles partial and malformed child reports', () => {
  const parse = createParser('codex');
  const events = parse({
    type: 'item.completed',
    item: {
      type: 'collab_tool_call',
      tool: 'spawn_agent',
      receiver_thread_ids: ['pending', 42, 'missing'],
      prompt: '  Work  ',
      agents_states: {
        pending: { status: 'mystery_state', message: null },
        finished: { status: 'completed', message: '  done  ' },
        failed: { status: 'cancelled_by_parent' },
        invalid: 'not-an-object',
        array: [],
      },
    },
  });
  const states = events.filter((event) => event.type === 'subagent.state');
  assert.equal(events.length, states.length, 'no duplicate raw tool events');
  assert.deepEqual(
    states.map((event) => [event.id, event.status, event.operationId]),
    [
      ['pending', 'pending', undefined],
      ['missing', 'pending', undefined],
      ['finished', 'completed', undefined],
      ['failed', 'error', undefined],
    ]
  );
  assert.ok(states.every((event) => event.description === '[Codex Agent] Work'));
  assert.equal(states.find((event) => event.id === 'finished')?.message, 'done');
  const unidentified = parse({
    type: 'item.completed',
    item: {
      type: 'collab_tool_call',
      tool: 'wait',
      receiver_thread_ids: 'not-an-array',
      agents_states: [],
    },
  });
  assert.equal(unidentified.length, 1);
  assert.equal(unidentified[0].type, 'tool.use', 'a childless attempt is still tool activity');
});
