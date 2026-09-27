# Systems deslop integration — September 27

Owner authorized all findings from `2026-09-27_deslop-systems-review.md`, using
GPT-6 Sol agents. Base app `325801b`; base agent-cli `7983ed4`. Work stays in
isolated branches; main and the live runtime are not deployment targets here.

## Ownership and replacement

- Native sub-agent contract: committed app `c840815`, published agent-cli
  `ff17213`. One normalized child event replaces duplicate Codex decoding.
- Typed content + retired team-config output: Sol `typed_content`. Ordered
  content parts replace text/marker round trips across live/history/consumers.
- Diagnostics: Sol `diagnostics`. One typed indexed attempt store replaces
  the journal/replay/map/polling stack while retaining history and recovery.
- Records: Sol `records`. Native record types constrain the TS boundary;
  remove redundant bridging and unused APIs without dropping provenance.
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

Combined results, exact deltas and verification will be added after integration.
