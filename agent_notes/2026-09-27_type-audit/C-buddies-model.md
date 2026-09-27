# C: Buddies data model and API surface (type audit)

Base: unleashd main 03fc931 (lane-review worktree). This is a read-only audit. Live figures come from
`sqlite3 -readonly ~/.buddies/buddies-v3.sqlite` (63 MB), queried 2026-09-27 around 09:42Z.
Note: `rename_channel` / `channel.rename` do NOT exist at 03fc931. They live only in the dirty
main tree (node.rs/posts.rs/store.rs modified, uncommitted), so this audit does not cover them. Finding 3.2
covers them in advance.

Severity key: **bug** (bug-risk), **design**, **cosm** (cosmetic). Δ is the estimated net line change.

Brief under test: "a few simple things that have ids and can be created and addressed."
Verdict: the core nouns meet it. Workspace, buddy, task, channel, post, doc, schedule and run each
have an id and are created by one verb. Where it falls short is (a) leftover columns and types from the scoped/imported
model, (b) one sum type (`Outcome`) flattened into four nullable columns, and (c) task/run/schedule
reads that take no actor, so there are two authorization regimes.

---

## 1. Tables

| table | rows | last write | nullable / JSON columns |
|---|---|---|---|
| workspace | 16 | 09-24 17:09 | legacy |
| buddy | 58 (55 active) | 09-27 09:08 | manager_id, provider, model, reasoning_effort, **soul_path**, legacy |
| task | 1706 | 09-27 09:41 | parent_id, next_action, blocked_reason, evidence(JSON), legacy |
| channel | 744 (627 task / 79 direct / 38 public) | 09-27 09:41 | name, purpose, member_key, task_id, created_by, archived_at |
| channel_member | 154 | n/a | none |
| post | 3257 | 09-27 09:41 | author_id, root_id, reply_to_id, task_id, purpose, request, answer_id, conversation_id, return_conversation_id, evidence(JSON), legacy |
| post_read | 461 | 09-27 09:39 | legacy |
| doc | 172 | 09-27 09:15 | legacy (+ dead scope_kind/scope_id/name, see §5) |
| doc_revision | 329 | 09-27 09:15 | provenance(JSON), legacy |
| schedule | 17 (3 enabled) | 09-27 08:06 | task_id, next_run_at, archived_at, **limits(JSON)** |
| run | 3154 | 09-27 09:41 | conversation_id, task_id, task_epoch, after_run_id, retry_of, lease_token, lease_expires_at, deadline, snapshot(JSON), outcome, error_code, error, started_at, ended_at |
| conversation | 1270 | 09-27 09:38 | task_id, legacy |
| event | 25334 | 09-27 09:41 | buddy_id, task_id, idem_key, payload_hash, result_ref, payload(JSON), legacy |

(Plus the FTS5 `post_search` virtual table, so 13 real tables.)

**Distinctness.** Every table is still a distinct thing except two:
- `channel_member` duplicates `channel.member_key` exactly: 79 direct channels have 154 member rows, and it is
  an index of the same fact. It is kept on purpose for the `inbox`/`search` joins, so it is acceptable, but it is a
  stored duplicate that nothing checks. **design**, keep it but add a trigger or a test that the two agree. Δ +10.
- `conversation` (1270 rows, 174 with no run) is only written by `bind_conversation`. It is a legitimate link table.

**Facts stored twice**
- 1.1 **bug**: `post.task_id` vs `channel.task_id`. For posts in task channels, `insert_post` takes `task_id` from
  the *input*, not from the channel. **4 live posts written today** (08:38 to 08:53Z) sit in task channels with
  `post.task_id IS NULL`, so the Task filter (`task_posts`, `WHERE p.task_id = ?`) never shows them. The trigger is a
  Buddy `post` tool call with `channel:{task}` and no `taskId` (the `task_write comment` path sets both).
  Fix: in `insert_post`, derive it: `ChannelKind::Task{task_id}` → that id and reject a conflicting input;
  public/direct → input's. Backfill 4 rows. Δ +8.
  The column also carries two meanings: "belongs to task channel" (redundant, 1206 rows) and "chip link from a
  public/direct post" (927 rows). A cleaner split is `post.task_id` = link only, with the task-channel membership read from
  `channel.task_id`. Δ ±0 if the Task filter query ORs the two.
