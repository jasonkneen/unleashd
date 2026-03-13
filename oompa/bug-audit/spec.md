# Bug Audit Swarm Spec

## Goal

Audit the `unleashd` codebase for real bugs, correctness risks, behavioral regressions, missing invariants, race conditions, and integration gaps. Produce high-quality `.json` tasks for every issue found. Do not implement the fixes in this swarm.

## Deliverable

The swarm's output is a reviewed task queue in `tasks/pending/` with concrete bug tickets that engineers can claim later.

Each bug ticket should:
- describe one bug or one tightly related bug cluster
- identify likely impacted files and the user-visible or runtime consequence
- include acceptance criteria that would prove the bug is fixed
- stay small enough for a single follow-up worker

## Coverage Expectations

The full repo should be covered, with explicit audit slices for at least:
- `client/` React UI, hook ordering, state subscriptions, streaming UI, list rendering, unread or selection behavior
- `client/src/atoms/` and UI stores, especially structural vs high-frequency updates
- `server/` provider spawning, queueing, persistence merge rules, conversation lifecycle, swarm integration, API contracts
- `shared/` schemas and cross-boundary type drift
- `vendor/agent-cli-tool/` harness integration, command construction, event normalization, resume or streaming behavior
- tests and gaps where behavior is complex but unguarded
- path normalization, recovery, disk loading, and active-session reconciliation

## Priority Rules

Bias toward bugs that are:
1. correctness or data-loss issues
2. race conditions or lifecycle mismatches
3. contract drift between client, server, shared, and provider layers
4. state-management bugs that could cause stale or excessive renders
5. missing regression coverage around fragile code paths

Do not create tickets for:
- pure style preferences
- broad refactors without a concrete bug
- speculative concerns without code evidence

## Required Context

Read these before creating audit tasks or bug tickets:
- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `docs/agent_client_spec.md`

Use repo docs to sharpen your bug hypotheses, but ground every task in the current code.

## Audit Workflow

1. Planner creates subsystem audit tasks that together cover the repo.
2. Auditors claim one audit task at a time.
3. Auditors inspect code and create follow-up bug tickets in `tasks/pending/`.
4. Auditors complete only after they have either created concrete tickets or recorded that the slice produced no credible issues.

## Ticket Naming

Use stable IDs with a `bug-audit-` prefix for audit coverage tasks and `bug-` or `regression-` prefixes for discovered issues.
