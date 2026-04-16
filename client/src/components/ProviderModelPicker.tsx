import {
  CODEX_BASE_MODEL_INFOS,
  CODEX_MODEL_REGISTRY,
  CODEX_THINKING_DISPLAY_NAMES,
  CODEX_UNIFIED_THINKING_OPTIONS,
  type CodexThinkingMode,
  NO_CODEX_THINKING,
  PROVIDER_OPTIONS,
  toCodexModelId,
} from '@unleashd/shared';
import type { ModelId, ModelInfo, Provider } from '@unleashd/shared';
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_CODEX_ENTRY =
  CODEX_MODEL_REGISTRY.find((entry) => entry.isDefault) ?? CODEX_MODEL_REGISTRY[0];
const DEFAULT_CODEX_THINKING_MODE =
  DEFAULT_CODEX_ENTRY.defaultThinkingOption ??
  DEFAULT_CODEX_ENTRY.thinkingOptions[0] ??
  NO_CODEX_THINKING;

export interface ProviderModelPickerProps {
  provider: Provider;
  onProviderChange: (p: Provider) => void;
  model: ModelId | undefined;
  onModelChange: (m: ModelId | undefined) => void;
  /** Hide providers that don't match the filter (e.g. for merge, only fork-capable). */
  providerFilter?: (p: Provider) => boolean;
}

/**
 * Reusable provider + model selector.
 *
 * Manages its own model-list fetch and codex-specific base-model / reasoning
 * state internally, calling `onModelChange` with the final composed model ID.
 *
 * CSS classes come from Sidebar.css — import that stylesheet in the parent.
 */
export function ProviderModelPicker({
  provider,
  onProviderChange,
  model,
  onModelChange,
  providerFilter,
}: ProviderModelPickerProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [codexModelName, setCodexModelName] = useState<string>(DEFAULT_CODEX_ENTRY.modelName);
  const [codexThinkingMode, setCodexThinkingMode] = useState<CodexThinkingMode>(
    DEFAULT_CODEX_THINKING_MODE
  );

  // Fetch available models when provider changes
  useEffect(() => {
    if (provider === 'codex') {
      setModels([]);
      setCodexModelName(DEFAULT_CODEX_ENTRY.modelName);
      setCodexThinkingMode(DEFAULT_CODEX_THINKING_MODE);
      onModelChange(toCodexModelId(DEFAULT_CODEX_ENTRY.modelName, DEFAULT_CODEX_THINKING_MODE));
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

  const handleCodexModelChange = useCallback(
    (nextModelName: string) => {
      setCodexModelName(nextModelName);
      onModelChange(toCodexModelId(nextModelName, codexThinkingMode));
    },
    [codexThinkingMode, onModelChange]
  );

  const handleCodexThinkingModeChange = useCallback(
    (nextThinkingMode: CodexThinkingMode) => {
      setCodexThinkingMode(nextThinkingMode);
      onModelChange(toCodexModelId(codexModelName, nextThinkingMode));
    },
    [codexModelName, onModelChange]
  );

  const visibleProviders = providerFilter
    ? PROVIDER_OPTIONS.filter((option) => providerFilter(option.id))
    : PROVIDER_OPTIONS;

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
              onChange={() => onProviderChange(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <label className="new-conv-label">Model</label>
      {provider === 'codex' ? (
        <>
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
          <label className="new-conv-label">Reasoning</label>
          <div className="model-selector">
            {CODEX_UNIFIED_THINKING_OPTIONS.map((thinkingMode) => (
              <label
                key={thinkingMode}
                className={`model-option ${codexThinkingMode === thinkingMode ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="codex-reasoning"
                  value={thinkingMode}
                  checked={codexThinkingMode === thinkingMode}
                  onChange={() => handleCodexThinkingModeChange(thinkingMode)}
                />
                {thinkingMode === NO_CODEX_THINKING
                  ? 'No Extra Reasoning'
                  : CODEX_THINKING_DISPLAY_NAMES[thinkingMode]}
              </label>
            ))}
          </div>
        </>
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
    </>
  );
}
