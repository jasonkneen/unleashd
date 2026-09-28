import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { Doc } from '../src/components/buddies/types';

// BuddyMemory imports a stylesheet; node cannot load CSS, so it loads as an empty module.
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function load(url, context, nextLoad) {
      if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
      return nextLoad(url, context);
    }
  `)}`,
  import.meta.url
);
const { BuddyMemory, DocCard, DocRevisionList, addressOf, readUrl } = await import(
  '../src/components/buddies/BuddyMemory'
);
const { readMemoryDoc } = await import('../src/components/buddies/memory-doc');

const doc = (overrides: Partial<Doc>): Doc => ({
  id: 'doc-1',
  buddyId: 'ada',
  workspaceId: 'ws-1',
  scope: { kind: 'buddy' },
  kind: 'shared',
  name: 'release-checklist',
  revision: 3,
  content: 'ship it',
  updatedAt: '2026-09-26T00:00:00Z',
  ...overrides,
});

test('a scoped doc is read and written at its own scope, never as the Buddy-scoped doc of that name', () => {
  // The route defaults a missing scope to `buddy`: an editor that dropped the scope would read
  // (and, on save, create) a different doc with the same name.
  const shared = doc({ scope: { kind: 'workspace', workspaceId: 'ws-1' } });
  const url = new URL(readUrl('ada', 'shared', addressOf(shared)), 'http://x');
  assert.equal(url.pathname, '/api/buddies/ada/docs/shared');
  assert.equal(url.searchParams.get('scope'), 'workspace');
  assert.equal(url.searchParams.get('scopeId'), 'ws-1');
  assert.equal(url.searchParams.get('name'), 'release-checklist');
});

test('revision history lists newest first with its reason and author', () => {
  const revision = (n: number, reason: string) => ({
    docId: 'doc-1',
    revision: n,
    content: `v${n}`,
    reason,
    author: n === 2 ? 'owner' : 'buddy:ada',
    provenance: '',
    sha256: '',
    createdAt: `2026-09-2${n}T00:00:00Z`,
  });
  const html = renderToStaticMarkup(
    <DocRevisionList revisions={[revision(1, 'first draft'), revision(2, 'owner edit')]} />
  );
  assert.ok(html.indexOf('Revision 2') < html.indexOf('Revision 1'));
  assert.match(html, /owner edit/);
  assert.match(html, /buddy:ada/);
});

test('the Memory tab lists shared docs with their scope, and offers a new doc', () => {
  const card = renderToStaticMarkup(
    <DocCard buddyId="ada" doc={doc({ scope: { kind: 'workspace', workspaceId: 'ws-1' } })} />
  );
  assert.match(card, /release-checklist/);
  assert.match(card, /Workspace · Revision 3/);
  const tab = renderToStaticMarkup(
    <MemoryRouter>
      <BuddyMemory buddyId="ada" workspaceId="ws-1" />
    </MemoryRouter>
  );
  assert.match(tab, /Shared docs/);
  assert.match(tab, /aria-label="New doc"/);
  // The About card links to /buddies/:id/memory#working; each portable doc owns its anchor.
  for (const anchor of ['soul', 'working', 'long_term', 'shared']) {
    assert.match(tab, new RegExp(`id="${anchor}"`));
  }
});

test('a memory doc reads as a dated timeline, without the authored-by comment', () => {
  const reading = readMemoryDoc(
    [
      '<!--',
      '  authored_by: builder (owner:project_1)',
      '  at: 2026-09-12T15:56:02.388Z',
      '-->',
      '# Ada',
      '',
      '## 2026-08-20',
      'Guard: never reset.',
      '## 2026-08-20',
      'Sidebar sorts by activity.',
      '## Not a date',
      'stays in the entry',
      '## 2026-13-01',
      'an impossible month is text, not an entry',
      '## 2026-09-09',
      'Owner prefers restraint.',
    ].join('\n')
  );
  assert.equal(reading.authoredBy, 'builder');
  assert.equal(reading.preamble, '# Ada');
  assert.doesNotMatch(reading.preamble, /authored_by/);
  // Two same-day headings are one day's entry; the first date's text is not dropped.
  assert.deepEqual(
    reading.entries.map((entry) => entry.label),
    ['Aug 20, 2026', 'Sep 9, 2026']
  );
  assert.match(reading.entries[0].body, /never reset[\s\S]*Sidebar sorts[\s\S]*## Not a date/);
  assert.match(reading.entries[0].body, /## 2026-13-01/);
});