- 1.2 **design**: `run.status` + `outcome` + `error_code` + `error`. This flattens the `Outcome` sum
  (`Complete{text}|Failed{code,error}|Cancelled{reason}`) into four columns that can disagree. Live data: 37 `complete` runs
  and 4 `queued` runs carry an `error_code`. `Cancelled` writes `error_code='cancelled'` as well as `status='cancelled'`, which records the same fact
  twice. Fix: keep `status` as the discriminant and one `result TEXT` column (text or error), with `error_code` only for failed runs,
  enforced by a CHECK: `CHECK((status='failed') = (error_code IS NOT NULL))` once legacy rows are normalised. Δ −5 crate.
- 1.3 **design**: `post.return_conversation_id` equals `conversation_id` whenever `request` is set (insert_post:
  `ask.column().and(from_conversation_id)`). Freshly written rows disagree in 26 cases, all because `bind_run` later overwrites
  `conversation_id` for the recipient's run. The column therefore has two meanings: provenance, then "the conversation that answered". Fix:
  stop reusing `post.conversation_id` in `bind_run` (the run row already holds it), and the return column then
  becomes derivable and can be dropped. Δ −10.
- 1.4 **cosm**: `post_read.last_post_id` + `last_post_at` + `last_ord`. The cursor is `last_ord` and the other two are "for the
  record". 10 rows already disagree with the post they name (imported baselines). Drop them. Δ −6.
- 1.5 **design**: `doc.content`/`revision` duplicate the latest `doc_revision`. This is intended as a head pointer. Keep it.
- 1.6 **design**: Actor has two encodings. `post.author_id`/`channel.created_by` use NULL = owner. `event.actor`/`post_read.reader`/
  `channel_member.member` use `'owner'`. `doc_revision.author` is a free string with values
  `migration|owner|<buddy>|system:inherit|memory_reviewer`. Fix: one encoding (`'owner'` key everywhere, FK
  dropped on author) or a typed `Author` sum for revisions. Δ −10 (removes `from_nullable`).

**Nullable columns that are really sums**
- `task.status` + `blocked_reason`: `Blocked{reason}` is enforced in code, not by type. Because `TaskChanges` cannot
  clear a field (`c.blocked_reason.or(old)`), 4 cancelled tasks still carry a stale `blocked_reason`, and the same is true of
  `next_action`. **bug (minor)**. Fix: make the status a `TaskState` sum on the write, `Blocked{reason}`, which clears the reason on
  leaving Blocked, and use `Setting` for `next_action`. Δ +15.
- `run.lease_token`/`lease_expires_at`/`started_at`/`ended_at`/`deadline` follow `status`. This is acceptable because the CHECK is
  expressible. Add `CHECK((status IN ('running','cancel_requested')) = (lease_token IS NOT NULL))`. Δ +2.
- `schedule.enabled` + `archived_at`: three states (active, paused, archived) held in two columns. **cosm**.
- `channel` columns are already enforced as a sum by CHECKs, which is good.

**Dead or legacy columns**
- `buddy.soul_path`: 54 rows, **zero readers** in server/client TS. **design**, drop it. Δ −4.
- `schedule.limits`: every writer passes `'{}'` (routes.ts:275, mcp.ts:401). The crate only checks that it parses, and it is
  never read. Imported rows carry v33 `allowed_operations:["buddy.get_current_work",…]`, which is dead vocabulary. Also,
  `put_schedule`'s upsert sets `limits = excluded.limits`, so an owner edit silently wipes the imported limits. **design**, drop the
  column and field. Δ −12.
- `run.snapshot` (1125 rows, all imported), `after_run_id`, `retry_of`: check the writers before dropping them.
- `legacy` on 9 tables (e.g. 24,765 of 25,334 events). This is by design (§7.1), but it is a JSON bag on every row.

## 2. Rust types (types.rs)

Enums are exhaustive and every `match` is closed. The `str_enum!` macro plus FromSql gives typed `Corrupt` errors. Good.

- 2.1 **design**: `Event.op: String`, `EventInput.op: String`, `Mutation.op: &str`. The op names are string literals scattered across
  modules (`"post"`, `"answer"`, `"channel.create"`, `"channel.archive"`, `"task.create"`, `"task.update"`,
  `"doc.write"`, `"schedule.put"`, `"workspace.create"`, `"buddy.create"`, `"buddy.update"`, and from TS
  `"memory_review"`). Naming is mixed (dotted vs bare vs snake), and a parallel `Op` enum
  (authorization ops) uses a *different* vocabulary. Fix: one `EventOp` str_enum, and `Mutation.op: EventOp`. Δ +15.
