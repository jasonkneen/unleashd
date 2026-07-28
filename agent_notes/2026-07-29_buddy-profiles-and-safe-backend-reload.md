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
3. the current server stops the Buddy scheduler but does not signal active turns;
4. once all active turns finish, the current server flushes state and exits;
5. the watcher starts one replacement backend from the latest source.

Explicit `SIGINT`/`SIGTERM` is different: it is an intentional shutdown, so
active turns are stopped before exit.

## Deliberate non-goals

- No detached-process adoption or cross-process stream handoff.
- No per-task model routing yet. Automations, delegations, and reviews inherit
  the executing Buddy profile.
- No reload timeout: long-running turns are more important than immediate
  backend replacement during development.
