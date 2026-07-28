import { z } from 'zod';
import {
  type Provider,
  type ProviderCatalog,
  ProviderSchema,
  findModelDefinition,
  findProviderCatalogEntry,
} from './provider-catalog.js';

export const ModelIdSchema = z.string().min(1);
export type ModelId = z.infer<typeof ModelIdSchema>;

export const ReasoningEffortSchema = z.string().min(1);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

export const ModelSelectionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('default') }),
  z.object({ mode: z.literal('explicit'), modelId: ModelIdSchema }),
]);
export type ModelSelection = z.infer<typeof ModelSelectionSchema>;

export const ReasoningSelectionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('default') }),
  z.object({ mode: z.literal('disabled') }),
  z.object({ mode: z.literal('explicit'), effort: ReasoningEffortSchema }),
]);
export type ReasoningSelection = z.infer<typeof ReasoningSelectionSchema>;

export const ConversationConfigSchema = z.object({
  provider: ProviderSchema,
  model: ModelSelectionSchema,
  reasoning: ReasoningSelectionSchema,
});
export type ConversationConfig = z.infer<typeof ConversationConfigSchema>;

export const ConversationConfigPatchSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('replace'), config: ConversationConfigSchema }),
  z.object({ kind: z.literal('set_provider'), provider: ProviderSchema }),
  z.object({ kind: z.literal('set_model'), model: ModelSelectionSchema }),
  z.object({
    kind: z.literal('set_reasoning'),
    reasoning: ReasoningSelectionSchema,
  }),
]);
export type ConversationConfigPatch = z.infer<typeof ConversationConfigPatchSchema>;

export const ResolvedExecutionConfigSchema = z.object({
  provider: ProviderSchema,
  modelId: ModelIdSchema,
  reasoningEffort: ReasoningEffortSchema.optional(),
});
export type ResolvedExecutionConfig = z.infer<typeof ResolvedExecutionConfigSchema>;

export const ConfigErrorCodeSchema = z.enum([
  'provider_unavailable',
  'model_unavailable',
  'reasoning_unsupported',
  'reasoning_unavailable',
  'provider_locked',
  'conversation_busy',
  'revision_conflict',
]);
export type ConfigErrorCode = z.infer<typeof ConfigErrorCodeSchema>;

export const ConfigErrorSchema = z.object({
  code: ConfigErrorCodeSchema,
  message: z.string().min(1),
  provider: ProviderSchema.optional(),
  modelId: ModelIdSchema.optional(),
  validValues: z.array(z.string()).optional(),
});
export type ConfigError = z.infer<typeof ConfigErrorSchema>;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ConfigResolutionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('resolved'),
    catalogRevision: z.string().min(1),
    value: ResolvedExecutionConfigSchema,
  }),
  z.object({
    status: z.literal('unavailable'),
    catalogRevision: z.string().min(1),
    error: ConfigErrorSchema,
    lastResolved: ResolvedExecutionConfigSchema.optional(),
  }),
]);
export type ConfigResolution = z.infer<typeof ConfigResolutionSchema>;

export const RuntimeObservationSchema = z.object({
  reportedModel: z.string().min(1).optional(),
  providerSessionId: z.string().min(1).optional(),
});
export type RuntimeObservation = z.infer<typeof RuntimeObservationSchema>;

export const ConversationConfigStateSchema = z.object({
  config: ConversationConfigSchema,
  revision: z.number().int().nonnegative(),
  resolution: ConfigResolutionSchema,
});
export type ConversationConfigState = z.infer<typeof ConversationConfigStateSchema>;

export const ConversationSessionBindingSchema = z.object({
  provider: ProviderSchema,
  sessionId: z.string().min(1),
});
export type ConversationSessionBinding = z.infer<typeof ConversationSessionBindingSchema>;

export const ConversationLifecycleStatusSchema = z.enum(['active', 'deleted']);
export type ConversationLifecycleStatus = z.infer<typeof ConversationLifecycleStatusSchema>;

export const BuddyContextSchema = z.object({
  buddyId: z.string().min(1),
  workspaceId: z.string().min(1),
  buddyProjectId: z.string().min(1).nullish(),
  legacyWorkItemId: z.string().min(1).nullish(),
  automationRunId: z.string().min(1).nullish(),
  // Set only for Buddy-to-Buddy work. This is employee delegation metadata,
  // not a provider-native subagent/swarm relationship.
  delegatedByBuddyId: z.string().min(1).nullish(),
  parentBuddyConversationId: z.string().uuid().nullish(),
});
export type BuddyContext = z.infer<typeof BuddyContextSchema>;

export const ConversationCreationMetadataSchema = z.object({
  commandId: z.string().min(1).optional(),
  fingerprint: z.string().min(1).optional(),
  initialMessage: z.string().min(1).optional(),
  initialMessageDispatchedAt: z.string().datetime().optional(),
  swarmDebugPrefix: z.string().optional(),
  resumedFromConversationId: z.string().uuid().optional(),
  buddyContext: BuddyContextSchema.optional(),
});
export type ConversationCreationMetadata = z.infer<typeof ConversationCreationMetadataSchema>;

