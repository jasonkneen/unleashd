# Buddies control plane — completion audit and forward plan

Date: 2026-07-28

Status: Implemented control-plane baseline; current open gates and final
reliability closure are recorded below.

Scope: standalone `~/git/buddies`, Unleashd integration, UI, and the EventMap
Growth team proof

Historical coordination constraint: another agent was refactoring
`server/src/server.ts` during the original audit. The audit pass itself avoided
that file; the later reliability integration intentionally modified the server
composition and runtime.

## Why this second note exists

The original redesign note reconstructed a long product conversation and
derived a minimal employee-control architecture. Implementation then produced
new runtime evidence that changed several assumptions:

1. Codex was receiving MCP configuration, but the MCP process started in the
   employee workspace and could not resolve Unleashd's `tsx` loader.
2. A native Lead-to-Operator delegation really dispatched, but the report could
   inspect only itself, not its manager or peer.
3. The report created an unrequested Buddy project despite an explicitly
   read-only prompt.
4. Terminal delegation outcomes disappeared from the manager's inbox.
5. A native Lead-to-Critic review really dispatched and completed, but the
   reviewer initially could not see its assigned review or the input evidence.
6. The first delegation route still had a concurrent double-dispatch window
   while awaiting conversation creation.
7. The first-turn briefing still injected substantially more state than the
   design said it should.

Those are not cosmetic defects. They distinguish a convincing employee demo
from a dependable team control plane. This note records the resulting design,
the exact proof, what is complete, and what must remain gated.

## Direct answer: what a Buddy is now

A Buddy is:

```text
durable identity
+ one home workspace and multiple assignment workspaces
+ BUDDY_SOUL.md and contained private memory
+ owned projects/todos and one current planning context
+ relationships and skills
+ linked ordinary provider conversations
+ typed delegation/review/approval records
+ bounded automation definitions and run history
```

A Buddy is not:

- a permanently running model process;
- a special chat renderer;
- a Swarm/Oompa worker;
- a Markdown-only role prompt;
- a generic peer-to-peer mailbox;
- an automatic permission to publish, send, spend, or deploy.

The model process is replaceable. The employee identity and accountability
survive model turns, provider sessions, compaction, restart, and failed runs.

## Why context is necessary but insufficient

Context answers:

- Who am I?
- What is my role and behavior?
- Which workspace is this turn about?
- What is the bounded purpose?
- What recent memory and work deserve attention?

Context does not enforce:

- which SQLite record may be updated;
- whether a target Buddy is a direct report or review subject;
- whether a project belongs to the current employee;
- whether a delegated child may create a project;
- exactly-once automation/delegation execution;
- evidence requirements for terminal work;
- durable audit history.

The first Operator proof is decisive evidence. The prompt explicitly prohibited
file and external changes and asked for a read-only verification. The Operator
still created a verification project to organize the work. This was a
reasonable model behavior and an unacceptable control-plane mutation.

Therefore:

```text
instructions = behavior guidance
typed tool policy = authority boundary
database transition = durable truth
```

## Why MCP is used

MCP is the current Codex-native adapter for the deterministic Buddy operations.
It is not the identity model and is not required by the standalone library.

The architecture is:

```text
Buddies library operation contract
                  |
          Unleashd scoped service
                  |
       +----------+-----------+
       |                      |
    HTTP/UI               provider adapter
                              |
                         Codex MCP today
```

Another provider may expose the same operation contract through function calls,
a plugin protocol, or another native tool bridge. The important invariant is
that identity/workspace/project/automation/delegation scope comes from trusted
conversation metadata, not model-supplied arguments.

MCP is valuable because it:

- gives the model discoverable typed operations;
- keeps input/output structured;
- supports read-only/destructive annotations;
- lets Unleashd register only the operations allowed for a child conversation;
- fails a Buddy turn if its required employee-control bridge cannot start;
- preserves the provider harness as a generic executor.

The formatting is incidental. Deterministic authority is the reason.

## Final minimal operation surface

### Reads

- `get_current_work`
  - self by default;
  - a declared review subject when `targetBuddyId` is supplied.
- `get_inbox`
  - assignments;
  - terminal delegation outcomes and completion audit;
  - team review queue and terminal verdicts;
  - pending team approvals;
  - blocked team projects;
  - failed team automations.
