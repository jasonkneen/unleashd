# Buddies design review — fresh-eyes audit

Date: 2026-07-29

Status: Design critique and simplification plan. This is not a claim that the
implemented control plane is broken. It identifies the areas most likely to
make Buddies unreliable, confusing, or expensive to evolve after real use.

Scope:

- standalone `~/git/buddies`;
- Unleashd Buddy integration and UI;
- Codex MCP operation bridge;
- delegation, review, inbox, memory, project, and automation behavior;
- EventMap Growth Lead, Operator, Critic, and Engineer usage;
- coexistence with Codex App automations and macOS cron.

## Executive judgment

Buddies is technically stronger than a collection of role prompts and Markdown
files. It has durable identity, scoped operations, project ownership,
delegation, structured review, automation claims, audit history, and restart
recovery.

Its primary weakness is not missing machinery. It is that the machinery has
grown ahead of demonstrated daily operating value.

The product still needs to prove the simplest employee loop:

```text
talk to employee
    -> assign one bounded outcome
    -> employee produces evidence
    -> reviewer judges the evidence
    -> lead accepts, returns, or closes the work
    -> durable project state agrees with repository truth
```

Until that loop works repeatedly without the owner reconstructing state by
asking broad questions, additional workflow features should be treated as
suspect.

The recommended response is not a new architecture rewrite. Freeze the data
model, remove duplicate completion paths, make control-plane state visible as
small UI cards, choose one owner for each automation, and run one narrow team
for a week.

## Immediate finding: raw `buddy-review-result` blocks in conversations

### What the block is

A Buddy review conversation is instructed to finish with a machine-readable
payload delimited by:

```text
<!-- unleashd:buddy-review-result -->
{...review JSON...}
<!-- /unleashd:buddy-review-result -->
```

The payload contains:

- `verdict`: `pass`, `needs_work`, or `fail`;
- optional score;
- summary;
- concrete evidence references and observations;
- required actions.

This is not a user comment, model scratchpad, or malicious prompt. It is an
internal transport envelope used to settle a durable Buddy review.

The markers exist so arbitrary JSON in ordinary assistant prose cannot
accidentally mutate review state. The parser requires exactly one complete
block, requires both markers to be on their own lines, rejects Markdown code
fences, parses raw JSON, and validates the payload against the review
settlement schema.

When accepted, the closure service updates the durable review with its verdict,
score, summary, evidence, and required actions. A draft review conversation is
not allowed to settle successfully without structured review data.

### Why it appears visibly

The current review prompt asks the employee to do both of the following:

1. call the native `submit_review` operation;
2. emit the legacy delimited result block as a compatibility fallback.

The final assistant message is stored and rendered as an ordinary conversation
message. No client projection removes the internal block or replaces it with a
review card. The transport envelope therefore leaks into the user-facing chat.

The screenshot is direct evidence of a duplicated settlement design:

```text
native typed operation
        +
legacy final-message parser
        +
ordinary visible assistant message
```

One review should not need three representations at the completion boundary.

### Why the design is poor even though it works

- It exposes internal protocol syntax to the user.
- It makes the conversation look like debugging output.
- It trains employees to emit implementation details instead of a clean final
  assessment.
- It creates two possible durable mutation paths: `submit_review` and closure
  parsing.
- It is unclear which path was authoritative when both are present.
- It makes provider compatibility concerns part of the employee's visible
  behavior.
- It increases the chance that a future parser, prompt, or renderer change
  breaks review completion.

### Recommended correction

Use one primary settlement path:

```text
reviewer calls submit_review
    -> Buddy store commits structured review
    -> conversation receives review-submitted event
    -> UI renders compact review card
    -> reviewer may finish with ordinary human-readable prose
```

For new Codex Buddy reviews, remove the legacy result-block instructions
because the MCP bridge is required and `submit_review` is already registered.

Keep the parser temporarily only for:

- old persisted review conversations;
- providers that genuinely lack typed tool support;
- recovery of a turn that produced a valid legacy result before migration.

If the fallback remains available for another provider, strip the delimited
block from the visible message projection after successful parsing and render
the structured review as a card. Preserve the raw provider output in
diagnostic/audit storage, not as primary chat content.

