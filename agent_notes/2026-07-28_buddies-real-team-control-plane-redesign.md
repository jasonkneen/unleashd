# Buddies Real-Team Control Plane Redesign

**Date:** 2026-07-28

**Status:** Design correction before the next implementation pass

**Primary evidence:** Growth Lead conversation
`101ca901-754c-427f-bcfd-25a6ac8777d3`

## Why this note exists

The most useful evidence about Buddies is no longer the schema or the test
suite. It is the first substantial conversation with the Growth Lead.

That conversation demonstrated a capable employee:

- it reconciled conflicting campaign records;
- separated observed evidence from activity proxies;
- made carry/sharpen/kill decisions;
- evaluated its direct reports critically;
- found stale work state;
- defined safe daily and weekly work;
- preserved approval boundaries around sends, publishing, spend, deployment,
  and production writes.

It also demonstrated that the product control plane was incomplete:

- the employee could not manage Buddies automations;
- it could not wake a direct report through a durable delegation;
- it could not see a durable actionable inbox;
- it fell back to macOS `crontab` and repository shell scripts;
- those jobs bypassed Buddy run history, memory, delegation, review, project
  closure, and employee accountability.

The employee did useful work. The system did not yet make that work legible as
the work of a persistent team.

This is the central design correction. More entities, more cards, and more
tests will not fix it.

## Chronology: what was true when the employee spoke

The quoted conversation began around 16:22 KST.

Relevant implementation commits landed later:

- `e098585` at 15:42 — protocol/orchestration restructuring;
- `32bc0a0` at 16:39 — server decomposition and Buddy hardening;
- `b1748d9` at 17:17 — native Buddy MCP integration and final packaging;
- standalone Buddies `77fe383` at 17:17.

Therefore the Growth Lead's statement that no Buddy-native tools were injected
was accurate for that session at that time. It is not a fully current
description.

Today a newly started Codex Buddy conversation receives these native tools:

- `get_current_work`;
- `new_project`;
- `update_project`;
- `remember`;
- `compact_memory`;
- `delegate`;
- `complete_delegation`;
- `submit_review`;
- `request_human_approval`.

That is meaningful progress. However, the employee's larger diagnosis remains
correct:

1. There is still no native automation inspection or management operation.
2. `delegate` records a pending delegation but does not create or wake a child
   Buddy conversation.
3. An existing conversation does not magically acquire tools that were absent
   when its provider process was launched.
4. The local macOS crons are still installed and the Buddies database still has
   zero Growth Lead automations.

The plan must distinguish stale observations from still-valid architectural
gaps.

## What actually worked

### 1. The identity and behavior boundary worked

The Growth Lead behaved like a Growth Lead rather than a generic coding agent.
It:

- treated outcomes rather than activity as evidence;
- refused to scale weak campaigns;
- accepted responsibility for stale state;
- judged the Critic and Operator differently;
- kept external action behind approval.

The soul, role, repository instructions, and durable work context are doing
real product work.

### 2. Cross-project reasoning worked

The employee reconciled EventMap repository evidence with durable Buddy
projects and team relationships. A Buddy being cross-workspace while each run
is workspace-scoped remains the right model.

### 3. Repository evidence worked as shared memory

The employee found and used:

- campaign handoffs;
- growth ledgers;
- run manifests;
- scorecards;
- dated agent notes;
- scripts and safety contracts.

This argues against building a general document database or generic messaging
system. Shared repository files are already an effective evidence substrate.

### 4. Quarantined personalities worked

The Lead used the Critic as an adversarial reviewer and the Operator as an
execution specialist. This is exactly why role-specific souls and skills are
valuable: the Critic can be harsh without making every interaction hostile.

### 5. The employee designed a useful bounded recurring workflow

The daily and weekly EventMap workflows are not throwaway ideas. They have:

- explicit evidence sources;
- bounded outputs;
- no-send/no-spend/no-publish rules;
- specialist lanes;
- a final Lead decision;
- inspectable dated artifacts.

The mistake is where they were scheduled, not the work definition itself.

## What failed

### 1. The system has two control planes

The intended control plane is:

```text
Buddy automation
  -> automation run
  -> Buddy conversation
  -> native scoped operations
  -> project/memory/review state
  -> durable run outcome
```

The employee created:

```text
macOS crontab
  -> shell script
  -> independent Codex processes
  -> repository Markdown
```

The second path can produce good reports, but Buddies cannot answer:

- Which employee owns this run?
- Which durable project did it advance?
- Was the assignment acknowledged?
- Did the Critic pass it?
- What changed in memory?
- Was the run late, duplicated, or interrupted?
- Which automation policy authorized each operation?

This is the most important failure.

### 2. Delegation is presently a promise, not dispatch

The native `delegate` operation creates a database row. The UI delegation route
creates a row **and** starts the target Buddy conversation. These are two
different meanings for the same domain verb.

An employee calling `delegate` reasonably expects the report to receive the
work. Today that is false.

We should not preserve a misleading operation name. Either:

- delegation atomically records and dispatches; or
- the operation is renamed `record_delegation`.

The product intent requires the first behavior.

### 3. There is no employee-side automation management

The employee was asked to arrange daily work. It could not:

- list current Buddy jobs;
- create a job for itself or a direct report;
- disable or update a job;
- inspect the last durable run;
- request an immediate bounded run.

It used the only authority it had: shell access.

This is not model disobedience. It is an affordance failure.

### 4. Persistent identity does not yet imply proactive accountability

The store knows projects, todos, blockers, reviews, and approvals. Nothing
forces a Buddy to revisit them.

A persistent employee needs a wake-up mechanism tied to attention:

- scheduled check-in;
- assigned delegation;
- requested review;
- failed automation;
- pending human response;
- stale active project.

Without that, Buddies is persistent storage around manually started chats.

### 5. Work truth is split

The library still carries both:

- legacy `work_items`;
- canonical `owned_projects` plus `buddy_todos`.

The Growth Lead explicitly noticed that repository handoffs and durable state
were out of sync. Injecting both work systems increases rather than reduces
that ambiguity.

### 6. The implementation is no longer minimal

Approximate current size:

- standalone store: 3,287 lines;
- Unleashd Buddy server modules: about 2,100 lines;
- Buddy dashboard and CSS: about 2,000 lines.

The breadth includes identity, work, memory, compaction, org charts, skills,
delegation, reviews, approvals, audit, schedules, resource budgets, legacy
migration, UI projections, and run recovery.

Much of this is well-built. The ordering was wrong: the data model outpaced
the actual employee loop.

## Revised product model

### A Buddy

A Buddy is:

```text
identity
+ role/soul/skills
+ workspace authority
+ accountable projects
+ durable memory
+ typed team relationships
+ typed inbox
+ wake-up rules
+ ordinary conversations
```

A Buddy is not:

- a forever-running process;
- a Swarm;
- a generic plugin host;
- a second Slack;
- a replacement for repository evidence;
- a remote-action gateway.

### A conversation

A Buddy conversation remains an ordinary Unleashd conversation with trusted
typed context:

```text
buddyId
workspaceId
optional buddyProjectId
optional delegation/review/automationRun scope
```

It uses the normal chat UI and provider runtime. It has a compact Buddy header.
It never inherits Swarm semantics.

### A project

The canonical accountable unit is `owned_project` with bounded todos.

Every non-terminal project should expose:

- status;
- definition of done;
- next action;
- blocker when blocked;
- evidence references;
- owner;
- last meaningful update.

Legacy work items are migration input and read-only provenance, not a second
active work system.

### Memory

Repository files are the shared evidence layer.

Buddy memory is the employee's compact private operating memory:

- decisions;
- stable preferences;
- recurring lessons;
- unresolved questions;
- pointers to authoritative evidence.

It should not duplicate entire reports or become an alternate project tracker.

### Team inbox

Do **not** add a generic free-form mailbox.

The typed inbox is a projection over existing records:

- delegation assigned;
- review requested;
- automation failed;
- human approval resolved or pending;
- project blocked/stale.

Each item needs only enough lifecycle to support accountability:

- created;
- acknowledged;
- acted upon;
- terminal outcome.

The actual content and evidence remain in the project, review, conversation,
or repository artifact.

This avoids creating Slack inside Buddies while still letting employees notice
and respond to durable work.

## Minimal native operation surface

The model-facing surface should be small and semantic.

### Personal work

1. `get_current_work`
2. `new_project`
3. `update_project`
4. `remember`

`compact_memory` can remain available but should not be prominent until an
automatic compaction trigger is proven.