export const PersistedConversationConfigRecordSchema = z.object({
  version: z.literal(1),
  // Provider-native sessions (notably OpenCode) can use opaque non-UUID IDs.
  // Filesystem safety is enforced by the config-store's encoded path mapping.
  conversationId: z.string().min(1),
  // Historical aliases remain indexed for transcript discovery. The session to
  // resume is stored separately so rotation never depends on array ordering.
  sessionBindings: z.array(ConversationSessionBindingSchema),
  currentSession: ConversationSessionBindingSchema.optional(),
  status: ConversationLifecycleStatusSchema.default('active'),
  workingDirectory: z.string().min(1).optional(),
  creation: ConversationCreationMetadataSchema.optional(),
  deletedAt: z.string().datetime().optional(),
  config: ConversationConfigSchema,
  // Internal persistence CAS token. Unlike configRevision, this advances for
  // lifecycle, session, and delivery-marker writes too.
  recordRevision: z.number().int().nonnegative().default(0),
  configRevision: z.number().int().nonnegative(),
  lastResolvedConfig: ResolvedExecutionConfigSchema.optional(),
  provenance: z.enum(['user', 'legacy_inferred', 'external_discovered']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PersistedConversationConfigRecord = z.infer<
  typeof PersistedConversationConfigRecordSchema
>;

export function createDefaultConversationConfig(provider: Provider = 'claude'): ConversationConfig {
  return {
    provider,
    model: { mode: 'default' },
    reasoning: { mode: 'default' },
  };
}

/**
 * Applies selection intent only. Relational validation and resolution are a
 * separate step so hydration can retain explicit values retired by a catalog.
 */
export function applyConversationConfigPatch(
  current: ConversationConfig,
  patch: ConversationConfigPatch
): ConversationConfig {
  switch (patch.kind) {
    case 'replace':
      return patch.config;
    case 'set_provider':
      return {
        provider: patch.provider,
        model: { mode: 'default' },
        reasoning: { mode: 'default' },
      };
    case 'set_model':
      return { ...current, model: patch.model };
    case 'set_reasoning':
      return { ...current, reasoning: patch.reasoning };
  }
}

function unavailable(
  catalogRevision: string,
  error: ConfigError,
  lastResolved?: ResolvedExecutionConfig
): ConfigResolution {
  return {
    status: 'unavailable',
    catalogRevision,
    error,
    ...(lastResolved ? { lastResolved } : {}),
  };
}

/**
 * Resolves durable selection intent into provider-native execution strings.
 * No value is translated or silently substituted.
 */
export function resolveConversationConfig(
  config: ConversationConfig,
  catalog: ProviderCatalog,
  lastResolved?: ResolvedExecutionConfig
): ConfigResolution {
  const provider = findProviderCatalogEntry(catalog, config.provider);
  if (!provider) {
    return unavailable(
      catalog.revision,
      {
        code: 'provider_unavailable',
        message: `Provider is unavailable: ${config.provider}`,
        provider: config.provider,
      },
      lastResolved
    );
  }

  const modelId = config.model.mode === 'default' ? provider.defaultModelId : config.model.modelId;
  const model = findModelDefinition(provider, modelId);
  if (!model) {
    return unavailable(
      catalog.revision,
      {
        code: 'model_unavailable',
        message: `Model is unavailable for ${config.provider}: ${modelId}`,
        provider: config.provider,
        modelId,
        validValues: provider.models.map((candidate) => candidate.id),
      },
      lastResolved
    );
  }

  let reasoningEffort: string | undefined;
  if (config.reasoning.mode === 'explicit') {
    if (!model.reasoning) {
      return unavailable(
        catalog.revision,
        {
          code: 'reasoning_unsupported',
          message: `Reasoning is not supported by ${config.provider}/${modelId}`,
          provider: config.provider,
          modelId,
        },
        lastResolved
      );
    }
    if (!model.reasoning.levels.includes(config.reasoning.effort)) {
      return unavailable(
        catalog.revision,
        {
          code: 'reasoning_unavailable',
          message: `Reasoning effort is unavailable for ${config.provider}/${modelId}: ${config.reasoning.effort}`,
          provider: config.provider,
          modelId,
          validValues: model.reasoning.levels,
        },
        lastResolved
      );
    }
    reasoningEffort = config.reasoning.effort;
  } else if (config.reasoning.mode === 'default') {
    reasoningEffort = model.reasoning?.defaultEffort;
  }

  return {
    status: 'resolved',
    catalogRevision: catalog.revision,
    value: {
      provider: config.provider,
      modelId,
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    },
  };
}

export function validateConversationConfig(
  config: ConversationConfig,
  catalog: ProviderCatalog
): Result<ResolvedExecutionConfig, ConfigError> {
  const resolution = resolveConversationConfig(config, catalog);
  return resolution.status === 'resolved'
    ? { ok: true, value: resolution.value }
    : { ok: false, error: resolution.error };
}

/**
 * Atomic pure transition for creation/update paths. If the candidate cannot
 * resolve, the caller keeps `current` unchanged.
 */
export function transitionConversationConfig(
  current: ConversationConfig,
  patch: ConversationConfigPatch,
  catalog: ProviderCatalog
): Result<ConversationConfig, ConfigError> {
  const candidate = applyConversationConfigPatch(current, patch);
  const validation = validateConversationConfig(candidate, catalog);
  return validation.ok ? { ok: true, value: candidate } : validation;
}
