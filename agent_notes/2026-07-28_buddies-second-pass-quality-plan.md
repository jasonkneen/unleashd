# Buddies Second-Pass Quality Plan

**Date:** 2026-07-28
**Repositories:** `unleashd`, sibling `buddies`
**Purpose:** Convert the retrospective into a smaller set of proof-driven
implementation gates.

**Status:** Historical quality plan, implemented and superseded by the canonical
completion audit:
`agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md`.

## Why another pass is necessary

The first implementation pass established most of the architecture:

- a durable employee domain outside the provider harness;
- scoped work, memory, conversations, automations, delegation, and reviews;
- a conversation-first UI;
- native Codex operations bound outside model-controlled input;
- evidence-backed completion and restart persistence.

That is meaningful infrastructure, but it is not the user outcome. The user
wants a Growth Lead that exposes the state of every GTM campaign, chooses and
closes bounded work, and follows through without repeated status prompts.

The remaining risk is therefore not lack of features. It is the gap between
implemented mechanisms and a repeatable, observable work-closure loop.

## Retrospective corrections

### 1. Preserve visibility while removing administration

Removing the large `New project` form was correct. Removing status, next
action, blocker, definition of done, and todo progress from current-work rows
was not.

The employee page must remain read-only and conversation-first, but it must
answer these questions without another prompt:

1. What is the project?
2. What state is it in?
3. What happens next?
4. What is blocking it?
5. How much of its bounded work is complete?

The only mutation affordance remains **Start conversation** / **Open**.

### 2. Treat hidden-context behavior as a contract

Manual inspection proved that the real Codex session received the Buddy
briefing and that the visible transcript showed only the user's prompt. That
proof must become an automated contract:

- creating an empty Buddy thread starts no provider;
- the first real user turn receives the briefing exactly once;
- resumed turns do not receive it again;
- persisted/hydrated visible text strips the briefing;
- Buddy conversations never render or inherit Swarm debug semantics.

### 3. Approval must be authority, not a note

`request_human_approval` currently records pending intent. It does not create
an enforceable lifecycle that can be approved or rejected, nor does it bind a
subsequent risky operation to an approved request.

The minimum durable lifecycle is:

```text
pending -> approved
pending -> rejected
pending -> cancelled
```

Every transition requires actor, timestamp, reason, and an append-only audit
record. An approval is scoped to one Buddy, workspace, requested action, and
request payload. Approval does not execute the action; it only grants bounded
authority that an integration can consume.

### 4. Automation needs explicit resource and operation policy

The existing scheduler supports bounded loop iterations structurally, but a
production automation definition also needs:

- maximum runtime;
- maximum loop iterations;
- optional token budget;
- optional cost budget;
- allowed Buddy operations;
- explicit approval policy for open-world actions.

Omitted policy must resolve to conservative defaults, not unlimited behavior.
Runtime enforcement belongs in Unleashd; durable definition and validation
belong in the Buddies library.

### 5. Release truth must be reproducible

The vendored `@nbardy/buddies` archive makes installed Unleashd hermetic, but
the sibling source repository is entirely untracked and the newest Unleashd
closure work is uncommitted. A binary archive without immutable source
provenance is a recovery risk.

Before release:

- all source must be tracked;
- the archive must be reproducibly generated from the inspected source;
- its SHA-256 and source commit must be recorded;
- package smoke must prove the installed artifact contains the same schema and
  operations;
- no documentation may describe an older schema as current.

No commit or push is performed without owner direction. Until then this remains
an explicit release gap.

## Execution order

### Gate A — Observable current work

- Restore compact status text.
- Restore next action.
- Restore blocker when present.
- Show completed/total todo count.
- Keep detail optional and visually subordinate.
- Do not restore direct project/todo mutations.
- Add focused client contract tests.

### Gate B — Conversation contract

- Exercise `BuddyConversationCreationService`.
- Assert no provider turn for empty creation.
- Exercise first-turn prompt construction.
- Assert one briefing injection.
- Exercise a resumed turn.
- Assert no second briefing.
- Exercise disk/hydration sanitization.
- Assert no visible hidden briefing.

### Gate C — Durable authority

- Add persisted approval requests.
- Add terminal approval transitions.
- Add append-only transition audit.
- Add automation resource policy.
- Add operation allowlist.
- Migrate existing databases safely.
- Add store, CLI, and type coverage.

### Gate D — Runtime enforcement

- Thread automation policy into scheduler execution.
- Reject disallowed Buddy operations in automation context.
- Stop runs that exceed time or iteration limits.
- Record a structured terminal reason.
- Expose policy and approval state through routes/UI only where it improves
  operational understanding.

### Gate E — Reproducible package

- Run the standalone library suite.
- Build a fresh archive from the inspected tree.
- Replace the vendored archive.
- Update the lockfile.
- Run package smoke against a temporary installed package.
- Record source/archive correspondence.

### Gate F — Real closure

Select one safe repository-local GTM task. It must:

- belong to an existing canonical Growth Lead project;
- require no external send, spend, deploy, or publication;
- create inspectable repository evidence;
- be reviewed by the Critic;
- be repaired by the Operator if the review requires it;
- leave the project done, blocked, review, or with one precise next action;
- write compact memory with references;
- survive restart;
- render correctly in the directory, employee view, conversation, and Recent
  Projects Buddies folder.

## Confidence ledger

| Claim | Current evidence | Status |
|---|---|---|
| Durable scoped work exists | SQLite tests and lifecycle fixture | Proven |
| Codex receives scoped native tools | in-memory, stdio, and real provider call | Proven |
| Completion requires evidence | operation tests and MCP integration | Proven |
| Review/delegation settle | structured closure tests | Proven synthetically |
| Empty thread has no automatic turn | manual browser observation | Needs automated proof |
| Briefing is hidden and injected once | raw real session plus unit fragments | Needs assembled proof |
| UI exposes useful campaign state | current source contradicts requirement | Not achieved |
| Approval gates risky work | pending record only | Not achieved |
| Automations have resource policy | partial loop bounds only | Not achieved |
| Default-heap startup is operationally bounded | measured ~31.6 s and ~1.46 GB RSS | Not achieved |
| A real GTM task closes autonomously | no real closure artifact | Not achieved |
| Release is reproducible | archive exists; source is untracked | Not achieved |

## Completion rule

Do not add another employee role or automation job type until the real closure
gate passes. Do not call Buddies complete because schemas, routes, tabs, or
tests exist. Completion requires a real closed work artifact, durable evidence,
restart proof, reproducible source, and an interface that makes the resulting
state obvious.
