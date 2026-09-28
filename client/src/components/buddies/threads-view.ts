/**
 * client/src/components/buddies/threads-view.ts
 *
 * The Threads view's data, shared by the desktop pane and the mobile screen
 * (product/buddies/THREADS_VIEW_2026-09-28.md). The server decides what a card
 * shows (`ThreadTail`); this module only keeps the page STABLE while the owner
 * reads it. No JSX: mobile may import it (gate G3).
 *
 * Stability, per visit:
 *   - order is what the pane opened with; a thread that gains replies stays
 *     where it is and raises the "N threads updated" pill, which re-sorts;
 *   - a card never shrinks: marking it read turns its server tail into the
 *     last two replies, but the replies already shown stay shown;
 *   - the unread tint is every reply that arrived as unread during the visit,
 *     so reading a card does not un-tint it under the reader.
 */
import { useMemo, useRef, useState } from 'react';
import { usePolledFetch } from '../../hooks/usePolledFetch';
import { CHANNEL_BACKSTOP_MS } from './channel-data';
import type { FollowedThread, FollowedThreads, Post } from './types';

/** Cards per page; "Show more" asks for another page's worth. */
export const THREADS_PAGE = 30;

export function threadsUrl(workspaceId: string, limit: number): string {
  return `/api/buddies/workspaces/${encodeURIComponent(workspaceId)}/threads?limit=${limit}`;
}

type HeldCard = { posts: readonly Post[]; unread: ReadonlySet<string> };
export type HeldThreads = { order: readonly string[]; cards: ReadonlyMap<string, HeldCard> };

export type ThreadCard = {
  thread: FollowedThread;
  /** Replies shown under the fold, oldest first. */
  posts: readonly Post[];
  /** Replies folded into "View N previous replies". */
  hidden: number;
  /** Replies tinted as new this visit. */
  unread: ReadonlySet<string>;
};

export type ThreadsView = {
  held: HeldThreads;
  cards: readonly ThreadCard[];
  /** Threads with replies (or new to the list) since the order was taken: the pill. */
  updated: number;
  /** Replies tinted as new: the header's "N new replies". */
  newReplies: number;
};

const byOrd = (a: Post, b: Post) => (a.ord < b.ord ? -1 : a.ord > b.ord ? 1 : 0);

/** One card: the held replies plus any the server now shows, never fewer. */
function holdCard(thread: FollowedThread, held: HeldCard | undefined): HeldCard {
  const tail = thread.tail;
  const known = new Map((held?.posts ?? []).map((post) => [post.id, post] as const));
  for (const post of tail.posts) known.set(post.id, post);
  const unread = new Set(held?.unread ?? []);
  switch (tail.kind) {
    case 'unread':
      for (const post of tail.posts) unread.add(post.id);
      break;
    case 'caught_up':
      break;
  }
  return { posts: [...known.values()].sort(byOrd), unread };
}

/** Pure: the next stable view from the previous one and the server's latest list. */
export function holdThreads(
  previous: HeldThreads | null,
  latest: readonly FollowedThread[],
  resort: boolean
): ThreadsView {
  const byId = new Map(latest.map((thread) => [thread.root.id, thread] as const));
  const serverOrder = latest.map((thread) => thread.root.id);
  const kept = previous === null || resort ? [] : previous.order.filter((id) => byId.has(id));
  const keptSet = new Set(kept);
  const order = [...kept, ...serverOrder.filter((id) => !keptSet.has(id))];
  const cards = new Map<string, HeldCard>();
  let updated = 0;
  for (const id of order) {
    const thread = byId.get(id);
    if (thread === undefined) continue;
    const before = previous?.cards.get(id);
    const card = holdCard(thread, before);
    cards.set(id, card);
    // The owner's own reply from a card is not news to the owner.
    const seen = new Set(before?.posts.map((post) => post.id));
    const grew =
      before === undefined ||
      card.posts.some((post) => !seen.has(post.id) && post.author.kind !== 'owner');
    if (previous !== null && !resort && grew) updated += 1;
  }
  const view = order.flatMap((id): ThreadCard[] => {
    const thread = byId.get(id);
    const card = cards.get(id);
    if (thread === undefined || card === undefined) return [];
    return [
      {
        thread,
        posts: card.posts,
        hidden: Math.max(0, thread.replies - card.posts.length),
        unread: card.unread,
      },
    ];
  });
  return {
    held: { order, cards },
    cards: view,
    updated,
    newReplies: view.reduce((sum, card) => sum + card.unread.size, 0),
  };
}

/**
 * The Threads pane's state: the followed threads (pushed through the keyed
 * cache, like every channel view), held stable for this mount. Mount it keyed
 * by workspace so a switch starts a fresh visit.
 */
export function useThreadsView(workspaceId: string) {
  const [limit, setLimit] = useState(THREADS_PAGE);
  const [resorts, setResorts] = useState(0);
  const followed = usePolledFetch<FollowedThreads>(
    threadsUrl(workspaceId, limit),
    CHANNEL_BACKSTOP_MS
  );
  const held = useRef<{ view: HeldThreads | null; resorts: number }>({ view: null, resorts: 0 });
  const view = useMemo(() => {
    if (followed.data === null) return null;
    const next = holdThreads(
      held.current.view,
      followed.data.threads,
      resorts !== held.current.resorts
    );
    held.current = { view: next.held, resorts };
    return next;
  }, [followed.data, resorts]);
  return {
    followed,
    view,
    more: followed.data?.more ?? false,
    showMore: () => setLimit((current) => current + THREADS_PAGE),
    resort: () => setResorts((count) => count + 1),
  };
}

/** Who is in a thread, the owner as "you": "Lead, Designer and you". */
export function participantNames(
  thread: FollowedThread,
  buddyNames: Readonly<Record<string, string>>
): string[] {
  const names = thread.participants.flatMap((actor) =>
    actor.kind === 'buddy' ? [buddyNames[actor.id] ?? actor.id] : []
  );
  return thread.participants.some((actor) => actor.kind === 'owner') ? [...names, 'you'] : names;
}
