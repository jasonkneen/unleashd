import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripJsonc, type ModelInfo } from '@unleashd/shared';

// Shared loader for vendor/agent-cli-tool/catalog.jsonc
// Providers use this as primary source; hardcoded fallbacks are only for minimal test env.

function findCatalogPath(): string | null {
  const candidates: string[] = [];
  try {
    // @ts-ignore - import.meta requires es module, but runtime may be cjs/esm
    const metaUrl = (import.meta as unknown as { url?: string })?.url;
    if (metaUrl) {
      const dir = dirname(fileURLToPath(metaUrl));
      candidates.push(join(dir, '../../../vendor/agent-cli-tool/catalog.jsonc'));
      candidates.push(join(dir, '../../vendor/agent-cli-tool/catalog.jsonc'));
      candidates.push(join(dir, '../vendor/agent-cli-tool/catalog.jsonc'));
    }
  } catch {
    // ignore
  }
  candidates.push(join(process.cwd(), 'vendor/agent-cli-tool/catalog.jsonc'));
  candidates.push(join(process.cwd(), '../agent-cli-tool/catalog.jsonc'));
  candidates.push('/Users/nicholasbardy/git/agent-cli-tool/catalog.jsonc');
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

const cache = new Map<string, ModelInfo[]>();

export function loadProviderModels(providerId: string, fallback: ModelInfo[]): ModelInfo[] {
  if (cache.has(providerId)) return cache.get(providerId)!;
  const path = findCatalogPath();
  if (!path) return fallback;
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(stripJsonc(raw)) as {
    providers: Array<{ id: string; models: ModelInfo[] }>;
  };
  const entry = parsed.providers.find((p) => p.id === providerId);
  if (!entry) throw new Error(`${providerId} provider not found in catalog at ${path}`);
  cache.set(providerId, entry.models);
  return entry.models;
}

// Test helper — not used in prod, but useful for resetting between tests if needed
export function __clearCatalogCache(): void {
  cache.clear();
}
