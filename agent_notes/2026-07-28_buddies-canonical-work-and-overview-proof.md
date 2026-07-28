# Buddies Canonical Work and Overview Proof

**Date:** 2026-07-28

**Status:** Completed evidence record. Current completion status and open gates
are maintained in
`agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md`.

This records the first implementation slice after the retrospective. It exists
so future work does not have to infer whether the work migration and overview
projection were merely planned or actually exercised.

## Source and concurrency snapshot

- Unleashd source commit at the start of the slice:
  `e0985855fda9e74886955b2ba2683bdf2c627d18`.
- The concurrent refactor owns `server/src/server.ts` plus the new conversation,
  lifecycle, merge, palette, swarm, and transport modules.
- This slice did not edit `server.ts`.
- The Buddies package is still reached through:
  `server/node_modules/@nbardy/buddies -> ../../../../buddies`.
- That symlink is operational locally but is not a reproducible dependency.
  Packaging remains a separate required phase.

## Canonical work decision

`owned_projects` plus `buddy_todos` is the mutable source of truth.
`work_items` remains import provenance until it can be retired safely.

The Growth Lead initializer now:

1. upserts the provenance row;
2. upserts a canonical project by `(workspace_id, external_key)`;
3. preserves owner, sprint, status, priority, objective, definition of done,
   source path, next action, and blocker;
4. creates one actionable todo when a next action exists;
5. preserves blocked/in-progress todo state on first import;
6. adds only missing todo titles on later imports.

The library rejects an external-key collision if the existing project belongs
to a different Buddy.

## Real database evidence

Database: `/Users/nicholasbardy/.buddies/buddies.sqlite`

The initializer was run twice consecutively. The resulting audit was:

```json
{
  "openLegacy": 15,
  "migrated": 15,
  "unmigrated": 0,
  "unmigratedItems": []
}
```

Canonical portfolio:

- 15 owned projects;
- 15 distinct external keys;
- 15 initial todos;
- Magic Genie: 9;
- EventMap: 6;
- ready: 3;
- in progress: 2;
- blocked: 8;
- review: 2.

The second initializer run left the owned-project count at exactly fifteen.

## Overview decision

`BuddiesStore.overview()` owns organization normalization and compact UI
projection. Reciprocal historical relationship rows are converted into one
deduplicated `(manager, report)` pair.

The projection returns:

- every employee;
- top-level employees;
- direct team members;
- assigned workspaces;
- canonical open/active/blocked/review/missing-next-action counts;
- durable recent conversation links.

The real database projection currently reports:

```json
{
  "topLevel": [
    {
      "name": "Growth Lead",
      "team": 2,
      "work": {
        "open": 15,
        "active": 2,
        "blocked": 8,
        "review": 2,
        "nextActionMissing": 0
      }
    }
  ],
  "employees": 3,
  "recentRuns": 5
}
```

Both the Buddy directory and the virtual Buddies sidebar folder now request
`/api/buddies/overview` once. Neither reconstructs the reporting graph through
per-employee detail requests.

## Verification

- Buddies: 18/18 tests pass.
- Buddies syntax checks pass.
- Overview route test passes.
- Client TypeScript build passes.
- Client production build passes.
- `git diff --check` passes for both repositories.

## Remaining limitations

- Employee detail still issues parallel endpoint requests. That is acceptable
  for a single selected employee but can later become one detail projection.
- Sorting/filtering is still local React projection rather than a derived atom.
- Obsolete Buddy tree CSS has not yet been audited and removed.
- Fresh-clone installation is still broken until dependency packaging is fixed.
- This slice proves storage and projection, not autonomous closure.
