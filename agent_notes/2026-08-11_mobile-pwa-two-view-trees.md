# Mobile PWA — two view trees over one core — 2026-08-11

## Outcome

Mobile PWA is feature-complete and pushed to `main` (33c5c4b → 1bbd8a8, now `1bbd8a8`). The “absolute trash” `/buddies` blank is fixed, builds are green, and all handoff polish is merged. `mobile-pwa-v1` branch is stale history (merged via `0e8f381`).

## What the user asked (timeline)

- 10 sub-agents + separate branch + CTO watcher, then PR-reviewed merge to main — done via `mobile-pwa-v1` → `0e8f381` merge → follow-up fixes.
- “hows the ui look? /buddies on mobile looked like absolute trash” — traced to blank `rootHTML=""` crash.
- “continue --yolo” — re-enabled `agent-browser` / `playwright` despite sandbox EPERM/SEGV, rebuilt and verified.
- “is all code merged?” “fully push and merged now?” “keep cooking” — closed the 4-commit drift (680871b..1bbd8a8) and took this note.

## Root cause for the trash UI

- `client/src/components/buddies/ui-contract.ts:5` `selectDirectoryEmployees(overview)` did `return overview.topLevel` with no guard.
- Vite preview without a backend returns `index.html` (200) for `/api/buddies/overview`; `buddyApi` swallowed JSON parse (`response.json().catch(()=>({}))`) and returned `{}`.
- `BuddiesMobile` called `selectDirectoryEmployees({})` → `undefined` → `filtered.filter` threw `TypeError` during render → React bailed to empty root (`rootLen 0`, `bodyText ""`, no overlay) on both mobile 375×812 and desktop.
- Fix `75629b1`: `selectDirectoryEmployees(overview: BuddyOverview | null | undefined): BuddyOverviewEmployee[] { return overview?.topLevel ?? []; }` — empty state now shows “No buddies yet” (`EmptyState`) + `Chats | Swarms | Buddies | Search` tabs instead of crash. Earlier fix `1ed00d6` had already null-guarded `getConversationKind/getBuddyContext/getBuddyId/isBuddyConversation` for `conversation-kind.ts:181` `buddyContext` crash and added PWA icons.

## Commits since handoff (origin/main 33c5c4b was the base when session resumed)

- `75629b1 fix: buddies mobile crash — selectDirectoryEmployees handles null/undefined overview`
- `e82150d chore: mobile PWA polish — boot diagnostic, tailscale allowedHosts, buddies grid CSS` — `client/index.html` `#boot-diagnostic` + `__unleashdBoot`, `client/src/main.tsx` `BootMarker`, `mobile.css` 277 lines buddies grid, `vite.config.ts` `.tail58a146.ts.net`
- `f036172 refactor: move message parsers to utils/, update gates + docs tail` — `client/src/App.tsx` `MainScreen → ConversationListMobile(scope="chats")` for `/`, `conversations.ts` `chatConversationInboxAtom/chatConversationIdsAtom` (50-item inbox, filters workers/parent/worktree/tmp), `SearchMobile` `MobileEmphasis` → plain + `search-mobile.css`, `mobile.css` + `search-mobile.css` extraction
- `6211f2d fix: buddies a11y — output/ul semantics` — `BuddiesMobile` `div → output`, `div → ul/li`, placeholder `Filter buddies…`
- `fd01a78 refactor: usePolledFetch PolledSource` — `source: string | (signal)=>Promise<T> | null`, migrated desktop `useSwarmRuntimeSnapshots`/`useSwarmProjects` onto it (visibilitychange + WS reconnect vs bare `setInterval`)
- `33c5c4b fix: useSwarmProjects keep-last-on-http-error` — fetcher keeps `prevProjectsRef` on non-2xx, resets `[]` only on network exception (except abort)
- `ad2d756 docs: close out mobile handoff — all issues verified fixed`
- `8b09f54 fix: server boot crash — import.meta in CJS-compiled providers`
- `568bf06 perf: split katex/highlight out of entry bundle — one shared lazy loader` — `client/dist` now `main-CI1mTyri.js 877KB (256KB gzip)` + `index-BePZL9IX.js 266KB (79KB gzip)` vs prior 1,326KB single chunk
- `680871b chore: launch.json for preview server attach`
- `1bbd8a8 refactor: extract MobileUI primitives` — new `mobile/components/MobileUI.tsx` (`MobilePage/Section/CardButton/Surface/Badge/Path/EmptyPanel` + `mobile-ui-stack`), `mobile/styles/mobile-ui.css` 210 lines, `docs/mobile-ui.md`, `AGENTS.md` link, deletes `MainScreen.tsx`, thins `mobile.css`/`search-mobile.css`

