# Buddy profiles and active-turn-safe backend reload

## Completed

- Added an editable execution profile to each Buddy detail page.
- Added a validated Buddy profile API using the existing store-level `updateBuddy` authority.
- Set Growth Lead, Growth Operator, Growth Engineer, and Go-to-Market Critic to:
  - provider: `codex`
  - model: `gpt-5.6-luna`
  - reasoning effort: `high`
- Replaced `tsx watch` for the backend with `tools/watch-server.mjs`.

## Backend reload contract

The server that starts a provider turn remains the sole owner of its child
process, stdout/stderr stream, parser state, and conversation buffers. A live
turn is therefore never handed to a replacement server.

On a backend source change:

1. the watcher sends one IPC reload request;
2. further source changes are coalesced;
3. the current server pauses the Buddy scheduler but does not signal active turns;
4. once all active turns finish, the current server flushes state and exits;
5. the watcher starts one replacement backend from the latest source.

Explicit `SIGINT`/`SIGTERM` is different: it is an intentional shutdown, so
active turns are stopped before exit.

## Lifecycle invariants

There is one server lifecycle authority:

- `starting` admits no mutations while persisted conversations hydrate;
- `idle` accepts WebSocket commands and mutating HTTP requests;
- `reloading` accepts no new mutations, pauses the Buddy scheduler, and lets
  already-admitted commands and provider streams finish;
- `shutting_down` interrupts owned turns for an explicit process shutdown;
- `exiting` flushes durable state exactly once.

Startup follows one order:

1. initialize durable services;
2. hydrate persisted conversations;
3. start the Buddy scheduler;
4. release the hydration barrier for commands and announce load completion;
5. start file polling.

Initial WebSocket snapshots are explicitly marked as summaries and may grow
progressively during hydration. They never contain full transcripts. Opening a
thread fetches its canonical detail through one HTTP route, while commands wait
for the hydration barrier. A loader-wide hydration failure terminates startup
without starting the scheduler, releasing command readiness, or starting the
poller.

Conversation detail uses one cross-transport freshness rule. The client records
the current conversation object before starting the HTTP request; if any
structural WebSocket event replaces that object before the response arrives,
the detail request is retried. The final identity check and detail application
are synchronous. This prevents an older HTTP snapshot from overwriting newer
messages, status, queue, or configuration without inventing a second revision
protocol.

HTTP mutations and WebSocket commands take a short lifecycle lease while they
dispatch. Reload waits for those leases as well as active provider turns, so a
command already awaiting durable I/O cannot create work after the old backend
has decided it is safe to exit.

An automation run remains active across its whole prompt/sequence/loop, not
only while one provider subprocess is alive. Reload therefore drains the
scheduler's active-run set too. `pause()` stops new claims and preserves those
runs; only explicit shutdown uses destructive `stop()` cancellation.

Polling treats in-memory active conversations as authoritative. It does not
advance a dirty file baseline when that file is active or fails to parse, so
the next poll retries the same state. Poll cycles are coalesced, and tracking
cleanup runs on idle cycles as well as cycles containing updates.

If the watcher cannot deliver its reload request over IPC, it stops the dev
runtime with an error. It does not silently restart the backend or continue in
an ambiguous state.

## Deliberate non-goals

- No detached-process adoption or cross-process stream handoff.
- No per-task model routing yet. Automations, delegations, and reviews inherit
  the executing Buddy profile.
- No reload timeout: long-running turns are more important than immediate
  backend replacement during development.
