# Systems deslop review — 2026-09-27

Review only. Application baseline: `578e16070991cf8a06d192bebf0c8127e6e5e537`; agent-cli: `7983ed49adbd9d7cbd797f902769ec2e5ac1fde2`. Counts and searches used committed blobs, excluding concurrent Sidebar edits. No application implementation, live-data changes, or test execution was performed.

Owner direction: simplify data models, ingestion, types, ownership, and dispatch. Preserve distinct desktop/mobile behavior. Find redundant interpretation and complete replacements through deletion. The September 25 refactor's already-shipped work is the starting point.

## Finding summary

The strongest remaining candidates are conversion systems whose inputs already contain the information that downstream code reconstructs. They are not thousands of lines of safe dead code.

| Candidate | Measured source footprint | Assessment |
|---|---:|---|
| Typed content instead of tool text and hidden marker round trips | 1,204 lines in five focal files, plus producer/consumer call sites | Strong structural target; replace producers and every consumer together |
| One attempt contract and persistence path for diagnostics | 1,630 lines in six focal files, plus runner integration | Largest cohesive replacement; restart recovery and diagnostic history must survive |
| Consume normalized subagent events | 582 lines in three app/ingest files, plus the provider parser | Clearest bounded first implementation; only part of this footprint is removable |
| Record-contract duplication | 1,300 lines in four focal files | Real duplication, but a weaker immediate deletion case; avoid building a schema framework for small savings |
| Retired team-configuration output path | 159 lines in two schema/formatter files, plus imports/call | Small, concrete dead feature path |
| One-time import tools and record migration | 2,824 lines | Conditional operational retirement, not a runtime simplification |

These are affected-source counts, NOT predicted deletions. They include comments and any inline Rust tests. The three strongest clusters total 3,416 lines; much of their behavior must remain in smaller replacements. New native code and codecs count against any claimed saving. No defensible 10k-line behavior-preserving deletion has been established by this review.

## 1. Keep structured content structured

### Current path and evidence

For a live `AskUserQuestion` call:

1. Agent-cli emits a structured `tool.use` event.
2. `server/src/turns/tool-format.ts:319` serializes its input into `<!--ask_user_question:...-->`.
3. `server/src/turns/runner.ts:479` formats tool text, checks the resulting string's prefix to recover whether it is a question, appends it to assistant prose, and broadcasts a text chunk.
4. `client/src/utils/structured-message-segments.ts:63` scans that prose to recover the question payload.

Saved history repeats the formatter in Rust: `crates/unleashd-ingest/src/text.rs:342`. Both TS and Rust implement shell-command parsing, tool summaries, and Oompa launch detection. Buddy receipts add recursive searches through `structuredContent/content/text/result/data`, JSON parsing, URI encoding, HTML markers, and decoding again. See `shared/src/buddy.ts:82` and `crates/unleashd-ingest/src/text.rs:389`.

Even the recovered client segment carries `json: string`, so it is not yet canonical. `client/src/components/buddies/BuddyBuilderResultCard.tsx:172` performs another decode/parse/validation step. Channel rendering also consumes these text encodings (`ChannelMarkdown.tsx:299,352`).

### Replacement

Use a typed content union at application entry, conceptually:

```ts
type ContentPart =
  | { t: 'text'; text: string }
  | { t: 'tool'; call: ToolCall }
  | { t: 'question'; question: Question }
  | { t: 'buddy_receipt'; receipt: BuddyReceipt }
  | { t: 'swarm_launch'; launch: SwarmLaunch };
```

Names are illustrative, not a proposed generic content framework. Reuse the existing receipt/question types. A question contains validated question data, not a string that the renderer must parse. A tool retains its identity and structured arguments. Preserve unknown tools as generic tool calls with their raw names/arguments.

Raw provider adapters normalize provider envelopes. A shared application ingress adapter recognizes application-specific receipts; do not put Buddy concepts into the generic agent-cli library. Historical marker decoding stays at a raw-history boundary. Both live events and saved history arrive at the same application contract.

The render dispatcher selects a handler by `part.t`. Tool-summary formatting has one presentation implementation. Mobile and desktop can retain their own interactions and containers.

### What this can remove

- Duplicated live/history display formatters and shell classification.
- New-write HTML/URI/JSON marker serialization and corresponding client scans.
- `TOOL_LINE_RE` emoji heuristics used to infer whether prose is a tool call.
- Repeated receipt validation in render components.
- The runner's checks on the string it just formatted.

