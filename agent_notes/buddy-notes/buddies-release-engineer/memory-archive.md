# Buddies Release Engineer memory archive

Memory copies superseded when the Buddy's memory folded to one doc per kind (the newest copy was kept). Oldest first.

## 2026-09-12T15:58:19.716Z — working (buddy buddy_247e963c-a7d8-48e7-a601-9309ea8b448f)
_revision 1, buddy_memory_heads memory_revision_e315fbd2-df35-4c02-a5d3-ee90d34ff490_



## 2026-09-12T15:58:19.717Z — long_term (buddy buddy_247e963c-a7d8-48e7-a601-9309ea8b448f)
_revision 1, buddy_memory_heads memory_revision_ad0f38b1-baa7-48c1-b726-9c40ed0a879a_



## 2026-09-16T04:06:36.273Z — long_term (project buddy_project_a2047be3-f8cb-4eed-ac2e-522e3831bee6)
_revision 1, buddy_knowledge knowledge_5ca03385-2d21-4564-bead-2c0f9dec7354_

- Buddy completion evidence: criteria edits should preserve omitted historical evidence references; retain done→reassessment, explicit replacement, and idempotent replay semantics.
- Preserved historical evidence must not be revalidated against current length limits during unrelated criteria edits.
- Detached-grantee access revocation may use global Buddy existence for audit attribution only; authorization and workspace checks remain project-scoped.
- Release provenance must distinguish canonical dirty/newer package source from installed/archive snapshots; revendor from the canonical repaired source and record exact hashes.
Evidence: note `2026-09-16T04:06:30.704Z:b6ff191a-9bf1-4b7c-83e4-4fd2c6d82fc1`.

## 2026-09-22T05:58:38.221Z — long_term (workspace project_26fce156-5c5d-4dd9-a9d6-4b527a50af3c)
_revision 1, buddy_knowledge knowledge_f258d1ba-7320-4391-89b1-7231843f7409_

- In Unleashd project updates, omitted `evidence` is preserved by package-store `??` merging; an explicit `evidence: []` clears prior evidence. Normalize explicit empty arrays to omission at server funnels when preservation is required. Confirmed in supervised UI Task 95592e35; fix 7966f22, boundary regression 2 pass/0 fail, server typecheck passed. Detailed evidence: note `2026-09-22T05:58:32.628Z:6cc5f08f-c5be-4ae9-9fa7-e1cd22c25176`.

## 2026-09-25T15:00:47.089Z — working (owner_thread 0cb14212-aba6-512f-b3db-597189284d18)
_revision 1, buddy_knowledge knowledge_ad017443-2ff7-4a64-933e-cd7b36350112_

Branch state as of Release Engineer wake-up 2026-09-25T14:59Z. Git checks were the assistant's, not re-verified here. Owner has not accepted a merge.

- origin/main = f6cc2ca (merge from lean/integration). Lead local main 37c9f7e diverged, 8 commits each side. Normal push of local main would be rejected; force push would drop lean work. No branch was moved.
- Original exec-selection commits fdcc8a3, e4254ce, cb7a4d2, 00557ac are not in origin/main, lean/integration, or the checked-out Channels branch. They are on local main and origin/feat/execution-selection-2026-09-24.
- Earlier note says that branch was replayed onto Channels as f090910, 439d28b, 6a60615, 02c48c8 (composer removal and 5s polling dropped). This wake-up did not check those SHAs, so missing original SHAs does not show the replay is missing.
- FIFO 4ae9385 is in origin/main, lean/integration, and Channels. origin/lean/integration was 31 commits ahead of the checked-out Channels branch.
- Proposed only: merge execution selection into lean/integration, then fast-forward main. #general reply to post_f4605e2d; Lead message_b190d373 queued buddy_run_0b0d1bfc.
- Mobile Channels header/input spacing (~14:55Z) left for UI. No new Task.

