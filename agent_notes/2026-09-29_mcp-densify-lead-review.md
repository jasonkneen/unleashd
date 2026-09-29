# MCP densify: lead review of 1bbb554..d08aa7b (2026-09-29)

Reviewer: Buddies Development Lead, at Product Development Lead's request (owner asked for a
lead review at the end). Scope: `server/src/buddies/mcp.ts`, `crates/unleashd-buddies/src/{runs,posts,tasks}.rs`.
Tests were not re-run by the lead; PDL reports d08aa7b verified at the commit (typecheck 0; server
227/0/1; client 210/210; crate 35 + 2 node; gates 9/9).

## Blocking

1. **Audience widening: a Buddy can now list another workspace's work.**
   - At 1bbb554 the Buddy `tasks` workspace view was pinned to `grant.workspaceId` (old mcp.ts ~353).
   - At d08aa7b, `scopeSchema {workspace: string}` takes any caller-supplied id and passes it
     unchecked to `listTasks`, `listRunRows` and `listSchedules`. None of these receive an actor.
   - Schedules carry `prompt` text, and run rows carry requester and input post ids.
   - This repeats the 2026-09-11 "privacy audience enforcement" defect class.
   - Fix: for Buddy-role tools, `{workspace}` means the grant's workspace; any other id is
     refused. Builder/team tools that span workspaces keep explicit ids.
   - Pre-existing and out of scope, recorded: `{buddyId}` and `runs get` of a run in another
     workspace were already unchecked before this change. The durable fix is to pass the actor
     into the crate's single `authorize`.
2. **The workspace "ALL" view is still silently capped at 20** (`listRunRows(..., 20)`).
   - This was the user's original complaint ("busy lists return only 20 recent runs").
   - The workspace can hold 17 Buddies × 5 pool, all live, so 20 does not give an exhaustive
     inventory.
   - Fix: raise the limit for the workspace scope (rows are about 250 chars, so 100 rows is about
     25k chars), and say when the result is truncated rather than dropping rows silently.

## Accepted

- **`WAITING_REASON_SQL`:** one definition shared by the claimer (`IS NULL`) and the list.
  `background_enabled` is gone.
  - Note: `ready_at <= ?` now sits inside the CASE, so the claim filters queued runs by status
    only. That is fine at current queue sizes; revisit if the queued count grows large.
- **`task_id_for_channel`:** the channel is the authority for a task post's identity, and a
  mismatch is refused. This closes the task-feed bug.
- **Unpause no longer bumps the epoch.**
  - It is consistent with the `task_write` description: pausing still cancels queued runs.
  - Runs queued while the task was paused now run after unpause instead of vanishing. Correct.
- **`requester`:** a null `author_id` maps to owner (owner posts), and a missing post gives null.
  There is no invented owner.
- **Size:** source is +363/−173 (net +190). This is not a line reduction; the win is response
  size and API shape. Recorded as such.
