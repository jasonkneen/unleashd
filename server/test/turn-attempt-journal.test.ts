import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { StructuredObservabilityLogger } from '../src/observability';
import { TurnAttemptJournal, createJournalTurnAttemptObserver } from '../src/observability';

const silentLogger: StructuredObservabilityLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

test('journal records state, identifiers, terminal cause, and query projections', async (t) => {
  const directory = await temporaryDirectory(t);
  let timestamp = Date.parse('2026-07-29T00:00:00.000Z');
  let sequence = 0;
  const journal = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-1',
    now: () => new Date(timestamp++),
    createId: () => `id-${sequence++}`,
    logger: silentLogger,
  });

  await journal.initialize();
  const created = await journal.startAttempt({
    attemptId: 'attempt-1',
    conversationId: 'conversation-1',
    queueMessageId: 'queue-1',
  });
  assert.equal(created.state, 'queued');

  await journal.transitionAttempt({ attemptId: 'attempt-1', state: 'starting' });
  await journal.transitionAttempt({
    attemptId: 'attempt-1',
    state: 'running',
    providerSessionId: 'provider-session-1',
  });
  const finished = await journal.finishAttempt({
    attemptId: 'attempt-1',
    state: 'failed',
    terminalCause: 'provider_error',
  });

  assert.equal(finished.state, 'failed');
  assert.equal(finished.terminalCause, 'provider_error');
  assert.deepEqual(Object.keys(finished.stateTimestamps), [
    'queued',
    'starting',
    'running',
    'failed',
  ]);
  assert.ok(finished.startedAt);
  assert.ok(finished.terminalAt);
  assert.equal((await journal.queryAttempts({ conversationId: 'conversation-1' })).length, 1);
  assert.equal((await journal.recentEvents({ attemptId: 'attempt-1' })).length, 4);

  const persisted = await fs.promises.readFile(path.join(directory, 'turn-attempts.jsonl'), 'utf8');
  assert.doesNotMatch(persisted, /"(prompt|content|message|errorMessage)"\s*:/i);
});

test('new boot interrupts attempts left running by a prior boot', async (t) => {
  const directory = await temporaryDirectory(t);
  const first = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-1',
    logger: silentLogger,
  });
  await first.initialize();
  await first.startAttempt({
    attemptId: 'attempt-running',
    conversationId: 'conversation-1',
  });
  await first.transitionAttempt({ attemptId: 'attempt-running', state: 'starting' });
  await first.transitionAttempt({ attemptId: 'attempt-running', state: 'running' });
  await fs.promises.appendFile(
    path.join(directory, 'turn-attempts.jsonl'),
    `${JSON.stringify({
      kind: 'server_boot',
      schemaVersion: 1,
      eventId: 'manually-edited',
      serverBootId: 'boot-1',
      timestamp: '2026-07-29T00:00:00.000Z',
      content: 'must-not-enter-query-results',
    })}\n`
  );

  const second = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-2',
    logger: silentLogger,
  });
  const initialized = await second.initialize();
  const recovered = await second.getAttempt('attempt-running');

  assert.equal(initialized.recoveredAttempts, 1);
  assert.equal(recovered?.state, 'interrupted');
  assert.equal(recovered?.terminalCause, 'server_restart');
  assert.equal(recovered?.originServerBootId, 'boot-1');
  assert.equal(
    (await second.recentEvents({ attemptId: 'attempt-running' })).at(-1)?.kind,
    'attempt_recovered'
  );
  assert.doesNotMatch(
    JSON.stringify(await second.recentEvents({ limit: 1_000 })),
    /must-not-enter/
  );
});

test('journal rotation keeps a bounded number of privacy-safe JSONL files', async (t) => {
  const directory = await temporaryDirectory(t);
  let sequence = 0;
  const journal = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-rotation',
    maxBytes: 1_024,
    maxRotatedFiles: 2,
    createId: () => `event-${sequence++}`,
    logger: silentLogger,
  });
  await journal.initialize();

  for (let index = 0; index < 12; index += 1) {
    await journal.startAttempt({
      attemptId: `attempt-${index}`,
      conversationId: `conversation-${index}`,
    });
  }

  const files = (await fs.promises.readdir(directory)).filter((file) =>
    file.startsWith('turn-attempts.jsonl')
  );
  assert.ok(files.length <= 3);
  assert.ok(files.includes('turn-attempts.jsonl'));
  assert.ok(files.includes('turn-attempts.jsonl.1'));
  assert.ok((await journal.recentEvents({ limit: 1_000 })).length > 0);
});

test('runtime observer preserves async ordering and queue/provider correlation', async (t) => {
  const directory = await temporaryDirectory(t);
  const journal = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-observer',
    logger: silentLogger,
  });
  await journal.initialize();
  const observer = createJournalTurnAttemptObserver(journal, silentLogger);

  observer.queued({
    attemptId: 'attempt-observer',
    conversationId: 'conversation-observer',
    queueMessageId: 'queue-observer',
    providerSessionId: 'provisional-session',
  });
  observer.starting('attempt-observer');
  observer.running('attempt-observer', 'provisional-session');
  observer.bindProviderSession('attempt-observer', 'actual-provider-session');
  observer.activity('attempt-observer', 'actual-provider-session');
  observer.terminal({
    attemptId: 'attempt-observer',
    state: 'succeeded',
    terminalCause: 'provider_complete',
    providerSessionId: 'actual-provider-session',
  });
  await journal.flush();

  const attempt = await journal.getAttempt('attempt-observer');
  assert.equal(attempt?.state, 'succeeded');
  assert.equal(attempt?.queueMessageId, 'queue-observer');
  assert.equal(attempt?.providerSessionId, 'actual-provider-session');
  assert.equal(attempt?.terminalCause, 'provider_complete');
  assert.deepEqual(Object.keys(attempt?.stateTimestamps ?? {}), [
    'queued',
    'starting',
    'running',
    'succeeded',
  ]);
});

test('preflight failure can terminate an attempt before process startup', async (t) => {
  const directory = await temporaryDirectory(t);
  const journal = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-preflight',
    logger: silentLogger,
  });
  await journal.initialize();
  await journal.startAttempt({
    attemptId: 'attempt-preflight',
    conversationId: 'conversation-preflight',
  });
  const failed = await journal.finishAttempt({
    attemptId: 'attempt-preflight',
    state: 'failed',
    terminalCause: 'spawn_failed',
  });

  assert.equal(failed.state, 'failed');
  assert.equal(failed.terminalCause, 'spawn_failed');
});

test('initialization separates a partial trailing JSONL record from new events', async (t) => {
  const directory = await temporaryDirectory(t);
  const filePath = path.join(directory, 'turn-attempts.jsonl');
  const first = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-partial-1',
    logger: silentLogger,
  });
  await first.initialize();
  await first.startAttempt({
    attemptId: 'attempt-before-partial',
    conversationId: 'conversation-partial',
  });
  await fs.promises.appendFile(filePath, '{"kind":"partial');

  const second = new TurnAttemptJournal({
    directory,
    serverBootId: 'boot-partial-2',
    logger: silentLogger,
  });
  await second.initialize();
  const persisted = await fs.promises.readFile(filePath, 'utf8');

  assert.match(persisted, /\{"kind":"partial\n\{"kind":"server_boot"/);
  assert.equal((await second.getAttempt('attempt-before-partial'))?.state, 'interrupted');
});

async function temporaryDirectory(t: test.TestContext): Promise<string> {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'unleashd-observability-'));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  return directory;
}