- 2.2 **design**: `Event.payload: String` (JSON) and `append_event` let any caller write any op with any payload.
  `append_event` performs **no `require`** at all. Its only caller is the memory-review receipt. Fix: make it a typed
  `record_review(actor, ReviewReceipt)` verb, or at minimum `require(Admin|SelfOrManager)`. **bug-risk (low)**. Δ +10.
- 2.3 **design**: `Run.outcome/error_code/error: Option<String>` while `Outcome` exists as a type. Expose
  `Run.state: RunState = Queued|Running{lease_expires_at}|CancelRequested|Complete{text}|Failed{code,error}|Cancelled{reason}`
  instead of `status` + 7 Options. Δ +25 types / −15 TS `?.` checks.
- 2.4 **design**: `DocScope` (Buddy | Workspace), `Doc.scope`, `DocRef.scope`, `DocRef.name`, and `DocKind::Shared` are
  leftovers (§5).
- 2.5 **design**: `TaskChanges` uses `Option<String>` for `next_action`/`blocked_reason`, and "absent" cannot express "clear". `Setting`
  already solves this for BuddyChanges. Reuse it. Δ +4.
- 2.6 **cosm**: `ScheduleInput.id: Option<String>` ("absent = create") is an optional doing the job of a sum. `TaskWrite` already
  models Create|Update, so do the same for schedules. Δ +6.
- 2.7 **cosm**: `DocRevision.author: String`, `provenance: String` (JSON, 304 of 329 non-empty, all imported, never written
  by the new path).
- 2.8 **cosm**: `Op` is used as a semantic label, not an operation. `archived_channels` and `task_posts` authorize as
  `Op::SearchPosts` on `Subject::Owner` just to get "any buddy". Add `Op::ReadWorkspace` or drop the label. Δ ±2.
- 2.9 `PostInput.kind: PostKind` + `RequestState::None` is fine. `Actor`, `ChannelKind`, `ChannelRef`, `RunInput`,
  `ManagerRef`, `Setting` and `TaskWrite` are good canonical sums.

## 3. API surface

**Counts**: **44 napi exports** (node.rs), **13 distinct MCP tool names** (Buddy 11: post, answer, inbox,
channel_archive, channel_read, tasks, task_write, doc_read, doc_write, runs, schedule; Team 2: team,
team_admin; plus the Builder and Reviewer variants of tasks/task_write/doc_read/doc_write), and **41 owner routes** (40 in
the table: 18 GET, 17 POST, 2 PUT, 2 PATCH, 1 DELETE; plus the media upload).

- 3.1 **Dead napi exports.** These were re-verified per file with grep:
  - `authorize`: TS never calls it (only `crates/unleashd-buddies/test/node.test.mjs`). The crate calls it internally.
    **cosm**, drop the napi wrapper and keep the Rust fn. Δ −4.
  - `listEvents`: only `server/test/buddies-v2.test.ts` and `buddy-memory-curation.test.ts` use it. No product reader.
    Keep it as test support, or drop it and have tests query the db. Δ −4.
  - Every other export has at least one caller in server/src.
- 3.2 **Parallel verbs.** Channels have `create_channel`, `set_channel_archived(bool)`, and, in the uncommitted main tree,
  `rename_channel(actor, channel_id, name, key)`. These are three write paths on one row. Buddies already
  show the better shape: `update_buddy(BuddyUpdate{changes})`. Fix: one `update_channel(actor, ChannelUpdate{channel_id, changes: {name?, purpose?, archived?}, key})`.
  Before rename lands: Δ −15 now, avoids +40.
  Buddy archive has two routes: `DELETE /api/buddies/:id` and `PATCH {status:'archived'}`. See 3.4.
- 3.3 **Tools and routes against core verbs.** The mapping is close to 1:1, with these compositions:
  - The MCP `post` tool and `publishOwnerPost` both call `openChannel` (a write transaction) and then `post` with `{kind:'id'}`, so
    two transactions run, only to learn `channel.id` for media validation. `open_channel` for a new DM
    creates the channel **outside the idempotent event path** (no event row). **design**. Fix: have the crate return
    the channel id before the media check via a pure `resolve_channel`, or validate media paths without the channel id. Δ −10.
  - `team_admin create` with `soul` performs `createBuddy` and then `writeDoc`, which are not atomic. They can be retried because the keys are derived, so this is acceptable.
  - The `runs` tool is flagged `writes: true` for list and get as well, so every read emits `changed` and wakes the runner. **cosm**.
