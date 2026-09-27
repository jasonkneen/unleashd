# Type, signature and data-model review — 2026-09-27

Audit of `main` at 03fc931 (after the lean rewrite and the live T15 swap), run with the `deslop` method: five
read-only agents, one per layer, each checked against the owner's "One Clean Path" rules (sum types own
branching, no accidental optionality, no silent fallbacks, thin dispatchers, exhaustiveness) and the design
brief "a few simple things that have ids and can be created and addressed". No code was changed by the audit.
Since the audit, the one-time import tools were deleted in d445d4a (−4.4k lines), which closes D-1 and the
record-migration item in B-4.

| Report | Area | Lines |
|---|---|---|
| [A-shared-wire.md](A-shared-wire.md) | `shared/` schemas, protocol v3, how server and client consume them | 203 |
| [B-server-core.md](B-server-core.md) | conversations, turns, transport, http, ingest, providers | 203 |
| [C-buddies-model.md](C-buddies-model.md) | Buddies crate (13 tables, 44 napi exports), MCP tools, owner routes | 232 |
| [D-ingest-agentcli.md](D-ingest-agentcli.md) | Rust ingest + records store, agent-cli request/event types | 150 |
| [E-client.md](E-client.md) | atoms, views, Buddy/channel components, mobile, props | 316 |

Every finding in the layer reports carries a `file:line`, a severity and a line delta. This document ranks and
groups them. It does not repeat the evidence.

## 1. Verdict

The domain model holds. The Buddies database really is a handful of addressed things (workspace, buddy, task,
channel, post, doc, run, schedule, event), with one write path, one `authorize` and idempotency keys. The client
store is one index plus per-id families, has exhaustive switches and no `default:` anywhere, and has a single
device dispatch in `App.tsx`. The runner consumes the unified event union exhaustively, and every switch over a
shared union is exhaustive.

What is left is at the **edges between layers**, not in the core. Across the audit it falls into six recurring
defects:

1. The same shape written in two or three languages with casts between them.
2. Optional fields standing in for a state machine.
3. Silent defaults where the canonical value was never resolved.
4. A few writes and reads that skip the core's own authorization or idempotency.
5. A couple of interfaces too wide for their callers.
6. Code whose producer was deleted.

None of these is a new subsystem, and each fix deletes code.

## 2. Bugs, verified by the orchestrator against code or live data

| # | Bug | Evidence | Fix | Size |
|---|---|---|---|---|
| V1 | **Task-channel posts missing from the Task filter.** A post takes `task_id` from the caller, not the channel. | Live `buddies-v3.sqlite`: 4 posts in task channels have `task_id IS NULL` (C 1.1) | Derive `task_id` from the channel in `insert_post`; backfill the 4 rows | +8 |
| V2 | **One failed command fails every pending send.** Six commands (stop, delete, done, three queue ops) carry no command id, so their failure arrives as a generic `error` frame, and `handleError` calls `rejectSends` for ALL pending sends. | `client/src/atoms/actions.ts:541-546` (A S1) | `commandId` on every command (`.default` for skew); delete the generic `error` frame | −20 |
| V3 | **A missing completion reason renders as success.** | `actions.ts:551` `data.reason ?? 'success'`; `reason` optional on the wire (A O1) | Make `reason` required on the wire | 1 line |
| V4 | **Forking an unloaded Buddy conversation silently creates a plain chat.** | `transport/conversation-websocket.ts:419` `getConversation(from)?.kind ?? CHAT_KIND` (B 2.5) | Load the source record, or reject the fork | +5 |
| V5 | **Swarm analytics never attaches reviews.** The client groups by `review.iteration`; the server's review log is keyed by `cycle`. | `swarm/swarmAnalyticsParsers.ts:113` vs `server/src/swarm/read-model-routes.ts:244` (A D1). Field names confirmed in code; not checked against a live review file | Use the generated `OompaReviewLog` type and key on `cycle` | −50 |

## 3. Bug risks reported by the layer audits (not independently re-verified)

