# Unleashd branch audit — 2026-09-27

Read-only audit; no branch changes, deletes, pushes, package execution, or live-data writes by this lane. Baseline is **main 1d6c9fb**, not a moving working tree. Read AGENTS.md, architecture, submodule and Buddy core design. Referenced RTK.md was absent in the checkout and parents checked.

## Decision

Keep the lean Rust/server/client architecture. Port behaviors from the old checkout, then record the source ancestry as merged only after the feature checklist is satisfied. A wholesale merge of the old server/Buddy package would restore the deleted architecture. Do not delete any branch/worktree until the release work stops changing and every unique behavior is committed on the target.

## Exact source inventory

Common ancestor of baseline main and old channels branch: **f2e40b3**. `git log main..8256e6e` contains exactly 15 commits, oldest first below. The source checkout was then checkpointed as **2a07227** by the parent. Worker branch checkpoint **88a89e0** is separate; mobile archive branch tip **53ebe1c**.

| Source commit | Unique behavior / assets | Status against baseline and moving port |
|---|---|---|
| 9ab652f | NativeMultimedia cut 2: opening title, smoother drop; EDM build/stems | Not at baseline; in parent's in-progress merge through 538857e |
| 0914a8b | First-install unleashd workspace; Product Dev/Release Manager; fetch-only 6-hour upstream check; update thread; client update prompt | Not at baseline; parent owns Rust-aware port in `port/upstream-and-settings` |
| 2a83600 | Design-review ending quick-scroll, rough cut 4, 11.2 s | In parent's merge |
| 6ebde7c | MultiHarness clip; shared card edit; clip/footage docs; Remotion registration | In parent's merge |
| 538857e | App settings dropdown on workspace/channel surfaces; workspace/channel UI polish | Parent's MERGE_HEAD at initial inspection; unresolved paths owned by parent |
| f5960c1 | Close.tsx, DesignIterationShort.tsx; NativeMultimedia picture export; asset types | Still needed; clean release-subtree port |
| 3278d76 | HTTPS submodule clone URL | Already ported during audit as **ff0702f** on lean/integration (main baseline remains unchanged) |
| 028bbc0 | Full-length EDM cue and 3 stems, sound/edm.py generator | Still needed; clean release-subtree port |
| 7b484c6 | Keep previous stdio MCP bundle while rebuilding; prevent/repair phantom Codex resume after failed startup | Bundle half obsolete: lean deleted helper subprocesses; session correctness half still needed in turns/runner.ts + runtime authority |
| cb5020b | Owner + Buddy archive/restore, archived browser, excluded nav/unread, preserved readable history, blocked posting, JS package v34 | Still needed as Rust-core + HTTP/MCP + client port; never restore vendor/nbardy-buddies tgz |
| 5c1c947 | Worker badges from DM rows; background + native workers; filtered view, diagnostics, states, task titles, correct transcript links | Still needed; folded by 88a89e0 |
| 1356784 | Always-visible green count when running, hover/focus when inactive | Still needed; folded by 88a89e0 |
| c93852f | Shared build staging/locking, atomic watch writes, failure leaves last build readable | Already ported during audit as **8b2b2d2** on lean/integration |
| 675b134 | Workers stay in workspace Buddy DM surface via `?workers=buddyId`; desktop/mobile workers screen/back link | Still needed; folded by 88a89e0 |
| 8256e6e | PROJECT_ETHOS.md: free, private, open-source, forkable product hook | Still needed; release-subtree port |
| 2a07227 (checkpoint) | Unified visual picker refresh, reasoning slider/Auto/default styles; channel mention/composer styling; Codex GPT-6/default + medium reasoning; release assembly/features/benefits/capture | Needs intentional port split: config/profile/composer, provider catalog, release. Includes duplicate mobile archive patch |
| 53ebe1c (mobile branch) | Archived section/restore, channel archive action, direct archived reading, hide channel/thread composer | Exactly duplicated inside 2a07227; port once |
| 88a89e0 (worker branch checkpoint) | Worker UI, atoms, routes, diagnostics, tests | **All 20 changed files are byte-identical to 675b134.** It squashes the 3 worker commits above; no additional worker behavior |

The worker branch name originally pointed at cb5020b, not a unique worker commit. The actual worker work was dirty until 88a89e0. The only difference between its 20-file checkpoint and the three source worker commits is that the old checkout also has `agent_notes/20260927_buddy-background-worker-visibility.md`.

