import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createConversation } from '../atoms/actions';
import './BuddiesDashboard.css';

type WorkStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'done'
  | 'cancelled';

interface Project {
  id: string;
  slug: string;
  name: string;
  root_path: string;
  assignment_role?: string | null;
}

interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  status: string;
}

interface WorkItem {
  id: string;
  project_id: string;
  buddy_id: string | null;
  title: string;
  kind: string;
  source_path: string | null;
  objective: string | null;
  definition_of_done: string;
  status: WorkStatus;
  priority: number;
  next_action: string | null;
  blocked_reason: string | null;
}

interface Buddy {
  id: string;
  name: string;
  role: string;
  status: string;
  soul_path: string | null;
  memory_path: string | null;
  provider: string | null;
  reasoning_effort: string | null;
  projects: Project[];
  conversations: Array<{ status: string; project_id?: string }>;
}

interface Dashboard {
  projects: Project[];
  buddies: Buddy[];
  sprints: Sprint[];
  workItems: WorkItem[];
}

const STATUS_LABELS: Record<WorkStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const OPEN_STATUSES = new Set<WorkStatus>([
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'review',
]);

function compactPath(path: string | null): string {
  if (!path) return 'No source linked';
  return path.replace(/^\/Users\/[^/]+\/git\//, '~/git/');
}

function buildBuddyPrompt(buddy: Buddy, project: Project, workItem?: WorkItem): string {
  const work = workItem
    ? `
Current work item
- Buddies ID: ${workItem.id}
- Campaign: ${workItem.title}
- Status: ${STATUS_LABELS[workItem.status]}
- Objective: ${workItem.objective ?? 'Inspect the source evidence and clarify the objective.'}
- Definition of done: ${workItem.definition_of_done}
- Blocker: ${workItem.blocked_reason ?? 'None recorded'}
- Next action: ${workItem.next_action ?? 'Determine the next evidence-backed action'}
- Source: ${workItem.source_path ?? 'No source linked'}
`
    : `
Current assignment
- Review the active sprint and all open campaign work for ${project.name}.
- Select the highest-priority work item that can make real progress without bypassing an approval gate.
`;

  return `Operate as the persistent Buddy "${buddy.name}" for ${project.name}.

Read your standing instructions first:
- Soul: ${buddy.soul_path}
- Project root: ${project.root_path}
- Project assignment: ${project.assignment_role ?? buddy.role}
${work}
Before acting, inspect the repository's authoritative growth documents and verify that the recorded state is still current. Do not create a new campaign merely to stay busy. Prefer closing, unblocking, adjudicating, or explicitly killing existing work.

Respect all existing approval boundaries for external sends, spend, publishing, and deployment. At the end of the session:
1. update the appropriate repository evidence or handoff file;
2. state what changed and what remains unproven;
3. update this Buddies work item with:
   buddies task status <work-id> <status> --next "<next action>"

Start now and carry the work through the next safe, meaningful gate.`;
}

export function BuddiesDashboard() {
  const navigate = useNavigate();
  const { buddyId } = useParams();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/buddies')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load Buddies');
        return payload as Dashboard;
      })
      .then((payload) => {
        if (cancelled) return;
        setDashboard(payload);
        setSelectedProjectId((current) => current ?? payload.projects[0]?.id ?? null);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buddy = dashboard?.buddies.find((candidate) => candidate.id === buddyId) ?? null;
  const assignedProjects = buddy?.projects ?? [];
  const selectedProject =
    assignedProjects.find((project) => project.id === selectedProjectId) ??
    assignedProjects[0] ??
    null;
  const sprint = dashboard?.sprints.find(
    (candidate) => candidate.project_id === selectedProject?.id && candidate.status === 'active'
  );
  const workItems = useMemo(
    () =>
      (dashboard?.workItems ?? [])
        .filter(
          (item) => item.project_id === selectedProject?.id && OPEN_STATUSES.has(item.status)
        )
        .sort((a, b) => b.priority - a.priority),
    [dashboard?.workItems, selectedProject?.id]
  );
  const counts = useMemo(() => {
    const result = { active: 0, blocked: 0, review: 0, ready: 0 };
    for (const item of dashboard?.workItems ?? []) {
      if (!OPEN_STATUSES.has(item.status)) continue;
      if (item.status === 'in_progress') result.active += 1;
      if (item.status === 'blocked') result.blocked += 1;
      if (item.status === 'review') result.review += 1;
      if (item.status === 'ready' || item.status === 'backlog') result.ready += 1;
    }
    return result;
  }, [dashboard?.workItems]);

  const startBuddy = async (project: Project, workItem?: WorkItem) => {
    if (!buddy) return;
    const key = workItem?.id ?? project.id;
    setStarting(key);
    setError(null);
    try {
      const conversationId = createConversation({
        workingDirectory: project.root_path,
        config: {
          provider: 'codex',
          model: { mode: 'default' },
          reasoning: buddy.reasoning_effort
            ? { mode: 'explicit', effort: buddy.reasoning_effort }
            : { mode: 'default' },
        },
        swarmDebugPrefix: `[buddy:${buddy.name}] Persistent employee session. `,
        initialMessage: buildBuddyPrompt(buddy, project, workItem),
      });
      const response = await fetch('/api/buddies/conversation-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buddyId: buddy.id,
          projectId: project.id,
          workItemId: workItem?.id,
          conversationId,
          provider: 'codex',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to link Buddy conversation');
      navigate(`/chat/${conversationId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(null);
    }
  };

  if (error && !dashboard) {
    return (
      <div className="buddies-dashboard buddies-dashboard--centered">
        <div className="buddies-error">{error}</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="buddies-dashboard buddies-dashboard--centered">
        <div className="buddies-loading">Loading Buddies…</div>
      </div>
    );
  }

  if (!buddyId) {
    return (
      <div className="buddies-dashboard">
        <main className="buddies-directory-content">
          <div className="buddy-card-grid">
            {dashboard.buddies.map((employee) => {
              const employeeWork = dashboard.workItems.filter(
                (item) => item.buddy_id === employee.id && OPEN_STATUSES.has(item.status)
              );
              const active = employeeWork.filter((item) => item.status === 'in_progress').length;
              const blocked = employeeWork.filter((item) => item.status === 'blocked').length;
              const review = employeeWork.filter((item) => item.status === 'review').length;
              const initials = employee.name
                .split(/\s+/)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <article
                  key={employee.id}
                  className="buddy-directory-card"
                  onClick={() => navigate(`/buddies/${employee.id}`)}
                >
                  <div className="buddy-directory-card-info">
                    <div className="buddy-avatar" aria-hidden="true">
                      {initials}
                    </div>
                    <div className="buddy-directory-card-copy">
                      <h2>{employee.name}</h2>
                      <p>{employee.role}</p>
                      <div className="buddy-project-chips">
                        {employee.projects.map((project) => (
                          <span key={project.id}>{project.name}</span>
                        ))}
                      </div>
                      <div className="buddy-card-stats">
                        <div>
                          <strong>{employeeWork.length}</strong>
                          <span>open</span>
                        </div>
                        <div>
                          <strong>{active}</strong>
                          <span>active</span>
                        </div>
                        <div>
                          <strong>{blocked}</strong>
                          <span>blocked</span>
                        </div>
                        <div>
                          <strong>{review}</strong>
                          <span>review</span>
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
      </div>
    );
  }

  if (!buddy) {
    return (
      <div className="buddies-dashboard buddies-dashboard--centered">
        <div className="buddies-error">Buddy not found.</div>
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
            GL
          </div>
          <div>
            <div className="buddy-eyebrow">Persistent employee</div>
            <h1>{buddy.name}</h1>
            <p>{buddy.role}</p>
          </div>
        </div>
        <div className="buddy-summary">
          <div>
            <strong>{counts.active}</strong>
            <span>active</span>
          </div>
          <div>
            <strong>{counts.blocked}</strong>
            <span>blocked</span>
          </div>
          <div>
            <strong>{counts.review}</strong>
            <span>in review</span>
          </div>
          <div>
            <strong>{counts.ready}</strong>
            <span>ready</span>
          </div>
        </div>
      </header>

      <main className="buddies-content">
        <div className="buddy-project-tabs" role="tablist" aria-label="Growth Lead projects">
          {assignedProjects.map((project) => {
            const projectItems = dashboard.workItems.filter(
              (item) => item.project_id === project.id && OPEN_STATUSES.has(item.status)
            );
            return (
              <button
                key={project.id}
                type="button"
                role="tab"
                aria-selected={project.id === selectedProject?.id}
                className={project.id === selectedProject?.id ? 'active' : ''}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <span>{project.name}</span>
                <small>{projectItems.length} open</small>
              </button>
            );
          })}
        </div>

        {selectedProject && (
          <>
            <section className="buddy-sprint">
              <div>
                <div className="buddy-eyebrow">Current sprint</div>
                <h2>{sprint?.name ?? 'No active sprint'}</h2>
                <p>{sprint?.goal ?? 'Start a sprint before assigning new campaign work.'}</p>
                <code>{compactPath(selectedProject.root_path)}</code>
              </div>
              <button
                type="button"
                className="buddy-start-button"
                disabled={starting !== null}
                onClick={() => void startBuddy(selectedProject)}
              >
                {starting === selectedProject.id ? 'Starting…' : `Start ${buddy.name}`}
              </button>
            </section>

            <section className="campaign-board">
              <div className="campaign-board-heading">
                <div>
                  <div className="buddy-eyebrow">Campaign portfolio</div>
                  <h2>Current work</h2>
                </div>
                <span>{workItems.length} open loops</span>
              </div>

              <div className="campaign-grid">
                {workItems.map((item) => (
                  <article key={item.id} className={`campaign-card status-${item.status}`}>
                    <div className="campaign-card-topline">
                      <span className={`campaign-status status-${item.status}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                      <span className="campaign-priority">P{item.priority}</span>
                    </div>
                    <h3>{item.title}</h3>
                    {item.objective && <p className="campaign-objective">{item.objective}</p>}
                    {item.blocked_reason && (
                      <div className="campaign-blocker">
                        <span>Blocked by</span>
                        {item.blocked_reason}
                      </div>
                    )}
                    <div className="campaign-next">
                      <span>Next gate</span>
                      {item.next_action ?? 'No next action recorded'}
                    </div>
                    <details>
                      <summary>Definition of done</summary>
                      <p>{item.definition_of_done}</p>
                    </details>
                    <div className="campaign-card-footer">
                      <span title={item.source_path ?? undefined}>
                        {compactPath(item.source_path)}
                      </span>
                      <button
                        type="button"
                        disabled={starting !== null}
                        onClick={() => void startBuddy(selectedProject, item)}
                      >
                        {starting === item.id ? 'Starting…' : 'Work on this →'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {error && <div className="buddies-toast">{error}</div>}
    </div>
  );
}
