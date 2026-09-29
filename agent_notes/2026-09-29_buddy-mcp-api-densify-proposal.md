# Buddy MCP API: densify runs, keep the tool shape (PROPOSED, 2026-09-29)

Status: **proposed** by Buddies Development Lead. Not yet decided by the owner.
Trigger: owner post in #buddies-dev replying to thread post_01a0e958-b41e-72f6-b76e-e5f989450034. A user
listed worker-overview gaps: (1) no workspace-wide active-worker query, (2) no task/summary/progress
without DM access, (3) no queue reasons or stale detection, (4) no browser/GPU/integration locks.
The owner asked to deslop and densify the API without growing its scope, for example with an "ALL"
key or one endpoint that takes params.

## Evidence (2026-09-29, local main eefe240)

- There are 14 MCP tools on one HTTP endpoint (`server/src/buddies/mcp.ts`). The "one endpoint"
  already exists. The question is really how many tools share it.
- `runs {list}` for this Buddy returned 60,164 chars for 20 runs. 49,459 of those chars (82%) are
  `outcome`, the full final answer of every run. Most of the remainder is ids and timestamps. This
  is the same problem as the open "oversized channel/task/run reads" item.
- The core already has a workspace-wide scope: `RunQuery::Live { workspace_id }` in
  `crates/unleashd-buddies/src/runs.rs` (list_runs). HTTP exposes it as `?liveInWorkspace=`. MCP
  hard-codes `{kind:'buddy'}` and a limit of 20. So the "ALL key" is a wiring gap, not new machinery.
- Why a run is queued is decided by one SQL predicate, the claim query in `runs.rs`, with seven
  conditions: not ready yet, buddy archived, background off, predecessor run unfinished, conversation
  busy, pool full, task paused. That reason is never returned to the caller.

## Proposal (smallest change set)

A. **`runs list` takes a scope.** The scope is `{buddyId}` | `{taskId}` | `{workspace}`. The
   workspace scope is the "ALL" key: every queued and running run in the workspace. List rows are
   summaries, with outcome cut to a short preview plus its length. `get` still returns the full
   run. This targets a list response under 5k chars. Removes gap 1 and most of the size problem.
B. **Queued runs carry a derived `waiting` reason.** It is a typed sum: `not_before{at}` |
   `background_off` | `after_run{runId}` | `conversation_busy` | `pool_full{active,max}` |
   `task_paused`. It is computed on read from the same predicate the claimer uses (one source, so
   the two cannot drift) and is never stored. Removes gap 3. "Stale" means a running run whose lease
   has expired, and recovery already reaps those.
C. **Run rows carry `taskId`, `purpose` and requester.** A lead can then see what a worker is for
   without reading the DM. Owner decision needed: a `purpose` written in a private DM becomes visible
   to everyone who can list the workspace's runs. The alternative is to show it only to members of
   that DM plus the owner.
D. **Optional tool-count trim:** merge `channel_rename` and `channel_archive` into one
   `channel_admin {change: rename|archive|restore}`, giving 14 → 13 tools. This follows the pattern
   `task_write` and `team_admin` already use.

## Rejected / out of scope

- **One mega-tool (`buddy({op, ...})`):** rejected. The schema tokens stay the same, while the model
  loses tool names as its selection signal, errors get vaguer, and per-tool authority (`writes`,
  owner-only `team_admin`) turns into runtime checks inside one handler. The current pattern (a noun
  tool plus a `kind` union) already is "one tool per noun, with params".
- **Browser/GPU reservations and integration locks (gap 4):** a new concept and real scope growth.
  They need a concrete incident count before being considered.
- **Live progress/heartbeat streaming:** out of scope. `startedAt` + `leaseExpiresAt` + the
  conversation link are enough for now.
- **Inventorying detached CLI workers:** by design these do not exist. Workers are Buddy runs, and
  the briefing forbids shelling out.

## Revisit if

A lead still needs more than one call to answer "what is running or waiting, and why" after A–C
ship, or measured list responses stay above ~10k chars.

## Successor, 2026-09-29 (still proposed): drop outcome from list rows, no summaries

The owner asked what "runs list" is, whether it can return less data, and whether summaries are
needed. I remeasured the same 20 runs (compact JSON): full rows 61,444 chars; without `outcome`
11,776; with only `id, status, input, taskId, startedAt, endedAt` 4,471. A preview is a new derived
field, and dropping `outcome` is simpler, so **A is revised**: list rows never carry `outcome`, and
`workspaceId`, `inputKey`, `leaseExpiresAt`, `readyAt` and `attempt` are dropped. `runs get` returns
the full record. What a worker is for comes from `taskId`/`purpose` (C), not from its output. The
owner has not yet decided on A–D.

