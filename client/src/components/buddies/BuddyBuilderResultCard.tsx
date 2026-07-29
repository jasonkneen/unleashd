import { type BuddyBuilderResult, BuddyBuilderResultSchema } from '@unleashd/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createConversation } from '../../atoms/actions';
import './BuddyBuilderResultCard.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function BuddyCreatedCard({ result }: { result: BuddyBuilderResult }) {
  const navigate = useNavigate();
  const { buddy } = result;
  const runtime = [buddy.model ?? buddy.provider, buddy.reasoning_effort]
    .filter(Boolean)
    .join(' · ');
  const route = `/buddies/${buddy.id}`;
  const startConversation = () => {
    const id = createConversation({
      workingDirectory: result.homeWorkspace.root_path,
      config: {
        provider: buddy.provider ?? 'codex',
        model: buddy.model ? { mode: 'explicit', modelId: buddy.model } : { mode: 'default' },
        reasoning: buddy.reasoning_effort
          ? { mode: 'explicit', effort: buddy.reasoning_effort }
          : { mode: 'default' },
      },
      buddyContext: {
        buddyId: buddy.id,
        workspaceId: result.homeWorkspace.id,
        buddyProjectId: null,
      },
    });
    navigate(`/chat/${id}`);
  };

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
        <Link to={route}>Open Buddy</Link>
        <button type="button" onClick={startConversation}>
          Start conversation
        </button>
      </div>
    </article>
  );
}

export function BuddyBuilderResultCard({
  conversationId,
  isRunning,
}: {
  conversationId: string;
  isRunning: boolean;
}) {
  const [result, setResult] = useState<BuddyBuilderResult | null>(null);

  useEffect(() => {
    if (isRunning) return;
    const controller = new AbortController();
    void fetch(`/api/buddies/builder/${encodeURIComponent(conversationId)}/result`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Builder result failed (${response.status})`);
        return BuddyBuilderResultSchema.parse(await response.json());
      })
      .then((value) => {
        if (value) setResult(value);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('[buddies] Could not load Builder result:', error);
      });
    return () => controller.abort();
  }, [conversationId, isRunning]);

  return result ? <BuddyCreatedCard result={result} /> : null;
}