- `get_automations`
  - self;
  - direct reports;
  - a declared review subject.

### Owned work and memory

- `new_project`
- `update_project`
- `remember`
- `compact_memory`

### Management and review

- `delegate`
- `complete_delegation`
- `complete_assignment`
- `request_review`
- `submit_review`

### Automation and approval

- `set_automation`
  - create disabled;
  - update only while disabled;
  - disable;
  - cannot enable or run.
- `request_human_approval`
  - creates pending durable intent;
  - does not execute or authorize the action.

Employee creation, role changes, reporting-line changes, activation, and
destructive administration remain UI/CLI/owner operations.

## Authority model

### Self

An employee may read and mutate its own work in the selected workspace.

### Manager

A manager may:

- inspect direct-report work and automations;
- define disabled direct-report automations;
- delegate bounded work;
- request a structured review involving itself/direct reports;
- inspect team inbox outcomes.

A manager does not automatically write a report's owned project.

### Reviewer

A `reviews` relationship grants read authority for the subject's current work
and automation metadata. It does not grant project mutation, automation
mutation, delegation, or management authority.

### Delegated report

A delegated conversation gets an explicit Buddy operation allowlist persisted
in trusted `BuddyContext` and passed to MCP. The MCP server registers only those
tools.

Safe default:

- read current work/inbox/automations;
- update an explicitly named project the report owns;
- remember a compact handoff;
- request human approval;
- complete the assignment.

Excluded by default:

- `new_project`;
- `set_automation`;
- recursive `delegate`;
- `request_review`;
- `compact_memory`;
- manager-side delegation settlement.

`complete_assignment` is mandatory in every delegated policy.

### Project ownership during delegation

A delegation may be attached to the Lead's project for supervision. The report
does not inherit mutation authority over that project.

```text
Lead parent project
      |
      +-- delegation purpose/reference
                 |
                 +-- report evidence + terminal outcome
                                      |
                                      +-- Lead reconciles parent project
```

This avoids pretending that two employees own the same project.

## Typed inbox instead of mailbox

No generic message table was added.

The inbox is a projection over durable records:

- delegations;
- reviews;
- approval requests;
- blocked projects;
- automation failures;
- completion audits and child conversation links.

Conversation is used for discussion. Delegation/review is used for offline
accountable work. Markdown remains repository evidence. The inbox points to
records and artifacts without duplicating them.

The first proof changed the inbox in two ways:

1. terminal report outcomes no longer vanish after leaving the active queue;
2. a Lead sees reviews between direct reports, including terminal verdict,
   score, evidence, required actions, and child conversation.

A reviewer always sees reviews assigned to itself, even when the subject is a
peer rather than a direct report.

## First-turn context budget

The briefing now has a hard 40,000-character budget.

Always retained:

- employee identity and workspace;
- delegation and allowed-operation scope;
- native operation and approval rules.

Bounded:

- soul: 12,000 characters;
- always-on skills: 12,000 characters total;
- memory summary: 6,000 characters;
- current-work attention slice: 8,000 characters;
- relationships: 4,000 characters.

Recent journal bodies are no longer injected. The briefing includes up to
eight journal pointers. Current work is an attention slice, not every legacy
record. Native reads provide fresh detail on demand.

The hidden compatibility envelope is:

- versioned;
- base64url encoded;
- length delimited;
- bounded;
- restored only by the Buddy parser;
- never shown as the user's visible prompt.

## Durable lifecycle mechanics

### First assignment delivery

Initial Buddy messages use:

```text
unclaimed
  -> claimed(token, expiry)
  -> enqueued
  -> acknowledged delivered
```

An enqueue crash leaves an expiring claim and can be retried. The message is
not marked delivered before runtime acceptance.

### Delegation dispatch

Delegation dispatch now uses schema 10:

```text
pending delegation
  -> claim dispatch(token, expiry)
  -> create exactly one child conversation
  -> bind child conversation using owned token
  -> active
```

Two SQLite connections cannot claim the same delegation dispatch. An expired
claim may be recovered deliberately. A losing executor cannot bind a second
child or mark the winner's delegation failed.

### Assignment completion

Provider turn completion does not settle a delegation.