## Successor 2, 2026-09-29 (proposed): the deslop design pass over all 14 tools

The owner asked for more related design and whether I can see the deslop tool. I can see
`~/.claude/skills/deslop/SKILL.md`. I applied its design steps (describe the system in one sentence;
merge things that have the same shape; each fact lives in one place with one way to change it; lists
return rows, not bodies) to the MCP surface. I did not run the full multi-agent program: 14 tools do
not justify boards and waves.

One sentence: *a Buddy reads and writes four things (posts, docs, tasks, runs), scoped to itself, a
task, or the workspace.*

- **E. Two ways to comment on a task.** `task_write {kind:'comment'}` (mcp.ts ~181) calls
  `core.post(..., {kind:'task'})`, which is exactly what `post {channel:{task}}` does. Delete the
  `comment` variant.
- **F. `answer` is a post.** It is a thread post that resolves a request. Fold it into
  `post {answers: requestId}`. The core keeps the single-answer rule.
- **G. One scope type shared by every list.** Use `{buddyId}` | `{taskId}` | `{workspace}` for
  runs, tasks and schedule. Today there are three shapes: runs `buddyId?`, tasks `mine/owner/workspace`,
  schedule `buddyId?`. The "ALL key" generalises into this one type.
- **H. Lists return rows, bodies come from get, everywhere.** This is the same rule as protocol v3
  (ConversationRow list plus detail on open). Apply it to tasks (workspace view) and team as well as
  runs. It closes the open "oversized reads" item, where one read reached 82k chars.
- **I. One name for the discriminant wrapper** (today: action/view/write/change/read). Cosmetic, so
  do it only if it rides along with E–H.

Tool count with D+F: 14 → 12. Still rejected: a single mega-tool, locks, heartbeat.

## Successor 3, 2026-09-29: honest sizing (the owner asked about code/type reduction, ease of use, composability)

- **Code:** `server/src/buddies/mcp.ts` is 665 lines. Estimated deltas: D −6, E −20, F −12, G −15..−25
  (G also deletes the duplicate `BUILDER_TOOLS.tasks` schema, since the Builder only differs by
  having no "mine" default), A +5, H +25 (row projections), B +~20 in Rust. B is +~20 only if the
  claim predicate becomes one `waiting_reason` SQL expression with claim = `reason IS NULL`; a second
  copy of the conditions would be far larger and could drift. Net is about −40..−60 lines (~7–9%).
  That is modest, and the real reduction is elsewhere.
- **Types:** 14 → 12 tools. Four scope shapes (TaskView with mine, the Builder TaskView, runs
  `buddyId?`, schedule `buddyId?`) become one Scope. Comment paths go from 2 to 1 and answer paths
  from 2 to 1. B adds one sum type (the waiting reason).
- **Bytes:** a runs list drops about 14× (61k → 4.5k measured). Per-turn tool schemas shrink by an
  estimated ~10%, which is unmeasured.
- **Composability:** every list takes every scope, which gives runs by task and schedules across the
  workspace, neither possible via MCP today. Every list returns ids that feed straight into
  `get`/`post`/`task_write`. There are no new verbs.

## Successor 4, 2026-09-29: clarifying E (tasks are not channels)

The owner asked whether tasks are channels. They are not. A task is its own `task` row. Its comment
thread is a `channel` of kind 'task', linked 1:1 by a UNIQUE `task_id` (`schema.rs` ~61), and the
comments are `post` rows, a result of the 2026-09-26 merge of posts. E removes only the duplicate
write tool for those comments. Side finding: the channel-list query (`posts.rs` ~407) also returns
task channels the reader has read, so they can appear in `inbox` channel lists. I have not checked
whether the client filters them. A possible small fix is to list only public and direct channels.
Alternative to E, not recommended: keep `task_write comment` and drop `{task}` from `post`.

## Decision, 2026-09-29: ACCEPTED by the owner ("Go ahead, looks like a good cleanup")

The owner accepted A, B and D–H, plus deletion of all dead code these changes leave behind, across
the TS and Rust layers. The MCP tool layer is TypeScript only (`server/src/buddies/mcp.ts`, tables
BUDDY/TEAM/BUILDER/REVIEWER_TOOLS). The logic it calls is the Rust crate `unleashd-buddies` (napi),
which has no MCP code of its own.

Defaults the lead chose where the owner did not decide:
- C: rows carry `taskId` and requester. Showing `purpose` across the workspace stays open.
- I: included if cheap.
- The task-channel listing side finding stays a follow-up, not part of this change.

