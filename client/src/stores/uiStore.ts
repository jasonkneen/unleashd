import { create } from 'zustand';
import type { UIState } from '@unleashd/shared';

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

export const useUIStore = create<UIStoreState>((set, get) => ({
  // State — defaults match UIStateSchema
  activeConversationId: null,
  lastWorkingDirectory: null,
  galleryExpandedProjects: [],
  galleryCollapsedProjects: [],
  showTempSessions: false,
  showDoneConversations: false,
  doneConversations: [],
  promotedWorkers: [],
  showWorkerConversations: false,
  lastSeenMessageIndex: {},
  sidebarViewMode: 'grouped',

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
   * Apply server state into the store. Called on init message.
   * Server is authoritative — directly merge server state over client state.
   * This ensures null values (e.g., clearing activeConversationId) are preserved.
   */
  hydrateFromServer: (serverState) => {
    set((s) => ({ ...s, ...serverState }));
  },

  /**
   * Debounced sync to server. Collects all mutations and sends once every 500ms.
   */
  syncToServer: () => {
    if (syncToServerTimer) {
      clearTimeout(syncToServerTimer);
    }
    syncToServerTimer = setTimeout(() => {
      syncToServerTimer = null;
      const state = get();
      const payload: UIState = {
        activeConversationId: state.activeConversationId,
        lastWorkingDirectory: state.lastWorkingDirectory,
        galleryExpandedProjects: state.galleryExpandedProjects,
        galleryCollapsedProjects: state.galleryCollapsedProjects,
        showTempSessions: state.showTempSessions,
        showDoneConversations: state.showDoneConversations,
        doneConversations: state.doneConversations,
        promotedWorkers: state.promotedWorkers,
        showWorkerConversations: state.showWorkerConversations,
        lastSeenMessageIndex: state.lastSeenMessageIndex,
        sidebarViewMode: state.sidebarViewMode,
      };
      fetch('/api/ui-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => console.warn('[UI State] Sync error:', err));
    }, 500);
  },
}));