Do not ask users to copy, edit, or respond to the JSON block. The useful
information is the resulting review verdict and evidence.

### What the July 29 Growth Engineer thread adds

Conversation `afe4abfc-9243-482c-846d-654151f7a55c` proves that the fallback
path is not merely theoretical. The visible transcript contains the result
block but no user-facing evidence that `submit_review` was called. The reviewer
may have ignored the tool instruction, the tool use may have been omitted from
the visible transcript, or the fallback may have been the actual settlement
path.

Do not remove fallback parsing until runtime telemetry distinguishes:

- review settled by native operation;
- review settled by compatibility envelope;
- both paths observed;
- neither path observed.

The same thread exposes three additional issues:

1. `No Buddy project was selected.` The review can still be valid, but its
   verdict is not attached to the outcome the Lead must eventually close.
2. The reviewed packet was untracked. A file reference can be valid local
   evidence while still being weak durable evidence if it disappears before
   commit or handoff.
3. Raw Buddy IDs, allowed operations, fallback instructions, and JSON dominate
   the visible request. These are necessary model/runtime inputs and poor
   primary UI.

The immediate safe correction is therefore presentation plus observability:

- show a request card;
- show a result card;
- retain raw technical details behind disclosure;
- keep raw message persistence unchanged;
- record which settlement adapter actually committed the review;
- remove the legacy path only after native settlement is proven reliable.

### Implemented presentation correction

The client now has a typed compatibility-adapter layer:

- `buddy-review-message.ts`
  - parses generated review requests;
  - validates legacy result payloads;
  - exports typed request/result data.
- `structured-message-segments.ts`
  - scans legacy AskUserQuestion markers;
  - scans Buddy review-result markers;
  - detects Oompa run fragments;
  - returns one normalized segment union.
- `BuddyReviewMessage.tsx`
  - renders compact request and response cards;
  - keeps evidence and operation details expandable;
  - uses verdict-colored square-edge cards.

The normal Markdown renderer no longer needs to understand each delimiter.
Unknown or malformed review results fail visibly as parse errors rather than
silently becoming durable UI state.

This is intentionally a view-layer migration. It does not yet change provider
events, persisted message schemas, or server settlement authority.

## Unified structured conversation event design

The review-card correction should become the first step toward one graceful
special-component architecture rather than another isolated parser.

### Target flow

```text
provider-native tool/event
        |
        v
provider edge adapter
        |
        v
normalized Unleashd structured event
        |
        +--> authorized durable domain operation
        |
        +--> persisted conversation content part
        |
        v
typed client segment
        |
        v
component registry
```

Examples:

| Source | Normalized event | UI |
| --- | --- | --- |
| Buddy `submit_review` | `buddy.review.submitted` | Review result card |
| Buddy review dispatch | `buddy.review.requested` | Review request card |
| Buddy delegation | `buddy.delegation.created` | Assignment card |
| Buddy approval | `buddy.approval.requested` | Approval card |
| Oompa run lifecycle | `oompa.run.started/updated/completed` | Run card |
| Provider question tool | `interaction.question.requested` | Question card |

### Domain authority and display must remain separate

A structured UI event is not permission to mutate durable state.

For Buddies:

- MCP/HTTP operations validate trusted identity and authority;
- the Buddy store performs the durable transition;
- the server emits a normalized event describing the committed result;
- the client renders that event.

The client must never parse a card payload and use it to authorize or perform a
Buddy mutation. Legacy assistant-output parsing remains a server-side
compatibility adapter with schema validation and scoped settlement.

### Versioned content parts

The long-term message schema should support content parts such as:

```ts
type ConversationContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'structured_event';
      id: string;
      kind: string;
      version: 1;
      payload: unknown;
      source: 'provider_tool' | 'domain' | 'legacy_adapter';
    };
```

Each registered event kind owns:

- a schema/version parser;
- a compact component;
- optional expanded technical detail;
- plain-text fallback for export and unsupported clients.

Unknown event kinds must degrade to a small generic event card. They must not
crash the conversation renderer or expose an entire opaque payload by default.

### Marker comments are edge adapters

HTML comments were chosen because they:

