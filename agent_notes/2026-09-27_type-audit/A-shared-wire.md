# A. Shared types and the wire contract: type audit (main 03fc931)

This is a read-only audit. Its scope is `shared/src/*` (2,186 lines in 13 files, not counting `generated/`) and the server and client code that consumes those files. It checks the code against the "One Clean Path" rules in `~/.claude/CLAUDE.md` and against the protocol v3 rules in `AGENTS.md`.

Severity levels: **bug-risk** means it can misbehave today or drift silently, **design** means it breaks a rule, and **cosmetic** means naming or noise only. Δ is the estimated net line change of the fix.

Method: I listed every export with `rg` on single files. I counted importers with `git grep -l -w` over `server/src client/src tools crates vendor/agent-cli-tool/src` (src) and `server/test client/test` (test). `git grep` is not rewritten by rtk. Every dead-export candidate was then re-checked against its own file.

---

## 1. Inventory

**Counts.** There are 208 export declarations, which cover 205 unique names:

| Kind | Count |
|---|---|
| `export const` | 99 |
| `export type` | 70 |
| `export function` | 30 |
| `export interface` | 9 |
| Names ending in `Schema` | 76 |

Per file:

| File | Exports |
|---|---|
| index.ts | 66 |
| conversation-config.ts | 50 |
| conversation.ts | 33 |
| provider-catalog.ts | 14 |
| buddy.ts | 13 |
| upstream.ts | 12 |
| buddy-channel-posts.ts | 6 |
| buddy-team-configuration.ts | 5 |
| buddy-team.ts | 3 |
| buddy-workspace-activity.ts | 2 |
| harness-retry.ts | 2 |
| buddy-knowledge-scope.ts | 1 |
| buddy-team-configuration-result.ts | 1 |

There are also 14 re-exports:
- `index.ts:36-43`: 8 names, all already covered by `export *` at :30.
- `index.ts:82-83`: 2 names.
- `index.ts:709-714`: 4 Oompa types.

**Who imports them:**
- 114 names have a src importer.
- 4 are imported only by tests: `BuddyBuilderProject`, `BuddyBuilderResult`, `ConversationRowSchema`, `MessageSchema`.
- 87 have no importer outside `shared` (section 5).

### Notable exports and whether they are canonical

| Export | Where | Canonical? |
|---|---|---|
| `ConversationKindSchema` + `matchConversationKind` | conversation-config.ts:172-218 | **Yes.** A true sum type with an exhaustive thin dispatcher. However, only 2 src files use the dispatcher, and 31 inline `kind.t ===` checks bypass it (section 4). |
| `ConversationConfigSchema`, `ModelSelection`, `ReasoningSelection`, `ConversationConfigPatchSchema`, `ConfigResolutionSchema` | conversation-config.ts:16-95 | **Yes.** These are good named sums: default / disabled / explicit. |
| `ConversationRowSchema` / `ConversationDetailSchema` / `MessagePageSchema` / `RowPatchSchema` | conversation.ts:126-208 | **Mostly.** `RowPatch` is a clean sum, and `applyRowPatch`/`applyDetailPatch` are exhaustive. Two gaps: `swarmDebugPrefix` is nullable but only applies to chats (:165), and `Message` has co-optional fields (section 3). |
| `RowKindSchema`, `WireRowKindSchema`, `CreateKindSchema`, `ConversationKindSchema` | conv.ts:76, 217, 112 / conv-config.ts:172 | These are four kind unions. RowKind and CreateKind are legitimate projections. The `worker` variant, however, is written out three times (section 2). |
| `ServerMessageSchema` / `ClientMessageSchema` | index.ts:640 / :470 | **Yes.** Both are discriminated unions. Two gaps: the uncorrelated commands have no `commandId`, which forces a catch-all `error` frame (section 4), and `message_complete.reason` is optional (section 3). |
| `ServerFrame`, `SocketClose`, `classifyServerFrame`, `classifySocketClose` | index.ts:543-706 | **Yes.** These are typed skew handling, which is a good example of the rules. |
| `ProviderSchema`, `ProviderCatalogSchema`, `ModelDefinitionSchema` | provider-catalog.ts | **Yes.** Invariants are checked in `superRefine` at the boundary. |
| `ClaudeModelSchema`, `CodexModelSchema`, `GeminiModelSchema`, `CursorModelSchema`, `MuseModelSchema`, `OpenCodeModelSchema`, `isModelIdValidForProvider`, `isEffortValidForProvider` | index.ts:111-262 | **No.** This is a second model- and effort-validity authority beside `ProviderCatalog` and `resolveConversationConfig` (section 2). |
| `BuddyContextSchema` | conversation-config.ts:141-157 | **No.** It is a bag of 7 `nullish` fields with a hidden "origin" sum inside it (section 3). |
| `PersistedConversationConfigRecordSchema`, `ConversationCreationMetadataSchema` | conversation-config.ts:250-294 | **No.** 9 optional creation fields plus the pair `status` + `deletedAt?`. Hidden state machines (section 3). |
| `OompaRuntime*`, `SwarmRun*`, `SwarmReviewLog` | index.ts:300-392 | **No.** Hand-written interfaces with no schema, which duplicate `generated/oompa-types.ts`. This includes a live field mismatch (section 2, D1). |
| `BuddyBuilder*`, `BuddyTeam*`, `TeamSetup*`, `format*ToolResult` | buddy.ts, buddy-team*.ts | **Legacy.** The server no longer produces these payloads (section 5). |
| `UpstreamCheckSchema` / `UpstreamCheckStateSchema` / `UnleashdHomeStateSchema` | upstream.ts | **Yes.** Clean named sums. |

