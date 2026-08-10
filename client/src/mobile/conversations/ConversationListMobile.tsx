import { useAtomValue } from 'jotai';
import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  allConversationIdsAtom,
  chatConversationIdsAtom,
  chatConversationInboxAtom,
  conversationAtomFamily,
} from '../../atoms/conversations';
import { useUIStore } from '../../stores/uiStore';
import { formatTimeAgo, getConversationLastActivity } from '../../utils/time';

function useTimeTick(ms = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

const ConversationListItem = memo(function ConversationListItem({
  id,
}: {
  id: string;
}) {
  const conv = useAtomValue(conversationAtomFamily(id));
  const hasUnseenMessages = useUIStore((s) => s.hasUnseenMessages);
  const isDone = useUIStore((s) => s.isDone);
  const navigate = useNavigate();
  const done = isDone(id);

  if (!conv) return null;

  const lastTime = getConversationLastActivity(conv);
  const timeAgo = formatTimeAgo(lastTime);
  const totalMessages = conv.messageCount ?? conv.messages.length;
  const unseen = hasUnseenMessages(id, totalMessages);
  const preview =
    conv.messages.length > 0
      ? conv.messages[conv.messages.length - 1].content.substring(0, 120)
      : 'New conversation';
  const dirDisplay = conv.workingDirectory.replace(/^\/Users\/[^/]+/, '~');
  const folderName = conv.workingDirectory.split('/').filter(Boolean).pop() ?? dirDisplay;
  return (
    <button
      type="button"
      onClick={() => navigate(`/chat/${conv.id}`)}
      className="mobile-conversation-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: '100%',
        textAlign: 'left',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle, #2a2a2a)',
        background: 'transparent',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary, #e8e8e8)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={dirDisplay}
        >
          {folderName}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {done && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 6px',
                borderRadius: 999,
                background: 'var(--bg-raised-2, #222)',
                color: 'var(--text-muted, #888)',
                border: '1px solid var(--border-subtle, #333)',
              }}
            >
              DONE
            </span>
          )}
          {unseen && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 6px',
                borderRadius: 999,
                background: 'var(--accent, #7c5cff)',
                color: '#fff',
              }}
            >
              NEW
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted, #888)',
              whiteSpace: 'nowrap',
            }}
          >
            {timeAgo}
          </span>
          {conv.isRunning ? (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#22c55e',
                display: 'inline-block',
                flexShrink: 0,
              }}
              aria-label="running"
            />
          ) : conv.queue?.length ? (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#eab308',
                display: 'inline-block',
                flexShrink: 0,
              }}
              aria-label="queued"
            />
          ) : null}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-muted, #999)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={preview}
      >
        {preview}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted, #777)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {dirDisplay}
      </div>
    </button>
  );
});

export function ConversationListMobile({
  scope = 'all',
}: {
  scope?: 'all' | 'chats';
}) {
  const ids = useAtomValue(scope === 'chats' ? chatConversationIdsAtom : allConversationIdsAtom);
  const chatInbox = useAtomValue(chatConversationInboxAtom);
  useTimeTick();

  return (
    <div className={scope === 'chats' ? 'mobile-chats' : undefined}>
      {scope === 'chats' && (
        <header className="mobile-chats__header">
          <h1 className="mobile-chats__title">Chats</h1>
          <p className="mobile-chats__count">
            {chatInbox.total > ids.length
              ? `${ids.length} most recent \u00b7 ${chatInbox.total} total`
              : `${chatInbox.total} ${chatInbox.total === 1 ? 'conversation' : 'conversations'}`}
          </p>
        </header>
      )}
      {ids.length === 0 ? (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-muted, #888)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No conversations yet</div>
          <div style={{ fontSize: 13 }}>Create one from the desktop or via API.</div>
        </div>
      ) : (
        <div
          className="mobile-conversation-list"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {ids.map((id) => (
            <ConversationListItem key={id} id={id} />
          ))}
        </div>
      )}
    </div>
  );
}