- survive plain-text model output;
- are unlikely to collide with normal prose;
- can delimit JSON without relying on Markdown formatting;
- work across providers that do not expose native structured events.

They are useful compatibility framing, not a canonical application protocol.
New Buddy and Oompa integrations should prefer provider-native tool/event
facts. Marker detection should occur once at ingestion or compatibility
projection, producing the same normalized structured event used by native
sources.

### Oompa migration

The current client recognizes Oompa runs from normalized-looking shell tool
fragments. That is another compatibility heuristic.

The stable design is:

- Oompa runtime emits run ID and lifecycle events;
- Unleashd persists/streams normalized Oompa events;
- the client run card subscribes by run ID;
- shell text remains ordinary diagnostic text.

Do not make additional Oompa components depend on matching command prose.

### MCP integration

MCP should remain a typed operation bridge, not a formatting system.

An MCP tool call provides:

- operation name;
- validated input;
- trusted launch scope;
- structured result;
- success/failure.

Unleashd should map successful domain-relevant calls into normalized
conversation events. The model should not need to restate an MCP result inside
HTML comments for the UI to understand it.

### Migration phases

1. Client compatibility registry
   - normalize existing question, review, and Oompa markers into typed segments;
   - render dedicated components;
   - preserve raw persisted messages.
2. Server normalized events
   - emit Buddy review/delegation/approval events from committed operations;
   - record settlement source.
3. Versioned persisted content parts
   - store text and structured events without encoding events inside prose.
4. Oompa lifecycle migration
   - replace shell-fragment inference with run events.
5. Legacy retirement
   - keep adapters for old conversations;
   - stop prompting capable providers to emit transport comments;
   - preserve plain-text export fallbacks.

## Worst design weaknesses

## 1. Three automation control planes can own the same intention

EventMap currently has recurring work represented in:

- Codex App automations;
- macOS cron;
- Buddy automation definitions.

These systems do not share the same persistence or lifecycle contract. Some
Codex App jobs have explicit send authority, while the macOS jobs are
read-only and the Buddy definitions are disabled.

The danger is not merely duplicated analysis. It includes:

- duplicate external sends;
- two runs writing competing evidence packets;
- disagreement about whether an occurrence completed;
- a Lead seeing Buddy run history that omits work run elsewhere;
- ambiguous restart and catch-up behavior.

Required correction:

- maintain one inventory of recurring intentions;
- name exactly one scheduler owner for every occurrence;
- record the authority class separately from the schedule;
- migrate one job at a time;
- prove one bounded occurrence;
- disable the old owner before enabling the replacement;
- never make Buddy and Codex App write each other's mutable database rows.

The systems may coexist, but one intention cannot have multiple active owners.

## 2. Durable truth is fragmented across too many surfaces

Employee and project reality is currently represented by some combination of:

- Buddy SQLite records;
- `BUDDY_SOUL.md`;
- Buddy private memory files;
- repository Markdown and campaign ledgers;
- Unleashd conversation metadata;
- provider session artifacts;
- Codex App automation state;
- macOS cron configuration.

Every individual choice is defensible. Together they impose a high
reconciliation cost.

The Growth Lead proof already exposed the failure mode: repository evidence
showed current campaign decisions while durable projects still described older
states. The model had to infer which source was authoritative.

The authority rule should be explicit and short:

| Concern | Authority |
| --- | --- |
| Employee identity, relationships, assignments, lifecycle, runs | Buddy DB |
| Deliverables, campaign evidence, decision records | Repository |
| Discussion and transient reasoning | Conversation |
| Behavior contract | `BUDDY_SOUL.md` |
| Compressed employee recollection | Buddy memory |
| Provider resume mechanics | Provider session storage |
| Recurring occurrence ownership | Exactly one selected scheduler |

Conversation prose must not become a second project database. Repository files
must not silently substitute for assignment settlement. Buddy state must point
to evidence rather than copy whole evidence packets.

## 3. Completion remains too dependent on perfect model behavior

Typed completion operations are an important improvement, but the model can
still:

- finish useful work without calling the operation;
- call it before the artifact is actually complete;
- stop after a provider error;
- produce evidence while leaving the assignment active;
- close its own work while the Lead's parent project remains stale.

The runtime must preserve four distinct concepts:

```text
provider turn ended
conversation ended
assignment reached a terminal state
project definition of done was accepted
```

These states must not be treated as synonyms.

Required correction:

- surface conversations that ended with active assignments;
- surface completed assignments whose parent project was not reconciled;
- require evidence for terminal completion;
- keep reviewer/Lead acceptance separate from employee self-completion;
- make stale or abandoned assignments an explicit inbox item;
- do not infer success merely because a provider turn completed.

## 4. Scheduler features exceed proven workflow semantics

The scheduler supports prompt jobs, sequences, bounded loops, termination
conditions, claims, restart recovery, and coalesced overdue execution.

The real Growth workflow requires causal dependency:

```text
Operator produces evidence packet A
    -> Critic reviews exactly packet A
    -> Lead decides using packet A and its review
```

Schedules at 08:30, 08:45, and 09:00 do not guarantee that dependency. If the
Operator is slow or fails, the downstream employees can run against stale or
missing input.

Choose one of two honest designs:

1. Keep jobs independent and make each one safely inspect whether its required
   evidence exists.
2. Add explicit run dependencies and pass immutable artifact/run identifiers
   between stages.

Do not imply workflow ordering through time offsets alone.

The current startup policy is sound for a local employee scheduler: poll
immediately, claim one overdue occurrence, and coalesce missed intervals
instead of replaying a backlog. Preserve this behavior.

## 5. Buddies is more coupled to Unleashd than the package boundary implies

The standalone package owns useful durable primitives. Actual employee
behavior nevertheless depends on:

- Unleashd conversation construction;
- hidden first-turn briefing injection;
- provider-specific MCP launch configuration;
- conversation lifecycle events;
- the Unleashd scheduler process remaining alive;
- Unleashd routes and UI.

This is not necessarily wrong. It means Buddies is presently an Unleashd
subsystem with a separately packaged persistence core, not yet a
host-independent employee framework.

Required correction:

- describe the boundary honestly;
- keep the standalone package focused on durable domain operations;
- keep provider/session/UI behavior in Unleashd;
- do not add abstractions for imaginary hosts;
- claim portability only after a second real host uses the operation contract.

## 6. Authorization logic is distributed across too many layers

Authority is derived from:

- trusted Buddy conversation context;
- workspace assignment;
- project ownership;
- reporting/reviewer relationships;
- allowed-operation lists;
- MCP tool registration;
- operation-level validation;
- route-level validation.

Defense in depth is valuable, but policy becomes difficult to audit when each
layer partially reconstructs it.

The design needs one canonical capability resolver:

```text
employee identity
+ relationship
+ workspace
+ conversation purpose
+ selected assignment/review
-> exact capabilities and exact resource identifiers
```

MCP registration, HTTP/UI availability, context briefing, and server operation
checks should consume that resolution. Operation-level ownership checks should
remain as the final enforcement boundary, but higher layers should not invent
slightly different policy.

## 7. Internal control-plane concepts leak into the chat UI

The visible `buddy-review-result` block is the clearest example, but the issue
is broader. Conversation is being asked to carry:

- human discussion;
- hidden briefing transport;
- review settlement transport;
- delegation outcomes;
- provider session state;
- debug/status information.

The desired product principle is:

```text
ordinary conversation for discussion
+ small structured cards for durable events
```

Useful cards include:

- assignment received;
- review requested;
- review submitted;
- approval requested;
- project blocked;
- project completed;
- automation run started/failed/completed.

Cards should link to evidence and expose the smallest relevant actions. They
should not turn Chat into a second workflow application.

## 8. The typed inbox is correct in storage but incomplete as a product

Avoiding a generic employee mailbox was the right decision. Delegations,
reviews, approvals, blocked projects, and automation failures already form the
durable actionable inbox.

However, an inbox that exists only as a native operation and injected context
does not fully solve the owner's problem. The Lead still needs a compact
decision surface showing:

- what changed;
- who owns it;
- whether it requires the Lead;
- the evidence;
- the next action;
- accept, return, or close.

Without that surface, asking “what is going on with the team?” still triggers
an expensive reconstruction.

Do not build a free-form mailbox. Build one small action queue from existing
typed records.

