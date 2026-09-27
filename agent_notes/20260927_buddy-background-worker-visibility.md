# Buddy background-worker visibility — 2026-09-27

Owner request: a hover icon/count on the Buddies DM list, linking to each Buddy's
background workers so their progress is inspectable.

The existing `/buddies/:buddyId/background?workspace=...` route now lists background
conversations, provider-reported session workers and child transcripts. The DM
rail exposes the active (running + queued) count on hover or keyboard focus.
Phone and touch-only landscape tablet controls remain visible, with 44px targets.
The link remains available at zero so previous results can still be inspected.

One derived atom owns both count and rows. Native worker reports and their child
transcripts collapse into one row. Background conversations display their linked
Task title, current output and last-message time. Visible running conversations
poll the existing turn-diagnostics endpoint through the keyed resource cache:
provider activity, elapsed runtime, heartbeats and provider-output silence are
shown independently from message age. A parent ending does not prove its workers
completed: inferred completion and active reports with a stopped parent render
as **Status unconfirmed**. All transcript links are availability checked.

This is a client presentation change. It adds no execution controller, API,
provider parser, or storage schema. Session workers depend on the worker reports
already supplied by the harness; it does not infer workers from chat prose or
invent per-worker heartbeat timestamps. A queued execution that has not yet
created a conversation is outside this conversation-based view.

## Evidence

- Live Chrome/CDP against the running dev app, real data: Product Lead in wave_sim
  had four running workers. The DM count matched the page, which displayed Task
  titles, live output, elapsed runtime, provider-event ages and heartbeat/output
  silence. Count changes were visible as work ended.
- Desktop (1440×900), phone (375×812) and landscape tablet (1024×768) screenshots
  inspected. No horizontal page overflow. Tablet review caught controls clipped
  by a grid item's minimum width; `min-width: 0` repaired it and a rerun confirmed
  the icons were visible and clickable.
- Screenshots and DOM evidence: `output/background-worker-review/` (gitignored).
  Reproduction scripts: `review.mjs` and `review-active.mjs` use the repository's
  `tools/lib/headless-chrome.mjs`, authenticate with the server's token resolver,
  and close their Chrome sessions in `finally`.
- `pnpm typecheck`: passed in the shared checkout. Client `tsc -b` also passed
  in `/tmp/unleashd-background-worker-check`, with only this feature over cb5020b.
- All six client invariant gates passed in the isolated checkout.
- 16 focused rendered/atom/route regressions passed: buddy-background-tasks,
  buddy-background-visibility, channel-buddy-dm, buddy-conversation-links and
  mobile-channels. They cover live count updates, deletion, workspace isolation,
  native-worker deduplication, stopped-parent uncertainty, safe links and routing.
- Full isolated client suite: 184/186 passed. The two failures also reproduce
  on the unchanged cb5020b baseline: channel-browser expects an obsolete Task
  anchor (the product uses a button/overlay), and conversation-event-isolation
  expects a message-group notification it does not receive. Logs:
  `isolated-client-tests.log` and `baseline-tests.log` in the evidence folder.
- Biome and `git diff --check` passed for the feature files.

The shared checkout contains other sessions' changes. Only this feature's files
and the three small mobile DM-row edits belong to its commit; the unrelated
mobile channel-archive edits are retained in the working tree.

## Owner follow-up: green without hover

Running workers now keep the DM-row icon and count visible in green even when
neither the row nor the link is hovered or focused. A scalar derived atom uses
the same worker status authority as the detail page. Queued-only work still
counts as active but does not claim to be running. Stopped or unconfirmed workers
also do not receive the green state. Long Buddy names reserve room for the
persistent indicator on desktop; touch layouts retain their 44px targets.

- Live Chrome/CDP with real wave_sim data: Product Lead had four running workers.
  Desktop, phone and landscape tablet each reported `visibility: visible`, green
  computed color, `:hover` false, `:focus-within` false and a successful center-point
  hit test for the running link. No horizontal overflow. All three PNGs inspected.
- Reproduction and evidence: `output/background-worker-green/review.mjs`,
  `evidence.json` and `running-workers-{desktop,phone,tablet}.png` (gitignored).
- Client `tsc -b`, four focused rendered/atom/rail regressions and all six client
  invariant gates passed in both the shared checkout and the isolated feature
  checkout. The regression verifies running, queued-only and stopped states.
- The five implementation/test files were copied into the isolated checked
  snapshot for comparison with the follow-up commit. The earlier full-suite
  baseline failures documented above are unchanged by this presentation update.