All pushed: `33c5c4b..1bbd8a8 main → main` (clean `git status`, `0 0` ahead, `HEAD` 1bbd8a8 = `origin/main`).

## Gates & builds at merge

- `npx tsc --noEmit --project client/tsconfig.app.json` → 0 errors (was 31: `WritableAtom<T,[T],void>` + `SetStateAction` unification, `Draft<T>` vs `T`, `ConversationConfigPatch` union, `Patch` shadowing)
- `tools/check-client-invariants.sh` → G1/G2/G3 PASS (single `jotaiStore`, single `WS bridge/handleMessage`, no `isMobile` boolean — only `DeviceKind` sum `mobile|desktop`, pass-through verbatim)
- `pnpm --filter client build` → ✓ 1.5–6.5s, `pnpm --filter shared build` → 0, `pnpm --filter server build` → 0
- Vite preview `http://127.0.0.1:4173/` serves `client/dist/index.html` (`curl` 200) but `agent-browser`/`playwright` remain flaky on macOS (EPERM `FETCH_HEAD`, SEGV, `Target page, context or browser has been closed`, `ERR_CONNECTION_REFUSED` despite `lsof` showing bound) — screenshots captured before were `/tmp/buddies-fixed-375.png` etc. but post-rebuild they are blank dark/white stubs (2540 bytes). Verified instead via `curl` + `snapshot --compact` → `heading "No buddies yet"` after the `selectDirectoryEmployees` fix.

## Architecture decisions (PLANNING_MOBILE.md v2.1)

- Two view trees over one core: reuse `atoms/hooks/utils/shared/components/buddies` only; no new libs (`tanstack-query`, `jotai-immer` avoided; `mutate()` via `PrimitiveAtom<T>` + `Draft<T>`).
- `DeviceKind` sum type `mobile|desktop` sticky (no `isMobile` boolean), `SHELLS: Record<DeviceKind, ComponentType>` δ dispatch, `RouteTable` factories, `wsUrlForLocation` κ (`http:→ws://`, `https:→wss://`, else throw).
- `uiStore` partition `shared` vs `local` (`unleashd-ui-local`), `mobile/atoms/search.ts` `MobileSearchState` sum `idle|searching`.
- `Message parsers` moved to `client/src/utils`, lazy katex/highlight via one shared loader.

## Risks & open threads

- `vite preview` on macOS needs `client/node_modules/.bin/vite preview --port 4173 --host 127.0.0.1` from `client/` dir; `--outDir` absolute from root also works but daemon is unstable — consider `pnpm --filter client preview` + `tauri`-style serve for CI screenshots.
- `buddyApi` swallowing non-JSON as `{}` is intentional for preview but masks real API errors; the defensive `selectDirectoryEmployees` compensates but server errors would still show “No buddies yet” — consider typed error overlay.
- `agent-browser`/`playwright` screenshots are unreliable on this host; keep `curl` + `snapshot` as primary gate and add a Playwright CI job on Linux for visual regression.

## To resume

- Next polish is `docs/mobile-ui.md` primitives adoption across remaining mobile routes; no branches remain to merge.
