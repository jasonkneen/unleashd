import type { ModelId, Provider } from '@unleashd/shared';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';
import { createMergeConversations } from '../atoms/actions';
import { defaultCwdAtom } from '../atoms/conversations';
import { mergeModeAtom, mergeSelectionAtom } from '../atoms/mergeAtoms';
import { ProviderModelPicker } from './ProviderModelPicker';
import './MergeModal.css';

// Slim merge modal: positioned over the main-content area (not covering
// the sidebar) so sidebar selection stays interactive. Shows selected count
// + provider/model picker + confirm. No conversation list — selection is
// done via the sidebar checkmarks.
export function MergeModal({ onComplete }: { onComplete: (parentId: string) => void }) {
  const defaultCwd = useAtomValue(defaultCwdAtom);
  const [, setMergeMode] = useAtom(mergeModeAtom);
  const [mergeSelection, setMergeSelection] = useAtom(mergeSelectionAtom);

  const [parentProvider, setParentProvider] = useState<Provider>('claude');
  const [parentModel, setParentModel] = useState<ModelId | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingDirectory, setWorkingDirectory] = useState(defaultCwd);

  const canSubmit = mergeSelection.size > 0 && !!workingDirectory && !isSubmitting;

  const handleCancel = () => {
    setMergeMode(false);
    setMergeSelection(new Set());
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createMergeConversations({
        parentProvider,
        parentModel,
        workingDirectory,
        sourceIds: Array.from(mergeSelection),
      });
      setMergeMode(false);
      setMergeSelection(new Set());
      onComplete(result.parentId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="merge-modal">
      <h3 className="merge-modal__title">Merge Conversations</h3>
      <p className="merge-modal__hint">
        {mergeSelection.size === 0
          ? 'Select conversations in the sidebar to merge.'
          : `${mergeSelection.size} conversation${mergeSelection.size !== 1 ? 's' : ''} selected. Each will be forked with a review prompt.`}
      </p>

      <label className="merge-modal__label" htmlFor="merge-modal-cwd">
        Working Directory
      </label>
      <input
        id="merge-modal-cwd"
        type="text"
        className="merge-modal__input"
        value={workingDirectory}
        onChange={(e) => setWorkingDirectory(e.target.value)}
        placeholder="/path/to/project"
      />

      <ProviderModelPicker
        provider={parentProvider}
        onProviderChange={(p) => {
          setParentProvider(p);
          setParentModel(undefined);
        }}
        model={parentModel}
        onModelChange={setParentModel}
      />

      {error && <div className="merge-modal__error">{error}</div>}

      <div className="merge-modal__actions">
        <button
          type="button"
          className="merge-modal__cancel"
          onClick={handleCancel}
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
          {isSubmitting ? 'Forking...' : `Fork & Merge ${mergeSelection.size}`}
        </button>
      </div>
    </div>
  );
}