The report must call `complete_assignment` with:

- terminal status;
- concrete outcome;
- at least one evidence item.

The operation verifies the receiving employee, workspace, and exact child
conversation.

### Review dispatch and completion

`request_review` creates a review and one reviewer child conversation. The
request includes:

- reviewer;
- subject;
- purpose;
- optional subject-owned project;
- explicit input evidence;
- parent conversation;
- least-privilege review operation policy.

The reviewer calls `submit_review` with:

- `pass`, `needs_work`, or `fail`;
- optional score;
- summary;
- concrete evidence;
- required actions.

### Automation runs

Automation occurrence claims use:

- unique occurrence key;
- executor token;
- expiry;
- token-checked updates;
- immutable claim-time policy;
- monotonic iteration/token/cost fields;
- immutable terminal result.

Cancellation remains cancellation and cannot be overwritten as failure.
Expired interrupted runs recover without creating a duplicate occurrence.

The scheduler enforces wall-clock and iteration limits plus Buddy operation
allowlists. Provider token/cost events are not sufficiently reliable to claim
those two budgets are enforced.

## Live proof timeline

### Native MCP availability

The source-mode MCP process initially failed because it inherited the EventMap
working directory and could not resolve Unleashd's `tsx`. The launch now uses
the Unleashd server directory as `cwd` and is marked required.

A direct Codex process then called native `get_automations`.

### EventMap automation definitions

The Growth Lead created six disabled definitions:

- Operator daily evidence;
- Critic daily challenge;
- Lead daily closure;
- Operator weekly review;
- Critic weekly review;
- Lead weekly decision.

All six remain:

- `enabled=false`;
- `last_run_at=null`;
- scoped to EventMap;
- bounded by no-send/no-publish/no-deploy/no-spend rules.

The existing macOS jobs remain active until native execution proof succeeds.

### Lead to Operator

Delegation:

`delegation_6dc23376-b247-4375-8269-ade72c5231fe`

Child conversation:

`eb60f7aa-6009-46fa-af20-18f2caf5b4d4`

The Operator:

- read both control-plane handoffs;
- used native `get_automations`;
- verified its own 2/6 definitions;
- could not inspect its manager or peer;
- created an unrequested verification project;
- correctly called native `complete_assignment` with `failed`.

The unwanted project was marked `cancelled`, not deleted.

The Lead subsequently verified all 6/6 definitions through management scope.

### Lead to Critic

Review:

`review_55d24505-295d-4393-b444-e4997af972d5`

Child conversation:

`99757474-cf7b-4254-9dd8-71bb008eee32`

The Critic called native `submit_review`:

- verdict: `fail`;
- score: 38;
- status: `complete`.

The Critic's conclusion was appropriately split:

- the Operator's failed terminal status was correct;
- its 2/6 limitation supports least privilege and manager-owned reconciliation;
- creating an unrequested project was a material control failure;
- the Lead's 6/6 conclusion must be attributed to Lead scope;
- no automation should be enabled before bounded scheduler proof.

After the inbox repair, the Lead used native `get_inbox` and saw the terminal
review, verdict, score, evidence, required actions, and child conversation.

## Acceptance-gate audit