- 3.4 **One write path (authorize + idempotency).** Most writes go through `self.write` + `require` + `idempotent`.
  The exceptions:
  - `mark_read`, `open_channel` (it creates direct and task channels), and `bind_conversation`: authorized, no event, no key.
    That is acceptable for cursors, but a channel creation should be an event. **design**.
  - `enqueue_run` / `cancel_run`: authorized, **no event, no idempotency key**. `POST .../schedules/:id/run` uses
    `slot: new Date().toISOString()`, so a double-click enqueues two runs, and the input key does not dedupe
    because the slot differs. **bug-risk (low)**. Fix: an idempotency key on EnqueueInput. Δ +10.
  - `append_event`: no authorize (2.2).
  - `claim_run`, `settle_run`, `bind_run`, `recover_runs`, `due_schedules`: runner-internal and lease-guarded, so no actor. Correct.
  - **bug**: `DELETE /api/buddies/:buddyId` uses the fixed key `archive:<buddyId>`. After archive, a restore through
    PATCH (a different key), and a second DELETE, the crate *replays* the first event: `result_ref` is the id and
    `get_buddy` returns the now-active buddy, so nothing is archived and no error is raised. The client calls it from
    BuddySettings.tsx:205. Fix: delete the DELETE route and have BuddySettings send `PATCH {status:'archived', key: fresh}`. Δ −5.
- 3.5 **Reads split into two authorization regimes.** `get_task`, `list_tasks`, `task_counts`, `get_run`, `list_runs`,
  `list_schedules`, `get_buddy`, `list_buddies` and `list_workspaces` take **no actor**. Post and doc reads do take one. As a result, a
  Buddy's `runs {get}` / `runs {list, buddyId}` / `schedule {list, buddyId}` / `tasks {owner}` read any buddy in any
  workspace. **design** (a workspace-isolation gap). Fix: give every read an `actor` and one `ReadWorkspace` rule. Δ +30.

## 4. Signatures

- 4.1 Long positional parameter lists: `set_channel_archived(actor, channel_id, archived: bool, key)` (a boolean flag plus positional),
  `list_posts(actor, query, before: Option<Cursor>, limit)`, `list_posts_from(actor, query, post_id, limit)`,
  `task_posts(actor, task_id, before, limit)`, `search_posts(actor, workspace_id, query, limit)`,
  `thread_stats(actor, channel_id, root_ids)`, `list_events(buddy_id, before_seq, limit)`, and
  `settle_run/bind_run(run_id, lease_token, …)`. Fix: `list_posts` + `list_posts_from` + `task_posts` → one
  `list_posts(actor, PostQuery{Channel|Thread|Task}, Page{Before(ord)|From(post_id)|Newest}, limit)`. This removes the
  "both before and from" runtime check in routes.ts `feedPage`. **design**. Δ −40.
- 4.2 Boolean flags: `archived: bool` (above), and `GET docs/:kind?all=1` switches between `listDocs` and `readDoc`, which are two
  verbs behind one route plus a flag. **cosm**.
- 4.3 Optional bags: `ScheduleInput.id` (2.6), and `TaskChanges` / `BuddyChanges` all-Option patches. The patches are fine;
  the problem is only the missing clear (2.5).
- 4.4 Validation repeated after parse:
  - routes.ts `scopeOf` + `DOC_SCOPES` table + `DocWriteSchema.scope/scopeId`, mcp.ts `docScopeInput` + `docRef`,
    and crate `check_address`. The same dead rule is enforced in three places (§5).
  - routes.ts `GET /runs` uses the `runQueries.find` query-param ladder, with an inline error when none matches. Parsing it once into `RunQuery` with
    a zod union would be cleaner. **cosm**.
  - mcp.ts `writeTask.ownerOf` throws a plain Error for a missing owner, although the schema could require it for the Builder. **cosm**.

## 5. Memory model after unification

The live data is unified: 58 soul + 57 working + 57 long_term docs, **all** `scope_kind='buddy'`, `scope_id = buddy_id`,
`name=''`, and **zero `shared` docs**. Every reader (`briefing.readBuddyState`, memory-review) addresses
`{buddyId, scope:{kind:'buddy'}, kind, name:''}`.