### Team work

5. `get_team_status`

Returns:

- direct reports;
- their current bounded work summary;
- pending delegations/reviews;
- last and next automation run;
- attention items.

6. `delegate`

Must:

- validate that the target is an assigned report/peer allowed by policy;
- create one durable delegation;
- create and start exactly one target Buddy conversation;
- bind that conversation to the delegation and project;
- return both IDs;
- settle the delegation from the child conversation's terminal outcome.

7. `request_review`

Must create and start one reviewer conversation with a structured review
contract. `submit_review` remains the reviewer-side closure operation.

### Recurring work

8. `get_automations`

Read-only list for self and, for a manager, direct reports in the current
workspace.

9. `set_automation`

One operation with explicit actions:

```text
create
update
disable
```

It accepts:

- target Buddy;
- workspace and optional project inherited from trusted context;
- name;
- interval or cron schedule;
- timezone;
- prompt, sequence, or bounded loop job;
- conservative policy;
- optional run-now request.

It must not:

- create arbitrary OS cron;
- embed secrets;
- grant new external authority;
- permit a manager to target unrelated Buddies;
- silently delete run history.

`disable` is preferable to model-facing deletion.

### Human authority

10. `request_human_approval`

This records pending intent and stops the employee. It does not execute the
action. Approval consumption should eventually be one-time and fingerprinted;
until then the UI must not imply that approval automatically unlocks a tool.

### Administrative operations that remain human-owned

Do not expose:

- `new_buddy`;
- `update_buddy`;
- reporting-line mutation;
- skill-path mutation;
- workspace assignment mutation;
- arbitrary database queries;
- generic send-message;
- arbitrary external action.

These are infrequent structural decisions, not employee work.

## Dispatch architecture

The design must make one semantic operation mean one thing across UI and MCP.

### Preferred path

Introduce a `BuddyTeamService` outside `server.ts`.

It owns:

- `dispatchDelegation`;
- `dispatchReview`;
- `setAutomation`;
- `teamStatus`;
- typed attention projection.

Both routes and provider tools call this service.

```text
UI route --------\
                  -> BuddyTeamService -> Buddies store
MCP operation ---/                    -> Conversation creation port
                                       -> Scheduler port
```

This avoids:

- duplicating record-then-conversation logic in routes;
- teaching the standalone library about Unleashd conversations;
- having the MCP subprocess call an unauthenticated HTTP endpoint;
- adding more logic to the concurrently refactored `server.ts`.

### MCP process boundary

The current Buddy MCP server runs as a subprocess with direct SQLite access.
That works for local store mutations but cannot access the in-memory
conversation runtime.

There are three possible designs:

1. **Local internal RPC from MCP to Unleashd.**
   - Full team operations go through a scoped loopback endpoint/token.
   - Strong semantic consistency.
   - Requires careful lifecycle and authentication.

2. **Durable queue plus server dispatcher.**
   - MCP writes a pending delegation/review.
   - A server service claims and dispatches pending items.
   - Naturally supports offline inbox semantics.
   - Needs lease/idempotency to avoid duplicate dispatch.

3. **Provider tool bridge in-process rather than MCP subprocess.**
   - Direct access to services.
   - Larger provider integration change.

For the current local product, choose **durable queue plus dispatcher**.

Reasons:

- it makes the database record the source of truth;
- it naturally supports employees being offline;
- it preserves restart recovery;
- it does not require a hidden unauthenticated HTTP control API;
- it can be built outside `server.ts` and wired once the refactor settles.

The dispatcher must use a claim/lease, not merely query `pending` rows.

## Automation correctness before scale

The standalone audit found correctness gaps that matter more once employees
can create jobs:

1. One automation occurrence currently has an idempotent row, but two scheduler
   processes can both execute that same claimed row.
2. Run token/cost counters can be lowered by a later caller.
3. Terminal run fields can still be revised under some same-status updates.
4. Human approval is durable but not one-time consumed or fingerprinted.

Before allowing broad self-service automation:

- add atomic run acquisition with lease token and expiry;
- require the token for run updates;
- make iteration/token/cost usage monotonic;
- freeze terminal run outcome and accounting;
- expose conservative default policies;
- keep open-world operations unavailable.

These are correctness rules, not feature expansion.

## Runtime truthfulness corrections