The five counted files are `tool-format.ts` (338), ingest `text.rs` (551), shared `buddy.ts` (157), `structured-message-segments.ts` (109), and `tool-activity-segments.ts` (49). Do not delete unrelated text utilities or all receipt schemas. One correct Oompa detector and legacy decoder still have a job.

### Required preservation

Live/history equivalence, tool call ordering and identity, completion-only shell event suppression, question interactivity, failed tool results never becoming successful receipts, old transcript readability, and no duplicate messages when the live overlay settles. Channels, clipboard/export, and memory-review transcript serialization are consumers too; migrating only chat would leave the old path alive.

Existing starting evidence: `server/test/tool-format.test.ts`, `server/test/ingest-history.test.ts`, `client/test/buddy-builder-results.test.tsx`, and the Rust text/parser fixtures. Add one contract replay through the real live and historical boundaries. Do not merge UI trees to implement this.

## 2. Replace the handwritten diagnostics persistence and compatibility stack

### Current path and evidence

`TurnRunner` already owns execution and joined completion. This review does not propose a second executor or claim that joined drain is missing.

Its observations pass through `runtime-observer.ts` into `TurnAttemptJournal`. The journal hand-implements serialization, partial-line repair, file rotation, event parsing, event replay, a mutable snapshot map, a promise lock, and restart reconciliation. `queryAttempts` scans and sorts the entire in-memory map even when the HTTP caller asks for one conversation's latest attempt (`turn-attempt-journal.ts:324`).

The browser separately defines `TurnAttemptSnapshotLike` and its cause vocabulary (`client/src/utils/turn-diagnostics.ts:57`). `useTurnDiagnostics.ts:112` accepts four response shapes: a bare attempt, `attempt`, `latestAttempt`, or an `attempts` array. The current server produces one shape. The hook also owns a bespoke polling/cancellation/retry loop, while the application already has conversation detail patches.

### Replacement

Define one shared attempt snapshot and typed outcome, written by the existing runner's transitions. For example, pre-spawn failure is a finished attempt with `spawn_failed`; an interrupted attempt after a boot change records `server_restart`. Preserve queue-message and provider-session correlation and distinguish bridge activity from actual provider progress.

Persist this through one small attempt store using the existing SQLite infrastructure, with an indexed conversation/attempt lookup and bounded retention. This replaces the journal implementation; it must not run alongside it as another authority. A persisted attempt is not the same entity as a Buddy run or a Task.

Expose the snapshot in the existing conversation detail/patch path. A small typed presentation function may still map the canonical outcome to the UI's labels and colors. Both UI shells consume that data without sharing their interaction behavior.

### What this can remove

- Handwritten JSONL repair, rotation, replay, and structural parsers after historical data has been retained/imported appropriately.
- Duplicate server/client attempt contracts and tolerant response-shape guessing.
- The mounted-thread diagnostics polling hook.
- Redundant snapshot projection and forwarding code where the new store/contract makes it unnecessary.

Measured files: journal 835, observability types 176, observer 64, diagnostics route 36, polling hook 137, client diagnostic utilities 382 = 1,630. Some type definitions, UI formatting, persistence operations, and startup reconciliation remain. Native implementation additions must be counted.

### Required preservation and open scope

Restart recovery consumes this data (`client/src/hooks/useRestartRecovery.ts:25`). Preserve it; the journal is not disposable telemetry. Keep async observation ordering, preflight failures before process startup, privacy-safe activity metadata, distinct timeout causes, and existing drain ownership.

The HTTP endpoint supports `includeEvents=true` and attempt history. No in-repo production caller of the event option was found outside the endpoint itself, but that is not evidence that external callers do not exist. Retain that contract with typed indexed event rows, or explicitly scope its retirement. Do not count history removal as a free refactor.

Existing evidence: `server/test/turn-attempt-journal.test.ts`, runtime completion/timeout tests, `client/test/turn-diagnostics.test.ts`, `client/test/restart-recovery.test.tsx`, and wire-v3 tests. File-rotation implementation tests can be replaced by retention/recovery tests at the new storage boundary.

## 3. Stop reconstructing normalized subagent facts

### Current path and evidence

The agent-cli Codex parser already normalizes statuses and emits `subagent.state` (`vendor/agent-cli-tool/src/parsers/codex.ts:87`). The app ignores that event (`server/src/turns/runner.ts:886`). It instead extracts Codex-specific fields from generic `tool.use.input` and normalizes the status again (`server/src/subagent-tools.ts:109,134`; `server/src/turns/subagents.ts:153`).

