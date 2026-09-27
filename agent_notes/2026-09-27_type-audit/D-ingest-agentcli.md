# D — Ingest crate + agent-cli boundary type audit (main 03fc931)

Read-only audit. Scope: `crates/unleashd-ingest` (parsers, store, records, napi), `vendor/agent-cli-tool/src`
(request type, event union, parsers, McpServerSpec), and `server/src/{turns,ingest}` as consumers.
Line numbers were re-checked against single files (not rtk-rewritten recursive output).
Severity: **bug-risk** (can silently produce wrong behaviour), **design** (violates one-clean-path / one-type-source),
**cosmetic**. Line delta: negative = net deletion.

## 1. Event and request types

The event union `UnifiedAgentEvent` (`vendor/agent-cli-tool/src/runtime-types.ts:165-187`) is exhaustively
consumed by the runner: `server/src/turns/runner.ts:846-894` has a `switch` with one case per variant and
no `default`, so a new variant fails `tsc`. `background-wait.ts` and `subagents.ts` take only the
`tool.use` / `task.*` variants through `Extract<>` and are chosen once per turn from a `Record<Provider, …>`
table (`background-wait.ts:62-69`, `subagents.ts:277-284`). The shape is good. The problems are in variant contents:

| # | Finding | Where | Sev | Fix | Δ lines |
|---|---|---|---|---|---|
| 1.1 | `subagent.state` is produced by the codex parser and **ignored** by the runner ("this duplicate is unused"). The server re-parses raw codex collab `tool.use` input itself (`extractCodexCollabToolInput`, `normalizeCodexSubagentStatus`, `getCodexSubagentCurrentAction`). Harness knowledge crosses the parser edge, and the status normaliser exists twice: `parsers/codex.ts:29` and `server/src/subagent-tools.ts:134`. | runner.ts:885-887; subagents.ts:153-262; subagent-tools.ts:96-198 | design (drift risk) | Have `codexFold` consume `subagent.state` (id, status, message, description are already canonical) and delete the server-side codex parsing | −150 |
| 1.2 | `_phase` is passed inside `tool.use.input` as a pseudo-field (`input._phase = 'started'/'completed'`). A variant hidden in a free-form record, read back by `getToolUsePhase`. | agent-cli parsers/codex.ts:11; subagent-tools.ts:89-94 | design | Add `phase: 'started' \| 'completed'` to the `tool.use` event (or split it into `tool.started` and `tool.completed`) | ~0 |
| 1.3 | `tool.use` / `tool.result` carry no call id, so the server binds a Claude `task.started` to its spawn **by matching the description string** (`genericFold`, comment at subagents.ts:47-55). Two identical launch descriptions in one turn mis-bind. | runtime-types.ts:173-174; subagents.ts:57-60 | bug-risk | Add `toolUseId: string` to both events; the Claude parser already reads `tool_use_id` (parsers/claude.ts:46,57) | +10 / −15 |
| 1.4 | `tool.result.isError?: boolean` is an optional flag that stands for a variant, and the runner **drops error results silently** (`if (!event.isError) …`), so a failed tool never shows its output. The Cursor parser derives `isError` from `success === undefined` (parsers/cursor.ts:69). | runtime-types.ts:174; runner.ts:864-865 | bug-risk | `{type:'tool.result'; outcome: {t:'ok',output} \| {t:'error',output}}` and render errors deliberately | +8 |
| 1.5 | Provider leak in the runner: `this.host.provider === 'codex' && message.includes('no rollout found…')`. | runner.ts:440 | design | The codex parser should emit a typed `error` variant (`{kind:'session_missing'}`) that the runner handles for every harness | +6 / −3 |
| 1.6 | Provider leak in background-wait: reads Claude's raw tool input `event.input.run_in_background === true`. | background-wait.ts:52 | design | Put `background: boolean` on `tool.use` in the Claude parser, which already knows it for `task.started` | ~0 |
| 1.7 | Unknown provider lines are dropped silently (`return []`), and there is no `unknown` variant. A new CLI event type vanishes with no trace unless `debugRawEvents` is on. | parsers/claude.ts:186, cursor.ts:73-74, codex.ts:42/79 | design | Emit `{type:'unrecognized'; harness; rawType}` that the runner counts or logs once per type | +15 |
| 1.8 | Request session intent is three optional ids: `sessionId?`, `resumeSessionId?`, `forkSessionId?`. `session.ts:15-40` gives precedence fork > resume > sessionId and silently ignores the rest. `BuildOptions` repeats this with `resume?`/`fork?` booleans, and `build.ts:52-53` quietly starts a **fresh** session when `fork`/`resume` has no `sessionId`. | runtime-types.ts:86-88; types.ts:288-305; build.ts:52-53; session.ts:15-40 | bug-risk | `session: {t:'new', id?} \| {t:'resume', id} \| {t:'fork', from}` in both request types | −10 |
| 1.9 | `HarnessConfig` optionality stands in for sums. (a) `mcpCapability` and `mcp?` are independent, so a harness declaring `'required'` with no encoder would drop required servers silently (`build.ts:134` `if (config.mcp)`). (b) `promptVia` + optional `promptFlag`/`promptSep`. (c) `sessionForkFlags?`/`emulateFork?` are called "mutually exclusive by construction" but both are optional. | types.ts:163-176, 182-188, 244-251; build.ts:129-135 | design | `mcp: {capability:'none'} \| {capability:'inject'\|'required', encode}`; `prompt: {via:'flag',flag} \| {via:'cli-sep',sep} \| …`; `fork?: {t:'native',flags} \| {t:'emulated',copy}` | ~0 |
| 1.10 | `turn.complete.text?` (muse only) and `usage` fields optional per harness: acceptable, since absence is the meaning and it is documented. | runtime-types.ts:149-163,186 | ok | — | — |
| 1.11 | `runner.ts:146,148` initialises the per-turn fold with `subAgentFoldFor('claude')` as a placeholder, a plausible default for "not yet chosen". It is overwritten at 277-278. | runner.ts:146-148 | cosmetic | Type it `SubAgentFold \| null` or build it in the turn object | ~0 |

