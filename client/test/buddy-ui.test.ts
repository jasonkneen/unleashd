import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type {
  Buddy,
  BuddyOverview,
  BuddyOverviewEmployee,
  BuddyProject,
} from '../src/components/buddies/types';
import {
  buddyCardMetrics,
  buddyProjectTodoProgress,
  effectiveSwarmDebugPrefix,
  selectDirectoryEmployees,
} from '../src/components/buddies/ui-contract';
import {
  BUDDY_REVIEW_RESULT_RE,
  parseBuddyReviewRequest,
  parseBuddyReviewResult,
} from '../src/components/buddy-review-message';
import { splitStructuredMessageContent } from '../src/components/structured-message-segments';

const buddy = (id: string, name: string, managerId: string | null = null): Buddy => ({
  id,
  name,
  role: managerId ? 'Growth Operator' : 'Growth Lead',
  status: 'active',
  manager_id: managerId,
  soul_path: null,
  memory_path: null,
  provider: 'codex',
  model: null,
  reasoning_effort: null,
});

const employee = (
  employeeBuddy: Buddy,
  team: BuddyOverviewEmployee['team']
): BuddyOverviewEmployee => ({
  buddy: employeeBuddy,
  managerId: employeeBuddy.manager_id ?? null,
  workspaces: [
    {
      id: 'workspace-1',
      name: 'Magic Genie',
      root_path: '/git/magic_genie',
    },
  ],
  team,
  currentWork: {
    open: 7,
    active: 2,
    blocked: 1,
    review: 1,
    nextActionMissing: 0,
  },
});

test('directory selects only top-level employees and preserves team count', () => {
  const lead = employee(buddy('lead', 'Growth Lead'), [
    { id: 'report-1', name: 'SEO Operator', role: 'SEO', status: 'active' },
    { id: 'report-2', name: 'Campaign Operator', role: 'Campaigns', status: 'active' },
  ]);
  const report = employee(buddy('report-1', 'SEO Operator', 'lead'), []);
  const overview: BuddyOverview = {
    generatedAt: new Date(0).toISOString(),
    employees: [lead, report],
    topLevel: [lead],
    recentRuns: [],
  };

  assert.deepEqual(
    selectDirectoryEmployees(overview).map((item) => item.buddy.id),
    ['lead']
  );
  assert.deepEqual(buddyCardMetrics(lead), {
    team: 2,
    open: 7,
    active: 2,
    blocked: 1,
  });
});

test('directory never promotes reports when no top-level employee is returned', () => {
  const solo = employee(buddy('solo', 'Solo Buddy'), []);
  const overview: BuddyOverview = {
    generatedAt: new Date(0).toISOString(),
    employees: [solo],
    topLevel: [],
    recentRuns: [],
  };
  assert.deepEqual(selectDirectoryEmployees(overview), []);
});

test('Buddy context always suppresses the Swarm debug prefix', () => {
  const context = { buddyId: 'buddy-1', workspaceId: 'workspace-1' };
  assert.equal(effectiveSwarmDebugPrefix(context, '[Swarm DEBUG]'), null);
  assert.equal(effectiveSwarmDebugPrefix(null, '[Swarm DEBUG]'), '[Swarm DEBUG]');
});

test('project todo progress counts durable completion and excludes cancelled work', () => {
  const project = {
    todos: [
      { id: 'todo-1', title: 'Done', status: 'done' },
      { id: 'todo-2', title: 'Active', status: 'in_progress' },
      { id: 'todo-3', title: 'Dropped', status: 'cancelled' },
    ],
  } as Pick<BuddyProject, 'todos'>;

  assert.deepEqual(buddyProjectTodoProgress(project), { done: 1, total: 2 });
});

test('employee surface keeps conversation primary and omits project creation UI', () => {
  const source = readFileSync(path.resolve('src/components/BuddiesDashboard.tsx'), 'utf8');
  assert.match(source, /className="buddy-start-button"[\s\S]{0,180}Start conversation/);
  assert.doesNotMatch(source, />\s*New project\s*</);
});

test('current project rows expose operational state with one conversation action', () => {
  const source = readFileSync(path.resolve('src/components/BuddiesDashboard.tsx'), 'utf8');
  const start = source.indexOf('<div className="buddy-work-list">');
  const end = source.indexOf('{legacyWork.length > 0', start);
  assert.ok(start >= 0 && end > start, 'current project row source should be present');
  const projectRows = source.slice(start, end);

  assert.match(projectRows, /STATUS_LABELS\[project\.status\]/);
  assert.match(projectRows, /<strong>Next action<\/strong>/);
  assert.match(projectRows, /project\.blocked_reason/);
  assert.match(projectRows, /<strong>Blocker<\/strong>/);
  assert.match(projectRows, /<strong>Todos<\/strong>/);
  assert.match(projectRows, /todoProgress\.done.*todoProgress\.total/s);
  assert.equal(projectRows.match(/<button/g)?.length, 1);
  assert.match(
    projectRows,
    /existingConversation\s*\?\s*'Open conversation'\s*:\s*'Start conversation'/
  );
  assert.doesNotMatch(projectRows, /<form|<select|onChange=|updateProject/);
});

