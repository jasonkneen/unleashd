# Review B — Client, Runtime Contract, Tests, and Packaging

Date: 2026-07-28

Scope: modal/header controls, optimistic state, WebSocket contract, shared CLI
boundary, build output, published artifacts, and test orchestration.

## Verdict

The UI changes remove one race but preserve an overly complex state contract.
Build and package behavior now works in the repository, but it is held together by
runtime transpilation and post-compile rewriting rather than stable package
exports.

## High-severity findings

### B1. The shared CLI public type is stale

`vendor/agent-cli-tool/src/runtime-types.ts:16` defines
`CodexReasoningLevel` without `max` or `ultra`.

The runtime harness accepts both values, and command tests exercise them, but a
typed downstream caller cannot express them. `cli.ts` avoids the compiler by
casting arbitrary input.

The public type, exported constants, live probes, and runtime behavior must derive
from one local constant or consistently use a documented pass-through string.

### B2. The client erases policy before server confirmation

`materializeReasoningEffort` computes the server’s presumed default for an
optimistic stub. This duplicates server policy and converts “follow default” into
a fixed string.

Optimistic state should preserve the user’s selection policy. The authoritative
server snapshot should carry the same policy rather than forcing the client to
guess an effective value.

### B3. Modal reset is asynchronous and incomplete

`Sidebar.tsx:222-239` opens the modal, then resets only reasoning in an effect.
Provider and model are not reset.

This conflicts with the project rule requiring synchronous reset during open and
allows stale configuration to appear or be submitted on a rapid path.

Use one `ConversationDraft` object initialized synchronously before setting the
modal visible.

### B4. Packaging relies on implementation accidents

Production currently:

- rewrites compiled `require("@unleashd/shared")` strings recursively in
  `tools/patch-server-dist-shared-imports.cjs`;
- preloads `tsx/cjs` in both `bin/unleashd.js` and `server/package.json`;
- points `@nbardy/agent-cli` `main`, `types`, and `bin` at TypeScript source;
- mixes CommonJS server output with ESM library output.

This is brittle across TypeScript emit changes, Node versions, bundlers, and
external consumers.

Compile shared packages to declared exports. Production should run plain Node,
without string surgery or TS transpilation.

### B5. A dry-run tarball does not prove installation

The root package depends on `"@nbardy/agent-cli": "workspace:*"` while its `files`
list excludes the submodule. Correct installation depends on publish-time
workspace rewriting and a separately published matching CLI package.

Add a clean-room smoke test:

1. pack the shared CLI;
2. install its tarball in an empty fixture;
3. pack the root package with a resolvable dependency;
4. install the root tarball outside the monorepo;
5. run the binary on the minimum and current supported Node versions.

## Medium-severity findings

### B6. The controlled picker displays state the parent does not own

`ProviderModelPicker.tsx:102-103` marks a concrete default model as selected even
when the controlled `model` prop is `undefined`. Submission still sends the
parent’s `undefined`.

Display “Provider default (GPT-5.6 Sol)” as an explicit choice, or materialize the
draft synchronously. Do not visually claim the controlled state contains a value
that it does not.

### B7. Radio names collide between component instances

The reusable picker uses fixed document-global names:

- `provider`
- `codex-model`
- `model`
- `reasoning-effort`

Two mounted picker instances join the same native radio groups. Generate
per-instance names with `useId()` or use a form-scoped component structure.

### B8. Model loading is duplicated and unvalidated

`Chat.tsx` and `ProviderModelPicker.tsx` each implement fetching, defaults, error
handling, and display fallback. Codex bypasses the endpoint only in one of them.
Both cast response JSON rather than parsing `ModelInfoSchema`.

Create one `useProviderModels(provider)` hook with:

- abort behavior;
- runtime validation;
- default derivation;
- loading and error states;
- per-provider session caching.

### B9. Client mutation behavior is inconsistent

Reasoning changes are optimistic. Model and provider changes are not. Rejection
rollback is therefore implemented only for reasoning. Missing-conversation and
setter errors are handled inconsistently.

One atomic configuration command and one authoritative response path removes this
accidental coupling.

### B10. Root `test` is not the repository test contract

`package.json:13` runs only `test/api.test.js`. It omits:

- server/unit tests;
- server typecheck;
- shared build/typecheck;
- shared CLI tests and typecheck;
- client build;
- packaged-artifact installation.

This is why runtime tests passed while the exported CLI type remained stale.

### B11. The API harness is timing-sensitive

The test harness uses a fixed port, startup timing assumptions, listener timing
that already produced an `init` race, and process termination without a strong
shutdown handshake.

Use:

- an ephemeral port;
- explicit server readiness;
- a small WebSocket inbox/queue registered before open;
- awaited shutdown;
- the workspace binary rather than an implicit `npx` tool lookup.

## Complexity evidence

The same setting currently appears as:

- `string | null | undefined` in modal state;
- a concrete string or `undefined` in the optimistic conversation;
- raw nullable/optional wire input;
- constructor input plus `applyReasoningDefault`;
- stored `string | undefined`;
- missing disk data;
- CLI `string | undefined`.

Client model/default behavior exists in:

- modal local state;
- picker fallback selection;
- shared registry imports;
- `/api/models`;
- header fetch state;
- optimistic pending state;
- server confirmation replacement.

The implementation can pass all happy-path tests and still be difficult to reason
about because no single value answers whether an effort is default-derived,
disabled, fixed, or unknown.

## Immediate cleanup recommendations

Before the larger refactor:

1. add `max` and `ultra` to the CLI public type and live matrix;
2. add multi-client creation/deletion tests;
3. replace modal state with one synchronously initialized draft;
4. generate unique radio group names;
5. turn `createConversation` into an options-object API;
6. add one client model-loading hook;
7. make root `test` run the meaningful workspace contract;
8. add clean tarball installation tests.

These are independently shippable and reduce risk before changing persistence.
