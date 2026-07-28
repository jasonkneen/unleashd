# Buddies Post-Audit Closure Plan

**Date:** 2026-07-28
**Status:** Completed historical execution note. Current completion status and
remaining gates are maintained in
`agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md`.
**Constraint:** Do not edit `server/src/server.ts` while the conversation-server
refactor is active. Integrate through the extracted Buddy, conversation, HTTP,
and lifecycle modules.

## Product outcome

Buddies is successful when the owner can talk to the Growth Lead, allow it to
move one bounded GTM project, and later inspect an authoritative record of:

- what changed;
- which evidence supports the change;
- whether a critic reviewed it;
- whether delegated work completed or failed;
- what is blocked;
- the next action;
- what the employee retained in memory.

The employee must survive conversation replacement and application restart.
The test of the product is closed work, not the number of agent abstractions.

## Current evidence

As of the post-audit implementation pass:

- Buddies schema is version 7.
- The current database has 15 canonical owned projects and no unmigrated open
  legacy work.
- Buddies has 24 passing library tests.
- Focused Unleashd Buddy suites have 14 passing tests.
- Server typecheck and client production build pass.
- Unleashd is clean at commit `32bc0a0`.
- The standalone Buddies source tree is untracked; the Unleashd release uses a
  vendored npm snapshot.
- The process on port 7489 predates the latest build. Its missing
  `/api/buddies/overview` response is a stale-process symptom, not the current
  source route order.
- Codex Buddy conversations receive a conversation-scoped stdio MCP server.
- MCP launch arguments bind the trusted Buddy, workspace, and optional project.
- The MCP surface was exercised both in memory and through a spawned stdio
  process reopening file-backed state.
- Terminal Buddy conversations now enter `BuddyClosureService`.
- Review completion requires exactly one explicitly delimited raw-JSON result
  block with schema-valid evidence.
- A synthetic assembled closure fixture now survives restart with completed
  work/todos, memory, delegation, review, audits, organization, and recent
  conversation links.

## The remaining architectural break

There are strong components on both sides of two disconnected seams.

```text
Provider conversation
    |
    +-- hidden Buddy briefing
    |
    +-- shell/CLI instructions -------------------- current path
    |
    +-- BuddyOperationsService -------------------- defined, not registered
            |
            +-- trusted buddy/workspace/project scope
            +-- validation
            +-- evidence requirement
            +-- audit event

Conversation terminal event
    |
    +-- legacy delegation-only settlement -------- current path
    |
    +-- BuddyClosureService ----------------------- defined, not wired
            |
            +-- delegation settlement
            +-- structured review settlement
            +-- evidence validation
            +-- idempotency
```

The lower path is now authoritative for Codex Buddy conversations. Non-Codex
providers still use the CLI compatibility fallback and remain a deliberate
follow-up rather than an implied completed capability.

## Invariants

### Scope

1. Buddy identity comes from trusted `buddyContext`.
2. Workspace comes from trusted `buddyContext`.
3. A project must belong to both that Buddy and workspace.
4. A model payload cannot select a different Buddy or workspace.
5. A review may inspect another Buddy, but the reviewer and workspace are
   trusted context.

### Closure

1. Completing a project requires non-empty evidence.
2. Completing a review requires a verdict, summary, and structured evidence.
3. A failed/cancelled review conversation cancels the draft review.
4. Delegation/review settlement is idempotent.
5. Arbitrary prose containing JSON does not silently count as a structured
   review result.
6. Ordinary human Buddy conversations remain open/active between turns.

### Interaction

1. The primary owner action is **Start conversation**.
2. The employee view is a read model, not a database administration console.
3. Buddy conversations use normal Chat and a Buddy header.
4. No Buddy path uses `swarmDebugPrefix`, Swarm Debug, or worker semantics.

### Release

1. The package installed by Unleashd is generated from a known Buddies source
   state.
2. A production smoke test starts the built server rather than testing only
   source modules.
3. The running process must expose the same routes as the built artifact.
4. Documentation must distinguish implemented components from wired and
   end-to-end-proven behavior.

## Execution graph

### A. Terminal closure

- Parse a deliberately delimited structured review result.
- Invoke `BuddyClosureService` for every terminal Buddy conversation.
- Preserve delegation outcomes.
- Cancel draft reviews on failed/cancelled conversations.
- Leave draft reviews unsettled when a successful response lacks valid
  structured evidence, and log an actionable error.
- Test success, malformed output, failure, cancellation, idempotency, and an
  ordinary non-review conversation.

### B. Authoritative mutation path

- Introduce route-level operation execution that constructs
  `BuddyOperationsService` from server-resolved scope.
- Use it for project and memory mutations where the HTTP request already
  identifies a Buddy and workspace.
- Do not silently weaken legacy administrative endpoints. Mark genuinely
  administrative endpoints as such or add an explicit context-bearing
  operation endpoint.
- Ensure the service, rather than route-specific ad hoc logic, records audit
  events.
- Add route tests for cross-scope rejection and evidence enforcement.

### C. Conversation tool bridge

- Define one provider-independent Buddy tool-dispatch interface.
- Bind it to a conversation's `buddyContext`.
- Prefer the existing agent runtime's native dynamic-tool mechanism if it has
  one.
- If the harness cannot accept runtime tools, expose an MCP/sidecar adapter
  whose operations still enter through `BuddyOperationsService`.
- Keep provider-specific argument syntax outside the Buddies domain library.
- Prove that a shim provider invokes an operation without constructing a shell
  command.

### D. End-to-end closure fixture

- Create a temporary Buddies database and workspace.
- Create Lead, Critic, and Operator.
- Create one canonical project and todo.
- Start an empty Lead conversation.
- Verify the visible prompt remains clean.
- Verify the provider receives soul, memory, sprint, and project briefing.
- Execute a scoped project update with evidence.
- Create a Critic review conversation.
- Return a structured review result.
- Settle the review and delegation exactly once.
- Write and compact memory.
- Reopen the database.
- Verify project, todo, audit, review, delegation, memory, conversation link,
  organization projection, and recent run.

### E. UI and packaged runtime

- Build all packages.
- Start the built server on a clean test port.
- Poll a health/read endpoint until ready.
- Assert `/api/buddies/overview` is available.
- Open `/buddies` in a browser.
- Verify one top-level Growth Lead card and a two-person team count.
- Open the employee.
- Verify current sprint, current tasks, blockers, next action, and last run.
- Verify no New project form.
- Start an empty conversation without sending a provider prompt.
- Verify Buddy header and absence of Swarm Debug.
- Verify the Recent Projects Buddies folder.

### F. Operational confidence

- Measure default-heap startup with the current conversation corpus.
- Record time to API-ready and Buddy-directory-ready.
- Add a representative high-session fixture if the real corpus cannot be used
  in CI.
- Give automation runs explicit operation, time, iteration, and token/cost
  policies.
- Add stuck-run detection and recovery evidence.

## Completion gate

Do not call the program complete until:

- the provider-facing operation path is mechanically scoped;
- terminal review/delegation closure is wired;
- one assembled closure test passes;
- one real safe GTM task closes with evidence;
- restart preserves all durable state;
- browser QA passes against the built server;
- the live process is refreshed;
- the standalone source is committed or otherwise has immutable provenance;
- default-heap startup has a measured budget;
- current documentation contains no known contradictory implementation claims.
