import assert from 'node:assert/strict';
import test from 'node:test';
import type { Message } from '@unleashd/shared';
import {
  type ShutdownConversation,
  type ShutdownPorts,
  createShutdownController,
} from '../src/lifecycle/shutdown';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createFixture(activeInitially: boolean) {
  let active = activeInitially;
  let schedulerStops = 0;
  let flushes = 0;
  let exits = 0;
  let processStops = 0;
  const pendingFlush = deferred();
  const messages: Message[] = [];
  const conversation: ShutdownConversation = {
    id: 'conversation-1',
    messages,
    process: null,
    hasActiveProcess: () => active,
    stop: () => {
      processStops += 1;
      active = false;
    },
  };
  const ports: ShutdownPorts = {
    conversations: () => [conversation],
    stopScheduler: () => {
      schedulerStops += 1;
    },
    flushState: () => {
      flushes += 1;
      return pendingFlush.promise;
    },
    broadcastMessage: () => undefined,
    exit: () => {
      exits += 1;
    },
  };
  return {
    conversation,
    pendingFlush,
    ports,
    counts: () => ({ schedulerStops, flushes, exits, processStops }),
  };
}

test('SIGTERM claims shutdown before its single flush can be re-entered', async () => {
  const fixture = createFixture(false);
  const controller = createShutdownController(
    { drainTimeoutMs: 60_000, forceExitGraceMs: 3_000 },
    fixture.ports
  );

  controller.handleSigterm();
  controller.handleSigterm();

  assert.equal(controller.state, 'exiting');
  assert.deepEqual(fixture.counts(), {
    schedulerStops: 1,
    flushes: 1,
    exits: 0,
    processStops: 0,
  });

  fixture.pendingFlush.resolve();
  await fixture.pendingFlush.promise;
  await Promise.resolve();
  assert.equal(fixture.counts().exits, 1);
  controller.dispose();
});

test('repeated SIGTERM advances draining to forcing to one idempotent exit', async () => {
  const fixture = createFixture(true);
  const controller = createShutdownController(
    { drainTimeoutMs: 60_000, forceExitGraceMs: 60_000 },
    fixture.ports
  );

  controller.handleSigterm();
  assert.equal(controller.state, 'draining');
  controller.handleSigterm();
  assert.equal(controller.state, 'forcing');
  controller.handleSigterm();
  assert.equal(controller.state, 'exiting');

  assert.deepEqual(fixture.counts(), {
    schedulerStops: 1,
    flushes: 1,
    exits: 0,
    processStops: 1,
  });
  assert.equal(fixture.conversation.messages.length, 1);

  fixture.pendingFlush.resolve();
  await fixture.pendingFlush.promise;
  await Promise.resolve();
  assert.equal(fixture.counts().exits, 1);
  controller.dispose();
});
