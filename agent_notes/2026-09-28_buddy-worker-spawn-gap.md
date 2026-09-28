# Buddy worker spawn gap: no tool to launch a background worker run (2026-09-28)

Author: Buddies Development Lead. Status: owner asked for the fix ("fix it", #bugfixes,
post_01a0e742-cc2d-7489-b28f-b60addcf3a59). The design below is a **lead proposal**, not an
owner-accepted design.

## Trigger

In wave_sim #… thread post_01a0e430-3a83-740f-a209-d2ca1e878837, Wave Simulation Lead said "my
tools in this thread can't start Buddy runs" and launched four detached `codex exec -m gpt-6-sol`
processes (post_01a0e741-9fbf-7266-9a47-96a3db727f5a). Nothing tracks them: no run rows, nothing in
the Buddy UI, no correlated return, and `runs cancel` can't stop them. It corrected itself at
09:05 (post_01a0e742-db44-761b-a331-d4dfe4c763fc): it has the MCP tools, but no tool starts a
one-off run with a model it chooses.

## Findings (HEAD 3225f7a)

- Thread turns get the same tool set as every other Buddy turn: `toolsFor('worker')` in
  `server/src/buddies/mcp.ts`. The thread context doesn't restrict anything.
- A Buddy can only cause runs indirectly: a DM `request` (a Post run for the recipient), an
  @mention, or a `schedule`. All of them run on the **target's saved profile** model.
- It **cannot** start a run of itself, a parallel helper, or any run with a per-run
  provider/model/effort. `RunInput` (crates/unleashd-buddies/src/types.rs) is
  Chat | Post | Reply | Schedule | FailureNotice. It has no Work variant and no run config.
- The lean-rewrite plan did include it: `send {kind:'inform'|'request'|'work', limits}` in
  agent_notes/2026-09-25_lean-rewrite/02-buddies-server.md §8.3, and assignment-config →
  "a `run.config` column" (row 38). The shipped tools kept inform/request only. **I found no
  decision recording why `work` was dropped.** It reads as a gap, not a cut.
- CORE_DESIGN.md "Conversations, Workers and the return to the spawning call" (owner clarification,
  2026-09-14) still requires it: "The parent spawns work through an agent tool call". The worker's
  result must return against that call.

## Proposed smallest fix (reuse Post/Reply correlation; no new scheduler)

1. `post` gains `kind: 'work'` with a target of **self or a direct report** and optional
   `config {model, effort}`. The crate enqueues a Post run for the target, carrying the config
   (a `run.config` column, validated against the provider catalog, typed error on an unknown
   model, never a silent fallback to the profile).
2. The worker run's final text answers the work post. The existing Reply run wakes the spawner with
   the result correlated to that post. Completion, failure and timeout stay distinguishable.
3. Admission is the Buddy's existing pool (`max_active_runs`, 5). Worker runs show in the runs
   list and UI, and `runs cancel` stops them.

## Revisit if

The owner prefers owner-only model overrides (profile pinning), or workers need their own identity
separate from the spawner.
