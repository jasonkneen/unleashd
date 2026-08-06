import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripJsonc, type ModelInfo } from '@unleashd/shared';
import type { Provider } from './index';

// Unified registry: single source is `catalog.jsonc` at agent-cli-tool repo root.
// Both agent-cli-tool (src/catalog.ts) and unleashd (this file) load it via the
// shared stripJsonc helper (shared/src/utils/jsonc.ts) to avoid duplication.
// Harness argv logic (vendor/agent-cli-tool/src/harnesses/opencode.ts) stays separate.

function findCatalogPath(): string | null {
  const candidates: string[] = [];
  try {
    // @ts-ignore - import.meta requires es module, but runtime may be cjs/esm
    const metaUrl = (import.meta as unknown as { url?: string })?.url;
    if (metaUrl) {
      const dir = dirname(fileURLToPath(metaUrl));
      // server/src/providers/opencode.ts -> vendor/agent-cli-tool/catalog.jsonc
      candidates.push(join(dir, '../../../vendor/agent-cli-tool/catalog.jsonc'));
      candidates.push(join(dir, '../../vendor/agent-cli-tool/catalog.jsonc'));
      candidates.push(join(dir, '../vendor/agent-cli-tool/catalog.jsonc'));
    }
  } catch {
    // ignore
  }
  candidates.push(join(process.cwd(), 'vendor/agent-cli-tool/catalog.jsonc'));
  candidates.push(join(process.cwd(), '../agent-cli-tool/catalog.jsonc'));
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

let cached: ModelInfo[] | null = null;

function loadOpencodeModels(): ModelInfo[] {
  if (cached) return cached;
  const path = findCatalogPath();
  if (!path) {
    // Fallback to hardcoded list if catalog not found (e.g., in minimal test env)
    return [
      { id: 'opencode/big-pickle', displayName: 'OpenCode Big Pickle (Free)', isDefault: true },
      { id: 'opencode/gpt-5-nano', displayName: 'OpenCode GPT-5 Nano (Free)', isDefault: false },
      { id: 'opencode/kimi-k2.5-free', displayName: 'OpenCode Kimi K2.5 Free', isDefault: false },
      { id: 'opencode/minimax-m2.5-free', displayName: 'OpenCode MiniMax M2.5 Free', isDefault: false },
      { id: 'meta/muse-spark-1.1', displayName: 'Muse Spark 1.1 (Meta)', isDefault: false },
      { id: 'meta/muse-spark-1.2-contributor', displayName: 'Muse Spark 1.2 Contributor (Meta)', isDefault: false },
    ];
  }
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(stripJsonc(raw)) as {
    providers: Array<{ id: string; models: ModelInfo[] }>;
  };
  const opencode = parsed.providers.find((p) => p.id === 'opencode');
  if (!opencode) throw new Error(`opencode provider not found in catalog at ${path}`);
  cached = opencode.models;
  return cached;
}

const opencodeProvider: Provider = {
  name: 'opencode',

  listModels(): ModelInfo[] {
    return loadOpencodeModels();
  },
};

export default opencodeProvider;
