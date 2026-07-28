# Final Architecture Plan — Conversation Configuration

Date: 2026-07-28

Status: canonical synthesis

Supersedes the design choices in:

- `2026-07-28-plan-a-persisted-conversation-config.md`
- `2026-07-28-plan-b-incremental-boundary-cleanup.md`

Those documents remain useful as independent reviews and alternative migration
strategies. This document is the implementation contract.

---

## 1. Decision

Conversation configuration will be modeled as durable user intent, not as
already-resolved CLI arguments.

The application will keep three concepts separate:

1. **Selection** — what the user chose.
2. **Resolution** — the concrete provider/model/effort to use for a turn.
3. **Observation** — what a native provider session reports after execution.

The central types are:

```ts
type ModelSelection =
  | { mode: 'default' }
  | { mode: 'explicit'; modelId: string };

type ReasoningSelection =
  | { mode: 'default' }
  | { mode: 'disabled' }
  | { mode: 'explicit'; effort: string };

interface ConversationConfig {
  provider: Provider;
  model: ModelSelection;
  reasoning: ReasoningSelection;
}

interface ResolvedExecutionConfig {
  provider: Provider;
  modelId: string;
  reasoningEffort?: string;
}

type ConfigResolution =
  | {
      status: 'resolved';
      catalogRevision: string;
      value: ResolvedExecutionConfig;
    }
  | {
      status: 'unavailable';
      catalogRevision: string;
      error: ConfigError;
      lastResolved?: ResolvedExecutionConfig;
    };

interface RuntimeObservation {
  reportedModel?: string;
  providerSessionId?: string;
}
```

Provider-specific values remain plain strings. The application does not invent a
cross-provider effort vocabulary or translate provider-native values.

### 1.1 End-to-end flow

```text
user edits selection
        │
        ▼
ConversationConfigDraft
        │  parsed structurally
        ▼
set_conversation_config(commandId, expectedRevision, patch)
        │
        ▼
config-service
  ├─ checks lifecycle
  ├─ applies pure transition
  ├─ validates against provider catalog
  ├─ resolves current effective configuration
  └─ persists the complete selection atomically
        │
        ▼
ConversationConfigState
  ├─ config             user intent
  ├─ revision           concurrency
  └─ resolution         current catalog interpretation
        │
        ├──────────────► authoritative client snapshot
        │
        ▼
turn start
  ├─ resolve again against current catalog
  ├─ freeze ResolvedExecutionConfig
  └─ pass opaque strings to agent-cli
        │
        ▼
RuntimeObservation      provider-reported facts
```

---

## 2. Why model selection must also be explicit

The previous proposals made reasoning intent explicit but kept `model` as a
concrete ID. That solves most effort bugs but leaves “provider default model”
ambiguous.

The UI currently displays a concrete default while sometimes submitting
`undefined`. The server then materializes a concrete model. A future change to the
provider default cannot distinguish:

- a user who explicitly chose the old model;
- a user who chose “provider default.”

`ModelSelection` removes that ambiguity.

Expected behavior:

| Model selection | Registry default changes | Effective model |
|---|---|---|
| `default` | Sol → a future model | follows new default |
| `explicit: Sol` | Sol → a future model | remains Sol if still valid |

If reproducibility is required, store the last resolved execution configuration
for audit. Do not erase selection intent by pinning the default selection.

---

## 3. Non-negotiable invariants

### Configuration

1. Every server-owned conversation has one structurally valid
   `ConversationConfig`. Historical explicit selections may be unavailable in the
   current provider catalog without preventing transcript hydration.
2. Configuration is persisted before a create/update acknowledgement is emitted.
3. Provider/model/reasoning changes are validated and committed atomically.
4. No React component and no `Conversation` constructor applies defaults.
5. Effective CLI arguments are derived by one pure resolver immediately before a
   turn starts. An unavailable configuration rejects the turn rather than
   silently changing the selection.
6. A model change affects reasoning only when reasoning mode is `default`.
7. Provider-native session files are not the authority for application
   configuration.
8. Provider-reported model names never overwrite user selection.

### Lifecycle

9. Provider can change only while a conversation is pristine.
10. Model/reasoning can change only between turns when the queue is empty.
11. Configuration cannot change while a turn is running.
12. All connected clients receive create, update, and delete lifecycle events.
13. A stale configuration revision never overwrites a newer revision.

### Client

14. Pending creation is a separate client entity, not a schema-incomplete fake
    `Conversation`.
