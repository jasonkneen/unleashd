import type { MergeChildStatus } from '@unleashd/shared';
import { useAtomValue } from 'jotai';
import { useCallback, useState } from 'react';
import { conversationAtomFamily } from '../atoms/conversations';
import {
  mergeChildErrorAtomFamily,
  mergeChildReviewDocPathAtomFamily,
  mergeChildStatusAtomFamily,
} from '../atoms/mergeAtoms';
import './MergeProgressStrip.css';

// Rendered at the top of a merge-parent Chat thread. One chip per forked
// child. Chip state is the merge_child_status WS message; default is
// 'spinning' until the server reports complete or error.
export function MergeProgressStrip({ parentId }: { parentId: string }) {
  const parent = useAtomValue(conversationAtomFamily(parentId));
  if (!parent || !parent.mergeParentMeta) return null;

  return (
    <output className="merge-progress-strip" aria-label="Review progress">
      <span className="merge-progress-strip__label">Reviews</span>
      {parent.mergeParentMeta.children.map((child) => (
        <MergeChildChip
          key={child.childConversationId}
          childId={child.childConversationId}
          reviewUuid={child.reviewUuid}
          sourceCwd={child.childWorkingDirectory}
        />
      ))}
    </output>
  );
}

function MergeChildChip({
  childId,
  reviewUuid,
  sourceCwd,
}: {
  childId: string;
  reviewUuid: string;
  sourceCwd: string;
}) {
  const status: MergeChildStatus = useAtomValue(mergeChildStatusAtomFamily(childId));
  const docPath = useAtomValue(mergeChildReviewDocPathAtomFamily(childId));
  const errorMessage = useAtomValue(mergeChildErrorAtomFamily(childId));
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);
  const [hoverError, setHoverError] = useState<string | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);

  const loadPreview = useCallback(async () => {
    setHoverOpen(true);
    if (status === 'error') return; // error tooltip uses errorMessage atom directly
    if (status !== 'complete' || !docPath) return;
    if (hoverPreview !== null || hoverError !== null) return;
    try {
      const abs = `${sourceCwd}/${docPath}`;
      const res = await fetch(`/api/read-file?path=${encodeURIComponent(abs)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? 'read failed');
      }
      const body = await res.json();
      setHoverPreview(body.content ?? '');
    } catch (e) {
      setHoverError((e as Error).message);
    }
  }, [status, docPath, sourceCwd, hoverPreview, hoverError]);

  const chipClass = `merge-chip merge-chip--${status}`;
  const label = status === 'complete' ? '✓' : status === 'error' ? '!' : '…';
  const title =
    status === 'complete'
      ? (docPath ?? `REVIEW_DOC_${reviewUuid}.txt`)
      : status === 'error'
        ? `Review did not produce ${reviewUuid}`
        : 'Reviewing…';

  return (
    <div
      className={chipClass}
      onMouseEnter={loadPreview}
      onMouseLeave={() => setHoverOpen(false)}
      title={title}
    >
      <span className="merge-chip__icon">{label}</span>
      <span className="merge-chip__uuid">{reviewUuid.substring(0, 6)}</span>
      {hoverOpen && status === 'error' && (
        <div className="merge-chip__tooltip">
          <div className="merge-chip__tooltip-path merge-chip__tooltip-path--error">
            Fork failed
          </div>
          <pre className="merge-chip__tooltip-body">
            {errorMessage ?? 'Unknown error — check server logs'}
          </pre>
        </div>
      )}
      {hoverOpen && status === 'complete' && (
        <div className="merge-chip__tooltip">
          <div className="merge-chip__tooltip-path">{docPath}</div>
          <pre className="merge-chip__tooltip-body">
            {hoverError
              ? `Error: ${hoverError}`
              : hoverPreview === null
                ? 'Loading…'
                : hoverPreview.length > 4000
                  ? `${hoverPreview.substring(0, 4000)}\n…(truncated)`
                  : hoverPreview}
          </pre>
        </div>
      )}
    </div>
  );
}