---

## 2. Duplicate representations of one fact

| # | Finding | Severity | Fix | Δ |
|---|---|---|---|---|
| D1 | **Swarm review log is typed two ways for one endpoint.** `GET /api/swarm-reviews` returns `OompaReviewLog[]` (server/src/swarm/routes.ts:131). `OompaReviewLog` is generated from the oompa schema, which requires `cycle` (`generated/oompa-types.ts:43-65`; `oompa_loompas/schemas/review.schema.json:7`). `SwarmDetailPanels.tsx:185` reads it with that type. `SwarmAnalytics.tsx:69` casts the same endpoint to the hand-written `SwarmReviewLog` (index.ts:377-385), which has `iteration`, `verdict: string` and `output: string`. `swarmAnalyticsParsers.ts:113-116` then groups on `review.iteration`, which is `undefined` for real files. The likely result is that analytics timelines never show a review. The same call also swallows failures with `json.reviews ?? []` and `.catch(() => [])`. | **bug-risk** | Delete `SwarmReviewLog` and use `OompaReviewLog` (key on `cycle`). Delete `SwarmRunLog`/`SwarmRunWorker`/`SwarmRunSummary` in favour of generated types, or add them to the generator. | −50 |
| D2 | **Streaming frames are hand-copied on the server.** `TurnBroadcast` (server/src/turns/runner.ts:109-118) is commented "not (yet) part of the shared ServerMessage schema", yet `chunk`/`message_complete`/`message` are all in shared (index.ts:616-633). | design | Type it as `Extract<ServerMessageInput, {type:'chunk'\|'message_complete'\|'message'}>`. | −8 |
| D3 | **`CompletionReason` is written out 3 times:** agent-cli `runtime-types.ts:45`, shared `conversation.ts:36`, and `index.ts:632`. `SubAgentStatus` has 2 copies (`runtime-types.ts:46`, `conversation.ts:40`). Message role `'user'\|'assistant'\|'system'` has 4 copies (conversation.ts:30, index.ts:619, runner.ts:116, search-routes.ts:12). | design | Define `CompletionReasonSchema`/`MessageRoleSchema` once in shared and reuse them. Have agent-cli's union checked against the shared one, or the reverse. | −6 |
| D4 | **Turn-attempt HTTP payload is duplicated by hand.** The client's `TurnAttemptSnapshotLike` (client/src/utils/turn-diagnostics.ts:57-80) re-lists the server's `TURN_TERMINAL_CAUSES`/attempt states (server/src/observability/types.ts:15-40). The client checks it with the hand-written `isAttempt` guard (useTurnDiagnostics.ts:112-135) and gets it through `usePolledFetch<…>` (useBuddyData.ts:103) with no schema. | **bug-risk** (silent drift) | Move a `TurnAttemptSnapshotSchema` to shared, have the server build that type, and have the client parse it. Delete the guard. | −40 |
| D5 | **Channel response types are defined twice:** `ThreadSeat`, `MentionDispatch` and `ChannelResponse` exist in server/src/buddies/channels.ts:84-95 and again in client/src/components/buddies/types.ts:89-117. `ThreadPage`, `PostResult` and `BuddyDetail` are client-only descriptions of server responses. About 30 of the 45 `usePolledFetch<T>` sites cast unparsed JSON. | design | Move the route response types into `shared/src/buddy-routes.ts`. The server imports them. The client parses them, or at least imports the same types. | −25 |
| D6 | **Two model-validity authorities.** The first is static per-provider schemas plus `isModelIdValidForProvider`/`isEffortValidForProvider`/`EFFORT_LEVELS_BY_PROVIDER` (index.ts:111-262). The second is `ProviderCatalog` + `resolveConversationConfig` (conversation-config.ts:348). Both come from `generated/catalog.ts`. `catalog-service.ts:84` even uses the first to gate the second. There is also a hard-coded `defaultModelId: provider === 'codex' ? 'gpt-6-sol'` at `catalog-service.ts:31`, which overrides the generated default and is a third "default model" fact. | design / bug-risk | Keep only the catalog. Validity becomes `findModelDefinition(entry, id)`, plus the OpenCode path regex for providers with `supportsDynamicModels`. Delete the 6 per-provider schemas, the Codex registry derivations and the effort tables. Move the Codex default into `catalog.jsonc`. | −110 |
| D7 | **Provider display name is stored twice:** `PROVIDER_METADATA.label/shortLabel` (provider-catalog.ts:17-24) and `ProviderCatalogEntry.displayName/shortName`. `catalog-service.ts:27-28` copies one into the other. | cosmetic | Keep one of them. The catalog entry is the natural owner, with `cssClass` taken from `id`. | −15 |
| D8 | **The `worker` kind variant is written 3 times:** conversation-config.ts:185-190, conversation.ts:85-90, and conversation.ts:221-226. | cosmetic | Define `WorkerKindSchema` once and reuse it. | −10 |
| D9 | **"Last resolved config" is stored twice:** `ConfigResolution.unavailable.lastResolved?` (conversation-config.ts:85) and `PersistedConversationConfigRecord.lastResolvedConfig?` (:290). | design | Keep it on the record only, or only inside the resolution. | −3 |
| D10 | **"History replaced" has three signals:** the `rewritten` patch (conversation.ts:207), `MessagePage.epoch` (:176), and the client's `historyGeneration` counter (actions.ts:487). | design | Either carry `epoch` in the `rewritten` patch and drop the client counter, or document why all three are needed. | −10 |
| D11 | **Transcript markers are parsed in two languages.** `formatBuddyWorkerToolResult` and `parseBuddyBuilderToolResult` (buddy.ts:82-157) are reimplemented in Rust in `crates/unleashd-ingest/src/text.rs:388-505` and `parsers/codex.rs:427`. Since T13b the ingest crate serves the bodies, so the TypeScript copy only runs on live tool output, and the server no longer produces these payloads (section 5). | design | Delete the TypeScript formatters. The Rust crate stays the one parser. | −80 |
| D12 | **Two ideas of the "default provider":** `createDefaultConversationConfig(provider = 'claude')` (conversation-config.ts:299) is used as a constant by `config-options.ts:77`, while `NewConversationForm.tsx:67` uses `catalog.providers[0]?.id ?? 'claude'`. | bug-risk (the "default" badge can mislabel) | Put `defaultProvider` in `ProviderCatalog` and make the parameter required. | ±0 |