A direct code audit found additional cases where durable state can say more
than the runtime has actually accomplished.

### Initial assignment delivery is not reliable yet

The Buddy creation service currently claims the initial-message dispatch in
durable config before enqueueing the message.

If the process throws or exits between those two operations:

- the message was never delivered;
- recovery sees it as already claimed;
- the assignment can be permanently lost.

The state machine must distinguish:

```text
pending -> claimed -> delivered
```

An expired claim must be recoverable. A delivered acknowledgement must happen
only after the runtime has accepted the message.

### A successful turn is not assignment completion

The current runtime settles Buddy delegations/reviews on provider
`turn.complete`.

That is incorrect for a multi-turn employee conversation. A report can produce
one update, ask a question, or hit a blocker without completing the assignment.

Use separate semantics:

- provider turn complete;
- conversation idle;
- assignment explicitly complete/failed/cancelled;
- conversation closed.

A delegation closes only through:

- explicit bounded completion operation;
- automation terminal condition;
- owner cancellation;
- terminal failure.

It does not close merely because the model stopped talking.

### Settlement must be transactional and awaited

Delegation/review state and audit records are currently written through
separate calls, and terminal settlement is fire-and-forget.

The library needs one transactional settlement mutation. The runtime must await
it before claiming the workflow is terminal.

### Cancellation must remain cancellation

Stopping a running automation can reject its pending turn with an ordinary
error before the scheduler observes its in-memory cancellation marker. The
catch path can then overwrite `cancelled` with `failed`.

Before writing failure, the scheduler must re-read the run and respect:

- durable terminal state;
- current cancellation claim;
- stop-induced provider errors.

### Approval must pause, not merely inform

`request_human_approval` currently returns normally after recording a pending
request. A sequence or loop can continue unless the model obeys prose.

The eventual enforced contract is:

```text
running
  -> waiting_for_approval(request_id, action_fingerprint)
  -> approved and consumed once
  -> running

or

  -> rejected/cancelled
```

Until this exists, approval should be documented as a durable notification,
not a safety gate.

### Token and cost limits are not currently real

The policy schema includes token and cost budgets, but the unified provider
event stream does not report main-turn usage to the scheduler.

Therefore:

- runtime and iteration limits are enforceable;
- operation allowlists are enforceable only through the native Codex MCP path;
- token/cost limits are stored policy intent, not automatic enforcement;
- CLI, HTTP, and direct-store fallbacks can bypass MCP-only policy.

The UI and documentation must say this plainly. Do not display token/cost
budgets as guaranteed protection until provider usage events feed the run.

### Hidden context must not rely on raw delimiters

The first-turn briefing currently embeds raw soul, skill, work, and memory text
between fixed HTML comment markers. A matching closing marker inside any of
those files can truncate extraction and leak hidden context into the visible
conversation.

Prefer out-of-band persisted metadata. If the provider transcript must carry a
recovery envelope, encode one length-delimited or base64 payload with version
and checksum; never interpolate raw employee content into the sentinel
boundary.

### Briefing size needs a budget

The briefing currently includes full soul, skills, memory, relationships, and
work JSON even though the employee has `get_current_work`.

The first-turn briefing should be compact:

- identity and role;
- essential behavior rules;
- workspace/project scope;
- direct reports;
- top attention items;
- available native tools;
- pointers for on-demand work and memory reads.

Do not inject every open project and recent journal entry by default.

## UI correction

The employee page should remain simple:

1. identity and **Start conversation**;
2. compact current work;
3. small team summary for leads;
4. conversation history;
5. memory and automations as secondary/lazy tabs.

Concrete current defects:

- a memory/automation request failure can block the whole employee view;
- project “Open” creates a new conversation rather than opening one;
- completed projects can appear in “Current tasks”;
- old Buddy conversations disappear from grouped sidebar mode;
- similarly named Buddy runs lack consistent workspace/project labels;
- the Buddy overview fetch can go stale;
- a malformed Buddy+Swarm record can still strip first-message content;
- directory cards are not fully keyboard-accessible;
- empty hierarchy renders a blank page.

Fix truthfulness and resilience before adding team inbox UI.

## Migration of the EventMap jobs

The existing jobs are valuable, but they are in the wrong scheduler.

Current machine state:

- macOS daily cron at 08:30 KST;
- macOS weekly cron at 09:00 KST;
- Buddies scheduler running;
- Growth Lead has zero Buddy automations.

Migration sequence:

1. Preserve the current scripts and run contracts.
2. Create equivalent disabled Buddies automations first.
3. Verify their prompts, workspace, employee, policy, and next-run timestamps.
4. Run each manually through the Buddies scheduler.
5. Verify:
   - one run record;
   - correct Buddy conversation;
   - correct repository artifacts;
   - no sends/writes/spend/deploy;
   - durable project/memory update;
   - Critic/Lead result where required.
6. Enable the Buddies jobs.
7. Remove only the two EventMap lines from macOS crontab.
8. Observe the next scheduled occurrence.

Never leave both schedulers active for the same job.

## What not to build now

- No generic employee chat inbox.
- No Slack/Telegram integration.
- No remote orchestration gateway.
- No plugin marketplace.
- No model-facing employee creation.
- No new employee roles.
- No visual workflow builder.
- No arbitrary chain language beyond prompt/sequence/bounded loop.
- No automatic external sending, publishing, spending, deployment, or
  production mutation.
- No large UI control room.
- No additional work entity.

## Lean confidence strategy

The existing Buddy test surface is already large.

Use direct code review and real UI/runtime inspection as the primary method.
Keep automated coverage only for expensive invisible failures:

1. one automation occurrence cannot execute twice;
2. delegation dispatch is exactly-once across restart;
3. hidden Buddy context is injected once and never shown;
4. project closure cannot lie about open todos/evidence;
5. a real lifecycle survives restart.

Do not add source-string tests for labels, borders, tab names, or ordinary
rendering. Those are easier to inspect in the browser.

## Revised implementation plan

### Phase 0 — stop and preserve evidence

- Stop the malformed in-flight Magic Genie Growth Lead turn.
- Record the quoted EventMap conversation as primary product evidence.
- Do not treat its pre-bridge tool inventory as current.
- Do not mutate the concurrent `server.ts` refactor.

### Phase 1 — documentation and operating handoff

- Write this design correction.
- Write `company/growth/agents/UPDATE_FOR_AGENT.md`.
- Tell the Growth Lead:
  - which conclusions were correct;
  - which tool observations are now stale;
  - that OS cron is temporary;
  - which durable operations are now available;
  - what remains unavailable;
  - how future recurring work should be requested.

### Phase 2 — truthful low-risk UI repairs

- Decouple primary employee loading from memory/automation loading.
- Fix the endless loading state.
- Exclude done projects from current tasks.
- Rename new-thread action truthfully or resume the latest matching thread.
- Preserve old Buddy threads in Older.
- show workspace/project consistently.
- use the effective Swarm prefix for stripping.
- repair keyboard/empty states.

No new test file is required. Retain only one or two existing assertions if a
regression is subtle.

### Phase 3 — native automation management

- Add `get_automations`.
- Add `set_automation`.
- Allow self and direct-report targets only.
- Bind workspace/project from trusted context.
- Calculate next run in the integration layer.
- Default to conservative operation policy.
- Support create/update/disable and optional bounded run-now.
- Add audit entries.

### Phase 4 — reliable assignment lifecycle

- Replace dispatch boolean/timestamp with pending/claimed/delivered state.
- Recover expired claims after restart.
- Ack only after runtime enqueue succeeds.
- Remove turn-complete as an assignment-terminal signal.
- Add explicit assignment completion semantics.
- Settle state and audit in one awaited transaction.

### Phase 5 — real delegation dispatch

- Add a durable dispatch claim/lease.
- Add a server-side dispatcher service outside `server.ts`.
- Route UI delegation and review through the same service.
- Make MCP-created pending work visible to the dispatcher.
- Bind child conversation IDs.
- Settle terminal outcomes exactly once.

### Phase 6 — automation execution correctness

- Add lease ownership for automation occurrences.
- Require lease token for updates.
- make accounting monotonic;
- freeze terminal records;
- recover expired leases deliberately;
- report actual runtime limits;
- explicitly document that provider token/cost metering is unavailable until
  the unified runtime emits usage events.

### Phase 7 — safe context persistence

- Stop embedding raw briefing text inside fixed transcript delimiters.
- Persist trusted Buddy metadata out of band.
- Add a versioned encoded recovery envelope only if transcript recovery still
  requires one.