| # | Requirement | Evidence | State |
|---|---|---|---|
| 1 | Fresh Buddy conversation exposes native tools | Direct Codex MCP call and live Lead/Operator/Critic calls | Proven |
| 2 | Lead lists self/report automations | Live 6/6 reconciliation | Proven |
| 3 | Lead creates disabled report job | Six live disabled definitions | Proven |
| 4 | Cannot target unrelated Buddy/workspace | scoped operation tests and live peer rejection | Proven |
| 5 | One enabled job, one occurrence/executor | two-connection claim and scheduler recovery tests; no real EventMap occurrence | Code-proven, live gate pending |
| 6 | Native delegation starts one report conversation | live delegation IDs plus schema-10 two-connection dispatch claim | Proven |
| 7 | Report receives soul, skills, purpose, project reference, typed scope | lifecycle tests and live child briefing | Proven |
| 8 | Assignment settles exactly once | explicit bound `complete_assignment`, terminal/update tests | Proven |
| 9 | Critic review dispatches and persists verdict | live review `fail`, score 38 | Proven |
| 10 | UI primary work independent of memory/automation requests | lazy-loading implementation and production build | Proven |
| 11 | Old/new Buddy conversations remain findable | sidebar grouping implementation and browser inspection | Proven |
| 12 | Buddy never renders Swarm DEBUG/prefix | distinct context/header and effective-prefix parsing tests | Proven |
| 13 | EventMap jobs run only through Buddies | native definitions disabled; macOS still active | Pending authorized migration |
| 14 | macOS lines removed only after proof | deliberately preserved | Guard satisfied; removal pending |
| 15 | Employee handoff is current | `UPDATE_FOR_AGENT.md` plus Lead reconciliation | Proven |
| 16 | Claim/enqueue crash cannot lose assignment | initial-message lease/ack tests | Proven |
| 17 | Turn completion does not close delegation | runtime removal and explicit completion tests/live proof | Proven |
| 18 | Cancellation cannot become failure | scheduler cancellation test | Proven |
| 19 | raw content cannot break hidden envelope | v2 encoding, malformed-v2 and v1 recovery tests | Proven |
| 20 | approval/token-cost language is truthful | UI/docs and handoff explicitly state limits | Proven |

## Implementation phase audit

### Phase 0 — preserve evidence

Complete. The quoted EventMap transcript is the primary product record.
`server.ts` was not modified.

### Phase 1 — documentation and handoff

Complete:

- redesign note;
- this completion audit;
- standalone README/design/implementation plan;
- EventMap `UPDATE_FOR_AGENT.md`;
- Growth Lead `CONTROL_PLANE.md`.

### Phase 2 — truthful UI

Complete:

- top-level cards;
- square colored rails;
- simple employee-first navigation;
- Start conversation;
- latest project conversation resume;
- current-work filtering;
- lazy memory/automation tabs;
- old-thread retention;
- workspace labels;
- keyboard/empty/error states;
- no Swarm branding.

### Phase 3 — native operations

Complete for Codex:

- required MCP launch;
- trusted context;
- typed reads/mutations;
- automation definition management;
- inbox;
- delegation;
- review;
- approvals.

Other provider adapters remain future compatibility work.

### Phase 4 — assignment lifecycle

Complete:

- delivery claim/ack;
- explicit assignment completion;
- no turn-complete shortcut;
- durable terminal audit.

### Phase 5 — delegation and review dispatch

Complete:

- native delegation wakes report;
- schema-10 dispatch lease prevents concurrent double child;
- native review wakes Critic;
- terminal results project to Lead inbox.

Review creation does not yet have a separate dispatch lease. A duplicated
identical native `request_review` retry could create two reviews. This is a
hardening item if review dispatch becomes high-frequency.

### Phase 6 — automation execution correctness

Complete locally:

- claim token/expiry;
- recovery;
- immediate startup polling with one coalesced overdue occurrence;
- cancellation;
- terminal immutability;
- monotonic accounting;
- iteration/deadline/operation enforcement.

Startup catch-up is per definition. Multiple overdue definitions may execute
concurrently; staggered cron timestamps are not a dependency graph. A
multi-employee pipeline therefore still needs explicit delegation/review
settlement or a bounded sequence rather than relying on wall-clock ordering
after downtime.

Pending:

- real provider token/cost usage events;
- one authorized EventMap occurrence.

### Phase 7 — context persistence

Complete:

- typed metadata authority;
- v2 recovery envelope;
- bounded 40k briefing;
- no journal-body dump;
- current-work attention slice;
- native on-demand reads;
- delegated operation policy survives context resolution.

### Phase 8 — EventMap migration

Definitions complete; execution migration intentionally pending.

Required sequence:

1. Owner explicitly authorizes one read-only manual occurrence.
2. Back up Buddy DB.
3. Run one Operator daily evidence definition through the native scheduler.
4. Verify one run, one conversation, expected dated artifact, no forbidden
   action, and durable outcome.
5. Run the dependent Critic/Lead stages separately and verify evidence passing.
6. Enable only the proven definitions.
7. Remove matching macOS lines, not the entire crontab.
8. Observe the next scheduled occurrence.
9. If any gate fails, disable native definition and retain macOS fallback.

### Phase 9 — real team proof

Partially complete:

- Lead → Operator dispatch and terminal outcome: proven;
- Lead → Critic dispatch and terminal verdict: proven;
- Lead team-inbox reconciliation: proven.

The proof intentionally used read-only control-plane evidence rather than
modifying a live growth campaign. A repository-artifact team proof can be the
first native automation migration run.

### Phase 10 — simplify

Pending and deliberately non-blocking:

- stop presenting legacy `work_items` as active current work;
- later migrate/archive legacy state;
- avoid splitting the store until behavior stabilizes;
- do not add generic inbox/workflow UI;
- decide whether token/cost and consumable approvals belong in v1 after real
  scheduler use.

## Remaining work, in order

### 1. Explicitly authorized native EventMap occurrence

This is the only missing end-to-end product gate. It writes repository
artifacts and consumes provider time, so it should not be smuggled in as a unit
test.

### 2. Scheduler handover

Enable and remove old cron only after the occurrence passes.

The exact active macOS fallback entries at final audit are:

```cron
30 8 * * * /Users/nicholasbardy/git/event_calendars/company/growth/agents/scripts/run_daily_growth_cron.sh >> /Users/nicholasbardy/git/event_calendars/company/growth/agent_notes/cron-logs/daily-growth.log 2>&1
0 9 * * 1 /Users/nicholasbardy/git/event_calendars/company/growth/agents/scripts/run_weekly_growth_cron.sh >> /Users/nicholasbardy/git/event_calendars/company/growth/agent_notes/cron-logs/weekly-growth.log 2>&1
```

The native daily definitions are staggered at 08:30, 08:45, and 09:00 KST.
The weekly definitions are staggered at 09:00 and 09:30 Monday KST. After the
daily chain passes, remove only the daily fallback entry; after the weekly
chain passes, remove only the weekly fallback entry. Do not rewrite unrelated
crontab content or remove the `SHELL`/`PATH` header.

There is also a separate Codex App automation control plane. Its definitions
live under `~/.codex/automations`, while its run metadata lives in the Codex
App database. At the final audit, four EventMap definitions were active:

- daily evidence refresh at 08:30;
- approved outbound send resume at 08:45;
- inbox triage and approved replies at 09:00;
- weekly growth decision review at 09:00 Monday.

Two of these are explicitly authorized send workflows, so they are not
equivalent to the read-only macOS runners or the disabled Buddy definitions.
Do not point Buddies at the Codex App database or try to make both schedulers
share mutable rows. They have different ownership and lifecycle contracts.
Migration should copy intent once, preserve evidence links, verify one bounded
Buddy occurrence, then disable the matching old definition. Exactly one
scheduler must own each recurring occurrence.

The Buddy scheduler polls immediately when Unleashd starts. An enabled
definition whose `next_run_at` is overdue is claimed once and run as a single
catch-up occurrence; missed intervals are coalesced rather than replayed as a
backlog. This is the intended restart behavior.

### 3. Provider usage events

Add unified runtime usage only when provider adapters expose reliable numbers.
Until then, keep token/cost fields informational and do not market them as hard
limits.

### 4. Consumable approvals

If automatic external actions are ever allowed, approval needs:

- action fingerprint;
- exact parameters;
- one-time consumption;
- expiry;
- runtime check immediately before action;
- audit linking approval to consumption.

Current approval is intentionally a stop-and-notify ledger.

### 5. Review-dispatch idempotency

Add a review dispatch idempotency key/lease only if duplicate retries are
observed or reviews become automated/high-frequency.

### 6. Legacy-state retirement

Treat legacy work as migration provenance, not a second active planning model.
Do not delete historical evidence.

## What should not be added

- no Slack/Telegram;
- no generic mailbox;
- no employee creation tool for models;
- no new scheduler;
- no workflow DSL;
- no plugin marketplace;
- no remote runtime;
- no automatic external mutation;
- no oversized management UI;
- no more employee roles until the existing three close a real growth slice.

## Confidence record

Current automated evidence:

- standalone Buddies tests include schema 10, transition, containment,
  two-connection automation claim, and two-connection delegation dispatch;
- focused Unleashd tests cover creation, context, hidden envelope, MCP, scoped
  operations, routes, lifecycle/restart, scheduler, cancellation, and recovery;