## 2. Duplicate type sources across the TS/Rust boundary

| # | Concept | Copies | Sev | One source? | Δ |
|---|---|---|---|---|---|
| 2.1 | **Tool-use one-liners** (emoji table, shell word splitting, oompa detection) | `server/src/turns/tool-format.ts` (338 lines, used for live turns, runner.ts:35) and `crates/unleashd-ingest/src/text.rs:80-400` ("port of tool-format.ts", used for reloaded history). A change to one makes the live line differ from the same line after reload. | bug-risk | Yes. Export `formatToolUse` from the napi addon and delete the TS copy (the addon is already loaded in-process) | −300 |
| 2.2 | **Sub-agent spawn names and descriptions** (Claude `Agent/Task`, Gemini labels, codex `spawn_agent`) | agent-cli `CLAUDE_SUBAGENT_TOOL_NAMES` (parsers/claude.ts:36); Rust `CLAUDE_SPAWN_TOOLS` + `gemini_label` + `description` (subagents.rs:8-57); TS `isSubagentSpawnTool` + `getSubagentDescription` + `GEMINI_LOCAL_AGENT_LABELS` (subagent-tools.ts:5-86). They are kept in sync by comment. | design | Partly. Put the table in a JSON file in agent-cli (`catalog.jsonc` already sets the precedent), `include_str!` it in the crate, and have the server call the crate for descriptions. Minimum: one test that asserts the Rust and TS sets are equal | −60 |
| 2.3 | **Provider enum** | agent-cli `Harness` (types.ts:14); shared `ProviderSchema` (provider-catalog.ts:7); Rust `Provider` and `Format` (model.rs:32,36), which are identical literal sets | design | `ProviderSchema = z.enum(HARNESSES)` from an agent-cli `const` array, plus a type-level `Equals<Addon.Provider, Provider>` assertion. Keep `Format` separate: it is a different concept that happens to share the literals | −5 / +5 |
| 2.4 | **ConversationRecord** | shared Zod `PersistedConversationConfigRecordSchema` (conversation-config.ts:267); Rust `records/types.rs` (408) + `validate.rs` (179, re-implementing Zod refinements); generated `index.d.ts`; bridged by `r as unknown as ConversationRecord` (config-records.ts:114-118, plus ~8 more `as Addon.X` casts at 153-248). Nothing checks the two TS types agree. | bug-risk | Make the napi types the TS source (`ConversationRecord = Addon.ConversationRecord`) and delete the Zod persisted schema. At minimum, replace the casts with a compile-time mutual-assignability check | −80 |
| 2.5 | **RecordSummary** | Rust store builds it (store.rs `SUMMARY_SESSIONS` …); TS `summaryOf` rebuilds it by hand (conversation-list.ts:166-187, including the session de-duplication) | design | Return `RecordSummary` from the napi mutation outcomes, or add `records.summary(id)` | −25 |
| 2.6 | **Per-request usage** | agent-cli `TurnUsage` (runtime-types.ts:149); Rust `ProviderTurnUsage` (records/types.rs:93) = the same plus `observed_at`; shared `ProviderTurnUsageSchema` (conversation-config.ts:111); Rust `ContextReading` (model.rs:126), which is the same concept read from disk | design | `ProviderTurnUsage = TurnUsage & {observedAt}` on the TS side; Rust derives the d.ts. Keep `ContextReading`, since it adds `compaction` | −15 |
| 2.7 | `index.d.ts` itself is generated by napi-rs (header line 1, model.rs:1-4). This is **not** a hand-written duplicate. | — | ok | — | — |

