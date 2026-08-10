# AGENTS.md — Agentic Coding Guide

Quick-reference for agents writing new code in this codebase.
Start here before touching state, components, or the server.

---

## Code tree map (where does each concern live)

```
shared/src/index.ts                     → Zod schemas, types, per-provider helpers.
                                          Single 900+-line file; split only when it hurts.
server/src/server.ts                    → Conversation class + WS router. Authority for
                                          in-memory conversation state. Very large.
server/src/adapters/disk-adapter.ts     → ParsedSession → Conversation hydration.
server/src/adapters/registry.ts         → Per-provider DiskAdapter registry.
server/src/adapters/loader.ts           → Scan + poll loop over all adapters.
server/src/providers/{claude,codex,...} → Thin Provider impls (listModels, etc.).
server/src/subagent-tools.ts            → Sub-agent tool-name/status helpers.

vendor/agent-cli-tool/                  → GIT SUBMODULE. Its own commit + push cycle.
  src/runtime-types.ts                  → Canonical request + unified event union.
  src/build.ts                          → Canonical request → argv (via harnesses).
  src/harnesses/{claude,codex,...}.ts   → Per-CLI argv syntax (one file per CLI).
  src/process-runner.ts                 → spawn + stdio wiring.
  src/parsers/{claude,codex,...}.ts     → Raw harness JSON → unified events.
  src/execute.ts                        → Glue: session capture, completion, heartbeat.
  test/*.test.ts                        → Contract tests (125 in tree). `npm test`.
  manual_tests/                         → Live-CLI captures for studying harness drift.

client/src/atoms/conversations.ts       → Jotai atoms + derived views.
client/src/atoms/actions.ts             → WS dispatch + optimistic atom writes.
client/src/atoms/store.ts               → Jotai store instance.
client/src/components/Sidebar.tsx       → New-conversation MODAL + conversation list.
client/src/components/Chat.tsx          → Thread view: header dropdowns + message flow.
client/src/components/ProviderModelPicker.tsx → Shared picker UI (used inside modal).
client/src/stores/uiStore.ts            → Persisted UI prefs (localStorage).
```

**Rule of thumb — when adding a per-conversation setting, you touch roughly:**
shared schema → server Conversation + WS handlers + (maybe) disk-adapter →
agent-cli harness reasoningFlags-style hook → client atoms actions → 2–3 UI
surfaces (modal + header + optional list). See the "per-conversation setting
checklist" below.

---

## Writing state subscriptions

**Before subscribing to any store, identify what you need:**

### Single conversation by ID → `conversationAtomFamily`
```ts
const conv = useAtomValue(conversationAtomFamily(id));
```

### A list of conversations (sorted, filtered, grouped) → `allConversationsAtom` / `derived atoms`

**Option A — simple, re-renders all items on any structural change:**
```ts
const list = useAtomValue(allConversationsAtom);
// then apply UI-state filters inline with useMemo
```

**Option B — per-item subscriptions, true subtree pruning (use for large lists):**
```ts
// Parent: only re-renders when list membership/order changes
const ids = useAtomValue(allConversationIdsAtom);
return ids.map(id => <Item key={id} id={id} />);

// Item: React.memo + per-ID selector = only re-renders when THIS conv changes
const Item = React.memo(function Item({ id }: { id: string }) {
  const conv = useAtomValue(conversationAtomFamily(id));
  ...
});
```
Why it works: `conversations.get(otherId)` returns the same reference when a different
conversation changes. React.memo sees no prop change → skips render. This is structural
sharing doing real work — no library required.

### Active streaming text → `streamingAtomFamily`
```ts
const text = useAtomValue(streamingAtomFamily(id));
// merge with conversation.messages at render time, not in the store
```

### Persisted UI state → `uiStore`
```ts
const pref = useUIStore((s) => s.yourPreference);
```

**Red flag:** if you wrote `useAtomValue(conversationsAtom)` — stop.
That subscribes to every structural event across all conversations.
Use one of the patterns above instead.

---

## Writing state mutations

### Structural update (new message, status change, queue, conversation added/deleted)
→ update `conversationsAtom.conversations`
→ `derived atoms` recomputes automatically via subscribe