**Silent loss of authority or data**
- An initial message with no recorded sender defaults to `origin:'unknown'` and loses owner authority, including the retry after a restart (B 2.3).
- A missing working directory falls back to the server's own directory (`runtime.ts:323`, B 4.1).
- A failed session-binding write is only logged, so the conversation can't resume after a restart (B 4.3).
- A failed Buddy briefing rebuild produces a runtime with no briefing (B 4.4).
- The initial message is deduplicated by text equality, so retyping the same first message drops it (B 2.4).
- POST `/api/settings` merges an unvalidated body and answers 200 even when the disk write fails (B 4.12).
- The zustand settings store can POST solarized over a saved custom palette after a bad fetch (E 1.5).
- `schedule.limits` is always written as `'{}'`, which wipes imported limits whenever a schedule is edited (C 2.x).

**Idempotency and authorization in the Buddies core**
- **Duplicate runs:** `enqueue_run` and `cancel_run` take no key and write no event, so a double-clicked "run now" queues two runs (C 3.3).
- **No check:** `append_event` has no authorization check (C 3.3).
- **Reads without an actor:** task, run, schedule and buddy reads take none, so a Buddy can read another workspace's runs, schedules and tasks (C 3.5).
- **Duplicated checks:** TS re-derives eligibility in `channels.eligible` and `memory-review` instead of asking the crate (C 6.1).
- **Re-archive does nothing:** re-archiving a Buddy after a restore is a silent no-op, because `DELETE /api/buddies/:id` reuses the fixed key `archive:<id>` (C 3.4).

**Client / server disagreements**
- **Provider lock:** `Chat.tsx:205` derives the lock differently from the server. The mobile config overlay applies neither the lock nor the Buddy-MCP provider filter, so a Buddy thread can pick a provider without its required MCP (E 1.6).
- **Provider defaults:** the Buddy provider default `?? 'codex'` is built three times, once cast `as 'codex'` (`useBuddyData.ts:64`). The default provider (`providers[0] ?? 'claude'`) is chosen in the UI, against the server-side-defaults rule (E 5.1, 5.2).
- **Retry detection:** whether a failed Buddy reply can be retried is decided by a regex over the post text, on both sides (A).

**Event stream**
- **Task matching:** `tool.use` has no call id, so a Claude background task is matched to its launch by description text. Two identical launch descriptions in one turn get mixed up (D 1.2).
- **Dropped failures:** failed tool results are dropped silently (`runner.ts:864-865`, D 1.4).
- **Unknown models:** an unknown or missing model silently becomes Claude in the ingest parser (`parsers/mod.rs:328`, D 4.x).
- **Session precedence:** session intent is three optional ids with an implicit fork > resume > id order. No id at all silently starts a fresh session (`build.ts:52-53`, D 1.8).

## 4. Cross-cutting themes

### T1. One fact, several type sources
The worst cases join two definitions with `as unknown as` casts, so nothing checks that they agree.

| Fact | Where it is written | Report |
|---|---|---|
| Conversation record | Zod (shared), Rust struct, generated `index.d.ts`, joined by `as unknown as` | B 1, D 2.4 |
| Provider enum | 4 places | D 2.3 |
| Sub-agent tool names / descriptions | agent-cli, `subagents.rs`, `subagent-tools.ts` | D 2.2 |
| Tool-line formatting | `turns/tool-format.ts` (live) and `text.rs` (reload), so live and reloaded transcripts can drift | D 2.1 |
| Codex sub-agent status mapping | agent-cli `parsers/codex.ts:29` and `server/src/subagent-tools.ts:134` (the server ignores the canonical `subagent.state` event) | D 1.1 |
| Completion reason list / message role list | 3 / 4 places | A |
| Streaming frames | `shared` and a hand copy on the server | A |
| HTTP responses (turn attempts, channels, context meter, diagnostics) | hand-typed in the client; `usePolledFetch` returns `as T` unparsed; about 30 of 45 polled fetches are unparsed | A D4, E 2.1 |
| Model validity | static per-provider schemas in `index.ts` AND the provider catalog, with a hard-coded Codex default in `catalog-service.ts:31` | A D6 |
| Row label rule, record-summary projection | TS and Rust | B |

**Direction:** one type source per boundary. Rust types are the source for addon data (generated `index.d.ts`,
no casts). `shared/` Zod is the source for wire and HTTP payloads, and resources are parsed with their schema.
The provider catalog is the only model authority. The tool-line formatter is exported from the addon and the TS
copy deleted.

### T2. Optional fields standing in for state machines