## 3. Ingest schema (live, `sqlite3 -readonly ~/.agent-viewer/ingest.sqlite`, 593 MB + 56 MB WAL)

Schema: `crates/unleashd-ingest/src/store.rs:29-97`.

| table | rows | size (dbstat) | notes |
|---|---|---|---|
| message | 305,239 | **511 MB** | content 252 MB + tool_input 126 MB, plus b-tree overhead |
| source | 8,258 | 32 MB | `checkpoint` BLOB = 24 MB (max 224 KB); **1,950 sources have no session row** but keep checkpoints |
| usage_turn | 236,538 | 10.6 MB (+4.3 MB index) | 1,359 rows with NULL model |
| session | 6,308 | 5.6 MB | usage JSON 0.4 MB, context 0.4 MB, rate_limits 0.7 MB |
| removed | 0 | — | |
| meta | 2 | — | |

**What is big and why.** `message` is 86% of the file. User rows are only 20,813 of the rows but hold **208 MB**: codex
user rows alone are 138 MB. One prompt family dominates: **3,832 rows / 109 MB** starting "The following is the
Codex agent history whose request action you are…". These are Codex approval-review ("guardian") sub-sessions,
each embedding the whole parent history. **579 of those sessions are `listed=1`, with no parent_session_id**, so they are
stored in full and also appear in the list as general conversations. Next largest: 1,674 rows / 12 MB of a "mediocre
generic AI assistant" eval prompt, then oompa task-management preambles (8 MB) and worker context (6 MB).
Byte-identical user prompts over 2 KB repeated across rows account for 16.6 MB; duplicated tool_input 2 MB. Assistant
tool rows (146k) carry 126 MB of pretty-printed tool_input.