### Chunk / streaming update
→ update `conversationsAtom.streamingContent` ONLY
→ never update `conversations.messages` during streaming
→ flush streamingContent → conversations in `status(isStreaming=false)` handler

### High-frequency state you're adding (>10Hz)
→ add a new `Map<string, T>` to `conversationsAtom` (like `streamingContent`)
→ never add it to `conversations` entries
→ document the flush boundary (when does it merge into `conversations`?)

---

## Adding a new collection view

All sorted/filtered lists of conversations go in `derived atoms.ts` — not in component `useMemo`.

```ts
// client/src/atoms/conversations.ts

export const yourViewAtom = atom((get) => {
  const all = get(conversationsAtom);
  // ... compute your view
});
```

Then in the component: `useAtomValue(yourViewAtom)`.

---

## Adding a new provider (CLI integration)

1. `server/src/providers/{name}.ts` implementing `Provider` interface
2. Add to `ProviderSchema` in `shared/src/index.ts`
3. Register in `providers` record in `server/src/providers/index.ts`
4. See `docs/agent_client_spec.md` for the full protocol spec

---

## Adding a per-conversation setting (quick checklist)

For settings that differ per provider (effort levels, reasoning modes, sandbox
policies, etc.), follow the **"Pass-through pattern for provider-bespoke
values"** section below. Summary of the 7 touch points — confirm each before
committing:

1. **shared/src/index.ts** — per-provider `as const` array(s) + literal types;
   schema fields on `ConversationSchema`, `NewConversationMessage`, `Set*Message`
   as `z.string().optional()`.
2. **shared/src/index.ts** — `xLevelsForProvider`, `isXValidForProvider`,
   `defaultXForProvider` helpers.
3. **server/src/server.ts** — new field on the `Conversation` class;
   constructor applies default via `defaultXForProvider`; WS `new_conversation`
   + `set_*` handlers validate via `isXValidForProvider` and reject with a
   message listing the valid set.
4. **server/src/adapters/disk-adapter.ts** — decide what happens on session
   reload. Most CLI session files DON'T store these fields; emit a warn on load.
5. **vendor/agent-cli-tool** — extend the harness's `reasoningFlags`-style
   hook. Pass the string verbatim; do not translate. Submodule commit → push
   → bump outer pointer (see submodule commit dance).
6. **client/src/components/Sidebar.tsx + ProviderModelPicker.tsx** — per-provider
   option list; reset state on modal-open; reset on provider-switch **synchronously
   inside the radio onChange**, NEVER an async `useEffect` that races user clicks.
7. **client/src/components/Chat.tsx** — thread-header dropdown for mid-conversation
   changes; dispatch a `set_*` WS action (mirror `setReasoningEffort` in
   `actions.ts`, remembering optimistic writes need schema-complete stubs).

See "Pass-through pattern" at the bottom of this file for the full rules and
anti-patterns.

---

## Submodule commit dance (vendor/agent-cli-tool)

`vendor/agent-cli-tool` is a **git submodule** with its own history. Commits
inside it are separate from the outer repo. The outer repo stores a **pointer
SHA** — bumping that pointer is how you pull in submodule changes.

### The order that actually works

1. **Inside the submodule**: `git add`, `git commit`, `git push origin main`.
2. **Outer repo**: `git add vendor/agent-cli-tool` (stages the pointer bump).
3. **Verify**: `git diff --cached vendor/agent-cli-tool` — should show
   `-Subproject commit <old-sha>` / `+Subproject commit <new-sha>`.
4. **Outer**: `git commit` + `git push origin main`.

Pushing the outer pointer before pushing the submodule leaves anyone else
cloning on a broken ref. Always submodule-first.

### `git status` cheatsheet for submodules

| Symbol | Meaning |
|---|---|
| `M vendor/agent-cli-tool` | Pointer staged to move (capital M) |
| ` M vendor/agent-cli-tool` | Pointer moved but not staged |
| ` m vendor/agent-cli-tool` | **Content inside the submodule is dirty** (lowercase m) |
| `Mm vendor/agent-cli-tool` | Pointer bumped AND inside is dirty. Only the pointer is part of the outer commit; the `m` is separate work. |