---

## 3. Accidental optionality

**Rule for this section.** AGENTS.md requires `.default()` on new server→client fields so the client survives reload skew. I tagged those as **justified**.

**Justified defaults and optional fields (keep):**
- `WireRowSchema` defaults (conversation.ts:234-243). These are wire compression: the decoded row is total.
- `ProviderCatalogEntry.supportsDynamicModels/supportsRequiredMcp.default(false)` (provider-catalog.ts:55, 60). This is HTTP skew, and `false` is the fail-closed value.
- `ModelDefinition.reasoning?` and `defaultEffort?` (:40-45). Here absence is the meaning.
- `ProviderTurnUsage.contextWindow?` (conversation-config.ts:116). Documented as "ask the model id".
- `ConversationSessionBinding.latestUsage?`. Absence means "never observed".
- `CreateConversationCommand.initialMessage?`. Absence means none.

**Accidental (fix):**

| # | Where | Problem | Severity | Fix | Δ |
|---|---|---|---|---|---|
| O1 | index.ts:632 `message_complete.reason: …optional()` | The server always sends a reason (`runner.ts:518` takes a required `CompletionReason`). The client then applies `data.reason ?? 'success'` (actions.ts:551), so an absent reason renders as success. | **bug-risk** | Make it required, with `.default('error')` if skew needs one. Never default to `success`. | ±0 |
| O2 | index.ts:616-621 `message` frame | There is no timestamp, so the client invents `new Date()` (actions.ts:530). The server has the real time. | design | Add `timestamp: z.coerce.date().default(() => new Date())` (skew-safe). Send it from the server. | +2 |
| O3 | conversation-config.ts:64-70 `ConfigError` | `provider?`, `modelId?` and `validValues?` depend on `code`. The last three codes carry none of them. | design | Make it a discriminated union on `code`, with per-code payloads. | +10 |
| O4 | index.ts:585-592 `GeneralCommandError.code: z.string()`, `details?: unknown` | The code is a free string, but the server uses a closed set: `server_draining`, `create_failed`, `conversation_not_found`, `command_failed`, `invalid_message`, `invalid_directory` (conversation-websocket.ts:140-440, websocket.ts:19). `z.union` with `ConfigError` is also ambiguous. `details` is never sent. | design | Use one `CommandErrorSchema = discriminatedUnion('code', …)` and drop `details`. | ±0 |
| O5 | conversation-config.ts:141-157 `BuddyContext` | Has 7 `.nullish()` fields, so absence has two spellings (null and undefined). `defaultBuddyVisibility` (:230-234) tests them by truthiness. The mutually exclusive `automationRunId` / `coordinationRunId` / `delegatedByBuddyId` + `parentBuddyConversationId` + `allowedBuddyOperations` are a hidden `origin` sum. | design | `origin: {t:'owner'} \| {t:'automation',runId} \| {t:'coordination',runId} \| {t:'delegated',byBuddyId,parentConversationId,allowedOps}`. Visibility then comes from `origin.t` in one dispatcher. Migrate in `record-migration.ts`. | ±0 (−10 in consumers) |
| O6 | conversation-config.ts:250-260 `ConversationCreationMetadata` | Has 9 optional fields. `initialMessageDispatchClaimedAt?`/`…ClaimToken?`/`…DispatchedAt?` encode a pending → claimed → dispatched state machine. Branch and resume lineage are mutually exclusive. | design | `initialMessage: {t:'none'} \| {t:'pending',text} \| {t:'claimed',text,token,at} \| {t:'dispatched',at}`. | ±0 |
| O7 | conversation-config.ts:275, 284 | `status: 'active'\|'deleted'` + `deletedAt?`. This is a product type standing in for a sum. | design | `lifecycle: {t:'active'} \| {t:'deleted', at}`. | ±0 |
| O8 | conversation-config.ts:275, 281, 288 | Persisted `.default('active')`, `.default(false)`, `.default(0)`. These are on-disk defaults, not wire skew. The v1 → v2 migration already rewrote every record, so they now hide malformed records. | design | Bake them in the migration and make them required. | ±0 |
| O9 | conversation.ts:34-36 `Message` | `completedAt?` + `completionReason?` are co-present on finished assistant messages only. `toolCall?` marks a different kind of message. | design | Make `Message` a sum on role/kind: `user`, `assistant{completion: {t:'streaming'} \| {t:'done',at,reason}}`, `system`, `tool`. | +5 |
| O10 | conversation.ts:49-61 `SubAgent` | `completedAt?` is only meaningful when `status ∈ {completed, error}`. `rawStatus?`/`statusSource?` are diagnostics. | design | `status` becomes a sum carrying `completedAt`. `statusSource` becomes required, because every producer knows it. | ±0 |
| O11 | conversation.ts:165, index.ts:405 `swarmDebugPrefix` | Nullable or optional on every kind, but "chat kind only". runtime.ts:333 re-checks `kind.t === 'chat'`. | design | Move it into `CreateKind{t:'chat', swarmDebugPrefix}` and into the chat variant of the kind or detail. | −3 |
| O12 | buddy.ts:44, 48-61 `BuddyBuilderResult` | Has `creationKey.default('default')`, `followUpQuestions.default([])` and 4 optional fields. | cosmetic (legacy) | Delete with D11 / section 5. | — |
| O13 | buddy-team-configuration.ts:20-23 | `.nullable().optional()` gives absence two spellings. `buddy-team.ts:20-26` `hiring?` is marked "Deprecated". | cosmetic (legacy) | Delete (section 5). | — |
| O14 | index.ts:254-262 `isEffortValidForProvider(effort: string\|null\|undefined)` | Undefined means "default" and null means "no flag". This is a tri-state that duplicates `ReasoningSelection`. | design | Delete with D6. Callers pass a `ReasoningSelection`. | −10 |

