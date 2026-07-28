import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BuddyContext } from '../atoms/pending-creations';
import './BuddyConvoHeader.css';

interface BuddyHeaderRecord {
  buddy?: { id: string; name?: string; role?: string };
  projects?: Array<{
    id: string;
    title?: string;
    status?: string;
    todos?: Array<{ status?: string }>;
  }>;
  workspaces?: Array<{ id: string; name?: string }>;
}

export function BuddyConvoHeader({ context }: { context: BuddyContext }) {
  const [record, setRecord] = useState<BuddyHeaderRecord | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/buddies/${encodeURIComponent(context.buddyId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as BuddyHeaderRecord;
      })
      .then((payload) => {
        if (!cancelled) setRecord(payload);
      })
      .catch(() => {
        if (!cancelled) setRecord({});
      });
    return () => {
      cancelled = true;
    };
  }, [context.buddyId]);

  const project = useMemo(
    () => record?.projects?.find((candidate) => candidate.id === context.buddyProjectId),
    [context.buddyProjectId, record?.projects]
  );
  const workspace = record?.workspaces?.find((candidate) => candidate.id === context.workspaceId);
  const todos = project?.todos ?? [];
  const doneTodos = todos.filter((todo) => todo.status === 'done').length;

  return (
    <aside className="buddy-convo-header" aria-label="Buddy conversation context">
      <button
        type="button"
        className="buddy-convo-header__summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="buddy-convo-header__mark">BUDDY</span>
        <span className="buddy-convo-header__identity">
          <strong>{record?.buddy?.name ?? 'Buddy'}</strong>
          <span>·</span>
          <span>{workspace?.name ?? 'Workspace'}</span>
        </span>
        {project && (
          <span className="buddy-convo-header__project">
            {project.title}
            {project.status ? ` · ${project.status.replaceAll('_', ' ')}` : ''}
            {todos.length > 0 ? ` · ${doneTodos}/${todos.length} todos` : ''}
          </span>
        )}
        <span className="buddy-convo-header__chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <div className="buddy-convo-header__details">
          <span>{record?.buddy?.role ?? 'Persistent employee conversation'}</span>
          <Link to={`/buddies/${context.buddyId}`}>Open employee →</Link>
        </div>
      )}
    </aside>
  );
}
