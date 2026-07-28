import type {
  ConversationConfig,
  ModelSelection,
  Provider,
  ProviderCatalog,
  ReasoningSelection,
} from '@unleashd/shared';
import { useId, useMemo } from 'react';

export interface ConversationConfigPickerProps {
  value: ConversationConfig;
  onChange: (config: ConversationConfig) => void;
  catalog: ProviderCatalog;
  disabled?: boolean;
  providerFilter?: (provider: Provider) => boolean;
  showProvider?: boolean;
}

function selectionKey(selection: ModelSelection | ReasoningSelection): string {
  if (selection.mode === 'explicit') {
    return 'modelId' in selection
      ? `explicit:${selection.modelId}`
      : `explicit:${selection.effort}`;
  }
  return selection.mode;
}

export function ConversationConfigPicker({
  value,
  onChange,
  catalog,
  disabled = false,
  providerFilter,
  showProvider = true,
}: ConversationConfigPickerProps) {
  const id = useId().replace(/:/g, '');
  const providerGroup = `${id}-provider`;
  const modelGroup = `${id}-model`;
  const reasoningGroup = `${id}-reasoning`;

  const providers = providerFilter
    ? catalog.providers.filter((provider) => providerFilter(provider.id))
    : catalog.providers;
  const provider = catalog.providers.find((candidate) => candidate.id === value.provider);

  const resolvedModelId =
    value.model.mode === 'explicit' ? value.model.modelId : provider?.defaultModelId;
  const resolvedModel = provider?.models.find((candidate) => candidate.id === resolvedModelId);
  const unavailableExplicitModel =
    value.model.mode === 'explicit' && !resolvedModel ? value.model.modelId : null;
  const supportsDynamicModels = provider?.supportsDynamicModels === true;
  const modelKey = selectionKey(value.model);
  const reasoningKey = selectionKey(value.reasoning);
  const defaultModel = provider?.models.find(
    (candidate) => candidate.id === provider.defaultModelId
  );
  const reasoningLevels = resolvedModel?.reasoning?.levels ?? [];

  const reasoningOptions = useMemo(
    () => [
      {
        key: 'default',
        selection: { mode: 'default' } as const,
        label: resolvedModel?.reasoning?.defaultEffort
          ? `Model default (${resolvedModel.reasoning.defaultEffort})`
          : 'Model default (no flag)',
      },
      {
        key: 'disabled',
        selection: { mode: 'disabled' } as const,
        label: 'No reasoning flag',
      },
      ...reasoningLevels.map((effort) => ({
        key: `explicit:${effort}`,
        selection: { mode: 'explicit', effort } as const,
        label: effort,
      })),
      ...(value.reasoning.mode === 'explicit' && !reasoningLevels.includes(value.reasoning.effort)
        ? [
            {
              key: `explicit:${value.reasoning.effort}`,
              selection: value.reasoning,
              label: `${value.reasoning.effort} (unavailable)`,
            },
          ]
        : []),
    ],
    [reasoningLevels, resolvedModel?.reasoning?.defaultEffort, value.reasoning]
  );

  const updateProvider = (nextProvider: Provider) => {
    if (nextProvider === value.provider) return;
    // Dependent intent resets in the same event as provider selection. There is
    // no effect that can race a subsequent model/reasoning click.
    onChange({
      provider: nextProvider,
      model: { mode: 'default' },
      reasoning: { mode: 'default' },
    });
  };

  return (
    <>
      {showProvider && (
        <>
          <div className="new-conv-label">Provider</div>
          <div className="provider-selector">
            {providers.map((option) => (
              <label
                className={`provider-option ${value.provider === option.id ? 'selected' : ''}`}
                key={option.id}
              >
                <input
                  type="radio"
                  name={providerGroup}
                  value={option.id}
                  checked={value.provider === option.id}
                  disabled={disabled}
                  onChange={() => updateProvider(option.id)}
                />
                {option.displayName}
              </label>
            ))}
          </div>
        </>
      )}

      <div className="new-conv-label">Model</div>
      <div className="model-selector">
        <label className={`model-option ${modelKey === 'default' ? 'selected' : ''}`}>
          <input
            type="radio"
            name={modelGroup}
            checked={modelKey === 'default'}
            disabled={disabled}
            onChange={() => onChange({ ...value, model: { mode: 'default' } })}
          />
          Provider default{defaultModel ? ` (${defaultModel.displayName})` : ''}
        </label>
        {unavailableExplicitModel && (
          <label className="model-option selected unavailable">
            <input type="radio" name={modelGroup} checked disabled />
            {unavailableExplicitModel} (unavailable)
          </label>
        )}
        {provider?.models.map((model) => {
          const key = `explicit:${model.id}`;
          return (
            <label key={model.id} className={`model-option ${modelKey === key ? 'selected' : ''}`}>
              <input
                type="radio"
                name={modelGroup}
                value={model.id}
                checked={modelKey === key}
                disabled={disabled}
                onChange={() =>
                  onChange({ ...value, model: { mode: 'explicit', modelId: model.id } })
                }
              />
              {model.displayName}
            </label>
          );
        })}
        {supportsDynamicModels && (
          <label className="custom-model-option">
            <span>Custom model ID</span>
            <input
              type="text"
              value={value.model.mode === 'explicit' ? value.model.modelId : ''}
              disabled={disabled}
              placeholder="provider/model"
              spellCheck={false}
              onChange={(event) => {
                const modelId = event.target.value.trim();
                onChange({
                  ...value,
                  model: modelId.length > 0 ? { mode: 'explicit', modelId } : { mode: 'default' },
                });
              }}
            />
          </label>
        )}
      </div>

      {(reasoningLevels.length > 0 ||
        resolvedModel?.reasoning ||
        value.reasoning.mode === 'explicit') && (
        <>
          <div className="new-conv-label">Reasoning</div>
          <div className="model-selector">
            {reasoningOptions.map((option) => (
              <label
                key={option.key}
                className={`model-option ${reasoningKey === option.key ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name={reasoningGroup}
                  value={option.key}
                  checked={reasoningKey === option.key}
                  disabled={disabled}
                  onChange={() => onChange({ ...value, reasoning: option.selection })}
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
