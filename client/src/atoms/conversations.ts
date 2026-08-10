import type {
  BuddyContext,
  ClientMessage,
  Conversation,
  ConversationConfig,
  ConversationConfigPatch,
} from '@unleashd/shared';
import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import { getConversationLastActivity } from '../utils/time';

// =============================================================================
// Primary State Atoms
//
// These are the source-of-truth atoms. Mutations go through actions.ts or
// config-actions.ts (which call jotaiStore.set). React components call actions;
// they never mutate these maps directly.
// =============================================================================

export const conversationsAtom = atom(new Map<string, Conversation>());
export const conversationDetailsLoadedAtom = atom(new Set<string>());
export const conversationLoadCompleteAtom = atom(false);

export interface PendingConversationCreation {
  kind: 'create_conversation';
  commandId: string;
  conversationId: string;
  workingDirectory: string;
  config: ConversationConfig;
  buddyContext?: BuddyContext;
  createdAt: Date;
  error?: string;
  errorCode?: string;
}

export interface PendingConfigCommand {
  kind: 'set_conversation_config';
  commandId: string;
  conversationId: string;
  baseRevision: number;
  patch: ConversationConfigPatch;
  error?: string;
}

// Client-owned command state is intentionally separate from authoritative
// server Conversation snapshots. A pending create is not a partial Conversation.
export const pendingCreationsAtom = atom(new Map<string, PendingConversationCreation>());
export const pendingConfigCommandsAtom = atom(new Map<string, PendingConfigCommand>());

export const allPendingCreationsAtom = atom((get) =>
  Array.from(get(pendingCreationsAtom).values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )
);

// Streaming text — kept separate from conversations so Sidebar never re-renders
// at 60Hz during streaming. Flushed into conversations on stream end.
export const streamingContentAtom = atom(new Map<string, string>());

export const activeConversationIdAtom = atom<string | null>(null);
export const wsStatusAtom = atom<'connecting' | 'connected' | 'disconnected'>('connecting');
export const defaultCwdAtom = atom<string>('');

// The WebSocket send function — set by useWebSocketBridge once the socket connects.
// Stored as an atom so actions.ts can always call the current send fn without stale closures.
export const sendFnAtom = atom<{ send: (msg: ClientMessage) => void }>({ send: () => {} });

// =============================================================================
// Per-Item Derived Atoms (atomFamily)
//
// atomFamily memoizes one atom per ID. Components subscribing via
// useAtomValue(conversationAtomFamily(id)) only re-render when THAT conversation
// changes — not when unrelated conversations update. This is the Jotai equivalent
// of the Zustand per-ID selector pattern and is more principled: the dependency
// graph is explicit and tracked automatically.
//
// §5 #10 — atomFamily leaks: jotai-family memoizes per-ID atoms forever.
// handleMessage's conversation_deleted handler calls .remove(id) on every
// family below to free the memoized atom for long-lived (PWA) sessions.
// =============================================================================

// Single conversation by ID — use instead of s.conversations.get(id)
export const conversationAtomFamily = atomFamily((id: string) =>
  atom((get) => get(conversationsAtom).get(id) ?? null)
);

export const conversationDetailsLoadedAtomFamily = atomFamily((id: string) =>
  atom((get) => get(conversationDetailsLoadedAtom).has(id))
);

export const pendingCreationAtomFamily = atomFamily((id: string) =>
  atom((get) => get(pendingCreationsAtom).get(id) ?? null)
);

export const pendingConfigCommandAtomFamily = atomFamily((conversationId: string) =>
  atom(
    (get) =>
      Array.from(get(pendingConfigCommandsAtom).values()).find(
        (command) => command.conversationId === conversationId
      ) ?? null
  )
);

// Live streaming text for one conversation — use for Chat.tsx merge display
export const streamingAtomFamily = atomFamily((id: string) =>
  atom((get) => get(streamingContentAtom).get(id) ?? '')
);

// Child sessions for sub-agent panel (Chat.tsx) — scoped by parent ID
export const childConversationsAtomFamily = atomFamily((parentId: string) =>
  atom((get) => {
    const all = get(conversationsAtom);
    const children: Conversation[] = [];
    for (const conv of all.values()) {
      if (conv.parentConversationId === parentId) children.push(conv);
    }
    return children.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  })
);

// =============================================================================
// Derived Collection Atoms  (replaces derivedStore.ts entirely)
//
// Pure computed views — no subscribe(), no recompute(), no seed call.
// Jotai recomputes lazily when conversationsAtom changes. Never fires during
// streaming (streamingContentAtom changes don't affect these).
//
// ADDING A NEW VIEW: add one atom below. Components subscribe via
// useAtomValue(yourNewAtom). No other plumbing needed.
// =============================================================================

// All conversations sorted newest-first by last activity:
// last message timestamp when present, otherwise conversation creation time.
export const allConversationsAtom = atom((get) => {
  const map = get(conversationsAtom);
  return Array.from(map.values()).sort((a, b) => {
    const aTime = getConversationLastActivity(a).getTime();
    const bTime = getConversationLastActivity(b).getTime();
    return bTime - aTime;
  });
});

// Stable sorted ID list — only changes on add/delete/reorder.
// Use with atomFamily for per-item subtree pruning (see CLAUDE.md).
export const allConversationIdsAtom = atom((get) => get(allConversationsAtom).map((c) => c.id));

// Total count — cheaper than subscribing to allConversationsAtom for existence checks
export const conversationCountAtom = atom((get) => get(conversationsAtom).size);

// =============================================================================
// Worker / Swarm Derived Atoms
//
// These atoms only read worker conversations from conversationsAtom. Because the
// Map uses structural sharing (non-worker updates don't change worker entries),
// these atoms produce the same result when only non-worker conversations change,
// so swarm components skip re-render on unrelated conversation events.
// =============================================================================

// Workers grouped by project directory (workingDirectory stripped to project root).
// Used by SwarmDashboard and SwarmAnalytics to build per-project views without
// subscribing to allConversationsAtom (which sorts ALL conversations on every change).
export const workersByProjectAtom = atom((get) => {
  const convs = get(conversationsAtom);
  const groups = new Map<string, Conversation[]>();
  for (const conv of convs.values()) {
    if (!conv.isWorker) continue;
    const root = conv.workingDirectory ?? 'unknown';
    let group = groups.get(root);
    if (!group) {
      group = [];
      groups.set(root, group);
    }
    group.push(conv);
  }
  return groups;
});

// Just the project roots that have workers (for project picker dropdowns).
export const workerProjectRootsAtom = atom((get) => {
  return Array.from(get(workersByProjectAtom).keys()).sort();
});

// All worker IDs — stable list for per-item subscriptions on worker list views.
export const workerIdsAtom = atom((get) => {
  const convs = get(conversationsAtom);
  const ids: string[] = [];
  for (const conv of convs.values()) {
    if (conv.isWorker) ids.push(conv.id);
  }
  return ids;
});
