import type { Conversation } from '@unleashd/shared';
import { Link } from 'react-router-dom';
import './ResumeThreadWidget.css';

/**
 * UI badge for Chat "Fork" soft-handoff lineage (`resumedFromConversationId`).
 *
 * Shows which conversation this thread was forked from. It does NOT mean the
 * CLI inherited a provider session — that is merge's spawnMergeReviewFork /
 * FORK_CAPABLE_PROVIDERS path. Soft handoff context lives in the draft /
 * first message (historically a pasted transcript).
 */
interface ResumeThreadWidgetProps {
  sourceConversationId: string;
  sourceConversation: Conversation | null;
}

export function ResumeThreadWidget({
  sourceConversationId,
  sourceConversation,
}: ResumeThreadWidgetProps) {
  const displayId = sourceConversation?.id?.substring(0, 8) ?? sourceConversationId.substring(0, 8);
  const provider = sourceConversation?.provider ?? 'claude';
  const folder = sourceConversation?.workingDirectory?.replace(/^\/Users\/[^/]+/, '~');

  return (
    <div className="resume-thread-widget">
      <div className="resume-thread-widget__icon" aria-hidden="true">
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 7 5 11l4 4" />
          <path d="M5 11h9a5 5 0 0 1 5 5v1" />
        </svg>
      </div>
      <div className="resume-thread-widget__body">
        <div className="resume-thread-widget__title">
          <span>Resumed from</span>
          <Link to={`/chat/${sourceConversationId}`}>{displayId}</Link>
        </div>
        <div className="resume-thread-widget__meta">
          <span className={`resume-thread-widget__provider provider-${provider}`}>{provider}</span>
          {folder && <span className="resume-thread-widget__folder">{folder}</span>}
        </div>
      </div>
      <Link
        className="resume-thread-widget__link"
        to={`/chat/${sourceConversationId}`}
        aria-label={`Open source thread ${displayId}`}
        title="Open source thread"
      >
        <span>Open</span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </div>
  );
}
