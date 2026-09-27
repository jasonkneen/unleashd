# T15 v34 rehearsal and operational evidence — 2026-09-27

Importer d553cf4 (integration cherry 5625ca2), with nullable archive schema prerequisite
96e6bf5, passed all seven importer integration tests. The fixture applies the real v33→v34
migration, tests non-null archive timestamps, running/queued preservation, builder receipts,
verifier tampering and refusal of unknown versions/malformed source shape. Builder hires
predate v19; they are not a new v34 table. Source provenance: legacy Buddies
7ee9d221981e609d43f56c1d72082e0ee0d1ceb3 → b67269410dcff0ea05a37891bdf66c8718265c6e;
v34 adds `buddy_lists.archived_at TEXT`, mapped to `channel.archived_at`.

A fresh SQLite snapshot was taken using URI `mode=ro` plus `query_only`, imported into a
throwaway target, verified, and note export **planned only**. Source SHA-256 remained
`a4dc8ca014287d8c9a2cfc2959c2240974923ea546567087687486f388b91d6c`.
Import, verification and export-plan commands all exited zero. Temporary DBs were removed;
no live Store, model call, export, queue mutation or restart was performed by this lane.
Detailed reports remain local at `/tmp/unleashd-closeout-import-evidence/`.

| Verified mapping | Snapshot count |
| --- | ---: |
| Workspaces / Buddies / tasks | 16 / 57 / 1,688 |
| Public / direct / task channels | 38 / 70 / 190 |
| Channel members | 135 |
| Direct posts (including replies) / answered requests | 947 / 286 |
| Public / task posts | 821 / 1,030 |
| Unified memory docs / revisions | 171 / 332 |
| Runs / conversations / events | 2,972 / 1,136 / 24,086 |
| Builder hire receipts | 48 |
| Queued / running records preserved | 32 / 4 |
| Export plan files | 195 |
| Note sections / superseded memory sections | 1,135 / 564 |
| Memory archive files (included in 195) | 30 |

There were no archived public channels in this live snapshot; fixture tests cover non-null
archives. Soul results: 50 match, 4 match after header normalization, 3 empty/no-path. All
planned export paths were absent. Figures describe this rehearsal, not a fixed cutover count:
parent's later observation was 34 queued and one running message request, with no running
legacy automation. Re-snapshot and reconcile at shutdown.

Rehearsal binary: `~/.cache/unleashd/closeout-import-target/debug/buddies-import` from d553cf4;
`CARGO_TARGET_DIR=~/.cache/unleashd/closeout-import-target`. Parent subsequently built release
CLIs from c2ca9d6 in `~/.cache/unleashd/cargo-target` and copied to `~/.cache/unleashd/bin/`:

| Binary | SHA-256 (parent build evidence) |
| --- | --- |
| buddies-import | 5960504816a4b7807d8deff521172d2f3ca5774bb7ab23d3f1b342b3f3985e5a |
| records-tool | 603aec345e5b756f65af6266594a47a4903c2dac77cbe98b5a2ea44309fa8455 |

Operational source review: `tools/dev-supervisor.mjs`, `tools/watch-server.mjs`,
`server/src/lifecycle/shutdown.ts`, `server/src/constants/timeouts.ts`, legacy
`server/src/buddies/scheduler.ts`, lean `server/src/buddies/runner.ts` and
`crates/unleashd-buddies/src/runs.rs`. Source reload waits for idle and replaces the backend;
explicit shutdown interrupts active work, with 3-second release and 5-second flush defaults.
The legacy live supervisor/backend started September 26; parent traced that launch to root
028bbc0 in the reflog. Rollback pins 086c097, the clean v34-capable legacy tree, because an
older bundled package can reject today's v34 DB. This compatible rollback does not claim to
reproduce the earlier in-memory source and is independent of another session's source edits.

The revised runbook preserves queues, source/config/cache/reads/reviewer receipts, verifies
source hashes, exports both note and memory-archive files, and checks actual export hashes.
`export-manifest.rs` calls the canonical renderer and only writes a new manifest; it does not
export or mutate a DB. Its synthetic v34 smoke check passed: missing export rejection, successful real-byte hash
verification, tamper rejection and existing-destination rejection. Seven runbook bash blocks
passed `bash -n`; the helper compiled offline and passed `rustfmt --check`.
No live exported bytes have been verified yet: that is a cutover gate after export. Historical
failed reviews do not acquire missing output through migration; their existing receipts remain.
