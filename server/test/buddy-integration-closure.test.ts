import assert from 'node:assert/strict';
import test from 'node:test';
import { BuddiesStore } from '@nbardy/buddies';
import type { BuddyContext } from '@unleashd/shared';
import {
  BUDDY_REVIEW_RESULT_END,
  BUDDY_REVIEW_RESULT_START,
  createBuddiesIntegration,
  parseBuddyReviewResult,
} from '../src/buddies/integration';

function delimitedReview(overrides: Record<string, unknown> = {}): string {
  return [
    'Review complete.',
    BUDDY_REVIEW_RESULT_START,
    JSON.stringify({
      verdict: 'needs_work',
      score: 72,
      summary: 'The launch claim needs a measured baseline.',
      evidence: [
        {
          kind: 'metric',
          reference: 'activation-rate',
          observation: 'No pre-launch baseline was recorded.',
        },
      ],
      requiredActions: ['Record the baseline before launch.'],
      ...overrides,
    }),
    BUDDY_REVIEW_RESULT_END,
  ].join('\n');
}

test('review parser accepts one raw delimited payload and ignores arbitrary embedded JSON', () => {
  assert.equal(
    parseBuddyReviewResult('Analysis follows: {"verdict":"pass","summary":"not a result"}'),
    undefined
  );
  const parsed = parseBuddyReviewResult(delimitedReview());
  assert.equal(parsed?.verdict, 'needs_work');
  assert.equal(parsed?.evidence.length, 1);

  assert.throws(
    () => parseBuddyReviewResult(`${delimitedReview()}\n${delimitedReview()}`),
    /exactly one/
  );
  assert.throws(
    () =>
      parseBuddyReviewResult(
        `${BUDDY_REVIEW_RESULT_START}\n\`\`\`json\n{}\n\`\`\`\n${BUDDY_REVIEW_RESULT_END}`
      ),
    /raw JSON/
  );
  assert.throws(
    () =>
      parseBuddyReviewResult(`inline ${BUDDY_REVIEW_RESULT_START}\n{}\n${BUDDY_REVIEW_RESULT_END}`),
    /own line/
  );
});

test('terminal integration settles delegated work and structured reviews but leaves ordinary JSON inert', async () => {
  const store = new BuddiesStore(':memory:');
  try {
    const workspace = store.createWorkspace({
      name: 'Workspace',
      rootPath: '/tmp/buddy-integration-closure',
    });
    const lead = store.createBuddy({
      project: workspace.id,
      name: 'Lead',
      role: 'Own outcome',
    });
    const critic = store.createBuddy({
      project: workspace.id,
      name: 'Critic',
      role: 'Review work',
    });
    const delegatedProject = store.newProject({
      buddy: lead.id,
      workspace: workspace.id,
      title: 'Launch',
      definitionOfDone: 'Launch decision recorded',
    });
    const delegation = store.createDelegation({
      fromBuddy: lead.id,
      toBuddy: critic.id,
      workspace: workspace.id,
      project: delegatedProject.id,
      purpose: 'Pressure-test launch',
      childConversationId: 'delegated-conversation',
      status: 'active',
    });
    const review = store.createReview({
      reviewer: critic.id,
      subject: lead.id,
      workspace: workspace.id,
      project: delegatedProject.id,
      conversationId: 'review-conversation',
    });
    const integration = createBuddiesIntegration({
      getConversation: () => undefined,
      loadModule: async () => ({
        BuddiesStore: function StoreConstructor() {
          return store;
        },
      }),
    });
    const context = (buddyId: string, delegatedByBuddyId?: string): BuddyContext => ({
      buddyId,
      workspaceId: workspace.id,
      delegatedByBuddyId: delegatedByBuddyId ?? null,
    });

    await integration.settleDelegation(
      {
        id: 'delegated-conversation',
        sessionId: 'session-1',
        provider: 'codex',
        buddyContext: context(critic.id, lead.id),
      },
      'complete',
      'Delegated critique completed.'
    );
    assert.equal(store.getDelegation(delegation.id)?.status, 'complete');

    await integration.settleDelegation(
      {
        id: 'review-conversation',
        sessionId: 'session-2',
        provider: 'codex',
        buddyContext: context(critic.id),
      },
      'complete',
      delimitedReview()
    );
    assert.equal(store.getReview(review.id)?.status, 'complete');
    assert.equal(store.getReview(review.id)?.verdict, 'needs_work');
    assert.equal(store.getReview(review.id)?.evidence.length, 2);

    const auditCount = store.listAuditEvents({ buddy: critic.id }).length;
    await integration.settleDelegation(
      {
        id: 'ordinary-conversation',
        sessionId: 'session-3',
        provider: 'codex',
        buddyContext: context(critic.id),
      },
      'complete',
      'Ordinary discussion containing {"verdict":"pass"}'
    );
    assert.equal(store.listAuditEvents({ buddy: critic.id }).length, auditCount);
  } finally {
    store.close();
  }
});

test('failed review conversation cancels its draft without requiring a result block', async () => {
  const store = new BuddiesStore(':memory:');
  try {
    const workspace = store.createWorkspace({
      name: 'Workspace',
      rootPath: '/tmp/buddy-integration-failure',
    });
    const reviewer = store.createBuddy({
      project: workspace.id,
      name: 'Reviewer',
      role: 'Review',
    });
    const subject = store.createBuddy({
      project: workspace.id,
      name: 'Subject',
      role: 'Execute',
    });
    const review = store.createReview({
      reviewer: reviewer.id,
      subject: subject.id,
      workspace: workspace.id,
      conversationId: 'failed-review',
    });
    const integration = createBuddiesIntegration({
      getConversation: () => undefined,
      loadModule: async () => ({
        BuddiesStore: function StoreConstructor() {
          return store;
        },
      }),
    });
    await integration.settleDelegation(
      {
        id: 'failed-review',
        sessionId: 'session-failed',
        provider: 'codex',
        buddyContext: {
          buddyId: reviewer.id,
          workspaceId: workspace.id,
        },
      },
      'failed'
    );
    assert.equal(store.getReview(review.id)?.status, 'cancelled');
  } finally {
    store.close();
  }
});