- server TypeScript check passes;
- production client build passes;
- package syntax check passes;
- archive is reproducible but explicitly dirty/non-release because the source
  repository has intentional uncommitted development changes.

Current live evidence:

- native Lead operations;
- native Operator delegation and completion;
- native Critic review and verdict;
- Lead terminal-inbox reconciliation;
- six disabled EventMap definitions;
- backend restart on schema 10;
- real Buddy DB backup:
  `/Users/nicholasbardy/.buddies/backups/buddies-2026-07-28-schema10.sqlite`.

### Final wrap audit

The final audit after implementation added four pieces of direct evidence:

1. Browser inspection of `/buddies` showed one top-level Growth Lead card,
   two summarized team members, the Buddies virtual Recent Projects group, no
   directory/persistent-team masthead, and no Swarm debug text.
2. Browser inspection of the Growth Lead detail showed Start conversation,
   Work/Conversations/Memory/Automations, the two-report team summary, and no
   inline New project form.
3. The Growth Lead initializer was run twice against a disposable SQLite
   database. Both runs produced `3,3,15,15,5,3` for Buddies, workspaces, owned
   projects, legacy work items, relationships, and skills, with no duplicate
   owned-project external keys.
4. The live schema-10 database still contained all six EventMap definitions
   disabled with `last_run_at = null`, the terminal Operator delegation, and
   the completed Critic review. No native occurrence or cron handover was
   inferred from local tests.

The audit also corrected stale standalone documentation that still described
Codex MCP registration and real provider restart as unresolved. Both have live
evidence. This correction does not convert the authorized EventMap occurrence,
scheduler handover, provider usage metering, consumable approval capability,
or destructive browser mutation flows into completed claims.

## Final architectural judgment

The product should remain lean.

The differentiator is not another autonomous-agent runtime. It is accountable
continuity:

```text
ordinary conversation UX
+ persistent employee identity
+ owned current work
+ quarantined behavior/memory
+ typed management relationships
+ bounded scheduled wake-ups
+ explicit evidence-backed closure
```

Hermes/OpenClaw solve broader runtime and integration problems. Buddies is
better aligned with this product because it can stay small, filesystem-friendly,
Codex-native, and focused on GTM accountability rather than channels/plugins.

The control plane is now credible enough to stop adding architecture. The next
learning must come from one authorized native EventMap occurrence and its
actual artifact/decision quality.

## 2026-07-29 reliability closure

The final Unleashd integration pass closed the runtime failures found while
running real Buddy and multi-agent conversations:

- durable, rotated turn-attempt journaling under
  `~/.agent-viewer/observability/turn-attempts.jsonl`;
- boot, conversation, queue-message, provider-session, activity, and terminal
  cause correlation;
- explicit queued, starting, running, stopping, completed, failed, cancelled,
  interrupted, timeout, and server-restart projections in the thread UI;
- visible historical markers for explicit native Codex `turn_aborted` records,
  without guessing that open external turns are dead;
- per-spawn runtime tokens so late events from a reset process cannot mutate a
  newer turn;
- process-group-aware provider shutdown and working SIGKILL escalation;
- guaranteed post-run disk reconciliation for session writes deferred while an
  in-memory conversation is active;
- a non-reentrant shutdown state machine with one idempotent flush/exit path;
- a single-owner dev supervisor covering full/partial dev, build, and typecheck,
  including unmanaged port detection and replacement deadlines aligned with
  the server drain contract.

The integrated verification passed:

- 18 focused lifecycle, recovery, journal, shutdown, and loader tests;
- 14 dev-supervisor tests;
- 4 client turn-diagnostics tests;
- 45 focused Buddy server tests;
- 11 Buddy UI contract tests;
- server, client, and shared CLI typechecks;
- targeted Biome, syntax, and diff checks.

The shipped commits are:

- Unleashd reliability/control-plane integration: `5e13355`;
- vendored Buddies lock-integrity correction: `17a5e4b`;
- shared CLI detached-stop correction: `dfdb4d1`.

This closes the engineering/reliability pass. It does not change the product
gates already listed above: one explicitly authorized native EventMap
occurrence, scheduler handover only after that proof, reliable provider usage
events, consumable approval authority before automatic external actions, and
eventual retirement of duplicate legacy scheduling.
