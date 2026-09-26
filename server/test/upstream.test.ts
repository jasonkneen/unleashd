import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BuddiesStore } from '@nbardy/buddies';
import type { ChannelResponder } from '../src/buddies/channel-responder';
import { mentionedBuddyIds } from '../src/buddies/channel-text';
import type { BuddiesStorePort } from '../src/buddies/contract';
import { checkUpstream, resolveCheckout } from '../src/upstream/git-upstream';
import { createUpstreamService } from '../src/upstream/routes';
import { type UnleashdHomeStore, bootstrapUnleashdHome } from '../src/upstream/unleashd-home';

// Real git repositories and a real Buddies store. The only stand-in is the
// channel responder, whose job is starting a provider turn.

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_NOSYSTEM: '1',
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
}

function commit(repo: string, file: string): string {
  writeFileSync(join(repo, file), file);
  git(repo, 'add', file);
  git(repo, 'commit', '--quiet', '-m', file);
  return git(repo, 'rev-parse', 'HEAD');
}

/** A bare `origin`, an install cloned from it, and a second clone that publishes to it. */
function repositories() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'unleashd-upstream-')));
  const origin = join(root, 'origin.git');
  git(root, 'init', '--quiet', '--bare', '-b', 'main', origin);
  const publisher = join(root, 'publisher');
  mkdirSync(publisher);
  git(publisher, 'init', '--quiet', '-b', 'main');
  git(publisher, 'remote', 'add', 'origin', origin);
  commit(publisher, 'first.txt');
  git(publisher, 'push', '--quiet', 'origin', 'main');
  const install = join(root, 'install');
  git(root, 'clone', '--quiet', origin, install);
  return { root, origin, publisher, install };
}

test('the check fetches without moving the checkout and prefers an `upstream` remote', async (t) => {
  const { root, publisher, install } = repositories();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const installHead = git(install, 'rev-parse', 'HEAD');

  const published = commit(publisher, 'second.txt');
  git(publisher, 'push', '--quiet', 'origin', 'main');
  const behind = await checkUpstream(await resolveCheckout(install));
  assert.equal(behind.kind, 'behind');
  assert.deepEqual(
    behind.kind === 'behind' && { remote: behind.remote, sha: behind.sha, behind: behind.behind },
    { remote: 'origin', sha: published, behind: 1 }
  );
  // Fetch-only: the install's HEAD did not move.
  assert.equal(git(install, 'rev-parse', 'HEAD'), installHead);

  // A fork's source is `upstream`; it wins over `origin` when both exist.
  const upstream = join(root, 'upstream.git');
  git(root, 'clone', '--quiet', '--bare', join(root, 'origin.git'), upstream);
  const upstreamPublisher = join(root, 'upstream-publisher');
  git(root, 'clone', '--quiet', upstream, upstreamPublisher);
  const upstreamSha = commit(upstreamPublisher, 'third.txt');
  git(upstreamPublisher, 'push', '--quiet', 'origin', 'main');
  git(install, 'remote', 'add', 'upstream', upstream);
  const fromUpstream = await checkUpstream(await resolveCheckout(install));
  assert.deepEqual(
    fromUpstream.kind === 'behind' && { remote: fromUpstream.remote, sha: fromUpstream.sha },
    { remote: 'upstream', sha: upstreamSha }
  );

  // A server started from a linked worktree resolves to the main checkout, so
  // agent worktrees never register workspaces of their own.
  const worktree = join(root, 'worktree');
  git(install, 'worktree', 'add', '--quiet', '--detach', worktree);
  assert.deepEqual(await resolveCheckout(worktree), { kind: 'checkout', root: install });
});

test('no remote and no checkout are typed as unavailable, not as up to date', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'unleashd-upstream-bare-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const lonely = join(root, 'lonely');
  mkdirSync(lonely);
  git(lonely, 'init', '--quiet', '-b', 'main');
  commit(lonely, 'only.txt');
  const noRemote = await checkUpstream(await resolveCheckout(lonely));
  assert.equal(noRemote.kind === 'unavailable' && noRemote.reason, 'no_remote');

  const plain = join(root, 'plain');
  mkdirSync(plain);
  const notCheckout = await checkUpstream(await resolveCheckout(plain));
  assert.equal(notCheckout.kind === 'unavailable' && notCheckout.reason, 'not_git_checkout');
});

