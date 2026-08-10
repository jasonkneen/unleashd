import { useState } from 'react';
import type { ConversationLink, Workspace } from '../../components/buddies/types';
import { EmptyState } from '../components/EmptyState';

// ---------------------------------------------------------------------------
// Conversations tab (filtered/sorted via shaping, tap → /chat/:id)
// ---------------------------------------------------------------------------

export function ConversationsTab({
  visibleConversations,
  reviewCount,
  showReviewConversations,
  onToggleReviews,
  onOpenConversation,
  workspace,
  onTalk,
  onEditConversationConfig,
  busy,
}: {
  visibleConversations: ConversationLink[];
  reviewCount: number;
  showReviewConversations: boolean;
  onToggleReviews: () => void;
  onOpenConversation: (conversationId: string) => void;
  workspace: Workspace | undefined;
  onTalk: () => void;
  onEditConversationConfig: (
    conversationId: string,
    expectedRevision: number,
    patch: import('@unleashd/shared').ConversationConfigPatch,
  ) => void;
  busy: string | null;
}) {
  // The edit UI demonstrates pass-through verbatim config edits via atoms/config-actions.
  // The buddy profile editor owns the Buddy's durable provider/model/effort; this
  // inline editor shows the same pass-through contract for an existing conversation.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reasoningInput, setReasoningInput] = useState('');

  return (
    <section className="mobile-buddy-section" aria-label="Conversations">
      <div className="mobile-buddy-section__toolbar">
        <button type="button" className="mobile-cta" disabled={!workspace} onClick={onTalk}>
          New buddy conversation
        </button>
        {reviewCount > 0 && (
          <label className="mobile-toggle">
            <input type="checkbox" checked={showReviewConversations} onChange={onToggleReviews} />
            Show reviews ({reviewCount})
          </label>
        )}
      </div>

      {visibleConversations.length === 0 ? (
        <EmptyState message="No conversations for this buddy." />
      ) : (
        <div className="mobile-buddy-convo-list" role="list">
          {visibleConversations.map((conversation) => {
            const conversationId = conversation.conversation_id ?? conversation.unleashd_conversation_id ?? '';
            const available = Boolean(conversationId);
            return (
              <article
                key={`${conversationId}-${conversation.buddy_project_id ?? 'no-project'}`}
                className="mobile-buddy-convo-card"
                role="listitem"
              >
                <div className="mobile-buddy-convo-card__header">
                  <span className={`mobile-badge mobile-badge--${conversation.status}`}>{conversation.status}</span>
                  {conversation.kind && <span className="mobile-badge">{conversation.kind}</span>}
                </div>
                {conversation.last_active_at && (
                  <p className="mobile-muted">{new Date(conversation.last_active_at).toLocaleString()}</p>
                )}
                {conversationId ? (
                  <>
                    <button
                      type="button"
                      className="mobile-cta"
                      disabled={!available || busy?.startsWith('config-')}
                      onClick={() => onOpenConversation(conversationId)}
                    >
                      Open chat →
                    </button>
                    <button
                      type="button"
                      className="mobile-cta mobile-cta--secondary"
                      onClick={() => setEditingId(editingId === conversationId ? null : conversationId)}
                    >
                      {editingId === conversationId ? 'Close config' : 'Edit provider/model/effort'}
                    </button>
                    {editingId === conversationId && (
                      <form
                        className="mobile-inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          const effort = String(data.get('effort') ?? '').trim();
                          if (!effort) return;
                          // Pass-through verbatim: effort string flows unchanged (no translation).
                          // In a real picker this would be a select populated from the catalog;
                          // the free-text path demonstrates the verbatim contract.
                          setReasoningInput(effort);
                          onEditConversationConfig(conversationId, 0, {
                            kind: 'set_reasoning',
                            reasoning: { mode: 'explicit', effort },
                          });
                        }}
                      >
                        <input
                          name="effort"
                          placeholder="Reasoning effort (verbatim)"
                          defaultValue={reasoningInput}
                          aria-label="Reasoning effort"
                        />
                        <button type="submit" className="mobile-cta mobile-cta--small">
                          Apply effort
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <p className="mobile-muted">No linked conversation</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