Verified duplicate mobile archive patch ID for cb5020b→53ebe1c versus 8256e6e→2a07227, restricted to the two mobile files: **4b785682104c23438ea7696a949cc28e2ac5fff9**. Do not reapply it twice.

## Behaviors already preserved before this suffix

Baseline ancestry already includes original channel commits through f2e40b3 and lean-specific ports. `agent_notes/2026-09-25_lean-rewrite/FEATURE-AUDIT.md` inventories 58 earlier features. Concrete port evidence: workspace home **7682fde**, create-folder guard **bf1a194**, emblems **d48024c**; thread seats **70f87b3**; Buddy posts/silence notices **37b005f**; New Buddy/creating row/conversation eye **e9e3426/e8adfae**; Task overlay **e7fed06**; DM chain/new chat/retry **1216168/e7017e8**; `/chat` DM pointer **9284826**; long Claude background wait **ba9f1c0** and Agent/task events **08da3f1/fe98768**; embedded-video poll stability **cfcb68e**. Preserve these while porting newer channel files.

## Port boundaries and acceptance criteria

### Archive: one Rust authority, both shells

Old package provenance in cb5020b: **b67269410dcff0ea05a37891bdf66c8718265c6e**, sha256 **797f9f96ee2dc63f2f3d951ba73b9f55e8ccfcd197dc0e680c7df017e76ce22d**. It adds `buddy_lists.archived_at`, schema v34. Existing owner route `/api/buddies/lists/:id/archive` and Buddy `set_list_archived` must be expressed through the new channel model, without reintroducing the old operations/contract stack.

Map:
- JS package list store → `crates/unleashd-buddies/src/{schema,types,posts,store,node}.rs`, generated `index.d.ts`.
- Old `operations.ts` / `mcp-server.ts` → `server/src/buddies/mcp.ts`, field schema in `core.ts`, existing grant/authorization authority.
- Old `/lists` routes → `server/src/buddies/routes.ts` `/channels` routes; all writes notify existing change bus.
- Old list nav/unread → core `inbox()` + `client/src/components/buddies/channel-data.ts` railChannels; do not create a parallel lists cache.
- Archive UI → existing `ChannelBrowser.tsx`, `ChannelsMobile.tsx`, token-based CSS, shared channel helpers.
- Legacy import → `crates/unleashd-buddies-import/src/{import,verify}.rs` (coordinate with closeout_audit lane).

Acceptance: only owner or active Buddy in channel workspace may archive/restore public channels; idempotent keys replay correctly; navigation and unread totals exclude archived; explicit channel/thread reads and search still see history; post/reply rejected until restore; restored channel returns with history/cursors; both shells offer archived list/restore and suppress channel/thread composer. Do not accidentally archive direct/task channels. UI updates on existing push/cache invalidation; archive state survives restart.

Data preservation is mandatory: lean importer currently accepts v33 only, while closeout_audit has confirmed the live source is v34. Coordinate an optional `archivedAt` TS / `archived_at` SQL field and v34 import/verification; old channel schema has no version chain, so an already-imported lean DB also needs an explicit compatible-open strategy. The closeout lane owns importer compatibility and the existing `buddy_builder_hires` preservation audit (hires predate v19 and already map to events; v34 adds only `buddy_lists.archived_at`); avoid overlapping its files.

### Workers: preserve truthfulness and lazy detail

Source final shape is 88a89e0 (or 675b134); do not port the old atoms as-is.

- Old `conversationListAtom`/`conversationAtomFamily` → `listField('buddyThreads'|'buddyEntries'|'childrenOf')`, `rowFamily`, `transcriptFamily`, `subAgentsOf`, stream family in `client/src/atoms/conversations.ts` + `conversation-index.ts`.
- Old `placement: background`/Buddy metadata → canonical `ConversationRow.kind` (worker/buddy), with row parent links.
- Old `availableConversationIdSetAtom` → `listField('idSet')`.
- Old Buddy page props (`workspaces/projects`) → current `BuddyDetail`/`Run` model. **Keep lean's Recent runs/BuddyRunList and cancel affordance** when adding worker view; old component replacement would delete them.
- Worker diagnostics → keyed `usePolledFetch` for existing attempt endpoint; old `useBuddyWorkerDiagnostics` can be adapted. Worker rows use existing transcript detail loader; list data must not grow back into full transcripts.

Preserve native descendants even when they have no own Buddy kind, deduplicate native agent + child transcript, show child link when available and parent otherwise; queued/running first; parent-ended inferred completion displays **Status unconfirmed**, never fabricated completion. Missing diagnostics show Retry. Silence alone is not a stall. Persistently green active badge, inactive badge hover/focus, `/channels?...&workers=` on desktop + mobile, correct back link to same workspace, task labels, keyboard-accessible sibling links. Existing top-level background page remains functional.

