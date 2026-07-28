# Buddies Hardening and Release Proof

**Date:** 2026-07-28

## Scheduler hardening

The scheduler no longer trusts a text sentinel embedded anywhere in model
output. Bounded loops require a JSON result:

```json
{"buddyAutomation":{"done":true,"outcome":"brief result"}}
```

Malformed output and the legacy sentinel are not completion.

The scheduler now exposes:

- health (`running`, poll interval, active run IDs);
- explicit run cancellation;
- active conversation stop/finish on cancellation;
- cancellation-state protection against a late provider result;
- real SQLite restart recovery;
- structured loop completion;
- existing time and iteration ceilings.

The store test opens two independent SQLite connections and proves they resolve
one idempotent occurrence to one run row.

## Current-work UX

The employee work tab now begins with:

- current sprint;
- one primary next action;
- last recorded run time;
- open task count.

Canonical project cards show next actions, blockers, stale warnings, todos, and
a project-scoped Start conversation action. Closed projects are omitted from
the current-task list. Imported legacy rows remain collapsed provenance.

## Hermetic distribution

The prior manual symlink has been removed. Distribution is now:

1. standalone `/git/buddies` remains the editable library source;
2. `vendor/nbardy-buddies-0.1.0.tgz` is the versioned runtime snapshot;
3. root and server manifests declare that snapshot;
4. the root release bundles `@nbardy/buddies`;
5. the lockfile resolves the local archive;
6. package smoke requires a real `200 /api/buddies` response.

`npm pack --dry-run` confirms all three bundled runtime packages:

- `@nbardy/agent-cli`;
- `@nbardy/buddies`;
- `@unleashd/shared`.

The clean install/plain-Node package smoke passes.

## Recovery

`buddies backup <destination.sqlite>` creates a consistent `VACUUM INTO`
snapshot, refuses overwrite, records schema version, and is covered by a
reopen test.

The initializer no longer hard-codes a user home. It accepts
`MAGIC_GENIE_ROOT` and `EVENTMAP_ROOT` or discovers sibling checkouts.

## Current evidence

- Buddies library: 23 tests passing at the time of hardening.
- Buddy scheduler focused suite: structured completion, cancellation, health,
  multi-connection claim behavior, and real-SQLite restart recovery passing.
- Unleashd server suite: 102 passing, 1 intentional live skip before the latest
  scheduler additions.
- Client production build passing.
- Server typecheck passing.
- Clean package install/start/API smoke passing.

## Still not claimed

- Provider-native tool registration is not wired yet.
- Review settlement is implemented and tested but still needs the terminal
  runtime hook plus structured-result extraction.
- Automation operation allowlists and explicit per-run token budgets are not
  implemented.
- Default-heap 500-session startup has not been benchmarked.
- A real GTM closure scenario has not yet been run.