15. Client controls edit selection intent and never guess effective defaults.
16. One provider catalog and one picker implementation drive modal and header UI.

### CLI boundary

17. The shared CLI receives opaque `model` and `reasoningEffort` strings.
18. Legacy composite parsing exists only in a named migration adapter.
19. Production package entry points reference compiled JavaScript, not TypeScript.

---

## 4. Shared data model

Create `shared/src/conversation-config.ts`.

### 4.1 Schemas

```ts
import { z } from 'zod';

export const ModelSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('default'),
  }),
  z.object({
    mode: z.literal('explicit'),
    modelId: z.string().min(1),
  }),
]);

export const ReasoningSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('default'),
  }),
  z.object({
    mode: z.literal('disabled'),
  }),
  z.object({
    mode: z.literal('explicit'),
    effort: z.string().min(1),
  }),
]);

export const ConversationConfigSchema = z.object({
  provider: ProviderSchema,
  model: ModelSelectionSchema,
  reasoning: ReasoningSelectionSchema,
});

export const ConversationConfigPatchSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('replace'),
    config: ConversationConfigSchema,
  }),
  z.object({
    kind: z.literal('set_provider'),
    provider: ProviderSchema,
  }),
  z.object({
    kind: z.literal('set_model'),
    model: ModelSelectionSchema,
  }),
  z.object({
    kind: z.literal('set_reasoning'),
    reasoning: ReasoningSelectionSchema,
  }),
]);
```

The wire schema accepts provider-bespoke values as strings. Validity is checked
against the selected provider catalog after parsing.

### 4.2 Why expose a patch union instead of a partial object

Avoid:

```ts
type ConfigPatch = Partial<ConversationConfig>;
```

A generic partial object permits ambiguous combinations and unclear transition
semantics. A discriminated command describes the user action.

The server still commits a complete configuration atomically.

### 4.3 Domain results

Do not use thrown Zod errors as the domain API.

```ts
export type ConfigErrorCode =
  | 'provider_unavailable'
  | 'model_unavailable'
  | 'reasoning_unsupported'
  | 'reasoning_unavailable'
  | 'provider_locked'
  | 'conversation_busy'
  | 'revision_conflict';

export interface ConfigError {
  code: ConfigErrorCode;
  message: string;
  provider?: Provider;
  modelId?: string;
  validValues?: readonly string[];
}

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Errors are structured for tests and UI behavior. Human-readable messages remain
available without parsing strings.

### 4.4 Model and effort value types

After migration, remove the closed cross-provider `ModelIdSchema` union from the
wire contract.

Use opaque strings:

```ts
export const ModelIdSchema = z.string().min(1);
export type ModelId = z.infer<typeof ModelIdSchema>;

export const ReasoningEffortSchema = z.string().min(1);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;
```

Closed literal constants may still exist inside a static provider definition for
editor support. They are not the universal wire type.

Zod handles structural parsing. The catalog service handles relational validity:

```text
string is structurally a model ID
  + provider catalog says whether it is valid for this provider
```

Do not use assertions such as `as ModelId` to bypass catalog validation.

---

## 5. Provider catalog

The current global `ModelIdSchema` makes invalid provider/model combinations
representable and requires schema edits for closed provider catalogs. Replace
cross-provider model validation with a runtime catalog.

### 5.1 Shared catalog schema

Create `shared/src/provider-catalog.ts`.

```ts
export const ModelDefinitionSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  reasoning: z
    .object({
      levels: z.array(z.string().min(1)),
      defaultEffort: z.string().min(1).optional(),
    })
    .optional(),
});

export const ProviderCatalogEntrySchema = z.object({
  id: ProviderSchema,
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  models: z.array(ModelDefinitionSchema),
  defaultModelId: z.string().min(1),
  supportsDynamicModels: z.boolean().default(false),
});

export const ProviderCatalogSchema = z.object({
  revision: z.string().min(1),
  providers: z.array(ProviderCatalogEntrySchema),
});
```

Catalog invariants are validated once:

- unique provider IDs;
- unique model IDs within a provider;
- default model exists;
- default reasoning value is included in the model’s level list;
- providers without reasoning expose no reasoning defaults.

### 5.2 Static and dynamic providers

Static catalogs for Claude, Codex, Gemini, and Cursor live in server provider
definitions and can be tested as constants.

OpenCode may expose dynamic `provider/model` identifiers. Its catalog entry can:

- return discovered models;
- set `supportsDynamicModels: true`;
- validate an explicit model through the provider adapter when it is not already
  in the cached list.

Do not force OpenCode into a closed global union.

### 5.3 Server catalog service

Create `server/src/providers/catalog-service.ts`.

```ts
interface ProviderAdapter {
  id: Provider;
  getCatalogEntry(): Promise<ProviderCatalogEntry>;
  validateDynamicModel?(modelId: string): Promise<boolean>;
}

