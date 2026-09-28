# DM message width guard

Owner reported a Project Lead DM where the new owner message wrapped at about five characters per line while the composer still filled the pane. I found the exact wave_sim Project Lead DM (`/buddies/workspaces/project_88cdc98e-13d1-426a-9544-7e7830a2b5c6/channels?dm=e6079287-6fd8-57af-a1d6-40f289c843d3`). A fresh render at a 981×635 CSS viewport measured the body at 621 CSS pixels and showed it normally, so the narrow state was intermittent.

`client/src/components/buddies/ChannelBrowser.css` now gives the scroll area `min-width: 0` and pins the message list, rows, and content column to the pane width. This prevents an auto-sized short DM list from collapsing into a narrow text column while the composer remains wide.

Visual check: `pnpm screenshots --only dm --sizes desktop --workspace project_88cdc98e-13d1-426a-9544-7e7830a2b5c6 --out /tmp/unleashd-project-lead-after` captured the exact DM with full-width messages; one sigil worker request remained loading at the 20-second cap, and no writes were blocked. No tests were run.

## Correction — 2026-09-28

The width guard above was not a complete fix. The owner's newer screenshot showed a 334-character message twice: once as the transcript row and again as a narrow, portrait-less continuation. The DM renderer appends queued messages after transcript groups; while a turn is running, the sending queue head remains present after the same owner message has been appended to the transcript. The duplicate was that second source. `dmRows()` now skips a sending queue item only when a matching user transcript record with a timestamp at or after `queuedAt` exists. Pending queue entries remain visible. Regression coverage in `client/test/channel-dm.test.tsx` exercises the real ChannelBrowser DM render; focused test passed (6/6). The original width styles are retained for the transcript row layout, but they did not prevent this queue/transcript duplication.
