import { UIStateSchema, type UIState } from '@unleashd/shared';
import { create } from 'zustand';

// =============================================================================
// UI Store — Pure in-memory state, synced to server
//
// Preferences (activeConversationId, sidebar mode, done conversations, etc.)
// are fetched from server on init and synced back on mutation.
//
// In-flight crash-recovery state stays in localStorage (see external keys below).
//
// NEW Badge Feature (2026-02-02):
// lastSeenMessageIndex tracks the last message index the user has viewed in
// each conversation. When lastSeenIndex < messages.length - 1, a "NEW" badge
// appears in the sidebar. IntersectionObserver in Chat.tsx detects when the
// last message becomes visible and calls markMessagesSeen to update this state.
// See docs/new_badge_feature.md for full design rationale.
// =============================================================================

// ---------------------------------------------------------------------------
// Partition: shared (server-synced) vs local (device-local, localStorage)
// ---------------------------------------------------------------------------
//
// UIStateSchema has 11 fields. They are partitioned without changing the
// schema shape (no migration needed — server tolerates partial via spread+
// defaults):
//
//   shared (4) — cross-device, synced via POST /api/ui-state:
//     doneConversations, promotedWorkers, lastSeenMessageIndex, lastWorkingDirectory
//
//   local (7) — per-device, persisted to localStorage under 'unleashd-ui-local':
//     activeConversationId, galleryExpandedProjects, galleryCollapsedProjects,
//     showTempSessions, showDoneConversations, showWorkerConversations, sidebarViewMode
//
// Rationale: two concurrent clients (phone + desktop) race on local fields
// (e.g. activeConversationId from URL routing). Partitioning prevents last-
// writer-wins cross-device churn. Phone never mutates desktop-local fields.
//
// syncToServer POSTs only `shared`. The `local` slice is written to
// localStorage piggybacking the same 500ms debounce timer (no second timer).
// Store init reads 'unleashd-ui-local' (Zod partial parse, discard whole blob
// on failure) BEFORE hydrateFromServer, which then merges only `shared`.
//
// Post-v1: fold into jotai atomWithStorage (local) + debounced POST (shared).
// partitionUiState boundaries become the migration map.
// ---------------------------------------------------------------------------

export const LOCAL_STORAGE_KEY = 'unleashd-ui-local';

export type SharedSlice = Pick<
  UIState,
  'doneConversations' | 'promotedWorkers' | 'lastSeenMessageIndex' | 'lastWorkingDirectory'
>;

export type LocalSlice = Pick<
  UIState,
  | 'activeConversationId'
  | 'galleryExpandedProjects'
  | 'galleryCollapsedProjects'
  | 'showTempSessions'
  | 'showDoneConversations'
  | 'showWorkerConversations'
  | 'sidebarViewMode'
>;

/**
 * Pure κ: partition a full UIState into shared (server) and local (device) slices.
 */
export function partitionUiState(state: UIState): { shared: SharedSlice; local: LocalSlice } {
  return {
    shared: {
      doneConversations: state.doneConversations,
      promotedWorkers: state.promotedWorkers,
      lastSeenMessageIndex: state.lastSeenMessageIndex,
      lastWorkingDirectory: state.lastWorkingDirectory,
    },
    local: {
      activeConversationId: state.activeConversationId,
      galleryExpandedProjects: state.galleryExpandedProjects,
      galleryCollapsedProjects: state.galleryCollapsedProjects,
      showTempSessions: state.showTempSessions,
      showDoneConversations: state.showDoneConversations,
      showWorkerConversations: state.showWorkerConversations,
      sidebarViewMode: state.sidebarViewMode,
    },
  };
}

