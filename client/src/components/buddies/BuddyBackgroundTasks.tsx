import { getBuddyContext } from '@unleashd/shared';
import { useAtomValue } from 'jotai';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  type BuddyBackgroundWorker,
  type BuddyWorkerStatus,
  buddyBackgroundWorkersAtomFamily,
} from '../../atoms/buddy-background';
import {
  availableConversationIdSetAtom,
  conversationLoadCompleteAtom,
  streamingAtomFamily,
} from '../../atoms/conversations';
import { useBuddyWorkerDiagnostics } from '../../hooks/useBuddyData';
import { useTimeTick } from '../../hooks/useTimeTick';
import { mobileConversationRouteState } from '../../utils/conversation-route-state';
import { formatTimeAgo, getConversationLastActivity } from '../../utils/time';
import {
  buildTurnDiagnosticsViewModel,
  shouldPresentTurnAttempt,
  turnDiagnosticsFromAttempt,
} from '../../utils/turn-diagnostics';
import { conversationPath } from './buddy-tabs';
import type { BuddyProject, Workspace } from './types';

const NO_PROJECTS: readonly BuddyProject[] = [];

export function BuddyBackgroundTasks({
  buddyId,
  workspaces,
  projects = NO_PROJECTS,
}: {
  buddyId: string;
  workspaces: Workspace[];
  projects?: readonly BuddyProject[];
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const routeState = mobileConversationRouteState(location);
  // An empty `?workspace=` (sidebar link for a buddy with no workspace) is
  // "All workspaces", not a workspace literally named "". Without this,
  // the filter matches nothing and the tab reads empty while the badge
  // counts show work — background threads look hidden everywhere, since the
  // Conversations tab hides background placement by design.
  const workspaceParam = searchParams.get('workspace');
  const workspaceId = workspaceParam ? workspaceParam : null;
  const workers = useAtomValue(buddyBackgroundWorkersAtomFamily({ buddyId, workspaceId }));
  const unfiltered = useAtomValue(buddyBackgroundWorkersAtomFamily({ buddyId, workspaceId: null }));
  const loaded = useAtomValue(conversationLoadCompleteAtom);
  const runningCount = workers.filter((worker) => worker.status === 'running').length;
  const queuedCount = workers.filter((worker) => worker.status === 'queued').length;

  return (
    <section className="buddy-background-tasks" aria-label="Background workers">
      <div className="buddy-background-tasks-heading">
        <div>
          <h2>Background workers</h2>
          <p>
            {loaded
              ? `${runningCount} running · ${queuedCount} queued · ${workers.length} total`
              : 'Loading workers…'}
          </p>
        </div>
        <label>
          Workspace
          <select
            value={workspaceId ?? ''}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set('workspace', event.target.value);
              else next.delete('workspace');
              setSearchParams(next);
            }}
          >
            <option value="">All workspaces</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="buddy-background-tasks-explainer">
        Background conversations and session workers. Open a conversation to inspect its work. No
        recent output alone does not mean a worker has stalled.
      </p>
      {workers.length === 0 ? (
        <div className="buddy-background-tasks-empty">
          <p>{loaded ? 'No background workers yet.' : 'Loading background workers…'}</p>
          {loaded && workspaceId && unfiltered.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('workspace');
                setSearchParams(next);
              }}
            >
              Show all workspaces ({unfiltered.length})
            </button>
          )}
        </div>
      ) : (
        <ul className="buddy-background-tasks-list">
          {workers.map((worker) => (
            <WorkerRow
              key={worker.id}
              worker={worker}
              routeState={routeState}
              taskTitle={
                projects.find(
                  (project) => project.id === getBuddyContext(worker.conversation)?.buddyProjectId
                )?.title
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_LABEL: Record<BuddyWorkerStatus, string> = {
  running: 'Running',
  queued: 'Queued',
  idle: 'Not running',
  completed: 'Completed',
  error: 'Failed',
  interrupted: 'Interrupted',
  unknown: 'Status unconfirmed',
};

function WorkerRow({
  worker,
  routeState,
  taskTitle,
}: { worker: BuddyBackgroundWorker; routeState: Record<string, unknown>; taskTitle?: string }) {
  const { conversation, parent, agent, status } = worker;
  const available = useAtomValue(availableConversationIdSetAtom);
  const streaming = useAtomValue(streamingAtomFamily(conversation.id));
  const diagnostics = useBuddyWorkerDiagnostics(conversation.id, conversation.isRunning);
  useTimeTick();
  const attempt = diagnostics.data?.latestAttempt;
  const activity =
    conversation.isRunning && attempt && shouldPresentTurnAttempt(attempt, true)
      ? buildTurnDiagnosticsViewModel(turnDiagnosticsFromAttempt(attempt))
      : null;
  const lastMessage = conversation.messages.at(-1);
  const title = agent?.description || taskTitle || conversation.title || 'Background conversation';
  const preview = agent
    ? status === 'unknown' && agent.statusSource === 'inferred_parent_completion'
      ? undefined
      : agent.currentAction
    : (streaming || lastMessage?.content)?.replace(/<!--[\s\S]*?(?:-->|$)/g, '').trim();
  const date = agent
    ? new Date(agent.completedAt ?? agent.startedAt)
    : getConversationLastActivity(conversation);
  const timeLabel = agent
    ? agent.completedAt
      ? 'Last status'
      : 'Started'
    : lastMessage
      ? 'Last message'
      : 'Created';
  return (
    <li className="buddy-background-tasks-conversation">
      <div className="buddy-background-tasks-row">
        <strong className="buddy-background-tasks-title">{title}</strong>
        <span className="buddy-background-tasks-status" data-status={status}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      {preview && <p className="buddy-background-tasks-preview">{preview}</p>}
      {activity && (
        <p className="buddy-background-tasks-activity">
          {parent?.id === conversation.id ? 'Parent turn' : 'Turn'} · {activity.title}
        </p>
      )}
      {conversation.isRunning &&
        (diagnostics.kind === 'failed' || diagnostics.kind === 'stale') && (
          <p className="buddy-background-tasks-caution">
            Activity report unavailable.{' '}
            <button type="button" onClick={() => void diagnostics.refetch()}>
              Retry
            </button>
          </p>
        )}
      {status === 'unknown' && (
        <p className="buddy-background-tasks-caution">
          {agent?.statusSource === 'inferred_parent_completion'
            ? 'The parent turn ended; this worker’s result was not confirmed.'
            : 'The parent is not running; this worker’s last reported state may be stale.'}
        </p>
      )}
      <div className="buddy-background-tasks-row buddy-background-tasks-meta">
        <span>
          {conversation.provider} · {agent ? 'Session worker' : 'Background conversation'}
          {agent && ` · ${agent.toolUses} tool uses`}
          {' · '}
          <time dateTime={date.toISOString()} title={date.toLocaleString()}>
            {timeLabel} {formatTimeAgo(date)}
          </time>
        </span>
        {available.has(conversation.id) && (
          <Link to={conversationPath(conversation.id)} state={routeState}>
            {parent?.id === conversation.id ? 'Open parent conversation' : 'Open conversation'} →
          </Link>
        )}
      </div>
    </li>
  );
}
