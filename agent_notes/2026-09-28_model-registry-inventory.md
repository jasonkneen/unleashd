# Model registry inventory (2026-09-28)

Trigger: owner asked to add Sonnet 5.5 and whether we have a model registry both here and in
the shared agent-cli lib, and whether it can be deslopped.

Sonnet 5.5 landed as `claude-sonnet-5-5` ("Sonnet 5.5"): submodule d57ec47, outer eefe240
(neither pushed). The `sonnet` alias entry is kept because stored conversations reference it.

## One data file, six code layers

| # | File | Lines | What it does | Problem |
|---|---|---|---|---|
| 1 | `vendor/agent-cli-tool/catalog.jsonc` | 108 | The data. Real source of truth. | fine |
| 2 | `vendor/agent-cli-tool/src/catalog.ts` | 98 | Runtime loader: 7-path guessing, own JSONC stripper, hand types, `loadCatalog/getProvider/listModels/isModelInCatalog` | no caller in vendor src or unleashd; stale comment says stripJsonc is imported from shared |
| 3 | `shared/scripts/gen-catalog.ts` | 190 | Codegen → `shared/src/generated/catalog.ts` | second JSONC stripper + second copy of the types; emits 8 legacy per-provider constants plus the full `PROVIDER_MODEL_CATALOG` |
| 4 | `shared/src/index.ts` (~lines 60-260) | ~200 | Re-exports, per-provider zod enums, Codex reshape (`id` → `modelName`), Cursor aliases, effort unions, `isModelIdValidForProvider` switch | most legacy constants are referenced only inside index.ts itself |
| 5 | `shared/src/provider-catalog.ts` | 141 | Third schema (zod) + `PROVIDER_METADATA` | label/shortName duplicate jsonc `displayName/shortName` |
| 6 | `server/src/providers/catalog-service.ts` | 111 | Rebuilds the catalog for the wire | **hidden overrides**: Codex default hardcoded to `gpt-6-sol` (jsonc says `gpt-5.6-sol`); every model's default effort rewritten to `medium` when available (jsonc says high/xhigh/ultra) |
| 7 | `server/src/providers/index.ts` `listModels()` + `/api/.../models` | 53 | Second model-list path beside the catalog service | parallel read path |

## Lean target

- jsonc is the only data. Put the app choices (Codex default, medium effort) IN the jsonc,
  not in server code.
- One generator emits `PROVIDER_MODEL_CATALOG` typed by the shared zod schema; delete the
  per-provider constants and the Codex `modelName` reshape.
- Model validation = "is id in the provider's catalog entry" (plus opencode's dynamic
  `provider/model` shape): one function, no per-provider enum switch.
- Delete `vendor/src/catalog.ts` or make it the only loader the generator uses.
- One read path to the client: the catalog service; drop `Provider.listModels()`.

Estimated: ~500 lines out of ~900, no behaviour change once the two overrides are moved into data.

## Outcome (2026-09-28, owner said "go", keep gpt-6-sol + medium)

Done as planned. Data: `catalog.jsonc` now carries the Codex default (`gpt-6-sol`),
medium default effort, and Cursor aliases; `isDefault` dropped. Code:
- deleted `vendor/agent-cli-tool/src/catalog.ts`, `server/src/providers/index.ts`,
  `GET /api/models` (no client caller), the always-true `isProviderAvailable` port;
- `shared/src/index.ts` registry block (~236 lines of per-provider constants,
  enums, Codex `modelName` reshape) → `shared/src/model-catalog.ts` (~60 lines);
- `PROVIDER_METADATA` / `getProviderMetadata` / `PROVIDER_OPTIONS` → catalog
  `displayName` / `shortName` and `ProviderSchema.options`;
- generator parses with the shared zod schemas and checks provider completeness
  and alias targets; emits one `PROVIDER_MODEL_CATALOG`.

Bug found on the way: `shared` `check:catalog` ran `git diff -- shared/src/...`
from inside `shared/`, so the pathspec matched nothing and the CI drift check
always passed. Now `src/generated/catalog.ts`.
