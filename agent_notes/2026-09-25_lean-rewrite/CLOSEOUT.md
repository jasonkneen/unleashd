# Lean refactor closeout — 2026-09-27

This supersedes the open/merged status in the historical PROJECT and FINAL-REPORT
snapshots. Those documents retain the original measurements and decisions.

## Scope

Finish the already approved rewrite and preserve subsequent work from the old
checkout. No new line-budget passes, chat-pane rewrite, swarm deletion or feature
cuts. Classic chat stays available for thread inspection, deprecated for new
product work (docs/architecture.md).

The consolidated model, native Buddies/ingest/records implementations, HTTP MCP,
runtime split, protocol v3, shared client views and memory unification were already
on main at 1d6c9fb. The original 3–4× line target was not achieved. Further cuts
are deferred product/rewrite choices, not missing closeout work.

## Source work preserved during closeout

| Original work | Destination |
| --- | --- |
| 0914a8b, 538857e upstream workspace/update thread/settings | b90a375; real Rust/HTTP/git tests |
| 3278d76 HTTPS submodule install | ff0702f |
| c93852f shared build stays readable during rebuild | 8b2b2d2 |
| 7b484c6 phantom Codex resume | 8da66d1 + 8dd0bc5 in the split runtime; stdio bundle half is obsolete because HTTP MCP replaced it |
| 2a07227 picker/profile defaults and reasoning slider | 146debd in shared config views; explicit saved models/efforts remain valid |
| Source launch/ethos/assembly work through 086c097 | Release subtree preserved byte-for-byte; no video redesign |
| v34 channel archive source | Rust channel archive plus importer compatibility; no old JS package restored |
| Worker visibility through 675b134 / 88a89e0 | Shared Buddy/channel worker surfaces; 88a89e0 is an exact duplicate checkpoint |
| 53ebe1c mobile archive | Included in the 2a07227 snapshot; ported once |

Runtime-source branches may be joined by ancestry-only merges **after** the port
checklist is verified. This records the preserved work without restoring deleted
legacy modules. Source snapshots remain recoverable in history.

## Memory evidence and limits

All turns and the Memory UI now use one soul, working memory and long-term memory
per Buddy. The import folds scoped copies and archives the other copies. It does
not reconstruct learning from historical failed/interrupted reviews.

The original benchmark was 14 cases × 2, not 15 × 2. Its 25 automated passes are
not a perfect semantic-quality result. Original grades, conflicts and hashes are
in `docs/benchmarks/memory-curation/2026-09-27/`. The observed Cursor reconnect
parser failure is fixed by agent-cli 873d56d. Billing verification failures remain
ordinary failures; all-model-failed reviews are not replayed automatically.

Fresh v34 rehearsal verified 57 Buddies, 38 public channels and 48 builder receipts;
queued/running rows were retained. These are snapshot counts, not live constants.
The operational runbook rechecks counts at shutdown and verifies exported note
and archived-memory bytes as well as the new databases.

## Release completion evidence

Pending final combined gate, real-data screenshots, branch publication and live
switch. Do not interpret committed/pushed code as a deployed database migration.
This section is updated with exact commits and results at completion.

## Deliberately deferred

- Deleting classic chat or the quarantined swarm UI.
- Further CSS/line-budget rewrites and optional feature removals.
- Reconstructing historical failed memory reviews or adding a retry subsystem.
- Removing one-time import tools before a successful, retained migration backup.
- Claiming new performance numbers without remeasurement; the old reports remain
  dated evidence of their specific test conditions.
