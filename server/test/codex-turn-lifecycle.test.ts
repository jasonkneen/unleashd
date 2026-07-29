import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyAbortReason,
  codexTurnInterruptionNotices,
  extractCodexTurnLifecycle,
  recoverOpenCodexTurns,
} from '../src/adapters/codex-turn-lifecycle';
import { getDiskAdapter } from '../src/adapters/registry';

test('Codex lifecycle projects completed turns with authoritative payload timing', () => {
  const snapshot = extractCodexTurnLifecycle([
    {
      timestamp: '2026-07-29T00:00:00.000Z',
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: 'turn-1', started_at: 1_785_283_200 },
    },
    {
      timestamp: '2026-07-29T00:00:05.000Z',
      type: 'response_item',
      payload: { type: 'reasoning' },
    },
    {
      timestamp: '2026-07-29T00:00:10.000Z',
      type: 'event_msg',
      payload: {
        type: 'task_complete',
        turn_id: 'turn-1',
        started_at: 1_785_283_200,
        completed_at: 1_785_283_210,
        duration_ms: 9_750,
      },
    },
  ]);

  assert.equal(snapshot.activeTurn, null);
  assert.equal(snapshot.latestTurn?.status, 'completed');
  assert.equal(snapshot.latestTurn?.terminalCause, 'completed');
  assert.equal(snapshot.latestTurn?.durationMs, 9_750);
  assert.equal(snapshot.latestTurn?.startedAt.toISOString(), '2026-07-29T00:00:00.000Z');
  assert.equal(snapshot.latestTurn?.completedAt?.toISOString(), '2026-07-29T00:00:10.000Z');
});

test('Codex lifecycle preserves explicit abort cause and open recovery state', () => {
  const snapshot = extractCodexTurnLifecycle([
    {
      timestamp: '2026-07-29T01:00:00.000Z',
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: 'aborted', started_at: 1_785_286_800 },
    },
    {
      timestamp: '2026-07-29T01:00:03.000Z',
      type: 'event_msg',
      payload: {
        type: 'turn_aborted',
        turn_id: 'aborted',
        reason: 'interrupted',
        started_at: 1_785_286_800,
        completed_at: 1_785_286_803,
      },
    },
    {
      timestamp: '2026-07-29T01:01:00.000Z',
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: 'open', started_at: 1_785_286_860 },
    },
  ]);

  assert.equal(snapshot.turns[0]?.status, 'aborted');
  assert.equal(snapshot.turns[0]?.terminalCause, 'interrupted');
  assert.equal(snapshot.turns[0]?.terminalReason, 'interrupted');
  assert.equal(snapshot.activeTurn?.turnId, 'open');
  assert.equal(snapshot.activeTurn?.status, 'running');
  assert.equal(snapshot.activeTurn?.terminalCause, null);
  assert.deepEqual(
    codexTurnInterruptionNotices(snapshot).map((notice) => notice.content),
    ['Turn interrupted.']
  );
});

test('abort reason classification distinguishes restart and failure observability', () => {
  assert.equal(classifyAbortReason('server restart'), 'restart');
  assert.equal(classifyAbortReason('process crashed'), 'error');
  assert.equal(classifyAbortReason('cancelled by user'), 'interrupted');
  assert.equal(classifyAbortReason('provider unavailable'), 'unknown');
});

test('recovery explicitly terminalizes open turns without guessing during extraction', () => {
  const extracted = extractCodexTurnLifecycle([
    {
      timestamp: '2026-07-29T02:00:00.000Z',
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: 'open', started_at: 1_785_290_400 },
    },
  ]);
  const recovered = recoverOpenCodexTurns(
    extracted,
    new Date('2026-07-29T02:00:12.000Z'),
    'server restarted while turn was active'
  );

  assert.equal(extracted.activeTurn?.status, 'running');
  assert.equal(recovered.activeTurn, null);
  assert.equal(recovered.latestTurn?.status, 'aborted');
  assert.equal(recovered.latestTurn?.terminalCause, 'restart');
  assert.equal(recovered.latestTurn?.durationMs, 12_000);
  assert.equal(recovered.latestTurn?.terminalReason, 'server restarted while turn was active');
  assert.deepEqual(codexTurnInterruptionNotices(extracted), []);
});

