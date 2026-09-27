import type { ConversationConfig, Provider, ProviderCatalog } from '@unleashd/shared';
import { useId } from 'react';
import { type ConfigGroup, type DefaultsDisplay, configGroups } from './config-options';
import './ConversationConfigPicker.css';

/** `choice`: a radio was picked. `typed`: a keystroke in the custom model field. */
export type ConfigEditOrigin = 'choice' | 'typed';

export interface ConversationConfigPickerProps {
  value: ConversationConfig;
  onChange: (config: ConversationConfig, origin: ConfigEditOrigin) => void;
  catalog: ProviderCatalog;
  disabled?: boolean;
  providerDisabled?: boolean;
  defaults?: DefaultsDisplay;
  showProvider?: boolean;
  reasoningControl?: 'choices' | 'slider';
  providerFilter?: (provider: Provider) => boolean;
}

const ANY_PROVIDER = () => true;

const GROUP_CLASS: Record<ConfigGroup['id'], string> = {
  provider: 'config-picker__group config-picker__group--provider',
  model: 'config-picker__group config-picker__group--model',
  reasoning: 'config-picker__group',
};

/** Provider / model / reasoning radio groups. One list for every surface and device. */
export function ConversationConfigPicker({
  value,
  onChange,
  catalog,
  disabled = false,
  providerDisabled = false,
  defaults = 'inline',
  showProvider = true,
  reasoningControl = 'choices',
  providerFilter = ANY_PROVIDER,
}: ConversationConfigPickerProps) {
  const id = useId().replace(/:/g, '');
  const groups = configGroups(value, catalog, defaults, providerFilter);
  const dynamicModels =
    catalog.providers.find((provider) => provider.id === value.provider)?.supportsDynamicModels ===
    true;

  return (
    <>
      {groups
        .filter((group) => showProvider || group.id !== 'provider')
        .map((group) => {
          const name = `${id}-${group.id}`;
          const locked = disabled || (group.id === 'provider' && providerDisabled);
          if (group.id === 'reasoning' && reasoningControl === 'slider') {
            const index = Math.max(
              0,
              group.choices.findIndex((choice) => choice.selected)
            );
            const active = group.choices[index];
            return (
              <div key={group.id} className="config-picker__slider">
                <div className="config-picker__slider-heading">
                  <label id={name} htmlFor={`${name}-range`}>
                    Thinking
                  </label>
                  <div className="config-picker__slider-value">
                    <output htmlFor={`${name}-range`}>{active.label}</output>
                    {active.meta && (
                      <span className="config-picker__default-hint">{active.meta}</span>
                    )}
                  </div>
                </div>
                <input
                  id={`${name}-range`}
                  type="range"
                  min={0}
                  max={group.choices.length - 1}
                  step={1}
                  value={index}
                  disabled={locked || group.choices.length < 2}
                  aria-labelledby={name}
                  aria-valuetext={active.label}
                  onChange={(event) => {
                    const choice = group.choices[Number(event.target.value)];
                    if (choice.availability === 'available') onChange(choice.next, 'choice');
                  }}
                />
                <div className="config-picker__slider-stops" aria-hidden="true">
                  {group.choices.map((choice) => (
                    <span key={choice.key} data-selected={choice.selected || undefined}>
                      {choice.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={group.id} className="config-picker__section">
              <div className="config-picker__label" id={name}>
                {group.title}
              </div>
              <div className={GROUP_CLASS[group.id]} role="radiogroup" aria-labelledby={name}>
                {group.choices.map((choice) => (
                  <label
                    key={choice.key}
                    className={`ui-choice config-picker__option ui-row ui-card${choice.meta === 'default' ? ' config-picker__option--default' : ''}${choice.selected ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={choice.key}
                      checked={choice.selected}
                      disabled={locked || choice.availability === 'unavailable'}
                      onChange={() => onChange(choice.next, 'choice')}
                    />
                    {choice.label}
                    {choice.meta && (
                      <span className="config-picker__meta config-picker__default-hint ui-muted">
                        {choice.meta}
                      </span>
                    )}
                  </label>
                ))}
                {group.id === 'model' && dynamicModels && (
                  <label className="config-picker__custom">
                    <span>Custom model ID</span>
                    <input
                      type="text"
                      value={value.model.mode === 'explicit' ? value.model.modelId : ''}
                      disabled={disabled}
                      placeholder="provider/model"
                      spellCheck={false}
                      onChange={(event) => {
                        const modelId = event.target.value.trim();
                        onChange(
                          {
                            ...value,
                            model:
                              modelId.length > 0
                                ? { mode: 'explicit', modelId }
                                : { mode: 'default' },
                            reasoning: { mode: 'default' },
                          },
                          'typed'
                        );
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
    </>
  );
}
