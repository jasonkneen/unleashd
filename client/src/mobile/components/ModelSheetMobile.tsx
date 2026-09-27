import { type ConversationConfig, DEFAULT_PROVIDER } from '@unleashd/shared';
import { useEffect, useRef } from 'react';
import { setConversationConfig } from '../../atoms/config-actions';
import { useProviderCatalog } from '../../hooks/useProviderCatalog';

/**
 * ModelSheetMobile — provider / model / reasoning selection in a modal.
 *
 * Replaces the three always-visible dropdown chips that used to sit in the
 * conversation header. On a phone those wrapped onto two or three rows (e.g.
 * "Muse" + "Muse Spark 1.2 Contributor" + "Default · high"), eating a third of
 * the screen before a single message was visible. The header now shows one
 * compact label; this sheet opens on tap.
 *
 * Values pass through verbatim — provider-bespoke effort strings are never
 * translated (see docs/pass-through-pattern.md).
 */

export function modelSummary(
  config: ConversationConfig,
  catalog: ReturnType<typeof useProviderCatalog>['catalog']
): string {
  const provider = catalog?.providers.find((p) => p.id === config.provider);
  const modelId =
    config.model.mode === 'explicit' ? config.model.modelId : provider?.defaultModelId;
  const model = provider?.models.find((m) => m.id === modelId);
  const name = model?.displayName ?? modelId ?? provider?.displayName ?? config.provider;
  const effort =
    config.reasoning.mode === 'explicit'
      ? config.reasoning.effort
      : config.reasoning.mode === 'disabled'
        ? 'no reasoning'
        : null;
  return effort ? `${name} · ${effort}` : name;
}

export function ModelSheetMobile({
  conversationId,
  config,
  configRevision,
  onClose,
}: {
  conversationId: string;
  config: ConversationConfig;
  configRevision: number;
  onClose: () => void;
}) {
  const { catalog, error, retry } = useProviderCatalog();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const apply = (patch: Parameters<typeof setConversationConfig>[0]['patch']) => {
    setConversationConfig({ conversationId, expectedRevision: configRevision, patch });
    onClose();
  };

  const providerEntry = catalog?.providers.find((p) => p.id === config.provider);
  const resolvedModelId =
    config.model.mode === 'explicit' ? config.model.modelId : providerEntry?.defaultModelId;
  const resolvedModel = providerEntry?.models.find((m) => m.id === resolvedModelId);

  return (
    <dialog
      ref={dialogRef}
      className="mobile-sheet"
      aria-label="Model settings"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="mobile-sheet__inner">
        <div className="mobile-sheet__grabber" aria-hidden="true" />
        <div className="mobile-sheet__header">
          <h2 className="mobile-sheet__title">Model</h2>
          <button
            type="button"
            className="mobile-sheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!catalog ? (
          <div className="mobile-sheet__note" role={error ? 'alert' : 'status'}>
            {error ? (
              <>
                Unable to load providers.{' '}
                <button type="button" className="mobile-chat__action" onClick={retry}>
                  Retry
                </button>
              </>
            ) : (
              'Loading providers…'
            )}
          </div>
        ) : (
          <>
            <div className="mobile-sheet__section-title">Provider</div>
            <div className="mobile-sheet__options">
              {catalog.providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`ui-choice mobile-sheet__option ${p.id === DEFAULT_PROVIDER ? 'mobile-sheet__option--default' : ''}`}
                  aria-pressed={p.id === config.provider}
                  onClick={() =>
                    apply({
                      kind: 'set_provider',
                      provider: p.id as ConversationConfig['provider'],
                    })
                  }
                >
                  {p.displayName}
                  {p.id === DEFAULT_PROVIDER && (
                    <span className="mobile-sheet__option-meta">default</span>
                  )}
                </button>
              ))}
            </div>

            {providerEntry && (
              <>
                <div className="mobile-sheet__section-title">Model</div>
                <div className="mobile-sheet__options">
                  {providerEntry.models
                    .filter(
                      (model) => providerEntry.id !== 'codex' || model.id.startsWith('gpt-6-')
                    )
                    .map((m) => {
                      const isDefault = m.id === providerEntry.defaultModelId;
                      const selected =
                        (config.model.mode === 'default' && isDefault) ||
                        (config.model.mode === 'explicit' && config.model.modelId === m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`ui-choice mobile-sheet__option ${isDefault ? 'mobile-sheet__option--default' : ''}`}
                          aria-pressed={selected}
                          onClick={() => {
                            // A model change returns thinking to the catalog default.
                            // Reset it in the same patch so a disabled/stale effort
                            // cannot carry over to the new model.
                            apply({
                              kind: 'replace',
                              config: {
                                ...config,
                                model: isDefault
                                  ? { mode: 'default' }
                                  : { mode: 'explicit', modelId: m.id },
                                reasoning: { mode: 'default' },
                              },
                            });
                          }}
                        >
                          {m.displayName}
                          {isDefault && <span className="mobile-sheet__option-meta">default</span>}
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            {resolvedModel?.reasoning && (
              <>
                <div className="mobile-sheet__section-title">Reasoning</div>
                <div className="mobile-sheet__options">
                  <button
                    type="button"
                    className={`ui-choice mobile-sheet__option ${!resolvedModel.reasoning.defaultEffort ? 'mobile-sheet__option--default' : ''}`}
                    aria-pressed={
                      resolvedModel.reasoning.defaultEffort
                        ? config.reasoning.mode === 'disabled'
                        : config.reasoning.mode === 'default'
                    }
                    onClick={() =>
                      apply({
                        kind: 'set_reasoning',
                        reasoning: resolvedModel.reasoning?.defaultEffort
                          ? { mode: 'disabled' }
                          : { mode: 'default' },
                      })
                    }
                  >
                    No reasoning flag
                    {!resolvedModel.reasoning?.defaultEffort && (
                      <span className="mobile-sheet__option-meta">default</span>
                    )}
                  </button>
                  {resolvedModel.reasoning.levels.map((effort) => (
                    <button
                      key={effort}
                      type="button"
                      className={`ui-choice mobile-sheet__option ${resolvedModel.reasoning?.defaultEffort === effort ? 'mobile-sheet__option--default' : ''}`}
                      aria-pressed={
                        (config.reasoning.mode === 'default' &&
                          resolvedModel.reasoning?.defaultEffort === effort) ||
                        (config.reasoning.mode === 'explicit' && config.reasoning.effort === effort)
                      }
                      onClick={() =>
                        apply({
                          kind: 'set_reasoning',
                          reasoning:
                            resolvedModel.reasoning?.defaultEffort === effort
                              ? { mode: 'default' }
                              : { mode: 'explicit', effort },
                        })
                      }
                    >
                      {effort}
                      {resolvedModel.reasoning?.defaultEffort === effort && (
                        <span className="mobile-sheet__option-meta">default</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