### Don't push main unless asked

Pushing to main is a write to shared state. The assistant never pushes unless
the user explicitly authorizes it.

---

## WebSocket message contract — surprises

### `conversation_created` is reused for UPDATES

Set-value handlers (`set_model`, `set_provider`, `set_reasoning_effort`)
broadcast `conversation_created` carrying the new state. There is no
`conversation_updated` type today. Consequences:

- Any client-side code reacting to `conversation_created` (like
  `removePendingConversation`) MUST be idempotent or guarded against the id
  not being in the pending list.
- If you add a new setter, follow the same pattern OR introduce a proper
  `conversation_updated` message and update all existing handlers in lockstep.

### Rejection → authoritative rebroadcast

When a setter rejects input (e.g. `isEffortValidForProvider` fails), the
server sends `{type: 'error', message}` AND a `conversation_created` carrying
the unchanged authoritative state. The client uses this to roll back optimistic
writes. Without the rebroadcast, optimistic writes would stick forever.

### Optimistic stubs need the full schema shape

`createConversation` writes a Conversation stub to `conversationsAtom` before
the server confirms. Any field you add to the schema MUST also land in that
stub (plus the pending-conversation localStorage stub in `handleMessage`'s
`init` reconciler), otherwise the UI renders wrong for a brief window before
the server confirmation arrives.

---

## When source is broken, `server/dist/*.js` is the oracle

The build output under `server/dist/` often survives source-level mistakes
(deleted exports, failed rebases, checkouts that lose files). If a runtime
error says `X is not a function` and the source doesn't export `X`, look at
`server/dist/*.js` — the compiled JS retains the author's prior intent and
often reveals the missing shape faster than git archaeology. Same trick works
for `shared/dist/` and `vendor/agent-cli-tool/dist/` (if present).

---

## React hook ordering

ALL hooks must appear before any early `return` statement.
Hooks after early returns crash React when the condition flips (null → non-null).

```ts
// BAD
function Chat() {
  const conv = useAtomValue(conversationAtomFamily(id));
  if (!conv) return <Loading />;     // early return
  const x = useMemo(...);            // crash: hook after conditional return
}

// GOOD
function Chat() {
  const conv = useAtomValue(conversationAtomFamily(id));
  const x = useMemo(() => {
    if (!conv) return null;          // guard inside memo, not a return
    return compute(conv);
  }, [conv]);
  if (!conv) return <Loading />;     // early return AFTER all hooks
}
```

---

## Performance checklist before committing

- [ ] No `useAtomValue(conversationsAtom)` in new components
- [ ] New list/sorted/filtered views added to `derived atoms.ts`, not component `useMemo`
- [ ] High-frequency updates go to `streamingContent` or a dedicated Map, not `conversations`
- [ ] Stable fallback references are module-level constants, not inline `[]` or `{}`
- [ ] No hooks after early returns

## Architecture in One Page

### 1) Provider abstraction is the integration seam

Provider-specific CLI details are expressed through a shared contract, split into:

- Build-time contract in `agent-cli-tool`
  - Harnesses: `agent-cli-tool/src/harnesses/*`
  - Shared builder: `agent-cli-tool/src/build.ts`
  - Types: `agent-cli-tool/src/types.ts`
- Server provider runtime in `server`
  - Provider interface + registry: `server/src/providers/index.ts`
  - Provider implementations: `server/src/providers/{claude,codex,opencode,gemini}.ts`
- Shared provider IDs: `shared/src/index.ts`

### 1.5) Shared agent CLI stays a thin wrapper

The `vendor/agent-cli-tool` submodule is deliberately small. Its job is:

1. take one canonical request shape
2. map that request into harness-specific argv
3. run the real CLI process
4. parse harness-specific stdout/stderr
5. emit one unified event stream

Keep the architecture split explicit:

- `vendor/agent-cli-tool/src/build.ts`
  - unified input → harness command/argv
- `vendor/agent-cli-tool/src/process-runner.ts`
  - spawn + stdio wiring only
- `vendor/agent-cli-tool/src/parsers/*`
  - harness-native JSON/events → unified events