---

## 4. Stringly-typed kinds and non-exhaustive dispatch

**Exhaustiveness is good.** Every `switch` on a shared union in the wire consumers has no `default:`:
- `applyRowPatch`/`applyDetailPatch` (conversation.ts:326-377)
- `patchEffects`/`handleAck` (client/src/atoms/actions.ts:452, 496, 593)
- `useWebSocket.ts:73`
- `conversation-websocket.ts:170, 412`
- `config-service.ts:298`
- `config-records.ts:85, 186`

**Findings:**

| # | Finding | Severity | Fix | Δ |
|---|---|---|---|---|
| S1 | **Uncorrelated commands fall back to an untargeted `error` frame.** `stop_conversation`, `delete_conversation`, `set_conversation_done`, `cancel_queued_message`, `clear_queue` and `promote_queued_message` carry no `commandId` (index.ts:419-468). Their failures and parse errors therefore go out as `{type:'error'}` (conversation-websocket.ts:121, 265, 356, 443). The client's `handleError` then rejects **every** pending send (actions.ts:541-546). A failed Stop can fail an unrelated in-flight `queue_message`. | **bug-risk** | Give every `ClientMessage` a `commandId` and answer with `ack`. Delete `ErrorMessageSchema`, `sendProtocolError` and `handleError`. | −20 |
| S2 | **31 inline `kind.t === '…'` checks bypass `matchConversationKind`**, which only 2 src files use. Worst cases: `runtime.ts:369` returns `'foreground'` for non-Buddy kinds (a question asked of the wrong type), `Chat.tsx:364` computes `requiresBuddyMcp` ad hoc, and there are 3 copies of `kind.t === 'worker' ? kind.swarmId : null` (Chat.tsx:588, 636; ConversationView.tsx:427). | design | Put the kind-derived capabilities in one table or matcher: `kindTraits(kind) → {requiresBuddyMcp, swarmId, background}`. Filters such as `kind.t === 'buddy'` are fine; semantic decisions should go through the dispatcher. | −20 |
| S3 | **`isHarnessRetryFailure`/`isOutOfTokensFailure` (harness-retry.ts:5-20) classify failures by regex over post text** on both server (channels.ts:629) and client (HarnessPicker.tsx:136). `/not supported when using/` matches any prose. | **bug-risk** | Store a typed `failure: {t:'harness', cause} \| {t:'other'}` on the reply_failed post (the crate `Post` already has a `purpose`). Delete the regexes. | −20 |
| S4 | **Buddy status fields are free strings in shared** while the crate has enums (`BuddyStatus`, `TaskStatus`, `RunStatus` in crates/unleashd-buddies/index.d.ts:111, 384, 473). Examples: `BuddySummary.status`, `BuddyBuilderProject.status`, `BuddyTeamMember.status`, `ChannelReference{kind:'task'}.status` (buddy-channel-posts.ts:32), `TeamSetupResult.queuedRuns.state/inputKind`, relationship `kind`. `relationshipEffect.kind` is an enum, but `BuddyBuilderResult.relationships.kind` is a string for the same fact. | design | Import the crate types (`TaskStatus`) into shared schemas as `z.enum`. Most of these files are legacy (section 5); `ChannelReference` is the live one. | ±0 |
| S5 | **`resolveConversationConfig` (conversation-config.ts:382-412) uses an `if explicit / else if default` ladder** over `ReasoningSelection`. `disabled` is handled implicitly by falling through. | cosmetic | Use an exhaustive `switch (config.reasoning.mode)` with an explicit `disabled` arm. | ±0 |
| S6 | **`decodeRows` (conversation.ts:312-320) uses a ternary on `row.kind.t`**, next to the exhaustive `encodeKind` switch. | cosmetic | Use a symmetric switch. | +3 |
| S7 | **`createdKind` (conversation-websocket.ts:405-421)**: the fork arm quietly falls back to `?? CHAT_KIND` (documented), and the buddy arm checks `buddy` for null and throws. | design | Resolve the buddy before calling, so the arm receives a `ResolvedBuddyConversation`. Make the fork fallback typed (`{t:'orphan_fork'}` → chat, recorded as provenance). | ±0 |

