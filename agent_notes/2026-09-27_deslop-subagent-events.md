# One native sub-agent event path

Scope: the live Codex child-state path from agent-cli into the turn runtime.
The generic Claude/Gemini inference path and historical transcript ingestion
have different inputs and remain separate.

## Before / after

Before: a completed Codex `collab_tool_call` becomes both a raw `tool.use`
payload and a normalized `subagent.state`. The runtime ignores the latter,
re-parses the former, normalizes status/message again, and sends several
patches for one update.

After: the provider parser alone maps the raw record to `subagent.state`:

```ts
{
  type: 'subagent.state', id: 'child-1', operation: 'spawn',
  operationId: 'item_1', status: 'pending', rawStatus: 'pending_init',
  description: '[Codex Agent] Write file_1.md', message: 'Pending initialization'
}
```

`operation` is spawn / wait / message; `operationId` is absent when the harness
omits it, not fabricated. Description is a display label supplied by the
adapter; missing raw prompts retain the existing fallback labels. Raw status
is diagnostic information. The app consumes only the canonical status.

The existing exhaustive event dispatcher sends this variant to one native
state handler. That handler owns the live row, counts observed non-spawn
operations once per child/operation ID, and publishes one final patch. It
does not inspect a provider name, tool name, JSON shape, or raw status.

Started collab calls still emit a tool line. Completed collab calls with
identified children emit child states only, eliminating the second
representation. A childless completed attempt stays a tool event: no child
identity is invented, and restricted consumers still see the attempt. It now
gets a transcript line instead of silently disappearing. Parent tools are
not evidence of work by a particular native child: the native fold no longer
attributes arbitrary parent shell calls to whichever child is first running.

## Deletion and preservation

- Remove the app's Codex payload interfaces, structural checks, child-ID
  extraction, status normalization, action formatting, and broadcast wrapper.
- Replace the Codex raw-tool fold with the typed native-state handler.
- Replace completed collab tool events that identify children with native states
  and update the contract tests; retain started events and childless attempts.
- Replace helper-shape tests with raw-provider → parser → runtime assertions.
- Preserve child identity, descriptions, observed interaction counts, status
  provenance, terminal timestamps, and native children surviving parent
  completion. Distinct follow-up operations may reopen a completed child;
  duplicate operations must not reopen it or increment its count.
- Retain the recorded Claude Agent/background-task tests, generic parent
  completion, timeout, queue, and joined-drain regressions.

The consumer audit also keeps native child events meaningful to the agent-cli
heartbeat and disallowed by the existing no-tools reply gate/read-only memory
reviewer. These are contract consumers, not new policies.

No storage, UI, provider invocation flags, or live-runtime changes belong to this
slice.


## Result and validation

Implemented in `refactor/deslop-subagent-events`, based on app `325801b` and
agent-cli `7983ed4`. The app no longer extracts Codex collab fields, normalizes
Codex status/actions, or inspects a fallback description string to decide
whether a spawn supplies a description. There is one final row patch per
accepted child observation. Replays with an operation ID are ignored per
child within the turn; records without an ID remain ordinary observations.
A distinct follow-up can reopen a completed child and clears its old terminal
timestamp. Terminal rows consistently show Done/Error.

Source change across BOTH repositories: **188 fewer lines** (app −204,
agent-cli +16). Tests: net +136 lines. No Rust or generated source changed.
This is a bounded live-event cleanup, not deletion of the entire 582-line
footprint identified in the review. No claim is made about total-repo shrinkage.

Checks against the prepared change:

- `pnpm --dir vendor/agent-cli-tool build` passed.
- `pnpm --dir vendor/agent-cli-tool test`: 286 passed. Opt-in live-provider
  suites were not run; no paid model calls were needed.
- `pnpm exec tsx --test server/test/conversation-runtime.test.ts
  server/test/subagent-tools.test.ts server/test/buddies-v2.test.ts`:
  60 passed. Includes parser-to-runtime child lifecycle/replay/multi-child
  checks, malformed ingress, the recorded Claude background Agent stream,
  Buddy memory/reply gates, timeouts, queue preservation, and joined drain.
- `rtk proxy pnpm run typecheck` passed (the actual repository script,
  including client `tsc -b`, server/test and agent-cli). Bare
  `rtk pnpm typecheck` incorrectly ran root `tsc` help and exited 1; it is
  not counted as validation.
- `git diff --check` passed in both repositories.

Local logs: `/tmp/unleashd-deslop-server-tests.log` and
`/tmp/unleashd-deslop-cli-tests.log`. The shared checkout and live server
were not changed. Historical ingestion and generic provider inference remain
outside this slice. No browser or real-provider validation was performed.

Agent-cli candidate commit: `ff1721347b4279bb4a77f117341651f8db22ba40`
(clean checkout; tested source matches that commit), published on
`origin/refactor/deslop-subagent-events`. The app records that published pointer
in its isolated integration branch. Main and the live runtime are untouched.