function loadLocalSlice(): Partial<LocalSlice> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const result = UIStateSchema.partial().safeParse(parsed);
    if (!result.success) {
      // Discard whole blob on failure — no silent half-merge
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return {};
    }
    // Return only the local keys (defensive — ignore any shared keys if present)
    const data = result.data;
    const local: Partial<LocalSlice> = {};
    if ('activeConversationId' in data) local.activeConversationId = data.activeConversationId as LocalSlice['activeConversationId'];
    if ('galleryExpandedProjects' in data) local.galleryExpandedProjects = data.galleryExpandedProjects as LocalSlice['galleryExpandedProjects'];
    if ('galleryCollapsedProjects' in data) local.galleryCollapsedProjects = data.galleryCollapsedProjects as LocalSlice['galleryCollapsedProjects'];
    if ('showTempSessions' in data) local.showTempSessions = data.showTempSessions as LocalSlice['showTempSessions'];
    if ('showDoneConversations' in data) local.showDoneConversations = data.showDoneConversations as LocalSlice['showDoneConversations'];
    if ('showWorkerConversations' in data) local.showWorkerConversations = data.showWorkerConversations as LocalSlice['showWorkerConversations'];
    if ('sidebarViewMode' in data) local.sidebarViewMode = data.sidebarViewMode as LocalSlice['sidebarViewMode'];
    return local;
  } catch {
    // JSON parse or storage access failure — discard is implicit
    return {};
  }
}

const initialLocal = loadLocalSlice();

// ---------------------------------------------------------------------------
// External Keys (cannot live in Zustand — documented here for discoverability)
//
// draft:{conversationId}   — Written from uncontrolled textarea via refs in
//                            Chat.tsx. Must bypass React render cycle.
// pendingConversations     — Read/written inside actions.ts during
//                            WebSocket init (non-React context).
// pendingFiles:{conversationId} — Serialized array of files awaiting send (images only,
//                            previewUrl omitted since it's an object URL).
// ---------------------------------------------------------------------------
export const DRAFT_KEY_PREFIX = 'draft:';
export const PENDING_CONVERSATIONS_KEY = 'pendingConversations';
export const PENDING_FILES_KEY_PREFIX = 'pendingFiles:';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface UIStoreState extends UIState {
  // Actions
  setActiveConversationId: (id: string | null) => void;
  setLastWorkingDirectory: (dir: string) => void;

  toggleGalleryExpanded: (dir: string) => void;
  toggleGalleryCollapsed: (dir: string) => void;
  setShowTempSessions: (show: boolean) => void;
  setShowDoneConversations: (show: boolean) => void;

  markDone: (conversationId: string) => void;
  unmarkDone: (conversationId: string) => void;
  isDone: (conversationId: string) => boolean;

  promoteWorker: (conversationId: string) => void;
  demoteToWorker: (conversationId: string) => void;
  setShowWorkerConversations: (show: boolean) => void;

  markMessagesSeen: (conversationId: string, messageIndex: number) => void;
  hasUnseenMessages: (conversationId: string, totalMessages: number) => boolean;

  setSidebarViewMode: (mode: 'grouped' | 'list') => void;

  // Server sync
  hydrateFromServer: (state: UIState) => void;
  syncToServer: () => void;
}

// ---------------------------------------------------------------------------
// Store — Pure in-memory, synced to server on mutation
// ---------------------------------------------------------------------------

// Debounce timer for server sync — shared across all mutations
let syncToServerTimer: ReturnType<typeof setTimeout> | null = null;

// Guard: don't sync default (empty) state to server before hydration.
// Without this, the Chat component's setActiveConversationId fires syncToServer
// on mount — before the WS init delivers the authoritative server state — and
// overwrites persisted doneConversations/lastSeenMessageIndex with empty defaults.
let hydrated = false;