The old scoped model has leftovers, and all of them are removable:
- schema: `doc.scope_kind`, `doc.scope_id`, `doc.name`, `kind … 'shared'`, `UNIQUE(buddy_id, scope_kind, scope_id, kind, name)`.
- types.rs: `DocScope` enum + `columns/from_columns`, `Doc.scope`, `Doc.name`, `DocRef.scope`, `DocRef.name`, and
  `DocKind::Shared`.
- docs.rs: `check_address`, `doc_workspace` (Workspace branch), and `list_docs` "across every scope". The latter returns at most 1 row now, and its only caller is
  `?all=1`.
- mcp.ts: `docScopeInput`, the `docKind` 'shared' option, `name` on the doc tools, the `docRef` scope branch, and the Reviewer's `.omit({scope})`.
- routes.ts: `DocWriteSchema.scope/scopeId/name`, `scopeOf`, `DOC_SCOPES`, and the `?scope=&scopeId=&name=` query params.
- tools passing `scope:{kind:'buddy'}, name:''` at every call site (briefing.ts:56, mcp.ts team_admin, and unleashd-home).

Target: `DocRef = {buddy_id, kind: Soul|Working|LongTerm}`, `UNIQUE(buddy_id, kind)`. One doc per (buddy, kind),
with revisions. This requires a one-off table rebuild. **design**. Δ ≈ −90 (crate −45, TS −45).

## 6. Server-side duplication of crate logic

- 6.1 `channels.eligible` (channels.ts:152) and `memory-review.review` (memory-review.ts:357) re-check
  `buddy.status === 'active' && workspaceId === …`, which is exactly what `authorize` decides (archived → denied;
  ReadWorkspace would cover the workspace check once 3.5 exists). They are kept for a user-facing *reason* string.
  **design**. Fix: call the crate (`authorize` napi, currently dead, see 3.1) and surface its `Denied{reason}`. This makes
  3.1's `authorize` export useful. Δ −10.
- 6.2 `runner.scheduleJob` does `listSchedules(buddyId).find(id)` and then re-checks `enabled && !archivedAt`. `due_schedules`
  already filters, and the manual "run now" path (`enqueueRun` with any scheduleId) does not verify the schedule
  exists at all. Fix: validate the Schedule input in `enqueue` (the crate owns it), and add `get_schedule`. Δ +5 / −5.
- 6.3 `runner.requestJob`'s fallback re-reads `request.state !== 'awaiting'` before `answer`. The crate already
  refuses a non-awaiting answer (`flipped != 1`), so the TS check duplicates it. It is harmless because it avoids an error log. **cosm**.
- 6.4 `archivedBuddyIds` (core.ts) lists every buddy of every workspace to build a set. It is fine, but a `list_buddies(status)`
  query would be cleaner. **cosm**.
- 6.5 The pattern of mcp.ts plus routes.ts calling `openChannel` and then `post({id})` is duplicated in two places (3.3).

## Top 5 (payload vs cost)

1. **Derive `post.task_id` from task channels** (1.1). It fixes a live data bug (4 posts today are missing from the Task filter).
   Crate +8 lines, 4-row backfill. Highest payload per line.
2. **Delete the scoped-doc leftovers** (§5): DocScope, scope_kind/scope_id/name, `shared`, check_address, and the scope
   plumbing in mcp and routes. About −90 lines, zero live rows affected, and the brief's "addressed simply" holds for memory.
3. **Fix buddy archive: drop `DELETE /api/buddies/:id`** in favour of PATCH with a fresh key (3.4). This is a real silent no-op on
   re-archive. About −5 lines.
4. **One `update_channel(ChannelUpdate{changes})`** in place of `set_channel_archived(bool)` and the pending `rename_channel`
   (3.2). Do it before rename is committed. −15 now, and avoids +40. At the same time, fold the event op strings into an `EventOp` enum (2.1, +15).
5. **Give every read an actor and a workspace rule** (3.5, 6.1). This closes cross-workspace task, run and schedule reads by
   Buddies and lets TS use the crate's `authorize` reasons instead of re-deriving eligibility. +30 crate, −10 TS.

Next tier: collapse `Outcome` into run columns with CHECKs (1.2 / 2.3), drop `soul_path` and `schedule.limits`, add an idempotency
key to `enqueue_run`, and merge the three post-page verbs (4.1, −40).