The T08 report explains why the switch was deferred: the existing normalized event was insufficient to preserve descriptions and tool-use counts exactly. That is a concrete contract gap to close, not permission to drop those behaviors.

### Replacement and deletion

Extend the existing normalized event only with the facts the consumers actually require, such as source action and stable operation identity. Keep raw Codex spelling and status classification in the Codex adapter. The app applies the canonical update to a child keyed by its thread ID. Preserve native versus inferred lifecycle ownership explicitly: completing the parent does not complete a native child.

Then remove the app's Codex payload extractor, duplicate status/action normalizers, and Codex-specific tool-use reconstruction. Keep the generic agent update logic, native lifecycle distinction, and display projections. Align historical subagent ingestion on the same semantic contract; live stdout and historical file adapters can remain distinct parsers.

The 582-line footprint is app `subagent-tools.ts` (198), app `turns/subagents.ts` (289), and ingest `subagents.rs` (95). It is an upper boundary, not a deletion estimate; a generic fold remains and the authoritative provider parser may grow.

Use captured spawn/wait/send-input events to compare description, tool counts, actions, and terminal states. Repeated updates must not double-count; parent completion must preserve running native children. Existing subagent/runtime fixtures are the starting point. This is the best small proof of the deslop method before committing to the larger transcript-contract change.

## 4. Record contracts: real duplication, not yet a large-cut plan

Rust `records/types.rs` explicitly calls itself a mirror of the shared Zod schema. `records/validate.rs` hand-codes its refinements. `config-records.ts:114` bridges the generated native result with `as unknown as ConversationRecord`.

Some old context fields survive primarily as schema baggage. At the audited commit, `legacyWorkItemId` and `allowedBuddyOperations` had no TS production consumers beyond their definitions; Rust still validates them. Other fields do have consumers: task IDs and foreground/background visibility must survive. Historical records are evidence, so absence of an active reader is not authorization to discard their stored bytes.

The opportunity is a smaller active record model, with historical provenance isolated from live routing, and one authoritative source for types/codecs. The 1,300-line footprint is shared config (423), Rust record types (408), Rust validation (179), and the TS store adapter (290). It includes substantial useful config resolution and storage APIs. A new code-generation framework could erase the savings; prove one contract's net reduction first.

Keep compare-and-set revisions, tombstones, session identity/usage, exclusive initial-message leases, and concurrent-open behavior. The existing `crates/unleashd-ingest/tests/records.rs` boundary tests exercise these. Leave this below the three demonstrated interpretation pipelines in priority.

## 5. Small direct deletion and conditional retirement

### Retired team configuration

`server/src/turns/policy.ts:116` still invokes `formatBuddyTeamConfigurationToolResult`. That function pulls in a 133-line retired team-setup schema and emits a marker the client explicitly discards as retired (`structured-message-segments.ts:20`). No current in-repo producer of the team-setup result contract was found.

Remove the obsolete writer/call and its two modules (159 lines plus call/import cleanup) after confirming the captured input cases. Keep the small reader suppression for old transcripts, or relocate it to historical ingress as part of finding 1. Do not remove the separate, active Buddy Builder receipts or worker links.

Native record APIs `rekey` and `append_branch_launch` also have no application caller at this baseline. Their addon exports and implementations are small deletion candidates after checking package/tool consumers; their existence is not a reason to rebuild a feature around them.

### Migration-only source

The two Rust importer/tool crates contain 2,439 source lines; the old TS record migration adds 385. Retiring them from the normal development tree is 2,824 lines, conditional on the supported upgrade/recovery story. Preserve pinned tools, source and backups as required. Most of these lines were already excluded from the 77.3k runtime-source total; their removal cannot be advertised as a 2.8k improvement to that metric.

## Recommended next step

Start with the normalized subagent event contract as the bounded proof: one real input, the authoritative typed output, a simple application handler, exact old helpers removed, and behavior parity. The larger follow-up is typed transcript content, which removes the format-then-parse cycle. Attempt persistence is independently valuable but requires a deliberate history/retention design.

Do not begin with another UI pass, a universal dispatcher framework, or deletion of watchdog/recovery checks. The ingest store, unified posts, provider-event dispatcher, kind policies, and joined process drain already exist and should be improved in place.