function namedInWorkspace(store: BuddiesStore, workspaceId: string, name: string): string[] {
  return store
    .listBuddies(workspaceId)
    .filter((buddy: { name: string }) => buddy.name === name)
    .map((buddy: { id: string }) => buddy.id);
}

test('bootstrap converges: one workspace, one #upstream, one of each Buddy', (t) => {
  const repoRoot = realpathSync(mkdtempSync(join(tmpdir(), 'unleashd-home-')));
  t.after(() => rmSync(repoRoot, { recursive: true, force: true }));
  const store = new BuddiesStore(':memory:');
  const homeStore = store as unknown as UnleashdHomeStore;

  const first = bootstrapUnleashdHome(homeStore, repoRoot);
  const second = bootstrapUnleashdHome(homeStore, repoRoot);
  assert.deepEqual(second, first);
  assert.equal(store.listWorkspaces().length, 1);
  assert.deepEqual(
    store.listLists({ workspace: first.workspaceId }).map((list: { name: string }) => list.name),
    ['upstream']
  );
  assert.deepEqual(namedInWorkspace(store, first.workspaceId, 'Product Dev'), [first.productDevId]);
  assert.deepEqual(namedInWorkspace(store, first.workspaceId, 'Upstream Release Manager'), [
    first.releaseManagerId,
  ]);
  assert.equal(store.listBuddies(first.workspaceId).length, 2);
});

test('bootstrap reuses an existing "Product Development Lead" as Product Dev', (t) => {
  const repoRoot = realpathSync(mkdtempSync(join(tmpdir(), 'unleashd-home-reuse-')));
  t.after(() => rmSync(repoRoot, { recursive: true, force: true }));
  const store = new BuddiesStore(':memory:');
  const workspace = store.createWorkspace({ name: 'unleashd', rootPath: repoRoot });
  const lead = store.createBuddy({
    project: workspace.id,
    name: 'Product Development Lead',
    role: 'Lead product development',
  });

  const homeStore = store as unknown as UnleashdHomeStore;
  const first = bootstrapUnleashdHome(homeStore, repoRoot);
  const second = bootstrapUnleashdHome(homeStore, repoRoot);
  assert.equal(first.workspaceId, workspace.id);
  assert.equal(first.productDevId, lead.id);
  assert.deepEqual(second, first);
  assert.deepEqual(namedInWorkspace(store, workspace.id, 'Product Dev'), []);
  assert.equal(store.listBuddies(workspace.id).length, 2);
});

test('update posts one @mention of the Release Manager per upstream sha', async (t) => {
  const { root, publisher, install } = repositories();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sha = commit(publisher, 'second.txt');
  git(publisher, 'push', '--quiet', 'origin', 'main');

  const store = new BuddiesStore(':memory:');
  const turns: string[] = [];
  const responder = {
    respondToOwnerPost: async (_list: unknown, post: { body: string }) =>
      mentionedBuddyIds(post.body).map((buddyId) => {
        turns.push(buddyId);
        return { buddyId, status: 'started' as const };
      }),
  } as unknown as ChannelResponder;
  const service = createUpstreamService({
    serverDirectory: install,
    getStore: async () => store as unknown as BuddiesStorePort,
    responder,
    uploadsRoot: join(root, 'uploads'),
    sendError: () => assert.fail('no route in this test'),
  });
  await Promise.all([service.bootstrap(), service.refresh()]);
  const { home } = service.status();
  assert.equal(home.kind, 'ready');
  if (home.kind !== 'ready') return;

  // A double click: two requests race, and both land on one post and one turn.
  const [a, b] = await Promise.all([service.requestUpdate(), service.requestUpdate()]);
  const again = await service.requestUpdate();
  assert.equal(a.kind, 'posted');
  assert.deepEqual(b, a);
  assert.deepEqual(again, a);
  assert.deepEqual(turns, [home.releaseManagerId]);

  const posts = store.listPosts({ list: home.listId, limit: 50 });
  assert.equal(posts.length, 1);
  assert.deepEqual(mentionedBuddyIds(posts[0].body), [home.releaseManagerId]);
  assert.match(posts[0].body, new RegExp(`For folder ${install}: fetch upstream origin/main`));
  assert.deepEqual(posts[0].evidence, [`upstream origin/main ${sha}`]);
});