## 9. The work model risks becoming more administrative than useful

The system now contains:

- employees;
- relationships;
- skills;
- workspaces;
- projects;
- todos;
- planning/sprint context;
- conversations;
- delegations;
- reviews;
- approvals;
- automations;
- automation runs;
- memory;
- audit events.

Each entity has a rationale. The combined vocabulary may exceed what GTM work
needs.

The primary product object should remain understandable as:

```text
Outcome
- owner
- status
- next action
- definition of done
- evidence
- decision
```

Todos can remain children of an outcome. Sprint should remain a view or small
planning context unless repeated use proves that it needs stronger lifecycle
semantics.

Do not add another planning entity to solve inconsistent closure. Fix closure.

## 10. Employee personality remains mostly a prompt claim

`BUDDY_SOUL.md` creates useful behavioral containment. It does not guarantee
that:

- the Critic remains adversarial;
- the Operator avoids taking strategy ownership;
- the Lead rigorously reviews reports;
- employees maintain distinct judgment after compaction;
- a highly agreeable model obeys a “not easily impressed” persona.

The product must evaluate behavior through output evidence:

- Did the Critic identify a real falsifiable weakness?
- Did the Operator produce the requested artifact without expanding scope?
- Did the Lead reject incomplete work?
- Did the employee respect approval boundaries?
- Did the same role behave consistently across several runs?

Soul files are configuration. Repeated behavior is the product.

## 11. Local-server durability is not operational durability

Buddy state survives process restart, and overdue enabled automations are
claimed when Unleashd starts. But runs occur only while the local server and
machine are available.

This is acceptable for the current product, provided the UI and documentation
state it plainly. It is not equivalent to a continuously available hosted
employee service.

Do not add distributed infrastructure prematurely. First prove that the local
team loop creates value. If reliable unattended execution becomes necessary,
move the scheduler worker to a supervised always-on environment while
preserving the same claims and operation contract.

## 12. The architecture has outrun product evidence

The implementation includes sophisticated support for:

- durable dispatch claims;
- scoped MCP operations;
- structured review;
- typed inbox projections;
- automation claims;
- restart recovery;
- approval requests;
- bounded context envelopes;
- audit trails.

The decisive product question is still unanswered:

> Does one Growth Lead close important GTM work more reliably through Buddies
> than through ordinary Codex conversations plus disciplined Markdown?

The next phase should optimize for answering that question, not for expanding
the abstraction surface.

## What is good and should be preserved

This critique should not erase the strongest decisions:

- Employee identity is durable while provider processes are replaceable.
- A Buddy can work across several workspaces.
- Conversation remains an ordinary provider thread.
- Buddies and Swarms are explicitly different concepts.
- Context provides guidance; typed operations enforce authority.
- MCP is an adapter, not the domain model.
- Project ownership is not implicitly transferred during delegation.
- Reviews and delegations are durable typed records, not generic messages.
- Human approval records do not themselves execute external actions.
- Automation claims are durable and restart-aware.
- Missed intervals are coalesced rather than replayed.
- Memory remains contained and separate per employee.
- Repository evidence is preserved rather than copied wholesale into SQLite.
- The system avoids Slack, Telegram, and a generic mailbox.

These choices provide a credible base for simplification.

## Recommended correction order

### P0 — remove duplicate review settlement for new Codex conversations

- Stop instructing new Codex reviewers to emit the legacy block.
- Use `submit_review` as the only primary durable mutation.
- Emit a structured review-submitted event.
- Render a compact review card.
- Retain legacy parsing only for persisted/recovery compatibility.
- Never show successfully parsed transport syntax as ordinary chat content.

### P0 — establish one owner per recurring occurrence

- Inventory Codex App, macOS cron, and Buddy definitions.
- Record authority class, especially external-send permission.
- Leave Buddy definitions disabled until one bounded proof passes.
- Migrate and disable old owners individually.

### P0 — make unresolved closure visible

- Surface ended conversations with active assignments.
- Surface completed report work awaiting Lead reconciliation.
- Surface stale reviews and failed automations.
- Do not add a new mailbox table.

### P1 — create a minimal Lead action queue

One view, derived from existing records:

- reviews awaiting decision;
- completed delegations awaiting reconciliation;
- approval requests;
- blocked outcomes;
- failed/stale automation runs.

### P1 — make scheduled dependencies truthful

For the first daily chain, either:

- use one Lead-owned orchestration occurrence that explicitly delegates and
  reviews; or
- persist immutable upstream run/artifact IDs and require them downstream.

Do not rely on a fifteen-minute offset.

### P1 — centralize capability resolution

Create and test one pure resolution step. Keep store ownership validation as
the final guard.

### P2 — simplify after one week of use

Inspect which concepts the Lead actually used. Remove or demote unused
surfaces. Do not preserve entities merely because their implementation is
complete.

## One-week operating trial

Freeze feature development and operate:

- one Growth Lead;
- one Growth Operator;
- one Go-to-Market Critic;
- optionally one Growth Engineer only when the Lead has a concrete technical
  deliverable;
- one workspace;
- at most three active outcomes;
- one read-only Buddy-controlled daily automation;
- no Buddy-controlled sends, publishing, deployment, or spend.

For each outcome, require:

- named owner;
- definition of done;
- next action;
- evidence location;
- terminal employee settlement;
- review when material;
- Lead acceptance or return;
- reconciled durable project state.

Measure:

- percentage of assignments reaching a truthful terminal state;
- percentage requiring the owner to ask for status reconstruction;
- stale project count;
- duplicate or conflicting runs;
- time from employee completion to Lead decision;
- number of useful Critic objections;
- number of scope or approval violations;
- number of internal protocol artifacts visible in chat.

Success is not more employee activity. Success is fewer forgotten outcomes and
less owner effort to reconstruct reality.

## Final product principle

Buddies should feel like ordinary conversations with accountable coworkers,
not a workflow engine exposed through chat.

The minimum durable surface is:

```text
identity and soul
+ private memory
+ owned outcomes and todos
+ scoped conversations
+ typed delegation and review
+ one actionable Lead queue
+ one scheduler owner per recurring intention
```

Everything else must justify itself through repeated use.

## July 29 lean closure decision

This pass intentionally stops at presentation and compatibility:

- render generated Buddy review requests as cards;
- render legacy delimited review results as validated cards;
- support both review-prompt shapes already emitted by the server;
- keep raw persisted messages and durable settlement behavior unchanged;
- add focused parser and UI-contract coverage;
- make no scheduler, external-send, provider, MCP, or Oompa runtime changes.

The Buddy automation engine is implemented. It can schedule occurrences,
durably claim runs, coalesce missed intervals, and recover overdue enabled
work when Unleashd starts. The currently configured EventMap Buddy
automations are disabled by ownership policy, not because the engine is
nonfunctional. Existing Codex App/macOS jobs remain the active owners until a
single read-only Buddy occurrence is deliberately proven and the old owner is
disabled.

Migrating external-send jobs is not part of a lean UI stabilization pass.
That changes operational authority and can create duplicate sends if two
schedulers overlap. It should be a separate, explicit migration with one
named owner, a bounded proof run, reconciliation, and removal of the previous
schedule.

Buddies does not use Oompa. They remain separate domain systems:

- Buddies owns persistent employees, work, delegation, review, memory, and
  automation records.
- Oompa owns bounded swarm execution.

Their only shared concern in this pass is the existing client presentation
boundary: both can produce non-prose conversation fragments that should be
normalized before rendering. Moving the existing Oompa detector into the
structured-segment scanner changes no Oompa behavior and creates no Buddy
runtime dependency on Oompa.

### Observed startup timing edge

During a concurrent server restart, a browser connected before disk session
hydration completed and received an empty `init` snapshot. The running server
then hydrated the target conversation, but that already-connected client did
not receive a replacement snapshot; reloading after hydration showed the
persisted thread correctly.

This is not a Buddy persistence failure: the conversation config, provider
session, and hydrated server record all existed. It is a general Unleashd
startup broadcast timing edge. Because another agent is actively refactoring
the general server lifecycle, this Buddy pass records the evidence and avoids
an overlapping server mutation. The eventual invariant should be either:

- do not accept WebSocket initialization until initial disk hydration is
  complete; or
- broadcast an authoritative replacement epoch after initial hydration.