- `vendor/agent-cli-tool/src/execute.ts`
  - glue layer for session capture, completion, buffering, heartbeat
- `vendor/agent-cli-tool/src/runtime-types.ts`
  - canonical request + canonical unified event union

### Core rules for `vendor/agent-cli-tool`

1. **One input model, one output model.**
   Callers should pass one canonical request object. Harnesses may have
   different raw JSON/event formats, but the submodule emits one shared event
   union (`session.started`, `turn.started`, `text.delta`, `tool.use`,
   `progress`, `stderr`, `error`, `out_of_tokens`, `turn.complete`).

2. **Harness-specific differences belong at the edges.**
   Harness config owns argv syntax. Harness parsers own raw-output translation.
   Do not spread provider conditionals through the generic executor.

3. **The submodule is not an app runtime.**
   No conversation model, no merge/swarm orchestration, no sidebar/UI state, no
   product-specific subagent data model. The submodule only reports normalized
   runtime facts.

4. **Per-harness JSON in, unified JSON out.**
   Think of each parser as:
   `raw harness JSON/events -> unified events`
   The parser may keep small local state when the provider protocol requires
   it (for example streamed tool-call reconstruction), but that state must stay
   parser-local.

5. **Session helpers are separate from parsing.**
   Resume/fork/session-id capture are executor/session concerns, not parser
   concerns. Keep filesystem/session emulation out of harness config except as
   explicit helper hooks.

6. **When adding a harness, prefer extension over branching.**
   Usually this means:
   - add/update harness config in `src/harnesses/*`
   - add/update one parser in `src/parsers/*`
   - add a focused session helper only if the harness truly needs one
   Avoid growing `execute.ts` into another monolith.

7. **Test the contract, not implementation trivia.**
   High-value coverage for the submodule is:
   - build-command contract tests
   - parser/executor integration tests with shim CLIs
   - opt-in real-harness captures under `vendor/agent-cli-tool/manual_tests/`
   Use manual tests to study harness drift; do not turn every live-debug script
   into an automated test.

### 2) Registry-first persistence

Persisted sessions are loaded through adapter registry:

- `server/src/adapters/registry.ts`
- `server/src/adapters/disk-adapter.ts`
- `server/src/adapters/loader.ts`

Adding a provider means adding:
- a harness,
- a server provider,
- a disk adapter (if persisted artifacts are needed).

### 3) Conversation lifecycle and state authority

Authoritative in-memory model is `Conversation` in:

- `server/src/server.ts`

Flow is:
1. Client creates conversation.
2. Server validates + spawns provider process.
3. Chunk + message events are streamed into buffers/state.
4. On completion/close, queue/status/message boundaries are reconciled and broadcast.

`server` state remains authoritative while the provider process is active. Poller/loader merges skip active in-memory IDs.

### 4) Client state frequency budget

Streaming is separated from structural state:

- Structural: `conversationsAtom`, `allConversationsAtom`, IDs.
- High-frequency stream text: dedicated stream buffers / streaming atoms.

Relevant files:
- `client/src/atoms/conversations.ts`
- `client/src/atoms/actions.ts`
- `client/src/atoms/store.ts`

## Test Strategy: Useful vs Overkill

### Keep features lean

- Prefer one integration test through the real boundary over many tests of
  helpers, mocks, source text, CSS strings, or component structure.
- Never read TSX/CSS source in a test to assert labels, ordering, class names,
  or implementation details. Exercise the rendered/API behavior or omit the
  test.
- Do not extract trivial projection helpers merely to unit-test them.
- Wire payloads get one shared Zod schema; do not redefine matching client and
  server interfaces.
- Durable application state is authoritative. Do not ask a model to copy a
  magic marker into prose when the UI can read the canonical API/store result.
- A small feature should use the existing creation, persistence, and navigation
  paths. If it needs a parallel transport or lifecycle, simplify the design
  before adding safety wrappers and tests.

### Preserve lifecycle and hydration authority

- `server/src/lifecycle/shutdown.ts` is the only process-lifecycle and mutation
  admission authority. The dev watcher requests reloads; it never owns, adopts,
  or transfers provider processes.
