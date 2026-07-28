# Refactor Plan B — Incremental Boundary Cleanup

Date: 2026-07-28

Status: recommended implementation sequence

> Superseded as the implementation contract by
> [Final Architecture Plan — Conversation Configuration](./2026-07-28-final-conversation-config-architecture.md).
> This document is retained as the incremental independent proposal.

## Objective

Fix the configuration semantics and brittle boundaries through small, independently
shippable PRs. Preserve the current `Conversation` class, provider adapters, Jotai
store, streaming architecture, and UI appearance.

## Target policy

Introduce:

```ts
type ReasoningPolicy =
  | { mode: 'default' }
  | { mode: 'disabled' }
  | { mode: 'fixed'; effort: string };
```

Conversation state stores policy. Only the CLI edge receives:

```ts
reasoningEffort?: string;
```

Legacy mapping:

- missing create field → default;
- create `null` → disabled;
- create string → fixed;
- hydrated string → fixed;
- hydrated missing effort → disabled, preserving current resume behavior.

## PR 1 — Contract safety

Fix immediately:

- add `max` and `ultra` to the shared CLI public type;
- derive the type and live-probe values from one CLI constant;
- add reasoning-policy resolution characterization tests;
- make the root test command cover builds, typechecks, server tests, CLI tests,
  API tests, and package smoke tests.

Add a clean installation test rather than relying on `npm pack --dry-run`.

Estimated production LOC: neutral.
Estimated test LOC: +120–180.

## PR 2 — ReasoningPolicy compatibility layer

Create:

- `shared/src/reasoning.ts`;
- temporary `shared/src/reasoning.compat.ts`.

Move effort lists, validation, defaults, and policy resolution out of
`shared/src/index.ts`.

Server stores policy and resolves effective effort immediately before CLI launch.
Client optimistic and pending state stores policy without guessing defaults.

Expected production change:

- focused modules: +100–140;
- removed duplicated/defaulting branches: -140–190;
- net: -20 to -70 after compatibility cleanup.

Exit conditions:

- no client import of a server-default helper;
- no business logic checks nullish effort outside compatibility and CLI edges;
- the model/default transition matrix passes.

## PR 3 — Honest update events

Add `conversation_updated` with a full authoritative snapshot.

- `conversation_created`: creation acknowledgement only;
- `conversation_updated`: settings/state updates;
- both use one internal client upsert helper;
- only creation removes a pending optimistic record.

Continue using full snapshots. Do not introduce patches, event sourcing, or
revision conflict handling in this PR.

Also broadcast creation and deletion to every client.

## PR 4 — Consolidate client configuration

Create:

- `client/src/hooks/useProviderModels.ts`;
- `client/src/domain/conversationDraft.ts`;
- `client/src/components/ConversationControls.tsx`.

Responsibilities:

- one abortable, cached, schema-validated model loader;
- one synchronous modal draft initializer;
- one provider transition that resets dependent values atomically;
- unique radio group names through `useId`;
- explicit default/disabled/fixed choices.

Change `createConversation` to accept an options object.

Extract `ChatHeaderControls.tsx` only if `Chat.tsx` loses at least roughly 180
lines and the new component has a narrow contract.

Expected production reduction: approximately 30–80 lines, plus a substantial
reduction in top-level component branching.

Exit conditions:

- one `/api/models` fetch implementation;
- no modal reset effect;
- no six-argument creation call;
- two mounted pickers do not share radio groups;
- rapid switch/immediate submit tests pass.

## PR 5 — Make the CLI truly pass-through

Derive its public types from local constants or use a documented string contract.
Move legacy composite parsing into a clearly named compatibility module.

Eventually:

- standalone model is opaque;
- reasoning is opaque;
- application catalogs disappear from CLI tests;
- a model ending in `-ultra` remains intact.

Expected production reduction: 10–25 lines immediately, more after compatibility
deletion.

## PR 6 — Replace packaging surgery

Compile `@unleashd/shared` and `@nbardy/agent-cli` to declared package exports.
Provide declarations and compatible import/require entries where supported.

Delete:

- `tools/patch-server-dist-shared-imports.cjs`;
- production `tsx/cjs` preloads;
- runtime `tsx` dependency if no production path needs it.

Agent CLI `bin` and `main` must point to compiled files, not `.ts`.

Add:

- `engines.node`;
- clean npm and pnpm tarball installation;
- minimum/current Node smoke matrix;
- explicit two-package release order and version contract.

Expected build-glue reduction: 15–30 net lines.
Runtime transpile/rewrite stages: 2 → 0.

## PR 7 — Durable configuration and compatibility deletion

Plan B still requires application-owned persistence before the behavior is fully
correct across restart. Add the Plan A sidecar store once policy semantics are
stable.

After one release:

- delete `reasoning.compat.ts`;
- remove legacy nullable fields;
- migrate/expire versioned pending localStorage records;
- remove composite parsing only after fixture/usage audit.

Expected production reduction: 60–110 lines.

## Quantified outcome

After compatibility deletion:

- production/build code: approximately 170–320 lines smaller;
- test code: approximately 220–350 lines larger;
- default normalization sites: about 5 → 1;
- client model loaders: 2 → 1;
- optional positional creation arguments: 6 → 1 options object;
- creation event meanings: 2 → 1;
- production transpile/rewrite steps: 2 → 0;
- handwritten Codex effort vocabularies: at least 4 → one product list and one
  derived CLI export with a contract test;
- `Chat.tsx`: target below 1,000 lines if extraction meets the threshold.

The primary gain is fewer representational states and fewer decision sites. Net
repository LOC may remain flat because missing tests should be added.

## Required gates

- shared policy matrix tests;
- exact CLI argv tests for default/fixed/disabled through create and resume;
- server create/model-switch/provider-switch/hydration tests;
- client draft and stale-fetch tests;
- two-picker browser/component test;
- multi-client lifecycle/update test;
- packed-artifact clean-install test;
- one root command that runs the full contract.

## Risks and controls

- Version pending localStorage before changing its shape.
- Declare whether old/new clients are lockstep; otherwise negotiate protocol
  version explicitly.
- Keep package-format work in a separate PR from semantic policy work.
- Time-box compatibility helpers before merging them.
- Do not extract components unless the caller measurably loses branches/LOC.

## Deliberate exclusions

- no full server rewrite;
- no streaming/message state changes;
- no state-library replacement;
- no JSON Patch or event sourcing;
- no redesign of merge/swarm/subagent flows;
- no forced closed enum for OpenCode models;
- no UI redesign;
- no broad lint cleanup;
- no composite removal without evidence.
