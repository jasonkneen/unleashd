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

## Successor 2026-09-28 ~09:10Z: why Wave Simulation Lead was confused (transcript evidence)

The owner asked for the transcripts. The thread turns ran on the Claude harness:
`~/.claude/projects/-Users-nicholasbardy-git-wave-sim/fef563b6-4c1b-49a4-8729-34129e8d9f8f.jsonl`.

1. 08:54:50Z: before planning, it read three of its harness auto-memory notes
   (`~/.claude/projects/-Users-nicholasbardy-git-wave-sim/memory/`):
   - `reference_buddy_provider_harness_selection.md` and `reference_buddy_dispatch_claude_provider.md`
     (Sep 17–21) describe `send` with `delivery.config {provider, model, reasoning}` as the
     supported per-assignment model pin. The lean rewrite deleted that tool. These notes live
     outside Buddy memory, so nothing updated them.
   - `feedback_detached_workers_outlive_turn.md` (Sep 26): Agent-tool subagents die when a Buddy
     turn ends, so launch detached setsid+nohup workers. This workaround is still in force.
2. 08:55:59Z: it smoke-tested `codex exec -m gpt-6-sol` and got SOL_OK, then launched 4 detached
   workers at 08:58Z. At 08:59:51Z it saved a new memory claiming "the Buddy toolset in
   #simulations turns has no send". That framing is channel-specific and wrong: every Buddy turn
   has the same tools.
3. 09:04:43Z: `ToolSearch "+unleashd_buddy send work dispatch run start"` found no `send`. It
   corrected itself at 09:05Z.
4. **Missed path:** it has four direct reports already on `gpt-6-sol`/high: CUDA Simulation
   Engineer, Simulation Geometry Engineer, Simulation Measurement Engineer and Marine Mechanics
   Engineer. The CUDA, WALLS (geometry) and PROBES (measurement) briefs match three of them. A DM
   `request` to each would have given tracked Sol runs, visible in the UI and cancellable, with the
   answer waking the lead. It gave up two things: xhigh effort and a fresh identity. It never
   checked `team`.
5. Tool results overflowed three times this turn and needed Python on saved files: `tasks` 72k
   chars, `runs list` 57k chars. My own `channel_read` of the thread was 63k chars.

Root causes: (a) the missing worker-spawn tool (Task task_01a0e744); (b) stale harness memory
that still describes the deleted `send`; (c) unbounded read tools that overflow the harness
result limit.

## Successor 2026-09-28 ~09:20Z: fixes proposed to the owner (lead recommendation, not yet accepted)

Owner asked for obvious fixes, both to the confusion and to the system.

1. Worker spawn tool: task_01a0e744. This removes the reason to detach processes.
2. The briefing names the delegation path (`server/src/buddies/briefing.ts` tools paragraph). For
   parallel work, DM-request a report (`team` shows each model), or spawn a worker once (1)
   lands. Never launch agent CLIs outside Buddy runs: such runs are invisible and can't be
   cancelled. Added to task_01a0e744 so the line names the real tool. It needs `pnpm token-audit`
   before and after.
3. **Owner decision needed:** harness auto-memory inside Buddy turns. A Claude-harness Buddy turn
   runs in the workspace cwd, so it reads and writes `~/.claude/projects/<repo>/memory/`. Every
   Buddy in that repo and the owner's own sessions share that store. It is a second memory that
   nobody curates, next to Buddy memory (docs/patterns.md one-store), and it held both the stale
   `send` instructions and the detached-worker recipe. Recommendation: turn it off for Buddy turns
   and move durable facts into the owning Buddy's docs. I have **not** verified that a supported
   switch exists; that's an engineering todo.
4. Sweep: 6 harness memory notes in 4 repos name removed Buddy tools (wave_sim ×2,
   unleashd ×2, stock-trader, basketball-model). I fixed the one unleashd note that gave
   instructions (`unleashd-concurrent-buddy-project-state.md`). The other unleashd note and the
   stock-trader/basketball ones are historical incident records. Wave Simulation Lead owns the two
   wave_sim notes (request post_01a0e746-c189-7673-a32e-934a5b0265f4).
5. Bounded reads and permalink reads: task_01a0e746.

## Resolution (Buddies Release Engineer, branch `buddy-work-runs`)

Smaller than the proposal: **no new post kind**. A request to a self-only DM already made the
author owe the answer (`ask()` in posts.rs), so `request` + Post run + answer + Reply run was
already the spawn-and-return path. What was missing:

- `RunConfig {provider, model, reasoningEffort?}` on `PostInput.run_config` → `EnqueueInput.config`
  → `run.config` (JSON column, added on open to existing files). Only on a request, and every
  recipient must pass `EnqueueRun` (self or a transitive report), so a peer can't move a Buddy off
  the model the owner picked. The runner opens the worker conversation with it
  (`openBackground({config})` → `workerConversationConfig`).
- MCP `post` takes `worker`; `checkedRunConfig` validates against the provider catalog and names
  the valid models/efforts on error. `channel.direct: []` is now allowed (you alone).
- A Buddy's `runs cancel` now stops a running turn: a `cancelled` bus event the runner handles
  (previously only the owner route called `host.stop`; the Buddy path only marked the row).

Known gap: a worker spawned from a thread seat or owner chat (foreground) returns to the DM
inbox, not as a turn in the seat (existing `returnJob` rule: human chats take no automated input).
The seat is not re-woken. Waking it would need a seat-audience input kind; decision left open.

Deploy dependency: the live `buddies-v3.sqlite` has already lost `run.retry_of` (another session's
uncommitted `drop_run_retry_of` ran against it), so HEAD code, this branch included, cannot start
the runner on live data until that drop is committed. Merge it first; this branch reads `config`
by column name, so its index shift does not conflict.

## Successor 2026-09-28 ~13:10Z: owner accepted; landed

**Owner decision** (#bugfixes, reply "Go ahead yea" to post_01a0e7af-f0fa-7678-b861-c5d70b63f06a):
merge `buddy-work-runs`, restart the backend, and turn off harness auto-memory for Buddy turns.

- `3f3cc3e` commits the concurrent session's `run.retry_of` drop. It had been uncommitted since
  2026-09-27 22:40 local and was already applied to the live DB. It's a separate commit so the
  authorship stays legible.
- The branch was rebased onto it. Conflicts in runs.rs RUN_COLS and schema.rs `open()` were resolved
  by keeping both: no retry_of, plus config. The new integration test failed 5 of 6 full-suite
  runs. That was a test race, not a product defect: `runOf(b())` threw before the spawn posts
  existed, and `until` can't retry a throw. Fixed in `de03fd5`. After the fix: 212/212 pass (1
  skipped), crate 30+2+1 pass, `pnpm typecheck` exit 0 on the branch and on the live tree.
- main was fast-forwarded to `de03fd5` without touching other sessions' dirty files: `git apply`
  to the tree, `git apply --cached`, check that write-tree equals the branch tree, then
  `reset --soft`.
- Restart: no `dev:replace`, which orphans seat turns. The addon was renamed into place (21:10
  local), and watch-server drains the backend once running turns finish, then reloads.
- Harness memory: Claude Code 2.1.283 has `CLAUDE_CODE_DISABLE_AUTO_MEMORY` (truthy → off), plus
  settings `autoMemoryEnabled`. The canonical ProviderRequest has no per-request `env`, so scoping
  it to Buddy turns needs a submodule change or a runner env. That's handed to Release Engineer
  rather than done in this turn.