| # | Finding | Where | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 3.1 | Codex guardian and review sub-sessions are ingested in full and listed as ordinary conversations (109 MB, 579 list rows). | codex parser `Facts` / `listed` rule store.rs:253 | bug-risk (list noise) + size | Classify them in the codex fold (`Identity::ProviderInternal` or `parent_session_id` from the embedded history) so they are not listed. Consider storing only the first 4 KB of such prompts | +20; −~110 MB |
| 3.2 | Facts stored twice: `session.source_path` = `source.path` and `session.format` = `source.format` (0 mismatches live), maintained by one writer. | store.rs:31-43 | design | Drop both columns and join `source` (PK join, cheap) | −10 |
| 3.3 | `session.usage` (JSON) is the sum of that source's `usage_turn` rows, a derived aggregate stored beside its inputs. Invalidation is implicit (same fold, same transaction). It is safe today but nothing states the rule. | store.rs:57, 78-89 | design | Compute on read with `SUM … GROUP BY source_id` (236k rows, indexed), or state the invariant in the schema comment | −15 |
| 3.4 | `session.message_count` is derived from `message` rows. Same point as 3.3, but it is needed for the list, so keep it and document it. | store.rs:51 | cosmetic | comment | +1 |
| 3.5 | `message.tool_name` / `tool_input` are a nullable pair that encodes a variant (text message vs tool call). The model repeats it with `Message.content` + `tool_call: Option<ToolCall>` (model.rs:169-179). | store.rs:73-74 | design | `kind TEXT CHECK(kind IN ('text','tool'))` + NOT NULL name for tool rows, or a CHECK `(tool_name IS NULL) = (tool_input IS NULL)`. `ToolCall.input: Option` is legitimate ("none was sent") | +3 |
| 3.6 | `session.identity` stores Buddy context as **JSON-escaped JSON inside JSON** (`{"t":"buddy","buddy_id":…,"context":"{\"buddyId\":…}"}`), so buddy_id is stored twice per row. | model.rs:87-90 | cosmetic | Store `context` as a nested JSON value, not a string. Drop `buddy_id` or read it out of the context | −5 |
| 3.7 | 1,950 `source` rows (24% of the table) produced no session but keep checkpoints. That is correct for resuming, but they are never garbage-collected. | store.rs:31-37 | cosmetic | none needed; note only | 0 |
| 3.8 | `rate_limits` is a raw-JSON TEXT column on every session, where only the latest per provider is ever read (model.rs:271-273). | store.rs:61,65 | cosmetic | fine as is (0.7 MB) | 0 |

## 4. Parsers

The crate is **table-driven at the right level**: one `Fold` trait (`parsers/mod.rs:68-77`), one generic driver
(`read.rs`), one fold per format, plus two whole-document readers (Gemini, OpenCode → `Doc`). agent-cli likewise
has one `createParser` switch (`parsers/index.ts:12-27`). The folds themselves are hand-walked `serde_json::Value`
code with no shared line-type table.