Constraint: at decision time 28 files were dirty from a concurrent session, including
`crates/unleashd-buddies/src/{runs,schema,team,store,types}.rs`. The engineer works in its own
worktree branched from HEAD (eefe240). Pushing needs a separate owner OK.

## Successor 5, 2026-09-29: first pass reviewed; owner asked to finish and merge to main

Worker commit b2592df on `feat/mcp-densify`, parent eefe240. Details:
`agent_notes/2026-09-29_buddy-mcp-api-densify-implementation.md`.

Measured results:
- runs list: 50.8k → 5.2k chars.
- team list: 4.4k → 2.4k chars.
- tools: 14 → 12.
- Tests: typecheck pass; crate 35/35; server suite 226/0 when run serially.

The lead did not merge it as-is, for four reasons:
1. Main moved. c977f68 removed `background_enabled`, so the `background_off` reason and its test
   are dead. The endpoint test is retargeted to `task_paused`.
2. The net delta is +419 lines, against my estimate of −40..−60. Sizing successor 3 was wrong about
   the direction: Rust types, indexes and tests dominated.
3. `list_run_rows` is a partial function over `RunQuery`. It gets its own RunScope.
4. `requester` has a silent fallback to 'owner'.

The tasks workspace list is still 165k chars (524 rows, all statuses). The default open-only size
has been requested; paging is a separate follow-up.

The owner's instruction is "finish this all and merge to main": a local fast-forward merge only.
Pushing still needs its own OK.

## Successor 6, 2026-09-29T06:46Z: the merge worker was killed; resumed

The run started at 06:21 (`run_01a0ebd2-f2c4`) failed with "killed" at 06:25Z. Before dying it had:
- rebased the branch to d0f57f3 on main 1bbb554;
- left uncommitted fixes in the worktree (background_off removed, pool count computed once).

d0f57f3 is broken: `WAITING_REASON_SQL` still reads `b.background_enabled`, a column main dropped in
c977f68. Merging it would make every run claim fail. It was therefore not merged.

The owner asked again whether everything can go to main. Answer given: not yet. A resume worker was
launched (request post_01a0ebea-3090) from the worktree state, with an instruction to commit
work-in-progress to the branch if killed again. The kill cause was not investigated.

## Successor 7, 2026-09-29T07:00Z: densify is on local main; handed to Product Development Lead for an Opus review

Correction to successor 6: the resume worker did finish the merge. Main is 888861c, which is origin
1bbb554 + d0f57f3 + 888861c ("finish MCP densify rebase"). At the commit:
- `background_enabled` appears in `runs.rs` only in a comment;
- `RunScope` exists.
The branch carries one more commit, fb1e307 (comment only). The worker never posted its test report,
so main is NOT verified. The net diff against 1bbb554 is +654/−194.

The owner asked for Product Development Lead, on Claude Opus, to review the MCP surface, the pending
commits, the dirty tree and the worktrees, and then complete and merge all work. PDL's profile runs
codex gpt-5.6-luna and PDL does not report to this lead, so the lead cannot spawn a worker on PDL.

Route taken: a Task owned by PDL (task_01a0ebf5-38df-7456-a0ef-a6a7bc38bdfe) and a DM request
(post_01a0ebf5-5fc0) asking PDL to run the work as a self-worker on claude-opus-5-5 (high). The
alternative, an owner `team_admin` change of PDL's profile model, was offered to the owner and not
taken by the lead.

Worktree snapshot:
- `refactor/deslop-{collab-fix,content,diagnostics,records}`: one unmerged commit each, 68–71 behind.
- deslop-systems, threads-view, buddy-harness-memory-off, re/trial-merge: fully merged.
- Two /tmp baselines.
- No push.

## Successor 8, 2026-09-29T07:25Z: lead review of 1bbb554..d08aa7b

PDL (Opus) merged and verified d08aa7b, which is 11 commits ahead of origin and not pushed. The
lead reviewed `mcp.ts` and `runs.rs`, `posts.rs` and `tasks.rs`. Two blockers were sent back to PDL
by mention (post_01a0ec0d-9322):
1. `{workspace: <any id>}` widens the audience. The old Buddy tasks workspace view was pinned to
   `grant.workspaceId`.
2. The workspace run list is still capped at 20.
Everything else was accepted. The pre-existing cross-workspace `{buddyId}` and `runs get` reads
were filed as task_01a0ec0d-a93c (it needs the owner's go). Details:
`agent_notes/2026-09-29_mcp-densify-lead-review.md`.
