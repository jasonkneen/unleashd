import type { Conversation } from '@unleashd/shared';
import { providerSupportsFork } from '@unleashd/shared';
import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createConversation, endConversation } from '../atoms/actions';
import {
  activeConversationIdAtom,
  allConversationsAtom,
  allPendingCreationsAtom,
  defaultCwdAtom,
  wsStatusAtom,
} from '../atoms/conversations';
import { mergeModeAtom, mergeSelectionAtom } from '../atoms/mergeAtoms';
import { createDefaultDraft } from '../domain/conversation-config-draft';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { useSwarmRuntimeSnapshots } from '../hooks/useSwarmRuntimeSnapshots';
import { useUIStore } from '../stores/uiStore';
import { getProjectColor } from '../utils/projectColors';
import { getProjectRoot, isWorktreeDirectory } from '../utils/swarmUtils';
import { getWorkerVisibilitySummary } from '../utils/swarmWorkerVisibility';
import { formatTimeAgo, getConversationLastActivity, getMinutesElapsed } from '../utils/time';
import { ConversationConfigPicker } from './ConversationConfigPicker';
import { PathAutocomplete } from './PathAutocomplete';
import { SearchPalette } from './SearchPalette';
import './Sidebar.css';

const RECENT_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000;
const ROOT_PLACEHOLDER = '/';
interface FolderGroup {
  directory: string;
  conversations: Conversation[];
  lastMessageTime: number;
}

interface BuddySidebarEmployee {
  id: string;
  name: string;
  workspaces?: Array<{ id: string; name: string }>;
  projects?: Array<{ id: string; name: string }>;
  conversations?: Array<{
    conversation_id?: string | null;
    unleashd_conversation_id?: string | null;
    workspace_id?: string | null;
    status: string;
    last_active_at?: string | null;
  }>;
}

interface BuddySidebarRun {
  conversationId: string;
  buddyId: string;
  buddyName: string;
  workspaceId: string;
  workspaceName: string;
  status: string;
  lastActiveAt: string;
}

interface BuddySidebarOverview {
  employees: Array<{
    buddy: BuddySidebarEmployee;
    workspaces: Array<{ id: string; name: string }>;
  }>;
  recentRuns: BuddySidebarRun[];
}

function normalizeFolderDirectory(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return ROOT_PLACEHOLDER;
  const withoutTrailingSlashes = trimmed.replace(/\/+$/, '');
  return withoutTrailingSlashes || ROOT_PLACEHOLDER;
}

/**
 * Exponential decay for time-ago text brightness.
 * Recent ("just now") = near-white, older = fades toward muted grey.
 *
 * Uses color-mix to blend between --text-bright (near-white) and --text-muted (grey).
 * The mix percentage decays exponentially: 100% bright at 0min, ~40% at 30min, ~15% at 60min.
 * Decay constant 0.03 gives a natural half-life of ~23 minutes.
 */
function timeAgoColor(minutesElapsed: number): string {
  const brightPct = Math.round(100 * Math.exp(-0.03 * minutesElapsed));
  return `color-mix(in oklch, var(--text-bright) ${brightPct}%, var(--text-muted))`;
}

