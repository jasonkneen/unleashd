# Copied-data visual QA — 2026-09-27

Baseline integration: 335f4c439144ad7d6e16b5be254aac894bba7a0b. Narrow fixes: 188c5c4.

Production server on 127.0.0.1:18809 used only the temporary app-data and Buddy database copy, with an empty environment except explicit paths and system PATH. Startup verified 0/6 provider CLIs available. Background work/schedules were disabled in the copied DB. Browser sessions blocked mutations; all screenshot manifests recorded zero attempted writes. Screens use copied real data, not fixtures. Transcript ingest and swarm artifacts still read original source paths, so data can drift; this is not an immutable snapshot or proof of live-write workflows.

31 baseline captures (19 core + 12 supplemental), then 10 affected-screen captures (3 core + 7 supplemental). Phone375×812 and desktop1440×900,2x scale. PNGs were inspected for planned cases and every affected reshoot.

## Findings and changes

- Settings SVG measured0×20 from inherited button padding. Scoped padding0 restores20×20 SVG inside36×36 button. Phone/desktop home and channel menus open and fit the viewport.
- Buddy worker pane inherited global h1 sizing, taking roughly201px on phone. Scoped token size, gaps and nonshrinking header/sigil produce65px header and20.8px title on both devices.18 historical worker rows render with conversation links.
- Swarm Run Overview used stale iteration field while API returns generated OompaReviewLog.cycle. Panel now uses canonical type and cycle for labels/keys. Before: repeated React duplicate key w1-iundefined-r1. After: correct c1r1,c2r1,c2r2, no console errors or uncaught exceptions.
- New-conversation heading clipping was a screenshot helper artifact: its generic bottom pin scrolled the modal42px. App probe showed modal scrollTop0 and intact29px title. Helper now pins only message-pane selectors. Reshoot shows intact heading; long form scrolls normally.
- Desktop Done preview containment, thread placeholder autosize (61px client/scroll height on long desktop reply placeholder), phone swarm title, search/empty-search and conversation picker showed no blocking layout issue in inspected captures. Phone /done is the generic mobile conversation list, not proof of a separate Done screen.

## Evidence

- screenshots/index.html and screenshots/manifest.json: original planned screens.
- supplemental/manifest.json: exact routes and measurements, prompt dismissed device-locally.
- after-core/index.html: dialog/settings reshoots.
- after-supplemental/manifest.json: corrected gear and worker metrics; PNGs include fixed review cycles.
- screenshots-runtime.json, supplemental-runtime.json, after-runtime.json: CDP error and failed-request records (auth tokens redacted).

After runtime log has only one404 for absent wave_sim oompa config, matching the visible 'No oompa config found' state. Initial logs had six duplicate-key console errors,13 canceled fetch/media requests and four missing-config404s; no uncaught exceptions. Some core screenshots time out waiting on the sigil worker resource although sigils render; that is capture bookkeeping, not a proven UI failure.

## Validation and limits

Client tsc -b and production Vite build passed.5 targeted swarm tests passed. Working tree matched committed files at validation. After parent reconciliation, all 9 invariant gates pass at a 12,929-line CSS ceiling. No server rebuild or full-suite repeat.

Archived channel shots skipped because copied data has no archived channels. Archive control is visible; archive/restore mutation and archived read-only state were not exercised. Original tool skips phone settings; supplemental captures cover those menus.

Remaining minor observation: now-visible global desktop settings gear overlaps the Swarm header's rightmost Debug Conversation area. No broader header layout cleanup performed.

Screenshot artifacts remain local at `~/.cache/unleashd/closeout-qa-20260927/`; private channel screenshots are not published to GitHub.