---

## 5. Dead exports

These were re-verified against each file (`git grep -n -w <name> -- shared/src ':!shared/src/generated'`) after the recursive count.

**Truly dead (no reader anywhere):**
- **Codex thinking cluster, index.ts:89-109.** `CODEX_THINKING_OPTIONS`, `NO_CODEX_THINKING`, `CODEX_UNIFIED_THINKING_OPTIONS`, `CodexThinkingOption`, `CodexThinkingMode`, `CodexModelRegistryEntry` and `_codexRegistryCheck` only reference each other. Δ −20.
- **index.ts:82-83.** `PROVIDER_MODEL_CATALOG` and `CatalogProviderEntry` are re-exported, but no consumer outside shared imports them. Δ −2.
- **index.ts:36-43 re-export block** plus the matching import at :18-25. These duplicate `export * from './provider-catalog.js'` at :30. Δ −16 (cosmetic).
- **index.ts:139-151.** `CODEX_BASE_MODEL_INFOS` and `CODEX_MODEL_INFOS` are aliases of each other and only feed `CODEX_MODEL_IDS`. Δ −10, or all of it with D6.

**Dead in practice: the producer is gone.** Commit 0fef9d4 ("server v2 on the crate… delete the old stack") removed every server producer of `teamSetup`, `buddyBuilderEvent` and `buddyWorkerThread`. `git grep` over `server/src`, `crates/unleashd-buddies` and `node_modules/@nbardy` finds none; the only hits are the ingest crate's legacy parsers.
- **`buddy-team-configuration.ts` (133 lines) and `buddy-team-configuration-result.ts` (26 lines).** The only reader is `formatCommonToolResult` (server/src/turns/policy.ts:117), whose input can no longer contain `teamSetup`. The client only strips the marker (structured-message-segments.ts:24). Δ −160. Severity: design.
- **`formatBuddyWorkerToolResult`, `formatBuddyBuilderToolResult` and `parseBuddyBuilderToolResult` (buddy.ts:82-157).** The same holds, and the Rust ingest crate owns legacy transcript markers (D11). `BuddyBuilderEventSchema`/`BuddyBuilderResultSchema`/`BuddyTeamStateSchema` must stay while `BuddyBuilderResultCard.tsx` renders old markers. Δ −75.
  - Confirm on one live Buddy turn before deleting: no `buddyBuilderEvent` or `buddyWorkerThread` key in MCP output.

