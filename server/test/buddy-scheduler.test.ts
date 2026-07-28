import assert from 'node:assert/strict';
import test from 'node:test';
import { BuddyContextSchema, ConversationSchema } from '@unleashd/shared';
import { extractBuddyContext } from '../src/adapters/jsonl';
import type {
  BuddiesStorePort,
  BuddyAutomation,
  BuddyAutomationRun,
} from '../src/buddies/contract';
import { BuddyScheduler, nextAutomationRunAt } from '../src/buddies/scheduler';

function automation(overrides: Partial<BuddyAutomation> = {}): BuddyAutomation {
  return {
    id: 'automation-1',
    buddy_id: 'buddy-1',
    workspace_id: 'workspace-1',
    buddy_project_id: null,
    name: 'Daily review',
    schedule_kind: 'interval',
    schedule_expression: '60',
    timezone: 'UTC',
    job_kind: 'prompt',
    job_payload: { prompt: 'Review growth' },
    enabled: true,
    next_run_at: '2026-01-01T00:00:00.000Z',
    last_run_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('nextAutomationRunAt handles intervals and timezone-aware cron', () => {
  assert.equal(
    nextAutomationRunAt(automation(), new Date('2026-01-01T00:00:00.000Z')),
    '2026-01-01T00:01:00.000Z'
  );
  assert.equal(
    nextAutomationRunAt(
      automation({
        schedule_kind: 'cron',
        schedule_expression: '0 9 * * *',
        timezone: 'Asia/Seoul',
      }),
      new Date('2026-01-01T00:00:00.000Z')
    ),
    '2026-01-02T00:00:00.000Z'
  );
});

test('cron follows standard OR semantics when day-of-month and weekday are both restricted', () => {
  assert.equal(
    nextAutomationRunAt(
      automation({
        schedule_kind: 'cron',
        schedule_expression: '0 9 15 * 1',
        timezone: 'UTC',
      }),
      new Date('2026-01-05T09:00:00.000Z')
    ),
    '2026-01-12T09:00:00.000Z'
  );
});

test('Buddy context is typed conversation metadata independent of swarm state', () => {
  const buddyContext = BuddyContextSchema.parse({
    buddyId: 'buddy-1',
    workspaceId: 'workspace-1',
    automationRunId: null,
  });
  const conversation = ConversationSchema.parse({
    id: '00000000-0000-4000-8000-000000000001',
    messages: [],
    isRunning: false,
    createdAt: new Date(),
    workingDirectory: '/tmp',
    config: {
      provider: 'claude',
      model: { mode: 'default' },
      reasoning: { mode: 'default' },
    },
    configRevision: 0,
    configResolution: {
      status: 'resolved',
      catalogRevision: 'test',
      value: { provider: 'claude', modelId: 'opus' },
    },
    buddyContext,
  });
  assert.deepEqual(conversation.buddyContext, buddyContext);
  assert.equal(conversation.isWorker, false);
  assert.equal(conversation.swarmId, undefined);
  assert.equal(conversation.swarmDebugPrefix, undefined);
});

test('Buddy sentinel hydration restores metadata and keeps the visible user prompt clean', () => {
  const context = {
    buddyId: 'buddy-1',
    workspaceId: 'workspace-1',
    delegatedByBuddyId: null,
  };
  const messages = [
    {
      role: 'user' as const,
      content: `<!-- unleashd:buddy-context ${JSON.stringify(context)} -->\nhidden soul and memory\n<!-- /unleashd:buddy-context -->\n\nWhat should we ship?`,
      timestamp: new Date(),
    },
  ];
  assert.deepEqual(extractBuddyContext(messages), context);
  assert.equal(messages[0].content, 'What should we ship?');
});

test('scheduler executes bounded loop and records each iteration once', async () => {
  const definition = automation({
    job_kind: 'loop',
    job_payload: {
      prompt: 'Improve campaign',
      termination: {
        condition: 'campaign is ready',
        max_iterations: 3,
        max_duration_seconds: 30,
      },
    },
  });
  let run: BuddyAutomationRun = {
    id: 'run-1',
    automation_id: definition.id,
    scheduled_for: definition.next_run_at!,
    idempotency_key: 'automation-1:2026-01-01',
    status: 'claimed',
    conversation_id: null,
    iteration: 0,
    outcome: null,
    error: null,
    claimed_at: definition.next_run_at!,
    started_at: null,
    ended_at: null,
  };
  const prompts: string[] = [];
  const store = {
    listDueAutomations: () => [definition],
    claimAutomationRun: () => run,
    updateAutomationRun: (_id: string, changes: Partial<BuddyAutomationRun>) => {
      run = { ...run, ...changes };
      return run;
    },
    getAutomation: () => definition,
  } as unknown as BuddiesStorePort;
  const scheduler = new BuddyScheduler({
    store,
    now: () => new Date(definition.next_run_at!),
    createConversation: async () => ({
      conversationId: 'conversation-1',
      async runTurn(prompt) {
        prompts.push(prompt);
        return prompts.length === 2 ? '[BUDDY_AUTOMATION_DONE]' : 'continue';
      },
      stop() {},
      finish() {},
    }),
  });

  await scheduler.poll();
  for (let attempt = 0; attempt < 20 && run.status !== 'complete'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  assert.equal(run.status, 'complete');
  assert.equal(run.iteration, 2);
  assert.equal(prompts.length, 2);
  assert.match(prompts[0], /Termination condition: campaign is ready/);
});

test('scheduler fails a bounded loop that exhausts iterations without its sentinel', async () => {
  const definition = automation({
    job_kind: 'loop',
    job_payload: {
      prompt: 'Improve campaign',
      termination: {
        condition: 'campaign is ready',
        max_iterations: 2,
        max_duration_seconds: 30,
      },
    },
  });
  let run: BuddyAutomationRun = {
    id: 'run-exhausted',
    automation_id: definition.id,
    scheduled_for: definition.next_run_at!,
    idempotency_key: 'automation-1:exhausted',
    status: 'claimed',
    conversation_id: null,
    iteration: 0,
    outcome: null,
    error: null,
    claimed_at: definition.next_run_at!,
    started_at: null,
    ended_at: null,
  };
  const store = {
    listDueAutomations: () => [definition],
    claimAutomationRun: () => run,
    updateAutomationRun: (_id: string, changes: Partial<BuddyAutomationRun>) => {
      run = { ...run, ...changes };
      return run;
    },
    getAutomation: () => definition,
  } as unknown as BuddiesStorePort;
  const scheduler = new BuddyScheduler({
    store,
    now: () => new Date(definition.next_run_at!),
    logger: { warn() {}, error() {} },
    createConversation: async () => ({
      conversationId: 'conversation-exhausted',
      async runTurn() {
        return 'continue';
      },
      stop() {},
      finish() {},
    }),
  });

  await scheduler.poll();
  for (let attempt = 0; attempt < 20 && run.status !== 'failed'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  assert.equal(run.status, 'failed');
  assert.equal(run.iteration, 2);
  assert.match(run.error ?? '', /did not satisfy its termination condition/);
});

test('overdue intervals schedule from now instead of replaying missed ticks', async () => {
  const definition = automation();
  const now = new Date('2026-01-01T01:00:00.000Z');
  let run: BuddyAutomationRun = {
    id: 'run-overdue',
    automation_id: definition.id,
    scheduled_for: definition.next_run_at!,
    idempotency_key: 'automation-1:overdue',
    status: 'claimed',
    conversation_id: null,
    iteration: 0,
    outcome: null,
    error: null,
    claimed_at: now.toISOString(),
    started_at: null,
    ended_at: null,
  };
  let recordedNextRunAt: string | undefined;
  const store = {
    listDueAutomations: () => [definition],
    claimAutomationRun: () => run,
    updateAutomationRun: (
      _id: string,
      changes: Partial<BuddyAutomationRun> & { nextRunAt?: string }
    ) => {
      recordedNextRunAt = changes.nextRunAt ?? recordedNextRunAt;
      run = { ...run, ...changes };
      return run;
    },
    getAutomation: () => definition,
  } as unknown as BuddiesStorePort;
  const scheduler = new BuddyScheduler({
    store,
    now: () => now,
    createConversation: async () => ({
      conversationId: 'conversation-overdue',
      async runTurn() {
        return 'done';
      },
      stop() {},
      finish() {},
    }),
  });

  await scheduler.poll();
  for (let attempt = 0; attempt < 20 && run.status !== 'complete'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  assert.equal(recordedNextRunAt, '2026-01-01T01:01:00.000Z');
});

test('scheduler fails and advances a run interrupted by process restart', async () => {
  const definition = automation();
  const now = new Date('2026-01-01T01:00:00.000Z');
  let run: BuddyAutomationRun = {
    id: 'run-interrupted',
    automation_id: definition.id,
    scheduled_for: definition.next_run_at!,
    idempotency_key: 'automation-1:interrupted',
    status: 'running',
    conversation_id: 'old-conversation',
    iteration: 1,
    outcome: null,
    error: null,
    claimed_at: definition.next_run_at!,
    started_at: definition.next_run_at!,
    ended_at: null,
  };
  let recordedNextRunAt: string | undefined;
  const store = {
    listDueAutomations: () => [definition],
    claimAutomationRun: () => run,
    updateAutomationRun: (
      _id: string,
      changes: Partial<BuddyAutomationRun> & { nextRunAt?: string }
    ) => {
      recordedNextRunAt = changes.nextRunAt;
      run = { ...run, ...changes };
      return run;
    },
    getAutomation: () => definition,
  } as unknown as BuddiesStorePort;
  const scheduler = new BuddyScheduler({
    store,
    now: () => now,
    createConversation: async () => {
      throw new Error('recovered runs must not create a second conversation');
    },
  });

  await scheduler.poll();

  assert.equal(run.status, 'failed');
  assert.equal(run.error, 'Automation interrupted by scheduler restart');
  assert.equal(recordedNextRunAt, '2026-01-01T01:01:00.000Z');
});