- A source reload pauses new work and lets the server that spawned each turn
  drain it. Explicit shutdown is the only path that interrupts owned turns.
- Conversation summaries are bounded transport projections, never durable
  state or a cache. Full transcripts hydrate through the conversation-detail
  route, while the runtime/store remains authoritative.
- Do not add detached-process adoption, fallback snapshots, a second readiness
  gate, or task-specific model routing as incidental “safety.” Those are
  separate architecture decisions and require an explicit scoped design.

### High-value, low-cost
- Contract tests for builder + provider command specs (`agent-cli-tool`).
- Adapter loader/poller integration fixture test.
- WS init + create/reconcile behavior test around path normalization and visibility.

### Likely overkill now
- Per-provider exhaustive UI suites that duplicate loader + WS + provider contract coverage.
- Mock-heavy provider unit tests where real process/fs integration is the real risk.

If you want exactly three tests:
1. `agent-cli-tool` command contract regression (Gemini + Codex resume + stream flags)
2. `loadAllConversations/pollForChanges` fixture test
3. `test/api.test.js` create/reconcile path normalization test

## Pass-through pattern for provider-bespoke values

Use this pattern for **any per-conversation setting whose accepted values are
bespoke per provider/CLI** (effort levels, reasoning modes, sandbox policies,
output formats, anything the upstream CLI owns).

**Canonical example: `reasoningEffort` (claude `--effort`, codex `-c model_reasoning_effort=`).**
Each CLI accepts a different set, and those sets change as vendors ship updates.

### Rules

1. **Wire and storage = plain `z.string()`.** Do not invent a shared union Zod
   enum. A shared enum forces a schema bump every time a CLI adds/removes a
   level, and it implies a "canonical" vocabulary we don't own.
2. **Submodule (`vendor/agent-cli-tool`) knows the FLAG, not the VALUES.** Each
   harness's `reasoningFlags(level)` maps `level` into the CLI's flag shape
   (e.g. `['--effort', level]` vs `['-c', 'model_reasoning_effort=<level>']`).
   The value string passes through unchanged — we never rename or translate.
3. **Per-provider accepted lists live in `shared/src/index.ts` as `as const`
   string arrays**, one per provider. Derive literal-union types from them if
   useful for UI typing, but do NOT export them as the wire type.
   - Today: `CLAUDE_EFFORT_LEVELS`, `CODEX_EFFORT_LEVELS`.
4. **Validation helpers are functions, not schemas.** Expose
   `xLevelsForProvider(p): readonly string[]` and
   `isXValidForProvider(p, v): boolean`. Use them in:
   - the UI, to render only valid options per provider;
   - the server, at every WS boundary that accepts the value (both create and
     update handlers), with a typed rejection that lists the valid set.
5. **Defaults live in the server's Conversation constructor**, not in UI state.
   A single `defaultXForProvider(p)` helper keeps every creation path (WS,
   merge fork, swarm spawn, test setup) consistent. The UI sends `undefined`
   when the user didn't pick; server applies the canonical default.
6. **Source of truth for each CLI's accepted values = `<cli> --help` and the
   runtime rejection message** (for codex, passing an invalid `-c foo=bogus`
   prints `expected one of ...`). Record the verification command in a comment
   next to the per-provider array so the next update is a grep-and-bump.
7. **Keep pass-through through the entire spine:** do not coerce, rename, or
   alias values at any layer. UI string → WS string → server string → submodule
   string → CLI flag argument. Every hop is identity on the value.

Step-by-step touch points: see "Adding a per-conversation setting (quick
checklist)" above — same seven steps, same order.

### Anti-patterns (don't do these)

- A shared `z.enum([...union of all providers...])` on the wire. Couples every
  CLI's vocabulary together and breaks when any one vendor ships an update.
- Translating/renaming values at the submodule layer. If you're tempted to
  write `valueMap['medium'] = 'moderate'`, stop — use the CLI's name directly.
- UI-state defaults (e.g. `useState('high')`). Defaults belong server-side so
  alt clients (CLI, API, tests) get them too.
- Async `useEffect` to reset user-picked state on provider change. Races user
  clicks. Reset synchronously inside the click handler.

