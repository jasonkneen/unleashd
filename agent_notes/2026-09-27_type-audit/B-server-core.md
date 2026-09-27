# B — Server core type audit (not Buddies)

Commit: 03fc931 (lane-review worktree). Read-only audit.
Scope: server/src/{conversations,turns,transport,http,ingest,providers,observability}/*.ts and server/src/server.ts
(about 12.1k lines; the largest files are runtime.ts 942, runner.ts 1005, turn-attempt-journal.ts 835, server.ts 813,
conversation-list.ts 639).

Severity key: **bug-risk** (a wrong value or a lost input can reach the user) / **design** (violates One Clean Path; costs
lines or invites the next bug) / **cosmetic**. The Δ column estimates net lines in server/src (negative = removed).
Recursive-rg claims were re-checked with `git grep … HEAD` or single-file greps.

---

## 1. Type inventory

About 150 exported or local named types in scope: roughly 95 `interface`, 45 `type` aliases/unions and 12 classes
(`Conversation`, `TurnRunner`, `EventFold`, `TurnQueue`, `TurnWatchdog`, `ChatTurnPolicy`, `ConversationRecordStore`,
`ConversationConfigService`, `ErrorJournal`, `TurnAttemptJournal`, `PersistedServerState`, plus 4 Error subclasses).
Only about 15 are real sums with a `t`/`kind` discriminant. The rest are port bags (`*Dependencies`, `*Ports`, `*Host`)
and all-optional input bags.

### Canonical domain types and where each concept lives

| Concept | Canonical type | Other copies | Exactly once? |
|---|---|---|---|
| Conversation identity | `ConversationKind` (shared; the dispatcher is `matchConversationKind`) | `Addon.ConversationKind` (crate napi d.ts) cast at config-records.ts:112-117 and conversation-list.ts:151,178 | No: two type sources joined by `as unknown as` |
| Durable record | `ConversationRecord` = `Omit<PersistedConversationConfigRecord,'version'>` (config-records.ts:40) | `Addon.ConversationRecord`; `RecordSummary` (addon) plus a TS re-projection `summaryOf` (conversation-list.ts:166) | No |
| Live conversation | `class Conversation` (runtime.ts:229), aliased `ConversationRuntime = Conversation` (runtime.ts:203) | Six structural views of it: `ConversationRuntimeView` (:68), `HistorySubject` (:122), `ListedRuntime` (conversation-list.ts:44), `TurnRunnerHost` (runner.ts:57), `ConfigurableRuntime` (runtime-config.ts:11), `ContextSubject`/`RoutedConversation` (conversation-routes.ts:24,37), plus the anonymous `getConversation` return (runtime.ts:95-103) | Views are fine as ports, but see §5: the views re-expose mirrored fields |
| Kind behaviour | `TurnPolicy` (policy.ts:50, 26 members) | — | Yes, but it is too wide (§3.1) |
| Queue item | `QueueEntry` (queue.ts:11) wrapping the wire `QueuedMessage` | — | Yes |
| Turn input | `TurnInput` (input.ts:13) | `OwnerInput`, `SeatTurnInput` refinements; `Readonly<{origin:'owner_input';inputId}>` re-spelled inline at buddy-creation-service.ts:31,36 and conversation-websocket.ts:85 | Mostly; use `OwnerInput` in the other places |
| Run attempt | `TurnAttemptState`/`TurnTerminalCause` (observability/types.ts:12,42) | `AttemptState` re-declared at runner.ts:49 (it equals `TerminalTurnAttemptState`); client/src/utils/turn-diagnostics.ts:34,75-92 re-declares the unions | No |
| Run state (wire) | `RunState` (shared) | Stored as `isRunning`, `isStreaming`, `process`, `_sendingFromQueue` and `_publishedRun` on `Conversation` (runtime.ts:234-249), then derived in `runState()` (:668) | No (§5.1) |
| Turn end | `TurnEnd` (policy.ts:38) and `TurnTerminalCause` | `CoordinationDrained(status, detail, terminalCause?)` (policy.ts:43) | Three overlapping outcome encodings |
| Ingest readiness | `IngestSlot` sum (ingest/instance.ts:16), a good pattern | server.ts:204-209 keeps `conversationList: … \| null`, `bootedIngest: … \| null` and `listReady` for the same fact | No (§5.4) |
| Context breakdown | `ContextBreakdownResponse` (conversation-routes.ts:54) | Hand-copied as `ContextBreakdownData` in client/src/components/ContextBreakdownMeter.tsx:17 | No shared schema |
| Tool-use event alias | `Extract<UnifiedAgentEvent,{type:'tool.use'}>` | Declared three times: runner.ts:47, subagents.ts:21, background-wait.ts:5 (task.* aliases twice more) | cosmetic |

Good sums worth keeping as models: `RecordsLocation` (config-records.ts:59) with `openRecords` as a thin dispatcher,
`SetConfigResult` (:120), `IngestSlot`, `Listing` (conversation-list.ts:47), `TurnGate` (policy.ts:35) with the thin
switch at runtime.ts:482, and the `BACKGROUND_WAITS` table (background-wait.ts:69).

---

## 2. Function signatures

| # | Site | Problem | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 2.1 | runtime.ts:393 `markSessionStarted(started = true)`; runner.ts:71; its caller runner.ts:442 passes `false` | Boolean flag with a default. `false` means "repair a phantom binding" | design | Two verbs: `markSessionStarted()` and `forgetPhantomSession()` | +2 |
| 2.2 | runtime.ts:421 `runCoordinationMessage(content, context, claimToken, onDrained?, onAdmitted?)`, the same in `TurnPolicy.runCoordination` (policy.ts:92) | 5 positional parameters, 2 of them optional callbacks | design | One `CoordinationRun` object; callbacks required (a caller that does not care passes a no-op) | ±0 |
| 2.3 | runtime.ts:435,709,722 `sendMessage/enqueueMessage/interruptAndSend(content, ownerInput?: OwnerInput)` → `ownerInput ?? unknownInput()` | An optional parameter hides the variant: omission silently mints `origin:'unknown'` | **bug-risk** (see 4.2) | Make `input: TurnInput` required; call sites name the origin | +4 |
| 2.4 | buddy-creation-service.ts:21-33 `CreateServerBuddyConversationInput` | Optional bag hiding three variants: `deferInitialMessage` × `initialMessage?` × `ownerInput?` × `config?` × `conversationId?` | design | `dispatch: {t:'dormant'} \| {t:'owner', input:OwnerInput} \| {t:'system', origin}`; `config` required or explicitly `{t:'from_buddy'}` | −5 |
| 2.5 | buddy-creation-service.ts:35 `InitialMessageDispatchOptions` (`ownerInput?`, `enqueueAuthorized?`), held in the in-memory `dispatchOptions` map (:88) | The options live only in memory, so a lease retry after restart (:207) runs with no `ownerInput` → `unknown` origin | **bug-risk** | Persist the origin in `creation` next to `initialMessage` (one field); drop the map | −10 |
| 2.6 | transport/conversation-websocket.ts:414 `createdKind(requested, buddy: Resolved… \| null, …)` | Maybe-valid re-check: the caller already branched on `data.kind.t==='buddy'` (:179) to produce `buddy`; the callee re-checks `if (!buddy) throw` | design | Resolve inside the dispatcher: `createdKind` is async and each arm does its own resolution | −8 |
| 2.7 | ensureReady (creation-service.ts:95-128), called by every `queue_message` (conversation-websocket.ts:327) | Re-reads the record and re-checks tombstone plus registry identity on every message. Both checks are repeated after the link await (deliberate), but the first read happens per send | design | Memoise readiness per runtime (`linked` WeakSet already exists; return early before the record read) | −3 |
| 2.8 | runner.ts:90-96 ports `registerSessionAlias(sessionId: string\|null\|undefined, …)`, `clearExternalRunningStatus(...ids: Array<string\|null\|undefined>)` and 3 others | Ports accept maybe-values and filter internally: validation pushed downstream | design | Take `string` / `readonly string[]`; callers already hold canonical ids | ±0 |
| 2.9 | conversation-routes.ts:108 `getBranch?: (id) => Promise<Branch\|null\|undefined> \| Branch \| null \| undefined` | A sync/async × null/undefined × optional-port union | design | `getBranch(id): Promise<ConversationBranch \| null>`, required | −4 |
| 2.10 | runtime.ts:442 `refuseAutomationTranscript(message?)` | Optional text with a default body | cosmetic | Constant default at the one call site that omits it | ±0 |
| 2.11 | Callback arity | No mismatched library callbacks found in scope. `CoordinationDrained` has an optional third parameter (policy.ts:43-47) | cosmetic | Fold `status`/`detail`/`terminalCause` into one `TurnEnd` value | −2 |

---

## 3. Structural branching in handlers

| # | Site | Branch | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 3.1 | policy.ts:50-100 `TurnPolicy` (26 members); `ChatTurnPolicy` (policy.ts:121-181) | Not an if, but the same smell: Buddy-only operations (`runCoordination`, `sendAutomation`, `stopAutomation`, `audienceKey`, `waitingForRunSlot`, `dropWaitingTurn`) are forced onto every kind, and Chat implements them as throws/no-ops. runtime.ts:426 then re-checks `kind.t !== 'buddy'` before delegating, so the kind is asked twice | design | Split `TurnPolicy` (turn hooks, all kinds) from `BuddyControl` (coordination/automation), exposed as `conversation.buddy(): BuddyControl` returning a typed refusal for non-Buddy kinds. ChatTurnPolicy shrinks to about 15 lines | −40 |
| 3.2 | runtime.ts:369 `visibility: () => kind.t==='buddy' ? kind.visibility : 'foreground'` and server.ts:348 (same rule) | Kind check outside the dispatcher, duplicated | design | `kindVisibility(kind)` in shared, next to `kindBuddyContext` | −4 |
| 3.3 | runtime.ts:333 `swarmDebugPrefix = kind.t==='chat' ? … : null` | Kind check in the constructor | design | The prefix belongs to `ChatTurnPolicy` (it already receives it via closure); store it there | −3 |
| 3.4 | conversation-routes.ts:204-212 if/else-if on `kind.t` for the briefing text | Not exhaustive: a new kind silently lands in the `else` (swarm prefix) | design | `matchConversationKind` with four arms (worker: none) | ±0 |
| 3.5 | runner.ts:440 `host.provider === 'codex' && message.includes('no rollout found for thread id')` | Provider string check plus message sniffing in the turn core ("there is no provider branching here", runner.ts:45) | design | agent-cli emits a typed `session.missing` error; the runner reacts to that event kind | −3 (+submodule) |
| 3.6 | providers/catalog-service.ts:31 `provider==='codex' ? 'gpt-6-sol' : entry.defaultModelId` | Per-provider override in a mapping; the catalog stops being the one source | design | Put the default in catalog.jsonc | −1 |
| 3.7 | config-service.ts:470 `provider==='claude' && model==='claude-fable-5-1' ? 'fable'` | A hard-coded alias beside `normalizeModelId`'s alias table | design | Add the alias to the catalog's alias table | −4 |
| 3.8 | buddy-creation-service.ts:246-257 Builder hard-codes `'codex'` / `'gpt-6-astra'` / `'low'` | Magic provider/model outside the catalog | cosmetic | One `BUILDER_CONFIG` constant beside `BUDDY_BUILDER_BRIEFING` | ±0 |
| 3.9 | ingest/runtimes.ts:95,121 `record.kind.t==='buddy' && …`; server.ts:231 `identity.t==='worker'` | Kind checks inside hydration. The ingest one is fine as κ (discovery), but runtimes.ts:121 rebuilds `kind` by spreading a re-resolved context | design | A `hydrateKind(record.kind)` dispatcher returning `{kind, briefing}` per arm | −5 |
| 3.10 | conversation-websocket.ts:163-165 and 190-192 `isBuddyArchived?.(…)` twice per create | Optional port plus a duplicated check | design | Required port; check once, after `createdKind` | −4 |

---

## 4. Silent fallbacks

| # | Site | Fallback | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 4.1 | conversation-websocket.ts:419 `getConversation(requested.from)?.kind ?? CHAT_KIND` | A fork whose source is listed but not materialized (the handler materializes only `data.conversationId`, :158) silently becomes a **chat**, so forking a Buddy thread loses its identity | **bug-risk** | `await materialize(from)` first, then reject `fork_source_missing` instead of defaulting | +4 |
| 4.2 | runtime.ts:82 `unknownInput()` used via `?? unknownInput()` (:437,710,731) and buddy-creation-service.ts:148 `currentOptions?.ownerInput` | A missing producer maps to `origin:'unknown'`: no owner authority, and nobody is told | **bug-risk** | Required `TurnInput` (2.3); persisted origin (2.5) | see 2.3/2.5 |
| 4.3 | buddy-creation-service.ts:103-117 `persistCurrentSession` catch → `logger.warn` | A failed session-binding write is swallowed. The turn continues; after a restart the conversation cannot `--resume` (the context is lost) and the transcript may be rediscovered as a new record | **bug-risk** | Report it to the error journal and surface it as a system line; at minimum retry once. (Usage writes may stay best-effort, per docs/turn-lifecycle.md#provider-usage; bindings are not usage) | +8 |
| 4.4 | ingest/runtimes.ts:96-101 `resolveBuddyConversation(...).catch(() => null)` | A Buddy runtime is built with **no briefing and the stale stored context** when the briefing rebuild fails. The first turn then runs un-briefed | **bug-risk** | Hydration fails loudly (the command gets `rejected`) or marks the runtime `{t:'unbriefed'}` so the policy refuses to send | +5 |
| 4.5 | runtime.ts:323 `path.resolve(workingDirectory \|\| process.cwd())` | A missing cwd becomes the **server's** cwd, so a turn runs in the unleashd repo | **bug-risk** | `workingDirectory: string` required in `ConversationOptions`; every caller has it (records without cwd are already a `no_cwd` listing) | −1 |
| 4.6 | runtime.ts:317 `sessionId = existingSessionId ?? id` | The session id defaults to the conversation id. It is documented, but it forms one of two id spaces in one field | design | `SessionState = {t:'unstarted', provisionalId} \| {t:'bound', id}` (also absorbs `_hasStartedSession`, §5.2) | ±0 |
| 4.7 | runner.ts:324 `attemptId: this.activeAttemptId ?? crypto.randomUUID()` and :329 `if (this.activeAttemptId)` | A fabricated attempt id is handed to `policy.spawned` (the memory review keys on it), and it never exists in the journal | **bug-risk** (low) | `beginAttempt()` returns the id; pass it through `start()` so it is non-null by type | −3 |
| 4.8 | runner.ts:146-148 `subAgentFoldFor('claude')`, `backgroundWaitFor('claude')` initial values | Per-turn strategy initialised to a plausible provider before any turn | design | Part of the per-turn `ActiveTurn` object (see top-5 #2) | in #2 |
| 4.9 | conversation-routes.ts:363-384 three catch → null (`getBranch`, ingest readings, memory snapshot) | Failures render as an "estimated" meter, indistinguishable from "no data" | design | One `readings: {t:'measured'}\|{t:'estimated',why}\|{t:'failed',error}` field in the response | +6 |
| 4.10 | conversation-list.ts:153 `parent: conversationOfSession(parentSession) ?? parentSession` | `row.parent` holds either a conversation id or a raw provider session id. A link built from it navigates to a non-existent `/chat/<sessionId>` | **bug-risk** | `parent: {t:'conversation',id} \| {t:'session',sessionId} \| null`, or null when unresolved | +3 |
| 4.11 | http/core-routes.ts:17 `request.query.provider \|\| 'claude'` | Default provider on a route no client calls (§6) | cosmetic | Delete the route | see 6.2 |
| 4.12 | http/persisted-state.ts:40-44,63-69 | POST `/api/settings` merges an unvalidated `req.body` into `Settings`, and the disk write is fire-and-forget: a failed write still answers 200. `ignore ?? []` re-checks a typed field | **bug-risk** | zod `SettingsSchema.partial().parse(body)`; `await` the write and answer 500 on failure | +3 |
| 4.13 | buddy-creation-service.ts:209 `claimedAt ? Date.parse(claimedAt) : Date.now()` | A missing lease timestamp is treated as "just claimed" | design | Disappears with the dispatch sum (§7.3) | in 7.3 |
| 4.14 | turn-attempt-journal.ts:443 `readFile(...).catch(() => '')`; :651 whole-parse `catch → undefined` | An unreadable rotated file reads as empty history. Corrupt lines are counted (`journal_corrupt_line`), but a read error is not | design | Distinguish ENOENT from other errors; log the latter | +2 |
| 4.15 | runner.ts:623 `buddy-turn-complete` emits `content ?? ''` | A turn with no assistant text reports success with an empty reply | design | Emit `{t:'text',…}\|{t:'no_reply'}` | +2 |
| 4.16 | creation-service.ts:81-85 and ingest/runtimes.ts:88-91 | `currentSession?.provider === config.provider ? currentSession : undefined` (the same rule, written twice) silently discards a binding whose provider differs | design | One `resumableSession(record)` helper next to the record type | −4 |

---

## 5. Duplicate representations of one fact

| # | Fact | Where it is held | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 5.1 | Run state | `Conversation.isRunning`, `isStreaming` (with an INVARIANT comment, runtime.ts:251), `process !== null`, `hasActiveProcess()`, `policyHost.hasProcess`, `_sendingFromQueue`, `_publishedRun`; `runState()` derives the wire value. Busy checks use different subsets: `process \|\| isRunning` (:479,779), `process \|\| isRunning \|\| queue` (:427), and `canChangeProvider` adds `isStreaming` | design (bug magnet) | `run: RunPhase = {t:'idle'} \| {t:'running', child, streaming:boolean}` owned by the runner; `runState()` reads it; one `isBusy()` | −25 |
| 5.2 | Session started | `_hasStartedSession` + `sessionId` + record `currentSession` + record `sessionBindings` (which may or may not contain currentSession: `summaryOf` merges both, conversation-list.ts:167-170) | design | Record: `sessions: Binding[]` plus `current: index \| null`, or guarantee `currentSession ∈ sessionBindings` in Rust. Runtime: the `SessionState` sum (4.6) | −10 |
| 5.3 | Config | `Conversation.config/configRevision/configResolution` mirror record `config/configRevision/lastResolvedConfig`. "resolved else lastResolved" is spelled twice (runtime.ts:815-819, conversation-routes.ts:386-389). `lastResolvedConfig` is a derived value that is stored | design | Keep the `ConversationConfigState` object whole on the runtime (`this.configState`) and export `effectiveResolved(state)` from shared | −12 |
| 5.4 | Ingest booted | `IngestSlot` (instance.ts), `conversationList \| null`, `bootedIngest \| null`, `listReady`/`resolveListReady` (server.ts:204-209), `initialLoadComplete` + `isInitialLoadComplete()` | design | One `BootSlot` sum `{t:'starting'} \| {t:'ready', ingest, list}` with a `ready` promise | −15 |
| 5.5 | Tombstone | record `status:'deleted'` **and** `deletedAt?` (shared conversation-config.ts:275,284) | design | `lifecycle: {t:'active'} \| {t:'deleted', at}` | ±0 (+ Rust) |
| 5.6 | Done flag | record `done` and `Conversation.done` ("mirror", runtime.ts:263), written in the WS handler (conversation-websocket.ts:274) | cosmetic | Acceptable as a mirror; route it through one `conversation.setDone(record)` so the patch and the mirror cannot drift | ±0 |
| 5.7 | Fork lineage / swarm prefix | `record.creation.resumedFromConversationId` **and** `SessionRow.resumedFromConversationId`; `creation.swarmDebugPrefix` **and** `SessionRow.swarmDebugPrefix`. Hydration picks record-else-transcript (runtimes.ts:112-114), while the list row reads **only the transcript** (conversation-list.ts:155) | **bug-risk** (list and runtime rows disagree for an app-created fork) | One source: the record for app-created conversations; the transcript only in κ (discovery) | −3 |
| 5.8 | Row label | TS `conversationLabel` (runtime.ts:932) re-implements the crate's `markers.rs label` rule (acknowledged in its comment) | design | The addon exports `label(title, firstUserText)`; call it | −15 |
| 5.9 | Record summary | Rust `listSummaries` and TS `summaryOf` (conversation-list.ts:166-188) build the same projection | design | The addon returns a summary from `get`/`findBySession` too | −20 |
| 5.10 | Session and conversation alias tables | `sessions` (alias/known/deleted), `externalActivity` keyed by **both** sessionId and conversationId (conversation-websocket.ts:397), `completionSuppression` likewise. Delete cleans five structures inline (:236-259) | design | Key activity/suppression by conversationId only (resolve the session once at ingest), and add `sessions.forget(conversation)` | −15 |
| 5.11 | Provider-change rule | `applyConversationConfigPatch` (config-service.ts:103-118) and `Conversation.canChangeProvider()` (runtime.ts:840, dead: §6) | design | Delete the latter | −10 |
| 5.12 | Attempt timestamps | `TurnAttemptSnapshot.stateTimestamps` (Partial record) **and** `startedAt?`/`terminalAt?`, plus `state` with `terminalCause?` (observability/types.ts:85-98) | design | A snapshot sum by state (`{state:'running', startedAt}`, `{state:terminal, cause, terminalAt}`) and drop the partial map, or the reverse | −10 |
| 5.13 | Context budget | `ContextBreakdownResponse.budgetTokens` "alias of contextWindow.tokens … for older clients" (conversation-routes.ts:61). The client ships with the server, so there are no older clients. `compaction.detected` is always `true` when the object is non-null (:268) | cosmetic | Drop both fields, and move the response schema to shared so the client copy dies | −8 (+ client −40) |
| 5.14 | Two JSONL journals | `ErrorJournal` (493 lines) and `TurnAttemptJournal` (835 lines) each implement append, terminator repair, rotation, reload-from-disk, `isRecord` and hand-written parsers | design | One `JsonlLog<E>(schema)` (zod-parsed) under both | −250 |

---

## 6. Dead or pass-through code (each verified at HEAD with `git grep`)

| # | Item | Evidence | Sev | Fix | Δ |
|---|---|---|---|---|---|
| 6.1 | `Conversation.canChangeProvider()` runtime.ts:840-848 | Only the definition exists at HEAD (server/client/shared) | cosmetic | Delete | −9 |
| 6.2 | `/api/models` and `/api/audit` (http/core-routes.ts:7-25); `providers/index.ts` (`Provider` interface, `getProvider`, `providers`) | No client/tools/shared caller of either route. `getProvider`'s not-found branch is unreachable (typed `Record`). Its other users are server.ts:659 (palette provider validation) and server.ts:667 (provider name list), which `ProviderSchema.parse` / `ProviderSchema.options` replace. `auditLocalAgents()` runs at every startup (server.ts:751) only to feed `/api/audit` | design | Delete providers/index.ts, both routes and the startup audit wiring | −75 (plus audit.ts, out of scope) |
| 6.3 | `Conversation.sendMessage()` runtime.ts:435 | No production caller (all input is enqueue/interrupt); 22 uses in conversation-runtime.test.ts plus 1 in buddies-v2.test.ts | design | Tests use `enqueueMessage`; delete the method | −4 |
| 6.4 | `ConversationRuntime = Conversation` alias (runtime.ts:203) and `ConversationConstructor` | Pure renames | cosmetic | Use `Conversation` | −3 |
| 6.5 | `createJournalTurnAttemptObserver` (observability/runtime-observer.ts, 64 lines) | Pure forwarding from `RuntimeTurnAttemptObserver` to `TurnAttemptJournal` plus `.catch(log)` | design | `TurnAttemptJournal` implements the observer interface itself | −45 |
| 6.6 | `NOOP_TURN_ATTEMPT_OBSERVER`, `OVERLAY_ONLY_HISTORY`, `executeTurn?`, `turnAttempts?`, `history?`, `persistSessionUsage?`, `logger?`, `isBuddyArchived?` optional ports | Test-seam optionality in production types: production always wires them, and a missed wire silently no-ops | design | Required ports; tests pass the no-ops explicitly | −10 |
| 6.7 | config-records.ts:224 orphan doc comment "Replace a legacy (session-id) conversation id…" | Its method (`rekey`) was removed; the addon still exports `RekeyOutcome` | cosmetic | Delete the comment (and the napi export, in crates) | −1 |
| 6.8 | `conversations/record-migration.ts` (385 lines) | One-shot v1→v2 CLI, imported only by server/test/record-migration.test.ts and referenced by `unimportedMessage`. After the live swap it is migration residue | design | Per the delete-and-migrate pattern, delete it once the owner confirms that no un-imported data dirs remain; keep the `unimported` boot refusal pointing at a git SHA | −385 (−test) |
| 6.9 | Duplicate helpers | `formatLogPreview` (runtime.ts:155, conversation-websocket.ts:457), `errorMessage` (conversation-websocket.ts:461 plus 2 in swarm/), `isRecord` (both journals), 3× `ToolUseEvent` alias | cosmetic | One `server/src/util/text.ts` | −15 |
| 6.10 | `waitForTurnDrain()` (runtime.ts:810) | Forwards to `runner.drain()`; used by buddies/channels.ts:718 | cosmetic | Keep (it is a legitimate port); listed for completeness | 0 |

---

## 7. Server-side data model

### 7.1 `ConversationRecord` (shared/src/conversation-config.ts:267-293, stored by the Rust records crate)

| Field | Issue | Proposed shape |
|---|---|---|
| `status: 'active'\|'deleted'` + `deletedAt?` | One fact in two fields (5.5) | `lifecycle: {t:'active'} \| {t:'deleted', at}` |
| `sessionBindings[]` + `currentSession?` | The current binding may sit outside the array (readers merge both, conversation-list.ts:167); the provider-mismatch drop rule is repeated twice (4.16) | Invariant enforced in Rust: `current ∈ bindings`; one `resumableSession()` |
| `creation?` with 9 optional fields | Holds three unrelated things: idempotency (`commandId`, `fingerprint`), lineage (`branch`, `resumedFromConversationId`, `swarmDebugPrefix`) and a **delivery state machine** (`initialMessage`, `…ClaimedAt`, `…ClaimToken`, `…DispatchedAt`) | `creation: {commandId, fingerprint} \| {t:'discovered'}`; lineage in its own `origin` sum; `initialDispatch: {t:'none'} \| {t:'pending', message, origin} \| {t:'claimed', message, origin, token, at} \| {t:'dispatched', at}` (7.3) |
| `workingDirectory?` | Optional at rest, yet the runtime requires one (4.5); listing counts `no_cwd` separately | Required for app-created records; discovered ones without a cwd are never records (they are already `no_cwd` listings) |
| `lastResolvedConfig?` | A derived value that is stored (5.3); needed only as the fallback when the catalog makes the config unavailable | Keep, but name it `lastKnownGood` and document that it is a cache; never read it when `resolution` is `resolved` |
| `provenance: 'user'\|'legacy_inferred'\|'external_discovered'` | `legacy_inferred` is residue of the v1 migration; `createOrReplay` defaults it to `'user'` (config-service.ts:168, `input.provenance ?? 'user'`) | Required at the call site; drop `legacy_inferred` once no rows carry it (a one-line SQL count) |
| `recordRevision` + `configRevision` | Two CAS counters with different scope. Legitimate, documented at shared :286 | keep |
| `done: boolean` (default false) | Fine; absence has a meaning | keep |
| `kind` | Canonical, good. The only smell is the napi duplicate type (§1) | Generate the TS type from one source (zod → napi or napi → zod) |

### 7.2 Ingest tables the server reads (via `RecordSummary`, `SessionRow`, crates/unleashd-ingest/index.d.ts:277,364)

- `SessionRow.observedModel?` has the comment "`null` = none recorded (the TS `'unknown'` sentinel)". The sentinel naming leaks across the boundary. Name it `model: {t:'named',id} | {t:'unrecorded'}`, or accept `?` since absence is the meaning.
- `SessionRow.label` (crate-computed) vs TS `conversationLabel`: rule duplicated (5.8).
- `SessionRow.parentSessionId?` becomes `row.parent`, which mixes id spaces (4.10).
- `SessionRow.swarmDebugPrefix?` and `resumedFromConversationId?` duplicate record fields (5.7).
- `SessionRow.identity` is a sum (good) and the only transcript-derived classification (server.ts:229-238).
- `RecordSummary` duplicates the TS `summaryOf` (5.9).

### 7.3 Initial-message dispatch is the worst nullable cluster

The delivery state lives in 4 optional record fields plus 2 in-memory maps (`dispatchOptions` and `dispatchRetryTimers`,
buddy-creation-service.ts:87-88), and the code infers state from which fields are present (:130-135). It also dedupes
by **content equality** against the visible history (:142-144), so a user who retypes the same first message sees it
dropped. Fix: the `initialDispatch` sum above, with `origin` persisted, and dedupe by `inputId` instead of text.
Severity: **bug-risk**. Δ about −20 TS (+ Rust).

---

## Top 5 recommendations (ranked by payload / cost)

1. **Make turn provenance and cwd non-optional (2.3, 2.5, 4.2, 4.5, 4.1).** `input: TurnInput` becomes required on
   `enqueueMessage`/`interruptAndSend`, the origin is persisted with the initial message, `workingDirectory: string` is
   required in `ConversationOptions`, and a fork source is materialized before its kind is read (or the fork is
   rejected). Cost: about 1 hour, roughly +15/−15 lines. Payoff: closes four silent paths where a turn loses owner
   authority, runs in the server's cwd, or turns a Buddy fork into a chat.
2. **Collapse run state into one sum owned by the runner (5.1, 4.7, 4.8, 3.1-lite).** Replace `isRunning`/`isStreaming`/
   `process`/`_sendingFromQueue` and the runner's ~12 nullable per-turn fields (`stopTurn`, `activeAttemptId`, `sealed`,
   `stopCause`, `completedCleanly`, `subAgentFold`, …, runner.ts:121-150) with
   `phase: {t:'idle'} | {t:'running', turn: ActiveTurn}`, where `ActiveTurn` holds the attempt id, child, fold, wait and
   seal. Cost: a medium refactor behind the existing conversation-runtime tests. Δ about −60. Payoff: removes the
   INVARIANT comment and the fabricated attempt id, and gives one `isBusy()`.
3. **One JSONL log primitive under both journals, zod-parsed (5.14, 6.5, 4.14).** Cost: medium, and mechanical with
   good tests. Δ about −300 lines, the largest cut in the area.
4. **Delete the dead and pass-through surface (6.1-6.4, 6.6-6.9).** Remove `canChangeProvider`, `/api/models`,
   `/api/audit` and providers/index.ts, `sendMessage`, the aliases, the orphan comment and the duplicate helpers.
   After owner sign-off, also delete record-migration.ts. Cost: under 1 hour. Δ about −125, or about −510 with the
   migration.
5. **Split Buddy-only control out of `TurnPolicy`, and make the initial-dispatch state a sum (3.1, 3.2, 7.3, 2.4).**
   `TurnPolicy` keeps the turn hooks and `BuddyControl` takes coordination/automation. `initialDispatch` becomes
   `none | pending | claimed | dispatched`, carrying its origin and deduped by `inputId`. Cost: medium, and it touches
   the Rust records crate and buddies/turn-policy.ts. Δ about −60 TS. Payoff: removes the throw-stubs, the double kind
   check and the content-equality dedupe bug.

Runners-up: persisted-state zod plus an awaited write (4.12, small and bug-risk); surface `persistCurrentSession` and
`resolveBuddyConversation` failures instead of swallowing them (4.3, 4.4); the typed `row.parent` (4.10); move
`ContextBreakdownResponse` to shared (5.13).