| Field set | Should be |
|---|---|
| `creation`: 9 optional fields mixing identity, lineage and delivery | identity + lineage + `delivery: none \| pending \| claimed \| dispatched` |
| `BuddyContext`: 7 nullable/optional fields | an `origin` sum |
| Conversation run state: 5 fields on `Conversation` + about 12 nullable per-turn fields on `TurnRunner` | `phase: idle \| running(ActiveTurn)`; this also removes the fabricated attempt id at `runner.ts:324` |
| `status` + `deletedAt`, stored twice in record and row | one lifecycle sum |
| Run `Outcome` spread over 4 columns (37 `complete` runs carry an error code; a cancel records itself twice) | one outcome column with CHECKs |
| Session intent: 3 optional ids | `fresh \| resume(id) \| fork(id)` |
| `tool_name` / `tool_input` nullable pair (ingest), `tool.result` success-or-failure | text-or-tool sum; result outcome sum |
| `message_complete.reason?` | required |
| `row.parent`: a conversation id OR a raw session id | a typed parent |

### T3. Silent fallbacks
These are listed in §2–3: V3, V4, `origin:'unknown'`, cwd → the server directory, model → Claude, UI-side
provider defaults, the settings store's palette fallback, `schedule.limits = '{}'`, and fresh-session-on-no-id.
Every one maps "not decided" to a plausible value. The fix is always the same: resolve the value at the
boundary or reject, and never default in the core or in a view.

### T4. Core authority not used everywhere
The Buddies core has the right primitives: `write`, `require`, `idempotent`. But `enqueue_run`, `cancel_run`,
`append_event` and `open_channel` bypass part of them, and reads have no actor at all. TS then re-derives
eligibility, which is the "validate everywhere" smell the core was built to remove.

### T5. Interfaces wider than their callers
- **`TurnPolicy`:** 26 members, so Buddy-only operations sit on `ChatTurnPolicy` as throws or no-ops, and `runtime.ts:426` checks the kind again before delegating (B 3.1).
- **Channel writes:** separate verbs for create, archive (`set_archived(bool)`) and the pending rename. One `update_channel(changes)` would cover archive and rename (C 3.2).
- **Event ops:** stringly named in mixed styles (`"channel.rename"`); should be one `EventOp` enum (C 2.1).
- **Page reads:** three post-page verbs (C 4.1).
- **Props:** `VirtualizedMessageList` takes 13 props, including a positional boolean pair whose first value its only caller ignores. `ConversationConfigPicker` has three booleans where the T20 rule wants named variants, and one of them, `showProvider`, is never passed (E 3).

### T6. Code whose producer is gone

| Code | Size | Report |
|---|---|---|
| Team-configuration + Builder/worker tool-result parsers and formatters (their server producers were removed in 0fef9d4) | about −280 | A 8 |
| Codex "thinking" symbol group | part of the above | A |
| Doc-scope machinery after memory unification (all 172 live docs are buddy-scoped, zero `shared`) | about −90 | C 5 |
| `rekey`, `appendBranchLaunch` napi methods (no TS caller) | about −150 | D 5.1 |
| `canChangeProvider`, `/api/models`, `/api/audit` + `providers/index.ts`, `Conversation.sendMessage`, forwarding observer | about −125 | B 6 |
| `authorize` and `listEvents` napi exports (tests only), `buddy.soul_path` (no reader) | small | C 3.1 |
| The importer, `record-migration.ts`, `Defaulted`, raw connection | **done in d445d4a** | D 6, B 6 |

## 5. Data model

**Buddies (13 tables).** Every table is still a distinct thing, so no merges are proposed. The corrections are:
- **Facts stored twice:** `post.task_id` vs the channel's task, and run outcome across columns.
- **Dead columns:** `soul_path`, `schedule.limits`.
- **Scope leftovers:** doc scope columns that the unified memory model no longer uses (C §1, §5).

**Memory.** It is unified in the data: one soul, working and long-term doc per Buddy, and 172 docs, all
buddy-scoped. It is not yet unified in the code; the scope plumbing is the −90 in T6.

**Ingest (`ingest.sqlite`, 593 MB).**
- **Size:** `message` is 511 MB. The largest single contributor is 3,832 Codex approval-review ("guardian") prompts, 109 MB, each embedding its parent's whole history. 579 of those sub-sessions are also listed in the sidebar as ordinary conversations. Dropping them from the list and not storing their bodies is about +20 lines in the Codex fold (D 3.1).
- **Stored twice:** `source_path` and `format`.
- **Aggregate with no rule:** `session.usage` is a stored sum of `usage_turn` rows with no stated recompute rule.

