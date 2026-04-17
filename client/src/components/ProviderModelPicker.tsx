import {
  CODEX_BASE_MODEL_INFOS,
  CODEX_MODEL_REGISTRY,
  EFFORT_DISPLAY_NAMES,
  PROVIDER_OPTIONS,
  effortLevelsForProvider,
} from '@unleashd/shared';
import type { ModelId, ModelInfo, Provider, ReasoningEffort } from '@unleashd/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

const DEFAULT_CODEX_ENTRY =
  CODEX_MODEL_REGISTRY.find((entry) => entry.isDefault) ?? CODEX_MODEL_REGISTRY[0];

const PROVIDERS_WITH_REASONING: ReadonlySet<Provider> = new Set<Provider>(['claude', 'codex']);

export interface ProviderModelPickerProps {
  provider: Provider;
  onProviderChange: (p: Provider) => void;
  model: ModelId | undefined;
  onModelChange: (m: ModelId | undefined) => void;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (e: ReasoningEffort | undefined) => void;
  /** Hide providers that don't match the filter (e.g. for merge, only fork-capable). */
  providerFilter?: (p: Provider) => boolean;
}

/**
 * Reusable provider + model selector.
 *
 * Sends the base model id on the wire (no composite codex ids); reasoningEffort
 * travels as a sibling field via onReasoningEffortChange — same shape for every
 * provider that supports it. Defaults (including effort) are server-side; the
 * UI leaves effort undefined until the user explicitly picks one.
 *
 * CSS classes come from Sidebar.css — import that stylesheet in the parent.
 */
export function ProviderModelPicker({
  provider,
  onProviderChange,
  model,
  onModelChange,
  reasoningEffort,
  onReasoningEffortChange,
  providerFilter,
}: ProviderModelPickerProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [codexModelName, setCodexModelName] = useState<string>(DEFAULT_CODEX_ENTRY.modelName);

  // Fetch available models when provider changes. Do NOT reset reasoningEffort
  // from inside an effect — an async reset after paint races with quick user
  // clicks and can clobber the selection. Effort reset is instead handled
  // synchronously by the provider radio onChange below, and by the parent when
  // it opens the modal.
  useEffect(() => {
    if (provider === 'codex') {
      setModels([]);
      setCodexModelName(DEFAULT_CODEX_ENTRY.modelName);
      onModelChange(DEFAULT_CODEX_ENTRY.modelName as ModelId);
      return;
    }

    fetch(`/api/models?provider=${provider}`)
      .then((res) => res.json())
      .then((data: ModelInfo[]) => {
        setModels(data);
        const defaultModel = data.find((m) => m.isDefault);
        onModelChange(defaultModel?.id);
      });
    // onModelChange is the parent setter — stable by convention.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Synchronous effort reset when user switches provider — runs inside the
  // click handler, before paint, so a fast user can't lose their next click.
  const handleProviderChange = useCallback(
    (next: Provider) => {
      if (next !== provider) {
        onReasoningEffortChange?.(undefined);
      }
      onProviderChange(next);
    },
    [provider, onProviderChange, onReasoningEffortChange]
  );

  const handleCodexModelChange = useCallback(
    (nextModelName: string) => {
      setCodexModelName(nextModelName);
      onModelChange(nextModelName as ModelId);
    },
    [onModelChange]
  );

  const visibleProviders = providerFilter
    ? PROVIDER_OPTIONS.filter((option) => providerFilter(option.id))
    : PROVIDER_OPTIONS;

  const showReasoning =
    PROVIDERS_WITH_REASONING.has(provider) && typeof onReasoningEffortChange === 'function';

  // Per-provider level list. Claude supports max but not minimal; codex is the
  // opposite. "Standard" (undefined) is always first — means no --effort flag.
  const reasoningOptions = useMemo(() => {
    const levels = effortLevelsForProvider(provider);
    const standard: { value: ReasoningEffort | undefined; label: string } = {
      value: undefined,
      label: 'Standard',
    };
    return [
      standard,
      ...levels.map((level) => ({ value: level, label: EFFORT_DISPLAY_NAMES[level] })),
    ];
  }, [provider]);

  return (
    <>
      <label className="new-conv-label">Provider</label>
      <div className="provider-selector">
        {visibleProviders.map((option) => (
          <label
            className={`provider-option ${provider === option.id ? 'selected' : ''}`}
            key={option.id}
          >
            <input
              type="radio"
              name="provider"
              value={option.id}
              checked={provider === option.id}
              onChange={() => handleProviderChange(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <label className="new-conv-label">Model</label>
      {provider === 'codex' ? (
        <div className="model-selector">
          {CODEX_BASE_MODEL_INFOS.map((m) => (
            <label
              key={m.id}
              className={`model-option ${codexModelName === m.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="codex-model"
                value={m.id}
                checked={codexModelName === m.id}
                onChange={() => handleCodexModelChange(m.id)}
              />
              {m.displayName}
            </label>
          ))}
        </div>
      ) : (
        <div className="model-selector">
          {models.map((m) => (
            <label key={m.id} className={`model-option ${model === m.id ? 'selected' : ''}`}>
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={model === m.id}
                onChange={() => onModelChange(m.id)}
              />
              {m.displayName}
            </label>
          ))}
        </div>
      )}
      {showReasoning && onReasoningEffortChange && (
        <>
          <label className="new-conv-label">Reasoning</label>
          <div className="model-selector">
            {reasoningOptions.map((option) => (
              <label
                key={option.value ?? 'standard'}
                className={`model-option ${reasoningEffort === option.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="reasoning-effort"
                  value={option.value ?? ''}
                  checked={reasoningEffort === option.value}
                  onChange={() => onReasoningEffortChange(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </>
      )}
    </>
  );
}
