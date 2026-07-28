import {
  type ConversationConfig,
  type ModelId,
  type Provider,
  createDefaultConversationConfig,
  normalizeModelId,
} from '@unleashd/shared';

export function configFromProviderPreferences(input: {
  provider: Provider;
  model?: ModelId;
  reasoningEffort?: string | null;
}): ConversationConfig {
  const normalizedModel = normalizeModelId(input.provider, input.model);
  return {
    ...createDefaultConversationConfig(input.provider),
    model:
      normalizedModel === undefined
        ? { mode: 'default' }
        : { mode: 'explicit', modelId: normalizedModel },
    reasoning:
      input.reasoningEffort === null
        ? { mode: 'disabled' }
        : input.reasoningEffort !== undefined
          ? { mode: 'explicit', effort: input.reasoningEffort }
          : { mode: 'default' },
  };
}