test('current project cards retain square edges and status-colored left rails', () => {
  const styles = readFileSync(path.resolve('src/components/BuddiesDashboard.css'), 'utf8');
  const start = styles.indexOf('.buddy-work-card {');
  const end = styles.indexOf('.buddy-work-card h3', start);
  const baseCard = styles.slice(start, end);
  assert.match(baseCard, /border-left:\s*3px solid/);
  assert.match(baseCard, /border-radius:\s*2px/);
  assert.match(
    styles,
    /\.buddy-work-card\.status-blocked\s*\{[\s\S]*border-left-color:\s*var\(--danger\)/
  );
});

test('grouped Recent Projects contains a dedicated Buddies folder', () => {
  const source = readFileSync(path.resolve('src/components/Sidebar.tsx'), 'utf8');
  assert.match(source, /Recent Projects/);
  assert.match(source, /folder-group--buddies/);
  assert.match(source, /toggleGalleryCollapsed\('__buddies__'\)/);
});

test('Buddy header language is independent from Swarm debug language', () => {
  const source = readFileSync(path.resolve('src/components/BuddyConvoHeader.tsx'), 'utf8');
  assert.match(source, />BUDDY</);
  assert.doesNotMatch(source, /Swarm|DEBUG/i);
});

test('generated Buddy review requests become structured request data', () => {
  const request = parseBuddyReviewRequest(
    [
      'Review requested by Buddy buddy_lead-123.',
      'Review id: review_abc-123.',
      'Review Buddy buddy_operator-456.',
      'No Buddy project was selected.',
      'Review purpose: Check the evidence without sending anything.',
      'Input evidence: [{"kind":"file","reference":"/tmp/proof.md","observation":"Packet exists."}]',
      'Allowed Buddy operations: buddy.get_current_work, buddy.submit_review.',
      'Use the native submit_review operation.',
    ].join('\n')
  );

  assert.deepEqual(request, {
    requestedByBuddyId: 'buddy_lead-123',
    reviewId: 'review_abc-123',
    subjectBuddyId: 'buddy_operator-456',
    projectId: null,
    purpose: 'Check the evidence without sending anything.',
    evidence: [{ kind: 'file', reference: '/tmp/proof.md', observation: 'Packet exists.' }],
    allowedOperations: ['buddy.get_current_work', 'buddy.submit_review'],
  });
  assert.equal(parseBuddyReviewRequest('Please review this ordinary paragraph.'), null);
});

test('older direct Buddy review prompts still become structured request data', () => {
  const request = parseBuddyReviewRequest(
    [
      'Review Buddy buddy_operator-456.',
      'Review id: review_legacy-123.',
      'Review purpose: Check the employee work.',
      'Use the native submit_review operation.',
    ].join('\n')
  );

  assert.deepEqual(request, {
    requestedByBuddyId: null,
    reviewId: 'review_legacy-123',
    subjectBuddyId: 'buddy_operator-456',
    projectId: null,
    purpose: 'Check the employee work.',
    evidence: [],
    allowedOperations: [],
  });
});

test('structured message adapters produce one normalized segment stream', () => {
  const content = [
    'Before',
    '<!--ask_user_question:{"questions":[]}-->',
    'Middle',
    '<!-- unleashd:buddy-review-result -->',
    '{"verdict":"needs_work","summary":"Fix it.","evidence":[],"requiredActions":[]}',
    '<!-- /unleashd:buddy-review-result -->',
    'After',
  ].join('\n');
  const segments = splitStructuredMessageContent(content);
  assert.deepEqual(
    segments.map((segment) => segment.type),
    ['text', 'ask_user_question', 'text', 'buddy_review_result', 'text']
  );
});

test('Buddy review result envelopes parse into verdict cards without transport text', () => {
  const content = [
    '<!-- unleashd:buddy-review-result -->',
    '{"verdict":"pass","score":96,"summary":"Evidence is complete.","evidence":[{"kind":"metric","reference":"audit","observation":"Checks passed."}],"requiredActions":[]}',
    '<!-- /unleashd:buddy-review-result -->',
  ].join('\n');
  const match = content.match(BUDDY_REVIEW_RESULT_RE);
  assert.ok(match);
  assert.deepEqual(parseBuddyReviewResult(match[1]), {
    verdict: 'pass',
    score: 96,
    summary: 'Evidence is complete.',
    evidence: [{ kind: 'metric', reference: 'audit', observation: 'Checks passed.' }],
    requiredActions: [],
  });
  assert.equal(parseBuddyReviewResult('{"verdict":"pass"}'), null);
});

test('automation surface exposes durable policy and explicit owner approval decisions', () => {
  const source = readFileSync(
    path.resolve('src/components/buddies/BuddyAutomationsTab.tsx'),
    'utf8'
  );
  assert.match(source, />Human approvals</);
  assert.match(source, /approval\.status === 'pending'/);
  assert.match(source, /decision === 'approved' \? 'Approve' : 'Reject'/);
  assert.match(source, /\/api\/buddies\/approvals\//);
  assert.match(source, /automation\.policy\.max_runtime_seconds/);
  assert.match(source, /automation\.policy\.max_tokens/);
  assert.match(source, /run\.tokens_used/);
  assert.match(source, /run\.cost_usd/);
});

test('chat drafts restore whenever the textarea remounts and flush before page unload', () => {
  const source = readFileSync(path.resolve('src/components/Chat.tsx'), 'utf8');
  assert.match(source, /const attachTextarea = useCallback/);
  assert.match(source, /ref=\{attachTextarea\}/);
  assert.match(source, /localStorage\.getItem\(`\$\{DRAFT_KEY_PREFIX\}\$\{id\}`\)/);
  assert.match(source, /window\.addEventListener\('pagehide', flushDraft\)/);
  assert.match(source, /if \(!textarea\) \{\s*saveDraft\(\)/);
});
