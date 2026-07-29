import type { BuddyOverview } from './types';
import { buddyCardMetrics, selectDirectoryEmployees } from './ui-contract';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function BuddyDirectory({
  overview,
  onOpen,
  onNew,
  creating,
}: {
  overview: BuddyOverview;
  onOpen: (id: string) => void;
  onNew: () => void;
  creating: boolean;
}) {
  const visibleBuddies = selectDirectoryEmployees(overview);

  return (
    <main className="buddies-directory-content">
      <div className="buddy-card-grid">
        <button
          type="button"
          className="buddy-directory-card buddy-directory-card--new"
          onClick={onNew}
          disabled={creating}
        >
          {creating ? 'Opening…' : 'New'}
        </button>
        {visibleBuddies.map((employeeOverview) => {
          const { buddy, workspaces, team } = employeeOverview;
          const metrics = buddyCardMetrics(employeeOverview);
          return (
            <button
              type="button"
              key={buddy.id}
              className="buddy-directory-card"
              onClick={() => onOpen(buddy.id)}
            >
              <div className="buddy-directory-card-info">
                <div className="buddy-avatar" aria-hidden="true">
                  {initials(buddy.name)}
                </div>
                <div className="buddy-directory-card-copy">
                  <h2>{buddy.name}</h2>
                  <p>{buddy.role}</p>
                  <div className="buddy-project-chips">
                    {workspaces.map((workspace) => (
                      <span key={workspace.id}>{workspace.name}</span>
                    ))}
                  </div>
                  <div className="buddy-card-stats">
                    {team.length > 0 && (
                      <div>
                        <strong>{metrics.team}</strong>
                        <span>team</span>
                      </div>
                    )}
                    <div>
                      <strong>{metrics.open}</strong>
                      <span>open</span>
                    </div>
                    <div>
                      <strong>{metrics.active}</strong>
                      <span>active</span>
                    </div>
                    <div>
                      <strong>{metrics.blocked}</strong>
                      <span>blocked</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="buddy-directory-card-actions">
                <span className={`buddy-presence buddy-presence--${buddy.status}`}>
                  {buddy.status}
                </span>
                <span className="buddy-directory-card-link">Open employee →</span>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
