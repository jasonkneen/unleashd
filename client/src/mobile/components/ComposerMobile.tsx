import { useState, useRef, useCallback } from 'react';
import { queueMessage, interruptAndSend, stopConversation } from '../../atoms/actions';

export function ComposerMobile({
  conversationId,
  isRunning,
  isStreaming,
  queueLength,
}: {
  conversationId: string;
  isRunning: boolean;
  isStreaming: boolean;
  queueLength: number;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasActiveTurn = isRunning || isStreaming;
  const hasQueue = queueLength > 0;
  const canSend = draft.trim().length > 0 && !sending;

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      if (hasActiveTurn) {
        await interruptAndSend(conversationId, text);
      } else {
        await queueMessage(conversationId, text);
      }
      setDraft('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, hasActiveTurn, sending]);

  const handleStop = useCallback(() => {
    stopConversation(conversationId);
  }, [conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 12px calc(8px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border-subtle, #2a2a2a)',
        background: 'var(--bg-raised-1, #1a1a1a)',
      }}
    >
      {hasQueue && (
        <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>{queueLength} queued</div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={hasActiveTurn ? 'Interrupt with message…' : 'Message…'}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            maxHeight: 120,
            minHeight: 36,
            padding: '8px 12px',
            borderRadius: 18,
            border: '1px solid var(--border-subtle, #333)',
            background: 'var(--bg-page, #0f0f0f)',
            color: 'var(--text-primary, #e8e8e8)',
            fontSize: 14,
            lineHeight: 1.4,
            outline: 'none',
          }}
        />
        {hasActiveTurn ? (
          <button
            type="button"
            onClick={handleStop}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 18,
              border: '1px solid #ef4444',
              background: '#ef4444',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 18,
              border: 'none',
              background: canSend ? 'var(--accent, #7c5cff)' : 'var(--bg-raised-2, #2a2a2a)',
              color: canSend ? '#fff' : 'var(--text-muted, #666)',
              fontSize: 13,
              fontWeight: 600,
              opacity: canSend ? 1 : 0.6,
            }}
          >
            {sending ? '…' : hasQueue ? 'Queue' : 'Send'}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted, #666)' }}>
        Enter to send · Shift+Enter for newline
      </div>
      {error && (
        <div style={{ fontSize: 11, color: '#ef4444', whiteSpace: 'pre-wrap' }}>{error}</div>
      )}
    </div>
  );
}
