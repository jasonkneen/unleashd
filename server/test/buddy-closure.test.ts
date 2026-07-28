import assert from 'node:assert/strict';
import test from 'node:test';
import { BuddiesStore } from '@nbardy/buddies';
import { BuddyClosureService } from '../src/buddies/closure';
import type { BuddiesStorePort } from '../src/buddies/contract';

function fixture() {
  const store = new BuddiesStore(':memory:');
  const workspace = store.createWorkspace({ name: 'Workspace', rootPath: '/tmp/buddy-closure' });
  const lead = store.createBuddy({
    project: workspace.id,
    name: 'Lead',
    role: 'Own outcomes',
  });
  const critic = store.createBuddy({
    project: workspace.id,
    name: 'Critic',
    role: 'Pressure-test work',
  });
  return { store, workspace, lead, critic };
}

test('conversation closure settles delegation and structured review exactly once', () => {
  const { store, workspace, lead, critic } = fixture();
  try {
    const leadProject = store.newProject({
      buddy: lead.id,
      workspace: workspace.id,
      title: 'Launch',
      definitionOfDone: 'Decision recorded',
    });
    const criticProject = store.newProject({
      buddy: critic.id,
      workspace: workspace.id,
      title: 'Critique',
      definitionOfDone: 'Critique delivered',
    });
    const delegation = store.createDelegation({
      fromBuddy: lead.id,
      toBuddy: critic.id,
      workspace: workspace.id,
      project: leadProject.id,
      purpose: 'Pressure-test launch',
      childConversationId: 'conversation-1',
      status: 'active',
    });
    const review = store.createReview({
      reviewer: lead.id,
      subject: critic.id,
      workspace: workspace.id,
      project: criticProject.id,
      conversationId: 'conversation-1',
    });
    const closure = new BuddyClosureService(store as unknown as BuddiesStorePort);
    const first = closure.settleConversation({
      conversationId: 'conversation-1',
      status: 'complete',
      outcome: 'Critique delivered and reviewed.',
      review: {
        verdict: 'needs_work',
        score: 70,
        summary: 'The critique found the risk but did not quantify it.',
        evidence: [
          {
            kind: 'conversation',
            reference: 'conversation-1',
            observation: 'The switching-cost claim had no measured baseline.',
          },
        ],
        requiredActions: ['Add a measured baseline.'],
      },
    });
    assert.equal(first.delegations[0].status, 'complete');
    assert.equal(first.reviews[0].status, 'complete');
    assert.equal(store.getDelegation(delegation.id).completed_at != null, true);
    assert.equal(store.getReview(review.id).evidence.length, 2);
    assert.equal(store.listAuditEvents({ buddy: lead.id }).length, 2);

    const second = closure.settleConversation({
      conversationId: 'conversation-1',
      status: 'complete',
      outcome: 'Duplicate lifecycle notification.',
      review: {
        verdict: 'pass',
        summary: 'Must not overwrite the first settlement.',
        evidence: [
          {
            kind: 'conversation',
            reference: 'conversation-1',
            observation: 'Duplicate.',
          },
        ],
      },
    });
    assert.equal(second.reviews[0].verdict, 'needs_work');
    assert.equal(store.listAuditEvents({ buddy: lead.id }).length, 2);
  } finally {
    store.close();
  }
});

test('review closure requires evidence and failure cancels the draft review', () => {
  const { store, workspace, lead, critic } = fixture();
  try {
    const review = store.createReview({
      reviewer: lead.id,
      subject: critic.id,
      workspace: workspace.id,
      conversationId: 'conversation-2',
    });
    const closure = new BuddyClosureService(store as unknown as BuddiesStorePort);
    assert.throws(
      () =>
        closure.settleConversation({
          conversationId: 'conversation-2',
          status: 'complete',
          outcome: 'No structured result.',
        }),
      /structured review result/
    );
    assert.equal(store.getReview(review.id).status, 'draft');

    closure.settleConversation({
      conversationId: 'conversation-2',
      status: 'failed',
      outcome: 'Provider process failed.',
    });
    assert.equal(store.getReview(review.id).status, 'cancelled');
    assert.equal(store.listAuditEvents({ buddy: lead.id }).length, 1);
  } finally {
    store.close();
  }
});
