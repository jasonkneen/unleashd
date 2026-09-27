# E. Client type audit (main 03fc931)

Read-only audit of `client/src` (atoms, views, components/buddies, mobile, swarm boundary, hooks, utils).
Severity: **bug-risk**, **design** or **cosmetic**. Deltas are net line estimates.
Method: single-file `grep` and `sed` for every citation. Recursive counts came from small node scripts
that read the files directly (no rtk rewriting), kept in the session scratchpad. Import-graph
ownership was computed from `main.tsx`, following static imports, `import()` and `new URL()`.

Overall: the core store (`atoms/conversations.ts`) is in good shape. It has one index, typed
`Transcript`/`ServerState`/`Command` sums, exhaustive switches and no `default:` anywhere in the
client. The WS dispatcher (`atoms/actions.ts:593-630`, patch switch at `:452`) is thin and exhaustive.
The debt sits at the edges: HTTP responses are cast rather than parsed, server rules and defaults
are re-derived in the UI, and the mobile channel tree duplicates the desktop one.

## 1. State model

Exported atoms and families: **22 atoms/families plus 1 zustand store**.
- `atoms/conversations.ts`: 7 atoms (`connectionAtom` :88, `rowsAtom`/`rowFamily` :137/:139,
  `listIndexAtom` :147, `childRowsFamily` :173, `transcriptFamily` :213, `streamFamily` :242,
  `groupsFamily` :271, `commandsAtom` :334, `unreadFamily` :371), plus `commandFor` :342.
- `buddy-background.ts`: 4. `buddy-sidebar.ts`: 2. `ui.ts`: 3. `search.ts`: 2.
- `buddy-visibility.ts`, `channel-outbox.ts`, `resources.ts`, `restart-recovery.ts`: 1 each.
- `mobile/atoms/buddies.ts:18`: an atom factory.
- `stores/settingsStore.ts:257`: a zustand store.

| Atom | Verdict |
|---|---|
| connectionAtom, rowStore/rowFamily, transcriptStore, streamStore, commandsAtom | The one home. Canonical sums, clean. |
| listIndexAtom, listField, childRowsFamily, groupsFamily, unreadFamily, commandFor, searchMatchesFamily | Derived, never stored. Good. |
| prefsAtom, seenAtom, upstreamHandledShaAtom (ui.ts:91/99/177), channelOutboxAtom, searchQueryAtom, restartRecoveryAtomFamily | Device-local facts, one home each. Good. |
| resourceAtomFamily (resources.ts:53) | The home of HTTP data, but untyped (see E-1.3). |
| **buddySidebarOverviewAtom** (buddy-sidebar.ts:43) | **A copy of the resource cache.** |
| **archivedBuddyIdsAtom** (buddy-visibility.ts:4) | **A second home of "archived".** |
| **buddyBackgroundWorkersAtomFamily** (buddy-background.ts:197) | **Three homes of ConversationDetail, merged by precedence.** |
| mobileBuddyDirectoryAtom (mobile/atoms/buddies.ts:18) | A re-derivation that is also done in BuddyDirectory.tsx:24-26. |
| useSettingsStore (stores/settingsStore.ts:257) | **A second state library** with a raw fetch. |

**E-1.1 [design] `buddySidebarOverviewAtom` copies server state.**
- `Sidebar.tsx:92-96` reads `useBuddyOverview(30_000)` (already cached in `resourceAtomFamily`),
  then `useEffect`-pushes it into `buddySidebarOverviewAtom`.
- `buddySidebarAtom` (buddy-sidebar.ts:243-245) reads the copy. The Sidebar must be mounted for it
  to fill, and on first paint it is one render behind.
- Fix: have `buddySidebarAtom` read `resourceAtomFamily(BUDDY_OVERVIEW_URL)` directly (`valueOf`),
  and delete the atom plus the effect.
- Delta: about -10.

**E-1.2 [design] "Archived Buddy" has two homes.**
- The server sends `archivedBuddyIds` in `hello` (actions.ts:369), and `hideArchivedBuddy`
  (buddy-visibility.ts:5) adds to it locally.
- The overview's `Buddy.status` also carries `'archived'`. `BuddyBuilderResultCard.tsx:101,119`
  checks both (`status === 'archived' || archived.has(id)`).
- `BuddyDirectory.tsx:24-26` and `mobile/atoms/buddies.ts:20-23` check only the set.
- Fix: keep the set as the one source and drop the `status` checks, or keep `status` and drop the
  set. Either way, filter once in a shared `visibleDirectory` derived atom used by both trees.
