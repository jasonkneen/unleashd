# Refactor Plan A — Persisted Explicit ConversationConfig

Date: 2026-07-28

Status: target architecture

> Superseded as the implementation contract by
> [Final Architecture Plan — Conversation Configuration](./2026-07-28-final-conversation-config-architecture.md).
> This document is retained as the domain-first independent proposal.

## Objective

Replace independent, overloaded provider/model/reasoning fields with one durable
configuration object. Preserve user intent separately from the effective CLI
arguments used for each turn.

```ts
type ReasoningSelection =
  | { mode: 'default' }
  | { mode: 'disabled' }
  | { mode: 'explicit'; value: string };

interface ConversationConfig {
  provider: Provider;
  model: ModelId;
  reasoning: ReasoningSelection;
}

interface EffectiveExecutionConfig {
  provider: Provider;
  model: string;
  reasoningEffort?: string;
}
```

## Target module structure

### Shared

Create `shared/src/provider-definitions.ts`.

It owns:

- provider display metadata;
- model definitions;
- exactly one default model per provider;
- reasoning levels by model;
- model-specific reasoning defaults;
- provider/model and model/reasoning validation.

Create `shared/src/conversation-config.ts`.

It owns:

- `ReasoningSelectionSchema`;
- `ConversationConfigSchema`;
- `ConversationConfigPatchSchema`;
- `resolveEffectiveExecutionConfig`;
- `applyConversationConfigPatch`;
- legacy wire conversion;
- legacy Codex composite decoding.

Keep `shared/src/index.ts` as an export barrel. Remove duplicated facts rather
than re-exporting additional copies.

### Server

Create `server/src/conversations/config-store.ts`.

Persist a versioned sidecar:

```ts
interface PersistedConversationConfigRecord {
  version: 1;
  conversationId: string;
  sessionIds: string[];
  config: ConversationConfig;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
```

Responsibilities:

- atomic temp-file plus rename writes;
- serialization per conversation;
- lookup through conversation/session aliases;
- corruption quarantine;
- future-version rejection;
- deletion/tombstoning.

Create `server/src/conversations/config-service.ts`.

Responsibilities:

- create, hydrate, fork, validate, resolve, persist;
- apply an atomic config patch;
- reject active-turn changes initially;
- update memory only after persistence succeeds.

Create `server/src/conversations/config-ws-handler.ts`.

Add:

```ts
{
  type: 'set_conversation_config',
  conversationId: string,
  patch: ConversationConfigPatch,
  expectedRevision?: number
}
```

Legacy setters delegate to this path during migration.

Modify `Conversation` to own:

```ts
config: ConversationConfig;
configRevision: number;
reportedModel: string | null;
```

Remove:

- independent mutable `provider`, `model`, and `reasoningEffort`;
- `applyReasoningDefault`;
- constructor defaulting;
- post-construction default patches;
- direct setter mutations.

Use explicit factories:

- `Conversation.createNew`;
- `Conversation.hydrate`;
- `Conversation.forkFrom`.

Resolve effective CLI configuration only in the spawn path.

### Client

Create `client/src/components/ConversationConfigPicker.tsx`.

Use it for both:

- new-conversation creation;
- existing-thread configuration.

It edits explicit modes, not `null` and `undefined`.

Replace Sidebar’s three independent state variables with one
`ConversationConfigDraft`. Replace header-specific branches with the same picker.

Move configuration actions to `client/src/atoms/config-actions.ts` if that removes
a coherent concern from the general action monolith.

Apply authoritative updates by `configRevision` so stale acknowledgements cannot
replace newer state.

### Shared CLI

The CLI should accept opaque model and reasoning strings.

After compatibility:

- remove generic suffix decomposition;
- remove application catalog copies;
- remove `STANDALONE_MODELS`;
- pass `model` and `reasoningEffort` independently and unchanged.

## Migration phases

### Phase 0 — Characterization

Add tests that expose:

- restart loss;
- default-mode model-switch errors;
- explicit and disabled model switching;
- active-turn update timing;
- second-client create/update/delete;
- legacy composite and base-only hydration;
- corrupt sidecar behavior.

### Phase 1 — Canonical provider definitions

Move provider/model/reasoning facts into shared definitions.

Exit conditions:

- one default model per provider;
- every default reasoning value validates;
- one Codex effort vocabulary;
- old exports are compatibility aliases only.

### Phase 2 — Pure transitions and resolution

Implement table-driven:

- creation;
- provider switch;
- model switch;
- reasoning mode switch;
- effective CLI resolution.

No React or server lifecycle code should contain provider-specific default rules.

### Phase 3 — Versioned sidecar persistence

Dual-write old flattened fields and new configuration for one release.

Dual-read order:

1. valid sidecar;
2. deterministic legacy derivation;
3. provider default model with migration diagnostics where required.

Legacy missing effort maps conservatively to `disabled`, not `default`, because
that preserves current resume behavior.

### Phase 4 — Conversation runtime migration

Move the class to `config`, `configRevision`, and `reportedModel`. Route all four
construction sites through named factories. Resolve execution at spawn.

### Phase 5 — Atomic configuration command

All legacy setters delegate to one transaction:

1. validate patch against current config;
2. validate expected revision;
3. persist atomically;
4. update memory;
5. broadcast the authoritative snapshot.

Broadcast create, update, and delete consistently to every client.

### Phase 6 — Unified client controls

Use one picker, one transition model, and one explicit draft.

Remove:

- client default materialization;
- modal reset effects;
- Codex-only rendering/data flow;
- display-time composite decoding;
- fixed radio group names.

### Phase 7 — Compatibility deletion

After one release:

- require `config` in conversation snapshots;
- remove legacy setter schemas;
- remove flattened reasoning configuration;
- remove composite CLI decomposition;
- replace update uses of `conversation_created`;
- delete compatibility conversion helpers.

## Estimated impact

Production code after compatibility removal:

- net reduction: approximately 300–500 lines;
- `server.ts`: 5,773 → approximately 5,300–5,450;
- `shared/index.ts`: 1,238 → approximately 750–900;
- `Chat.tsx`: 1,157 → approximately 980–1,030;
- `actions.ts`: 725 → approximately 625–660.

Complexity:

- configuration mutation paths: 3 → 1;
- server default-resolution sites: at least 4 → 1;
- picker implementations: 2 → 1;
- constructor provenance boolean: 1 → 0;
- directly mutable config fields: 3 → 1 immutable object;
- relevant conditionals: estimated reduction of 25–35;
- observable partial provider/model/effort combinations: eliminated.

Tests will likely grow by 250–450 lines. Report this separately from production
code reduction.

## Exit criteria

- All three reasoning modes survive restart.
- Effective arguments come from one pure resolver.
- Model defaults follow model changes only in default mode.
- Explicit and disabled modes remain stable across model changes.
- Config updates are atomic, revisioned, and broadcast globally.
- Disk observations cannot overwrite app configuration.
- No `applyReasoningDefault`.
- No `materializeReasoningEffort`.
- No generic CLI suffix decomposition.
- No application model inventory in CLI tests.
- One provider definition drives validation, API metadata, and UI rendering.

## Risks

- Session IDs can rotate: persist aliases and test rotation.
- Multiple tabs can race: use revisions and serialized writes.
- Disk failure can split memory/persistence: write first, then publish memory.
- Legacy native sessions lack intent: map unknown effort conservatively and
  record migration provenance.
- Old clients need a compatibility window: dual-read/dual-write for one release.
- External CLI consumers may use composites: inventory and deprecate before
  removal.

## Non-goals

- splitting the whole server monolith;
- redesigning transcript persistence;
- replacing streaming or queue state;
- dynamic upstream model discovery;
- a database;
- a new client state library;
- translating provider-native effort names.
