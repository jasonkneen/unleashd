import type { Conversation, ModelId, Provider } from '@unleashd/shared';
import { PROVIDER_OPTIONS, providerSupportsFork } from '@unleashd/shared';
import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { createMergeConversations } from '../atoms/actions';
import { conversationAtomFamily, defaultCwdAtom } from '../atoms/conversations';
import './MergeModal.css';

// The merge modal opens over (visually on top of) the rest of the UI. It reuses
// the provider + model picker patterns from Sidebar's new-conv modal but adds
// a "merge chats" section listing the selected source conversations. Sources
// whose provider cannot fork (gemini, codex, cursor today) are rendered but
// marked unavailable — the Confirm button is disabled until every selected
// source is fork-capable. The server also enforces this; the client check is
// purely UX so we can show a clear reason per-row.
export function MergeModal({
  sourceIds,
  onCancel,
  onComplete,
}: {
  sourceIds: string[];
  onCancel: () => void;
  onComplete: (parentId: string) => void;
}) {
  const defaultCwd = useAtomValue(defaultCwdAtom);
  const [parentProvider, setParentProvider] = useState<Provider>('claude');
  const [parentModel, setParentModel] = useState<ModelId | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingDirectory, setWorkingDirectory] = useState(defaultCwd);

  const canSubmit = sourceIds.length > 0 && !!workingDirectory && !isSubmitting;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createMergeConversations({
        parentProvider,
        parentModel,
        workingDirectory,
        sourceIds,
      });
      onComplete(result.parentId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="merge-modal-overlay" onClick={onCancel}>
      <div className="merge-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="merge-modal__title">Merge Conversations</h3>
        <p className="merge-modal__hint">
          Each source is forked with a review prompt; their review docs become the first-message
          context of a new parent thread.
        </p>

        <label className="merge-modal__label" htmlFor="merge-modal-cwd">
          Parent Working Directory
        </label>
        <input
          id="merge-modal-cwd"
          type="text"
          className="merge-modal__input"
          value={workingDirectory}
          onChange={(e) => setWorkingDirectory(e.target.value)}
          placeholder="/path/to/project"
        />

        <div className="merge-modal__label">Parent Provider</div>
        <div className="merge-modal__provider-row">
          {PROVIDER_OPTIONS.map((p) => (
            <label key={p.id} className="merge-modal__provider-option">
              <input
                type="radio"
                name="parent-provider"
                checked={parentProvider === p.id}
                onChange={() => {
                  setParentProvider(p.id);
                  setParentModel(undefined);
                }}
              />
              {p.label}
            </label>
          ))}
        </div>

        <div className="merge-modal__label">Merge Chats ({sourceIds.length})</div>
        <ul className="merge-modal__sources">
          {sourceIds.map((id) => (
            <MergeSourceRow key={id} id={id} />
          ))}
        </ul>

        {error && <div className="merge-modal__error">{error}</div>}

        <div className="merge-modal__actions">
          <button
            type="button"
            className="merge-modal__cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="merge-modal__confirm"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Forking…' : `Fork & Merge ${sourceIds.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Single source row: subscribes per-id via conversationAtomFamily so the modal
// doesn't re-render when unrelated conversations update.
function MergeSourceRow({ id }: { id: string }) {
  const conv = useAtomValue(conversationAtomFamily(id));
  const { label, canFork }: { label: string; canFork: boolean } = useMemo(() => {
    if (!conv) return { label: `(conversation ${id.substring(0, 8)} not loaded)`, canFork: false };
    return {
      label: describeConversation(conv),
      canFork: providerSupportsFork(conv.provider) && !conv.isRunning,
    };
  }, [conv, id]);

  const reason = !conv
    ? 'Conversation not loaded on this client yet'
    : conv.isRunning
      ? 'Source is still running — stop it first'
      : !providerSupportsFork(conv.provider)
        ? `Provider "${conv.provider}" does not support fork yet`
        : null;

  return (
    <li
      className={`merge-source ${canFork ? '' : 'merge-source--disabled'}`}
      title={reason ?? undefined}
    >
      <span className="merge-source__provider">{conv?.provider ?? '?'}</span>
      <span className="merge-source__label">{label}</span>
      {!canFork && <span className="merge-source__badge">unavailable</span>}
    </li>
  );
}

function describeConversation(conv: Conversation): string {
  const firstUser = conv.messages.find((m) => m.role === 'user');
  const preview = firstUser?.content.substring(0, 60) ?? '(no messages)';
  return preview;
}
