# Delivery PM: channel closeout audit, 2026-09-28

Scope: all ten public channels visible to this Buddy, recent top-level threads and
replies (September 25–28), the 107 currently open workspace Tasks, and Git refs
after `git fetch origin --prune`. This is an evidence and handoff record, not a
claim that the software or launch is released. Current Tasks remain the status
authority. Older #buddy-repairs and #buddies-dev posts are historical: Tasks
6efaffd1, 40cf0d8d, 95592e35 and d157d274 now say done, so do not reopen
them from old channel summaries.

## Work still open or not yet evidenced

| Workstream | Observed state and missing proof | Accountable next action |
| --- | --- | --- |
| Channels release and video | Release Task `buddy_project_0bcad28f` is in progress with no evidence; its recording todos remain open despite later footage in #unleashd-2. `product/releases/launch-2.0/LAUNCH_CUT_PLAN.md` explicitly says there is no finished current master. It names a missing localhost app shot, copy/retiming, privacy and end-to-end review. `origin/main:package.json` is still 1.1.0; no release commit/version/test record is attached to the Task. | Release Engineer owns the release Task: reconcile footage todos with clip paths, name the software candidate and its committed test evidence. Marketing Designer owns the master render and privacy review. Owner reviews the full export before publish. Source threads: `post_62a6fa1c`, `post_01a0e6cc`, `post_649c1cdf`, #releases `post_b84bc931`. |
| Tracked Buddy workers | `0d50d2f` plus test fix `de03fd5` are on local main; Lead reported crate/server tests and a throwaway live run in #bugfixes `post_01a0e742`. Task `task_01a0e744-519a-750a-bde0-25b85050641c` still says merge needed, so its next action is stale. These commits are absent from fetched `origin/main`; no live production/backend reload proof is recorded. | Release Engineer and Buddies Development Lead reconcile Task with the landed local commits, verify the loaded backend and a live thread spawn, then coordinate integration with the release owner. Do not call it released. |
| Claude Buddy auto-memory | `c08d9e6` exists on clean `buddy-harness-memory-off`, one commit beyond local main. Task `task_01a0e824` remains open. The six stale harness notes migration and live no-`memory/` transcript check in its done criteria have no Task evidence. | Release Engineer owns completion; coordinate the branch with Lead, then record exact commit, docs migration, tests and live check. |
| Mobile and Channel fixes | #bugfixes `post_01a0e6bb` reports keyboard/PWA fixes but owner asks whether committed and pushed, with no later answer in that thread. The root tree still has changes in `client/src/main.tsx`, `client/vite.config.ts`, mobile shell/style files, and PWA/test files. `post_01a0e6bf` (image viewer) and `post_01a0e6e1` (fresh-context layout) likewise describe working-tree fixes; no attributable commit is cited. | Product Development Lead owns the edits: answer the owner with commit/push status, commit coherent files only, verify the committed version and physical mobile behavior. Existing mobile UI Task `buddy_project_8b8ebb68` has physical iPhone review pending; add these new issues to that owner-owned tracking or a narrowly scoped successor. |
| Channel UI review queue | Search `task_01a0e340`, GPT-6 picker/default `buddy_project_e753a8cc`, archive `buddy_project_df417ed0`, DM UI `buddy_project_a978f8e4`, task overlay `buddy_project_df45d050`, reply text `buddy_project_d612b353`, unread `buddy_project_cbd6043b`, automations `buddy_project_77f5bc70`, server refresh `buddy_project_18b62ac3` and Buddy archive `buddy_project_4c7c0e4e` are all still review. Several explicitly need a safe backend reload or live owner check. Archive's `53ebe1c` is now ancestor of both local and remote main, so the Task's "integrate phone commit" next action is stale; live verification remains. | Product Development Lead owns the review queue: use the existing reload Task `buddy_project_d6b661c3` to test each feature on the loaded backend and update source Tasks. Avoid treating screenshot/test reports from a dirty tree as commit verification. |
| Buddy reply and thread continuity | `buddy_project_95e0dcdb` remains in progress: Claude task events, follow-up replies and the 60-minute idle-watchdog guard are open. `buddy_project_78fc1d42` says new readable Tasks reset a seat. #channels-feature `post_01a0e73a` diagnoses new seats on model/effort changes and proposes a small fix; the latest reply is a design estimate, not an implementation. `buddy_project_26eab07c` and `buddy_project_6bab4f15` remain open. | Product Development Lead and Buddies Development Lead decide whether model/effort seat reuse belongs on an existing thread-seat Task, then verify resumed sessions and worker progress through the real boundary. |
| Install/update path | `buddy_project_d5d94e0e` and `buddy_project_85f41c44` remain in progress. Fresh-install trial, Node floor, README, default installed provider, update restart/submodule steps and live upstream popup checks are open subtasks. #upstream has no posts visible to this Buddy; no release-ready install claim is supported. | Product Development Lead owns install proof. Release Engineer should gate the public release on a clean fresh-install trial and the chosen update path. |
| Read tool limits | `task_01a0e746` is open after `channel_read`, `tasks`, and `runs list` exceeded a harness result limit; the requested post/permalink read and byte-bounded paging are not yet evidenced. | Release Engineer owns the implementation and MCP integration proof. |

## Integration and preservation risks

- Fetched `origin/main` is `921c8b5`; local `main` is `aaf0ca0`, 9 commits ahead and
  25 behind. Neither is an ancestor of the other. Local main includes worker spawn
  and the About card; remote main includes the Threads view and integrated deslop
  slices. The release owner must reconcile them before any main push or release.
- Local main has 35 dirty paths. This includes untracked PWA files and notes and
  changes to `server/src/buddies/mcp.ts`, `server/src/server.ts`,
  `server/src/conversations/runtime.ts`, `client/src/components/buddies/ChannelBrowser.tsx`,
  and `client/src/mobile/channels/ChannelsMobile.tsx`. A clean-tree check cannot
  currently establish that running tests verify HEAD. Stage file by file and check
  the intended commit directly.
- The clean `buddy-harness-memory-off` worktree has an unmerged local commit.
  Four deslop worktrees also have clean branch tips. Remote main has integration
  commits with matching subject matter; the original content/diagnostics branch
  commits have different patch IDs (`git cherry` reports `+`), so compare intended
  behavior and tests before removing those worktrees. Do not equate a similar
  commit title with identical content.
- File overlap against the dirty main tree: auto-memory branch touches four dirty
  server files; deslop content touches ten dirty client/server files; diagnostics
  touches `runtime.ts` and `server.ts`; collab fix touches the dirty runtime test.
  Sequence with the file owners before cherry-picking or merging. The `threads-view`
  worktree is clean and its HEAD equals fetched `origin/main`.

## Coordination decisions

1. Release Engineer: publish a current integration order for remote Threads/deslop,
   local worker/About work, auto-memory branch, and dirty UI/server edits. Keep
   authorship and exact committed test evidence. No push to main is implied here.
2. Product Development Lead: reconcile stale review next actions, especially
   archive and worker Tasks, and answer the owner's mobile committed/pushed question.
3. Marketing Designer and Release Engineer: update the launch Task from recorded
   footage and current cut plan, then deliver one full film and one named software
   candidate for owner review.

No recurring monitoring schedule was configured by this audit.
