import type {
  ConversationConfig,
  ModelSelection,
  Provider,
  ProviderCatalog,
  ReasoningSelection,
} from '@unleashd/shared';
import { DEFAULT_PROVIDER } from '@unleashd/shared';
import { useId, useMemo } from 'react';
import './ConversationConfigPicker.css';

export interface ConversationConfigPickerProps {
  value: ConversationConfig;
  onChange: (config: ConversationConfig) => void;
  catalog: ProviderCatalog;
  disabled?: boolean;
  providerDisabled?: boolean;
  providerFilter?: (provider: Provider) => boolean;
  showProvider?: boolean;
  reasoningControl?: 'choices' | 'slider';
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
  providerDisabled = false,
  providerFilter,
  showProvider = true,
  reasoningControl = 'choices',
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
  const selectableModels = provider?.models.filter(
    (model) => provider?.id !== 'codex' || model.id.startsWith('gpt-6-')
  );
  const reasoningLevels = resolvedModel?.reasoning?.levels ?? [];

  const reasoningOptions = useMemo(
    () => [
      {
        key: 'disabled',
        selection: { mode: 'disabled' } as const,
        label: 'Auto',
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
    [reasoningLevels, value.reasoning]
  );

  const defaultEffort = resolvedModel?.reasoning?.defaultEffort;
  const defaultReasoningKey =
    defaultEffort === undefined ? 'disabled' : `explicit:${defaultEffort}`;
  const activeReasoningKey = reasoningKey === 'default' ? defaultReasoningKey : reasoningKey;
  const reasoningIndex = Math.max(
    0,
    reasoningOptions.findIndex((option) => option.key === activeReasoningKey)
  );
  const activeReasoning = reasoningOptions[reasoningIndex];

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
          <div className="new-conv-label" id={providerGroup}>
            Harness
          </div>
          <div
            className="provider-selector conversation-config-selector conversation-config-provider-selector"
            role="radiogroup"
            aria-labelledby={providerGroup}
          >
            {providers.map((option) => (
              <label
                className={`ui-choice provider-option conversation-config-choice ${option.id === DEFAULT_PROVIDER ? 'conversation-config-choice--default' : ''} ${value.provider === option.id ? 'selected' : ''}`}
                key={option.id}
              >
                <input
                  type="radio"
                  name={providerGroup}
                  value={option.id}
                  checked={value.provider === option.id}
                  disabled={disabled || providerDisabled}
                  onChange={() => updateProvider(option.id)}
                />
                {option.displayName}
                {option.id === DEFAULT_PROVIDER && (
                  <span className="conversation-config-default-hint">default</span>
                )}
              </label>
            ))}
          </div>
        </>
      )}

      <div className="new-conv-label" id={modelGroup}>
        Model
      </div>
      <div
        className="model-selector conversation-config-selector conversation-config-model-selector"
        role="radiogroup"
        aria-labelledby={modelGroup}
      >
        {unavailableExplicitModel && (
          <label className="ui-choice model-option selected unavailable">
            <input type="radio" name={modelGroup} checked disabled />
            {unavailableExplicitModel} (unavailable)
          </label>
        )}
        {selectableModels?.map((model) => {
          const key = `explicit:${model.id}`;
          const isDefault = model.id === provider?.defaultModelId;
          const selected = modelKey === key || (isDefault && modelKey === 'default');
          return (
            <label
              key={model.id}
              className={`ui-choice model-option conversation-config-choice ${isDefault ? 'conversation-config-choice--default' : ''} ${selected ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name={modelGroup}
                value={model.id}
                checked={selected}
                disabled={disabled}
                onChange={() =>
                  onChange({
                    ...value,
                    model: isDefault
                      ? { mode: 'default' }
                      : { mode: 'explicit', modelId: model.id },
                    reasoning: { mode: 'default' },
                  })
                }
              />
              {model.displayName}
              {isDefault && <span className="conversation-config-default-hint">default</span>}
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
                  reasoning: { mode: 'default' },
                });
              }}
            />
          </label>
        )}
      </div>

      {(reasoningLevels.length > 0 ||
        resolvedModel?.reasoning ||
        value.reasoning.mode === 'explicit') &&
        (reasoningControl === 'slider' ? (
          <div className="conversation-config-slider">
            <div className="conversation-config-slider-heading">
              <label id={reasoningGroup} htmlFor={`${reasoningGroup}-range`}>
                Thinking
              </label>
              <div className="conversation-config-slider-value">
                <output htmlFor={`${reasoningGroup}-range`}>{activeReasoning.label}</output>
                {activeReasoning.key === defaultReasoningKey && (
                  <span className="conversation-config-default-hint">default</span>
                )}
              </div>
            </div>
            <input
              id={`${reasoningGroup}-range`}
              type="range"
              min={0}
              max={reasoningOptions.length - 1}
              step={1}
              value={reasoningIndex}
              disabled={disabled || reasoningOptions.length < 2}
              aria-labelledby={reasoningGroup}
              aria-valuetext={activeReasoning.label}
              onChange={(event) => {
                const option = reasoningOptions[Number(event.target.value)];
                onChange({
                  ...value,
                  reasoning:
                    option.key === defaultReasoningKey ? { mode: 'default' } : option.selection,
                });
              }}
            />
            <div className="conversation-config-slider-stops" aria-hidden="true">
              {reasoningOptions.map((option) => (
                <span
                  key={option.key}
                  data-selected={option.key === activeReasoningKey || undefined}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="new-conv-label" id={reasoningGroup}>
              Thinking Level
            </div>
            <div
              className="model-selector conversation-config-selector conversation-config-reasoning-selector"
              role="radiogroup"
              aria-labelledby={reasoningGroup}
            >
              {reasoningOptions.map((option) => {
                const defaultEffort = resolvedModel?.reasoning?.defaultEffort;
                const isDefault =
                  option.key === `explicit:${defaultEffort}` ||
                  (defaultEffort === undefined && option.key === 'disabled');
                const selected =
                  isDefault && reasoningKey === 'default' ? true : reasoningKey === option.key;
                return (
                  <label
                    key={option.key}
                    title={
                      option.key === 'disabled'
                        ? 'Let the harness choose the thinking level'
                        : undefined
                    }
                    className={`ui-choice model-option conversation-config-choice ${isDefault ? 'conversation-config-choice--default' : ''} ${selected ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name={reasoningGroup}
                      value={option.key}
                      checked={selected}
                      disabled={disabled}
                      onChange={() =>
                        onChange({
                          ...value,
                          reasoning: isDefault ? { mode: 'default' } : option.selection,
                        })
                      }
                    />
                    {option.label}
                    {isDefault && <span className="conversation-config-default-hint">default</span>}
                  </label>
                );
              })}
            </div>
          </>
        ))}
    </>
  );
}