test('Codex disk hydration surfaces explicit aborts but not genuinely open turns', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'unleashd-codex-turn-'));
  const filePath = path.join(
    directory,
    'rollout-2026-07-29T03-00-00-019fabcd-0000-7000-8000-000000000001.jsonl'
  );
  const entries = [
    {
      timestamp: '2026-07-29T03:00:00.000Z',
      type: 'session_meta',
      payload: {
        id: '019fabcd-0000-7000-8000-000000000001',
        timestamp: '2026-07-29T03:00:00.000Z',
        cwd: directory,
        originator: 'codex_cli_rs',
        cli_version: '1.0.0',
        source: 'cli',
        model_provider: 'openai',
      },
    },
    {
      timestamp: '2026-07-29T03:00:00.000Z',
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: 'aborted', started_at: 1_785_294_000 },
    },
    {
      timestamp: '2026-07-29T03:00:02.000Z',
      type: 'event_msg',
      payload: {
        type: 'turn_aborted',
        turn_id: 'aborted',
        reason: 'interrupted',
        completed_at: 1_785_294_002,
      },
    },
    {
      timestamp: '2026-07-29T03:01:00.000Z',
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: 'still-open', started_at: 1_785_294_060 },
    },
  ];
  await fs.promises.writeFile(filePath, entries.map((entry) => JSON.stringify(entry)).join('\n'));

  try {
    const parsed = await getDiskAdapter('codex').parseFile(filePath);
    assert.deepEqual(
      parsed?.messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content),
      ['Turn interrupted.']
    );
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test('Codex disk hydration skips non-display rows and preserves response-message fallback', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codex-row-filter-'));
  const eventFile = path.join(
    directory,
    'rollout-2026-07-29T03-00-00-019fabcd-0000-7000-8000-000000000002.jsonl'
  );
  const fallbackFile = path.join(
    directory,
    'rollout-2026-07-29T03-00-01-019fabcd-0000-7000-8000-000000000003.jsonl'
  );
  const sessionMeta = (id: string) => ({
    timestamp: '2026-07-29T03:00:00.000Z',
    type: 'session_meta',
    payload: { id, cwd: directory },
  });
  const write = (filePath: string, entries: unknown[]) =>
    fs.promises.writeFile(filePath, entries.map((entry) => JSON.stringify(entry)).join('\n'));

  await write(eventFile, [
    sessionMeta('019fabcd-0000-7000-8000-000000000002'),
    {
      timestamp: '2026-07-29T03:00:00.000Z',
      type: 'response_item',
      payload: { type: 'message', role: 'user', content: 'fallback duplicate' },
    },
    { timestamp: '2026-07-29T03:00:00.000Z', type: 'world_state', payload: { text: 'noise' } },
    {
      timestamp: '2026-07-29T03:00:01.000Z',
      type: 'event_msg',
      payload: { type: 'user_message', message: 'visible event' },
    },
    {
      timestamp: '2026-07-29T03:00:02.000Z',
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'visible response' },
    },
    {
      timestamp: '2026-07-29T03:00:02.000Z',
      type: 'event_msg',
      payload: { type: 'token_count', info: { total_tokens: 1 } },
    },
  ]);
  await write(fallbackFile, [
    sessionMeta('019fabcd-0000-7000-8000-000000000003'),
    {
      timestamp: '2026-07-29T03:00:01.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'legacy prompt' }],
      },
    },
    {
      timestamp: '2026-07-29T03:00:02.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'legacy response' }],
      },
    },
  ]);

  try {
    const adapter = getDiskAdapter('codex');
    const eventSession = await adapter.parseFile(eventFile);
    const fallbackSession = await adapter.parseFile(fallbackFile);
    assert.deepEqual(
      eventSession?.messages.map((message) => message.content),
      ['visible event', 'visible response']
    );
    assert.deepEqual(
      fallbackSession?.messages.map((message) => message.content),
      ['legacy prompt', 'legacy response']
    );
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
