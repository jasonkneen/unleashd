# Review A — Domain Model, Server Lifecycle, and Persistence

Date: 2026-07-28

Scope: shared schemas, provider definitions, `Conversation`, WebSocket mutations,
disk hydration, polling, and CLI invocation.

## Verdict

The patch improves validation and local correctness, but the domain model remains
ambiguous. It will become increasingly fragile as providers acquire different
model capabilities and defaults.

## Critical findings

### A1. Reasoning configuration is lost after restart

The native provider session artifacts generally do not persist the application’s
reasoning selection. The disk adapter acknowledges that absence in
`server/src/adapters/disk-adapter.ts:125-161`. Hydration preserves the missing
value in `server/src/server.ts:5298-5307`, and the next spawn passes that absence
to the CLI in `server/src/server.ts:626-650`.

Sequence:

1. A user selects Claude `max` or Codex `minimal`.
2. The in-memory conversation invokes the CLI correctly.
3. The server restarts.
4. The native session hydrates without the selection.
5. The resumed turn omits the effort flag.

The poller keeps an in-memory value when disk lacks it
(`server/src/server.ts:5643-5649`), but that protects only the current process.
Removing the repeated warning made logs quieter while leaving the behavior silent.

Application-owned configuration needs durable storage separate from provider
transcripts.

### A2. One value has three incompatible meanings

The create schema defines:

- absent: use provider/model default;
- `null`: explicitly omit the flag;
- string: fixed effort.

See `shared/src/index.ts:826-835`.

The constructor immediately collapses this into `string | undefined` at
`server/src/server.ts:540-549`, while the stored schema exposes only
`string | undefined` at `shared/src/index.ts:601-622`.

After that collapse, `undefined` can mean:

- the user disabled reasoning;
- hydration could not recover the old selection;
- no effective flag is currently resolved.

The client duplicates the collapse in `client/src/atoms/actions.ts:131-141` and
`client/src/atoms/actions.ts:218-236`.

The application must preserve selection policy and derive execution flags later.

### A3. Model-specific defaults do not follow model changes

The registry declares Sol=`ultra`, Terra=`xhigh`, and Luna=`xhigh` at
`shared/src/index.ts:208-229`.

`set_model` changes only `conv.model` at `server/src/server.ts:2080-2103`.
Because default-derived and explicit effort are indistinguishable:

- Sol default followed by Terra leaves `ultra`;
- Terra default followed by Sol leaves `xhigh`;
- an explicitly fixed effort behaves identically to a default-derived effort.

The thread header offers no action to restore dynamic default mode after an
explicit choice (`client/src/components/Chat.tsx:716-753`).

### A4. Creation and deletion are not multi-client authoritative

Settings changes now broadcast globally, but a normal create acknowledges only
the initiating socket (`server/src/server.ts:2019-2028`). Deletion has the same
problem (`server/src/server.ts:2055-2075`).

Two open tabs can therefore agree on a provider update but disagree on which
conversations exist.

All lifecycle mutations need one broadcast policy.

## Significant maintainability findings

### A5. Per-model capability data is decorative

Every Codex model registry entry contains `thinkingOptions`
(`shared/src/index.ts:200-258`), but validation checks only a provider-wide list
(`shared/src/index.ts:570-587`).

This is safe only while all models accept the same values. Either:

- remove per-model capability fields and state the capability is provider-wide; or
- validate the provider/model/effort tuple from the model definition.

Do not maintain a data model that promises finer validation than the code performs.

### A6. Active-turn configuration has unclear timing

Provider changes use `canChangeProvider`, but model and effort setters can run
while a CLI process is active (`server/src/server.ts:2080-2141`).

The live process keeps the old spawn arguments while the UI immediately displays
the new settings. The implementation behaves like “pending for next turn” without
modeling or labeling that state.

Choose one policy:

- reject changes while running; or
- store `activeConfig` and `nextTurnConfig` separately.

Rejecting is the simpler first implementation.

### A7. `applyReasoningDefault` is a fragile constructor mode

`ConversationOptions.applyReasoningDefault` exists only to tell the constructor
which lifecycle created the object. Hydration and fork paths must remember the
correct boolean.

Named factories encode this safely:

- `Conversation.createNew`
- `Conversation.hydrate`
- `Conversation.forkFrom`

The constructor should receive already-valid configuration, not infer provenance
from a boolean.

### A8. Provider configuration has no single owner

Provider facts are distributed among:

- shared metadata;
- provider-specific Zod model schemas;
- the Codex model registry;
- Claude/Gemini server display maps;
- server `listModels()` defaults;
- shared provider-wide effort arrays;
- Codex model-specific defaults;
- client-side Codex special cases.

`ProviderModelPicker` reads Codex statically while fetching other providers from
`/api/models`. The API is therefore not a consistent abstraction boundary.

A client-safe provider definition should own presentation and configuration facts.
Server-only provider adapters should own execution behavior only.

### A9. `conversation_created` is an upsert disguised as an event

The event means creation, model update, provider update, effort update, and
authoritative rollback. That forced defensive pending-localStorage behavior in
`client/src/atoms/actions.ts:166-177`.

Use either:

- `conversation_created` plus `conversation_updated`; or
- honestly named `conversation_upserted`, with a separate creation acknowledgement.

Creation-specific side effects must not run for updates.

### A10. Configured and reported models are conflated

`model` is configured state; `modelName` is usually provider-reported state.
Hydration and polling update these through different rules, setters clear
`modelName`, and client display falls back between them.

Prefer:

- `config.model`: user-selected application configuration;
- `reportedModel`: provider/native-session observation.

Observed disk facts must not masquerade as application configuration.

## Duplication and boundary findings

### A11. Codex effort vocabulary is duplicated in one file

`CODEX_THINKING_OPTIONS` at `shared/src/index.ts:183-191` and
`CODEX_EFFORT_LEVELS` at `shared/src/index.ts:558-566` must match manually.

One should be the authoritative constant and the other a derived alias.

### A12. Shared-CLI tests know the application catalog

`vendor/agent-cli-tool/test/build.test.ts` copies the application’s model
inventory and effort matrix. The submodule’s stated responsibility is generic
model/effort pass-through.

The application should test catalog completeness. The CLI should use a few opaque
representative values to test command construction.

### A13. Generic suffix decomposition can corrupt future model IDs

The CLI decomposes any recognized `-effort` suffix. A future legitimate model
named `gpt-x-ultra` could silently become model `gpt-x` plus effort `ultra`.

Legacy composite migration belongs at the application persistence boundary, where
the old catalog is known. Current CLI model IDs should remain opaque.

## Test gaps

Add transition tests for:

- restart/hydrate/resume after each reasoning selection;
- default-mode model changes in both directions;
- fixed and disabled model changes;
- active-turn setters;
- second-client create and delete;
- model-specific effort rejection;
- restoration of default mode;
- corrupt/missing persisted app configuration.

## Clean invariant

The correct question is not “what is `conversation.reasoningEffort`?” It is:

> What configuration did the user select, and what effective arguments does that
> selection resolve to for the next turn?

Persist the first. Derive the second.