**Records store.** The shape is sound. Two field pairs are really one state each and should become sums:
`status` + `deleted_at`, and the three initial-dispatch fields (the T2 `delivery` sum). The `import_defaults`
column is now inert, since d445d4a writes NULL; it can be dropped with the next records schema change.

## 6. Line-count opportunities

| Item | Lines | Risk |
|---|---|---|
| Import tools + residue | **−4,431 (done, d445d4a)** | — |
| Mobile channel tree onto the desktop components with `layout` (ChannelsMobile 938 re-implements ChannelBrowser 1,139) | about −450 | low; mechanical, same pattern as swarm |
| One JSONL log primitive under both journals | about −300 | medium, well tested |
| One tool-line formatter (Rust) | about −300 | low |
| Unfed Buddy-result / Codex surface | about −280 | low; one live-turn check first |
| Sub-agent events carry phase / toolUseId / background; delete the server's codex collab parser | about −150 | touches the submodule |
| Dead napi records methods | about −150 | low |
| Dead server surface | about −125 | low |
| Model validity → catalog only | about −110 | medium |
| Typed resources + shared response types | about −100 net | medium |
| Doc-scope leftovers | about −90 | low |
| Run-state sum; TurnPolicy split; zustand → atoms; server-side provider lock/defaults | about −60 each (−250 together) | medium |
| **Subtotal of recommended cuts** | **about −2,300** | |
| Deferred: classic chat UI (Chat, Sidebar, Gallery, VirtualizedMessageList 5,528 lines; with mobile ConversationView 10,965) | −5.5k to −11k | owner decision; needs a desktop home and a Buddy rail first |
| Deferred: swarm viewer | about −5.1k | owner decision |

## 7. Recommended waves
Apply the "When to stop" rule: every wave below deletes code or fixes a bug. Stop after any wave whose payoff
no longer beats its gate cost.

**Wave 1 — correctness (about half a day, net lines slightly negative).**
V1–V5; required sender, cwd and fork source (B top 1); `message_complete.reason` required; idempotency key and
event on `enqueue_run` / `cancel_run`; drop the `DELETE` buddy archive route; stop defaulting provider and model
in the UI and in the ingest parser; stop listing Codex guardian sub-sessions.

**Wave 2 — one source per fact (about −1,200).**
One tool-line formatter; sub-agent event fields; addon types as the TS source (delete the `as unknown as`
bridges); shared HTTP response schemas and parsed resources; catalog as the only model authority; delete the
unfed and dead surface; delete doc-scope leftovers; `update_channel(changes)` + `EventOp` enum. **Do the channel
verb before the in-progress `rename_channel` in the main checkout lands** (C top 4).

**Wave 3 — state machines as sums (about −400, a records schema change).**
Run-state sum; `creation.delivery` sum; lifecycle sum; `BuddyContext.origin`; run outcome column; session intent
in agent-cli; TurnPolicy / BuddyControl split; reads take an actor.

**Wave 4 — structural (about −450).**
The mobile channel tree onto the shared channel views; zustand settings → resources + atom; JSONL log primitive.

## 8. Decisions for the owner

| Decision | Recommendation |
|---|---|
| Channel write verbs: rename as its own verb (in progress) or `update_channel(changes)` | `update_channel`, before rename lands |
| Codex guardian sub-sessions: hide from the list and skip their bodies | hide + skip (109 MB, 579 bogus rows) |
| Classic chat UI retirement | keep for thread inspection (owner, 2026-09-27); revisit when a desktop home and Buddy rail exist |
| Swarm viewer deletion (about −5.1k) | owner's call |
| Cross-workspace reads by Buddies (tasks, runs, schedules) | close them: reads take an actor |

## 9. Method
Five Opus agents, read-only, each with a short reading list (AGENTS.md, docs/patterns.md headings, the "One Clean
Path" rules), a fixed checklist (type inventory, duplicate sources, accidental optionality, stringly kinds,
structural branching, silent fallbacks, signatures, dead code, data model with live read-only row counts) and a
per-finding format (`file:line`, severity, fix, line delta). Recursive `rg` output is rewritten by rtk, so dead-code
claims were re-checked per file or with `git grep` at HEAD. The orchestrator re-verified V1–V5 against code and
the live database before ranking. Findings under §3 are the agents' and carry their citations.