export const useUIStore = create<UIStoreState>((set, get) => ({
  // State — defaults match UIStateSchema, overlaid with localStorage local slice
  activeConversationId: initialLocal.activeConversationId ?? null,
  lastWorkingDirectory: null,
  galleryExpandedProjects: initialLocal.galleryExpandedProjects ?? [],
  galleryCollapsedProjects: initialLocal.galleryCollapsedProjects ?? [],
  showTempSessions: initialLocal.showTempSessions ?? false,
  showDoneConversations: initialLocal.showDoneConversations ?? false,
  doneConversations: [],
  promotedWorkers: [],
  showWorkerConversations: initialLocal.showWorkerConversations ?? false,
  lastSeenMessageIndex: {},
  sidebarViewMode: initialLocal.sidebarViewMode ?? 'grouped',

  // =========================================================================
  // Actions — mutations
  // =========================================================================

  setActiveConversationId: (id) => {
    set({ activeConversationId: id });
    get().syncToServer();
  },

  setLastWorkingDirectory: (dir) => {
    set({ lastWorkingDirectory: dir });
    get().syncToServer();
  },

  toggleGalleryExpanded: (dir) => {
    set((s) => {
      const current = new Set(s.galleryExpandedProjects);
      if (current.has(dir)) {
        current.delete(dir);
      } else {
        current.add(dir);
      }
      return { galleryExpandedProjects: Array.from(current) };
    });
    get().syncToServer();
  },

  toggleGalleryCollapsed: (dir) => {
    set((s) => {
      const current = new Set(s.galleryCollapsedProjects);
      if (current.has(dir)) {
        current.delete(dir);
      } else {
        current.add(dir);
      }
      return { galleryCollapsedProjects: Array.from(current) };
    });
    get().syncToServer();
  },

  setShowTempSessions: (show) => {
    set({ showTempSessions: show });
    get().syncToServer();
  },

  setShowDoneConversations: (show) => {
    set({ showDoneConversations: show });
    get().syncToServer();
  },

  markDone: (conversationId) => {
    set((s) => {
      if (s.doneConversations.includes(conversationId)) return s;
      return { doneConversations: [...s.doneConversations, conversationId] };
    });
    get().syncToServer();
  },

  unmarkDone: (conversationId) => {
    set((s) => ({
      doneConversations: s.doneConversations.filter((id) => id !== conversationId),
    }));
    get().syncToServer();
  },

  isDone: (conversationId) => get().doneConversations.includes(conversationId),

  promoteWorker: (conversationId) => {
    set((s) => {
      if (s.promotedWorkers.includes(conversationId)) return s;
      return { promotedWorkers: [...s.promotedWorkers, conversationId] };
    });
    get().syncToServer();
  },

  demoteToWorker: (conversationId) => {
    set((s) => ({
      promotedWorkers: s.promotedWorkers.filter((id) => id !== conversationId),
    }));
    get().syncToServer();
  },

  setShowWorkerConversations: (show) => {
    set({ showWorkerConversations: show });
    get().syncToServer();
  },

  markMessagesSeen: (conversationId, messageIndex) => {
    set((s) => ({
      lastSeenMessageIndex: {
        ...s.lastSeenMessageIndex,
        [conversationId]: messageIndex,
      },
    }));
    get().syncToServer();
  },

  setSidebarViewMode: (mode) => {
    set({ sidebarViewMode: mode });
    get().syncToServer();
  },

  hasUnseenMessages: (conversationId, totalMessages) => {
    if (totalMessages === 0) return false;
    const lastSeen = get().lastSeenMessageIndex[conversationId];
    if (lastSeen === undefined) return false;
    return lastSeen < totalMessages - 1;
  },

  // =========================================================================
  // Server sync
  // =========================================================================

  /**
   * Apply server state into the store. Only merges the shared slice — local
   * fields (activeConversationId, galleryExpandedProjects, etc.) are preserved.
   * This keeps URL-derived activeConversationId intact and avoids overwriting
   * device-local prefs with another client's stale values. Called on init message.
   */
  hydrateFromServer: (serverState) => {
    const { shared } = partitionUiState(serverState);
    set((s) => ({ ...s, ...shared }));
    hydrated = true;
    // Sync merged state back so pre-hydration mutations (lastSeenMessageIndex etc.)
    // aren't lost if the server restarts before the next user-initiated mutation.
    get().syncToServer();
  },

  /**
   * Debounced sync. POSTs only the shared slice to the server and writes the
   * local slice to localStorage under 'unleashd-ui-local' piggybacking the same
   * 500ms timer (no second timer).
   */
  syncToServer: () => {
    if (syncToServerTimer) {
      clearTimeout(syncToServerTimer);
    }
    syncToServerTimer = setTimeout(() => {
      syncToServerTimer = null;
      const state = get();
      const { shared, local } = partitionUiState(state);
      // Persist device-local slice — same debounce, no new timer
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
        }
      } catch {
        // quota or private-mode failure — server sync still proceeds
      }
      if (!hydrated) return; // gated: don't POST shared before hydration
      fetch('/api/ui-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shared),
      })
        .then((res) => {
          if (!res.ok) console.warn(`[UI State] Sync failed: ${res.status} ${res.statusText}`);
        })
        .catch((err) => console.warn('[UI State] Sync error:', err));
    }, 500);
  },
}));
