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

The combined application passed typecheck/package build, 211 server tests (one
skipped), 191 client tests, 15 development-runtime tests, five tooling tests,
286 agent-cli tests, 16 API tests, 94 Rust tests and all nine client invariants.
The first run exposed three stale effort-default expectations; these were updated
to the newer source branch's intentional medium default and affected suites rerun.
No application behavior was changed to silence those tests.

Copied-real-data visual review inspected 31 initial captures and 10 reshoots.
Settings icon, worker heading, swarm review cycle labels and the screenshot
helper were corrected in 188c5c4. Client build/typecheck and affected tests were
rerun. See [CLOSEOUT-QA.md](CLOSEOUT-QA.md) for evidence and limits, including a
minor preexisting desktop swarm settings/header overlap. Archived-channel
mutations have Rust/HTTP/MCP test coverage; no real archived row was available
for a screenshot. Private screenshots stay in the local cache.

All source branches are included in integration history. Legacy source branches
were joined only after their behavior ports were checked; importer/Cursor lane
commits were exact patch equivalents. Agent-cli main is 7983ed4, pushed and pinned
before the outer release. The release subtree matches source 086c097 byte-for-byte.

The live switch is separate from publication. This closeout session is a child
of the old backend, so stopping synchronously would kill the operator mid-cutover.
A detached controller waits for foreground conversations and all process-local
queues to become empty, then performs the already-authorized runbook. Its status
is authoritative at:
`/Users/nicholasbardy/unleashd-t15-backup-20260927T153100/cutover-status.json`.
A missing or waiting status does not mean migration is complete. It preserves
queued background work, verifies imported data and exported bytes, and starts the
prepared legacy checkout on a failure after shutdown. It creates no synthetic
Buddy work and explicitly records whether a natural memory write was observed.
The prepared rollback checkout is
`/Users/nicholasbardy/git/.codex-worktrees/unleashd-rollback-086c097`.

## Size accounting

The closeout adds about 1.75k tracked application-source lines relative to earlier
main 1d6c9fb. Most is preservation of already-written upstream/settings, archive,
workers and picker features from the old branch, not another refactor pass.
Using the same server/client/shared/Rust-runtime paths, the merged application is
about 77.3k lines versus 106.1k on legacy 086c097 (about 27% smaller). This excludes
tests, docs, launch assets and the old vendored Buddies package, and is not a claim
of the original 3–4x target. No new domain table or parallel Buddy authority was
introduced during closeout; archive is a field on the canonical channel and
worker inspection uses the existing row/detail/resource authorities.

## Deliberately deferred

- Deleting classic chat or the quarantined swarm UI.
- Further CSS/line-budget rewrites and optional feature removals.
- Reconstructing historical failed memory reviews or adding a retry subsystem.
- Removing one-time import tools before a successful, retained migration backup.
- Claiming new performance numbers without remeasurement; the old reports remain
  dated evidence of their specific test conditions.