- Cap the first-turn briefing.
- Load projects and memory on demand.

### Phase 8 — EventMap migration

- Create disabled daily Operator evidence job.
- Create disabled daily Critic review job where needed.
- Create disabled daily Lead synthesis job.
- Create disabled weekly Lead allocation job.
- Run them through Buddies.
- Verify artifacts and durable state.
- Enable Buddies jobs.
- remove the equivalent macOS cron lines.

### Phase 9 — one real team proof

Use one safe repository-local task:

1. Lead selects a bounded current project.
2. Lead delegates evidence work to Operator.
3. Dispatcher wakes Operator.
4. Operator writes evidence and updates the project.
5. Lead requests Critic review.
6. Dispatcher wakes Critic.
7. Critic produces pass/needs-work/fail with evidence.
8. Lead closes the slice or sets one precise next action.
9. Lead records compact memory.
10. Restart preserves the whole chain.

### Phase 10 — simplify

- Retire active use of legacy `work_items`.
- Remove duplicate management-edge interpretation.
- Split the 3,287-line store internally only after behavior stabilizes.
- Remove brittle low-value UI tests.
- Reassess whether approvals/cost budgets need to remain in v1.

## Acceptance gates

The redesign is not complete until all of these are true:

1. A newly started Buddy conversation visibly exposes the current native tools.
2. The Growth Lead can list its own and direct reports' automations.
3. The Growth Lead can create a disabled bounded daily job for a report.
4. The Growth Lead cannot target an unrelated Buddy or broaden workspace scope.
5. Enabling one job results in one occurrence and one executor.
6. A native delegation causes exactly one report conversation to start.
7. The report receives project, purpose, soul, skills, and typed assignment
   context.
8. Completion or failure settles the delegation exactly once.
9. A Critic review is dispatched and persists a structured verdict.
10. The UI shows current work without depending on memory/automation requests.
11. Old and new Buddy conversations remain findable.
12. No Swarm label or prefix appears in a Buddy conversation.
13. The EventMap jobs run through Buddies, not two schedulers.
14. The macOS cron entries are removed only after equivalent jobs are proven.
15. The employee-facing handoff accurately states current capabilities and
    remaining limits.
16. A crash between assignment claim and enqueue cannot permanently lose the
    assignment.
17. One completed provider turn does not prematurely close a delegation.
18. Cancellation cannot be overwritten as failure.
19. Raw soul/skill/memory content cannot break the hidden context envelope.
20. UI and docs do not describe approval or token/cost budgets as enforced
    when they are not.

## Bottom line

The experiment validated the most important hypothesis: a persistent,
role-specific Growth Lead is useful and meaningfully different from a generic
prompt.

It did not validate the current management runtime. The employee had to build
around Buddies in order to operate.

The next implementation pass should make Buddies the one durable control plane
for recurring work and employee dispatch. It should not add more employee
concepts until that loop works in reality.

## Implementation update — 2026-07-28

The first live validation changed the diagnosis in one important way.

Unleashd was already passing the scoped MCP configuration to Codex, but the
source-mode MCP process inherited the EventMap working directory. Node
therefore could not resolve Unleashd's `tsx` loader. Because the server was
optional, Codex continued without the tools and the employee correctly
reported that the bridge was absent.

The provider boundary now:

- starts the MCP process with the Unleashd server directory as `cwd`;
- marks the Buddy MCP server required;
- fails the turn if the employee control plane cannot initialize;
- keeps employee identity, workspace, project, conversation, and automation
  run in trusted launch arguments.

A direct Codex execution subsequently called native `get_automations`
successfully. Acceptance gate 1 is therefore locally proven for a fresh
process, not merely inferred from unit tests.

The Growth Lead read `UPDATE_FOR_AGENT.md`, reconciled its earlier assessment,
and created six EventMap definitions:

- Operator daily evidence;
- Critic daily challenge;
- Lead daily closure;
- Operator weekly review;
- Critic weekly review;
- Lead weekly decision.

All six are disabled and the existing macOS cron is unchanged. This proves
gates 2–4 at the definition layer. It does not prove execution or authorize
enabling.

Automation claims now use:

- a persisted executor token;
- an expiry derived from the immutable run runtime policy;
- explicit acquired/not-acquired state;
- token-checked scheduler updates;
- monotonic iteration, token, and cost accounting;
- immutable terminal run records;
- recovery of an expired claim without creating a second occurrence.

The store first migrated from schema 8 to schema 9 for automation leases, then
to schema 10 for delegation-dispatch leases. The two-connection automation and
delegation claim proofs plus scheduler restart proof pass. The package snapshot was regenerated
reproducibly and is explicitly marked `sourceDirty: true`; it is a local
development snapshot, not a release artifact.

The employee tool surface also now exposes `get_inbox`. It is a typed
projection of:

- assignments received;
- work delegated to reports;
- reviews assigned;
- pending approvals;
- blocked projects;
- failed automations.

It does not create a generic mailbox or duplicate Markdown evidence.

Other repairs completed during this pass:

- initial Buddy message delivery uses a lease plus explicit enqueue
  acknowledgement;
- first-turn Buddy context uses a versioned encoded envelope with a bounded
  briefing length;
- one provider turn no longer automatically completes a delegation;
- reports must use explicit evidence-backed `complete_assignment`;
- cancellation is not overwritten as scheduler failure;
- Buddy employee pages lazy-load memory and automation data;
- completed projects are not shown as current work;
- project actions resume an existing linked conversation when one exists;
- older Buddy conversations remain visible in the sidebar;
- Buddy and workspace labels are consistent;
- Buddy cards retain the square rail style and keyboard behavior.

The native delegation dispatcher is now wired and live-proven. The Growth Lead
called native `delegate`; it created delegation
`delegation_6dc23376-b247-4375-8269-ade72c5231fe`, dispatched child conversation
`eb60f7aa-6009-46fa-af20-18f2caf5b4d4`, injected the Growth Operator identity,
and the report terminated the assignment with native `complete_assignment`.
The assignment failed honestly rather than manufacturing a pass: the Operator
could verify its own two definitions but could not inspect its manager or peer.
The Lead then used its management scope to reconcile all six definitions.

That proof exposed two control-plane defects:

- terminal delegation outcomes disappeared from the manager's typed inbox;
- a delegated report received the full Buddy mutation surface and created an
  unrequested project despite the assignment being read-only.

The unintended verification project was subsequently marked `cancelled`
rather than deleted, preserving the proof and audit trail without leaving it
in the Operator's current work.

The inbox now includes the most recent terminal delegation outcomes, including
status, outcome, evidence/audit linkage, and child conversation id. Delegation
now carries a least-privilege Buddy operation policy into the durable
conversation context and MCP launch. Only those Buddy tools are registered for
the child. The default permits reading work/inbox/automations, updating an
explicitly named project the report owns, remembering a handoff, requesting approval, and
completing the assignment. It does not permit creating projects, changing
automations, delegating again, compacting memory, or settling the manager's
delegation. A manager may explicitly narrow or expand this list, but
`complete_assignment` is mandatory.

A delegation may be linked to the Lead's project for supervision, but the
child does not inherit mutation authority over that project. The report
settles the assignment with evidence; the Lead reconciles that evidence into
its parent project. This preserves employee project ownership.

Still open:

1. The six EventMap definitions have not run through the scheduler.
2. Provider token and cost usage are not emitted reliably enough to enforce
   those two stored policy fields.
3. Approval remains a pending/resolved ledger rather than consumable runtime
   authority.
4. The OS cron must remain until one bounded native run proves artifacts,
   ordering, no forbidden actions, and exactly one executor.

Native structured review dispatch is now also implemented and live-proven.
The Growth Lead requested review
`review_55d24505-295d-4393-b444-e4997af972d5`; Critic conversation
`99757474-cf7b-4254-9dd8-71bb008eee32` submitted a terminal `fail` verdict with
score 38 and evidence. The Lead's typed inbox subsequently exposed the full
terminal review.

That review showed why review read scope must differ from management scope.
A declared reviewer may now read the subject's current work and automation
metadata without gaining mutation authority. New review requests also carry
explicit input evidence. The first-turn briefing is capped at 40,000
characters and loads journal/work detail on demand.

The requirement-by-requirement completion audit and remaining migration plan
are in `agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md`.

The next gate is one explicitly authorized, read-only EventMap automation
occurrence. Do not add a mailbox, another scheduler, or more employee concepts
first.
