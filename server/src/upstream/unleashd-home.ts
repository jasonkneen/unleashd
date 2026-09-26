import {
  type BuddyBuilderRecord,
  BuddyBuilderService,
  type BuddyBuilderStore,
} from '../buddies/builder';
import type { BuddyListAuthor, BuddyMailingList } from '../buddies/contract';
import { ensureWorkspace } from '../buddies/workspace-home';

// First-run home for an install: the checkout itself as a Buddy workspace
// named "unleashd", its #upstream channel, and two Buddies — Product Dev and
// the Upstream Release Manager. Runs on every server start and must converge:
// a second run changes nothing.
//
// Idempotence, per piece:
//   workspace — ensureWorkspace matches by real path.
//   channel   — found by name (the store refuses a duplicate name), else
//               created under a fixed command key.
//   Buddies   — Builder receipts: BuddyBuilderService with a synthetic
//               conversation id and one creation key per seat. The store
//               keys a hire by (conversationId, creationKey) in one
//               transaction and needs no conversation record behind the id.
//               A seat already filled by a matching Buddy (e.g. the existing
//               "Product Development Lead") is reused and nothing is hired.

export const BOOTSTRAP_CONVERSATION_ID = 'unleashd-bootstrap';
export const UPSTREAM_LIST_NAME = 'upstream';
const WORKSPACE_NAME = 'unleashd';

export type UnleashdHomeStore = BuddyBuilderStore & {
  listLists(input: { workspace: string }): BuddyMailingList[];
  createList(input: {
    workspace: string;
    author: BuddyListAuthor;
    key: string;
    name: string;
    purpose: string;
  }): { list: BuddyMailingList };
};

export interface UnleashdHome {
  repoRoot: string;
  workspaceId: string;
  listId: string;
  productDevId: string;
  releaseManagerId: string;
}

type Seat = {
  creationKey: string;
  name: string;
  role: string;
  soul: string;
  /** An existing, non-archived workspace Buddy that already fills this seat. */
  fills(buddy: BuddyBuilderRecord): boolean;
};

const PRODUCT_DEV: Seat = {
  creationKey: 'product-dev',
  name: 'Product Dev',
  role: 'Owns the product roadmap and development of this Unleashd install',
  soul: [
    'You are Product Dev for this Unleashd install.',
    'You own its product roadmap and development: decide what to build next from the owner’s goals and real usage, break it into Tasks, build or delegate it, and verify it works in the running app.',
    'Keep changes small and reviewable. Report what shipped, what is next, and anything you need from the owner.',
  ].join('\n\n'),
  fills: (buddy) => buddy.name.trim().toLowerCase().startsWith('product dev'),
};

const RELEASE_MANAGER: Seat = {
  creationKey: 'upstream-release-manager',
  name: 'Upstream Release Manager',
  role: 'Keeps this checkout merged with upstream Unleashd',
  soul: [
    'You are the Upstream Release Manager for this Unleashd install.',
    'You keep this checkout merged with upstream: commit any local edits first, fetch upstream main, and MERGE it in. Never reset, rebase, force-push or discard local work.',
    'Resolve conflicts by keeping both the local changes and upstream’s intent; ask the owner when the two genuinely disagree.',
    'After merging run `pnpm install && pnpm build`, then report in the thread what changed upstream, which conflicts you resolved and how, and whether the build passed.',
  ].join('\n\n'),
  fills: (buddy) => buddy.name.trim() === 'Upstream Release Manager',
};

function ensureUpstreamList(store: UnleashdHomeStore, workspaceId: string): string {
  const existing = store
    .listLists({ workspace: workspaceId })
    .find((list) => list.name.toLowerCase() === UPSTREAM_LIST_NAME);
  if (existing) return existing.id;
  return store.createList({
    workspace: workspaceId,
    author: { kind: 'owner' },
    key: `${BOOTSTRAP_CONVERSATION_ID}:list:${UPSTREAM_LIST_NAME}`,
    name: UPSTREAM_LIST_NAME,
    purpose:
      'Merging upstream Unleashd into this install: update requests, conflict reports and build results.',
  }).list.id;
}

// Resolution order: this bootstrap's own receipt (an archived hire stays
// archived — the owner retired it, and a receipt replays rather than
// re-hires), then a matching active Buddy in the workspace, then a new hire.
function ensureSeat(builder: BuddyBuilderService, workspaceId: string, seat: Seat): string {
  const hired = builder.getResult(seat.creationKey);
  if (hired) return hired.buddy.id;
  const filled = builder
    .listBuddies(workspaceId)
    .find((buddy) => buddy.status !== 'archived' && seat.fills(buddy));
  if (filled) return filled.id;
  return builder.createBuddy({
    creationKey: seat.creationKey,
    workspaceId,
    name: seat.name,
    role: seat.role,
    soul: seat.soul,
  }).buddy.id;
}

export function bootstrapUnleashdHome(store: UnleashdHomeStore, repoRoot: string): UnleashdHome {
  const { workspace } = ensureWorkspace(store, { rootPath: repoRoot, name: WORKSPACE_NAME });
  const listId = ensureUpstreamList(store, workspace.id);
  const builder = new BuddyBuilderService(store, BOOTSTRAP_CONVERSATION_ID);
  return {
    repoRoot: workspace.root_path,
    workspaceId: workspace.id,
    listId,
    productDevId: ensureSeat(builder, workspace.id, PRODUCT_DEV),
    releaseManagerId: ensureSeat(builder, workspace.id, RELEASE_MANAGER),
  };
}
