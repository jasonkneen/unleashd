# Buddies Retrospective and Gap Audit

**Date:** 2026-07-28
**Repositories:** `unleashd`, sibling `buddies`
**Status:** Historical prototype checkpoint. Later implementation and live
proof supersede its completion claims; current gates are maintained in
`agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md`.

## Why this note exists

The Buddies work grew from a small question—whether persistent employees could
be represented by files and long-running Codex conversations—into a broad
runtime, persistence, automation, delegation, review, and UI surface.

That breadth makes it easy to confuse "many implemented components" with the
actual product outcome:

> A Buddy should repeatedly identify the highest-value current work, execute a
> bounded action, update durable state with evidence, close or precisely block
> the work, preserve compact memory, and follow through without the owner
> repeatedly asking what happened.

This note records what exists, what is only partially proven, and which
decisions should guide the next implementation work.

## Original user problems

1. Automations are interval prompts, not employees.
2. Conversations start work but do not reliably close it.
3. Current sprint and current tasks are difficult to see.
4. Repeatedly asking an agent for status is itself management work.
5. A persistent employee should have a stable personality, role, skills,
   memory, work ownership, and conversation history.
6. A lead should delegate to specialized employees and judge their performance.
7. Adversarial behavior should be isolated to a critic rather than contaminating
   every agent interaction.
8. The main use case is GTM campaign ownership for Magic Genie and EventMap.

## Major decisions made

### Build a small domain library instead of adopting Hermes/OpenClaw

The user does not need messaging integrations, a plugin marketplace, a hosted
gateway, or a general-purpose remote agent control plane. A narrow local
library can express the missing concepts with less surface area.

This remains the correct direction. The problem is not that the custom library
is too small. The problem is that we implemented too many secondary concepts
before proving the closure loop.

### Separate durable employee state from the provider runtime

The `buddies` library owns:

- employee identity;
- home workspace and assignments;
- soul and memory paths;
- skills and team relationships;
- current work;
- conversation links;
- automations and run history;
- delegation and review records.

Unleashd owns:

- provider selection and execution;
- conversation lifecycle;
- streaming;
- persisted provider sessions;
- scheduler polling;
- UI and WebSocket state.

This separation is good and should be preserved.

### A Buddy is cross-workspace; a run is not

A Buddy may be assigned to Buddies, Magic Genie, and EventMap. Every
conversation, automation run, delegation, and review must select exactly one
workspace. The working directory and authority are derived from that selection.

### A Buddy conversation is an ordinary conversation with typed context

Buddy conversations use normal chat rendering and normal provider execution.
They carry `buddyContext` and render a compact Buddy header. They are not
Swarms and must never use `swarmDebugPrefix`.

### Conversation is the primary human interaction

The first employee UI exposed a large project creation form and direct todo
controls. That treated the user as the work-management API client.

The corrected model is:

- inspect state in the employee view;
- press **Start conversation**;
- talk to the employee;
- the employee uses bounded durable operations to update state.

The start button creates an empty conversation. It does not send an automatic
"review your responsibilities" message.

### Teams reduce directory clutter

Only top-level employees appear as directory cards. Direct reports are
summarized as a team count and remain available for delegation and review.
Recent Buddy conversations appear in one virtual `Buddies` folder under Recent
Projects instead of an employee → workspace → conversation tree.

## What is implemented and evidenced

### Storage

Evidence: sibling `buddies/src/store.js`; 16 passing Node tests.

- SQLite schema version 6.
- WAL mode for file databases.
- Strict tables and foreign keys.
- Buddy home workspace and additional assignments.
- One active sprint per workspace.
- Legacy work items.
- Owned Buddy projects and todos.
- Atomic project and todo mutation.
- Required blocker reasons.
- Conversation links scoped to Buddy and workspace.
- Memory path containment and symlink escape protection.
- Automation definitions and idempotent run claims.
- Relationships, skills, delegations, and reviews.

### Runtime integration

Evidence: `shared/src/index.ts`, `server/src/buddies/*`,
`server/src/adapters/jsonl.ts`, focused scheduler tests.

- Typed `buddyContext`.
- Context is separate from swarm state.
- Soul, memory, relationships, skills, and work are resolved before execution.
- First user message receives a hidden briefing.
- Hidden briefing is removed from visible hydrated prompt text.
- Conversation links are created server-side.
- Scheduler supports interval, cron, prompt, sequence, and bounded loop jobs.
- Interrupted runs are failed and advanced.

### Initialized GTM team

Evidence: sibling `buddies/scripts/initialize-growth-lead.js` and current DB.