**Surplus `export` keyword (used only inside shared).** There are 87 such names. Most are sub-schemas composed into a bigger schema, which is fine. Removing `export` from them is cosmetic and is not worth a pass unless the file is being edited anyway.

---

## 6. Function signatures in shared

No boolean parameters and no long positional parameter lists were found.

| # | Signature | Issue | Severity | Fix |
|---|---|---|---|---|
| F1 | `createDefaultConversationConfig(provider: Provider = 'claude')` (conversation-config.ts:299) | A silent default provider. It is also used as a constant (D12). | design | Make the parameter required. |
| F2 | `buddyKind(context, visibility?: BuddyVisibility)` (:237) | An optional parameter decides the semantics (`?? defaultBuddyVisibility`). | design | Use two named functions, or derive visibility from the O5 `origin` sum and drop the parameter. |
| F3 | `resolveConversationConfig(config, catalog, lastResolved?)` (:348) / `unavailable(…, lastResolved?)` (:331) | Optional tail parameter. | cosmetic | Pass `ResolvedExecutionConfig \| null` explicitly, or drop it with D9. |
| F4 | `isModelIdValidForProvider(provider, modelId?)` (index.ts:191) | `!modelId → true`, so "no model" counts as valid. `normalizeModelId(provider, model?) → string \| undefined` (:212) forces `?? reported` at call sites (config-service.ts:476). | design | Delete with D6, or require a string in and out. |
| F5 | `isEffortValidForProvider(provider, effort: string \| null \| undefined)` (:254) and `effortLevelsForProvider` using `Partial<Record>` `?? []` (:244-252) | Tri-state input. A missing table entry and "no effort levels" read the same. | design | Delete with D6. |
| F6 | `parseBuddyBuilderToolResult(value, depth = 0)` (buddy.ts:82) | Exposes the recursion depth. | cosmetic | Use an internal helper, or delete it (section 5). |
| F7 | `classifySocketClose(code, reason)` (index.ts:548) | `Number(reason.replace('protocol ',''))` can produce NaN, which is classified as `skew` with `serverVersion: NaN` and triggers a reconnect loop. | bug-risk (low) | Parse with `z.coerce.number().int()` and return `{t:'dropped'}` when it fails. |

