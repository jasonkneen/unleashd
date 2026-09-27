import assert from 'node:assert/strict';
import test from 'node:test';
import type { Conversation } from '@unleashd/shared';
import { Provider, createStore } from 'jotai';
// biome-ignore lint/correctness/noUnusedImports: tsx compiles test JSX with the classic runtime.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { buddyBackgroundWorkersAtomFamily } from '../src/atoms/buddy-background';
import { conversationLoadCompleteAtom, conversationsAtom } from '../src/atoms/conversations';
import { BuddyBackgroundLink } from '../src/components/buddies/BuddyBackgroundLink';
import { BuddyBackgroundTasks } from '../src/components/buddies/BuddyBackgroundTasks';
import { buddyTabPath, parseEmployeeTab } from '../src/components/buddies/buddy-tabs';

test('background destination shows running work first, retains history and scopes links to workspace', () => {
  const store = createStore();
  const make = (id: string, overrides: Partial<Conversation> = {}) =>
    ({
      id,
      kind: { kind: 'buddy', buddyId: 'lead', workspaceId: 'wave' },
      placement: 'background',
      createdAt: new Date('2026-09-13T00:00:00Z'),
      messages: [],
      provider: 'codex',
      isRunning: false,
      ...overrides,
    }) as Conversation;
  const conversations = new Map(
    [
      make('past', { createdAt: new Date('2026-09-13T01:00:00Z') }),
      make('active', { isRunning: true, parentConversationId: 'owner' }),
      make('owner', { placement: 'default', isRunning: true }),
      make('other-workspace', { kind: { kind: 'buddy', buddyId: 'lead', workspaceId: 'other' } }),
      make('other-buddy', { kind: { kind: 'buddy', buddyId: 'engineer', workspaceId: 'wave' } }),
    ].map((conversation) => [conversation.id, conversation])
  );
  store.set(conversationsAtom, conversations);
  store.set(conversationLoadCompleteAtom, true);
  const view = buddyBackgroundWorkersAtomFamily({ buddyId: 'lead', workspaceId: 'wave' });
  assert.deepEqual(
    store.get(view).map((worker) => worker.conversation.id),
    ['active', 'past']
  );
  assert.equal(store.get(view).filter((worker) => worker.status === 'running').length, 1);
  assert.equal(parseEmployeeTab('background'), 'background');
  const render = (query = '?workspace=wave') =>
    renderToStaticMarkup(
      <Provider store={store}>
        <MemoryRouter initialEntries={[`${buddyTabPath('lead', 'background')}${query}`]}>
          <BuddyBackgroundTasks
            buddyId="lead"
            workspaces={[
              { id: 'wave', name: 'Wave', root_path: '/wave' },
              { id: 'other', name: 'Other', root_path: '/other' },
            ]}
          />
        </MemoryRouter>
      </Provider>
    );
  const hrefs = (html: string) => [...html.matchAll(/href="(\/chat\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs(render()), ['/chat/active', '/chat/past']);
  assert.match(render(), /1 running · 0 queued · 2 total/);
  assert.deepEqual(hrefs(render('')), ['/chat/active', '/chat/past', '/chat/other-workspace']);

  // Live snapshots change the count; deletion removes its target immediately.
  store.set(conversationsAtom, new Map(conversations).set('active', make('active')));
  assert.match(render(), /0 running · 0 queued · 2 total/);
  const remaining = new Map(conversations);
  remaining.delete('active');
  store.set(conversationsAtom, remaining);
  assert.deepEqual(hrefs(render()), ['/chat/past']);
});

test('empty workspace param means all workspaces; a workspace with no runs offers to show all', () => {
  // Regression: the sidebar built `?workspace=` for buddies with no workspace
  // row, which the tab read as a workspace literally named "" — zero rows
  // while the badge counts showed work, and the Conversations tab hides
  // background placement by design, so the threads looked hidden everywhere.
  const store = createStore();
  const make = (id: string, overrides: Partial<Conversation> = {}) =>
    ({
      id,
      kind: { kind: 'buddy', buddyId: 'lead', workspaceId: 'wave' },
      placement: 'background',
      createdAt: new Date('2026-09-13T00:00:00Z'),
      messages: [],
      provider: 'codex',
      isRunning: false,
      ...overrides,
    }) as Conversation;
  store.set(
    conversationsAtom,
    new Map(
      [
        make('past'),
        make('active', { isRunning: true }),
        make('other-workspace', {
          kind: { kind: 'buddy', buddyId: 'lead', workspaceId: 'other' },
        }),
      ].map((conversation) => [conversation.id, conversation])
    )
  );
  store.set(conversationLoadCompleteAtom, true);
  const render = (query: string) =>
    renderToStaticMarkup(
      <Provider store={store}>
        <MemoryRouter initialEntries={[`${buddyTabPath('lead', 'background')}${query}`]}>
          <BuddyBackgroundTasks
            buddyId="lead"
            workspaces={[
              { id: 'wave', name: 'Wave', root_path: '/wave' },
              { id: 'other', name: 'Other', root_path: '/other' },
            ]}
          />
        </MemoryRouter>
      </Provider>
    );
  const hrefs = (html: string) => [...html.matchAll(/href="(\/chat\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs(render('?workspace=')), [
    '/chat/active',
    '/chat/past',
    '/chat/other-workspace',
  ]);
  const empty = render('?workspace=missing');
  assert.match(empty, /No background workers yet/);
  assert.match(empty, /Show all workspaces \(3\)/);
});

test('DM worker count and page include native workers, deduplicate transcripts and expose unconfirmed outcomes', () => {
  const store = createStore();
  const startedAt = new Date('2026-09-27T06:00:00Z');
  const parent = {
    id: 'dm',
    kind: { kind: 'buddy', buddyId: 'lead', workspaceId: 'wave' },
    placement: 'default',
    createdAt: startedAt,
    messages: [],
    isRunning: true,
    provider: 'codex',
    subAgents: [
      {
        id: 'native-1',
        providerThreadId: 'child-session',
        description: 'Review the build',
        status: 'running',
        startedAt,
        toolUses: 3,
        tokens: 100,
        currentAction: 'Reading test results',
        statusSource: 'native',
      },
      {
        id: 'native-2',
        description: 'Wait for capacity',
        status: 'pending',
        startedAt,
        toolUses: 0,
        tokens: 0,
      },
      {
        id: 'native-3',
        description: 'An unconfirmed result',
        status: 'completed',
        startedAt,
        completedAt: startedAt,
        toolUses: 2,
        tokens: 50,
        statusSource: 'inferred_parent_completion',
      },
    ],
  } as Conversation;
  const child = {
    ...parent,
    id: 'child',
    sessionId: 'child-session',
    parentConversationId: 'dm',
    kind: { kind: 'general' },
    subAgents: [],
  } as Conversation;
  store.set(conversationLoadCompleteAtom, true);
  store.set(
    conversationsAtom,
    new Map([
      [parent.id, parent],
      [child.id, child],
    ])
  );
  const render = () =>
    renderToStaticMarkup(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/buddies/lead/background?workspace=wave']}>
          <BuddyBackgroundLink buddyId="lead" workspaceId="wave" name="Lead" />
          <BuddyBackgroundTasks
            buddyId="lead"
            workspaces={[{ id: 'wave', name: 'Wave', root_path: '/wave' }]}
          />
        </MemoryRouter>
      </Provider>
    );
  const html = render();
  assert.match(html, /Lead: 2 active background workers/);
  assert.match(html, /class="buddy-background-link" data-running="true"/);
  assert.match(html, /href="\/buddies\/lead\/background\?workspace=wave"/);
  assert.match(html, /1 running · 1 queued · 3 total/);
  assert.match(html, /Review the build/);
  assert.match(html, /Reading test results/);
  assert.match(html, /href="\/chat\/child"/);
  assert.match(html, /Status unconfirmed/);
  assert.match(html, /this worker’s result was not confirmed/);
  assert.equal((html.match(/href="\/chat\/child"/g) ?? []).length, 1);

  // Waiting for capacity is active work, but must not claim a worker is running.
  store.set(
    conversationsAtom,
    new Map([[parent.id, { ...parent, subAgents: [parent.subAgents[1]] }]])
  );
  assert.match(render(), /Lead: 1 active background workers/);
  assert.doesNotMatch(render(), /data-running="true"/);

  // A stopped parent cannot leave two supposedly live workers in the count.
  // Removing the child falls back to its existing parent; never links a dead id.
  store.set(conversationsAtom, new Map([[parent.id, { ...parent, isRunning: false }]]));
  const stopped = render();
  assert.match(stopped, /Lead: 0 active background workers/);
  assert.doesNotMatch(stopped, /data-running="true"/);
  assert.match(stopped, /last reported state may be stale/);
  assert.doesNotMatch(stopped, /href="\/chat\/child"/);
  assert.match(stopped, /Open parent conversation/);

  store.set(conversationsAtom, new Map());
  assert.match(render(), /No background workers yet/);
});
