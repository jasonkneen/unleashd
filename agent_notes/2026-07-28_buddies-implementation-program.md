# Buddies Implementation Program

**Date:** 2026-07-28
**Goal:** Move Buddies from a functional prototype to a reproducible,
evidence-backed persistent employee system.

**Status:** Historical implementation program. The control-plane baseline is
implemented; use
`agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md` for the
current record.

## Program rules

1. Do not add another employee role until one closure loop passes end to end.
2. Do not treat a UI control as proof that the underlying lifecycle works.
3. Every state mutation must be deterministic and mechanically scoped.
4. Every long-running job needs a hard stop, a durable run record, and a restart
   story.
5. Every "complete" claim must cite evidence.
6. Current work must have exactly one canonical representation.
7. The user interacts through conversation; administrative APIs remain
   available for agents and tests.
8. Do not edit `server.ts` while the active server refactor is in flight.

## Definition of the target system

A production-quality Buddy has:

- stable identity;
- a home workspace;
- zero or more assigned workspaces;
- a soul;
- versioned skills;
- bounded durable memory;
- a normalized reporting line;
- one canonical current-work model;
- ordinary conversations with typed Buddy context;
- native scoped operations;
- durable automation definitions and runs;
- delegation and review lifecycles;
- a closure policy;
- a compact UI projection;
- clean-clone reproducibility;
- restart and failure recovery tests.

## Phase 0 — Preserve evidence and coordinate work

### Deliverables

- [x] Retrospective and gap audit.
- [x] Implementation program.
- [x] Server-refactor coordination note.
- [x] Capture exact current database schema and row counts.
- [x] Record the current source commit and package-link state.
- [x] Add a no-touch list for files owned by the concurrent refactor.

### Exit gate

Another agent can read the notes and identify:

- current facts;
- unresolved assumptions;
- authoritative source files;
- forbidden concurrent edit zones;
- the next independently executable task.

## Phase 1 — Canonical work model

### Problem

Imported campaigns are `work_items`; new Buddy work is `owned_projects` plus
`buddy_todos`. The system has two truths.

### Decision

Use owned Buddy projects as the canonical mutable work model.

Legacy work items may remain as import provenance during migration, but:

- every open imported campaign receives one owned Buddy project;
- `external_key` maps them idempotently;
- the owned project stores source path and evidence metadata;
- directory counts and employee work views use owned projects;
- legacy rows are never counted as additional current work;
- once migration is proven, legacy work becomes read-only provenance.

### Tasks

- [x] Add `upsertBuddyProject` keyed by workspace + external key.
- [x] Define deterministic legacy → owned-project field mapping.
- [x] Add migration tests for repeated runs.
- [x] Preserve status, priority, next action, blocker, definition of done, source
      path, sprint, and owner.
- [x] Seed at least one initial todo per imported campaign when a next action
      exists.
- [x] Update the Growth Lead initializer to promote all fifteen campaigns.
- [x] Update dashboard counts to owned projects.
- [x] Keep legacy evidence visible only as provenance.
- [x] Add a database audit command reporting unmigrated open work.

### Exit gate

- Fifteen open/current GTM campaigns map to exactly fifteen canonical owned
  projects.
- Running initialization twice creates no duplicates.
- Directory and employee views agree on counts.
- `update_project` can mutate every displayed current campaign.

## Phase 2 — Overview projection and client simplification

### Problem

React reconstructs organization and recent-run state with N+1 HTTP calls and
duplicated normalization logic.

### Target endpoint

`GET /api/buddies/overview`

Expected shape:

```ts
type BuddyOverview = {
  generatedAt: string;
  topLevel: Array<{
    buddy: Buddy;
    workspaces: Workspace[];
    team: Array<{ id: string; name: string; role: string; status: string }>;
    currentWork: {
      open: number;
      active: number;
      blocked: number;
      review: number;
      nextActionMissing: number;
    };
  }>;
  recentRuns: Array<{
    conversationId: string;
    buddyId: string;
    buddyName: string;
    workspaceId: string;
    workspaceName: string;
    status: string;
    lastActiveAt: string;
  }>;
};
```

### Tasks

- [x] Add a normalized organization projection to the library.
- [x] Normalize management pairs regardless of whether old data contains
      `manager`, `reports_to`, or both.
- [x] Return deduplicated teams.
- [x] Produce current-work counts from owned projects.
- [x] Produce recent runs from durable links.
- [x] Add `/api/buddies/overview` in `routes.ts`.
- [x] Add route tests.
- [x] Replace directory N+1 requests.
- [x] Replace sidebar N+1 requests.
- [x] Keep organization sorting/filtering in the server/library projection;
      do not duplicate it in a client atom.
- [x] Remove obsolete Buddy tree CSS and client normalization code.

### Exit gate

- One request renders both the directory and recent Buddy folder.
- Two direct reports always produce a team count of two.
- Restart preserves recent-run display.
- No per-employee detail request is issued by the directory/sidebar.

