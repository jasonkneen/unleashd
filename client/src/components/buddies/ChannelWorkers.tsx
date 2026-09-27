import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { BuddyBackgroundTasks } from './BuddyBackgroundTasks';
import { BuddySigil } from './BuddySigil';
import type { ChannelTask } from './channel-text';
import type { Workspace } from './types';
import './BuddyBackgroundTasks.css';
import './ChannelWorkers.css';

const NO_WORKSPACES: Workspace[] = [];

/** Worker activity stays inside the workspace's Buddy/DM surface on both devices. */
export function ChannelWorkers({
  buddyId,
  buddyName,
  workspaceId,
  tasks,
}: {
  buddyId: string;
  buddyName: string;
  workspaceId: string;
  tasks: readonly ChannelTask[];
}) {
  const location = useLocation();
  const [params] = useSearchParams();
  const backParams = new URLSearchParams(params);
  backParams.delete('workers');
  const backTo = `${location.pathname}${backParams.size ? `?${backParams}` : ''}`;
  return (
    <section className="channel-workers" aria-label={`${buddyName} background workers`}>
      <header className="channel-workers-header">
        <Link className="channel-workers-back" to={backTo} aria-label="Back to Buddies">
          ‹
        </Link>
        <BuddySigil className="channel-workers-sigil" name={buddyName} />
        <h1>{buddyName}</h1>
      </header>
      <div className="channel-workers-scroll">
        <BuddyBackgroundTasks
          buddyId={buddyId}
          workspaces={NO_WORKSPACES}
          projects={tasks}
          fixedWorkspaceId={workspaceId}
        />
      </div>
    </section>
  );
}
