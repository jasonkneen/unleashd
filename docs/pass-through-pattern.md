# Pass-through pattern for provider-bespoke values

Moved out of AGENTS.md (startup-context size limit).

Use this pattern for **any per-conversation setting whose accepted values are
bespoke per provider/CLI** (effort levels, reasoning modes, sandbox policies,
output formats, anything the upstream CLI owns).

**Canonical example: `reasoningEffort` (claude `--effort`, codex `-c model_reasoning_effort=`).**
Each CLI accepts a different set, and those sets change as vendors ship updates.

## Rules

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

## Adding a per-conversation setting (quick checklist)

For settings that differ per provider (effort levels, reasoning modes, sandbox
policies, etc.), confirm each of the 7 touch points before committing:

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

Full rules and anti-patterns below.

## Anti-patterns (don't do these)

Violations of the rules above in their most common disguises: a shared
`z.enum([...all providers...])` on the wire; a `valueMap['medium'] =
'moderate'` translation in the submodule; `useState('high')` UI defaults;
async `useEffect` resets on provider change (races user clicks — reset
synchronously in the click handler).