- Delta: about -25.

**E-1.3 [bug-risk] The resource cache is untyped, so every read is a cast.**
- `resourceAtomFamily(key: string)` holds `ResourceEntry<unknown>`.
- Readers cast, for example `as ResourceEntry<WorkerDetailSnapshot>` at buddy-background.ts:161-163,
  :183-185, :204-206 and :212.
- `usePolledFetch.ts:41` returns `(await response.json()) as T`. No HTTP response read through the
  cache is parsed, so every hand-written envelope in `components/buddies/types.ts:52-117` is trusted
  blindly.
- Only some routes parse: `useProviderCatalog.ts:24`, buddy-background.ts:179 and `UpstreamUpdatePrompt.tsx:27`.
- Fix: make `Resource<T>` carry a `schema: ZodType<T>` and parse inside `loadResource`. Key the
  atom by the `Resource<T>` object (`resourceAtom(resource)`) so `T` flows and the casts go.
- Delta: about +30 / -15. It removes a whole class of silent shape drift.

**E-1.4 [design] Worker details are held three times.**
- `buddyBackgroundWorkersAtomFamily` (buddy-background.ts:197-221) merges three sources: a history
  resource, a per-worker `detailKey` resource, and the live `transcriptFamily` detail.
- The loader fetches the full `ConversationDetail` per worker, 4 at a time (:154-190), to project a
  status list.
- Fix: a server route that returns `BuddyBackgroundWorker[]` directly (the projection in
  `projectBuddyWorkers`, :82). The client then reads one resource and `transcriptFamily` is not consulted.
- Delta: client about -120, server about +40.

**E-1.5 [design] Zustand settings store beside jotai.**
- `stores/settingsStore.ts:257-366` uses bare `fetch().then(res => res.json())` at :270-271, which
  violates the AGENTS `usePolledFetch` rule. The JSON is unparsed.
- Silent fallback at :276-300: a palette key that does not resolve is replaced by `solarized` and
  **POSTed back to the server**. A `/api/custom-palettes` response that is an error object is
  accepted as the palette map (the check at :276 is only `typeof === 'object'`). A transient failure
  therefore overwrites the user's saved custom palette.
- Fix: two `resource()` entries plus a derived `paletteAtom`, drop zustand from `client/package.json:33`,
  and never write a default back.
- Delta: about -60, plus one dependency removed.

**E-1.6 [design] A server rule re-derived in the UI, differently in each tree.**
- `Chat.tsx:205-210` derives `canChangeHarness` from `messageCount === 0 && queue empty && !running`.
- The server's rule is `hasStartedSession` / `isRunning` / `queueDepth` (server/src/conversations/config-service.ts:109-123).
- `Chat.tsx:364,487-491` enforces a Buddy-MCP provider filter client-side only.
- Mobile `ConversationView.tsx:488-500` passes neither the lock nor the filter. Mobile can therefore
  offer a provider switch the server rejects, and can pick a provider without the required MCP.
  No server-side MCP check was found under `server/src/conversations` in this pass.
- Fix: send `providerLocked: boolean` and the allowed-provider set in `ConversationDetail.config`
  (the server already computes both), and have one `ConfigOverlay` read them in both trees.
- Delta: about -20 client, +10 shared/server.

## 2. Types

**E-2.1 [bug-risk] Hand-mirrored server types (no shared schema).**
- `utils/turn-diagnostics.ts:57-106`: `TurnAttemptSnapshotLike` copies the server's turn-attempt
  snapshot (`server/src/observability/types.ts:22-42`), cause list included, with
  `Date | string | number` on every timestamp. That is accidental optionality from never parsing.
- `utils/turn-diagnostics.ts:9`: declares a *different* `TurnTerminalCause` under the same name as
  the server's type.
- `ContextBreakdownMeter.tsx:4-40`: `ContextBreakdownSection`, `ContextWindow` and
  `ContextBreakdownData` copy `server/src/http/conversation-routes.ts:43` and
  `server/src/conversations/context-window.ts:4`.
- `components/buddies/types.ts:89,100,115`: `ThreadSeat`, `ChannelResponse` and `MentionDispatch`
  copy `server/src/buddies/channels.ts:84-89`.
- Fix: move these schemas to `shared/` and parse at the fetch (see E-1.3). Delete the client copies.
- Delta: about -110 client, +60 shared.