| # | Finding | Where | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 4.1 | `provider_from_model` maps missing or unknown models to **Claude** (`unwrap_or("unknown")` … `else Provider::Claude`). A Claude-layout transcript with no model silently becomes a Claude session. | parsers/mod.rs:328-340 | bug-risk (T4) | Return a `ProviderGuess::{Named(p), Unrecorded}` and treat Unrecorded as Claude **explicitly** at the one call site, with a comment | +8 |
| 4.2 | Unknown Claude line kinds return `Line::Used` instead of `Line::Skipped`, so the ScanReport under-reports skipped lines. | parsers/claude.rs:141 | cosmetic | `_ => Ok(Line::Skipped)` | 0 |
| 4.3 | Plausible defaults from JS parity: tool name `"undefined"` (claude.rs:192), empty tool id `""` fed into the sub-agent fold (claude.rs:194), gemini `"tool"` (gemini.rs:48) and a synthetic id `"{name}-0"` (gemini.rs:55), opencode `"tool"` (opencode.rs:130), `created … unwrap_or(0.0)` (opencode.rs:230), and `Ctx::stem`/`parent_name` returning `""` (mod.rs:58-64). | as listed | design | Skip the block and count it as malformed when the name or id is missing; the stem/parent can fail at `Ctx` construction | ~0 |
| 4.4 | `DocMessage` (Gemini/OpenCode) has **no `tool_call`**, so these two formats cannot produce structured tool calls in history, unlike the JSONL folds. | parsers/mod.rs:138-144 | design | Reuse `Message` minus seq, or add `tool_call` | +3 |
| 4.5 | JSON-walking helpers are duplicated: `finite` (mod.rs:153), `number` (claude.rs:53), `truthy_string` (claude.rs:57) vs `text::truthy` (text.rs:41), `trimmed` (muse.rs:72), `non_empty_str`/`any_str`/`nonempty_field` (text.rs:333-388), `first_string` (subagents.rs:33), `parse_epoch` (codex.rs:127) vs `parse_time` (mod.rs:236), `recorded_at` (muse.rs:65). On the TS side, `asObject/asString` (json-utils.ts) vs `asRecord` (tool-format.ts:17) vs `firstString` (subagent-tools.ts). | as listed | cosmetic | One `json.rs` with `str_field`, `nonempty_str`, `finite`, `time` | −40 |
| 4.6 | The ingest crate and agent-cli parse the **same Claude/Codex line formats twice** (disk transcripts vs stdout stream). The formats differ, so this is not a straight duplicate. Usage conventions (Claude context = input + cache read + cache write, Codex cumulative) are re-derived in both: runtime-types.ts:136-148 vs model.rs:126-128. | — | design (accept) | Leave it. Share one golden fixture per convention across both test suites | 0 |

## 5. Signatures

| # | Finding | Where | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 5.1 | napi methods with **no TS caller**: `ConversationRecords.rekey` (records/node.rs:95; store.rs:450, 85 lines) and `appendBranchLaunch` (node.rs:131; store.rs:535). Verified with `git grep` over server/src, shared, client, tools. The records-tool crate does not call them either. | as listed | design | Delete both, plus the `RekeyOutcome`/`BranchLaunchOutcome` types (`ConversationBranch.launches` becomes unused if the launch is gone; check first) | −150 |
| 5.2 | Boolean flags on the request: `yolo?`, `fullAuto?`, `webSearch?`, `debugRawEvents?`, `detached?`; `BuildOptions.resume?`/`fork?`/`bypassPermissions?`. The session booleans are covered by 1.8. The others are independent toggles, which is acceptable. | runtime-types.ts:89-107; types.ts:291-311 | cosmetic | only 1.8 | — |
| 5.3 | Long positional params in the server's codex path: `applyCodexChildState(host, childId, toolName, prompt, rawStatus, statusMessage)` and `upsertCodexAgent` (same 6), where `statusMessage: string \| null \| undefined` is a three-state optional. | server/src/turns/subagents.ts:186-194, 227-234 | design | Deleted by 1.1 | (in 1.1) |
| 5.4 | `put(tx, record, defaults: &[Defaulted])`: an importer-only parameter on the one write path. | records/store.rs:169 | design | Remove it with the importer (see §6) | −10 |
| 5.5 | `ConversationRecords` mutations take a positional `at: number` plus ids. Fine. `setDone(id, done: boolean, at)` is a boolean flag but mirrors a field. OK. | index.d.ts:14 | ok | — | — |
| 5.6 | `history.ts:19` invents a time (`native.at ?? previousAt`) that the crate deliberately left null ("never invented", model.rs:6-9). The T4 rule is broken one layer up. | server/src/ingest/history.ts:18-27 | design | Make client `Message.timestamp` optional for untimed formats (Cursor), or tag it `{t:'inferred'}` | +5 |

## 6. Records store (config-records + records-tool)

Live `conversation-records.sqlite` (25 MB): `conversation_record` 8,776 rows (22 MB), `conversation_session`
9,729, `conversation_record_reject` 1. Provenance: user 1,387, external_discovered 7,389, **legacy_inferred 0**.
Kinds: chat 6,812 / buddy 1,404 / worker 505 / builder 55. `status='deleted'` ↔ `deleted_at` never disagrees (0 rows).

