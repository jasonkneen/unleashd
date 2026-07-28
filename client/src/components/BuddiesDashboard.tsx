import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createConversation } from '../atoms/actions';
import type { BuddyContext } from '../atoms/pending-creations';
import { BuddyAutomationsTab } from './buddies/BuddyAutomationsTab';
import { buddyApi as api, asArray } from './buddies/api';
import {
  type Buddy,
  type BuddyAutomation,
  type BuddyMemory,
  type BuddyOverview,
  type BuddyProject,
  type ConversationLink,
  EMPTY_MEMORY,
  type EmployeeRecord,
  type EmployeeTab,
  type LegacyWorkItem,
  type Sprint,
  type WorkStatus,
  type Workspace,
} from './buddies/types';
import './BuddiesDashboard.css';

const STATUS_LABELS: Record<WorkStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function compactPath(path: string | null): string {
  if (!path) return 'No source linked';
  return path.replace(/^\/Users\/[^/]+\/git\//, '~/git/');
}

function EmployeeDirectory({
  overview,
  onOpen,
}: {
  overview: BuddyOverview;
  onOpen: (id: string) => void;
}) {
  const visibleBuddies = overview.topLevel.length > 0 ? overview.topLevel : overview.employees;
  return (
    <main className="buddies-directory-content">
      <div className="buddy-card-grid">
        {visibleBuddies.map(({ buddy: employee, workspaces, team, currentWork }) => {
          return (
            <article
              key={employee.id}
              className="buddy-directory-card"
              onClick={() => onOpen(employee.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onOpen(employee.id);
              }}
            >
              <div className="buddy-directory-card-info">
                <div className="buddy-avatar" aria-hidden="true">
                  {initials(employee.name)}
                </div>
                <div className="buddy-directory-card-copy">
                  <h2>{employee.name}</h2>
                  <p>{employee.role}</p>
                  <div className="buddy-project-chips">
                    {workspaces.map((workspace) => (
                      <span key={workspace.id}>{workspace.name}</span>
                    ))}
                  </div>
                  <div className="buddy-card-stats">
                    {team.length > 0 && (
                      <div>
                        <strong>{team.length}</strong>
                        <span>team</span>
                      </div>
                    )}
                    <div>
                      <strong>{currentWork.open}</strong>
                      <span>open</span>
                    </div>
                    <div>
                      <strong>{currentWork.active}</strong>
                      <span>active</span>
                    </div>
                    <div>
                      <strong>{currentWork.blocked}</strong>
                      <span>blocked</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="buddy-directory-card-actions">
                <span className={`buddy-presence buddy-presence--${employee.status}`}>
                  {employee.status}
                </span>
                <button type="button">Open employee →</button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

export function BuddiesDashboard() {
  const navigate = useNavigate();
  const { buddyId } = useParams();
  const [overview, setOverview] = useState<BuddyOverview | null>(null);
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [memory, setMemory] = useState<BuddyMemory>(EMPTY_MEMORY);
  const [automations, setAutomations] = useState<BuddyAutomation[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<EmployeeTab>('work');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const loadDirectory = useCallback(
    async (signal?: AbortSignal, generation = loadGenerationRef.current) => {
      const payload = await api<BuddyOverview>('/api/buddies/overview', { signal });
      if (signal?.aborted || generation !== loadGenerationRef.current) return;
      setOverview(payload);
    },
    []
  );

  const loadEmployee = useCallback(
    async (signal?: AbortSignal, generation = loadGenerationRef.current) => {
      if (!buddyId) return;
      const encoded = encodeURIComponent(buddyId);
      const [detail, contextPayload, projectPayload, memoryPayload, automationPayload] =
        await Promise.all([
          api<Record<string, unknown>>(`/api/buddies/${encoded}`, { signal }),
          api<Record<string, unknown>>(`/api/buddies/${encoded}/context`, { signal }),
          api<unknown>(`/api/buddies/${encoded}/projects?includeClosed=true`, { signal }),
          api<BuddyMemory>(`/api/buddies/${encoded}/memory`, { signal }),
          api<unknown>(`/api/buddies/${encoded}/automations`, { signal }),
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
      const reportsTo = relationships.find(
        (relationship) =>
          (relationship.from_buddy_id === buddy.id && relationship.kind === 'reports_to') ||
          (relationship.to_buddy_id === buddy.id && relationship.kind === 'manager')
      );
      const reportRelationships = relationships.filter(
        (relationship) =>
          (relationship.to_buddy_id === buddy.id && relationship.kind === 'reports_to') ||
          (relationship.from_buddy_id === buddy.id && relationship.kind === 'manager')
      );
      const directReports = Array.from(
        new Map(
          reportRelationships.map((relationship) => {
            const report = {
              id:
                relationship.kind === 'reports_to'
                  ? relationship.from_buddy_id
                  : relationship.to_buddy_id,
              name:
                (relationship.kind === 'reports_to'
                  ? relationship.from_buddy_name
                  : relationship.to_buddy_name) ?? 'Direct report',
            };
            return [report.id, report] as const;
          })
        ).values()
      );
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
          'skills'
        ),
        manager: reportsTo
          ? {
              id: reportsTo.kind === 'reports_to' ? reportsTo.to_buddy_id : reportsTo.from_buddy_id,
              name:
                (reportsTo.kind === 'reports_to'
                  ? reportsTo.to_buddy_name
                  : reportsTo.from_buddy_name) ?? 'Manager',
            }
          : null,
        directReports,
        reviews: asArray<EmployeeRecord['reviews'][number]>(detail, 'reviews'),
      };
      setEmployee(record);
      setMemory({
        ...(memoryPayload ?? EMPTY_MEMORY),
        soul: typeof contextPayload.soul === 'string' ? contextPayload.soul : undefined,
        soulPath: buddy.soul_path,
      });
      setAutomations(asArray<BuddyAutomation>(automationPayload, 'automations'));
      const preferredWorkspace =
        workspaces.find((candidate) =>
          legacyWorkItems.some((item) => item.project_id === candidate.id)
        ) ??
        workspaces.find((candidate) => candidate.slug !== 'buddies') ??
        workspaces[0];
      setSelectedWorkspaceId(preferredWorkspace?.id ?? '');
    },
    [buddyId]
  );

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    const controller = new AbortController();
    setError(null);
    if (buddyId) {
      setEmployee(null);
      setMemory(EMPTY_MEMORY);
      setAutomations([]);
      setSelectedWorkspaceId('');
    }
    const loading = buddyId
      ? loadEmployee(controller.signal, generation)
      : loadDirectory(controller.signal, generation);
    void loading.catch((cause: unknown) => {
      if (!controller.signal.aborted && generation === loadGenerationRef.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
    return () => controller.abort();
  }, [buddyId, loadDirectory, loadEmployee]);

  const workspace =
    employee?.workspaces.find((item) => item.id === selectedWorkspaceId) ?? employee?.workspaces[0];
  const workspaceProjects = useMemo(
    () => (employee?.projects ?? []).filter((project) => project.workspace_id === workspace?.id),
    [employee?.projects, workspace?.id]
  );
  const legacyWork = useMemo(
    () => (employee?.legacyWorkItems ?? []).filter((item) => item.project_id === workspace?.id),
    [employee?.legacyWorkItems, workspace?.id]
  );
  const primaryProject = useMemo(
    () =>
      workspaceProjects.find((project) => project.status === 'in_progress') ??
      workspaceProjects.find((project) => project.status === 'ready') ??
      workspaceProjects.find((project) => !['done', 'cancelled'].includes(project.status)),
    [workspaceProjects]
  );
  const latestWorkspaceConversation = useMemo(
    () =>
      [...(employee?.conversations ?? [])]
        .filter((conversation) => conversation.workspace_id === workspace?.id)
        .sort(
          (left, right) =>
            new Date(right.last_active_at ?? 0).getTime() -
            new Date(left.last_active_at ?? 0).getTime()
        )[0],
    [employee?.conversations, workspace?.id]
  );

  const mutate = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await loadEmployee();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const talk = (targetWorkspace: Workspace, buddyProjectId?: string) => {
    if (!employee) return;
    const context: BuddyContext = {
      buddyId: employee.buddy.id,
      workspaceId: targetWorkspace.id,
      buddyProjectId: buddyProjectId ?? null,
    };
    const id = createConversation({
      workingDirectory: targetWorkspace.root_path,
      config: {
        provider: (employee.buddy.provider || 'codex') as 'codex',
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
  };

  if (error && !overview && !employee) {
    return (
      <div className="buddies-dashboard buddies-dashboard--centered">
        <div className="buddies-error">{error}</div>
      </div>
    );
  }
  if (!buddyId && overview) {
    return (
      <div className="buddies-dashboard">
        <EmployeeDirectory overview={overview} onOpen={(id) => navigate(`/buddies/${id}`)} />
      </div>
    );
  }
  if (!employee) {
    return (
      <div className="buddies-dashboard buddies-dashboard--centered">
        <div className="buddies-loading">Loading employee…</div>
      </div>
    );
  }

  return (
    <div className="buddies-dashboard">
      <header className="buddies-hero">
        <div className="buddy-identity">
          <button
            type="button"
            className="buddy-back-button"
            onClick={() => navigate('/buddies')}
            aria-label="Back to all Buddies"
          >
            ←
          </button>
          <div className="buddy-avatar" aria-hidden="true">
            {initials(employee.buddy.name)}
          </div>
          <div>
            <div className="buddy-eyebrow">Persistent employee</div>
            <h1>{employee.buddy.name}</h1>
            <p>{employee.buddy.role}</p>
          </div>
        </div>
        {workspace && (
          <button className="buddy-start-button" type="button" onClick={() => talk(workspace)}>
            Start conversation
          </button>
        )}
      </header>

      <main className="buddies-content">
        <section className="buddy-org-strip" aria-label="Employee capabilities and reporting line">
          <div>
            <span>Reports to</span>
            <strong>{employee.manager?.name ?? 'Owner'}</strong>
          </div>
          <div>
            <span>Direct reports</span>
            <strong>{employee.directReports.length}</strong>
          </div>
          <div className="buddy-skill-list">
            <span>Skills</span>
            <div>
              {employee.skills.length > 0 ? (
                employee.skills.map((skill) => (
                  <span key={skill.name} title={skill.instruction_path ?? undefined}>
                    {skill.name}
                    {skill.mode ? ` · ${skill.mode}` : ''}
                  </span>
                ))
              ) : (
                <small>No structured skills recorded</small>
              )}
            </div>
          </div>
        </section>

        {employee.directReports.length > 0 && workspace && (
          <details className="buddy-lead-tools">
            <summary>Lead tools · delegate and review reports</summary>
            <form
              className="buddy-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                setBusy('delegate');
                void api<{ conversation?: { id?: string }; conversationId?: string }>(
                  `/api/buddies/${encodeURIComponent(employee.buddy.id)}/delegations`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      toBuddyId: data.get('reportId'),
                      workspaceId: workspace.id,
                      purpose: data.get('purpose'),
                    }),
                  }
                )
                  .then(async (result) => {
                    form.reset();
                    await loadEmployee();
                    const conversationId = result.conversation?.id ?? result.conversationId;
                    if (conversationId) navigate(`/chat/${conversationId}`);
                  })
                  .catch((cause: Error) => setError(cause.message))
                  .finally(() => setBusy(null));
              }}
            >
              <h2>Delegate outcome</h2>
              <select name="reportId" aria-label="Direct report">
                {employee.directReports.map((report) => (
                  <option value={report.id} key={report.id}>
                    {report.name} · {report.role}
                  </option>
                ))}
              </select>
              <input name="purpose" required placeholder="Outcome and expected evidence" />
              <button type="submit" disabled={busy !== null}>
                Delegate
              </button>
            </form>
            <form
              className="buddy-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                setBusy('review');
                void api<{ conversation?: { id?: string }; conversationId?: string }>(
                  `/api/buddies/${encodeURIComponent(employee.buddy.id)}/reviews`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      subjectBuddyId: data.get('subjectBuddyId'),
                      workspaceId: workspace.id,
                      purpose: data.get('purpose'),
                    }),
                  }
                )
                  .then(async (result) => {
                    form.reset();
                    await loadEmployee();
                    const conversationId = result.conversation?.id ?? result.conversationId;
                    if (conversationId) navigate(`/chat/${conversationId}`);
                  })
                  .catch((cause: Error) => setError(cause.message))
                  .finally(() => setBusy(null));
              }}
            >
              <h2>Start employee review</h2>
              <select name="subjectBuddyId" aria-label="Employee to review">
                {employee.directReports.map((report) => (
                  <option value={report.id} key={report.id}>
                    {report.name} · {report.role}
                  </option>
                ))}
              </select>
              <input
                name="purpose"
                required
                placeholder="Evidence to inspect and decision to reach"
              />
              <button type="submit" disabled={busy !== null}>
                Start skeptical review
              </button>
            </form>
            <div className="buddy-review-grid">
              {employee.reviews.map((review) => (
                <article key={review.id}>
                  <span>
                    {review.subject_buddy_name ?? review.subject_buddy_id} ·{' '}
                    {review.reviewer_role ?? employee.buddy.role}
                  </span>
                  <strong>{review.verdict ?? 'Pending verdict'}</strong>
                  <p>{review.summary ?? 'No review summary recorded.'}</p>
                  {review.evidence.length > 0 && (
                    <pre>{JSON.stringify(review.evidence, null, 2)}</pre>
                  )}
                  {review.created_at && (
                    <small>{new Date(review.created_at).toLocaleDateString()}</small>
                  )}
                </article>
              ))}
              {employee.reviews.length === 0 && (
                <p className="buddy-empty">
                  No structured reviews yet. Reviews should cite observed evidence and apply the
                  skepticism appropriate to the reviewer’s role.
                </p>
              )}
            </div>
          </details>
        )}

        <nav className="buddy-section-tabs" aria-label="Employee sections">
          {(['work', 'conversations', 'memory', 'automations'] as EmployeeTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'active' : ''}
              aria-current={activeTab === tab ? 'page' : undefined}
              onClick={() => setActiveTab(tab)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {activeTab === 'work' && (
          <section className="buddy-section">
            <div className="buddy-toolbar">
              <label>
                Workspace
                <select
                  value={workspace?.id ?? ''}
                  onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                >
                  {employee.workspaces.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {workspace && <span>{compactPath(workspace.root_path)}</span>}
            </div>

            <div className="buddy-current-summary">
              <div>
                <span>Current sprint</span>
                <strong>
                  {workspaceProjects.find((project) => project.sprint_name)?.sprint_name ??
                    'No active sprint'}
                </strong>
              </div>
              <div>
                <span>Primary next action</span>
                <strong>
                  {primaryProject?.next_action ?? 'Choose a next action in conversation'}
                </strong>
              </div>
              <div>
                <span>Last run</span>
                <strong>
                  {latestWorkspaceConversation?.last_active_at
                    ? new Date(latestWorkspaceConversation.last_active_at).toLocaleString()
                    : 'No run recorded'}
                </strong>
              </div>
            </div>

            <div className="buddy-section-heading">
              <h2>Current tasks</h2>
              <span>
                {
                  workspaceProjects.filter(
                    (project) => !['done', 'cancelled'].includes(project.status)
                  ).length
                }{' '}
                open
              </span>
            </div>
            <div className="buddy-work-list">
              {workspaceProjects
                .filter((project) => !['done', 'cancelled'].includes(project.status))
                .map((project) => (
                  <article className={`buddy-work-card status-${project.status}`} key={project.id}>
                    <div className="buddy-work-card__heading">
                      <div>
                        <span className="campaign-status">{STATUS_LABELS[project.status]}</span>
                        <h3>{project.title}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => workspace && talk(workspace, project.id)}
                      >
                        Start conversation →
                      </button>
                    </div>
                    {project.objective && <p>{project.objective}</p>}
                    {project.next_action && (
                      <p className="buddy-next-action">
                        <strong>Next:</strong> {project.next_action}
                      </p>
                    )}
                    {project.blocked_reason && (
                      <p className="buddy-blocker">
                        <strong>Blocked:</strong> {project.blocked_reason}
                      </p>
                    )}
                    {Date.now() - new Date(project.updated_at).getTime() >
                      7 * 24 * 60 * 60 * 1000 && (
                      <span className="buddy-stale-warning">No update in 7+ days</span>
                    )}
                    <div className="buddy-project-controls">
                      <span>{project.definition_of_done}</span>
                    </div>
                    <ul className="buddy-todo-list">
                      {project.todos.map((todo) => (
                        <li key={todo.id}>
                          <span className={`buddy-todo-dot status-${todo.status}`} />
                          <span>{todo.title}</span>
                          <small>{todo.status.replaceAll('_', ' ')}</small>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
            </div>

            {legacyWork.length > 0 && (
              <details className="buddy-legacy">
                <summary>Import provenance ({legacyWork.length})</summary>
                {legacyWork.map((item) => (
                  <div key={item.id}>
                    <strong>{item.title}</strong>
                    <span>
                      {STATUS_LABELS[item.status]} · {item.next_action ?? 'No next action'}
                    </span>
                  </div>
                ))}
              </details>
            )}
          </section>
        )}

        {activeTab === 'conversations' && (
          <section className="buddy-section">
            <div className="buddy-section-heading">
              <h2>Conversations</h2>
              {workspace && (
                <button type="button" onClick={() => talk(workspace)}>
                  Start conversation
                </button>
              )}
            </div>
            <div className="buddy-record-list">
              {employee.conversations.map((link) => (
                <article key={link.id ?? link.conversation_id ?? link.unleashd_conversation_id}>
                  <div>
                    <strong>
                      {link.buddy_project_id
                        ? (employee.projects.find((project) => project.id === link.buddy_project_id)
                            ?.title ?? 'Project conversation')
                        : 'General conversation'}
                    </strong>
                    <span>
                      {link.status} ·{' '}
                      {link.last_active_at
                        ? new Date(link.last_active_at).toLocaleString()
                        : 'No activity recorded'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!link.conversation_id && !link.unleashd_conversation_id}
                    onClick={() =>
                      navigate(`/chat/${link.conversation_id ?? link.unleashd_conversation_id}`)
                    }
                  >
                    Open →
                  </button>
                </article>
              ))}
              {employee.conversations.length === 0 && (
                <p className="buddy-empty">No linked conversations yet.</p>
              )}
            </div>
          </section>
        )}

        {activeTab === 'memory' && (
          <section className="buddy-section buddy-memory">
            <div className="buddy-memory-block">
              <span>Soul · {memory.soulPath ?? employee.buddy.soul_path ?? 'Not configured'}</span>
              <pre>
                {memory.soul || 'Soul content is loaded into Buddy conversations by the server.'}
              </pre>
            </div>
            <div className="buddy-memory-block">
              <span>Curated memory</span>
              <pre>{memory.summary || 'No curated memory yet.'}</pre>
            </div>
            <form
              className="buddy-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void mutate('remember', () =>
                  api(`/api/buddies/${encodeURIComponent(employee.buddy.id)}/memory`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: data.get('kind'), content: data.get('content') }),
                  })
                ).then(() => form.reset());
              }}
            >
              <h2>Remember</h2>
              <select name="kind" aria-label="Memory kind">
                <option value="journal">Journal</option>
                <option value="curated">Curated</option>
              </select>
              <textarea name="content" required placeholder="What should this employee retain?" />
              <button type="submit" disabled={busy !== null}>
                Remember
              </button>
            </form>
            <div className="buddy-journal">
              {memory.recentJournal.map((entry) => (
                <details key={entry.path}>
                  <summary>{compactPath(entry.path)}</summary>
                  <pre>{entry.content}</pre>
                </details>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'automations' && (
          <BuddyAutomationsTab
            buddyId={employee.buddy.id}
            workspaceId={workspace?.id}
            automations={automations}
            busy={busy !== null}
            mutate={mutate}
            refresh={loadEmployee}
            onError={setError}
            onOpenConversation={(conversationId) => navigate(`/chat/${conversationId}`)}
          />
        )}
      </main>
      {error && (
        <div className="buddies-toast" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
