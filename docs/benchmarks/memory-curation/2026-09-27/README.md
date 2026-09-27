# September 26 memory benchmark, preserved September 27

The saved full run contains **28 reviews: 14 actual cases × 2 repeats** (there
is no case I). Its original automated outcomes are **25 checks-passed,
2 checks-failed, and 1 infrastructure failure**. These are not 25 semantic
successes. No model was run, retried or regraded with a changed rubric during
this closeout.

The source is `/tmp/membench/full`, from clean app commit
`6505330a002cf58f2b2d5962c85cec4cbf31c099`. Every receipt names Cursor
`grok-4.7-low` after Codex `gpt-6-luna` reported `out_of_tokens`; these results
do not measure Luna quality. The fixed ladder was Luna → Cursor Grok → Claude
Sonnet → Muse contributor, all with `low` effort and 300 seconds per rung.

## What failed, and what the checks missed

| Result | Original automated outcome | Evidence and interpretation |
|---|---|---|
| A.r1 | infrastructure | Cursor emitted `{"type":"connection","subtype":"reconnected","session_id":"d191a6db-16f6-4888-9a78-8fe2d3b9c4d5","timestamp_ms":1790420824355}` after answer text. The parser called it an unknown event and the reviewer failed. This remains an infrastructure result; text emitted before failure is not a completed review. |
| A.r2 | checks-passed | Both docs remain byte-identical at revision 1 and the reviewer reports NONE. This fails A's frozen rubric requiring duplicate cleanup even without new information. The current instructions say nothing new → NONE, so prompt and old rubric conflict. |
| O.r1, O.r2 | checks-failed | Both preserve uncertainty about shards 3–4: commands have no results, and the seeded log confirms only shards 1–2. The rubric demands confirmed progress not established by the fixture. `occursOnce: reindex` also counts the command name, not just work items. Preserve these failures; a future approved fixture/check correction needs a new version. |
| C.r1, C.r2 | checks-passed | Inspection also found an unresolved rubric conflict: the old rubric asks to remove transient pending status, while both outputs retain the still-unverified worker return in working memory. No semantic pass is assigned in this closeout. |

[grades.json](grades.json) preserves every original automated outcome and
labels the limited manual review above. Other rows are **not manually graded**;
there is no aggregate semantic score or quality-acceptance claim. Full manual
grading and any owner-approved alignment of old rubrics with the new two-doc
instructions remain separate work. The September 13 19/20 result belongs to
its older prompt and case set.

## Narrow infrastructure correction

Agent-cli commit `873d56d` recognizes only the observed
`connection/reconnected` event as progress. It preserves the current assistant
text/session state and still rejects unknown types and connection subtypes.
The process-boundary Cursor test includes reconnection between duplicate text
snapshots and checks one answer, one session, progress and no errors.

The supplied wording `402 Billing verification failed` was also tested through
a stderr-only shim. It remains `error`, not `out_of_tokens`: verification failure
alone does not establish exhausted credits. No raw 402 message appears in these
benchmark artifacts; this test is not evidence of a second benchmark failure.
There is no new retry mechanism or broader fallback policy.

Validation: eight focused Cursor contract tests and agent-cli typecheck passed.
The new reconnect assertion failed before the parser correction. This is
deterministic infrastructure coverage, not a rerun of A or the full benchmark.

## Provenance and preservation

- Instructions SHA-256: `01b2e3553c44c3963fbcce74075a9a10d18ee3f067ecfda881ed3f02ed7847c1`.
- Cases SHA-256: `a2f766c9e93d04972426af12dbbce03ae53161eb47466e8ecca3c0f9829eba95`.
- Harness SHA-256: `9659a0bd9ce487c2bb63f8afa9dccc177d44ecb84f7f29d8d0f663675fe3a4f1`.

The original 28 result JSON files plus `summary.json` are copied byte-for-byte
under local-only `results/`. Source files from the recorded commit are under
local-only `sources/`. [sha256.json](sha256.json) records their hashes and those
of this report and the grades. Git includes the report, grades and hash manifest;
raw artifacts remain gitignored, following the [runbook](../../../../server/test/fixtures/memory-curation/README.md).
Provider CLI versions and token/cost accounting were not captured in the saved
provenance and are not reconstructed here. The inputs are synthetic, not copied
production memories. Grader/archive author: Codex; manual inspection is unblinded.
