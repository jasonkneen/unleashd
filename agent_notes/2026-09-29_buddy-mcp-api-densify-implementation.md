# Buddy MCP API densification — implementation record

Date: 2026-09-29

## Decision and provenance

Question: how should the Buddy MCP surface be made smaller without adding a new
coordination concept or changing the underlying HTTP/client capabilities?

Decision-maker: owner. Status: accepted. The owner's recorded acceptance was:
"Go ahead, looks like a good cleanup." The accepted scope is A, B, D–H from the
proposal, C limited to `taskId` and `requester` (not `purpose`), and I only if it
is cheap. The implementation starts from commit `eefe240`.

The proposal was uncommitted when implementation began, so this record preserves
its content identity rather than citing only a mutable path:

- Path: `agent_notes/2026-09-29_buddy-mcp-api-densify-proposal.md`
- SHA-256: `2ca6db24e98dfeb666cacf40ab383d627afa6c161381bc061ed2e0e59d78602b`
- Preserved decision excerpt: "Owner accepts A, B, D-H. C includes taskId and
  requester, but not purpose. I is conditional on being cheap. No new concepts,
  locks, or heartbeat."

## Implementation choices

- Runs, Tasks, Team, and schedules share the same Buddy/task/workspace scope
  shape. Runs, Tasks, and Team now use slim list rows with explicit detail reads.
- Queued-run waiting reasons and claim eligibility use one SQL CASE expression.
  A null reason is the claim predicate; list rows expose the non-null typed reason.
- `post` accepts an `answers` request id and performs the existing answer
  operation; the standalone MCP `answer` tool was removed.
- Task comments go through `post` to a Task channel; `task_write` retains only
  create/update. Channel lifecycle operations are consolidated into
  `channel_admin` with rename/archive/restore operations.
- Existing core methods remain because HTTP routes and runtime code still need
  them. No `purpose` field, lock, heartbeat, or new domain concept was added.
- I was not applied: renaming the remaining native wrappers was not a cheap local
  MCP cleanup because those wrappers are shared with HTTP/runtime callers.

## Evidence

Paired measurements used fresh SQLite snapshots taken from the same live source
and each revision's own compiled addon/tool definitions:

| Read | `eefe240` | implementation | change |
|---|---:|---:|---:|
| runs list, 20 rows | 50,814 chars | 5,215 chars | -89.7% |
| tasks list, 524 rows | 591,926 chars | 165,244 chars | -72.1% |
| team list, 1 row | 4,382 chars | 2,396 chars | -45.3% |
| MCP tools/list | 15,244 chars / 14 tools | 15,020 chars / 12 tools | -1.5% / -2 tools |

The tool schema shrank modestly because the consolidated tools carry explicit
scope and typed waiting-reason contracts. Outside this record, the source delta
is 530 insertions and 194 deletions (net +336); most growth is typed Rust/query
behavior, indexes, and boundary tests. `server/src/buddies/mcp.ts` itself changed
by 138 insertions and 133 deletions (net +5).

Verification on the isolated worktree:

- `pnpm typecheck`: passed.
- Rust: 35 passed (2 unit, 32 core integration, 1 query-plan).
- Focused Buddy server test: 30 passed.
- Full server suite: 225 passed, 1 skipped, 1 failed. The failure was the unrelated
  quarantined swarm timing assertion at 2,375 ms (and 2,274 ms on a full rerun);
  its isolated rerun passed 1/1 at 1,839 ms.
- The same complete server suite serialized (`--test-concurrency=1`) passed 226,
  skipped 1, failed 0, confirming the failure depends on aggregate test load.
- `pnpm token-audit`: completed over 862 sessions; it estimated 36.1M excess input
  tokens out of 4,811.6M (0.8%) and identified existing historical sessions for
  follow-up, not a change-specific regression.
- Real MCP integration test creates a background-off run, observes the typed
  `background_off` waiting reason, enables background work, and verifies both
  that the reason clears and the same run becomes claimable.

## Tradeoffs and reconsideration

This change optimizes model-facing volume and write-path density, not raw source
line count. Reconsider the slim row shapes if a proven workflow needs another
field on most reads; add it deliberately to the row rather than returning full
bodies. Revisit the single SQL expression only if SQLite can no longer represent
the eligibility policy; in that case stop and redesign list/claim authority
together rather than duplicating conditions. Reconsider wrapper renaming only as
part of a broader core API migration with all HTTP/runtime callers in scope.

## Rebase-review successor — 2026-09-29

Question: how does the accepted waiting-reason/list cleanup change after main commit
`c977f68` removed `buddy.background_enabled` and made background work always available?

Decision-maker: owner, through the instruction to finish and merge this Task. Status:
accepted implementation successor. `background_off` is removed from the reason sum type and
the real MCP proof now uses `task_paused`. Unpausing no longer increments the Task epoch: pausing,
reassigning and cancelling still invalidate queued work, while work deliberately queued against
an already-paused Task survives and becomes claimable when that Task is unpaused. This is the
smallest behavior consistent with both the documented invalidation contract and the requested
same-run boundary proof.

The review also replaces the partial `list_run_rows(RunQuery)` function with a total
`RunScope { Buddy, Task, Workspace }`, leaves `RunQuery::Live` for the workspace activity HTTP
caller, removes the unused `RunQuery::Workspace`, returns no requester when a referenced post is
missing, and computes each Buddy's active pool count once through an indexed joined projection.
The query-plan guard forced that projection onto the partial `run_active_buddy` index rather than
accepting SQLite's initial full covering walk.

On a consistent backup of the same live database used for the earlier paired measurements, the
workspace held 524 Tasks total. The default open-only MCP projection returned 107 rows and was
32,729 characters as compact JSON. The temporary backup was deleted after measurement.

Final rebase verification: `pnpm typecheck` passed; the crate's intended pure-core command
`cargo test --no-default-features` passed 35/35 (3 unit, 31 core integration, 1 query-plan);
the focused real MCP suite passed 30/30; `pnpm test:server` passed 226 with 1 skipped and 0
failed; and `pnpm test:client` passed 209/209. An initial plain `cargo test` attempt failed to
link the optional napi symbols, as the crate's manifest warns; it was replaced by the package's
documented no-default-features test command and is not a product failure.
