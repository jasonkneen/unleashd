import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { createConversation } from '../../atoms/pending-creations';
import { allConversationIdsAtom } from '../../atoms/conversations';
import { setConversationConfig } from '../../atoms/config-actions';
import { useProviderCatalog } from '../../hooks/useProviderCatalog';
import { buddyApi, asArray } from '../../components/buddies/api';
import type {
  Buddy,
  BuddyAutomation,
  BuddyMemory,
  BuddyProject,
  ConversationLink,
  EmployeeRecord,
  EmployeeTab,
  LegacyWorkItem,
  Sprint,
  Workspace,
} from '../../components/buddies/types';
import { EMPTY_MEMORY } from '../../components/buddies/types';
import { buddyProjectTodoProgress } from '../../components/buddies/ui-contract';
import {
  buildBuddyContextForTalk,
  countReviewConversations,
  deriveBuddyHierarchy,
  filterAutomationConversations,
  filterVisibleConversations,
  getLatestWorkspaceConversation,
  selectLegacyWorkForWorkspace,
  selectPrimaryProject,
  selectWorkspace,
  selectWorkspaceProjects,
} from '../../components/buddies/buddies-shaping';
import { EmptyState } from '../components/EmptyState';

/**
 * BuddyDetailMobile — per-buddy detail at /buddies/:buddyId (mobile).
 *
 * Tabs: work / conversations / memory / automations (EmployeeTab).
 * - All data via components/buddies/{api,types,ui-contract,buddies-shaping}
 *   imported verbatim — never desktop components.
 * - Conversation awareness ONLY via getConversationKind/matchConversationKind
 *   inside buddies-shaping helpers. No raw buddyContext field reads in this file
 *   (grep gate, PLANNING §4).
 * - Provider/model/effort are pass-through strings (no translation) using
 *   atoms/config-actions for conversation config and buddyApi PATCH for the
 *   buddy profile. Strings travel verbatim to the upstream CLI.
 */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const TABS: readonly { id: EmployeeTab; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'conversations', label: 'Chats' },
  { id: 'memory', label: 'Memory' },
  { id: 'automations', label: 'Autos' },
] as const;

