# Workspace navigation regressions — 2026-09-27

Owner request: #channels-feature, root `post_01a0e20d-08cf-73a3-bbe3-dd58e2b3227f`.
Task: `task_01a0e213-a688-7579-be7a-67bf4a5ac21c`.

## Findings

- `897f95c` introduced a separate Direct messages list alongside Buddies in the
  Buddy UI rewrite. Its parent had only the Buddies rows. The earlier interrupted
  turn committed `fff12ab`: it removes that duplicate list on desktop and mobile,
  reduces the desktop icon/name gap from 8px to 4px, and updates rendered-component
  regression tests. This turn started on that commit and verified it.
- `7682fde` ported the workspace home from `6d04860`. The original CSS explicitly
  set `list-style: none` on both recent tiles and other workspaces; the port omitted
  it. These were native list bullets, not notification indicators. Restored the
  reset locally on both lists, leaving request counts and unread dots intact.
- `ce029cd` added the worker link beside the Buddy DM button. Its inherited type
  size/line height and 6px padding made a nominal 30px row 37.59375px high, even when
  the link was transparent. Grid min-content sizing also made rows 259.625px wide
  inside a 243px list. Set the worker link to the small type token, line-height 1
  and 4px padding; allow the Buddy grid item to shrink. All seven current desktop
  rows now measure 30px and fit their parent. Mobile retains its touch-sized rows.
- Removed obsolete section-heading margin overrides. Both headings already live
  in section-row wrappers; changing the old `:not(:first-child)` heading rule in
  `fff12ab` had no effect on those wrappers. The existing section-row gap remains.

These are concrete preservation mistakes in rewrite/feature ports. This audit
does not establish that every other design or behavior survived the full rewrite.
It did not reset, revert a merge, or restore any retired architecture.

## Checks and evidence

- `pnpm typecheck` passed using `rtk proxy pnpm typecheck`. The initial `rtk pnpm
  typecheck` was incorrectly routed into bare tsc help; its misleading “No errors”
  summary is not verification evidence.
- 19 focused tests passed: channel-browser, mobile-channels, workspace-home.
- All nine client invariant gates passed, CSS 12,929 / 12,929 lines.
- Biome check and `git diff --check` passed.
- Added the read-only browser regression guard:
  `node tools/check-workspace-navigation.mjs project_26fce156-5c5d-4dd9-a9d6-4b527a50af3c`.
  It checks no workspace bullets or duplicate DM section at 375px and 1440px,
  desktop Buddy row height/overflow, and a channel hash gap no larger than 4px.
  It passed against the running dev server.
- Six baseline and six after captures: workspace-home, channels, thread at phone
  and desktop sizes. Artifacts are under
  `output/screenshots/2026-09-27-workspace-navigation/{before,after}/` (gitignored).
  The same artifacts also remain at `/tmp/unleashd-sidebar-{before,after}-20260927/`;
  the generated comparison page refers to those original paths.
- Screenshot comparison intentionally exits 1 at its zero-difference threshold:
  bullets disappear and Buddy rows contract. Live data also drifts (workspace
  activity, channel unread state, and this thread gaining progress replies).
  Therefore this is reviewed before/after evidence, not a zero-diff claim.
  Each run captured all six requested views with no skips; the sigil worker kept
  the idle detector open after 20s although its icons rendered. The read-only
  session blocked channel read-cursor POSTs (one before, three after).

No push or server restart required: these are client styles served by Vite.