**E-2.2 [design] Nested ternary over a union where a table belongs.**
- `turn-diagnostics.ts:127-145` classifies 15 terminal causes by `===` chains.
- A new cause added on the server silently falls to `interrupted`/`null`.
- Fix: `const CAUSE_CLASS: Record<TurnTerminalCause, 'error'|'restart'|'interrupted'|'completed'>`,
  which is exhaustive by type.
- Delta: about -5.

**E-2.3 [cosmetic] Name collision on `CreateKind`.**
- `views/new-conversation/create.ts:16` defines `CreateKind = 'chat' | 'swarm'`.
- The shared `CreateKind` (`shared/src/conversation.ts:117`) is the discriminated union used by
  `atoms/conversations.ts:6`.
- Fix: rename the client one to `NewConversationKind`. Delta: 0.

**E-2.4 [design] Booleans that are really variants (T20).**
- `ConversationConfigPicker.tsx:13-16`: `disabled`, `providerDisabled` and `showProvider` form 8
  combinations, of which about 3 are meaningful. `showProvider` is **never passed by any caller**
  (it defaults to true at :37), so it is dead.
- Fix: `lock: 'none' | 'provider' | 'all'` and delete `showProvider`.
- `TranscriptGroup.tsx:122`: `collapseTools?: boolean`, forced `false` at :312. It should be part
  of a `presentation` value.
- Delta: about -8.

Stringly-typed kinds: none of note. Status and tag strings compare against Zod-inferred unions,
so a typo fails `tsc`. Non-exhaustive switches: none. `default:` appears only in `lazy()` objects.

## 3. Props and function signatures

**E-3.1 [design] `VirtualizedMessageListProps`** (VirtualizedMessageList.tsx:22-36): 13 props, 5 optional.
- `isRunning` plus `isTurnActive?` are two booleans for one fact ("owning turn active", per the
  comment at :25).
- `swarmDebugPrefix?`, `swarmId?` and `buddyContext?` are an optional-bag encoding of `row.kind`.
- `onScrollStateChange(isNearBottom, showScrollButton)` (:29, called at :150) is a positional
  boolean pair, and its only consumer ignores the first one (`Chat.tsx:249`, `_isNearBottom`).
- Fix: pass `conversationId` and read the row, turn and kind through atoms. Reduce the callback to
  `onScrollButton(visible)`.
- Delta: about -25. This dies anyway if the classic UI is retired (section 7).

**E-3.2 [cosmetic]** `useBuddyWorkerRead(buddyId, workspaceId = null, includeHistory = false)`
(hooks/useBuddyData.ts:82-86) is called positionally with `true` (:97). Use an options object or two
named hooks. Delta: about 0.

**E-3.3 [cosmetic]** `ConversationConfigPickerProps` has 9 props, covered in E-2.4. No other prop bag
exceeds 8. The inline prop types in `ChannelBrowser.tsx` are all 5 or fewer.

**E-3.4 Re-validation after the WS boundary: none found.**
- The handlers in `actions.ts` trust `ServerMessage`.
- `useWebSocket.ts:20-33` has a hand-written chunk fast path in front of `classifyServerFrame`.
  That is a second parser of one variant; it is intentional for performance at 60 fps. Keep it,
  but tag it `Pattern: quarantine`.
- Unvalidated `JSON.parse ... as`:
  - `usePendingAttachments.ts:65` (localStorage)
  - `AskUserQuestion.tsx:44` (a tool payload)
  - `useSavedPrompts.ts:21` (localStorage, untyped)
- Severity is bug-risk for `AskUserQuestion`, where the input comes from a provider. Fix with a Zod
  schema at each site. Delta: about +15.

## 4. Structural branching in views

- **Device kind: clean.** `useDeviceKind` is called only in `App.tsx:308` and dispatched through
  `Record<DeviceKind, …>` tables (App.tsx:132, :243, :252, :276). No `isMobile` exists in any view.
- **E-4.1 [design] Conversation-kind dispatch repeated in both trees.**
  - `Chat.tsx:184,196,364,588,636` and `mobile/conversations/ConversationView.tsx:365,427,447` each
    branch on `conversation.kind.t` for the builder card, the swarm id and the MCP requirement.
  - Fix: one `kindChrome(kind): { swarmId; builder; requiresMcp }` in `views/conversation/`,
    exhaustive over `kind.t`.
  - Delta: about -15.