export function BuddyDetailMobile() {
  const { buddyId } = useParams<{ buddyId: string }>();
  const navigate = useNavigate();
  const conversationIds = useAtomValue(allConversationIdsAtom);
  const availableIds = useMemo(() => new Set(conversationIds), [conversationIds]);

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [memory, setMemory] = useState<BuddyMemory>(EMPTY_MEMORY);
  const [automations, setAutomations] = useState<BuddyAutomation[]>([]);
  const [activeTab, setActiveTab] = useState<EmployeeTab>('work');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [showReviewConversations, setShowReviewConversations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadGenerationRef = useState(() => ({ current: 0 }))[0];

  const loadEmployee = useCallback(
    async (signal?: AbortSignal, generation = loadGenerationRef.current) => {
      if (!buddyId) return;
      const encoded = encodeURIComponent(buddyId);
      const [detail, contextPayload, projectPayload] = await Promise.all([
        buddyApi<Record<string, unknown>>(`/api/buddies/${encoded}`, { signal }),
        buddyApi<Record<string, unknown>>(`/api/buddies/${encoded}/context`, { signal }),
        buddyApi<unknown>(`/api/buddies/${encoded}/projects?includeClosed=true`, { signal }),
      ]);
      if (signal?.aborted || generation !== loadGenerationRef.current) return;
      const buddy = (detail.buddy ?? detail) as unknown as Buddy;
      const workspaces = asArray<Workspace>(detail, 'workspaces');
      const relationships = asArray<{
        from_buddy_id: string;
        to_buddy_id: string;
        kind: string;
        from_buddy_name?: string;
        to_buddy_name?: string;
      }>(detail, 'relationships');
      const { manager, directReports } = deriveBuddyHierarchy(relationships, buddy.id);
      const legacyWorkItems = asArray<LegacyWorkItem>(detail, 'legacyWorkItems');
      const record: EmployeeRecord = {
        buddy,
        workspaces,
        sprints: contextPayload.sprint ? [contextPayload.sprint as Sprint] : [],
        projects: asArray<BuddyProject>(projectPayload, 'projects'),
        legacyWorkItems,
        conversations: asArray<ConversationLink>(detail, 'conversations'),
        skills: asArray<{ name: string; mode?: string; instruction_path?: string | null }>(
          detail,
          'skills',
        ),
        manager,
        directReports,
        reviews: asArray<EmployeeRecord['reviews'][number]>(detail, 'reviews'),
        approvals: asArray<EmployeeRecord['approvals'][number]>(detail, 'approvals'),
      };
      setEmployee(record);
      const preferredWorkspace =
        workspaces.find((candidate) =>
          legacyWorkItems.some((item) => item.project_id === candidate.id),
        ) ??
        workspaces.find((candidate) => candidate.slug !== 'buddies') ??
        workspaces[0];
      setSelectedWorkspaceId(preferredWorkspace?.id ?? '');
    },
    [buddyId, loadGenerationRef],
  );

  const loadMemory = useCallback(
    async (signal?: AbortSignal, generation = loadGenerationRef.current) => {
      if (!buddyId) return;
      const encoded = encodeURIComponent(buddyId);
      const [contextPayload, memoryPayload] = await Promise.all([
        buddyApi<Record<string, unknown>>(`/api/buddies/${encoded}/context`, { signal }),
        buddyApi<BuddyMemory>(`/api/buddies/${encoded}/memory`, { signal }),
      ]);
      if (signal?.aborted || generation !== loadGenerationRef.current) return;
      setMemory({
        ...(memoryPayload ?? EMPTY_MEMORY),
        soul: typeof contextPayload.soul === 'string' ? contextPayload.soul : undefined,
        soulPath: employee?.buddy.soul_path ?? null,
      });
      setMemoryError(null);
    },
    [buddyId, employee?.buddy.soul_path, loadGenerationRef],
  );

  const loadAutomations = useCallback(
    async (signal?: AbortSignal, generation = loadGenerationRef.current) => {
      if (!buddyId) return;
      const encoded = encodeURIComponent(buddyId);
      const payload = await buddyApi<unknown>(`/api/buddies/${encoded}/automations`, { signal });
      if (signal?.aborted || generation !== loadGenerationRef.current) return;
      setAutomations(asArray<BuddyAutomation>(payload, 'automations'));
      setAutomationError(null);
    },
    [buddyId, loadGenerationRef],
  );

  useEffect(() => {
    if (!buddyId) return;
    const generation = ++loadGenerationRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setActiveTab('work');
    setShowReviewConversations(false);
    setSelectedWorkspaceId('');
    setEmployee(null);
    setMemory(EMPTY_MEMORY);
    setAutomations([]);
    void loadEmployee(controller.signal, generation)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [buddyId, loadEmployee, loadGenerationRef]);

  useEffect(() => {
    if (!buddyId || !employee) return;
    if (activeTab === 'work' || activeTab === 'conversations') return;
    const generation = loadGenerationRef.current;
    const controller = new AbortController();
    if (activeTab === 'memory') {
      void loadMemory(controller.signal, generation).catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setMemoryError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    } else {
      void loadAutomations(controller.signal, generation).catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setAutomationError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    }
    return () => controller.abort();
  }, [activeTab, buddyId, employee, loadAutomations, loadMemory, loadGenerationRef]);

  const workspace = useMemo(
    () => selectWorkspace(employee?.workspaces ?? [], selectedWorkspaceId),
    [employee?.workspaces, selectedWorkspaceId],
  );
  const workspaceProjects = useMemo(
    () => selectWorkspaceProjects(employee?.projects ?? [], workspace?.id),
    [employee?.projects, workspace?.id],
  );
  const legacyWork = useMemo(
    () => selectLegacyWorkForWorkspace(employee?.legacyWorkItems ?? [], workspace?.id),
    [employee?.legacyWorkItems, workspace?.id],
  );
  const primaryProject = useMemo(() => selectPrimaryProject(workspaceProjects), [workspaceProjects]);
  const visibleConversations = useMemo(
    () =>
      filterVisibleConversations(employee?.conversations ?? [], showReviewConversations, availableIds),
    [availableIds, employee?.conversations, showReviewConversations],
  );
  const reviewCount = useMemo(
    () => countReviewConversations(employee?.conversations ?? []),
    [employee?.conversations],
  );
  const automationConversations = useMemo(
    () => filterAutomationConversations(employee?.conversations ?? []),
    [employee?.conversations],
  );
  const latestWorkspaceConversation = useMemo(
    () => getLatestWorkspaceConversation(employee?.conversations ?? [], workspace?.id),
    [employee?.conversations, workspace?.id],
  );

  const talk = useCallback(
    (targetWorkspace: Workspace, buddyProjectId?: string) => {
      if (!employee) return;
      const context = buildBuddyContextForTalk({
        buddyId: employee.buddy.id,
        workspaceId: targetWorkspace.id,
        buddyProjectId: buddyProjectId ?? null,
      });
      const id = createConversation({
        workingDirectory: targetWorkspace.root_path,
        config: {
          provider: (employee.buddy.provider || 'codex') as Buddy['provider'] & string as never,
          model: employee.buddy.model
            ? { mode: 'explicit', modelId: employee.buddy.model }
            : { mode: 'default' },
          reasoning: employee.buddy.reasoning_effort
            ? { mode: 'explicit', effort: employee.buddy.reasoning_effort }
            : { mode: 'default' },
        },
        buddyContext: context,
      });
      navigate(`/chat/${id}`);
    },
    [employee, navigate],
  );

  const openProjectConversation = useCallback(
    (targetWorkspace: Workspace, projectId: string) => {
      const existing = [...(employee?.conversations ?? [])]
        .filter((conversation) => {
          const conversationId = conversation.conversation_id ?? conversation.unleashd_conversation_id;
          return (
            conversation.buddy_project_id === projectId &&
            Boolean(conversationId && availableIds.has(conversationId))
          );
        })
        .sort(
          (left, right) =>
            new Date(right.last_active_at ?? 0).getTime() -
            new Date(left.last_active_at ?? 0).getTime(),
        )[0];
      const conversationId = existing?.conversation_id ?? existing?.unleashd_conversation_id;
      if (conversationId) {
        navigate(`/chat/${conversationId}`);
        return;
      }
      talk(targetWorkspace, projectId);
    },
    [availableIds, employee?.conversations, navigate, talk],
  );

  if (!buddyId) {
    return (
      <div className="mobile-hub">
        <EmptyState icon="◎" message="No buddy selected." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mobile-hub" role="status" aria-live="polite" aria-busy="true">
        <p className="mobile-empty__message">Loading buddy…</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="mobile-hub">
        <EmptyState
          icon="⚠"
          title="Could not load buddy"
          message={error ?? 'Buddy not found.'}
          actionLabel="Back to Buddies"
          onAction={() => navigate('/buddies')}
        />
      </div>
    );
  }

  return (
    <div className="mobile-hub mobile-buddy-detail">
      <header className="mobile-buddy-detail__hero">
        <button
          type="button"
          className="mobile-buddy-detail__back"
          onClick={() => navigate('/buddies')}
          aria-label="Back to Buddies"
        >
          ← Buddies
        </button>
        <div className="mobile-buddy-detail__identity">
          <span className="mobile-buddy-card__avatar" aria-hidden="true">
            {initials(employee.buddy.name)}
          </span>
          <div className="mobile-buddy-detail__copy">
            <h1 className="mobile-buddy-detail__name">{employee.buddy.name}</h1>
            <p className="mobile-buddy-detail__role">{employee.buddy.role}</p>
            <span className={`mobile-buddy-card__presence mobile-buddy-card__presence--${employee.buddy.status}`}>
              {employee.buddy.status}
            </span>
          </div>
        </div>
        <div className="mobile-buddy-detail__meta">
          <span>
            Reports to <strong>{employee.manager?.name ?? 'Owner'}</strong>
          </span>
          {employee.directReports.length > 0 && (
            <span>
              {employee.directReports.length} {employee.directReports.length === 1 ? 'report' : 'reports'}:{' '}
              {employee.directReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className="mobile-link"
                  onClick={() => navigate(`/buddies/${encodeURIComponent(report.id)}`)}
                >
                  {report.name}
                </button>
              ))}
            </span>
          )}
          <span>
            {employee.skills.length} {employee.skills.length === 1 ? 'skill' : 'skills'}
          </span>
        </div>

        <BuddyProfileEditor
          buddy={employee.buddy}
          busy={busy === 'profile'}
          error={profileError}
          onBusy={(value) => setBusy(value ? 'profile' : null)}
          onError={setProfileError}
          onSaved={() => void loadEmployee().catch(() => {})}
        />
      </header>

      <nav className="mobile-buddy-detail__tabs" aria-label="Buddy sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={
              activeTab === tab.id
                ? 'mobile-buddy-detail__tab mobile-buddy-detail__tab--active'
                : 'mobile-buddy-detail__tab'
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'work' && (
        <WorkTab
          employee={employee}
          workspace={workspace}
          workspaces={employee.workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          onSelectWorkspace={setSelectedWorkspaceId}
          workspaceProjects={workspaceProjects}
          legacyWork={legacyWork}
          primaryProject={primaryProject}
          latestWorkspaceConversation={latestWorkspaceConversation}
          onTalk={talk}
          onOpenProjectConversation={openProjectConversation}
        />
      )}

      {activeTab === 'conversations' && (
        <ConversationsTab
          visibleConversations={visibleConversations}
          reviewCount={reviewCount}
          showReviewConversations={showReviewConversations}
          onToggleReviews={() => setShowReviewConversations((value) => !value)}
          onOpenConversation={(conversationId) => navigate(`/chat/${conversationId}`)}
          workspace={workspace}
          onTalk={() => workspace && talk(workspace)}
          onEditConversationConfig={(conversationId, expectedRevision, patch) => {
            setBusy(`config-${conversationId}`);
            try {
              // Pass-through verbatim: patch strings flow unchanged to the CLI harness.
              // setConversationConfig owns the WS command lifecycle.
              setConversationConfig({ conversationId, expectedRevision, patch });
            } finally {
              setBusy(null);
            }
          }}
          busy={busy}
        />
      )}

      {activeTab === 'memory' && (
        <MemoryTab
          memory={memory}
          error={memoryError}
          buddy={employee.buddy}
          onRetry={() => {
            const controller = new AbortController();
            void loadMemory(controller.signal).catch((cause: unknown) =>
              setMemoryError(cause instanceof Error ? cause.message : String(cause)),
            );
          }}
        />
      )}

      {activeTab === 'automations' && (
        <AutomationsTab
          buddyId={employee.buddy.id}
          workspaceId={workspace?.id}
          automations={automations}
          automationConversations={automationConversations}
          busy={busy}
          setBusy={setBusy}
          error={automationError}
          onOpenConversation={(conversationId) => navigate(`/chat/${conversationId}`)}
          onRefresh={() =>
            loadAutomations().catch((cause: unknown) =>
              setAutomationError(cause instanceof Error ? cause.message : String(cause)),
            )
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work tab (uses shaping helpers, no raw buddyContext)
// ---------------------------------------------------------------------------

function WorkTab({
  employee,
  workspace,
  workspaces,
  selectedWorkspaceId: _selectedWorkspaceId,
  onSelectWorkspace,
  workspaceProjects,
  legacyWork,
  primaryProject,
  latestWorkspaceConversation,
  onTalk,
  onOpenProjectConversation,
}: {
  employee: EmployeeRecord;
  workspace: Workspace | undefined;
  workspaces: Workspace[];
  selectedWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  workspaceProjects: BuddyProject[];
  legacyWork: LegacyWorkItem[];
  primaryProject: BuddyProject | undefined;
  latestWorkspaceConversation: ConversationLink | undefined;
  onTalk: (workspace: Workspace, buddyProjectId?: string) => void;
  onOpenProjectConversation: (workspace: Workspace, projectId: string) => void;
}) {
  const availableIds = useAtomValue(allConversationIdsAtom);
  const availableSet = useMemo(() => new Set(availableIds), [availableIds]);

  return (
    <section className="mobile-buddy-section" aria-label="Work">
      <label className="mobile-buddy-section__label">
        Workspace
        <select
          value={workspace?.id ?? ''}
          onChange={(event) => onSelectWorkspace(event.target.value)}
          className="mobile-buddy-section__select"
        >
          {workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {workspace && <p className="mobile-muted">{workspace.root_path}</p>}

      <div className="mobile-buddy-summary">
        <div className="mobile-buddy-summary__row">
          <span>Primary next action</span>
          <strong>{primaryProject?.next_action ?? 'Choose a next action in conversation'}</strong>
        </div>
        <div className="mobile-buddy-summary__row">
          <span>Last run</span>
          <strong>
            {latestWorkspaceConversation?.last_active_at
              ? new Date(latestWorkspaceConversation.last_active_at).toLocaleString()
              : 'No run recorded'}
          </strong>
        </div>
      </div>

      <h2 className="mobile-buddy-section__heading">
        Current tasks ·{' '}
        {workspaceProjects.filter((project) => !['done', 'cancelled'].includes(project.status)).length} open
      </h2>

      <div className="mobile-buddy-work-list">
        {workspaceProjects
          .filter((project) => !['done', 'cancelled'].includes(project.status))
          .map((project) => {
            const progress = buddyProjectTodoProgress(project);
            const hasConversation = employee.conversations.some((conversation) => {
              const conversationId = conversation.conversation_id ?? conversation.unleashd_conversation_id;
              return (
                conversation.buddy_project_id === project.id &&
                Boolean(conversationId && availableSet.has(conversationId))
              );
            });
            return (
              <article key={project.id} className={`mobile-buddy-work-card mobile-buddy-work-card--${project.status}`}>
                <div className="mobile-buddy-work-card__header">
                  <h3>{project.title}</h3>
                  <span className={`mobile-badge mobile-badge--${project.status}`}>{project.status}</span>
                </div>
                <p className="mobile-muted">Next action: {project.next_action ?? 'Not set'}</p>
                {project.blocked_reason && (
                  <p className="mobile-buddy-work-card__blocker">Blocker: {project.blocked_reason}</p>
                )}
                <p className="mobile-muted">
                  Todos: {progress.done}/{progress.total}
                </p>
                <button
                  type="button"
                  disabled={!workspace}
                  className="mobile-cta"
                  onClick={() => workspace && onOpenProjectConversation(workspace, project.id)}
                >
                  {hasConversation ? 'Open conversation' : 'Start conversation'}
                </button>
              </article>
            );
          })}
        {workspaceProjects.filter((project) => !['done', 'cancelled'].includes(project.status)).length === 0 && (
          <EmptyState message="No open tasks for this workspace." />
        )}
      </div>

      {legacyWork.length > 0 && (
        <>
          <h3 className="mobile-buddy-section__heading">Legacy work</h3>
          <div className="mobile-buddy-work-list">
            {legacyWork.map((item) => (
              <article key={item.id} className={`mobile-buddy-work-card mobile-buddy-work-card--${item.status}`}>
                <h4>{item.title}</h4>
                <p className="mobile-muted">Next: {item.next_action ?? '—'}</p>
                <button
                  type="button"
                  disabled={!workspace}
                  className="mobile-cta mobile-cta--secondary"
                  onClick={() => workspace && onTalk(workspace)}
                >
                  Open buddy conversation
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Conversations tab (filtered/sorted via shaping, tap → /chat/:id)
// ---------------------------------------------------------------------------

function ConversationsTab({
  visibleConversations,
  reviewCount,
  showReviewConversations,
  onToggleReviews,
  onOpenConversation,
  workspace,
  onTalk,
  onEditConversationConfig,
  busy,
}: {
  visibleConversations: ConversationLink[];
  reviewCount: number;
  showReviewConversations: boolean;
  onToggleReviews: () => void;
  onOpenConversation: (conversationId: string) => void;
  workspace: Workspace | undefined;
  onTalk: () => void;
  onEditConversationConfig: (
    conversationId: string,
    expectedRevision: number,
    patch: import('@unleashd/shared').ConversationConfigPatch,
  ) => void;
  busy: string | null;
}) {
  // The edit UI demonstrates pass-through verbatim config edits via atoms/config-actions.
  // The buddy profile editor owns the Buddy's durable provider/model/effort; this
  // inline editor shows the same pass-through contract for an existing conversation.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reasoningInput, setReasoningInput] = useState('');

  return (
    <section className="mobile-buddy-section" aria-label="Conversations">
      <div className="mobile-buddy-section__toolbar">
        <button type="button" className="mobile-cta" disabled={!workspace} onClick={onTalk}>
          New buddy conversation
        </button>
        {reviewCount > 0 && (
          <label className="mobile-toggle">
            <input type="checkbox" checked={showReviewConversations} onChange={onToggleReviews} />
            Show reviews ({reviewCount})
          </label>
        )}
      </div>

      {visibleConversations.length === 0 ? (
        <EmptyState message="No conversations for this buddy." />
      ) : (
        <div className="mobile-buddy-convo-list" role="list">
          {visibleConversations.map((conversation) => {
            const conversationId = conversation.conversation_id ?? conversation.unleashd_conversation_id ?? '';
            const available = Boolean(conversationId);
            return (
              <article
                key={`${conversationId}-${conversation.buddy_project_id ?? 'no-project'}`}
                className="mobile-buddy-convo-card"
                role="listitem"
              >
                <div className="mobile-buddy-convo-card__header">
                  <span className={`mobile-badge mobile-badge--${conversation.status}`}>{conversation.status}</span>
                  {conversation.kind && <span className="mobile-badge">{conversation.kind}</span>}
                </div>
                {conversation.last_active_at && (
                  <p className="mobile-muted">{new Date(conversation.last_active_at).toLocaleString()}</p>
                )}
                {conversationId ? (
                  <>
                    <button
                      type="button"
                      className="mobile-cta"
                      disabled={!available || busy?.startsWith('config-')}
                      onClick={() => onOpenConversation(conversationId)}
                    >
                      Open chat →
                    </button>
                    <button
                      type="button"
                      className="mobile-cta mobile-cta--secondary"
                      onClick={() => setEditingId(editingId === conversationId ? null : conversationId)}
                    >
                      {editingId === conversationId ? 'Close config' : 'Edit provider/model/effort'}
                    </button>
                    {editingId === conversationId && (
                      <form
                        className="mobile-inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          const effort = String(data.get('effort') ?? '').trim();
                          if (!effort) return;
                          // Pass-through verbatim: effort string flows unchanged (no translation).
                          // In a real picker this would be a select populated from the catalog;
                          // the free-text path demonstrates the verbatim contract.
                          setReasoningInput(effort);
                          onEditConversationConfig(conversationId, 0, {
                            kind: 'set_reasoning',
                            reasoning: { mode: 'explicit', effort },
                          });
                        }}
                      >
                        <input
                          name="effort"
                          placeholder="Reasoning effort (verbatim)"
                          defaultValue={reasoningInput}
                          aria-label="Reasoning effort"
                        />
                        <button type="submit" className="mobile-cta mobile-cta--small">
                          Apply effort
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <p className="mobile-muted">No linked conversation</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Memory tab
// ---------------------------------------------------------------------------

function MemoryTab({
  memory,
  error,
  buddy,
  onRetry,
}: {
  memory: BuddyMemory;
  error: string | null;
  buddy: Buddy;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <section className="mobile-buddy-section">
        <EmptyState icon="⚠" title="Could not load memory" message={error} actionLabel="Retry" onAction={onRetry} />
      </section>
    );
  }
  return (
    <section className="mobile-buddy-section" aria-label="Memory">
      {buddy.soul_path && <p className="mobile-muted">Soul: {buddy.soul_path}</p>}
      {memory.soul && <pre className="mobile-pre">{memory.soul}</pre>}
      <h3 className="mobile-buddy-section__heading">Summary</h3>
      <p className="mobile-body">{memory.summary || 'No summary recorded.'}</p>
      {memory.recentJournal.length > 0 && (
        <>
          <h3 className="mobile-buddy-section__heading">Recent journal</h3>
          <div className="mobile-journal-list">
            {memory.recentJournal.map((entry) => (
              <article key={entry.path} className="mobile-journal-card">
                <strong className="mobile-muted">{entry.path}</strong>
                <pre className="mobile-pre">{entry.content}</pre>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Automations tab (lightweight, reuses asArray + automationConversations filter)
// ---------------------------------------------------------------------------

function AutomationsTab({
  buddyId,
  automations,
  automationConversations,
  busy,
  setBusy,
  error,
  onOpenConversation,
  onRefresh,
}: {
  buddyId: string;
  workspaceId?: string;
  automations: BuddyAutomation[];
  automationConversations: ConversationLink[];
  busy: string | null;
  setBusy: (value: string | null) => void;
  error: string | null;
  onOpenConversation: (conversationId: string) => void;
  onRefresh: () => void;
}) {
  if (error) {
    return (
      <section className="mobile-buddy-section">
        <EmptyState icon="⚠" title="Could not load automations" message={error} actionLabel="Retry" onAction={onRefresh} />
      </section>
    );
  }
  return (
    <section className="mobile-buddy-section" aria-label="Automations">
      <div className="mobile-buddy-section__toolbar">
        <button type="button" className="mobile-cta mobile-cta--secondary" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {automations.length === 0 ? (
        <EmptyState message="No automations for this buddy." />
      ) : (
        <div className="mobile-automation-list">
          {automations.map((automation) => (
            <article key={automation.id} className="mobile-automation-card">
              <div className="mobile-automation-card__header">
                <h4>{automation.name}</h4>
                <span className={`mobile-badge ${automation.enabled ? 'mobile-badge--done' : 'mobile-badge--blocked'}`}>
                  {automation.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
              <p className="mobile-muted">
                {automation.schedule_kind}: {automation.schedule_expression} · {automation.timezone}
              </p>
              <p className="mobile-muted">Job: {automation.job_kind}</p>
              {automation.next_run_at && (
                <p className="mobile-muted">Next: {new Date(automation.next_run_at).toLocaleString()}</p>
              )}
              <div className="mobile-automation-card__actions">
                <button
                  type="button"
                  className="mobile-cta mobile-cta--small"
                  disabled={busy !== null}
                  onClick={() => {
                    setBusy(`run-${automation.id}`);
                    void buddyApi(`/api/buddies/${encodeURIComponent(buddyId)}/automations/${encodeURIComponent(automation.id)}/run`, {
                      method: 'POST',
                    })
                      .then(() => onRefresh())
                      .catch(() => {})
                      .finally(() => setBusy(null));
                  }}
                >
                  Run now
                </button>
                <button
                  type="button"
                  className="mobile-cta mobile-cta--small mobile-cta--secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    setBusy(`toggle-${automation.id}`);
                    void buddyApi(`/api/buddies/${encodeURIComponent(buddyId)}/automations/${encodeURIComponent(automation.id)}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: !automation.enabled }),
                    })
                      .then(() => onRefresh())
                      .catch(() => {})
                      .finally(() => setBusy(null));
                  }}
                >
                  {automation.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              {automation.runs && automation.runs.length > 0 && (
                <ul className="mobile-automation-runs">
                  {automation.runs.slice(0, 3).map((run) => (
                    <li key={run.id} className="mobile-muted">
                      {run.status} · {new Date(run.scheduled_for).toLocaleString()}
                      {run.conversation_id && (
                        <button
                          type="button"
                          className="mobile-link"
                          onClick={() => onOpenConversation(run.conversation_id!)}
                        >
                          Open →
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      {automationConversations.length > 0 && (
        <>
          <h3 className="mobile-buddy-section__heading">Automation conversations</h3>
          <div className="mobile-buddy-convo-list">
            {automationConversations.map((conversation) => {
              const conversationId = conversation.conversation_id ?? conversation.unleashd_conversation_id;
              if (!conversationId) return null;
              return (
                <article key={conversationId} className="mobile-buddy-convo-card">
                  <span className={`mobile-badge mobile-badge--${conversation.status}`}>{conversation.status}</span>
                  <button type="button" className="mobile-cta" onClick={() => onOpenConversation(conversationId)}>
                    Open →
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Buddy profile editor — provider/model/effort pass-through (verbatim)
// ---------------------------------------------------------------------------

function BuddyProfileEditor({
  buddy,
  busy,
  error,
  onBusy,
  onError,
  onSaved,
}: {
  buddy: Buddy;
  busy: boolean;
  error: string | null;
  onBusy: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
}) {
  const { catalog } = useProviderCatalog();
  const [provider, setProvider] = useState<string>(buddy.provider ?? 'codex');
  const [model, setModel] = useState<string>(buddy.model ?? '');
  const [reasoningEffort, setReasoningEffort] = useState<string>(buddy.reasoning_effort ?? '');

  useEffect(() => {
    setProvider(buddy.provider ?? 'codex');
    setModel(buddy.model ?? '');
    setReasoningEffort(buddy.reasoning_effort ?? '');
  }, [buddy.provider, buddy.model, buddy.reasoning_effort]);

  const providerInfo = catalog?.providers.find((candidate) => candidate.id === provider);
  const selectedModel =
    providerInfo?.models.find((candidate) => candidate.id === model) ??
    providerInfo?.models.find((candidate) => candidate.id === providerInfo?.defaultModelId);
  const effortLevels = selectedModel?.reasoning?.levels ?? [];

  return (
    <details className="mobile-buddy-profile-editor">
      <summary className="mobile-buddy-profile-editor__summary">
        Execution · {provider} · {buddy.model ?? 'default model'} · {buddy.reasoning_effort ?? 'default effort'}
      </summary>
      <form
        className="mobile-buddy-profile-editor__form"
        onSubmit={(event) => {
          event.preventDefault();
          onError(null);
          onBusy(true);
          // Pass-through verbatim: strings reach the harness unchanged (no translation).
          const payload = {
            provider,
            model: model || null,
            reasoningEffort: reasoningEffort || null,
          };
          void buddyApi(`/api/buddies/${encodeURIComponent(buddy.id)}/profile`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then(() => onSaved())
            .catch((cause: unknown) => onError(cause instanceof Error ? cause.message : String(cause)))
            .finally(() => onBusy(false));
        }}
      >
        <label className="mobile-field">
          <span>Provider</span>
          <select value={provider} disabled={busy} onChange={(event) => setProvider(event.target.value)}>
            {(catalog?.providers ?? [{ id: provider, displayName: provider } as never]).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName ?? candidate.id}
              </option>
            ))}
          </select>
        </label>
        <label className="mobile-field">
          <span>Model</span>
          <select value={model} disabled={busy} onChange={(event) => setModel(event.target.value)}>
            <option value="">
              Provider default {providerInfo?.defaultModelId ? `(${providerInfo.defaultModelId})` : ''}
            </option>
            {(providerInfo?.models ?? []).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName ?? candidate.id}
              </option>
            ))}
          </select>
        </label>
        <label className="mobile-field">
          <span>Reasoning effort</span>
          <select
            value={reasoningEffort}
            disabled={busy}
            onChange={(event) => setReasoningEffort(event.target.value)}
          >
            <option value="">
              Model default {selectedModel?.reasoning?.defaultEffort ? `(${selectedModel.reasoning.defaultEffort})` : ''}
            </option>
            {effortLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="mobile-error">{error}</p>}
        <button type="submit" className="mobile-cta" disabled={busy}>
          {busy ? 'Saving…' : 'Save execution'}
        </button>
      </form>
    </details>
  );
}