## Phase 3 — First-class Buddy operations

### Problem

The model is instructed to use shell CLI commands. Scope and payload validation
are not bound to the conversation.

### Required operations

- `buddy.get_current_work`
- `buddy.new_project`
- `buddy.update_project`
- `buddy.remember`
- `buddy.delegate`
- `buddy.complete_delegation`
- `buddy.submit_review`
- `buddy.request_human_approval`

### Operation invariants

- Buddy ID comes from conversation context, not model input.
- Workspace defaults to conversation scope and cannot be changed silently.
- A project must belong to the selected Buddy/workspace.
- Blocked work requires a blocker and clearing condition.
- Done work requires evidence and a definition-of-done check.
- External sends, spend, publishing, and deployment require the existing human
  approval gates.
- Every operation appends an audit record.

### Tasks independent of `server.ts`

- [x] Define Zod operation schemas in a separate module.
- [x] Implement a `BuddyOperationsService` over `BuddiesStorePort`.
- [x] Add operation result schemas.
- [x] Add store-level audit events.
- [x] Extend the CLI with delegation and structured review commands.
- [x] Add unit and integration tests.

### Provider integration

- [x] Register operations for Codex through a conversation-scoped stdio MCP
      adapter without editing `server.ts`.
- [x] Bind Buddy, workspace, and selected project in trusted MCP launch
      arguments rather than model tool input.
- [x] Test the native surface through both an in-memory MCP client and a spawned
      stdio process reopening durable SQLite state.
- [ ] Add equivalent native adapters for non-Codex providers; they currently
      retain the CLI compatibility fallback.

### Exit gate

A provider shim can complete a project, block a todo, remember a decision,
delegate a critique, and submit a review without shell string construction.

## Phase 4 — Delegation and review closure

### Delegation lifecycle

```text
pending → active → complete
                 ↘ failed
                 ↘ cancelled
```

Required evidence:

- parent Buddy;
- child Buddy;
- workspace;
- optional project;
- bounded purpose;
- parent and child conversation IDs;
- outcome;
- child durable state changes;
- completion timestamp.

### Review lifecycle

```text
draft → complete
      ↘ cancelled
```

Structured review result:

```ts
{
  verdict: "needs_work" | "pass" | "fail";
  score: number | null;
  summary: string;
  evidence: Array<{
    kind: "file" | "conversation" | "project" | "metric";
    reference: string;
    observation: string;
  }>;
  requiredActions: string[];
}
```

### Tasks

- [x] Add validated structured output for review conversations.
- [x] Automatically persist review completion from a strictly delimited,
      schema-validated result block.
- [x] Fail review settlement if evidence is empty.
- [x] Ensure the Lead cannot review itself.
- [x] Ensure the reviewed project belongs to the subject.
- [x] Settle delegation exactly once.
- [x] Prevent conversation completion and HTTP retry from double-settling.
- [x] Render compact team member and review cards.
- [x] Add lifecycle tests covering success, failure, cancellation, idempotency,
      and file-backed restart.

### Exit gate

The Lead delegates to the Critic, receives a structured critique, asks the
Operator for a repair, and records an evidence-backed employee review without a
manual PATCH request.

## Phase 5 — Memory compaction

### Memory categories

- Decisions.
- Stable preferences.
- Durable facts.
- Project lessons.
- Failed hypotheses.
- Open questions.
- Relationship/management notes.

### Files

```text
memory/
  summary.md
  index.json
  journal/YYYY-MM-DD.md
  archive/YYYY-MM/
```

### Compaction policy

Trigger when either:

- journal content exceeds a token/character budget;
- more than seven daily journal files are active;
- an automation explicitly requests a rollup;
- a project closes.

Compaction must:

- preserve references to source journal entries;
- retain unresolved blockers and promises;
- remove exact duplication;
- mark superseded facts;
- never silently convert inference into fact;
- write atomically;
- be idempotent.

### Tasks

- [x] Define structured memory index.
- [x] Add `compactMemory`.
- [x] Add dry-run output.
- [x] Add archive and rollback behavior.
- [x] Add containment checks to every new path.
- [x] Add tests for idempotency, source retention, and interrupted writes.
- [ ] Add an optional bounded compaction automation.

### Exit gate

Thirty synthetic journal entries compact into a bounded summary, preserve all
open commitments and evidence references, and survive an interrupted write.

## Phase 6 — Automation hardening

### Tasks

- [x] Replace raw completion sentinel matching with structured JSON completion.
- [x] Add durable per-run runtime/iteration/token/cost budgets and immutable
      policy snapshots. Provider token/cost event accounting is still pending
      because the unified provider event contract does not expose main-turn
      usage.
- [x] Add allowed-operation policy and enforce it at the native Buddy operation
      boundary for automation-scoped conversations.