- **E-4.2 [design] Null-guarded canonical data in `Chat.tsx`.**
  - 7 uses of `conversation?.` run in hooks before the `if (!conversation)` early return at :317.
  - `:313` repeats `if (!conversation || !detail || !id) return`.
  - Fix: split into `ChatRoute` (resolve row and detail, render the missing/loading states) and
    `ChatLoaded({ row, detail })`, which has no null checks. Delta: about -10.
- **E-4.3 [design] Mobile channel tree duplicates desktop.**
  - `mobile/channels/ChannelsMobile.tsx` (938 lines) re-implements `ChannelBrowser.tsx` (1,139 lines).
  - `PostPurpose` is identical except for the class name (ChannelsMobile.tsx:525 vs ChannelBrowser.tsx:114).
  - `NewChannelForm` appears at :446 vs :806 (71-line diff over roughly 75 lines).
  - Row, thread, task and archived rendering run in parallel (ChannelsMobile.tsx:96/693/791/871 vs
    ChannelBrowser.tsx:940/548/480/391).
  - Fix: shared row, thread and form components under `components/buddies/` taking a
    `layout: 'wide' | 'narrow'` value (the swarm pattern already does this).
  - Delta: about -400 to -500.
- Provider-name checks in the UI: none by literal. The provider defaults are covered in section 5.

## 5. Silent fallbacks

**E-5.1 [bug-risk] The Buddy profile-to-config default is built three times in the client.**
- `hooks/useBuddyData.ts:64`: `provider: (buddy.provider ?? 'codex') as 'codex'`. The cast lies:
  it types every provider as `'codex'`.
