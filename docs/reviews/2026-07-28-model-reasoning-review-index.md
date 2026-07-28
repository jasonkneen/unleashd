# Model and Reasoning Architecture Review

Date: 2026-07-28

## Documents

- [Final synthesized architecture plan](../refactor-plans/2026-07-28-final-conversation-config-architecture.md)
- [Review A — Domain model, server lifecycle, and persistence](./2026-07-28-review-a-domain-persistence.md)
- [Review B — Client, runtime contract, tests, and packaging](./2026-07-28-review-b-client-runtime-release.md)
- [Refactor Plan A — Persisted explicit ConversationConfig](../refactor-plans/2026-07-28-plan-a-persisted-conversation-config.md)
- [Refactor Plan B — Incremental boundary cleanup](../refactor-plans/2026-07-28-plan-b-incremental-boundary-cleanup.md)

## Executive verdict

The changes are locally careful and substantially better tested, but the code is not
architecturally clean yet.

The primary problem is not formatting or naming. It is that one field,
`reasoningEffort`, represents three different concepts:

1. user intent: follow the provider/model default;
2. effective execution: pass a concrete CLI effort or omit the flag;
3. persistence knowledge: the native session did not record the old choice.

Those concepts are encoded with different interpretations of
`undefined | null | string`. The meaning changes between the create wire message,
the client optimistic stub, the server constructor, the persisted conversation
snapshot, disk hydration, and the CLI request.

That ambiguity has already produced concrete correctness gaps:

- explicit reasoning choices are lost across a server restart;
- model-default reasoning does not follow a later model change;
- a thread cannot return to dynamic “provider default” after choosing a fixed
  effort or disabling the flag;
- modal configuration can leak between openings;
- the public shared-CLI Codex type still omits `max` and `ultra`;
- normal conversation creation and deletion are not broadcast consistently to
  other connected clients.

## What is clean

- Provider/model validation is centralized instead of copied in server code.
- Provider changes reset dependent model and reasoning values atomically.
- Stale model-fetch responses are cancelled.
- Cross-provider disk model contamination is rejected.
- The CLI still receives separate model and effort fields.
- Regression coverage now exercises the new models, effort levels, defaults, and
  multi-client provider updates.
- The reviewed core files pass typechecking, builds, focused formatting checks,
  API tests, and CLI contract tests.

These are good local decisions. They should be retained through any refactor.

## Highest-priority findings

| Priority | Finding | Consequence |
|---|---|---|
| P0 | Configuration is not durably persisted | Resumed turns silently run with different CLI flags after restart |
| P0 | Default/disabled/fixed intent is collapsed | The server cannot correctly react to model changes or explain state |
| P1 | Model change does not resolve a default-mode effort | Sol/Terra/Luna defaults can become internally inconsistent |
| P1 | CLI public type excludes `max`/`ultra` | Runtime works while typed downstream callers cannot express valid values |
| P1 | Modal reset is effect-driven and incomplete | Prior provider/model/effort can leak into a new conversation |
| P1 | Create/delete broadcast policy differs from setters | Multiple tabs disagree about conversation membership |
| P2 | Provider catalogs and capability rules are distributed | New providers/models require synchronized edits in many layers |
| P2 | Build output is repaired by string rewriting and runtime TS loading | Publishing depends on emit shape, workspace behavior, and Node quirks |

## Scale and complexity evidence

Current large surfaces:

| File | Lines |
|---|---:|
| `server/src/server.ts` | 5,773 |
| `shared/src/index.ts` | 1,238 |
| `client/src/components/Chat.tsx` | 1,157 |
| `client/src/components/Sidebar.tsx` | 893 |
| `client/src/atoms/actions.ts` | 725 |
| `client/src/components/ProviderModelPicker.tsx` | 207 |

The important metric is semantic fan-out:

- default/disabled/fixed reasoning is normalized in at least five places;
- provider/model/effort configuration is mutated through three setters;
- conversation construction has four call sites and a mode boolean;
- model metadata is loaded through two different client paths;
- Codex effort vocabulary is copied at least four times across source and tests;
- a creation event has both creation and update meanings;
- provider-native disk state and application-owned configuration are mixed in one
  hydrated object.

## Core model to unify around

Both independent reviews converged on preserving selection intent:

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

`ConversationConfig` is what the user chose and what the application persists.
`EffectiveExecutionConfig` is derived at the last possible moment, immediately
before invoking the shared CLI.

This produces one durable invariant:

> User configuration is explicit, validated, atomic, and separate from the
> effective CLI arguments derived for a turn.

## Recommendation

Use Plan B for the next several PRs because it fixes the immediate semantic,
typing, client, event, test, and packaging problems without combining them with a
large server extraction.

Adopt Plan A as the target architecture. In particular, do not stop after adding
`ReasoningPolicy`; add durable application-owned configuration before claiming the
restart behavior is correct.

A sensible sequence is:

1. fix the stale CLI type and strengthen the root test command;
2. introduce explicit reasoning selection and transition tests;
3. persist configuration in a versioned sidecar;
4. route model/provider/reasoning changes through one atomic server operation;
5. unify the modal and header controls;
6. split creation from update events and broadcast all lifecycle mutations;
7. replace production TS loading and compiled-JS rewriting with real package
   exports;
8. remove compatibility branches after one release.

## What should not be bundled into this work

- a rewrite of the entire `Conversation` class;
- changes to streaming buffers or message flush boundaries;
- a new client state library;
- event sourcing or JSON Patch;
- a database;
- a redesign of transcript persistence;
- broad CSS or repository-wide lint cleanup;
- removal of legacy composite IDs without persisted-session evidence.

Keeping these out is important. The configuration spine can be cleaned without
turning the work into a general platform rewrite.
