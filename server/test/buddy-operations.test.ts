import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BuddiesStore } from '@nbardy/buddies';
import type { BuddiesStorePort } from '../src/buddies/contract';
import { BuddyOperationsService } from '../src/buddies/operations';

test('scoped Buddy operations close work, remember, delegate, review, and audit', () => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-operations-'));
  const store = new BuddiesStore(':memory:');
  try {
    const workspace = store.createWorkspace({ name: 'Workspace', rootPath: root });
    const lead = store.createBuddy({
      project: workspace.id,
      name: 'Lead',
      role: 'Own outcomes',
      memoryPath: 'lead-memory',
    });
    const operator = store.createBuddy({
      project: workspace.id,
      name: 'Operator',
      role: 'Execute bounded work',
    });
    const operations = new BuddyOperationsService(store as unknown as BuddiesStorePort, {
      buddyId: lead.id,
      workspaceId: workspace.id,
    });

    const created = operations.execute('buddy.new_project', {
      title: 'Launch proof cell',
      definitionOfDone: 'Evidence-backed decision recorded',
      status: 'in_progress',
      nextAction: 'Run proof cell',
      todos: [{ title: 'Run proof cell', status: 'in_progress' }],
    });
    const project = created.data as {
      id: string;
      todos: Array<{ id: string }>;
    };
    assert.throws(
      () =>
        operations.execute('buddy.update_project', {
          projectId: project.id,
          status: 'done',
        }),
      /evidence is required/
    );
    const completed = operations.execute('buddy.update_project', {
      projectId: project.id,
      status: 'done',
      evidence: ['metric:proof-cell-1'],
      todoOperations: [{ operation: 'update', todoId: project.todos[0].id, status: 'done' }],
    });
    assert.equal((completed.data as { status: string }).status, 'done');

    const memory = operations.execute('buddy.remember', {
      kind: 'curated',
      content: 'Proof requires an external-use decision.',
    });
    assert.match((memory.data as { content: string }).content, /external-use decision/);
    store.remember(lead.id, {
      content: 'Daily execution note.',
      date: '2026-07-01T00:00:00.000Z',
    });
    const compactedMemory = operations.execute('buddy.compact_memory', {
      summary: 'The execution note was incorporated into durable memory.',
      retainDays: 0,
    });
    assert.equal((compactedMemory.data as { compact: boolean }).compact, true);

    const delegated = operations.execute('buddy.delegate', {
      toBuddyId: operator.id,
      purpose: 'Pressure-test the proof',
      projectId: project.id,
    });
    const delegationId = (delegated.data as { id: string }).id;
    const settled = operations.execute('buddy.complete_delegation', {
      delegationId,
      outcome: 'The proof passed with one required correction.',
    });
    assert.equal((settled.data as { status: string }).status, 'complete');

    const operatorProject = store.newProject({
      buddy: operator.id,
      workspace: workspace.id,
      title: 'Repair proof',
      definitionOfDone: 'Correction verified',
    });
    const review = store.createReview({
      reviewer: lead.id,
      subject: operator.id,
      workspace: workspace.id,
      project: operatorProject.id,
    });
    const submitted = operations.execute('buddy.submit_review', {
      reviewId: review.id,
      verdict: 'needs_work',
      score: 65,
      summary: 'The correction is directionally right but not verified.',
      evidence: [
        {
          kind: 'project',
          reference: operatorProject.id,
          observation: 'The verification todo is still open.',
        },
      ],
      requiredActions: ['Close the verification todo with a metric reference.'],
    });
    assert.equal((submitted.data as { status: string }).status, 'complete');

    assert.throws(
      () =>
        operations.execute('buddy.update_project', {
          projectId: operatorProject.id,
          status: 'in_progress',
        }),
      /outside the conversation scope/
    );
    assert.equal(store.listAuditEvents({ buddy: lead.id }).length, 7);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
