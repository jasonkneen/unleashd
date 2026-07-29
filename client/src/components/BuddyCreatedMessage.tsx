import { Link } from 'react-router-dom';
import type { BuddyCreated } from './buddy-created-message';
import './BuddyCreatedMessage.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function BuddyCreatedCard({ result }: { result: BuddyCreated }) {
  const { buddy } = result;
  const runtime = [buddy.model ?? buddy.provider, buddy.reasoning_effort]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="buddy-created-card">
      <header>
        <div className="buddy-created-card__avatar" aria-hidden="true">
          {initials(buddy.name)}
        </div>
        <div>
          <span>Buddy created</span>
          <h3>{buddy.name}</h3>
          <p>{buddy.role}</p>
        </div>
        <span className="buddy-created-card__status">{buddy.status}</span>
      </header>
      {runtime && <p className="buddy-created-card__runtime">{runtime}</p>}
      <div className="buddy-created-card__actions">
        <Link to={result.route}>Open Buddy</Link>
        <Link to={`${result.route}?startConversation=1`}>Start conversation</Link>
      </div>
    </article>
  );
}