---

## Top 5 recommendations (payload vs cost)

1. **Delete the dead Buddy-result and Codex surface.**
   - What: `buddy-team-configuration*.ts`, the three TypeScript tool-result formatters in buddy.ts, the Codex thinking cluster, and the redundant re-exports.
   - Payload: about −280 lines, no behaviour change.
   - Cost: low. One live-turn check that no MCP output carries these keys, and one legacy-transcript render check.
2. **Fix D1: the swarm review log type.**
   - What: use the generated `OompaReviewLog` everywhere, key on `cycle`, and delete the hand-written `Swarm*` interfaces.
   - Payload: fixes a likely live bug (analytics reviews never attach) and −50 lines.
   - Cost: low.
3. **Correlate every client command (S1) and delete the `error` frame.**
   - Payload: removes a cross-command failure bug (a failed Stop rejects unrelated sends) and −20 lines.
   - Cost: low to medium. This is a protocol change inside v3: add `commandId` with `.default` for skew on the server side, and make the client always send it.
4. **Make one model-validity authority (D6, O14, F4, F5).**
   - What: delete the static per-provider schemas and effort tables in index.ts, validate through `ProviderCatalog`, and move the Codex default into `catalog.jsonc`.
   - Payload: about −110 lines, and one fewer place for default and validity to disagree.
   - Cost: medium. `config-service.ts:462-495` legacy session evidence and `catalog-service.ts:84` need re-pointing. Tests exist.
5. **Shared route and response schemas for the HTTP payloads the client hand-types (D4, D5), plus `message_complete.reason` required (O1).**
   - Payload: removes about 65 lines of client/server duplicates and the hand-written `isAttempt` guard, and stops an absent completion reason from rendering as success.
   - Cost: medium. It touches about 10 client call sites. Do O1 alone first, because it is a one-line change.

**Next tier:** the `origin` sum for `BuddyContext` (O5) and the creation and lifecycle sums (O6, O7). These are the biggest style wins but need a record migration, so they belong in a later wave.