interface ProviderCatalogService {
  getCatalog(): Promise<ProviderCatalog>;
  getProvider(provider: Provider): Promise<ProviderCatalogEntry>;
  validateConfig(config: ConversationConfig): Promise<Result<void, ConfigError>>;
  resolve(config: ConversationConfig): Promise<ConfigResolution>;
}
```

`/api/provider-catalog` returns the validated catalog. Keep `/api/models` as a
temporary compatibility endpoint implemented from the same service.

### 5.4 Resolution rules

```ts
async function resolveConversationConfig(
  config: ConversationConfig,
  catalog: ProviderCatalogService
): Promise<ConfigResolution>;
```

Rules:

1. Resolve model:
   - default → provider `defaultModelId`;
   - explicit → specified opaque ID.
2. Validate model for provider.
3. Resolve reasoning:
   - disabled → omit the flag;
   - explicit → validate against selected model and pass verbatim;
   - default → use selected model’s `defaultEffort`, otherwise omit.
4. Return a new immutable resolved result.

An explicit model can disappear from a later catalog. Historical conversations
remain loadable with `status: 'unavailable'`, the last resolved value is shown for
context, and a new turn is rejected until the user selects a valid configuration.
Never silently substitute the new default for an explicit retired model.

No aliases or translations occur here, except provider-specific model
normalization explicitly owned by the provider adapter.

### 5.5 Dependency direction

The catalog must not become another monolith.

```text
shared schemas + pure transitions
              ▲
              │
server provider adapters ──► catalog service ──► API/config service
              │
              └───────────────────────────────► CLI invocation

client ──► shared schemas
client ──► server catalog snapshot over HTTP

agent-cli ──► no dependency on product shared package
```

Rules:

- `shared` contains no filesystem, HTTP, React, or provider CLI imports.
- Each server provider adapter owns only discovery/normalization facts unique to
  that provider.
- `catalog-service` composes adapters; it does not contain provider conditionals.
- Client components never import server provider modules.
- The shared CLI remains independently publishable and does not import the
  application catalog.
- Disk adapters return observations and transcripts, never `ConversationConfig`.

---

## 6. Conversation snapshot types

The server snapshot becomes:

```ts
interface Conversation {
  id: string;
  sessionId?: string;
  messages: Message[];
  isRunning: boolean;
  isStreaming: boolean;
  createdAt: Date;
  workingDirectory: string;

  config: ConversationConfig;
  configRevision: number;
  configResolution: ConfigResolution;
  reportedModel?: string;