- [x] Add durable pending/approved/rejected human approvals, atomic audit
      history, owner HTTP decisions, and a compact decision UI. Approval grants
      do not yet unlock any open-world execution tool because Buddies exposes
      no such tool.
- [x] Add run cancellation.
- [x] Bound every prompt, sequence, and loop turn by the claimed run's runtime
      policy; timeout stops the provider conversation and records failure.
- [x] Add scheduler health status.
- [x] Add real shim-provider integration tests.
- [x] Add multi-connection SQLite claim test.
- [x] Add restart recovery test using a real temporary SQLite database.

### Exit gate

Two scheduler processes cannot execute the same due run; cancellation stops the
provider turn; restart produces one terminal run record and one next schedule.

## Phase 7 — Current work and closure UX

### Employee view priorities

The first visible information should answer:

1. What is this employee responsible for now?
2. What is actively moving?
3. What is blocked?
4. What lacks a next action?
5. What changed in the last run?
6. When will it run again?

### Tasks

- [x] Add `Current sprint`.
- [x] Add `Current tasks`.
- [x] Add one primary next action.
- [x] Add stale-work warning.
- [x] Add last-run timestamp; outcome summary remains future work.
- [x] Add next automation time.
- [x] Add compact team-member/review cards.
- [x] Keep Start conversation as the primary action.
- [x] Avoid returning manual project administration forms.

### Exit gate

The owner can understand the Growth Lead's current state in under ten seconds
without opening a conversation.

## Phase 8 — Hermetic installation and release

### Tasks

- [ ] Commit the Buddies repository.
- [x] Select distribution:
  - workspace package inside Unleashd;
  - Git submodule with a reachable remote;
  - or versioned package dependency. **Selected:** vendored versioned npm
    package snapshot, bundled into the Unleashd release artifact.
- [x] Declare `@nbardy/buddies` in the server and release manifests.
- [x] Update the lockfile.
- [x] Add clean-clone bootstrap instructions.
- [x] Update package smoke coverage to require the bundled Buddies module and
      a live `/api/buddies` response.
- [x] Add a reproducible two-pack vendor command, SHA-256 provenance record,
      and package-smoke hash verification. The current snapshot remains marked
      non-release because the sibling source has no commit.
- [x] Add database backup command.
- [ ] Add migration dry run.
- [x] Add downgrade refusal and recovery documentation.

### Exit gate

A clean machine can clone, install, initialize the GTM team, start Unleashd,
and open `/buddies` without a manual symlink.

## Phase 9 — Runtime performance

### Tasks

- [ ] Profile the 500-session startup path.
- [ ] Measure peak heap and retained strings.
- [ ] Bound parser concurrency by memory.
- [ ] Avoid holding duplicate parsed conversation bodies.
- [ ] Add progressive-load UI status.
- [ ] Add a 500-session fixture benchmark.
- [ ] Set a startup time and heap regression budget.

### Exit gate

The application starts under the default Node heap with 500 representative
sessions and reaches a usable Buddy directory within a defined budget.

## Phase 10 — End-to-end closure proof

### Scenario

Use one real but safe GTM task that does not require external sends or spend.

1. Initialize the Growth Lead.
2. Open an empty EventMap-scoped conversation.
3. Ask for the highest-value safe next action.
4. Require the Buddy to select one canonical current project.
5. Execute a bounded repository-local action.
6. Invoke a native durable operation.
7. Ask the Critic for a structured review.
8. If needed, delegate repair to the Operator.
9. Reconcile the project status and next action.
10. Write a compact memory entry with evidence.
11. Restart Unleashd.
12. Verify the project, conversation links, review, delegation, and memory.
13. Verify the directory and recent-run sidebar projection.

### Required automated tests

- [x] Library migration and invariants.
- [x] Overview route.
- [x] Empty Buddy conversation creation through the WebSocket service path.
- [x] First-turn hidden context exactly once, including resume behavior.
- [x] Visible prompt sanitization during disk hydration.
- [x] Native operation scope.
- [x] Delegation settlement.
- [x] Review settlement.
- [x] Memory compaction.
- [x] Automation execution.
- [x] Restart hydration for library work, audit, organization, and recent runs.
- [x] Recent-run projection.
- [x] Assembled synthetic closure fixture covering briefing, native MCP work
      mutation, memory compaction, delegation, review, audit, restart, and
      overview.
- [x] Browser happy path against a built server: top-level directory, employee
      state, empty conversation, Buddy header, no Swarm Debug, native read-only
      MCP call, and Recent Projects Buddies folder.

### Final completion gate

The program is complete only when:

- clean install works;
- one canonical work model exists;
- native operations are scoped and tested;
- delegation and review self-close;
- memory compacts;
- scheduler restart/cancellation is proven;
- default-heap startup is stable;
- one real GTM task closes end to end;
- every claim above has an authoritative test or inspected runtime artifact.