Main v3 rows intentionally omit subAgents/session IDs/queue; only loaded detail has them. A port must explicitly address fresh-load worker discovery so workers don't appear only after a DM was opened. Use existing server/run facts or scoped detail loading, without a second global conversation store.

### Picker/provider checkpoint

Old `components/ConversationConfigPicker.tsx` and mobile `ModelSheetMobile.tsx` are gone on lean; port behavior into **`client/src/views/config/{ConversationConfigPicker.tsx,ConversationConfigPicker.css,config-options.ts,ConfigOverlay.tsx}`**, shared by shells. Profile editors and `ChannelComposer` remain consumers. Preserve dynamic explicit IDs and unavailable selections.

2a07227 requests: default badges on harness/model/reasoning; fold default into actual model; reasoning Auto option and slider on specified surfaces; reset reasoning on model change; GPT-6-only Codex visible choices; default GPT-6 Sol; reasoning default medium when supported; refreshed compact composer/mention styles. These are not all equivalent to current main: `withModel` currently preserves a supported explicit effort, while checkpoint always resets. Make the final intended policy explicit and shared, not duplicated across shells.

Main deleted `server/src/providers/codex.ts` and per-provider fallback catalog readers. The canonical model catalog is **`vendor/agent-cli-tool/catalog.jsonc` → `shared/scripts/gen-catalog.ts` → `shared/src/generated/catalog.ts`**, consumed by catalog-service. Make default/model updates in that authority (submodule-first commit/push order) or a deliberately documented server-default policy; never resurrect provider modules or `DEFAULT_PROVIDER` re-export (deleted on lean).

### Runtime/build fixes

7b484c6 session half remains relevant: baseline `turns/runner.ts` calls `host.markSessionStarted()` after process spawn, before `session.started`; malformed Codex resume recovery absent. Move start proof to session event/binding and repair a legacy phantom binding when provider reports `no rollout found for thread id`. Keep runtime/record/alias binding consistent; guard with existing runtime boundary test. MCP bundle half is superseded by the one HTTP MCP server and requires no port.

Build c93852f and HTTPS 3278d76 now have target commits above. Audit compared committed target history, not a shared working-tree check. Full tests remain integration owner's responsibility.

### Release work

Release assets are independent of core architecture. Finish parent's merge through 538857e, then port f5960c1, 028bbc0, 8256e6e and release-only files in 2a07227; final source subtree can be copied after current author finishes. Keep docs, generator, WAVs and composition registrations together.

2a07227 Assembly imports Close, DesignIterationShort, FeatureFlash, MultiHarness, DesignReview, NativeMultimedia, Overload and `edm-full.wav`; it cannot land without f5960c1 + 028bbc0. FeatureFlash needs four `2026-09-26_feature_{swarm,memory,chat,phone}.mp4` assets. PostIntroBenefits expects `2026-09-27_post-intro_home.mov`. Source picker-capture script hardcodes localhost:7489 and must remain development tooling, not shipped runtime. Latest uncommitted PickerRefresh expects PNGs under `picker-refresh-20260927/`. Verify asset delivery/Remotion static directory and a build/compositions or render smoke: source-only preservation does not prove a reproducible film.

## Submodule audit (no fetch/push/delete)

Outer baseline pins agent-cli **076f3fe**. Main checkout submodule is still **efe0503**, so inspect the lean submodule repository (it has newer objects) when comparing. Remote-tracking refs are cached local evidence, not a fresh remote inventory.

- All local/remote branches except two commits are ancestors of 076f3fe: HTTP MCP, session-title, Claude background-task events, Muse parser/context fixes, session-limit fix, Codex web-search `a7a3ada` are included.
- `feat/codex-web-search-stacked` **1aa5554** is not an ancestor but `git cherry 076f3fe ...` marks it **minus**: exact patch-equivalent Codex web-search behavior already included.
- `codex/inline-buddy-results-20260909` **e846874** is not an ancestor and git cherry marks **plus**, but all four parser `tool.result` emissions and the union field exist at 076f3fe (`claude.ts:170`, `codex.ts:219`, `muse.ts:143`, `opencode.ts:73`, `runtime-types.ts:174`). The isolated `test/tool-results.test.ts` is absent at the target. Do not cherry-pick the stale parser patch; inspect current parser contract coverage if retaining its small cross-parser regression is useful. No uncovered runtime behavior was identified.
- No submodule content changes observed. No submodule branch deletion authorized by this audit.

