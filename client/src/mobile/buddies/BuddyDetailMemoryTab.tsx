import type { Buddy, BuddyMemory } from '../../components/buddies/types';
import { EmptyState } from '../components/EmptyState';

// ---------------------------------------------------------------------------
// Memory tab
// ---------------------------------------------------------------------------

export function MemoryTab({
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
