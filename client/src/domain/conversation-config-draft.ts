import type {
  ConfigError,
  ConversationConfig,
  ConversationConfigPatch,
  ModelSelection,
  Provider,
  ProviderCatalog,
  ReasoningSelection,
  Result,
} from '@unleashd/shared';

export type ConversationConfigDraft = ConversationConfig;

export function createDefaultDraft(provider: Provider = 'codex'): ConversationConfigDraft {
  return {
    provider,
    model: { mode: 'default' },
    reasoning: { mode: 'default' },
  };
}

export function selectedModelId(selection: ModelSelection): string | undefined {
  return selection.mode === 'explicit' ? selection.modelId : undefined;
}

export function selectedReasoningEffort(selection: ReasoningSelection): string | null | undefined {
  if (selection.mode === 'explicit') return selection.effort;
  if (selection.mode === 'disabled') return null;
  return undefined;
}

export function modelSelection(modelId: string | undefined): ModelSelection {
  return modelId ? { mode: 'explicit', modelId } : { mode: 'default' };
}

export function reasoningSelection(effort: string | null | undefined): ReasoningSelection {
  if (effort === null) return { mode: 'disabled' };
  if (effort === undefined) return { mode: 'default' };
  return { mode: 'explicit', effort };
}

function configError(code: ConfigError['code'], message: string): Result<never, ConfigError> {
  return { ok: false, error: { code, message } };
}

/**
 * Applies a UI draft transition using the same invariants as the server domain
 * service. This is convenience validation only; the server remains authoritative.
 */
export function applyDraftPatch(
  draft: ConversationConfigDraft,
  patch: ConversationConfigPatch,
  catalog: ProviderCatalog
): Result<ConversationConfigDraft, ConfigError> {
  const providers = new Map(catalog.providers.map((provider) => [provider.id, provider]));

  let next: ConversationConfigDraft;
  switch (patch.kind) {
    case 'replace':
      next = patch.config;
      break;
    case 'set_provider':
      next = createDefaultDraft(patch.provider);
      break;
    case 'set_model':
      next = { ...draft, model: patch.model };
      break;
    case 'set_reasoning':
      next = { ...draft, reasoning: patch.reasoning };
      break;
  }

  const provider = providers.get(next.provider);
  if (!provider) {
    return configError('provider_unavailable', `Provider ${next.provider} is unavailable.`);
  }

  const modelId = next.model.mode === 'explicit' ? next.model.modelId : provider.defaultModelId;
  const model = provider.models.find((candidate) => candidate.id === modelId);
  if (!model && !provider.supportsDynamicModels) {
    return {
      ok: false,
      error: {
        code: 'model_unavailable',
        message: `Model ${modelId} is unavailable for ${provider.displayName}.`,
        provider: next.provider,
        modelId,
        validValues: provider.models.map((candidate) => candidate.id),
      },
    };
  }

  if (next.reasoning.mode === 'explicit') {
    const levels = model?.reasoning?.levels ?? [];
    if (!levels.includes(next.reasoning.effort)) {
      return {
        ok: false,
        error: {
          code: model?.reasoning ? 'reasoning_unavailable' : 'reasoning_unsupported',
          message: `${provider.displayName} model ${modelId} does not support ${next.reasoning.effort}.`,
          provider: next.provider,
          modelId,
          validValues: levels,
        },
      };
    }
  }

  return { ok: true, value: next };
}