  // Existing queue, subagent, swarm, merge, and lifecycle fields.
}
```

### 6.1 Why include `configResolution`

The client needs to display what “Default” currently means without independently
resolving server policy.

`configResolution` is:

- read-only;
- derived by the server;
- recomputed when catalog/config changes;
- not accepted from client commands;
- useful for audit and UI labels;
- able to represent a retired or temporarily unavailable explicit model without
  making the entire conversation invalid.

The client displays:

- selection: “Default”;
- current resolution: “GPT-5.6 Sol · Ultra.”

A catalog revision can change the resolution of a default selection without
changing `configRevision`. On catalog refresh, the server recomputes resolution
and emits `conversation_updated` with reason `catalog`. Explicit unavailable
selections remain unavailable.

### 6.2 Remove ambiguous fields

After compatibility:

- remove `reasoningEffort` from the conversation snapshot;
- remove configured top-level `model`;
- replace `modelName` with `reportedModel`;
- remove client-only `confirmed` from the server-owned schema.

During migration, deprecated flattened fields are derived from the resolved value
or the last resolved audit value, never treated as authority.

---

## 7. Durable application configuration

Provider-native files own transcript/session facts. The application owns
configuration.

Create `server/src/conversations/config-store.ts`.

### 7.1 Record

```ts
export const PersistedConversationConfigRecordSchema = z.object({
  version: z.literal(1),
  conversationId: z.string().uuid(),
  sessionBindings: z.array(
    z.object({
      provider: ProviderSchema,
      sessionId: z.string().min(1),
    })
  ),
  config: ConversationConfigSchema,
  configRevision: z.number().int().nonnegative(),
  lastResolvedConfig: ResolvedExecutionConfigSchema.optional(),
  provenance: z.enum(['user', 'legacy_inferred', 'external_discovered']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

New conversations begin at `configRevision: 0`. Every successful user
configuration transaction increments it exactly once. Catalog refresh does not
increment it because user intent did not change.

### 7.2 Storage layout

Use a stable conversation-ID record as authority:

```text
<app-data>/conversation-config/v1/by-conversation/<conversation-id>.json
```

Maintain a small session binding index:

```text
<app-data>/conversation-config/v1/by-session/<provider>/<encoded-session-id>.json
```

The session index contains only the conversation ID. This handles provider session
ID changes without duplicating the record.

Do not make a provider session ID the primary filename.

The session index is derived and rebuildable. Failure to update it after the
authoritative record is committed must be recoverable by scanning validated
conversation records; it must not corrupt the primary record.

### 7.3 Write protocol

For each conversation:

1. acquire an in-process keyed mutex;
2. read and validate current revision;
3. validate the proposed complete config;
4. resolve its effective config;
5. write a temp record in the same directory;
6. `fsync` if the project’s durability requirements justify it;
7. rename atomically;
8. update session indexes;
9. update memory;
10. broadcast.

If persistence fails, memory and client state remain unchanged.

### 7.4 Corruption and future versions

- Move corrupt records to a timestamped quarantine directory.
- Continue loading the transcript using conservative legacy inference.
- Emit one structured warning per corrupt record.
- Never overwrite an unsupported future version.

---

## 8. Legacy hydration

Create `server/src/conversations/legacy-config-migration.ts`.

It is the only module allowed to decode old composite Codex IDs or infer missing
configuration.

### 8.1 Mapping

| Legacy evidence | New selection |
|---|---|
| recognized composite Codex model | explicit base model + explicit effort |
| recognized base model, no effort evidence | explicit model + disabled reasoning |
| Claude session, no sidecar effort | explicit/default inferred model + disabled reasoning |
| unknown reported model | provider default selection + diagnostic |
| valid sidecar | use sidecar; native model remains observation only |

Unknown effort maps to disabled because that preserves current resumed CLI
behavior. Mapping it to default would silently add a flag.

### 8.2 Provenance

Keep provenance in persistence metadata, not in `ReasoningSelection`.

`ReasoningSelection` should answer what the next turn will do. It should not carry
historical uncertainty after migration has chosen deterministic behavior.

### 8.3 First migration write

When an external/native-only session is first hydrated:

- derive deterministic config;
- persist it with `provenance: legacy_inferred` or `external_discovered`;
- subsequent restarts become stable.

---

## 9. Server domain service

Create `server/src/conversations/config-service.ts`.

```ts
interface ConversationConfigState {
  config: ConversationConfig;
  revision: number;
  resolution: ConfigResolution;
}

interface ConfigUpdateContext {
  isRunning: boolean;
  queueDepth: number;
  hasStartedSession: boolean;
}

interface ConfigUpdateCommand {
  conversationId: string;
  commandId: string;
  expectedRevision: number;
  patch: ConversationConfigPatch;
}

interface ConfigUpdateSuccess {
  commandId: string;
  previous: ConversationConfigState;
  next: ConversationConfigState;
}
```

Public methods:

```ts
create(input: NewConversationConfigInput): Promise<ConversationConfigState>;
hydrate(session: ParsedSession): Promise<HydratedConversationConfig>;
fork(source: ConversationConfigState): Promise<ConversationConfigState>;
update(
  current: ConversationConfigState,
  context: ConfigUpdateContext,
  command: ConfigUpdateCommand
): Promise<Result<ConfigUpdateSuccess, ConfigError>>;
resolve(config: ConversationConfig): Promise<ConfigResolution>;
```

Creation and user-initiated updates require a resolved result. Hydration may
produce an unavailable result so historical transcripts remain accessible. Turn
execution also requires a resolved result and returns the structured resolution
error otherwise.

### 9.1 Transition rules

Provider change:

- allowed only when `hasStartedSession === false`;
- resets model to default mode;
- resets reasoning to default mode.

Model change:

- rejected while running or queue is non-empty;
- default reasoning remains default and resolves for the new model;
- disabled remains disabled;
- explicit effort must validate for the new model or the entire update rejects.

Reasoning change:

- rejected while running or queue is non-empty;
- explicit value validates for the resolved model.

No transition silently rewrites an explicit selection.

Fork behavior:

- copy selection intent exactly;
- assign revision `0` to the new conversation;
- require the copied config to resolve before starting the fork;
- if it is unavailable, ask for a new selection rather than silently defaulting.

---

## 10. Conversation construction

Replace raw constructor modes with factories:

```ts
class Conversation {
  private constructor(input: ValidatedConversationState) {}

  static async createNew(...): Promise<Conversation>;
  static async hydrate(...): Promise<Conversation>;
  static async forkFrom(...): Promise<Conversation>;
}
```

Factories obtain a validated config state from `config-service`.

Delete:

- `applyReasoningDefault`;
- `defaultModelForProvider` from `server.ts`;
- post-construction default assignment;
- direct provider/model/reasoning constructor arguments;
- direct mutation by WebSocket handlers.

### 10.1 Spawn flow

```text
queue selects next message
  → assert conversation not already running
  → resolve config through config service/catalog
  → reject clearly if resolution is unavailable
  → freeze ResolvedExecutionConfig for this turn
  → build ExecuteCommandRequest
  → run CLI
  → record RuntimeObservation separately
```

The frozen resolved config may be attached to the assistant message or turn audit
record later. It must not be mutated mid-turn.

---

## 11. WebSocket protocol

### 11.1 Commands

```ts
interface CreateConversationCommand {
  type: 'create_conversation';
  commandId: string;
  conversationId: string;
  workingDirectory: string;
  config: ConversationConfig;
  swarmDebugPrefix?: string;
  resumedFromConversationId?: string;
}

interface SetConversationConfigCommand {
  type: 'set_conversation_config';
  commandId: string;
  conversationId: string;
  expectedRevision: number;
  patch: ConversationConfigPatch;
}
```

Use client-generated `commandId` for acknowledgement correlation. Keep
conversation IDs stable across optimistic creation and server confirmation.

### 11.2 Server events

```ts
interface ConversationCreatedEvent {
  type: 'conversation_created';
  commandId: string;
  conversation: Conversation;
}

interface ConversationUpdatedEvent {
  type: 'conversation_updated';
  commandId?: string;
  reason: 'config' | 'catalog' | 'status' | 'queue' | 'messages' | 'external_refresh';
  conversation: Conversation;
}

interface ConversationDeletedEvent {
  type: 'conversation_deleted';
  commandId?: string;
  conversationId: string;
}

interface CommandRejectedEvent {
  type: 'command_rejected';
  commandId: string;
  conversationId?: string;
  error: ConfigError | GeneralCommandError;
  authoritativeConversation?: Conversation;
}
```

All are broadcast as appropriate. `commandId` lets the initiating client retire
pending UI state without giving lifecycle events hidden side effects.

### 11.3 Full snapshots first

Continue broadcasting full conversation snapshots.

Do not add patches, JSON Patch, event sourcing, or general server revisions in
this refactor. `configRevision` protects the only concurrently edited aggregate
being redesigned.

### 11.4 Protocol versioning

Add to `init`:

```ts
interface ProtocolInfo {
  version: 2;
  capabilities: readonly [
    'conversation_config',
    'conversation_updated',
    'structured_command_errors',
  ];
}
```

The bundled client and server deploy together, so v2 can switch atomically.

For documented external clients:

- accept legacy create/setter commands for one release;
- convert them immediately into v2 domain commands;
- expose deprecated flattened snapshot fields;
- do not emit two semantically different update events for every mutation;
- reject an unsupported protocol explicitly rather than guessing client behavior.

Remove the legacy command adapter on a scheduled version boundary.

---

## 12. Client state

Do not insert incomplete conversation-shaped stubs into the authoritative map.

```ts
interface ConversationsState {
  conversations: Map<string, Conversation>;
  pendingCreations: Map<string, PendingConversationCreation>;
  pendingConfigCommands: Map<string, PendingConfigCommand>;
  streamingContent: Map<string, string>;
}

interface PendingConversationCreation {
  commandId: string;
  conversationId: string;
  workingDirectory: string;
  config: ConversationConfig;
  createdAt: Date;
  error?: string;
}
```

Derived views can merge confirmed conversations and pending creation cards without
weakening `ConversationSchema`.

### 12.1 Configuration optimism

Recommendation: do not optimistically mutate confirmed configuration.

Configuration changes are low frequency. Keep a pending indicator on the control,
send the command, and apply the authoritative snapshot.

This removes rollback branches and revision races.

If optimistic behavior is later required, store a separate pending overlay:

```ts
interface PendingConfigCommand {
  commandId: string;
  conversationId: string;
  baseRevision: number;
  proposedConfig: ConversationConfig;
}
```

Never overwrite the authoritative entity before acknowledgement.

### 12.2 Pending persistence

Version localStorage:

```ts
interface PendingCreationStoreV2 {
  version: 2;
  creations: PendingConversationCreation[];
}
```

Migration:

- missing legacy effort → default for an unsent creation;
- null → disabled;
- string → explicit;
- legacy concrete model → explicit;
- missing model → default.

Pending records are deleted only by matching creation acknowledgement, explicit
cancel, or expiration.

---

## 13. Client UI design

Create:

- `client/src/hooks/useProviderCatalog.ts`
- `client/src/domain/conversation-config-draft.ts`
- `client/src/components/ConversationConfigPicker.tsx`
- optionally `client/src/components/ChatHeaderControls.tsx`

### 13.1 Draft

```ts
interface ConversationConfigDraft {
  provider: Provider;
  model: ModelSelection;
  reasoning: ReasoningSelection;
}

function createDefaultDraft(provider: Provider): ConversationConfigDraft;
function applyDraftPatch(
  draft: ConversationConfigDraft,
  patch: ConversationConfigPatch,
  catalog: ProviderCatalog
): Result<ConversationConfigDraft, ConfigError>;
```

Initialize the entire draft synchronously before opening a modal.

### 13.2 Picker

One picker renders:

- provider;
- model selection, including “Provider default (Sol)”;
- reasoning selection:
  - “Model default (Ultra)”;
  - “No reasoning flag”;
  - explicit provider-native levels.

Use `useId()` for radio group names.

The picker receives parsed catalog data. It does not fetch.

### 13.3 Catalog hook

`useProviderCatalog`:

- fetches one endpoint;
- validates with `ProviderCatalogSchema`;
- caches by catalog revision;
- exposes loading/error/retry;
- aborts stale requests.

No Codex UI special case exists.

### 13.4 Actions

Replace positional creation:

```ts
createConversation({
  workingDirectory,
  config,
  swarmDebugPrefix,
  resumedFromConversationId,
});
```

Replace three setter actions with:

```ts
setConversationConfig({
  conversationId,
  expectedRevision,
  patch,
});
```

---

## 14. Shared CLI contract

The product owns validation. The shared CLI owns flag construction.

```ts
interface CodexExecuteCommandRequest {
  harness: 'codex';
  model?: string;
  reasoningEffort?: string;
  // Other execution fields.
}
```

`reasoningEffort` remains pass-through.

### 14.1 Public convenience constants

If the CLI exports typed convenience levels, derive them:

```ts
export const CODEX_REASONING_LEVELS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
] as const;

export type CodexReasoningLevel =
  (typeof CODEX_REASONING_LEVELS)[number];
```

The canonical execute request can still accept `string` to preserve the thin
pass-through boundary.

### 14.2 Legacy composite adapter

Create `shared/src/legacy/codex-composite-model.ts`.

Only migration code imports it. The CLI harness must not infer effort from a
current opaque model ID.

Delete the compatibility adapter after persisted-session evidence shows it is no
longer required.

---

## 15. Package and build design

Post-compile string rewriting and production TS transpilation are temporary
workarounds, not the final architecture.

### 15.1 Library outputs

Both `@unleashd/shared` and `@nbardy/agent-cli` publish compiled JavaScript and
declarations.

Example:

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"]
}
```

Agent CLI `bin` points to compiled JavaScript.

### 15.2 Delete

- `tools/patch-server-dist-shared-imports.cjs`;
- production `tsx/cjs` preloads;
- TypeScript source package entry points;
- runtime `tsx` dependency if unused elsewhere.

### 15.3 Release contract

1. build/test/pack `@nbardy/agent-cli`;
2. install its tarball into a clean fixture;
3. build root against an explicit published/tarball version;
4. pack root;
5. install root tarball outside the workspace;
6. execute binary smoke tests.

Declare `engines.node` and test minimum/current supported Node.

---

## 16. File plan

### Create

```text
shared/src/provider-catalog.ts
shared/src/conversation-config.ts
shared/src/legacy/codex-composite-model.ts

server/src/providers/catalog-service.ts
server/src/conversations/config-store.ts
server/src/conversations/config-service.ts
server/src/conversations/legacy-config-migration.ts
server/src/conversations/config-ws-handler.ts

client/src/hooks/useProviderCatalog.ts
client/src/domain/conversation-config-draft.ts
client/src/components/ConversationConfigPicker.tsx
client/src/atoms/config-actions.ts
```

Optional only if it materially shrinks `Chat.tsx`:

```text
client/src/components/ChatHeaderControls.tsx
```

### Modify

```text
shared/src/index.ts
server/src/server.ts
server/src/adapters/disk-adapter.ts
server/src/adapters/loader.ts
server/src/providers/index.ts
client/src/atoms/actions.ts
client/src/atoms/conversations.ts
client/src/components/Sidebar.tsx
client/src/components/Chat.tsx
client/src/components/ProviderModelPicker.tsx
vendor/agent-cli-tool/src/runtime-types.ts
vendor/agent-cli-tool/src/harnesses/codex.ts
vendor/agent-cli-tool/test/build.test.ts
package.json and package build manifests
```

### Delete after migration

```text
server/src/providers/model-validation.ts
client/src/components/ProviderModelPicker.tsx
tools/patch-server-dist-shared-imports.cjs
shared compatibility exports/helpers
generic CLI composite decomposition
```

Provider files should be deleted only if they contain no server-only adapter
behavior after catalog extraction.

---

## 17. Implementation sequence

Each phase should be a separate, revertible PR.

### PR 1 — Characterization and immediate contract fixes

- fix CLI `max`/`ultra` public type;
- add root test orchestration;
- add transition/restart/multi-client/package smoke characterization;
- make no schema migration yet.

### PR 2 — Shared catalog and pure config domain

- add catalog/config schemas;
- move duplicated effort/model definitions;
- add pure transition/resolution matrix;
- retain old exports as aliases.

### PR 3 — Client draft and unified catalog consumption

- introduce catalog hook and config draft;
- fix modal initialization and radio grouping;
- object-argument creation API;
- keep legacy wire conversion at the action boundary.

This reduces client races before server persistence changes.

### PR 4 — Versioned configuration sidecar

- add store and migration adapter;
- dual-read/dual-write;
- preserve existing flattened snapshot fields;
- test real restart/resume.

### PR 5 — Conversation config state and factories

- migrate runtime to config/revision/resolved/reported fields;
- add named factories;
- remove constructor default mode;
- resolve only at spawn.

### PR 6 — Atomic revisioned config command

- add structured command/result events;
- delegate legacy setters;
- reject running/queued changes;
- broadcast create/update/delete to all clients.

### PR 7 — Unified picker and authoritative client updates

- modal and header share picker;
- separate pending creations from confirmed entities;
- remove optimistic configuration mutation;
- consume new event vocabulary.

### PR 8 — CLI compatibility isolation

- opaque model/effort handling;
- move composite migration to application layer;
- remove application catalog copies from CLI tests.

### PR 9 — Compiled package boundaries

- compile library and binary outputs;
- remove TS runtime hooks and import rewriting;
- clean-install smoke and Node matrix.

### PR 10 — Compatibility deletion

- remove legacy fields/messages/converters;
- remove old picker and validation re-export;
- reduce `shared/index.ts`, `server.ts`, `Chat.tsx`, and actions;
- update protocol and architecture docs.

---

## 18. Test architecture

### Shared domain matrix

For every provider/model:

- catalog validity;
- default model resolution;
- default reasoning resolution;
- disabled reasoning;
- each explicit accepted value;
- explicit rejected value;
- provider transition;
- model transition under all reasoning modes.

### Persistence

- round-trip every selection mode;
- revision increments;
- atomic failure leaves memory unchanged;
- corrupt record quarantine;
- unsupported future version;
- session binding rotation;
- concurrent serialized writes;
- real process restart.

### Server integration

- create → turn → restart → resume retains selection;
- Sol default → Terra resolves `xhigh`;
- Terra default → Sol resolves `ultra`;
- fixed effort remains fixed when valid;
- invalid fixed effort/model pair rejects atomically;
- disabled remains disabled;
- active/queued update rejects;
- stale revision rejects with authoritative snapshot;
- two clients receive create/update/delete;
- legacy command delegation.

### Adapter migration

- legacy composite → explicit model/effort;
- base-only → disabled;
- invalid cross-provider reported model remains observation;
- sidecar wins over inferred native facts;
- native-only external session gets a durable inferred record.

### Client

- synchronous modal initialization;
- default and explicit model remain visually distinct;
- default/disabled/explicit reasoning remain distinct;
- two simultaneous pickers have independent controls;
- stale catalog request abort;
- pending creation V1→V2 migration;
- update acknowledgement correlation;
- controls disabled while busy.

### CLI

- arbitrary model passes unchanged;
- arbitrary reasoning passes unchanged;
- `gpt-example-ultra` is not decomposed;
- create/resume construct correct flags;
- `max`/`ultra` compile in typed fixtures.

### Package

- clean install outside workspace;
- npm and pnpm;
- minimum/current Node;
- binary launch;
- import and require only where advertised.

---

## 19. Completion metrics

Behavioral:

- restart does not change selected configuration;
- default selections follow catalog defaults;
- explicit selections never silently become defaults;
- no client disagrees about conversation lifecycle;
- every CLI invocation is explainable from one config plus one catalog revision;
- retired explicit models remain viewable and never silently become defaults.

Structural:

- configuration mutation paths: 3 → 1;
- default-resolution sites: approximately 5 → 1;
- picker implementations: 2 → 1;
- client model loaders: 2 → 1;
- constructor mode flags: 1 → 0;
- production TS/rewrite steps: 2 → 0;
- incomplete `Conversation` stubs: present → eliminated;
- relevant decision branches: estimated reduction of 25–40.

Size:

- production/build code target: 250–450 fewer lines after compatibility deletion;
- `server.ts` target: below 5,450 lines;
- `shared/index.ts` target: below 900 lines;
- `Chat.tsx` target: below 1,000 lines;
- `actions.ts` target: below 650 lines.

Test LOC will increase. Production and test LOC must be reported separately.

---

## 20. Operational visibility

Use structured, deduplicated events:

- `conversation_config_migrated`
  - provenance;
  - provider;
  - whether model/effort evidence existed;
- `conversation_config_unavailable`
  - provider;
  - selected model;
  - catalog revision;
  - error code;
- `conversation_config_write_failed`
  - conversation ID;
  - stage;
  - filesystem error code;
- `conversation_config_revision_conflict`
  - expected and actual revision;
- `provider_catalog_refresh_failed`
  - provider and retained catalog revision.

Do not log the same missing legacy field for every loaded conversation on every
poll. Migration is persisted once, and warnings are keyed/deduplicated by record.

Useful counters:

- legacy records migrated;
- unavailable configurations;
- write failures;
- revision conflicts;
- active/queued update rejections.

These exist to prove the compatibility layer can be deleted, not to create a
permanent analytics subsystem.

---

## 21. Explicit non-goals

- rewriting all of `server.ts`;
- changing streaming buffer architecture;
- replacing Jotai or Zustand;
- redesigning queue/message persistence;
- event sourcing or JSON Patch;
- adding a database;
- redesigning merge/swarm/subagent flows;
- globally enumerating OpenCode model IDs;
- translating provider effort names;
- dynamic upstream discovery for every provider;
- unrelated accessibility/CSS/lint cleanup.

---

## 22. Final acceptance checklist

- [ ] `ConversationConfig` preserves model and reasoning intent.
- [ ] `ConfigResolution` is derived in one place and records catalog revision.
- [ ] Retired explicit models remain viewable but cannot silently execute as a default.
- [ ] Runtime observations are separate from configuration.
- [ ] Configuration is durably persisted before acknowledgement.
- [ ] Restart/resume retains all selections.
- [ ] Provider/model/reasoning updates are atomic and revisioned.
- [ ] Busy conversations cannot change configuration.
- [ ] Every lifecycle mutation is broadcast to all clients.
- [ ] Pending creations are not fake conversations.
- [ ] One catalog drives API validation and UI.
- [ ] One picker drives modal and header.
- [ ] Shared CLI public types match runtime behavior.
- [ ] Current model strings remain opaque at the CLI boundary.
- [ ] Production uses compiled package exports.
- [ ] Clean tarball installation passes outside the monorepo.
- [ ] Compatibility code has a scheduled deletion PR.

The refactor is complete only when a maintainer can answer:

> What did the user choose, what will the next turn execute, and what did the
> provider report?

by reading three separate, explicitly named values—without interpreting
`undefined`.
