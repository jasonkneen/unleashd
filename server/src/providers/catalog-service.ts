import crypto from 'node:crypto';
import type {
  ConfigResolution,
  ConversationConfig,
  Provider,
  ProviderCatalog,
  ProviderCatalogEntry,
} from '@unleashd/shared';
import {
  ProviderCatalogSchema,
  defaultReasoningEffortForProvider,
  effortLevelsForProvider,
  getProviderMetadata,
  isModelIdValidForProvider,
  resolveConversationConfig,
} from '@unleashd/shared';
import { providers } from './index';

function catalogRevision(entries: readonly ProviderCatalogEntry[]): string {
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0, 16);
}

function buildProviderEntry(provider: Provider): ProviderCatalogEntry {
  const metadata = getProviderMetadata(provider);
  const models = providers[provider].listModels();
  const defaultModel = models.find((model) => model.isDefault) ?? models[0];
  if (!defaultModel) {
    throw new Error(`Provider '${provider}' has no configured models`);
  }

  const levels = [...effortLevelsForProvider(provider)];
  return {
    id: provider,
    displayName: metadata.label,
    shortName: metadata.shortLabel,
    defaultModelId: defaultModel.id,
    supportsDynamicModels: provider === 'opencode',
    models: models.map((model) => {
      const defaultEffort = defaultReasoningEffortForProvider(provider, model.id);
      return {
        id: model.id,
        displayName: model.displayName,
        ...(levels.length === 0
          ? {}
          : {
              reasoning: {
                levels,
                ...(defaultEffort === undefined ? {} : { defaultEffort }),
              },
            }),
      };
    }),
  };
}

function buildProviderCatalog(): ProviderCatalog {
  const entries = (Object.keys(providers) as Provider[]).map(buildProviderEntry);
  return ProviderCatalogSchema.parse({
    revision: catalogRevision(entries),
    providers: entries,
  });
}

let cachedCatalog: ProviderCatalog | undefined;

/**
 * Returns the current provider capabilities snapshot. Provider discovery is
 * centralized here so config resolution and API consumers always observe the
 * same revision.
 */
export function createProviderCatalog(): ProviderCatalog {
  cachedCatalog ??= buildProviderCatalog();
  return cachedCatalog;
}

export function refreshProviderCatalog(): ProviderCatalog {
  cachedCatalog = buildProviderCatalog();
  return cachedCatalog;
}

/**
 * Dynamic providers keep opaque IDs off the closed dropdown catalog. For
 * validation/resolution, add a request-local model definition after the
 * provider adapter accepts the ID. The shared resolver stays pure.
 */
function catalogForConfig(catalog: ProviderCatalog, config: ConversationConfig): ProviderCatalog {
  if (config.model.mode !== 'explicit') return catalog;
  const modelId = config.model.modelId;
  const entry = catalog.providers.find((provider) => provider.id === config.provider);
  if (!entry?.supportsDynamicModels) return catalog;
  if (entry.models.some((model) => model.id === modelId)) return catalog;
  if (!isModelIdValidForProvider(config.provider, modelId)) return catalog;

  return {
    ...catalog,
    providers: catalog.providers.map((provider) =>
      provider.id === config.provider
        ? {
            ...provider,
            models: [
              ...provider.models,
              {
                id: modelId,
                displayName: modelId,
              },
            ],
          }
        : provider
    ),
  };
}

export function resolveConfigAgainstProviderCatalog(
  config: ConversationConfig,
  lastResolved?: Extract<ConfigResolution, { status: 'resolved' }>['value']
): ConfigResolution {
  const catalog = createProviderCatalog();
  return resolveConversationConfig(config, catalogForConfig(catalog, config), lastResolved);
}
