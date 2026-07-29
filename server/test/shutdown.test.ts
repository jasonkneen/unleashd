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
  let activeSchedulerRuns = 0;
  let schedulerPauses = 0;
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
    activeSchedulerRuns: () => activeSchedulerRuns,
    pauseScheduler: () => {
      schedulerPauses += 1;
    },
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
    setActive: (value: boolean) => {
      active = value;
    },
    setActiveSchedulerRuns: (value: number) => {
      activeSchedulerRuns = value;
    },
    counts: () => ({ schedulerPauses, schedulerStops, flushes, exits, processStops }),
  };
}

test('SIGTERM claims shutdown before its single flush can be re-entered', async () => {
  const fixture = createFixture(false);
  const controller = createShutdownController({ forceExitGraceMs: 3_000 }, fixture.ports);

  controller.handleSigterm();
  controller.handleSigterm();

  assert.equal(controller.state, 'exiting');
  assert.deepEqual(fixture.counts(), {
    schedulerPauses: 0,
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

test('reload waits for active turns and coalesces repeated requests', async () => {
  const fixture = createFixture(true);
  const controller = createShutdownController({ forceExitGraceMs: 60_000 }, fixture.ports);
  assert.equal(controller.beginMutation(), null);
  const startupCreation = controller.beginMutation({ allowDuringStartup: true });
  assert.ok(startupCreation);
  startupCreation();
  assert.equal(controller.completeStartup(), true);
  const admissionProbe = controller.beginMutation();
  assert.ok(admissionProbe);
  admissionProbe();

  controller.handleReload();
  assert.equal(controller.state, 'reloading');
  assert.equal(controller.beginMutation(), null);
  controller.handleReload();

  assert.deepEqual(fixture.counts(), {
    schedulerPauses: 1,
    schedulerStops: 0,
    flushes: 0,
    exits: 0,
    processStops: 0,
  });
  assert.equal(fixture.conversation.messages.length, 0);

  fixture.setActive(false);
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(fixture.counts().flushes, 1);
  fixture.pendingFlush.resolve();
  await fixture.pendingFlush.promise;
  await Promise.resolve();
  assert.equal(fixture.counts().exits, 1);
  controller.dispose();
});

test('reload drains an admitted mutation before exit', async () => {
  const fixture = createFixture(false);
  const controller = createShutdownController({ forceExitGraceMs: 60_000 }, fixture.ports);
  assert.equal(controller.completeStartup(), true);
  const release = controller.beginMutation();
  assert.ok(release);

  controller.handleReload();
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(fixture.counts().flushes, 0);

  release();
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(fixture.counts().flushes, 1);
  fixture.pendingFlush.resolve();
  await fixture.pendingFlush.promise;
  controller.dispose();
});

test('reload drains the automation run beyond its individual provider turn', async () => {
  const fixture = createFixture(false);
  fixture.setActiveSchedulerRuns(1);
  const controller = createShutdownController({ forceExitGraceMs: 60_000 }, fixture.ports);
  assert.equal(controller.completeStartup(), true);

  controller.handleReload();
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(fixture.counts().flushes, 0);

  fixture.setActiveSchedulerRuns(0);
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(fixture.counts().flushes, 1);
  fixture.pendingFlush.resolve();
  await fixture.pendingFlush.promise;
  controller.dispose();
});