export function Sidebar() {
  const allConversations = useAtomValue(allConversationsAtom);
  const pendingCreations = useAtomValue(allPendingCreationsAtom);
  const activeConversationId = useAtomValue(activeConversationIdAtom);
  const defaultCwd = useAtomValue(defaultCwdAtom);
  const wsStatus = useAtomValue(wsStatusAtom);
  const [mergeMode, setMergeMode] = useAtom(mergeModeAtom);
  const [mergeSelection, setMergeSelection] = useAtom(mergeSelectionAtom);

  const lastWorkingDirectory = useUIStore((s) => s.lastWorkingDirectory);
  const setLastWorkingDirectory = useUIStore((s) => s.setLastWorkingDirectory);
  const doneConversations = useUIStore((s) => s.doneConversations);
  const markDone = useUIStore((s) => s.markDone);
  const hasUnseenMessages = useUIStore((s) => s.hasUnseenMessages);
  const promotedWorkers = useUIStore((s) => s.promotedWorkers);
  const sidebarViewMode = useUIStore((s) => s.sidebarViewMode);
  const setSidebarViewMode = useUIStore((s) => s.setSidebarViewMode);
  const galleryCollapsedProjects = useUIStore((s) => s.galleryCollapsedProjects);
  const toggleGalleryCollapsed = useUIStore((s) => s.toggleGalleryCollapsed);

  // Tick every 30s to keep time-ago displays current
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const promotedSet = useMemo(() => new Set(promotedWorkers), [promotedWorkers]);
  // O(1) lookup instead of O(n) Array.includes — avoids O(n*m) in visibleConversations filter
  const doneSet = useMemo(() => new Set(doneConversations), [doneConversations]);
  const buddyConversations = useMemo(
    () => allConversations.filter((conversation) => conversation.buddyContext != null),
    [allConversations]
  );

  // allConversations is already sorted newest-first by allConversationsAtom
  const workerConversationsByProject = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    for (const conv of allConversations) {
      if (!conv.isWorker || promotedSet.has(conv.id)) continue;
      const projectRoot = getProjectRoot(conv.workingDirectory);
      const existing = map.get(projectRoot);
      if (existing) {
        existing.push(conv);
      } else {
        map.set(projectRoot, [conv]);
      }
    }
    return map;
  }, [allConversations, promotedSet]);

  const workerProjectRoots = useMemo(
    () => Array.from(workerConversationsByProject.keys()),
    [workerConversationsByProject]
  );
  const runtimeSnapshots = useSwarmRuntimeSnapshots(workerProjectRoots);

  // Done conversations stay in the list for stable sort order — filtered at render time.
  // This prevents group/item order thrashing when marking conversations done.
  const visibleConversations = useMemo(
    () =>
      allConversations.filter(
        (conv) =>
          // Hide workers unless promoted to main view — they belong in the Swarm UI.
          !(conv.isWorker && !promotedSet.has(conv.id)) &&
          // Hide merge review children — they're internal forks shown only in the
          // parent's MergeProgressStrip, not as standalone sidebar entries.
          !conv.mergeChildMeta &&
          // Buddy conversations live in the virtual Buddies recent-project group.
          conv.buddyContext == null
      ),
    [allConversations, promotedSet]
  );

  const conversationIds = useMemo(
    () => new Set(allConversations.map((c) => c.id)),
    [allConversations]
  );

  const topLevelConversations = useMemo(
    () =>
      visibleConversations.filter(
        (conv) => !(conv.parentConversationId && conversationIds.has(conv.parentConversationId))
      ),
    [visibleConversations, conversationIds]
  );
  const topLevelBuddyConversations = useMemo(
    () =>
      buddyConversations.filter(
        (conv) => !(conv.parentConversationId && conversationIds.has(conv.parentConversationId))
      ),
    [buddyConversations, conversationIds]
  );
  const flatSidebarConversations = useMemo(
    () =>
      [...topLevelConversations, ...topLevelBuddyConversations].sort(
        (a, b) =>
          getConversationLastActivity(b).getTime() - getConversationLastActivity(a).getTime()
      ),
    [topLevelBuddyConversations, topLevelConversations]
  );
  const recentBuddyConversations = useMemo(() => {
    const cutoff = Date.now() - RECENT_CUTOFF_MS;
    return topLevelBuddyConversations.filter(
      (conversation) => getConversationLastActivity(conversation).getTime() >= cutoff
    );
  }, [topLevelBuddyConversations]);
  const buddyPendingCreations = useMemo(
    () => pendingCreations.filter((creation) => creation.buddyContext != null),
    [pendingCreations]
  );
  // Grouped view: split conversations into recent (48h, by folder) + older (flat)
  const { recentGroups, olderConversations } = useMemo(() => {
    if (sidebarViewMode !== 'grouped') {
      return { recentGroups: [] as FolderGroup[], olderConversations: [] as Conversation[] };
    }

    const now = Date.now();
    const recentMap = new Map<string, Conversation[]>();
    const older: Conversation[] = [];

    for (const conv of topLevelConversations) {
      const lastTime = getConversationLastActivity(conv);
      const isRecent = now - lastTime.getTime() < RECENT_CUTOFF_MS;
      const folderDirectory = normalizeFolderDirectory(conv.workingDirectory);

      if (isRecent) {
        const existing = recentMap.get(folderDirectory);
        if (existing) {
          existing.push(conv);
        } else {
          recentMap.set(folderDirectory, [conv]);
        }
      } else {
        older.push(conv);
      }
    }

    const groups: FolderGroup[] = Array.from(recentMap.entries()).map(([directory, convs]) => ({
      directory,
      conversations: convs,
      lastMessageTime: Math.max(...convs.map((c) => getConversationLastActivity(c).getTime())),
    }));
    groups.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    return { recentGroups: groups, olderConversations: older };
  }, [topLevelConversations, sidebarViewMode]);

  const collapsedSet = useMemo(() => new Set(galleryCollapsedProjects), [galleryCollapsedProjects]);

  // Count active workers (isRunning && isWorker && not promoted) for the sidebar nav button
  const { hasWorkers } = useMemo(() => {
    let nextActive = 0;
    let nextTotal = 0;
    let nextHasWorkers = false;

    for (const projectRoot of workerProjectRoots) {
      const workers = workerConversationsByProject.get(projectRoot) ?? [];
      const visibility = getWorkerVisibilitySummary(workers, runtimeSnapshots[projectRoot]);
      nextActive += visibility.runningWorkers;
      nextTotal += visibility.totalWorkers;
      if (visibility.hasWorkers) {
        nextHasWorkers = true;
      }
    }

    return {
      hasWorkers: nextHasWorkers,
      activeWorkerCount: nextActive,
      totalWorkerCount: nextTotal,
    };
  }, [runtimeSnapshots, workerConversationsByProject, workerProjectRoots]);

  // Deduplicated working directories from all conversations — fed to PathAutocomplete for fuzzy matching
  const recentDirectories = useMemo(() => {
    const dirs = new Set<string>();
    for (const conv of allConversations) {
      const dir = normalizeFolderDirectory(conv.workingDirectory);
      if (!isWorktreeDirectory(dir)) {
        dirs.add(dir);
      }
    }
    return Array.from(dirs);
  }, [allConversations]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchFilterDir, setSearchFilterDir] = useState<string | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);
  const [directory, setDirectory] = useState('');
  const [hasPendingDefault, setHasPendingDefault] = useState(false);
  const [isDirectoryValid, setIsDirectoryValid] = useState(true);
  const [configDraft, setConfigDraft] = useState(() => createDefaultDraft('codex'));
  const { catalog, error: catalogError, retry: retryCatalog } = useProviderCatalog();
  const [isCreatingSwarm, setIsCreatingSwarm] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [buddyDirectory, setBuddyDirectory] = useState<BuddySidebarEmployee[]>([]);
  const [buddyRecentRuns, setBuddyRecentRuns] = useState<BuddySidebarRun[]>([]);
  const buddyNameById = useMemo(
    () => new Map(buddyDirectory.map((employee) => [employee.id, employee.name])),
    [buddyDirectory]
  );
  const recentBuddyLinks = useMemo(() => {
    const loadedIds = new Set(
      topLevelBuddyConversations.flatMap((conversation) =>
        [conversation.id, conversation.sessionId].filter(
          (id): id is string => typeof id === 'string'
        )
      )
    );
    const links = new Map<
      string,
      {
        conversationId: string;
        buddyName: string;
        workspaceName: string;
        status: string;
        lastActiveAt: string | null;
      }
    >();

    for (const run of buddyRecentRuns) {
      if (loadedIds.has(run.conversationId)) continue;
      links.set(run.conversationId, {
        conversationId: run.conversationId,
        buddyName: run.buddyName,
        workspaceName: run.workspaceName,
        status: run.status,
        lastActiveAt: run.lastActiveAt,
      });
    }

    return Array.from(links.values()).sort(
      (a, b) => new Date(b.lastActiveAt ?? 0).getTime() - new Date(a.lastActiveAt ?? 0).getTime()
    );
  }, [buddyRecentRuns, topLevelBuddyConversations]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/buddies/overview')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: BuddySidebarOverview) => {
        if (!cancelled) {
          setBuddyDirectory(
            payload.employees.map(({ buddy, workspaces }) => ({ ...buddy, workspaces }))
          );
          setBuddyRecentRuns(payload.recentRuns);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBuddyDirectory([]);
          setBuddyRecentRuns([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNewConversation = useCallback(() => {
    // Default to the most recently active conversation's working directory,
    // then uiStore fallback, then server cwd.
    const latestConv = allConversations[0];
    const lastDir = latestConv?.workingDirectory ?? lastWorkingDirectory ?? defaultCwd ?? '/';
    setDirectory(lastDir);
    setHasPendingDefault(true);
    setModalError(null);
    setConfigDraft(createDefaultDraft('codex'));
    setShowPicker(true);
  }, [allConversations, lastWorkingDirectory, defaultCwd]);

  const handleOpenNewSwarmFlow = useCallback(() => {
    handleNewConversation();
  }, [handleNewConversation]);

  // Shift+Space global shortcut to open "New Conversation" dialog.
  // Skipped when focus is in an input/textarea so it doesn't hijack typing.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      handleNewConversation();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewConversation]);

  // Cmd+K / Ctrl+K global shortcut to open search palette.
  // Skipped when focus is in an input/textarea so it doesn't hijack typing.
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'k') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      setSearchFilterDir(undefined);
      setShowSearch(true);
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!directory.trim()) return;
    setModalError(null);
    setLastWorkingDirectory(directory);
    const newId = createConversation({ workingDirectory: directory, config: configDraft });
    setShowPicker(false);
    navigate(`/chat/${newId}`);
  }, [directory, configDraft, navigate, setLastWorkingDirectory]);

  const handleCreateNewSwarm = useCallback(async () => {
    if (!directory.trim()) return;
    setModalError(null);
    setIsCreatingSwarm(true);
    try {
      const response = await fetch(`/api/oompa-swarm-context?dir=${encodeURIComponent(directory)}`);
      const payload = (await response.json().catch(() => ({}))) as {
        prefix?: string;
        error?: string;
      };
      if (!response.ok || !payload.prefix) {
        throw new Error(payload.error ?? `Failed to load swarm context (HTTP ${response.status})`);
      }

      setLastWorkingDirectory(directory);
      const newId = createConversation({
        workingDirectory: directory,
        config: configDraft,
        swarmDebugPrefix: payload.prefix,
      });
      setShowPicker(false);
      navigate(`/chat/${newId}`);
    } catch (error) {
      setModalError((error as Error).message);
    } finally {
      setIsCreatingSwarm(false);
    }
  }, [directory, configDraft, navigate, setLastWorkingDirectory]);

  const handleCancel = () => {
    if (isCreatingSwarm) return;
    setShowPicker(false);
    setModalError(null);
  };

  const handleSelectConversation = (id: string) => {
    if (mergeMode) {
      // In merge mode, clicks toggle selection instead of navigating
      const conv = allConversations.find((c) => c.id === id);
      if (conv && !providerSupportsFork(conv.provider)) return;
      if (conv?.isRunning) return;
      setMergeSelection((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    navigate(`/chat/${id}`);
  };

  const handleToggleMergeMode = () => {
    if (mergeMode) {
      setMergeSelection(new Set());
      setMergeMode(false);
    } else {
      setMergeMode(true);
    }
  };

  const handleDone = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    // Use sessionId when available — it's stable across server restarts.
    // conv.id is a UUID in-session but becomes sessionId after the server reloads
    // from disk, so sessionId is the consistent key for persisted done state.
    markDone(conv.sessionId ?? conv.id);
    if (location.pathname.includes(conv.id)) {
      navigate('/');
    }
  };

  return (
    <div className={`sidebar ${mergeMode ? 'sidebar--merge-mode' : ''}`}>
      <div className="sidebar-header">
        {/* ── Conversations Section ── */}
        <div className="nav-section">
          <div
            className="nav-section-header nav-section-header--clickable nav-section-header--conversations"
            style={{ justifyContent: 'space-between' }}
            title="Open conversations"
          >
            <button type="button" className="nav-section-home-button" onClick={() => navigate('/')}>
              <span className="nav-section-label">Conversations</span>
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="nav-create-btn nav-create-btn--search"
                aria-label="Search conversations"
                onClick={(event) => {
                  // Keep header click from firing.
                  event.stopPropagation();
                  setSearchFilterDir(undefined);
                  setShowSearch(true);
                }}
                title="Search conversations (Cmd+K)"
              >
                <svg
                  role="img"
                  aria-hidden="true"
                  className="nav-search-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" />
                  <line
                    x1="11"
                    y1="11"
                    x2="14.5"
                    y2="14.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="nav-create-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  handleNewConversation();
                }}
                title="New conversation (Shift+Space)"
              >
                +
              </button>
              <button
                type="button"
                className={`nav-create-btn nav-create-btn--merge ${mergeMode ? 'nav-create-btn--merge-active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleMergeMode();
                }}
                title={mergeMode ? 'Exit merge mode' : 'Merge conversations'}
              >
                <svg
                  role="img"
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 2v4a3 3 0 0 0 3 3h4a3 3 0 0 1 3 3v2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M13 2v4a3 3 0 0 1-3 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="3" cy="2" r="1.3" fill="currentColor" />
                  <circle cx="13" cy="2" r="1.3" fill="currentColor" />
                  <circle cx="13" cy="14" r="1.3" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Swarms Section ── */}
        <div className="nav-section">
          <div
            className={`nav-section-header nav-section-header--clickable nav-section-header--swarms ${
              location.pathname.startsWith('/workers') ? 'nav-section-header--active' : ''
            }`}
            style={{ justifyContent: 'space-between' }}
            title={hasWorkers ? 'Open swarm dashboard' : 'Open swarm dashboard (no workers yet)'}
          >
            <button
              type="button"
              className="nav-section-home-button"
              onClick={() => navigate('/workers')}
            >
              <span className="nav-section-label">Swarms</span>
            </button>
            <button
              type="button"
              className="nav-create-btn nav-create-btn--swarm"
              onClick={(event) => {
                event.stopPropagation();
                void handleOpenNewSwarmFlow();
              }}
              title="Create new swarm"
            >
              +
            </button>
          </div>
        </div>

        {showPicker && (
          <div className="new-conv-overlay" onClick={handleCancel}>
            <div className="new-conv-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="new-conv-title">New Conversation</h3>
              <div className="new-conv-label">Working Directory</div>
              <PathAutocomplete
                value={directory}
                onChange={setDirectory}
                recentDirectories={recentDirectories}
                placeholder="Search recent or type a path..."
                className="directory-input"
                hasPendingDefault={hasPendingDefault}
                onClearDefault={() => setHasPendingDefault(false)}
                onConfirm={handleConfirm}
                onValidationChange={setIsDirectoryValid}
                autoFocus
              />
              {catalog ? (
                <ConversationConfigPicker
                  value={configDraft}
                  onChange={setConfigDraft}
                  catalog={catalog}
                />
              ) : (
                <div className="config-picker-status" role={catalogError ? 'alert' : 'status'}>
                  {catalogError ? (
                    <>
                      Unable to load providers.{' '}
                      <button type="button" onClick={retryCatalog}>
                        Retry
                      </button>
                    </>
                  ) : (
                    'Loading providers…'
                  )}
                </div>
              )}
              <div className="directory-actions">
                <button
                  type="button"
                  className="dir-action-btn dir-confirm-btn"
                  onClick={handleConfirm}
                  disabled={
                    wsStatus !== 'connected' || !isDirectoryValid || isCreatingSwarm || !catalog
                  }
                  title={
                    wsStatus !== 'connected'
                      ? 'Server disconnected'
                      : !isDirectoryValid
                        ? 'Invalid directory'
                        : isCreatingSwarm
                          ? 'Creating swarm context...'
                          : 'Create conversation (Shift+Enter)'
                  }
                >
                  Create
                  <kbd className="btn-shortcut">⇧↵</kbd>
                </button>
                <button
                  type="button"
                  className="dir-action-btn dir-swarm-btn"
                  onClick={() => {
                    void handleCreateNewSwarm();
                  }}
                  disabled={wsStatus !== 'connected' || !isDirectoryValid || isCreatingSwarm}
                  title={
                    wsStatus !== 'connected'
                      ? 'Server disconnected'
                      : !isDirectoryValid
                        ? 'Invalid directory'
                        : 'Create conversation with swarm context prefix'
                  }
                >
                  {isCreatingSwarm ? 'Preparing...' : 'New Swarm'}
                </button>
              </div>
              {modalError && <div className="new-conv-error">{modalError}</div>}
            </div>
          </div>
        )}

        <SearchPalette
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          onSelectConversation={(id) => {
            navigate(`/chat/${id}`);
          }}
          filterDirectory={searchFilterDir}
        />
      </div>

      <div className="conversations-list">
        {pendingCreations
          .filter((creation) => !creation.buddyContext)
          .map((creation) => (
            <button
              type="button"
              key={creation.conversationId}
              className={`conversation-item pending-creation ${
                creation.conversationId === activeConversationId ? 'active' : ''
              }`}
              onClick={() => navigate(`/chat/${creation.conversationId}`)}
            >
              <div className="conversation-header">
                <span className="folder-badge">
                  {creation.workingDirectory.split('/').filter(Boolean).pop() ?? '/'}
                </span>
                <span className="status-indicator pending" />
              </div>
              <div className="conversation-preview">
                {creation.error
                  ? `Failed: ${creation.error}`
                  : `Starting ${creation.config.provider}…`}
              </div>
            </button>
          ))}
        {(flatSidebarConversations.length > 0 ||
          pendingCreations.length > 0 ||
          buddyDirectory.length > 0) && (
          <div
            className="sidebar-section-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span>{sidebarViewMode === 'list' ? 'All Conversations' : 'Recent Projects'}</span>
            <div className="view-mode-toggle">
              <button
                type="button"
                className={`view-mode-btn ${sidebarViewMode === 'grouped' ? 'active' : ''}`}
                onClick={() => setSidebarViewMode('grouped')}
                title="Grouped by folder"
              >
                <svg
                  role="img"
                  aria-label="icon"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <rect
                    x="1"
                    y="1"
                    width="12"
                    height="3"
                    rx="1"
                    fill="currentColor"
                    opacity="0.5"
                  />
                  <rect x="3" y="5.5" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect x="3" y="8.5" width="10" height="2" rx="0.5" fill="currentColor" />
                  <rect
                    x="1"
                    y="11.5"
                    width="12"
                    height="1.5"
                    rx="0.5"
                    fill="currentColor"
                    opacity="0.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={`view-mode-btn ${sidebarViewMode === 'list' ? 'active' : ''}`}
                onClick={() => setSidebarViewMode('list')}
                title="Flat list"
              >
                <svg
                  role="img"
                  aria-label="icon"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <rect x="1" y="1" width="12" height="2" rx="0.5" fill="currentColor" />
                  <rect x="1" y="4.5" width="12" height="2" rx="0.5" fill="currentColor" />
                  <rect x="1" y="8" width="12" height="2" rx="0.5" fill="currentColor" />
                  <rect x="1" y="11.5" width="12" height="2" rx="0.5" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {sidebarViewMode === 'list' ? (
          flatSidebarConversations
            .filter((conv) => !doneSet.has(conv.sessionId ?? conv.id))
            .map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConversationId}
                hasUnseen={hasUnseenMessages(conv.id, conv.messages.length)}
                showFolderBadge
                contextLabel={
                  conv.buddyContext
                    ? (buddyNameById.get(conv.buddyContext.buddyId) ?? 'Buddy')
                    : undefined
                }
                onSelect={handleSelectConversation}
                onDone={handleDone}
                mergeMode={mergeMode}
                mergeSelected={mergeSelection.has(conv.id)}
                mergeDisabled={
                  mergeMode && (!providerSupportsFork(conv.provider) || conv.isRunning)
                }
              />
            ))
        ) : (
          <>
            {(buddyDirectory.length > 0 ||
              recentBuddyConversations.length > 0 ||
              buddyPendingCreations.length > 0) && (
              <div className="sidebar-section">
                <div className="folder-group folder-group--buddies">
                  <div
                    className="folder-group-header"
                    style={{ borderLeftColor: 'var(--ai)' }}
                    onClick={() => toggleGalleryCollapsed('__buddies__')}
                  >
                    <span
                      className={`folder-chevron ${
                        collapsedSet.has('__buddies__') ? 'collapsed' : ''
                      }`}
                    >
                      &#x25BC;
                    </span>
                    <button
                      type="button"
                      className="folder-group-name folder-group-name-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate('/buddies');
                      }}
                    >
                      Buddies
                    </button>
                    <span className="folder-group-count">
                      {recentBuddyConversations.filter(
                        (conversation) => !doneSet.has(conversation.sessionId ?? conversation.id)
                      ).length +
                        recentBuddyLinks.length +
                        buddyPendingCreations.length || ''}
                    </span>
                  </div>
                  {!collapsedSet.has('__buddies__') &&
                    recentBuddyConversations
                      .filter(
                        (conversation) => !doneSet.has(conversation.sessionId ?? conversation.id)
                      )
                      .map((conversation) => (
                        <ConversationItem
                          key={conversation.id}
                          conv={conversation}
                          isActive={conversation.id === activeConversationId}
                          hasUnseen={hasUnseenMessages(
                            conversation.id,
                            conversation.messages.length
                          )}
                          showFolderBadge={false}
                          contextLabel={
                            buddyNameById.get(conversation.buddyContext?.buddyId ?? '') ?? 'Buddy'
                          }
                          onSelect={handleSelectConversation}
                          onDone={handleDone}
                        />
                      ))}
                  {!collapsedSet.has('__buddies__') &&
                    recentBuddyLinks.map((link) => (
                      <button
                        type="button"
                        key={link.conversationId}
                        className={`conversation-item pending-creation ${
                          link.conversationId === activeConversationId ? 'active' : ''
                        }`}
                        onClick={() => navigate(`/chat/${link.conversationId}`)}
                      >
                        <div className="conversation-header no-badge">
                          <span className="buddy-conversation-label">{link.buddyName}</span>
                          <div className="conversation-header-right">
                            {link.lastActiveAt && (
                              <span className="conversation-time-ago">
                                {formatTimeAgo(new Date(link.lastActiveAt))}
                              </span>
                            )}
                            <span
                              className="status-indicator"
                              aria-label={`Conversation ${link.status}`}
                            />
                          </div>
                        </div>
                        <div className="conversation-preview">
                          {link.workspaceName} · {link.status}
                        </div>
                      </button>
                    ))}
                  {!collapsedSet.has('__buddies__') &&
                    buddyPendingCreations.map((creation) => (
                      <button
                        type="button"
                        key={creation.conversationId}
                        className={`conversation-item pending-creation ${
                          creation.conversationId === activeConversationId ? 'active' : ''
                        }`}
                        onClick={() => navigate(`/chat/${creation.conversationId}`)}
                      >
                        <div className="conversation-header no-badge">
                          <span className="buddy-conversation-label">
                            {buddyNameById.get(creation.buddyContext?.buddyId ?? '') ?? 'Buddy'}
                          </span>
                          <span className="status-indicator pending" />
                        </div>
                        <div className="conversation-preview">
                          {creation.error
                            ? `Failed: ${creation.error}`
                            : `Starting ${creation.config.provider}…`}
                        </div>
                      </button>
                    ))}
                  {!collapsedSet.has('__buddies__') &&
                    recentBuddyConversations.every((conversation) =>
                      doneSet.has(conversation.sessionId ?? conversation.id)
                    ) &&
                    recentBuddyLinks.length === 0 &&
                    buddyPendingCreations.length === 0 && (
                      <div className="folder-group-all-done">No recent Buddy conversations</div>
                    )}
                </div>
              </div>
            )}

            {recentGroups.length > 0 && (
              <div className="sidebar-section">
                {recentGroups.map((group) => {
                  const isCollapsed = collapsedSet.has(group.directory);
                  const dirDisplay = group.directory.replace(/^\/Users\/[^/]+/, '~');
                  const projectColor = getProjectColor(group.directory);
                  // Filter done at render time — group position stays stable
                  const activeConvs = group.conversations.filter(
                    (c) => !doneSet.has(c.sessionId ?? c.id)
                  );

                  return (
                    <div key={group.directory} className="folder-group">
                      <div
                        className="folder-group-header"
                        onClick={() => toggleGalleryCollapsed(group.directory)}
                        style={{ borderLeftColor: projectColor }}
                      >
                        <span className={`folder-chevron ${isCollapsed ? 'collapsed' : ''}`}>
                          &#x25BC;
                        </span>
                        <span className="folder-group-name" title={group.directory}>
                          {dirDisplay}
                        </span>
                        <button
                          type="button"
                          className="folder-group-add-btn"
                          aria-label={`Search in ${dirDisplay}`}
                          title={`Search in ${dirDisplay}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchFilterDir(group.directory);
                            setShowSearch(true);
                          }}
                        >
                          <svg
                            role="img"
                            aria-hidden="true"
                            width="10"
                            height="10"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" />
                            <line
                              x1="11"
                              y1="11"
                              x2="14.5"
                              y2="14.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="folder-group-add-btn"
                          title={`New conversation in ${dirDisplay}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDirectory(group.directory);
                            setHasPendingDefault(false);
                            setModalError(null);
                            setShowPicker(true);
                          }}
                        >
                          +
                        </button>
                        <span className="folder-group-count">{activeConvs.length || ''}</span>
                      </div>
                      {!isCollapsed &&
                        (activeConvs.length > 0 ? (
                          activeConvs.map((conv) => (
                            <ConversationItem
                              key={conv.id}
                              conv={conv}
                              isActive={conv.id === activeConversationId}
                              hasUnseen={hasUnseenMessages(conv.id, conv.messages.length)}
                              showFolderBadge={false}
                              onSelect={handleSelectConversation}
                              onDone={handleDone}
                            />
                          ))
                        ) : (
                          <div className="folder-group-all-done">All conversations marked done</div>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}

            {olderConversations.some((c) => !doneSet.has(c.sessionId ?? c.id)) && (
              <div className="sidebar-section">
                <div className="sidebar-section-header">Older</div>
                {olderConversations
                  .filter((conv) => !doneSet.has(conv.sessionId ?? conv.id))
                  .map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeConversationId}
                      hasUnseen={hasUnseenMessages(conv.id, conv.messages.length)}
                      showFolderBadge
                      onSelect={handleSelectConversation}
                      onDone={handleDone}
                    />
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Extracted conversation item — avoids duplicating JSX across list/grouped modes.
 * showFolderBadge=false in grouped mode since the folder header already shows the path.
 */
function ConversationItem({
  conv,
  isActive,
  hasUnseen,
  showFolderBadge,
  onSelect,
  onDone,
  contextLabel,
  mergeMode = false,
  mergeSelected = false,
  mergeDisabled = false,
}: {
  conv: Conversation;
  isActive: boolean;
  hasUnseen: boolean;
  showFolderBadge: boolean;
  onSelect: (id: string) => void;
  onDone: (conv: Conversation, e: React.MouseEvent) => void;
  contextLabel?: string;
  mergeMode?: boolean;
  mergeSelected?: boolean;
  mergeDisabled?: boolean;
}) {
  const workingDirectory = normalizeFolderDirectory(conv.workingDirectory);
  const projectColor = getProjectColor(workingDirectory);
  const dirDisplay = workingDirectory.replace(/^\/Users\/[^/]+/, '~');
  const folderName = workingDirectory.split('/').filter(Boolean).pop() ?? dirDisplay;
  const preview =
    conv.messages.length > 0
      ? conv.messages[conv.messages.length - 1].content.substring(0, 120)
      : 'New conversation';

  const lastTime = getConversationLastActivity(conv);
  const timeAgo = lastTime ? formatTimeAgo(lastTime) : null;
  const timeColor = lastTime ? timeAgoColor(getMinutesElapsed(lastTime)) : undefined;

  const itemClasses = [
    'conversation-item',
    isActive ? 'active' : '',
    mergeMode ? 'conversation-item--merge-mode' : '',
    mergeSelected ? 'conversation-item--merge-selected' : '',
    mergeMode && mergeDisabled ? 'conversation-item--merge-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={itemClasses}
      onClick={() => onSelect(conv.id)}
      title={mergeDisabled ? `Fork not supported for ${conv.provider}` : undefined}
    >
      {mergeMode && (
        <div
          className={`merge-checkmark ${mergeSelected ? 'merge-checkmark--on' : ''} ${mergeDisabled ? 'merge-checkmark--disabled' : ''}`}
          aria-hidden="true"
        >
          {mergeSelected ? '✓' : ''}
        </div>
      )}
      <div className={`conversation-header ${showFolderBadge ? '' : 'no-badge'}`}>
        {showFolderBadge && (
          <span
            className="folder-badge"
            style={{
              color: projectColor,
            }}
            title={dirDisplay}
          >
            {conv.buddyContext ? 'Buddies' : folderName}
          </span>
        )}
        {!showFolderBadge && contextLabel && (
          <span className="buddy-conversation-label">{contextLabel}</span>
        )}
        <div className="conversation-header-right">
          {hasUnseen && <span className="new-badge">NEW</span>}
          {timeAgo && (
            <span className="conversation-time-ago" style={{ color: timeColor }}>
              {timeAgo}
            </span>
          )}
          {conv.isRunning ? (
            <div className="running-status-control">
              <span className="status-indicator running" aria-label="Conversation is running" />
              <button
                type="button"
                className="thread-stop-btn"
                title="Stop this conversation and clear queued work"
                aria-label={`Stop conversation ${conv.id.substring(0, 8)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  endConversation(conv.id);
                }}
              >
                Stop
              </button>
            </div>
          ) : (
            <span
              className={`status-indicator ${conv.queue?.length ? 'pending' : ''}`}
              aria-label={conv.queue?.length ? 'Conversation has queued work' : 'Conversation idle'}
            />
          )}
        </div>
      </div>
      <div className="conversation-preview">{preview}</div>
      {!mergeMode && (
        <button type="button" className="done-btn" onClick={(e) => onDone(conv, e)}>
          Done
        </button>
      )}
    </div>
  );
}