- Growth Lead.
- Go-to-Market Critic.
- Growth Operator.
- Manager/report/review relationships.
- Always-on employee-review, PMF critique, and solution-design skills.
- Magic Genie and EventMap assignments.
- Fifteen imported GTM work items.

### UI

Evidence: production client build and manual browser inspection.

- Top-level Buddy directory.
- Team count.
- Employee detail.
- Read-only work view.
- Conversation, memory, and automation tabs.
- Lead delegation/review controls.
- Buddy-specific chat header.
- One recent-project-style Buddies sidebar folder.
- Durable recent links survive server restart.

## What is not yet proven

### The core closure loop

There is no deterministic end-to-end test proving:

1. user starts an empty Growth Lead thread;
2. first user message receives the correct hidden briefing;
3. the Buddy chooses current work;
4. the Buddy calls a durable operation;
5. state changes atomically;
6. evidence is recorded;
7. work reaches done, blocked, review, or an explicit next action;
8. memory is compacted;
9. restart preserves all state and UI links.

Until that test exists, "persistent employee" is an architectural claim, not a
fully proven behavior.

### Native model operations

The briefing tells the model to use the `buddies` CLI. `new_project`,
`update_project`, and `remember` are not registered as native typed tools.

Consequences:

- the provider must discover and correctly invoke shell commands;
- malformed JSON is possible;
- scope is described rather than mechanically bound;
- tool calls are harder to audit;
- delegation and review completion are not available in the CLI surface.

### Automatic review completion

The system can create a review conversation and a draft review row. It does not
currently parse the review result into a validated verdict, score, summary, and
evidence record automatically.

### Automatic memory compaction

Memory is file-backed and append-only, but there is no compaction policy:

- no journal rollup trigger;
- no token budget;
- no evidence-preserving summary schema;
- no superseded-fact handling;
- no explicit distinction between decisions, preferences, facts, and open
  questions.

### One canonical work model

The imported GTM campaigns are legacy `work_items`. New Buddy operations mutate
`owned_projects` and `buddy_todos`.

This is the largest domain-quality defect. The Growth Lead's actual imported
work and the new mutable Buddy work are not the same records.

### Fresh-clone installation

Unleashd dynamically imports `@nbardy/buddies`, but the server manifest does not
declare it. The current machine works because
`server/node_modules/@nbardy/buddies` is a manual symlink to the sibling repo.

The sibling Buddies repository is also entirely untracked. A fresh clone cannot
reproduce the working system.

## Quality risks

### Client N+1 projections

The directory and sidebar fetch the Buddy dashboard and then one detail request
per employee to calculate teams and recent conversations. Hierarchy and recent
run reconciliation are duplicated in React.

Required correction: one server-produced overview projection.

### Redundant relationship edges

The seed writes both `manager` and reciprocal `reports_to` edges. Consumers
must deduplicate them. This already produced a four-report display for a
two-person team.

Required correction: choose one canonical management edge or make the store
return a normalized organization projection.

### Link lifecycle ambiguity

Durable Buddy links remain `active` while the Unleashd conversation is idle.
The product needs distinct meanings for:

- created but unused;
- idle/open;
- running;
- complete;
- failed;
- cancelled;
- abandoned.

### Scheduler limitations

- Process-local timer.
- No explicit leader election.
- Termination depends on a text sentinel.
- No structured outcome contract.
- No per-automation cost or permission budget.
- Real provider execution is not covered by an integration test.

### Startup reliability

The server exhausted the default Node heap while scanning approximately 500
conversation files. With an 8 GB heap, one startup took about 44 seconds.

A persistent employee control room cannot be considered operationally reliable
until ordinary restart behavior is bounded and tested.

## Current confidence assessment

| Area | Confidence | Evidence |
|---|---:|---|
| Storage invariants | High | 16 focused library tests |
| Memory containment | High | traversal and symlink tests |
| Scheduler algorithm | Medium-high | 8 focused tests with fakes |
| Typed Buddy context | Medium-high | schema and hydration tests |
| UI happy path | Medium | manual browser QA and production build |
| Restart behavior | Medium-low | manually observed, not E2E tested |
| Fresh installation | Low | manual symlink; sibling repo uncommitted |
| Autonomous closure | Low-medium | operations exist; loop unproven |
| Delegation lifecycle | Medium-low | creation/settlement pieces exist |
| Review lifecycle | Low | draft creation exists; settlement missing |
| Memory compaction | Low | not implemented |

## Product lesson

The system should be judged by closed work, not by the number of agent
abstractions it contains.

The next milestone is not another role, page, or automation type. It is:

> Growth Lead closes one real GTM task with durable evidence, needs no repeated
> status prompt, survives restart, and leaves an intelligible next state.
