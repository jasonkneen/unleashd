# MCP densify + pending work — independent review (Opus), 2026-09-29

Task: task_01a0ebf5-38df-7456-a0ef-a6a7bc38bdfe. Request post_01a0ebf5-c5f3. Read-only review:
nothing committed, pushed, restarted, reset, stashed or rebased. A throwaway detached worktree at
fb1e307 was created for verification and removed afterwards.

## State
- main = fb1e307 = origin/main 1bbb554 + d0f57f3, 888861c, fb1e307 (3 unpushed). Submodule pin b894b45
  = origin pin; the submodule has no unpushed commits.
- feat/mcp-densify == main, but its worktree has 4 uncommitted follow-up files and live processes
  (biome, rustc) — an active session.

## Verification AT THE COMMIT (clean detached worktree fb1e307, submodule b894b45)
- `pnpm typecheck`: exit 0, 0 `error TS`.
- `pnpm test:server`: 227 tests, 226 pass, 0 fail, 1 skipped.
- `pnpm test:client`: 209/209 pass.
- `cargo test --no-default-features`: unleashd-buddies 35 pass (3 unit, 31 core, 1 query_plan);
  unleashd-ingest 56 pass; 0 failed. (A plain `cargo test` does not link the napi symbols; that is
  expected and documented in the crate, not a product failure.)

## MCP surface findings (ranked)
1. REGRESSION — task comments lose `task_id`. The old `task_write {kind:'comment'}` posted with
   `taskId: write.taskId` (1bbb554 mcp.ts:184-189). The replacement `post {channel:{task:X}}` passes
   `input.taskId` (undefined) and `insert_post` stores it verbatim (posts.rs insert_post). The Task
   feeds on desktop and mobile (`taskPostsFeed` → `GET /api/buddies/tasks/:id/posts` →
   `task_posts` `WHERE p.task_id = ?1`) no longer show Buddy task comments. `taskDetail` still shows
   them, because it reads the task channel. The test at buddies-v2.test.ts:1861 only asserts
   `isError === false`. Fix: in the crate, a post in a Task channel takes the channel's task_id, and a
   different explicit task_id is refused. Regression test: a comment made via `post {channel:{task}}`
   appears in `core.taskPosts(OWNER, taskId)`.
2. MISSING IDS — list tools now require an explicit scope ({buddyId}|{taskId}|{workspace}), but the
   committed briefing never states the Buddy's own buddyId or workspace id. The densify worktree's
   uncommitted briefing.ts adds `Your ids: buddyId …, workspace …` — land it.
3. STALE BRIEFING IN RESUMED SESSIONS — `memoryGeneration` (briefing.ts:120) hashes only
   name/role/soul revision plus memory revisions. The turn policy re-briefs only when that changes
   (turn-policy.ts prepare()), and the briefed generation is persisted. So every existing Buddy
   session keeps the OLD tool guide (`answer`, `tasks view mine`, `task_write comment`) after
   deploy, and would never see finding 2's ids line. Fix: include a hash of BUDDY_TOOL_GUIDE (and
   the ids line) in `identity`. The cost is one re-brief per session per guide change.
4. SILENT DROP in `post {answers}` — `kind`, `replyToId`, `taskId` and `purpose` are silently ignored
   on the answer path. The uncommitted densify-worktree fix enumerates the dropped fields at runtime.
   A cleaner shape removes the accidental optionality (`channel` became `.optional()`): make the
   schema a strict union, `{channel, …post fields}` | `{answers, body, evidence, key}.strict()`. Zod
   then refuses the extra fields and `if (!ref) throw` disappears.
5. INCONSISTENT SCOPE SEMANTICS — `runs list {workspace}` returns only live runs (queued, running,
   cancel_requested), while {buddyId} and {taskId} include history. The tool description does not
   say so. Either document "workspace = live" in the description or make it consistent.
6. SCOPE AUTHORIZATION (low) — `listTasks`, `listRunRows` and `listSchedules` take no actor. Before
   densify, the Buddy `tasks` workspace view was pinned to grant.workspaceId; now any workspace id
   is accepted. This is not a new exposure in practice, since `team` already lists every workspace
   and the old `owner` view accepted any buddyId, but the boundary is now implicit. Decide whether
   Buddies may read other workspaces, and write the decision down.
7. MINOR — `requester` resolves to NULL when the referenced post is missing, a silent fallback on a
   data-integrity fault. The HEAD comment in tasks.rs justifies the unpause behaviour by "the test
   requires it"; the densify worktree's rewrite states the real reason. Land it.

WAITING_REASON_SQL: verified as a single definition. `claim_run_at` uses `(…) IS NULL` and
`list_run_rows` uses the same expression for queued rows. OK.

## Removal candidates (densify net +346 non-note lines)
- `RunScope` and `ScheduleQuery` are identical enums (types.rs) → one `ListScope` in the crate, one
  TS type, and the MCP `scopeQuery` adapter maps once.
- `RunScope::Workspace` duplicates `RunQuery::Live`, and Buddy/Task are duplicated too. The HTTP
  `runQueries` (routes.ts:292) could take `ListScope` plus `conversation`, leaving one run-list
  vocabulary. Check that BuddyRunList/BuddyWorkspaceActivity can use `RunRow` before dropping
  `listRuns` for those scopes.
- `run_active_buddy` is created twice: base schema (schema.rs:134) and LIST_SCOPE_INDEXES (IF NOT
  EXISTS). Keep only the ensure path, like TASK_LIVE_INDEX.
- `readTaskRows` maps the scope a second way (owner/children/workspace). Rename TaskQuery kinds or
  reuse one adapter.

## Dirty main tree (attributed)
- A: ChannelBrowser.tsx, ChannelArchive.tsx, channel-browser.test.tsx, mobile-channels.test.tsx —
  archived channels leave the rail and Channels opens a directory. Codex session
  rollout-2026-09-29T12-50-12-01a0eb7f (PDL, #bugfixes thread post_01a0e93f). Complete. Not
  commit-ready: channel-browser.test.tsx:84 carries a stale hunk from the Ctrl/Cmd+F search task
  (asserts text "Search"; the button is icon-only since 9757183/e4884ac), so 16/17 pass. Drop or fix
  that line, then commit A.
- B: server/src/http/filesystem-routes.ts, server/src/uploads/gc.ts — silence client hang-ups
  (EPIPE/ECONNABORTED/ECONNRESET) in sendFile, and boot the GC worker via require so tsx compiles it.
  Claude session 2e882867 (2026-09-28). uploads-gc.test.ts 2/2. Commit-ready; no regression test for
  the hang-up filter.
- agent_notes: densify-proposal → commit (the implementation record cites it by path; its SHA pin
  2ca6db24… no longer matches because the file gained sections). reload-starvation → commit.
  disk-cleanup .txt → do not commit (other-repo scratch).

## Worktrees (all read-only classified)
Nothing needs merging; `git branch --no-merged main` lists only the four deslop branches, whose
content main already has as rebased copies (collab-fix = 8b12230, content = 95ccb38 and built on
since, diagnostics = 7bd4565, records = 493bf27; range-diff differs only in context).
Remove: /private/tmp/unleashd-mcp-baseline-src, /private/tmp/unleashd-trial-merge (+branch
re/trial-merge-20260928), deslop-{collab-fix,content,diagnostics,records} (+branches, need `-D`
because hashes differ), deslop-subagent-events (+refactor/deslop-systems), watch-baseline,
~/git/unleashd-threads (+threads-view), ~/git/unleashd-work-runs (+buddy-harness-memory-off).
Keep: unleashd-mcp-densify (live session, 4 uncommitted follow-ups).