Evidence: agent_notes/2026-09-25_branch-audit-and-slow-new-conversations.md; note 2026-09-25T15:00:38.074Z:faab6c25-efc1-4e45-b70e-29eb3bc50b28.

## 2026-09-25T15:11:37.701Z — working (project buddy_project_800c708b-9c56-43c3-b5a1-af4876155be8)
_revision 2, buddy_knowledge knowledge_094ecc41-46fb-42f2-8da1-d1980afe248f_

Checks on merge 7f7537a are assistant-reported only (absent from project evidence; not independently checked). The earlier reading—server 450 pass / 1 fail / 5 skip in server/test/shutdown.test.ts, also failing on origin/main's copy, pushed anyway, project left in review—is superseded by the assistant's later account: the fail was inherited WATCH_REPORT_DEPENDENCIES=1 (note 2026-09-25T15:10:26.792Z:53cc0780-b505-4a61-88f8-8f4a2e7c4aa8). With that unset, the assistant reports typecheck pass, client 160/160, server 451/0/5, then marked the project done. Do not treat the green run or the clean-worktree claim as verified.

## 2026-09-25T15:11:43.898Z — long_term (project buddy_project_800c708b-9c56-43c3-b5a1-af4876155be8)
_revision 2, buddy_knowledge knowledge_c66cc2a6-aa85-403f-9d2b-5ffa41e0c7dd_

Owner guardrails for carrying execution selection into lean/integration (owner message on this project): base a separate worktree on origin/lean/integration, not local lean/integration (then e721900); never stash; reuse 204da80/00557ac resolutions, but if the lean rewrite deleted the touched code, port behaviour onto lean code or stop without a half-resolution; do not move local or origin main (owner's call).

Confirmed carry (project evidence, rev 2, 2026-09-25; assistant report agrees): merge 7f7537a (parents 81c21d1 = origin/lean/integration, 00557ac = origin/feat/execution-selection-2026-09-24) fast-forwarded origin/lean/integration 81c21d1..7f7537a. History-only: write-tree equals 81c21d1^{tree}. Lean already replayed fdcc8a3→f090910, e4254ce→439d28b, cb7a4d2→6a60615, 00557ac→02c48c8 (range-diff 756cc35..00557ac vs f090910~1..02c48c8). Not carried: only e4254ce D3 deletion of the Mailbox post-as-Buddy composer; d382234 restored it under the owner keep-features rule, and the lean EXECUTION_SELECTION doc marks D3 SUPERSEDED. 13 conflicts resolved to lean, plus the auto-merged BuddyMessages.css hunk undone so composer CSS stayed. 204da80 resolutions did not apply. origin/main stayed f6cc2ca.

Verification lesson (assistant experiment, 2026-09-25; note 2026-09-25T15:10:26.792Z:53cc0780-b505-4a61-88f8-8f4a2e7c4aa8): shells started from the unleashd dev server inherit WATCH_REPORT_DEPENDENCIES=1, which makes server/test/shutdown.test.ts fail with write EPIPE (child exit 1). Not a product regression. Unset the variable before pnpm test:server. The same failure was reproduced on origin/main's copy of the test under that env. Stripping the var in the test's spawn() was an assistant proposal, not done and not owner-accepted.

## 2026-09-25T17:56:38.926Z — working (owner_thread c08177cd-a907-5c34-a13a-93faed7d11b8)
_revision 1, buddy_knowledge knowledge_8ec73d25-2b5f-48d0-9c11-169bbd9784e4_

2026-09-25 Channels launch kickoff is on project buddy_project_0bcad28f-2855-4007-bf01-d4384e0376b4. Assistant claims script/shot list written and uncommitted at product/releases/UNLEASHD_2_0_LAUNCH_2026-09-26.md; file presence and commit state were not independently verified. Evidence: note 2026-09-25T17:56:33.941Z:83643bcc-c5d7-4449-989e-a5531229169e.