## Ownership/order to avoid collisions

1. Parent finishes upstream/settings merge and claims App.tsx, workspace home, upstream server routes.
2. Archive+worker lane owns ChannelBrowser/ChannelsMobile, channel-data, Buddy worker view/atoms/tests and archive core/MCP/routes. Build on parent's finished merge so settings/home changes survive. Combine archive+worker client edits because their files overlap heavily.
3. Importer lane owns importer/verify/fixtures and coordinates the archive field with archive core lane. Preserve v34 data before any live swap.
4. Picker lane owns views/config, profile consumers, composer, catalog changes. It must not independently replace ChannelsMobile/ChannelBrowser; hand any exact touchpoints to archive/worker lane.
5. Parent/release lane preserves final release subtree once author stops, plus new dirty files listed below. No destructive cleanup while that work continues.
6. Validate committed union: typecheck/client/server/crate affected integration tests, invariant gates, actual desktop+phone screenshots via repo CDP tooling, then clean-tree commit validation. Existing earlier audits are evidence of baseline, not proof of the new port.

## Dirty checkout metadata (no file contents copied)

Initial 22 dirty paths were preserved by parent in **2a07227**; initial worker changes in **88a89e0**. They were briefly clean. Ongoing release author work created fresh dirty files during this audit. Snapshot follows; refresh before cleanup because it is actively changing.

Snapshot 2026-09-27T15:06:16.927039+08:00

| Status | Path | Bytes | Modified local time |
|---|---|---:|---|

Checkpoint 2a07227 paths (Git blob bytes, not live sizes):

| Path | Bytes |
|---|---:|
| `client/src/components/Chat.css` | 39210 |
| `client/src/components/Chat.tsx` | 43843 |
| `client/src/components/ConversationConfigPicker.css` | 1598 |
| `client/src/components/ConversationConfigPicker.tsx` | 11449 |
| `client/src/components/buddies/BuddyExecutionProfile.tsx` | 4327 |
| `client/src/components/buddies/ChannelComposer.css` | 10668 |
| `client/src/components/buddies/ChannelComposer.tsx` | 20711 |
| `client/src/components/buddies/ChannelDm.tsx` | 15211 |
| `client/src/mobile/buddies/BuddyDetailProfileEditor.tsx` | 5619 |
| `client/src/mobile/channels/ChannelsMobile.tsx` | 34206 |
| `client/src/mobile/components/ModelSheetMobile.tsx` | 9255 |
| `client/src/mobile/styles/mobile-channels.css` | 16187 |
| `client/src/mobile/styles/mobile-ui.css` | 30091 |
| `product/releases/launch-2.0/edit/capture-refreshed-picker.mjs` | 4933 |
| `product/releases/launch-2.0/edit/package.json` | 1848 |
| `product/releases/launch-2.0/edit/src/Assembly.tsx` | 4416 |
| `product/releases/launch-2.0/edit/src/FeatureFlash.tsx` | 4133 |
| `product/releases/launch-2.0/edit/src/PostIntroBenefits.tsx` | 3383 |
| `product/releases/launch-2.0/edit/src/Root.tsx` | 2009 |
| `product/releases/launch-2.0/edit/src/post-intro-entry.tsx` | 1236 |
| `server/src/providers/catalog-service.ts` | 7522 |
| `server/src/providers/codex.ts` | 1162 |

## Archive/worker port follow-through

`port/archive-workers` implements this audit's archive and worker behavior on the lean model.
Schema commit 96e6bf5 is shared with importer d553cf4. Archive is one Rust mutation exposed
as owner HTTP and `channel_archive` MCP; no legacy Buddy package or store returns. Worker
inspection uses existing conversation detail endpoints (no transcript bodies), four concurrent
reads and the keyed resource cache; idle detail reuses its activity/run key. Recent runs and
Cancel stay available. Source worker checkpoint 88a89e0 is equivalent to 675b134; mobile
53ebe1c is already represented by the 2a07227 checkpoint. They are not applied twice.

Before integration merge: client 189/189, Rust unit/core/query-plan tests pass, targeted
HTTP/MCP archive test passes, typecheck passes. G1–G7/G9 pass; the new worker stylesheet is
41 lines over the old G8 ceiling. Integration owner will reconcile CSS ceiling and run full
union gates and CDP visual QA. No live runtime or owner database was changed by this lane.
