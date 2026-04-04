import { Link } from 'react-router-dom';
import type { Conversation } from '@unleashd/shared';
import './ResumeThreadWidget.css';

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
      <div className="resume-thread-widget__badge">Resumed thread</div>
      <div className="resume-thread-widget__body">
        <div className="resume-thread-widget__title">
          Forked from <Link to={`/chat/${sourceConversationId}`}>{displayId}</Link>
        </div>
        <div className="resume-thread-widget__meta">
          <span className={`resume-thread-widget__provider provider-${provider}`}>{provider}</span>
          {folder && <span className="resume-thread-widget__folder">{folder}</span>}
        </div>
      </div>
      <Link className="resume-thread-widget__link" to={`/chat/${sourceConversationId}`}>
        Open
      </Link>
    </div>
  );
}
