# Systems deslop integration — September 27

Owner authorized all findings from `2026-09-27_deslop-systems-review.md`, using
GPT-6 Sol agents. Base app `325801b`; base agent-cli `7983ed4`. Work stays in
isolated branches. The owner subsequently authorized completing, merging and
pushing both repositories after verification. The live runtime is not a
deployment target; concurrent uncommitted work in the main checkout is preserved.

## Ownership and replacement

- Native sub-agent contract: committed app `c840815`, published agent-cli
  `ff17213`. One normalized child event replaces duplicate Codex decoding.
  Review found a duplicate line for a known childless Codex completion; agent-cli
  `0a1d0cb` adds its explicit phase, and app `8b12230` suppresses that completion's
  presentation after policy guards consume it. Agent-cli `19cbd3f` includes the
  concurrent Claude catalog-label update and passes 286 tests plus typecheck.
- Typed content + retired team-config output: Sol `typed_content`. Ordered
  content parts replace text/marker round trips across live/history/consumers.
- Diagnostics: Sol `diagnostics`. One typed indexed attempt store replaces
  the journal/replay/map/polling stack while retaining history and recovery.
- Records: Sol `records`. Native record types constrain the TS boundary;
  remove redundant bridging and unused APIs without dropping provenance.
  Integrated as `493bf27`: 154 net source lines removed across TypeScript and
  Rust, with historical Buddy metadata and branch-launch round-trip coverage.
- Parent owns integration, historical sub-agent audit, importer-retirement
  evidence, and combined verification. Agent design notes contain deletion
  lists and preserved behavior. Desktop/mobile interactions stay separate.

## Historical sub-agent audit

Only the Claude and Gemini parsers construct `SubAgentFold`. Codex history
returns an empty sub-agent list. Its generic-fold `spawn_agent` classification
and description branches were unreachable, so remove those branches; retain
Claude/Gemini inference. Do not fabricate native child completion from parent
history. Full Codex child-history reconstruction is an existing feature gap,
not a second decoder this simplification can delete. Live native state remains
covered by the canonical-event integration tests.

## Already completed retirement

Commit `d445d4a` already removed the one-time importer crates and TS record
migration after the successful cutover. This work claims **zero new deletions**
for that prior retirement. The source for the necessary scheduled-run fix is
preserved by `archive/t15-importer-93367be`; its backup binary matches the
recorded SHA-256 `b1c4fd414fbbf0063fbe09107b3f1ad2110a26b984a2bc0ea0bff174729981f7`.
The runbook and current recovery message previously pointed to `03fc931`, which
predates that fix; point recovery at the corrected archive. No data import,
backup deletion or runtime restart is needed for this audit.

## Completed integration

All four replacement slices are integrated. The final audit also repaired text
projections that could omit prose inside typed parts: context estimates, labels,
retry/creation input, and current-turn completion after a tool event. Display and
fork export share first-message prefix removal. Canonical plain native text has
the same body as live text, preserving history matching. Regression tests cover
these boundaries; no desktop/mobile shell consolidation was performed.

The message-body wire change is protocol **4**, using the existing mismatch and
reload mechanism. Older tabs must reload when the new backend is deployed. New
client code preserves its rows during backend version skew.

## Source accounting

Compare the app with `c296f842df70cb58d7803d890469c88c36d65796` and agent-cli
with `af398dbcb8e60bcdad162ccc73930631147ebf1c`. These baselines exclude the
concurrent Claude catalog-label changes, which the integration preserves.
Counts are tracked `git diff --numstat` source lines, including formatting and
comments, across both repositories; the submodule pointer is not a source line.

| Category | Added | Removed | Net |
| --- | ---: | ---: | ---: |
| TypeScript/JavaScript source | 2,021 | 2,561 | -540 |
| Rust source | 518 | 682 | -164 |
| **Production source total** | **2,539** | **3,243** | **-704** |
| Tests and benchmark harnesses | 1,163 | 621 | +542 |
| Generated declarations | 12 | 12 | 0 |

Documentation is excluded from production/test totals. CSS did not change.
The diagnostics slice alone adds 96 source lines overall (TS -262, Rust +358):
its benefit is one durable indexed authority and fewer replay/polling paths,
not a line-count win. No deletion is credited for the already-retired importer.
This completes the agreed slices, not the historical whole-app 3–4x reduction.

## Verification

The app source candidate is `07e649de69ef8e7937984d33d57de9e4c501e34b` with a
clean worktree. The following closeout commit changes only this report.
Agent-cli is `19cbd3f1d1f06256209842eb3e79173b5c5e0f25`, verified clean and
published to its remote main before the app.

- Full app typecheck passes, including server/client tests and client project
  references. Production build and the built-server package smoke pass; the
  latter uses temporary data and verifies native addons, catalog, client serving,
  and a Buddies write/read.
- Server: 218 pass, one opt-in live memory benchmark skipped. Run with Node test
  concurrency 2 so unrelated suites do not consume the short watchdog budgets.
  The initial fully parallel run exposed stale fixtures plus two timing failures;
  those timing cases also pass individually without changing their deadlines.
- Client: 195 pass. All nine client invariant gates pass; CSS stays 12,936 lines.
- Agent-cli: 286 pass and typecheck passes. Native ingest: 55 functional Rust
  tests and three Node addon boundary tests pass. The generated declarations
  match the committed source.
- Changed-file formatting/import checks pass for 84 files; diff checks pass.
  This is not a claim that the repository's unrelated baseline lint issues vanish.
- Native watch latency remains above its unchanged 30 ms test threshold. Fair
  alternating runs used separately built binaries: unchanged app baseline
  medians 74.8/68.2 ms, candidate 69.7/64.9 ms. Both fail the threshold; no
  candidate regression was measured. No source or threshold was altered to hide it.
- Phone/desktop chat and thread screenshots were reviewed against the same live
  backend. See the typed-content note for paths and limitations; these are frontend
  visual checks, not evidence of a new-backend deployment.
- Token-audit snapshots before/after show 0.7% estimated excess and an 11k median
  Buddy start cost in both. The running code did not change, and the sample grew
  from 249 to 274 sessions, so this does not establish token savings.

Logs are `/tmp/unleashd-deslop-verified-{typecheck,package,server,client,invariants}.log`,
with native/addon evidence in `/tmp/unleashd-deslop-final-{native,addon}.log`.

## Publication and remaining limits

Publish the tested integration by fast-forwarding remote main. The shared main
checkout has concurrent uncommitted UI and Buddies work; leave its files, index,
branch position, and live server untouched. No live-data cutover or restart is
part of this publication. At the next authorized deployment, diagnostics imports
the legacy journal transactionally while preserving its source files.

The watch timing threshold, opt-in live memory benchmark, and pre-existing Codex
historical child reconstruction gap remain explicitly unverified or unresolved
as described above. Backups, recovery tools, and unrelated work are retained.
