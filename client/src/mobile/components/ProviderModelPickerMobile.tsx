import { useState, useRef, useEffect } from 'react';
import type { ConversationConfig } from '@unleashd/shared';
import { useProviderCatalog } from '../../hooks/useProviderCatalog';
import { setConversationConfig } from '../../atoms/config-actions';

/**
 * ProviderModelPickerMobile — minimal reasoning/effort passthrough.
 * Passes the provider's string verbatim to setConversationConfig; no translation.
 * Mirrors Chat.tsx header picker logic but rebuilt for mobile (no Desktop import).
 */
export function ProviderModelPickerMobile({
  conversationId,
  config,
  configRevision,
}: {
  conversationId: string;
  config: ConversationConfig;
  configRevision: number;
}) {
  const { catalog } = useProviderCatalog();
  const [open, setOpen] = useState<'provider' | 'model' | 'reasoning' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!catalog) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>Loading providers…</div>;
  }

  const providerEntry = catalog.providers.find((p) => p.id === config.provider);
  const resolvedModelId =
    config.model.mode === 'explicit' ? config.model.modelId : providerEntry?.defaultModelId;
  const resolvedModel = providerEntry?.models.find((m) => m.id === resolvedModelId);
  const reasoningLabel =
    config.reasoning.mode === 'explicit'
      ? config.reasoning.effort
      : config.reasoning.mode === 'disabled'
        ? 'No reasoning'
        : resolvedModel?.reasoning?.defaultEffort
          ? `Default · ${resolvedModel.reasoning.defaultEffort}`
          : 'Default';

  const applyPatch = (patch: Parameters<typeof setConversationConfig>[0]['patch']) => {
    setConversationConfig({ conversationId, expectedRevision: configRevision, patch });
    setOpen(null);
  };

  return (
    <div ref={ref} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Provider */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => (v === 'provider' ? null : 'provider'))}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle, #333)',
            background: 'var(--bg-raised-1, #1e1e1e)',
            color: 'var(--text-primary, #e8e8e8)',
          }}
        >
          {providerEntry?.displayName ?? config.provider} ▾
        </button>
        {open === 'provider' && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              minWidth: 160,
              borderRadius: 10,
              border: '1px solid var(--border-subtle, #333)',
              background: 'var(--bg-raised-2, #222)',
              zIndex: 10,
              overflow: 'hidden',
            }}
          >
            {catalog.providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPatch({ kind: 'set_provider', provider: p.id as ConversationConfig['provider'] })}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  background: p.id === config.provider ? 'var(--bg-raised-1, #2a2a2a)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary, #e8e8e8)',
                }}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model */}
      {providerEntry && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setOpen((v) => (v === 'model' ? null : 'model'))}
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle, #333)',
              background: 'var(--bg-raised-1, #1e1e1e)',
              color: 'var(--text-primary, #e8e8e8)',
            }}
          >
            {resolvedModel?.displayName ?? resolvedModelId ?? 'Default'} ▾
          </button>
          {open === 'model' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                minWidth: 180,
                maxHeight: 260,
                overflowY: 'auto',
                borderRadius: 10,
                border: '1px solid var(--border-subtle, #333)',
                background: 'var(--bg-raised-2, #222)',
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={() => applyPatch({ kind: 'set_model', model: { mode: 'default' } })}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  background: config.model.mode === 'default' ? 'var(--bg-raised-1, #2a2a2a)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary, #e8e8e8)',
                }}
              >
                Provider default ({providerEntry.defaultModelId})
              </button>
              {providerEntry.models.map((m) => {
                const selected = config.model.mode === 'explicit' && config.model.modelId === m.id;
                const currentEffort = config.reasoning.mode === 'explicit' ? config.reasoning.effort : null;
                const supportsEffort = !currentEffort || m.reasoning?.levels.includes(currentEffort);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (!supportsEffort) {
                        applyPatch({
                          kind: 'replace',
                          config: { ...config, model: { mode: 'explicit', modelId: m.id }, reasoning: { mode: 'default' } },
                        });
                      } else {
                        applyPatch({ kind: 'set_model', model: { mode: 'explicit', modelId: m.id } });
                      }
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      fontSize: 12,
                      background: selected ? 'var(--bg-raised-1, #2a2a2a)' : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary, #e8e8e8)',
                    }}
                  >
                    {m.displayName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reasoning — verbatim passthrough, no translation */}
      {resolvedModel?.reasoning && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setOpen((v) => (v === 'reasoning' ? null : 'reasoning'))}
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle, #333)',
              background: 'var(--bg-raised-1, #1e1e1e)',
              color: 'var(--text-primary, #e8e8e8)',
            }}
          >
            {reasoningLabel} ▾
          </button>
          {open === 'reasoning' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                minWidth: 160,
                borderRadius: 10,
                border: '1px solid var(--border-subtle, #333)',
                background: 'var(--bg-raised-2, #222)',
                zIndex: 10,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => applyPatch({ kind: 'set_reasoning', reasoning: { mode: 'default' } })}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  background: config.reasoning.mode === 'default' ? 'var(--bg-raised-1, #2a2a2a)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary, #e8e8e8)',
                }}
              >
                Model default
                {resolvedModel.reasoning.defaultEffort ? ` · ${resolvedModel.reasoning.defaultEffort}` : ''}
              </button>
              <button
                type="button"
                onClick={() => applyPatch({ kind: 'set_reasoning', reasoning: { mode: 'disabled' } })}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  background: config.reasoning.mode === 'disabled' ? 'var(--bg-raised-1, #2a2a2a)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary, #e8e8e8)',
                }}
              >
                No reasoning flag
              </button>
              {resolvedModel.reasoning.levels.map((effort) => (
                <button
                  key={effort}
                  type="button"
                  onClick={() =>
                    applyPatch({ kind: 'set_reasoning', reasoning: { mode: 'explicit', effort } })
                  }
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 12,
                    background:
                      config.reasoning.mode === 'explicit' && config.reasoning.effort === effort
                        ? 'var(--bg-raised-1, #2a2a2a)'
                        : 'transparent',
                    border: 'none',
                    color: 'var(--text-primary, #e8e8e8)',
                  }}
                >
                  {effort}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
