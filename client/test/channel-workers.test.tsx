import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import type { Conversation } from '@unleashd/shared';
import { Provider } from 'jotai';
// biome-ignore lint/correctness/noUnusedImports: tsx compiles test JSX with the classic runtime.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function load(url, context, nextLoad) {
      if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
      return nextLoad(url, context);
    }
  `)}`,
  import.meta.url
);
const { WorkspaceSlack } = await import('../src/components/buddies/ChannelBrowser');
const { ChannelsMobile } = await import('../src/mobile/channels/ChannelsMobile');
const { BuddyBackgroundLink } = await import('../src/components/buddies/BuddyBackgroundLink');
const { channelsHref, isImmersiveChannelRoute, mobileChannelScreen } = await import(
  '../src/mobile/channels/channel-route'
);
const { conversationLoadCompleteAtom, conversationsAtom } = await import(
  '../src/atoms/conversations'
);
const { jotaiStore } = await import('../src/atoms/store');
const { loadResource } = await import('../src/atoms/resources');

// Follow the rendered badge href through each real route component: this
// catches the legacy-shell escape that a correct count on its own missed.
test('worker badge opens a workspace-scoped workers page inside both Buddy UI shells', async () => {
  const workspaceId = 'worker-workspace';
  const base = `/buddies/workspaces/${workspaceId}/channels`;
  await loadResource({
    key: `/api/buddies/workspaces/${workspaceId}/activity`,
    load: async () => ({
      workspace: { id: workspaceId, name: 'Workers', rootPath: '/workers' },
      members: [{ id: 'lead', name: 'Lead', role: 'Own the work', status: 'active', jobs: [] }],
    }),
  });
  await loadResource({ key: `/api/buddies/workspaces/${workspaceId}/tasks`, load: async () => [] });
  await loadResource({
    key: `/api/buddies/lists?workspaceId=${workspaceId}`,
    load: async () => [],
  });
  const make = (id: string, ws: string) =>
    ({
      id,
      title: id,
      kind: { kind: 'buddy', buddyId: 'lead', workspaceId: ws },
      placement: 'background',
      createdAt: new Date('2026-09-27T00:00:00Z'),
      messages: [],
      provider: 'codex',
      isRunning: true,
    }) as Conversation;
  jotaiStore.set(
    conversationsAtom,
    new Map([
      ['visible-worker', make('visible-worker', workspaceId)],
      ['other-workspace-worker', make('other-workspace-worker', 'elsewhere')],
    ])
  );
  jotaiStore.set(conversationLoadCompleteAtom, true);
  const badge = renderToStaticMarkup(
    <Provider store={jotaiStore}>
      <MemoryRouter initialEntries={[`${base}?dm=owner-chat`]}>
        <BuddyBackgroundLink buddyId="lead" workspaceId={workspaceId} name="Lead" />
      </MemoryRouter>
    </Provider>
  );
  const href = badge.match(/href="([^"]+)"/)?.[1].replaceAll('&amp;', '&');
  assert.equal(href, `${base}?workers=lead&dm=owner-chat`);
  assert.match(badge, /data-running="true"/);
  const search = new URL(href!, 'http://test').search;
  assert.deepEqual(mobileChannelScreen(search), { kind: 'workers', buddyId: 'lead' });
  assert.equal(isImmersiveChannelRoute(base, search), true);
  assert.equal(
    channelsHref(workspaceId, { kind: 'workers', buddyId: 'lead' }),
    `${base}?workers=lead`
  );
  for (const Shell of [WorkspaceSlack, ChannelsMobile]) {
    const html = renderToStaticMarkup(
      <Provider store={jotaiStore}>
        <MemoryRouter initialEntries={[href!]}>
          <Routes>
            <Route path="/buddies/workspaces/:workspaceId/channels" element={<Shell />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );
    assert.match(html, /aria-label="Lead background workers"/);
    assert.match(html, /1 running · 0 queued · 1 total/);
    assert.match(html, /href="\/chat\/visible-worker"/);
    assert.doesNotMatch(html, /other-workspace-worker/);
    assert.match(
      html,
      /aria-label="Back to Buddies"[^>]*href="\/buddies\/workspaces\/worker-workspace\/channels\?dm=owner-chat"/
    );
    assert.doesNotMatch(html, /All workspaces/);
    if (Shell === WorkspaceSlack) {
      assert.match(html, /class="channel-browser-rail"/);
      assert.match(html, /aria-label="Message Lead"/);
    }
  }
});