- `components/buddies/channel-data.ts:500`: `buddy.provider ?? 'codex'` (safeParse'd, with a
  comment admitting it mirrors the server's `profileConfig`).
- `components/buddies/BuddyBuilderResultCard.tsx:27`: `buddy.provider ?? 'codex'`, reading
  snake_case `reasoning_effort` from another shape.
- The AGENTS rule is server-side defaults. Fix: the server returns a resolved
  `execution: ConversationConfig` on `Buddy` (it already computes the seat in `channels.ts`), and the
  three sites read it.
- Delta: about -35.

**E-5.2 [design] The default provider is chosen in the UI.**
- `NewConversationForm.tsx:67` uses `catalog.providers[0]?.id ?? 'claude'`.
- `Sidebar.tsx:139-141` uses `(catalog?.providers[0]?.id ?? 'claude') as ConversationConfig['provider']`.
- In Sidebar the seed also depends on whether the latest thread's transcript happens to be loaded
  (`readConversationDetail(...)?.config.config`, :138), so the same click creates different configs
  depending on cache state.
- Fix: the catalog carries `defaultProvider` from the server, and the Sidebar seed comes from a
  server-side "latest Buddy config" (or the E-5.1 execution).
- Delta: about -10.

**E-5.3 [design] Palette fallback writes back to the server.** Covered in E-1.5.

`|| []` / `?? []`: 41 sites, mostly benign. The resource `data ?? []` renders an empty list while
loading, which hides the loading state. Examples: `WorkspaceHome.tsx:42`, `ChannelBrowser.tsx:734`,
`ChannelsMobile.tsx:96,98`. Where the `ResourceEntry` kind is available, render `loading` and
`failed` explicitly. The `swarm/` sites are quarantined; leave them.

## 6. Dead code

Every candidate was verified by a direct file-read script (not rtk).
- **No orphan files.** Every `src` file is reachable from `main.tsx` except `sigil.worker.ts`,
  which is loaded via `new URL`.
- **No fully dead exports.** Every export is referenced somewhere.
- **3 exports exist only as test seams:**
  - `clearResourceCache` (resources.ts:286)
  - `resourceCacheSize` (resources.ts:309)
  - `markdownTreeCacheStats` (markdown-pipeline.ts:126)

  Acceptable; tag them `/** test seam */`.
- **138 exports are used only inside their own file (plus tests).** Examples: `WakePhase`,
  `FeedPhase`, `OWNER_INBOXES_KEY`, `inboxRequests` (channel-data.ts:451/704/733),
  `normalizeWorkingDirectory` (commands.ts:53), `redirectToLogin` (auth/session.ts:33),
  `useLazyMarkdownPlugins` (lazyMarkdownPlugins.ts:41), `ROOT_DIRECTORY` (directories.ts:9).
  - [cosmetic] Un-export them so the module surface shows the real seams. Delta: about 0.
- **Dead props:** `showProvider` (ConversationConfigPicker.tsx:16/37/50), never passed.
- **Dead CSS:** `.mobile-ui-card--button` (mobile/styles/mobile-ui.css:76, 87, 114, 141, 581) and
  `.mobile-ui-path` (:93). Neither appears in any `.ts`/`.tsx` file. About -35 CSS lines.
  The other unreferenced classes are markdown or KaTeX generated (`task-list-item`, `hljs`, `katex-*`)
  and are live.

## 7. Deprecated classic chat UI

Method: import-graph reachability from `main.tsx` with the roots cut. What becomes unreachable is
what only the classic UI owns.

**Desktop classic (Chat, Sidebar, Gallery, VirtualizedMessageList): 5,528 lines = 3,594 TS + 1,934 CSS.**

| Lines | File |
|---|---|
| 884 | components/Sidebar.tsx |
| 793 | components/Chat.tsx |
| 642 | components/Sidebar.css |
| 603 | components/Gallery.tsx |
| 584 | components/Chat.css |
| 294 | components/FolderFilter.tsx |
| 293 | components/VirtualizedMessageList.tsx |
| 282 | components/Gallery.css |
| 274 | components/ContextBreakdownMeter.tsx |
| 272 | atoms/buddy-sidebar.ts |
| 203 | components/ContextBreakdownMeter.css |
| 158 | components/FolderFilter.css |
| 81 | hooks/useFolderFilter.ts |
| 65 | components/BuddyConvoHeader.css |
| 50 | components/BuddyConvoHeader.tsx |
| 50 | hooks/useUrlFolderSelection.ts |

Adding mobile `ConversationView.tsx` as a root raises the total to **10,965 lines = 7,283 TS + 3,682 CSS**.
It is the only other consumer of the whole transcript/composer stack:
- `views/transcript/*`: TranscriptGroup 396, markdown-components 373, Transcript.css 591.
- `views/composer/*`: PromptPalette, SendControls, ComposerAttachments.
- `views/conversation/*`: SubAgentPanel, QueuedMessages, ResumeSource, TurnStatus, ContextSection.
- Also `ComposerMobile.tsx` (397), `ConfigOverlay.tsx` (190), `FilePreview`, `useComposerSubmission`,
  `useSavedPrompts`, `useRestartRecovery`, `RestartRecoveryPrompt`, `DmChannelsNotice`, `fork-actions.ts`.

What it still owns that nothing else uses:
- The **desktop shell rail** (Sidebar, including the Buddy rail via `atoms/buddy-sidebar.ts`).
- The **desktop home and `/done` and `/search` routes** (Gallery, at `App.tsx:186,226,229`).
- The folder filter.
- The context-breakdown meter.
- The only renderer of a raw conversation transcript. Channels use `ChannelMarkdown`, not `TranscriptGroup`.

Retiring it therefore needs a replacement desktop home and rail first. Every "open conversation"
`<Link to=/chat/:id>` (the AGENTS rule) targets this UI, so thread inspection must survive somewhere.
If read-only inspection is all that is kept, a minimal `TranscriptView` (TranscriptGroup plus
markdown, about 1,400 lines) is the floor. Expect about **-4,000 to -9,500** depending on how much of
the composer and config stack goes.

## Top 5 recommendations (payload vs cost)

1. **Collapse the mobile channel tree onto the desktop components with a `layout` value** (E-4.3).
   About -450 lines. It is mechanical (the swarm `layout` pattern exists) and removes the biggest
   live duplication.
2. **Server resolves Buddy execution and default provider; the UI stops defaulting** (E-5.1, E-5.2).
   About -45 lines. Small, and it kills a lying `as 'codex'` cast plus a cache-dependent create config.
3. **Typed, schema-parsed resources** (`Resource<T>` carries a Zod schema; key by resource) together
   with moving the mirrored server types to `shared/` (E-1.3, E-2.1, E-2.2). About -100 net. It closes
   the one unparsed boundary left in the client.
4. **Replace the zustand settings store with resources plus a palette atom, and drop the write-back
   fallback** (E-1.5). About -60 lines and one dependency, and it fixes silent loss of a custom palette.
5. **Server-owned `providerLocked` and allowed providers in the detail, and one ConfigOverlay contract
   for both trees** (E-1.6, E-2.4). About -30 lines. It closes the mobile gap where a Buddy thread can
   pick a provider without its required MCP.

Deferred but large: retire the classic desktop UI (section 7, 5.5k to 11k lines) once a desktop home
and rail exist. After that, E-3.1 and E-4.2 disappear with it.
