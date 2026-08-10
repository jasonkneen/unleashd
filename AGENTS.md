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

**Rule of thumb:** a per-conversation setting touches shared schema → server →
harness → client atoms → 2–3 UI surfaces. Full list: "per-conversation setting
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

## Mobile view tree (PWA) — two view trees over one core

Mobile is a second view tree over the same shared core, not a fork. One `jotaiStore` (`atoms/store.ts:14`), one WS socket, one `handleMessage` spine.

### What mobile may import

```
atoms/*, hooks/*, utils/*, shared/*, components/buddies/{api,types,ui-contract,buddies-shaping}.ts
```

Never import another `components/*.tsx` or its CSS. Swarm parsers were moved to `utils/swarmConvoParsers.ts` / `utils/swarmAnalyticsParsers.ts` precisely so mobile can reuse logic without pulling desktop view trees. `components/buddies/*` is the one allowed exception — its `buddies-shaping.ts` is pure shaping (no JSX/CSS side-effects) co-located with `api.ts`/`types.ts`/`ui-contract.ts`.

Grep gates (run `pnpm check:client-invariants` / `bash tools/check-client-invariants.sh`):
- **G1** — `jotaiStore.set` only inside `client/src/atoms/` (`mutate()` wraps it there). Components call actions.
- **G2** — no raw `.buddyContext` / `.purpose` reads in `client/src/mobile/` — use `getConversationKind` / `matchConversationKind` / `buddyContextFromKind` (`shared/src/conversation-kind.ts`).
- **G3** — no `components/` imports in `mobile/` except `components/buddies/` (see above).

### DeviceKind — the only sum type at the shell

```ts
// client/src/mobile/hooks/useDeviceKind.ts
export type DeviceKind = 'mobile' | 'desktop';
export function useDeviceKind(): DeviceKind { /* sticky per page load */ }
```

`T1`: `'mobile'|'desktop'` not `boolean isMobile` — anonymous `true⊕false` leaks `if(isMobile)` downstream. Computed once at module load via `matchMedia('(max-width: 768px)')` and cached for the page load (`sticky`, not resize-reactive — live swap would remount the tree and lose composer drafts). `matchMedia` missing → typed `throw` (`T4`, no silent desktop default). Single dispatch point is `App.tsx: const device = useDeviceKind()` → `SHELLS[device]` (δ #1) → `pick(r)` leaf factory (δ #2). Leaf handlers never re-ask `isMobile`.

### Where device-specific view state lives

`AGENTS.md: Adding a new collection view` says "all collection views in `derived atoms.ts`". **Exception:** device-specific derived views live in `mobile/atoms/`, not `conversations.ts`, to keep the canonical core clean. Canonical example:

```ts
// client/src/mobile/atoms/search.ts
export type MobileSearchState = { kind: 'idle' } | { kind: 'searching'; query: string };
export const mobileSearchStateAtom = atom<MobileSearchState>({ kind: 'idle' });
export const mobileSearchResultsAtom = atom((get) => get(mobileSearchStateAtom).kind === 'idle'
  ? get(allConversationsAtom)
  : filter(allConversationsAtom, query) /* via utils/fuzzyMatch */);
```

`T2`: `MobileSearchState` sum type, never `atom<string>('')` sentinel. `mobile/atoms/search.ts → atoms/conversations.ts` is allowed; core never imports mobile.

### UI state partition

`stores/uiStore.ts` `partitionUiState(state) => { shared, local }` is the v1 fork without a schema change:

- **shared** (POST to `POST /api/ui-state`) — `{ doneConversations, promotedWorkers, lastSeenMessageIndex, lastWorkingDirectory }` (4)
- **local** (written to `localStorage['unleashd-ui-local']` piggybacking the same 500ms debounce) — `{ activeConversationId, galleryExpandedProjects, galleryCollapsedProjects, showTempSessions, showDoneConversations, showWorkerConversations, sidebarViewMode }` (7)

`syncToServer` POSTs only `shared`; the same timer writes `local` to localStorage. Store init reads that blob via `UIStateSchema.partial().safeParse` before `hydrateFromServer` (discard whole blob on failure — no silent half-merge). Phone never mutates desktop-local fields; desktop never mutates mobile search tab. Post-v1: fold into jotai `atomWithStorage` (see `PLANNING_MOBILE.md` §4).

### Mutation rule

Partial updates of collection atoms go through `mutate()` (`atoms/mutate.ts` / `atoms/actions.ts`):

```ts
const mutate = <T>(a, recipe) => jotaiStore.set(a, produce(jotaiStore.get(a), recipe));
```

Scalar / full-replace sets stay plain `jotaiStore.set`. Current code already conforms: ~20 produce sites use `mutate()`, rest are scalars/snapshot replacements. Keeps every atom one uniform kind (no `jotai-immer` dep).

### Single-bridge + single-handler rules

- **Single bridge:** only `App.tsx` `AppInner` mounts `useWebSocketBridge` (hoisted above `AppRoutes`). Never mount a second bridge in `mobile/` — it would double-connect and fight over `sendFnAtom`/`wsStatusAtom`.
- **Never a second `handleMessage`:** the WS-push → `handleMessage` (`atoms/actions.ts`) dispatcher is the single shared spine. Mobile consumes it through the hoisted bridge; no mobile file defines its own handler.

### Stale link note

`client/src/components/SubAgentPanel.tsx:158` previously linked to `/swarms/project` — dead link matching no `App.tsx` route. Retarget to `/workers/detail` or remove; do not copy the stale path into mobile.

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

Full rules and anti-patterns: `docs/pass-through-pattern.md`.

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
// GOOD (the BAD version early-returns before useMemo — crashes when conv flips)
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

Moved to `docs/architecture.md` (kept AGENTS.md under the startup-context
size limit). Read it before changing the provider seam, the
`vendor/agent-cli-tool` submodule, adapter persistence, or conversation
lifecycle. Headline rules: the submodule is a thin wrapper (one canonical
request in, one unified event stream out; harness differences live at the
edges, never in the generic executor), persistence is registry-first, and
server state is authoritative while a provider process is active.

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

Moved to `docs/pass-through-pattern.md`. Read it before adding any
per-conversation setting whose accepted values are bespoke per provider/CLI
(effort levels, sandbox policies, etc.). Headline rules: wire/storage is plain
`z.string()` (never a shared enum); the submodule knows the FLAG, not the
VALUES; per-provider `as const` lists + validator/default helpers live in
`shared/src/index.ts`; defaults are server-side; every hop is identity on the
value. Operational steps: "Adding a per-conversation setting" checklist above.