**What remains after deleting the one-time import tool** (`crates/unleashd-records-tool`, 723 lines;
`server/src/conversations/record-migration.ts`, 385 lines):
- The `unimported` branch of `RecordsLocation` and `unimportedMessage` (config-records.ts:59-112, ~45 lines).
- `Defaulted` (records/types.rs:387-408), the `defaults` param of `put`, and the `import_defaults` column.
  **The column is write-only:** nothing decodes it (it is not in `COLUMNS`), and every non-import `put` passes `&[]`,
  so the `ON CONFLICT … import_defaults = excluded.import_defaults` clause (store.rs:186) **erases the
  provenance-of-defaults on a record's first edit**. 7,142 rows still carry it. Either read it or drop it; today it is
  data that silently decays.
- The `conversation_record_reject` table (1 row) and the `validate.rs` rationale "so the importer … refuse exactly what Zod
  refuses". Once the import is gone, the validator only guards the server's own writes.
- The `pub` on `put` ("only for the one-time importer", store.rs:167).
- `Provenance::LegacyInferred` has 0 live rows but is still produced at config-service.ts:507, so it stays.

Is the shape still right? Mostly yes: one row per conversation, one write path (`put`), and a derived
`conversation_session` index rebuilt in the same transaction (a clear invalidation rule). Remaining type issues:
- `status` + `deleted_at` (store.rs:41-42, types.rs:234,242) is a sum stored as two fields → `lifecycle: {t:'active'} | {t:'deleted', at}`. design, ~0.
- `ConversationCreation` initial-message dispatch is three optional strings (`…_claimed_at`, `…_claim_token`,
  `…_dispatched_at`, types.rs:183-189), a state machine → `dispatch: Pending | Claimed{at,token} | Dispatched{at}`. design, ~0.
- `BuddyContext` has six `Option<Option<String>>` fields (types.rs:139-155), mirroring Zod `.nullable().optional()`
  byte-for-byte. The live identity JSON shows `null` written for all of them. Normalise to `Option` at the boundary. cosmetic, −10.
- 7,397 of 8,776 records have `creation IS NULL`, and 511 have `working_directory IS NULL`. Absence is meaningful for discovered records, so this is fine.
- The records live in the same crate as ingest on purpose (one SQLite link, records/mod.rs:5-12). Keep that.

Estimated deletion once the importer goes: **−1,108** (tool + migration script) **−~90** (location branch, `Defaulted`,
reject table, column, `put` param) ≈ **−1,200 lines**.

## Top 5 recommendations (ranked by payload / cost)

1. **Delete the importer and its residue** (§6): records-tool crate, record-migration.ts, the `unimported` location,
   `Defaulted`, `import_defaults` (a write-only column that erases itself), and the reject table. ≈ −1,200 lines, low risk, no behaviour change.
2. **One tool-line formatter** (2.1): export `formatToolUse` from the addon and delete `turns/tool-format.ts`. −300 lines,
   and live and reloaded transcripts can no longer drift apart.
3. **Consume `subagent.state` and put `phase` / `toolUseId` / `background` on the events** (1.1-1.3, 1.6): this deletes
   the server's codex collab parser and duplicate status normaliser, removes the description-string binding bug
   and the `_phase` and `run_in_background` leaks. ≈ −150 lines, touches the submodule (commit and push inside it first).
4. **Stop listing Codex guardian sub-sessions** (3.1): 579 bogus list rows and ~109 MB of the 511 MB `message` table.
   About +20 lines in the codex fold.
5. **Session intent sum in agent-cli + `tool.result` outcome** (1.8, 1.4): removes silent fork/resume precedence and the
   silently dropped tool errors. Also delete the dead `rekey`/`appendBranchLaunch` napi methods (5.1, −150) in the
   same pass. Small, high bug-risk payoff.

Runner-up: make `Addon.ConversationRecord` the TS type source and delete the `as unknown as` bridge (2.4, −80).
