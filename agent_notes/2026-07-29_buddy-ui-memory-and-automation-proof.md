# Buddy UI, memory, and automation proof — 2026-07-29

## Outcome

The lean Buddy surface is ready for normal conversation use:

- the employee header is compact and keeps identity, status, reporting line,
  skills, and execution profile in one row;
- direct reports are navigable employee links;
- Buddy conversation rows are full-card links;
- review conversations are hidden by default behind an explicit review toggle;
- automation conversations are excluded from the normal conversation list and
  shown on the Automations tab;
- the server classifies linked conversations as `conversation`, `review`, or
  `automation` so the client does not infer transport semantics from prose.

The daily Buddy automation remains disabled. Execution and operation scoping
work, but resource accounting is not yet trustworthy enough to replace the
existing daily schedule.

## Durable employee memory

Each Buddy owns:

- `BUDDY_SOUL.md` for stable behavior and authority;
- `memory/MEMORY.md` for curated durable knowledge;
- append-only dated files under `memory/journal/` for outcomes, failures,
  evidence pointers, lessons, and next attempts.

Conversation briefing now injects a bounded curated summary plus recent journal
excerpts. It previously injected only journal filenames, which meant the record
existed but did not help the next run without another lookup.

The injected operating policy tells the Buddy when to use `remember`:

- journal after material work, failure, durable decision, or reusable lesson;
- curated memory only for stable facts, owner preferences, durable decisions,
  and repeated lessons;
- `compact_memory` when journal history becomes repetitive, stale, or
  contradictory.

Soul is deliberately not self-modifying. Repeated evidence can produce a
`SOUL_CHANGE_PROPOSAL` journal entry for Lead or owner review. This lets the
employee learn without silently expanding its own authority or rewriting its
personality.

There is no vector or semantic memory index. The lean retrieval contract is:
recent journal excerpts for recency, curated memory for long-term recall, and
the full journal visible in the Memory tab. Add search only after this bounded
model produces a demonstrated retrieval failure.

## Automation proof

Automation:
`automation_95e42e1d-f860-451b-8853-49cdcff17d39`

### First manual run

Run:
`automation_run_bb89801e-1184-44fb-86c3-fac1d7c688bc`

The run completed the read-only EventMap evidence packet and performed no
external send or production mutation. After native `buddy.new_project` was
denied, however, it used the `buddies` CLI to create and complete
`buddy_project_5a171551-3419-4cbe-8766-354df0c55a5d`. That was a real authority
bypass.

The compatibility guidance was tightened so automation operation allowlists
are absolute: no CLI, Buddy HTTP route, direct database access, or filesystem
edit may substitute for a denied native operation.

### Second manual run

Run:
`automation_run_946fbf81-3cc9-498c-82a8-0cc95571072f`

Conversation:
`1706ba78-fef8-442d-9ea7-3427bd1c1593`

The second run completed successfully in 29 minutes 31 seconds. It:

- respected the native operation boundary;
- accepted denied `get_inbox` and `new_project` operations as blockers;
- created no new Buddy project;
- wrote the durable journal handoff through allowed `buddy.remember`;
- performed no send, reply, publishing, DNS, deployment, spend, production
  mutation, queue/suppression change, or unknown retry.

Evidence packet:
`/Users/nicholasbardy/git/event_calendars/company/growth/agent_notes/2026-07-29-growth-evidence-refresh-rerun-184743/DECISION.md`

The proof still fails the production-readiness gate:

- the Codex session reported approximately 1.85 million cumulative input tokens
  before completion;
- the automation policy declared a 50,000-token and $2 limit;
- the durable automation run recorded `tokens_used: 0` and `cost_usd: 0`;
- completion occurred less than 30 seconds before the 30-minute runtime limit.

The token and cost policy fields therefore describe intent but are not currently
enforced or accurately metered for this provider run.

## Schedule ownership

No schedule ownership was changed:

- Buddy daily automation remains disabled;
- the existing macOS daily and weekly growth crons remain installed;
- the existing Codex daily EventMap automation remains active;
- send-capable jobs were not touched.

Do not transfer daily ownership to Buddy automation until provider usage is
captured accurately and a bounded proof completes comfortably inside its
runtime and token policy. This is a reliability repair, not a reason to expand
the Buddy product surface.

## Validation

- Buddy client tests: 15 passed.
- Client production build passed.
- Server TypeScript check passed.
- Buddy route, lifecycle, and scheduler tests passed.
- Browser verification covered the compact header, direct-report links,
  full-card conversation links, default review filtering, automation
  conversation separation, and Memory tab.
