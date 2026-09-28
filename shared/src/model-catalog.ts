import { PROVIDER_MODEL_CATALOG } from './generated/catalog.js';
import type { CatalogProvider, Provider } from './provider-catalog.js';

// =============================================================================
// The generated catalog (vendor/agent-cli-tool/catalog.jsonc → generated/catalog.ts)
// =============================================================================

// Pattern: one-type-source (docs/patterns.md#one-type-source)
// Every model list, label, alias and effort level derives from the generated
// catalog. This replaced a runtime jsonc loader in agent-cli, per-provider
// generated constants and zod enums, a hand-kept label table and two server-side
// overrides of the data (Codex default model, medium effort) — 2026-09-28.
// The generator checks every Provider appears exactly once, so this index is total.
const CATALOG_BY_PROVIDER = Object.fromEntries(
  PROVIDER_MODEL_CATALOG.map((entry) => [entry.id, entry])
) as Record<Provider, CatalogProvider>;

export function catalogEntryForProvider(provider: Provider): CatalogProvider {
  return CATALOG_BY_PROVIDER[provider];
}

// "provider/model" path-style ID for providers that accept ad-hoc models
// (allows additional segments like "openrouter/openai/gpt-5").
const DYNAMIC_MODEL_ID_REGEX = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._:+-]*)+$/i;

/** Collapse a retired/shorthand id onto the current catalog id. */
export function normalizeModelId(provider: Provider, model?: string): string | undefined {
  if (model === undefined) return undefined;
  return catalogEntryForProvider(provider).aliases[model] ?? model;
}

export function isModelIdValidForProvider(provider: Provider, modelId?: string): boolean {
  if (!modelId) return true;
  const entry = catalogEntryForProvider(provider);
  const canonical = entry.aliases[modelId] ?? modelId;
  if (entry.supportsDynamicModels) return DYNAMIC_MODEL_ID_REGEX.test(canonical);
  return entry.models.some((model) => model.id === canonical);
}

// Reasoning-effort values pass through verbatim — never translated. A
// provider's valid set is the union of its models' levels; each CLI does the
// final runtime reject. Omitting the flag is undefined/null, not a level.
const EFFORT_LEVELS_BY_PROVIDER = Object.fromEntries(
  PROVIDER_MODEL_CATALOG.map((entry) => [
    entry.id,
    new Set<string>(
      entry.models.flatMap((model) => model.reasoning?.levels ?? [])
    ) as ReadonlySet<string>,
  ])
) as Record<Provider, ReadonlySet<string>>;

export function isEffortValidForProvider(
  provider: Provider,
  effort: string | null | undefined
): boolean {
  // Both control variants are valid at the boundary: undefined requests the
  // provider/model default, while null explicitly requests no flag.
  if (effort == null) return true;
  return EFFORT_LEVELS_BY_PROVIDER[provider].has(effort);
}
