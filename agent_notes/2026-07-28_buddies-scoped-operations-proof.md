# Buddies Scoped Operations Proof

**Date:** 2026-07-28

**Status:** Completed evidence record. Current completion status and open gates
are maintained in
`agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md`.

## Why this slice exists

Before this change, the Buddy briefing said that `new_project`,
`update_project`, and `remember` were public operations, but the model still had
to construct shell commands. The conversation context did not mechanically
bind the Buddy or workspace.

## Implemented surface

`server/src/buddies/operations.ts` now defines Zod contracts and a
`BuddyOperationsService` for:

- `buddy.get_current_work`;
- `buddy.new_project`;
- `buddy.update_project`;
- `buddy.remember`;
- `buddy.delegate`;
- `buddy.complete_delegation`;
- `buddy.submit_review`;
- `buddy.request_human_approval`.

The service receives Buddy ID, workspace ID, and optional project ID from
trusted conversation context. Those identifiers are not accepted from model
operation input.

## Enforced invariants

- The Buddy must be assigned to the conversation workspace.
- A mutable project must belong to both the scoped Buddy and workspace.
- A project-scoped conversation supplies the default project ID.
- Completing a project requires at least one evidence reference.
- Store validation continues to require explicit blockers for blocked project
  and todo state.
- Delegation settlement must belong to the scoped originating Buddy/workspace.
- Review submission must belong to the scoped reviewer/workspace.
- Reviews require non-empty structured evidence.
- Human approval requests record pending intent and do not execute the risky
  action.
- Every successful operation appends a structured schema-v7 audit event.

Audit events may reference another employee's project for legitimate review
work, but the project must remain inside the conversation workspace.

## CLI parity

The Buddies CLI now supports:

- delegation create/update/list;
- review create/submit/list;
- project source-path updates;
- work-migration audit.

## Focused proof

The provider-shim-style operations test uses the real Buddies store and proves:

1. project creation;
2. completion rejection without evidence;
3. evidence-backed completion with todo closure;
4. curated memory write;
5. delegation creation and settlement;
6. structured review submission against a direct report's project;
7. rejection of cross-employee mutation;
8. six durable audit events for six successful operations.

Current evidence:

- Buddies schema: 7.
- Buddies tests: 19/19 passing.
- Buddy focused server tests: 2/2 passing.
- Real database migration audit: 15 migrated, 0 unmigrated.

## Deliberately deferred

The operation schemas/service are not yet registered with the provider runtime.
That is the one integration step that overlaps the active conversation/runtime
refactor. The module is independently typed and tested so registration can be
small once that refactor settles.

The full server typecheck is presently blocked by the concurrent refactor's
unrelated `server/src/lifecycle/system-ports.ts` implicit-`this` error. The
focused Buddy tests pass.
