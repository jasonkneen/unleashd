import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionToConversation } from '../src/adapters/disk-adapter';
import {
  type BuddyBuilderRecord,
  BuddyBuilderService,
  type BuddyBuilderStore,
  serializeBuddyCreated,
} from '../src/buddies/builder';
import { buildFirstTurnCliContent } from '../src/conversations/runtime';

function createStore(): BuddyBuilderStore & { buddies: BuddyBuilderRecord[] } {
  const workspace = {
    id: 'workspace-growth',
    slug: 'growth',
    name: 'Growth',
    root_path: '/tmp/growth',
  };
  const buddies: BuddyBuilderRecord[] = [];
  return {
    buddies,
    listWorkspaces: () => [workspace],
    listBuddies: (workspaceId) =>
      workspaceId ? buddies.filter((buddy) => buddy.project_id === workspaceId) : [...buddies],
    getBuddy: (idOrSlug, workspaceId) =>
      buddies.find(
        (buddy) =>
          (buddy.id === idOrSlug || buddy.slug === idOrSlug) &&
          (!workspaceId || buddy.project_id === workspaceId)
      ) ?? null,
    createBuddy: (input) => {
      const buddy: BuddyBuilderRecord = {
        id: `buddy-${buddies.length + 1}`,
        project_id: input.project,
        slug: input.slug,
        name: input.name,
        role: input.role,
        status: input.status,
        provider: input.provider,
        model: input.model,
        reasoning_effort: input.reasoningEffort,
      };
      buddies.push(buddy);
      return buddy;
    },
  };
}

test('Buddy Builder creates once per conversation with server-owned defaults', () => {
  const store = createStore();
  const service = new BuddyBuilderService(store, 'conversation-1');
  const input = {
    workspaceId: 'workspace-growth',
    name: 'Growth Researcher',
    role: 'Research campaigns and competitors',
  };

  const created = service.createBuddy(input);
  const replayed = service.createBuddy(input);

  assert.equal(store.buddies.length, 1);
  assert.equal(replayed.buddy.id, created.buddy.id);
  assert.equal(created.buddy.provider, 'codex');
  assert.equal(created.buddy.model, 'gpt-5.6-luna');
  assert.equal(created.buddy.reasoning_effort, 'high');
  assert.equal(created.route, `/buddies/${created.buddy.id}`);
  assert.match(serializeBuddyCreated(created), /^<!-- unleashd:buddy-created -->\n/);
});

test('Buddy Builder rejects a changed creation request in the same conversation', () => {
  const service = new BuddyBuilderService(createStore(), 'conversation-1');
  service.createBuddy({
    workspaceId: 'workspace-growth',
    name: 'Growth Researcher',
    role: 'Research campaigns',
  });

  assert.throws(
    () =>
      service.createBuddy({
        workspaceId: 'workspace-growth',
        name: 'Growth Operator',
        role: 'Run campaigns',
      }),
    /already created a different Buddy/
  );
});

test('Buddy Builder purpose and invisible briefing survive disk hydration', () => {
  const visiblePrompt = 'I want a growth research Buddy.';
  const cliPrompt = buildFirstTurnCliContent({
    content: visiblePrompt,
    messageCount: 0,
    hasStartedSession: false,
    buddyContext: null,
    buddyBriefing: null,
    swarmDebugPrefix: null,
    purpose: 'buddy_builder',
  });
  const hydrated = sessionToConversation({
    sessionId: 'builder-session',
    filePath: '/tmp/builder-session.jsonl',
    workingDirectory: '/tmp',
    provider: 'codex',
    model: 'gpt-5.6-luna',
    createdAt: new Date(),
    modifiedAt: new Date(),
    messages: [{ role: 'user', content: cliPrompt }],
  });

  assert.equal(hydrated?.purpose, 'buddy_builder');
  assert.equal(hydrated?.messages[0]?.content, visiblePrompt);
  assert.equal(hydrated?.isWorker, false);
});
