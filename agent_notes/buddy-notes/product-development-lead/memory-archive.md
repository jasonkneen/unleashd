# Product Development Lead memory archive

Memory copies superseded when the Buddy's memory folded to one doc per kind (the newest copy was kept). Oldest first.

## 2026-08-29T09:31:27.461Z — working (buddy buddy_e0527b5c-e467-45b7-b5fe-0265c51402b4)
_revision 1, buddy_memory_heads memory_revision_cfcd4285-795b-4de2-896e-f3048fdf9b30_



## 2026-09-10T12:51:00.807Z — long_term (buddy buddy_e0527b5c-e467-45b7-b5fe-0265c51402b4)
_revision 11, buddy_memory_heads memory_revision_09518c3d-8c62-49e4-9074-4a585e8e68ab_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-12T08:59:05.127Z — long_term (owner_thread 43856713-4620-4ccf-b07c-2b7a2b8be4d1)
_revision 1, buddy_knowledge knowledge_41268400-b0ab-43c5-8c55-7996a4e8d109_

Confirmed engineering lesson: shared async cache hooks must use React’s external-store subscription contract (useSyncExternalStore) with a monotonic snapshot/version so consumers cannot miss a publish between render and subscription. In the harness picker, the apparent slow load was this client render-to-subscribe race, not backend latency; closing the modal merely triggered a re-render that revealed cached data. Evidence: existing note `2026-09-12T08:58:38.215Z:193ce51f-352b-48e2-a182-09deae6c83a8`.

## 2026-09-13T03:38:48.836Z — long_term (owner_thread 2612856e-dfae-487d-8a94-5d2119b76212)
_revision 6, buddy_knowledge knowledge_5893f088-855d-47a3-99c7-8ab3d73e1f45_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload (order, duplicates, cache recovery); labels distinguish tool-only vs prose/mixed activity. Hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them. Recommended-plugin filtering removes only the complete untagged startup envelope, preserving explicit/later user messages and invalidating old caches. Evidence: agent_notes/20260910T083219Z..., 084220Z..., 091804Z....

## 2026-09-10
Owner accepted compact tool-history styling: tool activity reduced spacing; adjacent assistant prose may share a block, fresh header after user messages. Chat/tool parts form one assistant response block with one outer container and Copy; streaming/completed tools share expandable “▸ N tool calls”. Verified live DOM, desktop/mobile, tests/typecheck.

## 2026-09-12
Capacity rejection must not strand user messages: retain one pending message, retry admission, auto-start when capacity frees, accurate diagnostics. Evidence note knowledge_3f187835-dfea-407f-870f-24fbb30dd2fd; do not infer rollout beyond post-drain adoption.

## 2026-09-12
Run admission: 2 active runs/Buddy; 8 system-wide. Per-Buddy count includes claimed, running, cancel_requested and foreground/background. Evidence note knowledge_b29eef37-7185-4e52-8cbb-4a1728840972.

## 2026-09-12
Owner accepted compact project-header running indicator (“1 running”/“N running”), even collapsed; counts foreground/background. Evidence note knowledge_02ee8dac-afc0-4b59-a268-c17c0ccc818e.

## 2026-09-12
Workspace activity view: workspace name opens /buddies/workspaces/:workspaceId separately from collapse; lists Buddies/jobs/idle states with direct links and labels. Durable records include starting/running/stopping; claim tokens excluded. Server was not restarted during drain; do not infer rollout before normal reload. Evidence note knowledge_230b9054-4c73-41fe-95f4-78abedc8024b.

## 2026-09-13
Owner direction: expensive models for lead planning/review, cheaper models for worker execution, with compact task/result handoffs to keep context and tokens lean. Durable self-background work currently inherits the Buddy model and lacks per-job model/reasoning override; persistent workers can have independent saved models. Per-run override and higher configurable global concurrency are proposed, not accepted. Fuller evidence: note knowledge_71c4d390-3a5c-42a3-b3c9-4298d602dc91.

## 2026-09-13T03:43:49.288Z — long_term (owner_thread fdb5aa70-b067-4ef2-9502-92541ab69c55)
_revision 3, buddy_knowledge knowledge_1f7084e3-9fcd-4a3c-95c5-ee289281b799_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain bounded; shutdown drain/flush grace periods plus 8s force-drain; retryable 503; upload retries once. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; preserve label alignment/hierarchy. Sidebar divider is one subtle solid line after project name, not a leading dashed rule.

## 2026-09-10
Codex history preserves streamed tool calls through JSONL/cache reload, including order, duplicates, and recovery; labels distinguish tool-only vs prose/mixed. Verified real transcript (21/21), 24 server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S... and ...080336....

## 2026-09-10
Saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering/Copy support literal exec previews/full scripts and safe markers. Saved-input/cache, desktop/mobile, typechecks, regressions, and live checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E... and ...084839....

## 2026-09-10
Filter only the complete untagged recommended-plugin startup envelope; preserve explicit/later user messages and invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV....

## 2026-09-10
Owner accepted compact tool-history styling and one singular assistant response/message block for ordered chat→tool→chat→tool parts, one outer container and Copy, ending at next user/system message. Streaming/completed tools share one expandable “▸ N tool calls” row. Verified DOM, desktop/mobile, 70 tests/typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS....

## 2026-09-10
Streaming/completed tool activity shares compact row, spacing and input rendering; counts grow, segmentation preserved, tool-like user/code text untouched. Verified live, regressions, typecheck/gates/diff. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V....

## 2026-09-13
Conversation creation can hit a 2-active-run capacity guard, not a max-conversation cap. Retries about every second, may remove the visible user message, shows only generic queued status, and lacks FIFO fairness; the 50-conversation inbox cap is display-only. Fuller diagnosis, IDs, and evidence: note knowledge_21bccddd-f4c6-475a-8e7d-d88046df322c. No fix or owner acceptance evidenced.

## 2026-09-13
Engineering handoff documents the policy and next steps: background limits must never block foreground owner conversations; separates background throttling, same-conversation serialization, and host safety ceiling. Handoff: /Users/nicholasbardy/git/unleashd/agent_notes/2026-09-13-foreground-buddy-capacity-handoff.md. Documentation only; no runtime fix or tests. Fuller recap: note knowledge_0df6bc16-9ca4-4525-9bb5-9b8d439fe7fc.

## 2026-09-13T07:09:56.450Z — long_term (owner_thread 988942c3-91ca-4e7f-b675-04f502dfd276)
_revision 3, buddy_knowledge knowledge_14cc36f1-ae11-4846-bcef-d165d95ec051_

## 2026-08-20
Never git reset --hard, filter-branch, or rebase -i on shared branch mobile-fixes-and-audit-2026-08-18; use stash/throwaway branch. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Buddies cards sort by recentRuns.lastActiveAt; sidebar uses restrained two-layer Buddies/threads hierarchy and shared headers/rules.

## 2026-08-20
Reload drain must be bounded: shutdown drain/flush grace periods, 8s force-drain, retryable 503, one upload retry during drain, bounded watcher restart.

## 2026-09-09
Owner prefers elegant, restrained UI; preserve label alignment/hierarchy. Sidebar divider is one subtle solid line after project name.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, cache recovery, and inspectable scripts/commands/JSON arguments. Expanded rendering and Copy support them. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md; agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md.

## 2026-09-10
Filter only the complete untagged legacy recommended-plugin startup envelope; preserve explicit/later user messages and invalidate old caches. Native replay had zero setup rows and 147 tool calls. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted one singular assistant response block for ordered chat/tool parts, one Copy action, and one compact expandable “▸ N tool calls” row shared by streaming/completed activity. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-13
Observed incident: restart did not clear stale per-Buddy admission/capacity state; restored queue resumed a one-second starting → spawn_failed → queued storm across boots while another Buddy worked. Restart alone is insufficient containment. Earlier evidence: note 2026-09-13T06:59:56.554Z:1060fe30-1d95-4709-8960-578d0757b0c8.

## 2026-09-13
Confirmed implementation lesson: foreground owner chats must be excluded from background concurrency limits; restart recovery must release drained foreground claims even with a queued replacement; unexpected admission failure must preserve input and fail once, not poll every second. Package commit 03638bdbcf778a63de22b227aa76099b0f1c8761; archive SHA-256 a220b3fa670d3918be9cf64035e0fba6ddf6d25c753af3af16d4675fc842e815. Tests reported 100/100 package, 27/27 focused runtime/background, 3/3 additional, plus server typecheck. Live adoption/recovery remained unverified because the running server was still the old process. Evidence: note 2026-09-13T07:09:37.817Z:a4079162-60c4-4ba3-8b6c-a79b3e66157c.

## 2026-09-14T03:59:24.177Z — long_term (owner_thread 88d1c550-60bc-4019-924e-dfffe0b9a501)
_revision 3, buddy_knowledge knowledge_3a05dc79-0203-47b8-9d0a-7dfbd21119d7_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18. Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded: shutdown drain/flush grace periods, 8s force-drain, retryable 503, one upload retry; watcher boundedly restarts unexpected exit(0).

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider is one subtle solid line after project name, not a leading dashed rule.

## 2026-09-14
Owner accepted the earlier desktop Buddy sidebar interaction: new-conversation “+” immediately left of conversation-status icons in a right-side absolute overlay (no layout width); whole Buddy row clickable with the same full-width hover/active treatment as conversation rows; preserve keyboard focus and reduced-motion behavior. A later owner request asks to move the hover “+” over the Buddy head-and-shoulders icon instead, leaving status icons untouched; implementation was reported but not independently verified or owner-accepted in the available transcript. Evidence: note 2026-09-14T03:59:07.786Z:a9d88faa-426a-41e0-8add-7fc94cd2dcfc; conversation 88d1c550-60bc-4019-924e-dfffe0b9a501.

## 2026-09-10
Codex history preserves streamed tool calls through JSONL/cache reload, including order, duplicates, and recovery; labels distinguish tool-only vs prose/mixed. Verified 21/21 calls, 24 server tests, rendering/live checks.

## 2026-09-10
Hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them. Verified saved-input/cache, desktop/mobile, typechecks, regressions, and live calls.

## 2026-09-10
Filter only the complete untagged recommended-plugin startup envelope; preserve explicit/later user messages and invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls.

## 2026-09-10
Owner accepted compact tool-history styling and one ordered AssistantResponse block for chat → tool → chat → tool, with one outer container and Copy action; streaming/completed tools share one expandable “▸ N tool calls” row. Verified live DOM, desktop/mobile, 70 client tests and typecheck.

## 2026-09-10
Streaming/completed tool activity shares compact spacing/input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified focused regressions, typecheck, invariant gates, and diff/format checks.

## 2026-09-14T04:27:22.963Z — long_term (owner_thread 52ce5827-00eb-487b-a3fe-f9c627cd5daf)
_revision 3, buddy_knowledge knowledge_8800f97d-5f4a-4964-9c87-42d46cc3673a_

## 2026-08-20
Never destructive-rewrite shared branch mobile-fixes-and-audit-2026-08-18; use stash/throwaway branch. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
/Buddies cards sort by recentRuns.lastActiveAt; sidebar is restrained 2-layer Buddies/threads hierarchy with shared headers/rules and createConversation+buddyContext.

## 2026-08-20
Reload drain is bounded: shutdown drain/flush grace periods and 8s force-drain; retryable 503; one upload retry during drain; bounded watcher restart for unexpected exit(0).

## 2026-09-09
Owner prefers elegant, restrained UI with aligned labels/hierarchy; sidebar divider is one subtle solid line after project name.

## 2026-09-10
Codex history preserves streamed tool calls through JSONL/cache reload, including order, duplicates and cache recovery; hydrated saved messages retain inspectable scripts, commands and JSON arguments with expanded rendering/Copy. Recommended-plugin filtering is narrow to the complete untagged startup envelope and invalidates old caches. Owner accepted one ordered assistant response block across chat/tool interleaving, one outer container and Copy; streaming/completed tools share a compact expandable “▸ N tool calls” row. Detailed evidence remains in the 2026-09-10 agent_notes records.

## 2026-09-14
Shared agent-cli transport: assistant reported changing Codex launches to `codex exec … -` with prompts delivered through stdin, plus an isolated 2 MB (>ARG_MAX) process regression. Assistant reported 214/214 shared CLI tests and 32/32 Unleashd fork/runtime tests, typecheck/build passing; root package-smoke remained blocked by pre-existing dirty Buddies archive/provenance. Treat implementation and validation as reported, not independently verified. Evidence: note `2026-09-14T04:27:10.964Z:a4a6bf37-279e-4f0e-a69e-280a0f2c1141`; original diagnosis note `2026-09-14T04:18:01.115Z:34c3dae8-c967-4ac2-ae56-a6b74bc304ce`. Same-provider native fork transcript duplication remains an open inefficiency.

## 2026-09-16T01:57:14.910Z — long_term (owner_thread e6c483de-50f5-4897-9f87-af2c0d5872d8)
_revision 1, buddy_knowledge knowledge_034d14d6-ea51-4d40-8701-a21a3266a32c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-16T01:58:50.991Z — working (owner_thread e6c483de-50f5-4897-9f87-af2c0d5872d8)
_revision 1, buddy_knowledge knowledge_dafafafe-f609-4668-a6d8-6f29596c31db_

## Tailscale phone access — unresolved verification
The 2026-09-16 turn reported `https://nicholass-macbook-air-2.tail58a146.ts.net` (and the direct chat path) and gave Safari → Share → Add to Home Screen → Open as Web App steps. Treat the URL/live publication and iPhone connectivity as reported, not independently verified: transcript includes tool-call names but no returned outputs. Prior evidence (note `20260909T121205Z_01M231A71A4FZHX8R7T8MTTCZ3_tailscale-phone-access-hostname-mismatch_product-development-lead_c51402b4.md`) recorded the iPhone peer offline and phone-side access unverified.

## 2026-09-16T03:11:20.697Z — working (owner_thread f13fe788-e055-45c9-ab46-a58470869ab7)
_revision 7, buddy_knowledge knowledge_fefe199b-60a7-45ce-991f-417234a46c73_

## 2026-09-16
Assistant reported implementing selective client observability: authenticated journal endpoint; uncaught/promise/React boundary/root capture; dedupe; client 5/page-minute and server 20/address-minute limits; safe rejection normalization; restrained fatal reload UI; AGENTS.md/docs updates. Reported tests/build/typechecks/invariant/format checks passed, but this is not independently verified and changes were uncommitted. Evidence: note `2026-09-16T03:11:14.186Z:715f2385-007b-4489-9063-70a2196be9cd`.

## 2026-09-16T03:11:36.207Z — long_term (owner_thread f13fe788-e055-45c9-ab46-a58470869ab7)
_revision 6, buddy_knowledge knowledge_7f2f432b-752e-4088-8aff-3d7a374a4caa_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery. Names alone are insufficient: preserve inspectable scripts, commands, and JSON arguments with expanded rendering and Copy. Recommended-plugin filtering applies only to the complete untagged startup envelope. Owner accepted one ordered assistant response block for chat/tool interleaving, with one Copy action and compact expandable tool row shared by streaming/completed activity. Evidence remains in dated agent_notes references from 2026-09-10.

## 2026-09-15
Error handling lesson: durable error capture should group recurring failures, preserve stack/context while redacting credentials, support evidence-backed acknowledgement, and keep autonomous scheduling disabled until owner-controlled grants are present. Buddy conversation links must be repaired/ensured before send, queue, and interrupt; successful terminal work does not by itself prove link projection. A broad audit should distinguish operational failures from intentional control-flow catches: reported coverage reviewed 216 server catch/.catch boundaries, routed operational failures through the journal, retained 97 expected silent catches, and added a final Express error boundary. Evidence: note 2026-09-15T14:15:13.632Z:aee14dfc-94f0-4bef-ac41-dce418199ec5; implementation/verification are assistant-reported, not independent verification.

## 2026-09-16
Client observability design lesson: capture only high-signal uncaught errors, unhandled rejections, and React boundary/root failures; use a narrow authenticated endpoint into the existing redaction/fingerprinting/grouping pipeline, safe normalization (never serialize arbitrary rejection objects), deduplication, client/server rate limits, and a restrained fatal recovery UI. Do not forward all console warnings/errors. Assistant reported this implementation and checks complete, but it remained uncommitted and independently unverified. Evidence: note 2026-09-16T03:11:14.186Z:715f2385-007b-4489-9063-70a2196be9cd.

## 2026-09-16T03:45:21.392Z — long_term (owner_thread a599084c-3b56-48bc-a86a-60431a39882b)
_revision 5, buddy_knowledge knowledge_5c5a1d25-8146-49a1-8fe6-bca6c7b800a1_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown/flush has grace periods and 8s force-drain; retryable 503 and one upload retry during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider is one subtle solid line after project name, not a leading dashed rule.

## 2026-09-16
Mobile Buddies: use lean rows grouped by project, search and Recent ordering; detail headers prioritize identity/work with one scrolling nav row; task forms expand, execution/reporting controls stay in Settings/Team. Owner-accepted implementation and live 320/390px checks. Evidence: note 2026-09-16T02:11:32.847Z:6c121e1c-9d34-426b-beb8-12a3450fe122.

## 2026-09-16
Buddy detail pages should be conversation-first: Chats is default, compact titled previews show lean activity, running threads precede recent activity, and About/settings/model controls live in More/Settings. Keep one lean Chats · Work · Team · More row. Owner accepted implementation; desktop/mobile checks and focused tests were reported. Evidence: note 2026-09-16T02:25:20.323Z:29a72803-7014-4501-9eba-6ccf70c184e0.

## 2026-09-16
Mobile chat composer: restrained shared UI radius/model-picker styling; focused composer fills available space above the keyboard, secondary tools hide behind +, and running/queued status appears once with current input excluded from pending queue. Explicit hidden tab bar must remain hidden; visual-viewport geometry was simulated, but native iPhone keyboard verification remains open. Owner-accepted implementation and reported checks. Evidence: /Users/nicholasbardy/git/unleashd/agent_notes/screenshots/shared-style-20260916/README.md.

## 2026-09-16
Mobile fullscreen composer follow-up: prefer an explicit full-screen editing state that tracks the visual viewport, locks background scroll, keeps the textarea mounted, bounds draft scrolling, and uses thumbnail attachments with an expandable/removable preview. Native iPhone keyboard behavior remains an open verification limit; browser simulations and reported tests are not independent proof. Evidence: note 2026-09-16T03:45:01.202Z:9e79923b-cc9d-4788-bf13-c2e0ccfe80cb.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload (order, duplicates, cache recovery); distinguish tool-only vs prose/mixed activity. Hydrated saved messages preserve inspectable scripts/commands/JSON arguments with expansion and Copy. Filter only the complete untagged legacy plugin startup envelope, preserve explicit/later user messages, and invalidate old caches. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md; ...084220...codex-tool-history-detail-preservation...; ...091804...resumed-codex-history....

## 2026-09-10
Owner accepted one assistant response block for ordered chat/tool parts ending at the next user/system message, one outer container and Copy action across desktop/mobile; streaming/completed tools share one compact expandable row with preserved segmentation and untouched user/code content. Verified with live DOM, 70 client tests, typecheck and invariant checks.

## 2026-09-16T07:04:00.050Z — long_term (owner_thread ca301a5f-817a-4083-a455-b5008b84dc74)
_revision 1, buddy_knowledge knowledge_96755b28-ee91-46fa-87aa-a9a85467974d_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-16T16:05:10.258Z — long_term (owner_thread 855e88c3-f762-4175-92f9-53e8844335a6)
_revision 1, buddy_knowledge knowledge_630c3ce9-62a5-47f1-8e93-567bc4682211_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-18T13:12:01.760Z — long_term (owner_thread 3f2ffaab-2a36-4f56-a948-12bfbe18b219)
_revision 1, buddy_knowledge knowledge_a37f85de-2ed4-49f9-aa32-6e907f8a2f4c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-18T14:44:17.988Z — long_term (owner_thread 9b048cfa-9d1d-4b89-b681-2d23247fd0e4)
_revision 1, buddy_knowledge knowledge_0f395850-b40e-4c07-ab62-fac38af614f8_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-19T12:25:12.623Z — long_term (owner_thread 6f2e9e1c-a39f-4b35-b717-71ea95036fbc)
_revision 1, buddy_knowledge knowledge_b05fff45-f02d-425f-9cdc-1908a16a6dd5_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-20T02:35:25.374Z — long_term (owner_thread 86324391-3ef8-42e7-83f2-7898a9ad0ff8)
_revision 1, buddy_knowledge knowledge_a5c46238-26bc-4e05-b6e3-e9d3f7085d80_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-20T03:01:11.714Z — long_term (owner_thread 0cf2e59a-1501-41ca-9b71-32f79ab91c04)
_revision 1, buddy_knowledge knowledge_c1d9748d-c446-4e1f-bf12-8ffab6e3585d_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-20T09:52:04.228Z — long_term (owner_thread f1351c1c-9ee6-4c57-8acc-994012ab021e)
_revision 1, buddy_knowledge knowledge_3d242fe3-718a-4822-939f-863305ffa3d6_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-20T16:37:14.918Z — long_term (owner_thread a0bda23a-dcc1-4c9d-aaf7-de0eec1e71b3)
_revision 2, buddy_knowledge knowledge_f850792e-7af0-4f1d-8100-7cbd2c747382_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md.

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md.

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted one ordered assistant response block for interleaved prose/tools, with compact expandable tool activity and one Copy action. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-20
For context-meter/parser work, a green check on a dirty working tree does not verify the commit; inspect HEAD and stage file-by-file. Prefer provider/session-file truth over cumulative billing totals: latest context usage is retroactive, compaction markers are provider-specific, and synthetic fixtures must be checked against real logs. Unknown-model percentages remain an explicit caveat. Evidence: /Users/nicholasbardy/git/unleashd/agent_notes/20260920T074430Z_context-meter-provider-truth-session-file-half_product-development-lead_c51402b4.md.

## 2026-09-20T16:37:50.020Z — long_term (owner_thread c191e5df-9dc5-457f-81c5-feea819a806d)
_revision 3, buddy_knowledge knowledge_ca70d370-3563-4386-b8a1-6806f643af95_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md.

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md.

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted one assistant response block with ordered prose/tool parts, one Copy action; streaming/completed tools share one compact expandable row. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-20
Memory review fallback is gpt-5.6-luna → muse-spark-1.3 → sonnet; current behavior advances only on out_of_tokens. Do not treat this as an owner-approved policy for deadline failures: production showed 10 real fallbacks, with 4 interrupted by the shared 120s ladder deadline and 2 failed on update_memory content over the 4000-character cap. Detailed evidence: note 2026-09-20T16:37:33.157Z:7c9c9351-70be-4e42-bc93-ff5b3be5aa5d. Provider attempt is ground truth; avoid stale Codex token prechecks. Claude must fail closed against built-ins (disallowedTools, not merely allowedTools).

## 2026-09-21T05:15:27.016Z — long_term (owner_thread ce99a0d6-e6da-4f0a-b7fc-6fa02ad5724b)
_revision 4, buddy_knowledge knowledge_a130efef-db47-4d5a-bc75-12f8027f804c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Names alone are insufficient: preserve inspectable scripts, commands, JSON arguments, expanded rendering and Copy. Evidence: agent_notes/20260910T083219Z_01M2574GMXXQ0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and 20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md.

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: one singular assistant response/message block may contain ordered chat and tool parts, with one outer container and Copy action; streaming/completed tools share one compact expandable row.

## 2026-09-21
Muse parser lesson: model.* lifecycle/model-step records are hidden progress, not user-visible tools or periodic heartbeats; timer-based agent-cli.heartbeat is liveness. Live `muse exec --json` correlation showed tool:<name> intent/completion pairing via task_id and tool.result correlation_facts.tool_name. Emit one start tool.use; suppress matched duplicate result synthesis, retain unmatched results. Implemented in vendored fa70bc5; outer pointer c8b1e73. Evidence: knowledge_6eab5d61-2ab6-43ef-bffb-ec240f347f0c (2026-09-21T05:15:10.204Z:a8edf58e-c676-4100-a897-d6ffc04f6d8b).

## 2026-09-22T05:44:57.239Z — long_term (owner_thread 3a6831f8-a249-4093-9fd8-7947675e19bf)
_revision 1, buddy_knowledge knowledge_88b19d85-85b1-479c-b6dd-f4fb20190fe1_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-22T07:31:02.730Z — long_term (owner_thread 244d3464-84ed-4f56-88b5-f6813931de98)
_revision 2, buddy_knowledge knowledge_54a89c6d-4618-489b-a763-a1745c0d5a8e_

## 2026-08-20
Guard: Never destructive Git history rewrites on shared branch mobile-fixes-and-audit-2026-08-18; use stash/throwaway branch and worktrees for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt. Sidebar uses restrained nested Buddies/threads hierarchy and shared conversation creation/context.

## 2026-08-20
Lifecycle: reload drain is bounded with grace periods, force-drain, retryable 503, one upload retry, and bounded watcher restart.

## 2026-09-09
Owner prefers elegant, restrained UI; preserve label alignment/hierarchy. Sidebar divider is one subtle solid line after project name.

## 2026-09-10
Codex history preserves streamed tool calls through JSONL/cache reload, including order, duplicates, cache recovery, inspectable scripts/commands/JSON arguments, and safe copy/rendering. Recommended-plugin filtering only removes the complete untagged startup envelope; explicit/later user messages are preserved.

## 2026-09-10
Owner accepted one assistant response block for ordered chat/tool parts, one outer container and Copy action; streaming/completed tools share a compact expandable count row. Tool-like text in user/code content remains untouched.

## 2026-09-22
Background-worker threads may be hidden from default Conversations by design, but the dedicated Background route must treat absent/empty workspace query as “All workspaces”; otherwise sidebar badges can show work but navigate to an empty list. A nonmatching filter should offer recovery to all workspaces. Confirmed fix a0956ce; client 128/128, tsc, invariant gates, and Biome passed. Evidence: note 2026-09-22T07:30:02.982Z:027caf48-fc0c-4c05-bb25-ff4d04ff1250.

## 2026-09-22T07:31:41.759Z — long_term (owner_thread 272536f0-a42d-4b7b-a333-f1242eba81b2)
_revision 2, buddy_knowledge knowledge_c776b4c3-a9c9-458d-8965-7f5f5f730395_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md.

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling and one ordered assistant response block for chat/tool interleaving; streaming/completed tools share one expandable row. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-22
Sidebar conversation labels: prefer provider-generated titles over first-user-message derivation. Claude ai-title/custom-title JSONL lines flow through a vendor session.title event into runtime/shared Conversation.title; custom wins and live updates broadcast conversations_updated. Hydration and idle polling backfill titles. Fallback strips HTML comment envelopes (including buddy-context) before first line. Codex sqlite thread names remain intentionally unsupported (low coverage), so fallback applies. Evidence: note ref knowledge_a5c18778-3601-4fb8-baad-bc8900bcbbb1, name 2026-09-22T07:29:44.825Z:c6520805-b462-410d-bb75-c33c3b4ad4c1.

## 2026-09-22T16:59:16.024Z — long_term (owner_thread 9ff1fac0-a24a-46d8-952b-15a8641ee01b)
_revision 1, buddy_knowledge knowledge_36c2b2a6-0ddd-4083-a617-d6a0cceb8659_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-22T17:26:00.509Z — long_term (owner_thread 7df5e8da-8277-4da1-b860-dd6fb319d96e)
_revision 2, buddy_knowledge knowledge_2822d088-3531-44cd-af4b-92eaaec95957_

## 2026-08-20
Guard: Never git reset --hard/filter-branch/rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a, 79a8381). Use stash/throwaway branch; enforced in settings, wrapper, AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies sort by recentRuns.lastActiveAt via ui-contract.ts. Restrained 2-layer Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain bounded. Shutdown has drain/flush grace + 8s force-drain; server 503 retryable; upload retries once during drain. Watcher restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant restrained UI; preserve label alignment/hierarchy. Sidebar divider: one subtle solid line after project name, not leading dashed rule.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload incl. order, duplicates, recovery; labels distinguish tool-only vs prose/mixed. Verified 21/21 transcript, 24 server tests, rendering/live checks.

## 2026-09-10
Hydrated saved messages preserve inspectable scripts/commands/JSON args; expanded rendering + Copy support them incl. exec previews and safe markers. Saved-input/cache, desktop/mobile, typechecks, regressions, live checks passed.

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only complete untagged startup envelope, preserve explicit/later user msgs, invalidate old caches. Native replay: first user 'What is this buddy?', zero setup rows, 147 calls.

## 2026-09-10
Compact tool-history: tool activity on own reduced-spacing line; chat→tool→chat→tool is one assistant response block, one container, one Copy; ends at next user/system msg. Streaming/completed share one '▸ N tool calls' row. Verified live DOM, desktop/mobile, 70 client tests, typecheck.

## 2026-09-10
Streaming/completed tool activity share one compact row, spacing, input rendering; counts grow live, prose/tool segmentation preserved, tool-like text in user/code untouched. Focused regressions, typecheck, invariant gates, diff checks passed.

## 2026-09-22
UI-state sync: WS init must merge (union dones, max seen-index), never overwrite shared slice (ui.ts hydrateUiFromServer, efb9f0d). Unload keepalive capped 64KiB — full-slice 573KB POST dead; send delta since last ack, server merges partials; fixes tab clobber + failed-POST retry (2de9c96). 5 hydration tests, 138/138 client suite green, feat/channels-project-view-2026-09-22.

## 2026-09-22T17:26:45.549Z — working (owner_thread 04b32414-d469-4431-8891-db83ea3df54a)
_revision 3, buddy_knowledge knowledge_83e4bbc3-80ec-4668-9aec-f5031b631480_

Workspace Slack browser (claimed 2026-09-22, unverified, per assistant only): owner asked top-level Channels container, not nested under conversations. Now: sidebar Channels section below Buddies via buddySidebarChannelsAtom (collapsible, # workspace rows → /buddies/workspaces/:id/channels; header also opens). Route is full-bleed: left channel list w/ workspace name, right convo panels, stacks on mobile. Activity page keeps Open channels entry. Still read-only; posting stays in Buddy Mailbox. Claimed: typecheck clean, 138/138 client tests, 6/6 gates, biome clean, commit 07f943e pushed. Flags: mid-turn foreign commit 46acb83 (route/layout half) landed+pushed 3s in, per assistant; branch also carries other sessions' 983a120, efb9f0d, 2de9c96 + uncommitted ui.ts/hydration/provider files, unstaged.

## 2026-09-22T17:27:05.008Z — long_term (owner_thread 04b32414-d469-4431-8891-db83ea3df54a)
_revision 2, buddy_knowledge knowledge_2c11348d-22b2-420d-8ef9-9884a3229889_

## 2026-08-20
Guard: Never git reset --hard/filter-branch/rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6). Use stash/throwaway branch; enforced in settings, wrapper, AGENTS.md. Shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Restrained 2-layer Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain bounded. Shutdown has drain/flush grace + 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; preserve label alignment/hierarchy. Sidebar divider: one subtle solid line after project name, not leading dashed rule displacing names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload incl. order, duplicates, recovery; labels distinguish tool-only vs prose/mixed. Verified 21/21 transcript, 24 server tests, rendering/live checks.

## 2026-09-10
Hydrated saved messages preserve inspectable scripts/commands/JSON args; expanded rendering + Copy support them incl. exec previews and safe markers. Saved-input/cache, desktop/mobile, typechecks, regressions, live checks passed.

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only complete untagged startup envelope, preserve explicit/later user msgs, invalidate old caches. Native replay: first user 'What is this buddy?', zero setup rows, 147 tool calls; recommendations disabled.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity on own reduced-spacing line; chat→tool→chat→tool is one assistant response block (one container, one Copy, ends at next user/system msg). Streaming/completed tools share one compact '▸ N tool calls' row. Verified live DOM, desktop/mobile, 70 client tests, typecheck.

## 2026-09-10
Streaming and completed tool activity share one compact expandable row, spacing, input rendering; counts grow during streaming; prose/tool segmentation preserved; tool-like text in user/code untouched. Focused regressions, typecheck, gates, diff/format checks passed.

## 2026-09-22
Owner wants Workspace Slack channels as top-level sidebar container below Buddies (not nested under conversations/members), opening full-bleed page: channels left, conversation right. Per assistant 2026-09-22 turn (07f943e claimed).

## 2026-09-22T17:28:32.562Z — working (owner_thread c35b0c9a-931c-4eb6-9770-fc3a8eeebfe2)
_revision 2, buddy_knowledge knowledge_2ccfd1d2-7165-41ad-ae68-ae63d2ae9c45_

2026-09-22 (buddy-reported, unverified): Owner decided Opus 5.5 (`claude-opus-5-5`) is default and picker shows latest of each model to avoid clutter. Buddy claims a0390ad (+ vendor submodule fa4dd0d first) removed `opus` row, defaultModelId->5.5, regenerated shared catalog, kept `opus` in context-window for old configs, updated 1 test. Running server predates change; restart required to see Fable 5.1 / Opus 5.5 (default) / Sonnet / Haiku. Scope Claude-only. See conv c35b0c9a.

## 2026-09-22T17:28:37.024Z — long_term (owner_thread c35b0c9a-931c-4eb6-9770-fc3a8eeebfe2)
_revision 2, buddy_knowledge knowledge_f66ec2dc-a92d-4c7e-9009-6bcb41548e88_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-22
Owner prefers model picker shows latest of each model only to avoid clutter; Claude Opus 5.5 is default (owner-accepted in conv c35b0c9a).

## 2026-09-23T04:28:47.224Z — long_term (owner_thread 4760427f-b837-4fb5-975a-6553e70cd2ab)
_revision 1, buddy_knowledge knowledge_ea438ffe-a500-4dc4-adad-78bc3ddb9213_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-23T04:46:15.043Z — working (owner_thread 4760427f-b837-4fb5-975a-6553e70cd2ab)
_revision 4, buddy_knowledge knowledge_86644f83-1584-4e5e-86d7-98bd30bb2d1d_

Hidden/done reappear — partial fix only (2026-09-23). Landed feat/channels-project-view-2026-09-22: efb9f0d hydrate merge on WS init; 2de9c96 delta-only sync. 5 ui-state-hydration tests pass. Still open: seen-map 502KB/11.8k busts 64KiB cap; hide key sessionId??id unstable; add-wins merge blocks unhide.

Superseded 2026-09-23: heavy triage (triageRevision, stale result, pending overlay, per-conv outbox) dropped by Buddy as overbuilt — assumed offline-hide replay. Simpler proposal (proposed, not owner-accepted): done:boolean on conversation record (atomic write, 1039/1039 have records), set_conversation_done → broadcast conversation_updated; Conversation.done + one derived !done filter; copy buddy_archived pattern. No offline hide (button disabled), last-click-wins. Rule: conv-state on conv, device-state on device — NEW badge → localStorage, lastWorkingDirectory → settings.json, promotedWorkers delete if unused, then delete ui-state.json + sync machinery (~162 lines ui.ts).

Dry run 1270 hide keys: 309 direct set, 174 legacy-file apply-on-create, 787 dead listed. promotedWorkers 0 stored.

Awaiting owner: (1) promotion still used? (2) per-device NEW badge acceptable?

## 2026-09-23T04:47:46.609Z — long_term (owner_thread e0e10739-efc5-472d-b583-03e81eb29f66)
_revision 2, buddy_knowledge knowledge_4ee54181-a46a-4dea-b39e-95a5b980bc50_

## 2026-08-20 Guard
Never git reset --hard/filter-branch/rebase -i on shared branch mobile-fixes-and-audit-2026-08-18. Use stash/throwaway branch; enforced in settings, shell wrapper, AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20 Sidebar/Buddies
/buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Restrained 2-layer Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20 Lifecycle
Reload drain bounded. Shutdown has drain/flush grace + 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09 UI
Owner prefers elegant, restrained UI; preserve label alignment/hierarchy. Sidebar divider: one subtle solid line after project name.

## 2026-09-10 Codex history
Preserve streamed tool calls through JSONL/cache reload incl. order, duplicates, recovery; labels distinguish tool-only vs prose/mixed. Verified 21/21 transcript, 24 server tests, rendering/live checks.

## 2026-09-10 Tool detail
Hydrated saved messages preserve inspectable scripts/commands/JSON args; expanded rendering + Copy support them incl. exec previews and safe marker rendering.

## 2026-09-10 Plugin recs
Recommended-plugin lists may be stale persisted setup; filter only complete untagged startup envelope, preserve explicit/later user msgs, invalidate old caches. Native replay: first user 'What is this buddy?', zero setup rows, 147 tool calls.

## 2026-09-10 Response block
chat->tool->chat->tool is one assistant response/message block: one outer container, one Copy action, ends at next user/system msg. Tool activity on own reduced-spacing line; streaming/completed share compact expandable 'N tool calls' row. Verified live DOM, desktop/mobile, 70 client tests, typecheck.

## 2026-09-23 Channels
Owner wants full-screen Slack layout as top-level Channels item, no nested double sidebar: project name top-left, channels left, convo fills right. Workspace browser read-only (posts need sender Buddy; posting stays in Buddy Mailbox). Posts carry server-stamped senderConversationId/senderRunId shown as conv abcd1234; group follow-ups only on same Buddy AND same conversation. Task filter reads across channels; channel+Task in URL.

## 2026-09-23T04:47:50.651Z — working (owner_thread e0e10739-efc5-472d-b583-03e81eb29f66)
_revision 1, buddy_knowledge knowledge_e5bf713c-e1da-4c3e-a765-c83fe9dd9e99_

2026-09-23 Channels gap (from Buddy turn, unverified): Task names in channel Task filter show short IDs (e.g. 6efaffd1); Buddy claimed server has no workspace Tasks-with-titles endpoint. Needs small server change if owner wants real names. Do not treat completion claim as verified.

## 2026-09-23T06:17:21.392Z — long_term (owner_thread 4c2be88e-d55c-4ea2-aa52-7f4eefbd70d2)
_revision 1, buddy_knowledge knowledge_89d985b9-15bd-4825-bc74-cef60a4e9deb_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-23T07:12:28.542Z — long_term (owner_thread ebe4fd26-8fdd-4185-9f4c-3d8bff5b2e86)
_revision 1, buddy_knowledge knowledge_59e31235-76f2-4a2e-a29c-24a0895b8d4c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-23T07:54:27.302Z — working (owner_thread ebe4fd26-8fdd-4185-9f4c-3d8bff5b2e86)
_revision 3, buddy_knowledge knowledge_821adbd0-194c-4e3a-98e8-82149ca705fb_

## 2026-09-23 — Generative buddy avatars → continuous space (per transcript, unverified)
Owner wants continuous style variance, not discrete categories; high-dim embedding → forms/colors. Seed still by buddy NAME (rename = new avatar).
Now: discrete 8-style SVG (e3eb0ab) REPLACED by continuous decoder, commit ecf51ce: client/src/components/buddies/sigil/genome.ts (name→32-num latent→~180 params) + render.ts (one shared WebGL2 field shader + GPU readback + canvas strokes) + ChannelBrowser wiring + /sigil-gallery.html dev gallery. No style switch; OKLCH palette, symmetry order, warp, CPPN weights, bands, contours, strokecount/flow all dials; latent walks blend smoothly; decoder accepts any 32-vector for future role-embedding swap.
Render-once 144px cached (<10ms); shared ctx avoids ~16 limit; fallback = own bg color. Bump SIGIL_VERSION on range tuning.
QA per transcript: typecheck, 4/4 channel tests, lint, invariants pass; 3 gallery tuning rounds. Weak: some olive/low-contrast — knobs in genome.ts.
Fragile: live Slack page crashes reading 'kind' — other session's 287f530 added post.author but running server is older build; restart deferred to avoid killing agent threads (not sigil fault).
Next: 4 initials() spots remain (dashboard, workspace activity, 2 mobile).

## 2026-09-24T06:30:51.183Z — long_term (owner_thread d0b0b773-f2cf-45f3-9517-fae2ea397f67)
_revision 1, buddy_knowledge knowledge_c93387e4-c8b5-461d-a3e8-4d3eb60fff8f_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T08:21:58.254Z — working (owner_thread 4c2be88e-d55c-4ea2-aa52-7f4eefbd70d2)
_revision 3, buddy_knowledge knowledge_faa2209d-7077-4cb7-95c5-cf4123905686_

Channels (2026-09-23/24): owner request for richer channel posts was decided and IMPLEMENTED on branch feat/channels-project-view-2026-09-22 (not yet merged to main). Decisions: explicit @mention only (server posts the Buddy's reply into a one-level thread), inline markdown media, live Task chips (view-only hover), universal `@` picker, owner can create channels; plus DM/Wake, mobile Slack-style screens, generative sigil avatars, post markdown styling, `pnpm screenshots`. Record of truth: product/buddies/CHANNEL_CONVERSATIONS_2026-09-23.md (commit list at the bottom). Known gap: a mention reply in flight during a server restart is lost.

## 2026-09-24T09:04:49.573Z — long_term (owner_thread 0cbf7224-1932-4135-a6cb-8f0956d9d72a)
_revision 1, buddy_knowledge knowledge_cce7ffa9-529d-4ae9-b04c-b3b684c5ce5e_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T10:30:45.402Z — long_term (owner_thread ea2a66b1-b0f7-4137-8f8a-6608829bdf43)
_revision 1, buddy_knowledge knowledge_4d5a6663-d3a8-4e5d-a9ab-aad9b9c392f7_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T14:45:07.340Z — long_term (owner_thread d4d3312d-059d-42a8-8b86-cf3fe3f0955f)
_revision 1, buddy_knowledge knowledge_4883b01f-6a6e-4a4f-94df-07a55eac5af6_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T15:26:42.707Z — long_term (owner_thread b02c69bf-358a-49cf-80cb-511ac9afc317)
_revision 1, buddy_knowledge knowledge_69586c9a-81c2-472d-9700-51743651633a_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T15:35:01.436Z — long_term (owner_thread 395b6cb4-2e46-4ff4-82cc-9220f76d8802)
_revision 1, buddy_knowledge knowledge_e57d7e1c-2d8e-4b47-8796-cbd194bb68c8_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T15:36:44.330Z — long_term (owner_thread 0ce8e338-e0a6-5eaf-97e4-75959aa6441e)
_revision 1, buddy_knowledge knowledge_69e4fb1b-19e6-4722-a4c7-65393cbb9eaf_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T15:38:15.350Z — working (owner_thread b02c69bf-358a-49cf-80cb-511ac9afc317)
_revision 1, buddy_knowledge knowledge_1503278f-243e-473a-9da0-9b1f95b187f9_

2026-09-24 (unverified, single-turn claim): buddy_team_configuration raw-marker leak in channels view reportedly fixed in local commit 1504330 on feat/channels-project-view-2026-09-22; push said to fail with GitHub Internal Server Error, retry pending. Claimed root cause: runtime.ts injects <!--buddy_team_configuration:…--> markers, only /chat stripped them; ChannelMarkdown fell back to Markdown with raw HTML disabled. Claimed fix: shared chat splitter/widgets + whitespace-tolerant marker patterns; 151/151 client tests, tsc, biome, 6 gates. Treat as hypothesis until diff/tests independently observed. Deferred by Buddy, not done: duplicate worker-thread regex in chat-message-groups.ts; readableChannelText still passes raw blob to model transcripts. Evidence: owner-thread transcript 2026-09-24T15:37Z; no agent_note found.

## 2026-09-24T15:51:10.696Z — long_term (owner_thread 3bbd9136-b0af-5858-8ad9-d44bd4128556)
_revision 1, buddy_knowledge knowledge_6e0b970e-88e5-4acb-8a36-1db586b99a4c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T16:52:17.466Z — long_term (owner_thread 016cd237-3177-5897-8916-4a6a45fb2243)
_revision 1, buddy_knowledge knowledge_c93022f5-721c-4036-b974-60ec34555164_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T16:56:46.078Z — long_term (owner_thread 2a5645f5-98d3-58a8-b5a5-735ca7ee00d6)
_revision 1, buddy_knowledge knowledge_8b584fdb-8660-4d06-994c-eaa800e69916_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T17:02:57.564Z — long_term (owner_thread 707c3ca4-d109-465b-9c75-b9ef60c2403c)
_revision 1, buddy_knowledge knowledge_64c643da-ebd7-48b6-9840-7609c37fad78_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24T17:10:14.954Z — working (owner_thread 707c3ca4-d109-465b-9c75-b9ef60c2403c)
_revision 1, buddy_knowledge knowledge_8a24aeb2-e0c6-412a-8818-b51daa969f54_

## 2026-09-24 channel reply indicator
Owner asked: show "X is replying…" as soon as the should-reply gate is yes, including during initial tool calls. Scope: channel thread (owner said Slack).

Assistant diagnosis (not independently verified): W1 compute ask got no Model Research Scientist answer because Codex usage limit failed the gate ~4s after the post (retry quoted Sep 27, 10:15 PM). Failure was log-only, so the thread stayed quiet. Likely seen answer was Chief Scientist on "why do we need an odds source?" via a background run, which does not show replying. Channel page also crashed ~7s later ("renderFeed is not defined"), attributed to another session.

Assistant-claimed commit 784973c (live app not checked; next reload): owner-post gate failure shows a thread notice; Buddy-post failures stay log-only. Claimed 8/8 channel tests, typecheck clean, test fails without the fix.

Open, not owner-accepted: root author answers every owner reply with no gate; keep the gate for other Buddies.

Evidence: note 2026-09-24T17:10:06.532Z:9b0176a1-b7a4-45ac-b9ab-c7d321cfc904 (knowledge_b37d1204-6f6a-4333-aa2d-e8ebb80481e1).

## 2026-09-24T18:01:38.229Z — working (owner_thread 4644a89d-cac2-4f06-85fd-aec2bed618f4)
_revision 3, buddy_knowledge knowledge_b6ebf30a-f223-4623-930a-ab166c70b656_

2026-09-24 Channels→DM (commits 41e4b75, 2d3d04a): rail name + post author (ChannelAuthor.tsx, desktop+mobile) open the Buddy DM; rail hover DM icon removed, desktop Wake only. Buddy pages still link to profile; archived Buddy name is no-op with "not active" hint. Fragile: concurrent commit 11b97c6 picked up a half-finished file and broke HEAD — fixed by 41e4b75; check git status/index when rail files change unexpectedly.

2026-09-25 DM growth: owner is fine with one ongoing DM thread for now. The session-rotation proposal and its resetProcess history-wipe caveat are parked as a #triage follow-up (post_16d80418). No Task, nothing to build unless the owner reopens it.

## 2026-09-24T18:02:45.138Z — long_term (owner_thread 4644a89d-cac2-4f06-85fd-aec2bed618f4)
_revision 4, buddy_knowledge knowledge_41842683-71bd-4b38-b74e-02218e4d4819_

## 2026-08-20
Guard: never reset --hard/filter-branch/rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40, fc7751a, 79a8381). Use stash/throwaway branch. Shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies sort by recentRuns.lastActiveAt via ui-contract.ts; restrained 2-layer Buddies/threads hierarchy; shared headers/rules.

## 2026-08-20
Lifecycle: bounded reload drain; 8s force-drain; retryable 503; upload retries once in drain. Watcher restarts unexpected exit(0); transform errors don't burn budget.

## 2026-09-09
Owner prefers elegant restrained UI; preserve label alignment/hierarchy. Sidebar divider: one subtle solid line after project name.

## 2026-09-10
Codex history preserves streamed tool calls through JSONL/cache reload (order, duplicates, recovery); labels split tool-only vs prose/mixed. Verified 21/21 transcript, 24 server tests. Evidence: agent_notes/20260910T083219Z...mislabeled... + ...080336...vanished....

## 2026-09-10
Hydrated messages preserve scripts/commands/JSON args with expanded rendering + Copy, incl. exec previews and safe markers. Evidence: agent_notes/20260910T084220Z...detail-preservation...; ...084839...exec-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only complete untagged startup envelope, keep explicit/later user msgs, invalidate old caches. Evidence: agent_notes/20260910T091804Z...pre-disable-plu....

## 2026-09-10
Assistant block model: chat→tool→chat→tool is one response block, one container, one Copy; ends at next user/system msg. Live+completed tools share one compact "N tool calls" row; counts grow live; tool-like text in user/code untouched. Verified live DOM, desktop/mobile, tests+typecheck. Evidence: agent_notes/20260910T125040Z...message-block-model...; ...105731Z...unified-live....

## 2026-09-24
Channels: Buddy name opens its DM (rail + post author via ChannelAuthor.tsx, desktop/mobile); Buddy pages still link to profile. DM: one ongoing per (workspace,Buddy), resumes; new only after delete. Chat opens newest + windowed; owner wants tight latest-only scope. 2026-09-24 owner said an ongoing DM must not grow forever; compaction was a guess, not an accepted plan. 2026-09-25 owner is fine with one DM thread for now (narrows that; does not retract it). Parked follow-up lives in working memory.

## 2026-09-24T19:12:20.010Z — long_term (owner_thread fbce9399-57f8-5bb3-bb18-c6d70a58f028)
_revision 2, buddy_knowledge knowledge_8d7ab0cd-ba12-4720-b02b-5c9f0427e261_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming and completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming; tool-like text in user/code content stays untouched. Verified live DOM, expanded/copy ordering, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-24
Owner wants a channel send to appear immediately. Observed lag was the composer waiting on the POST and a feed refetch. Optimistic outbox claimed as d3baa03; live send not verified. Evidence: note 2026-09-24T19:11:50.987Z:c250e4bc-3ea9-4fab-b0e9-9fe4f370a074

## 2026-09-24T19:23:07.152Z — long_term (owner_thread bbde1b7b-ada3-5b8c-9304-86bf92c05387)
_revision 2, buddy_knowledge knowledge_25f567e0-d06c-4be0-9b27-12ab175a8cd6_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling. chat → tool → chat → tool is one assistant message block with ordered parts, one outer container, and one Copy action (desktop/mobile); it ends at the next user/system message. Tool activity is one reduced-spacing line; adjacent prose may share the block, with a fresh header after user messages. Streaming and completed tools share one expandable “▸ N tool calls” row; counts grow while streaming; user/code tool-like text stays untouched. Verified live DOM, copy order, desktop/mobile, regressions, typecheck, invariant gates. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731Z...unified-live-and-completed-tool-activity....

## 2026-09-24
Owner (#bugfixes post_6ac492fb): a selected @ name in the Slack composer must highlight in the input, not only after send. Buddy reported a stronger blue chip for selected names (sent-message tint too faint on the dark field), a quieter tint for picked task titles, and plain text for unselected typed @. Buddy-claimed tests and screenshot; not independently verified. Evidence: note 2026-09-24T19:22:49.284Z:ac032d68-12df-40ec-8701-b053578c5a2c.

## 2026-09-25T03:16:13.237Z — long_term (owner_thread f7680b2d-aedd-5e20-baa6-0f2d2cbbae91)
_revision 2, buddy_knowledge knowledge_24ca3579-9c47-4a6a-863c-96b0b4da3f4b_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-24
Owner: clicking a Buddy name in Channels opens that Buddy's DM in the channel view, not the conversation page. Post post_acc22201-4c7b-400c-81b7-06e75fb6154b.

## 2026-09-25T03:29:39.357Z — working (owner_thread 016cd237-3177-5897-8916-4a6a45fb2243)
_revision 4, buddy_knowledge knowledge_a0981c57-8c8f-4ece-a449-3436f52b084f_

## 2026-09-25 #channels-feature
Still open: owner post_df013331 Slack-like reply layout and permalinks.

Owner (garbled): if deleting the Mailbox channel reader does not change features or break things, keep it deleted; otherwise restore. Scoped to that deletion. Buddy claimed the restore in d382234 because Channels lacks posting as that Buddy from Mailbox and a phone Task filter. Not independently verified.

Owner asked if pagination was built. Buddy withdrew “newest 50 is enough.” Claimed, not verified, 16e0351 on feat/channels-project-view-2026-09-22, not pushed: channel view loads older posts 50 at a time on scroll-up (cursor before/from; offset removed); after scroll-back, new posts do not drop older ones. Threads still first 200; Task filter and Mailbox still one page. Buddy asked if threads should page the same way — unanswered. Buddy-reported: largest of 16 workspaces has 38 posts; none has 50 top-level, so nothing hidden until reload. Claimed: 250-post server walk, 19 server tests, 168 client tests, typecheck, gates; headless desktop+phone with a faked 130-post channel. Live only after backend reload.

Unanswered: phone bug where one failed background refresh replaces a loaded Buddy page with “Could not load buddy”?

Still claimed unverified and unpushed: dcd8856 (cache identity, channel_changed, ~30s poll, no new reactive lib), 89cd357 (reply-failure push and list refresh), d382234, 16e0351. Server started before dcd8856/89cd357, so replies could lag ~30s until reload.

Seat: creating a readable Task at 17:09 reset the session via the audience key. Not a new owner decision.

Evidence: note 2026-09-25T03:29:30.534Z:bda4cda5-3f72-47a3-b486-05a3cfbc47bd (knowledge_4b063622); prior 2026-09-24T19:28:19.048Z:2a3744ae (knowledge_29631659).

## 2026-09-25T03:31:56.718Z — working (owner_thread fbce9399-57f8-5bb3-bb18-c6d70a58f028)
_revision 3, buddy_knowledge knowledge_ca8299fc-3616-4412-8dfb-7728b4b3359f_

## 2026-09-25
#bugfixes list_ed62b9a8. Earlier owner asks remain open and unchecked (the reply-only-latest briefing is not an owner preference):
- post_e61b7910: Slack replies do not notify thread participants, including the OP, with a should-respond prompt. Owner thought this already existed.
- post_81d72a3e thread: a Buddy claimed automations cannot be set from Slack; owner doubts that.
- post_acc22201: clicking a Buddy name in Slack opens the conversation view; owner wants the DM thread in a Slack view.

Send delay: owner asked 2026-09-25 if it is fully done. Buddy said mostly. Claims d3baa03 on feat/channels-project-view-2026-09-22, not merged to main: post shows and composer clears on Send; server copy replaces it; failure restores the draft (earlier caveat: not over a new draft, not withdrawn). Claimed test client/test/channel-outbox.test.tsx 1/1 and typecheck at commit. Not watched in the running app; next owner send after reload is the check. Concurrent ChannelComposer reference-highlight edits claimed to leave the send path alone. Buddy report only.

Latency: owner asked whether the 27s was CPU. Buddy attributes it to host overload (load ~232 on 10 cores from basketball_model and tsc; Node queued requests), not a slow channel path. Remeasure under load ~3: channel endpoints 0.7–1.2ms, /api/buddies 45–75ms, server CPU ~17% vs ~44%. Buddy report only. Proposed, not started, not owner-accepted: re-time the ~28s DM open and close it if fast; log stalls >~1s with load. Buddy replies still wait on a CLI process; nice/cap proposed, not accepted.

Evidence: note 2026-09-24T19:11:50.987Z:c250e4bc-3ea9-4fab-b0e9-9fe4f370a074; note 2026-09-25T03:14:40.306Z:82e5469b-45d2-47ec-93cd-e72ba5a36a73; note 2026-09-25T03:31:41.253Z:226f2557-da94-4741-af9a-772c83c43570

## 2026-09-25T03:34:38.072Z — working (owner_thread 4e7f034f-3912-50b0-9ee2-8355c91b8dce)
_revision 1, buddy_knowledge knowledge_d1a162de-5988-4ede-9635-682872e76cff_

## 2026-09-25 composer @
Owner (#bugfixes, root post_88e81e2c): a picked `@` name must highlight in the composer input, not only after send. When they asked if it was done (post_5f1c5083), the prior reply had failed (cursor exit 1) and the diff was still uncommitted. Assistant then reported commit `c0ae4ed` on `feat/channels-project-view-2026-09-22`, not pushed; desktop/phone screenshots and 168 client tests claimed. Owner has not confirmed. Exact-span and grey task-ref styling are assistant choices. Note: knowledge_14444fb2-a6cf-4b92-bd11-344cc8f64701

## 2026-09-25T03:34:38.312Z — long_term (owner_thread 4e7f034f-3912-50b0-9ee2-8355c91b8dce)
_revision 2, buddy_knowledge knowledge_8ce1821b-5264-465f-8514-773a42039fd2_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming; tool-like text in user/code stays unmarked. Verified live DOM, expanded/copy ordering, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Owner: a name picked from `@` in the channel composer must highlight in the input immediately, not only in the sent message. Exact-span and grey task-ref marks, and commit `c0ae4ed` (reported unpushed), are assistant-reported and not owner-confirmed. Note: knowledge_14444fb2-a6cf-4b92-bd11-344cc8f64701

## 2026-09-25T03:43:16.930Z — long_term (owner_thread c3ddc4a1-098f-51fb-9def-b4e6ebf316be)
_revision 3, buddy_knowledge knowledge_4b73d4f5-ac8f-46a4-91da-f3daa0ee1c80_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming and completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming and tool-like text in user/code content stays untouched. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Owner accepted separate channel read state from Buddy marks: catching up must not mark a channel read for a Buddy, and a Buddy reading must not clear the owner's unread. "complete the work" authorized the build; Slack visuals were not separately confirmed. Buddy reports commit 63edbe5 (host-stored marks). Unconfirmed shipped limits: no owner @mention counts; one mark per channel marks its threads seen; baseline zero so pre-restart posts are not unread. Evidence: note 2026-09-25T03:11:27.101Z:c67dc37b-f12a-4486-832c-d7f05c09121a; successor 2026-09-25T03:42:33.158Z:01692691-7d76-439f-bf6d-40500aeaf92f.

## 2026-09-25T03:50:33.453Z — long_term (owner_thread 6b8a2230-bf8b-5812-88aa-c75369b3c3ba)
_revision 2, buddy_knowledge knowledge_f267bb47-e8f2-4a8b-a1c4-757907663902_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload (order, duplicates, cache recovery); labels distinguish tool-only vs prose/mixed. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Hydrated saved messages keep inspectable scripts, commands, and JSON arguments; expanded rendering and Copy include literal exec previews. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md and ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history: tool activity on its own reduced-spacing line; adjacent prose may share a block; fresh header after user messages. chat→tool→chat→tool is one assistant message (ordered parts, one container, one Copy) until the next user/system message. Streaming and completed tools share one “▸ N tool calls” row; counts grow while streaming; tool-like text in user/code is untouched. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Composer @ picks: owner wants a selected name highlighted in the input immediately, not only after send. Buddy-reported (c0ae4ed): mark exactly the mention span; a longer prefix match stays unmarked; task refs use a quieter grey mark. Evidence: note 2026-09-25T03:49:51.931Z:8b3b3398-d41c-477f-92ab-112da517b219.

## 2026-09-25T03:51:55.835Z — working (owner_thread c3ddc4a1-098f-51fb-9def-b4e6ebf316be)
_revision 3, buddy_knowledge knowledge_b618dc27-c791-44f3-839f-b96038d58372_

## 2026-09-25
Owner unread is assistant-reported, not live-verified. Buddy claims commit 63edbe5 stores owner channel read marks in host storage, separate from Buddy marks. Claimed tests: channel 20/20, client 168/168. Reported, not owner-confirmed: no @mention counts; one mark per channel (opening marks threads seen); unread starts at zero so only later posts count. Task claimed in review: buddy_project_cbd6043b-848b-4741-ae0f-d4a54f03688c.

Owner asked why a custom script instead of pnpm screenshots. Buddy agreed pnpm screenshots is the standard tool. Running backend still predates 63edbe5: Buddy rechecked this turn that /api/buddies/channels/unread 404s, so real-API shots would show every channel read. Throwaway /tmp/owner-unread/verify.mjs replaces fetch before load from a DB copy and does not prove the endpoint. After restart Buddy plans `pnpm screenshots --only home,channel,thread` and will not add an unread screen to buildScreens() because live unread depends on actual marks.

Owner asked whether to close the unread work. Buddy said coding is done but do not close until post-restart checks pass, and claims those checks were noted on the unread task and buddy_project_d6b661c3-8250-4d45-a4aa-07c4874392ab. Owner has not accepted close or that deferral. Evidence: note 2026-09-25T03:42:33.158Z:01692691-7d76-439f-bf6d-40500aeaf92f; successor 2026-09-25T03:48:15.630Z:d8b0aeef-0401-416e-92a4-1ebc82bf347d; close question 2026-09-25T03:51:47.989Z:703c4c4d-370c-4401-a5f2-d0f7b7ff08eb.

## 2026-09-25T03:53:22.744Z — working (owner_thread e96323d9-b74e-59bf-a351-1119c3ac08e3)
_revision 6, buddy_knowledge knowledge_aa0501e9-1316-4afa-ac87-5dfa66ad506c_

## 2026-09-25
#bugfixes. Owner asked "are we done here?" PDL-reported, tool output truncated, unverified. (1) d265ce9: on the running branch, not main; PDL says the server restarted at 11:05 after the commit, so self-schedule enable is live. Supersedes the open restart-before-live claim. Auto-promote of the oldest hourly-or-slower saved schedule when one is turned off or deleted is still unanswered; PDL says it stays off. (2) 4ae9385: ≤5 responses at once per Buddy, 6th FIFO, on fix/fifo-run-capacity-2026-09-25 only; not on main or the running branch. Owner has not said "merge it". PDL says merge plus restart is required and the restart cuts in-flight replies. PDL's done-condition (merge it, and no on auto-promote) is not owner-accepted. Note: 2026-09-25T03:52:57.390Z:a7986a4f-1f14-4fce-9e82-961b2e103e19.

## 2026-09-25T03:53:22.983Z — long_term (owner_thread e96323d9-b74e-59bf-a351-1119c3ac08e3)
_revision 8, buddy_knowledge knowledge_c7454bb3-1072-482d-b4c1-441a669db1a1_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified transcript 21/21, 24 server tests, rendering/live. Evidence: agent_notes/20260910T083219Z_…tool-only-history-mislabeled… and …080336…vanished-when-polling-replac….

## 2026-09-10
Hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_…codex-tool-history-detail-preservation…; …084839…exec-content-preview….

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_…resumed-codex-history-can-expose-pre-disable-plu….

## 2026-09-10
Owner accepted compact tool-history styling: one assistant block of ordered parts, one Copy, ending at the next user/system message; streaming and completed tools share one “▸ N tool calls” row. Verified live DOM, desktop/mobile, client tests, typecheck. Evidence: agent_notes/20260910T125040Z_… and …105731….

## 2026-09-24
Owner (#bugfixes): a Buddy should turn on schedules it creates for itself without schedule.manage. Owner then said "so yea fully fix this" without restating numbers. PDL treated that as accepting: enable from any conversation if at most once an hour and fewer than 5 are already on; over a limit save disabled and leave it off (no FIFO auto-enable when a slot frees); schedule.manage lifts both limits; another Buddy's schedule still needs the grant. A separate 5-run FIFO (4ae9385) queues runs, not schedules. Owner asked for ≤5 responses at once, then said "per buddy". Whether that build is live is working memory. A prompt schedule must still target a conversation that Buddy is linked to (older report, not revisited). Notes: 2026-09-24T18:51:51.713Z:da694356-9c5b-41c3-bb52-a0a618e12b30; 2026-09-25T03:52:57.390Z:a7986a4f-1f14-4fce-9e82-961b2e103e19.

## 2026-09-25T15:22:01.412Z — working (owner_thread a750c47f-a684-5c32-ba2b-b1a830d03737)
_revision 1, buddy_knowledge knowledge_863d6798-5b99-48cd-8b8e-e498de86e166_

## 2026-09-25
Unverified on a real iPhone: #bugfixes owner reports (list_ed62b9a8, posts post_896ca188 and post_6037b1b3) of a channel header gap, composer padding/scroll/fullscreen, and the harness/model picker pushed above the keyboard. Buddy claims client commit a2e4135 on feat/channels-project-view-2026-09-22 (second top safe-area removed; fullscreen ChannelComposerMobile keeping round + / Send; keyboard dismisses into a bottom sheet). Headless phone screenshots only; Buddy said Chrome has no keyboard or notch. Owner has not confirmed. Note: 2026-09-25T15:21:44.749Z:f40f7d9b-1809-4b5f-9490-0e0c5f607f78.

## 2026-09-25T15:22:09.903Z — long_term (owner_thread a750c47f-a684-5c32-ba2b-b1a830d03737)
_revision 2, buddy_knowledge knowledge_bcf73b63-a481-411b-b731-a8da03a8388c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming; prose/tool segmentation is preserved; tool-like text in user/code content is untouched. Verified live DOM, expanded/copy ordering, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md; ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Owner (#bugfixes post_896ca188, post_6037b1b3): channel mobile chrome should learn from the conversation composer (full-screen on the keyboard, tight spacing) while keeping Unleashd’s attachment and Send design, not the white conversation composer. Harness/model settings should dismiss the keyboard and be the main sheet. Note: 2026-09-25T15:21:44.749Z:f40f7d9b-1809-4b5f-9490-0e0c5f607f78.

## 2026-09-25T16:19:52.124Z — long_term (owner_thread 6745b4f8-3889-5811-a5b9-2a89ff7e54ed)
_revision 1, buddy_knowledge knowledge_684ee634-20ca-4eb5-9659-28a93d92a59c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T16:32:43.207Z — long_term (owner_thread 45441ddd-fb89-5076-b396-e8b71dbb44cc)
_revision 1, buddy_knowledge knowledge_27bd1e64-1d7e-404e-9f76-af1e41ba2d09_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T16:35:57.071Z — working (owner_thread ec5d940c-19a8-53a2-a269-4a1419f5d772)
_revision 1, buddy_knowledge knowledge_52267ec5-fb38-486b-a8a1-45f46668151c_

## 2026-09-26
Assistant-reported, not independently verified: live tests vendor/agent-cli-tool/test/live-claude-background-agents.test.ts (pnpm test:live:claude-bg) claimed 3/3, committed only on local submodule branch test/claude-bg-ceiling-2026-09-26 (fd0acaa). Not pushed; outer submodule pointer not bumped. Owner has not approved pushing submodule main. Fix filed as buddy_project_95e0dcdb-515f-479a-b80b-750b121f791a. Mechanism note: agent_notes/2026-09-26_claude-p-background-agents-ceiling.md.

## 2026-09-25T16:36:15.519Z — long_term (owner_thread ec5d940c-19a8-53a2-a269-4a1419f5d772)
_revision 2, buddy_knowledge knowledge_5e58ee1c-a21c-4434-813f-d6896a1e94ae_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history: one assistant message block (ordered parts, one container, one Copy) until the next user/system message; streaming and completed tools share one “▸ N tool calls” row. Tool-like text in user/code stays untouched. Verified live DOM, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-26
`claude -p` holds every reply until process exit. After the parent goes idle it waits at most `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` (default 600000), then stops background agents and exits 0 as success; Unleashd records a clean finish. The Claude parser drops live `task_*` events and keeps the first `result`, so a later empty turn can post "(no reply text)". Mid-turn `post` works; the channel brief says not to also post the final reply, so agents send one message. Bash blocks a leading `sleep N`; use python sleep. Observed twice on Product Engineer session dbfcd9c4 (Claude Code 2.1.282). Evidence: agent_notes/2026-09-26_claude-p-background-agents-ceiling.md.

## 2026-09-25T16:39:02.405Z — working (owner_thread 45441ddd-fb89-5076-b396-e8b71dbb44cc)
_revision 1, buddy_knowledge knowledge_8461ea3a-f658-4894-84a6-d5b86b7ea7c1_

2026-09-25 PDL report (code unchanged, not re-verified): CEO "(no reply text)" — the 15:55 resume emitted turn.complete for already-stopped Claude workers before the owner prompt; runtime.ts then dropped later events. Answers stayed in the Claude transcript (2.6k at 13:34, 3.0k at 15:58); channel posts landed ~600s later (13:44:50, 16:09:00). The 13:10 turn fits, but its early result was not in the log. The CEO note "I ended without a summary" is contradicted. Note 2026-09-25T16:38:37.380Z:fd7cc53c-26f1-46c9-a543-12be51c8c2d7. Task buddy_project_d612b353-b0c5-48bb-9142-fe4f15c6e96f. The ceiling note agent_notes/2026-09-26_claude-p-background-agents-ceiling.md is a different Product Engineer seat.

## 2026-09-25T16:39:33.175Z — long_term (owner_thread 619680f5-cf15-5126-a6ee-54d3fcf8df0b)
_revision 1, buddy_knowledge knowledge_7df538f8-9956-48a8-b8ae-264c7229682b_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T16:44:31.060Z — long_term (owner_thread 3b974dd7-b813-5304-be4f-9d035b226476)
_revision 1, buddy_knowledge knowledge_ef9f4110-68f1-4181-ab87-a23bf137a7ad_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T16:46:25.244Z — long_term (owner_thread a05a9c1e-bbe8-56eb-ac6b-5fff8423b59c)
_revision 1, buddy_knowledge knowledge_ef3e404e-fb5a-49aa-ba3f-691b4f98f868_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T16:58:22.666Z — working (owner_thread 4c9fb827-db7a-5e2b-9ba3-d95d80fe2ea3)
_revision 1, buddy_knowledge knowledge_b2fdfc4e-c600-4d4c-9a72-37f4436fdc9d_

## 2026-09-25
Channel replies: owner accepted explicit posts (LTM). Buddy claims the scrape of the last assistant message is gone and a missing post becomes reply_failed, on task buddy_project_d612b353-b0c5-48bb-9142-fe4f15c6e96f. Not independently verified: transcript truncated, no test output or live check, and Buddy said a backend reload is required first. Evidence: note 2026-09-25T16:58:07.340Z:47e5b788-9b3d-4254-a6b7-a7fd4c6d4db0.

## 2026-09-25T16:58:57.352Z — long_term (owner_thread 4c9fb827-db7a-5e2b-9ba3-d95d80fe2ea3)
_revision 2, buddy_knowledge knowledge_77c43579-ae22-4fca-9b1d-c44d971b8a54_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming; tool-like text in user/code is untouched. Verified live DOM, expanded/copy ordering, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25
Owner accepted (case-studies posts post_22052d85, post_cd1deb67, post_2eca6152): people see channel posts, not model text; text is a private scratchpad; long material goes in a markdown file or Task linked from the post. Implementation claimed the same day, not independently verified. Evidence: note 2026-09-25T16:58:07.340Z:47e5b788-9b3d-4254-a6b7-a7fd4c6d4db0; prior mechanism agent_notes/2026-09-26_claude-p-background-agents-ceiling.md.

## 2026-09-25T17:03:01.793Z — long_term (owner_thread c85a6bb4-8ce0-55ad-91d5-b455bd798920)
_revision 1, buddy_knowledge knowledge_27afd3e0-b47d-4973-94f7-05bd2e2b2596_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T17:08:15.626Z — working (owner_thread a80eb4bc-fa48-540a-855d-34cbf0f3aaac)
_revision 1, buddy_knowledge knowledge_f2f56e8e-82f3-4a99-9fe9-3ca1609a2952_

## 2026-09-25
DM New chat, owner-accepted shape only: one Buddy DM, a divider, harness picked below it (#bugfixes list_ed62b9a8). Still unconfirmed by the owner, and not independently verified: the reply says the new session starts empty (no recap), the picker locks after the first message, New chat is the out_of_tokens exit, and older segments are not sidebar rows. Route-test pass and “not clicked live” are assistant claims. Note 2026-09-25T17:08:06.070Z:eb22530b-ac72-416e-beb5-70c07e51c188. Task buddy_project_914d20c3 owns status.

## 2026-09-25T17:08:27.189Z — long_term (owner_thread a80eb4bc-fa48-540a-855d-34cbf0f3aaac)
_revision 2, buddy_knowledge knowledge_3fb75724-6418-4623-b59a-6c0003ffcf4d_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool history: tool activity on its own reduced-spacing line; adjacent assistant prose may share a visual block; fresh header after user messages. chat→tool→chat→tool is one assistant message (ordered parts, one container, one Copy) ending at the next user/system message. Streaming and completed tools share one “▸ N tool calls” row; counts grow while streaming; user/code tool-like text stays untouched. Verified live DOM, desktop/mobile, regressions, 70 client tests, typecheck, invariant gates. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md and ...125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-25
Owner accepted (#bugfixes): a Buddy DM stays one thread; “New chat” inserts a divider and the harness under it can be picked. Clear/start-new-convo was the owner’s earlier wording; divider-plus-picker is what they called best. A short recap and a separate retry button were Buddy proposals (post_a6f44f4a), not accepted. out_of_tokens was reported as an account usage limit, not transcript length. Note 2026-09-25T17:08:06.070Z:eb22530b-ac72-416e-beb5-70c07e51c188.

## 2026-09-25T17:09:53.737Z — long_term (owner_thread 949f0e05-242a-5732-a2c3-92f09ae77f81)
_revision 1, buddy_knowledge knowledge_c47c10e9-0e96-4a67-ba44-feb929b08a5e_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T17:09:59.064Z — working (owner_thread c85a6bb4-8ce0-55ad-91d5-b455bd798920)
_revision 1, buddy_knowledge knowledge_32411916-92a1-4790-931d-84375b867906_

## Channel replies (2026-09-25)
Owner (#case-studies list_ed5e4655, post_22052d85 and follow-ups): only a channel post is seen; turn prose is an unread scratchpad; longer material is a markdown doc or task the post points to. Owner accepted matching prompt and tooling. Detail: note 2026-09-25T17:09:46.336Z:9fdbb383-c92f-4870-8266-6583463e3dd6.

Unverified assistant claim the same turn: last-message scrape replacement is coded and 41 tests passed, but the live server still scrapes until a backend reload. Do not treat that as done. The reply's 10-minute Claude ceiling is stale; reuse agent_notes/2026-09-26_claude-p-background-agents-ceiling.md (12h print-mode default on an unpushed branch; 60-minute provider idle still kills a silent Claude wait).

## 2026-09-25T17:12:43.636Z — long_term (owner_thread 4c3eca76-7f1a-515d-960f-f7c1ba2ce141)
_revision 1, buddy_knowledge knowledge_f57fcb06-492f-4aa9-8425-e02fed7aada0_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T17:16:09.716Z — working (owner_thread 3ebf4aca-7788-5d4b-b123-dcdcf104fa35)
_revision 1, buddy_knowledge knowledge_a7fe17d0-111b-474e-afea-e5d8452cae04_

## 2026-09-25 reply gate (deploy unverified)
Owner #bugfixes ~16:44 (list list_ed62b9a8, thread post_f6d906d6, post_fc9feb23): untagged follow-up looked ignored until @mention. Buddy reported the gate ran and did not answer <no>. Claude session-limit (~4s) came back as a successful empty result; an empty/unparseable gate stays silent. Same empty gate ~1 min earlier in #case-studies. @mention skips the gate; the tagged turn hit "You've hit your session limit · resets 2am (Asia/Makassar)" and the running server posted (no reply text) (post_17f26046).
Buddy claims owner posts now get a visible "Couldn't reply" notice and that tests/build passed. Reload is required before the next untagged reply uses it. Live behavior and the code change are not independently verified. Claude cannot answer until that limit resets.
Evidence: note 2026-09-25T17:15:59.754Z:1e98d9a2-b99f-4715-ac9b-63b690454720.

## 2026-09-25T17:16:22.610Z — long_term (owner_thread 3ebf4aca-7788-5d4b-b123-dcdcf104fa35)
_revision 2, buddy_knowledge knowledge_696f18dd-9d53-4a56-b48a-2c611cd03eec_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming and completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming; prose/tool segmentation is preserved; tool-like text in user/code content is untouched. Verified live DOM, expanded/copy, desktop/mobile, client tests/typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Channel reply gate: a Claude session-limit returned as a successful empty result is not <no>. An empty or unparseable gate answer stays silent, so an untagged owner post looks ignored; @mention skips the gate. Observed 2026-09-25 in #bugfixes (post_fc9feb23) and #case-studies. Buddy reported treating that result as out-of-tokens and empty owner-post gates as a visible "Couldn't reply"; reload and live check not verified. Evidence: note 2026-09-25T17:15:59.754Z:1e98d9a2-b99f-4715-ac9b-63b690454720.

## 2026-09-25T17:16:43.113Z — long_term (owner_thread b65fd36f-9cac-53c2-a49b-161ea718e0b3)
_revision 1, buddy_knowledge knowledge_a04e1199-4c9c-47d2-8de4-c67dd0599af4_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T17:18:09.595Z — working (owner_thread 8acbce1b-b77a-587f-b916-9773aad638bf)
_revision 2, buddy_knowledge knowledge_ef510eab-d365-4daf-85a2-1b41d3c05bc6_

Open, 2026-09-26: Owner asked for 12h Claude sub-agent runs. Buddy reported CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=43200000 unless already set, unit test in vendor/agent-cli-tool/test/build.test.ts (claims 195 passed), commit 60c5153 on local unpushed submodule branch test/claude-bg-ceiling-2026-09-26. Outer pointer not bumped. Owner has not accepted a push.

That default does not let a Buddy turn wait 12h. While the parent is idle, Unleashd sees heartbeats only; they do not reset the 60-minute provider-idle watchdog, and the Claude parser drops task_* events. A quiet wait still dies at 60 minutes. Not independently verified beyond the Buddy's transcript and note.

#case-studies list list_ed5e4655-3019-4646-97f2-2b0e37f2ee75: Owner asked which fixes remain and whether a shared-CLI event log is needed. Buddy recommended no new log. Owner has not accepted that. Note: 2026-09-25T17:17:51.567Z:d9ced3ec-8d58-4801-a9d2-7428621df620.

Evidence: agent_notes/2026-09-26_claude-p-background-agents-ceiling.md.

## 2026-09-25T17:18:20.161Z — long_term (owner_thread 8acbce1b-b77a-587f-b916-9773aad638bf)
_revision 3, buddy_knowledge knowledge_90346f6d-ad19-4155-8e96-d9a4b78b3e5d_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history: preserve streamed tool calls through JSONL/cache reload (order, duplicates, cache recovery); labels distinguish tool-only vs prose/mixed. Hydrated saved messages keep inspectable scripts, commands, and JSON arguments, with expanded rendering and Copy (literal exec previews/full scripts, safe markers). Filter recommended-plugin lists only from the complete untagged startup envelope; preserve explicit/later user messages; invalidate old caches. Evidence: agent_notes/20260910T083219Z_…, …084220Z_…, …084839…, …091804Z_….

## 2026-09-10
Owner accepted compact tool-history styling. Tool activity is its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Data-model rule: chat → tool → chat → tool is one assistant message block with ordered parts, one outer container, and one Copy action (desktop/mobile); it ends at the next user/system message. Streaming and completed tools share one expandable “▸ N tool calls” row; counts grow while streaming; tool-like text in user/code is untouched. Evidence: agent_notes/20260910T125040Z_… and …105731Z_….

## 2026-09-26
Claude print mode waits for background agents only until CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS (default 600000, 10 min after parent idle), then exits 0. Unleashd records provider_complete; the ceiling line is ordinary stderr, so nothing records that workers were stopped. No 20-minute Unleashd cutoff. Limits: turn 24h, provider-idle 60m (heartbeats do not reset it; native-session probe is Codex-only), bridge stall 2m. Session dbfcd9c4 on 2026-09-25: parent stops were end_turn, not max_tokens; the ~20m gap was continued work plus that 10m ceiling. The channel reply is the last assistant message at process exit; a later empty message replaced the 16:20 answer with "(no reply text)". Parser drops live task_* events, so a quiet parent still dies at 60m. Owner asked sub-agents be allowed 12h (unpushed local ceiling: working memory). In #case-studies the Buddy recommended no second shared-CLI event log; owner has not accepted it. Evidence: agent_notes/2026-09-26_claude-p-background-agents-ceiling.md; note 2026-09-25T17:17:51.567Z:d9ced3ec-8d58-4801-a9d2-7428621df620.

## 2026-09-25T17:19:19.727Z — working (owner_thread b65fd36f-9cac-53c2-a49b-161ea718e0b3)
_revision 1, buddy_knowledge knowledge_3f7c38f7-e223-46b6-84da-52b48ffc5cf6_

## 2026-09-25
#bugfixes (list_ed62b9a8, thread post_f6d906d6): untagged owner post_fc9feb23 got no participant reply until an @mention. Buddy reported, not verified and not committed: channel-reply-gate treats a Claude session-limit result as out of tokens and an empty gate answer as failure (visible "Couldn't reply"). Dirty: channel-reply-gate.ts, channel-conversations.test.ts, CHANNEL_CONVERSATIONS_2026-09-23.md, and vendor/agent-cli-tool (diagnostics.ts, parsers/claude.ts, claude-title.test.ts) with no submodule commit. No task closed. Related, still open per Buddy: task buddy_project_7bf1c0e1 (retry other harness) and buddy_project_d612b353 ("(no reply text)", in review, needs reload). Left: commit, reload, wait out session limit. Distinct from the print-mode bg-agent ceiling. Evidence: note 2026-09-25T17:19:12.606Z:17e76a05-c1e1-4d58-9870-4947d3d7441b.

## 2026-09-25T17:30:10.182Z — long_term (owner_thread 1562513a-aa8d-514b-8241-680edecc7163)
_revision 2, buddy_knowledge knowledge_4a000d32-a0b9-48ad-9a55-0be024f1084d_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming and completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming; prose/tool segmentation is preserved; tool-like text in user/code content is untouched. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md; ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Reply gate: an untagged thread follow-up does run should-reply for existing participants. An empty or unparseable answer stays silent (not a decision not to reply); @mention skips the gate. Claude session-limit was reported as success with no text, so the thread stayed quiet. Empty answers and out_of_tokens now fail with a visible "Couldn't reply" on owner posts. Evidence note: 2026-09-25T17:29:44.504Z:919fb008-dfe1-4094-84e4-ba8218c55d79.

## 2026-09-25T17:30:11.865Z — working (owner_thread 1562513a-aa8d-514b-8241-680edecc7163)
_revision 1, buddy_knowledge knowledge_a86fca88-045e-46f8-9726-fa3e12bc2850_

Reply-gate notice is committed locally (Buddy claim, matching project evidence) but the running server was left un-reloaded, so untagged follow-ups still use the silent gate. Buddy said Claude cannot write a real answer until the session limit resets at 2am Asia/Makassar (2026-09-26); after reload that limit should show "Couldn't reply". Not independently verified. Note: 2026-09-25T17:29:44.504Z:919fb008-dfe1-4094-84e4-ba8218c55d79.

## 2026-09-25T17:42:33.627Z — long_term (owner_thread 303ea2d0-88ca-5d74-ade7-9f62d75412a9)
_revision 1, buddy_knowledge knowledge_508a7fbd-a05e-4abf-bbb4-3f99eafd690d_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T17:56:02.616Z — long_term (owner_thread d383cbbb-2e66-5677-966c-0bc4098bcd5d)
_revision 1, buddy_knowledge knowledge_b56b7d54-06a6-42fd-90c4-07316c1edb86_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T17:59:48.543Z — long_term (owner_thread b7184738-6549-51ee-8cd0-e8394a2ee2ca)
_revision 1, buddy_knowledge knowledge_6ad328d0-7e9d-4ebb-bd75-cfc05527c137_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T18:17:28.908Z — working (owner_thread 27569890-c994-5a12-9450-7ab7bdbd2ad2)
_revision 1, buddy_knowledge knowledge_20626825-2017-4faa-8bda-2df7aed6ba88_

## 2026-09-25
`/` workspace home is owner-requested, not live-confirmed. Assistant reported route tests (create, folder reuse, list, reject a file) and that the running server still showed "Buddy not found" because the new list route was not loaded. Conversation list still in the sidebar and at `/chats` only per that report. Evidence: note 2026-09-25T18:17:14.352Z:2dbaa314-db11-4702-9035-860800393382.

## 2026-09-25T18:17:37.281Z — long_term (owner_thread 27569890-c994-5a12-9450-7ab7bdbd2ad2)
_revision 2, buddy_knowledge knowledge_d46a92d5-bd4f-42b5-b18f-951d04929b27_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming and completed tools share one compact expandable “▸ N tool calls” row; counts grow while streaming; prose/tool segmentation is preserved; tool-like text in user/code content is untouched. Verified live DOM, expanded/copy, desktop/mobile, client tests/typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Owner (#channels-feature post_2352edd0): `/` should be a workspace home listing workspaces, notification totals, and New workspace with a Folder button that reuses the path finder. The conversations UI list is being hidden as deprecated. Live reload was not confirmed (page still “Buddy not found”). Evidence: note 2026-09-25T18:17:14.352Z:2dbaa314-db11-4702-9035-860800393382.

## 2026-09-25T18:21:10.719Z — long_term (owner_thread 686e1e03-2ba8-5437-b617-33e31057a46c)
_revision 1, buddy_knowledge knowledge_eccb45f6-ec0e-48d4-85ce-da24bfb6ac9c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T18:47:05.100Z — long_term (owner_thread 80b27fd7-9f40-51a8-b6ad-c41ad8b33a6e)
_revision 2, buddy_knowledge knowledge_c73f515b-3d6d-4a12-b379-f16ba967f5b4_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25
Owner (#bugfixes thread post_66802944): Buddy DMs in Channels/Slack use the thread response UI and channel composer, not the old conversations UI.

## 2026-09-25T18:58:29.463Z — long_term (owner_thread 4e4a1840-cd27-5bda-9991-717f28930223)
_revision 1, buddy_knowledge knowledge_a463e814-ac3f-4399-a991-6fea83fbf0dd_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T18:58:43.139Z — working (owner_thread 4c3eca76-7f1a-515d-960f-f7c1ba2ce141)
_revision 6, buddy_knowledge knowledge_8d703472-093e-4220-abb2-b8952f5c9d5c_

## 2026-09-25
#bugfixes list_ed62b9a8, thread post_f6d906d6.

New chat: Owner accepted divider then harness picker (post_8a3014ac). post_898a128b (17:34Z) “seems to work” was that header UI only. Owner revision post_262d858c (17:44Z): not in the header; hover the space under the latest message; changing harness says “Start a new chat to change harness”; finished split is a line with a pill and more space, hover shows that chat’s harness. Assistant claimed those three in post_677ffec9. Not independently verified. ~18:57Z Owner asked “are we done here” (post id not in this review). Assistant posted not done: three changes claimed in the working tree; stays open until Owner says that version looks right. Not verified. Retry-on-out_of_tokens and provider_locked/recap stay Buddy-proposed in post_a6f44f4a, not owner-confirmed.

No-mention “should reply” gate: after post_169c0f66 (cursor exit=1, no turn.complete), Owner asked it to use the latest post. Assistant claimed retarget-to-newer-post; tests claimed, not verified. Owner hypothesized --trust. post_c2f31fa1 “Fix it” is a directive. Gate failed again in post_67cceece with the same --trust exit=1. Assistant claimed source already passes --trust and the live backend was the 1:29 build, so the flag loads only after that turn’s drain. Not verified. Does not prove the next follow-up passes.

Evidence: design 2026-09-25T17:14:06.655Z:9831071b-80fc-4093-94c7-3e29890a1bb4; revision 2026-09-25T17:48:07.610Z:aa4aee1a-9124-4ce9-9f98-1b74e65d99b8; not-done 2026-09-25T18:58:33.328Z:f8459760-d507-47c1-8949-7086959998d0; gate 2026-09-25T17:40:27.878Z:49d204fc-3830-491b-a0ce-d69b206691f9; --trust 2026-09-25T17:41:31.018Z:03c0127b-e480-4131-820e-8562e3909b49; successor 2026-09-25T17:43:49.253Z:df807e18-7b5a-406b-9a59-68f652a84c32.

## 2026-09-25T18:59:02.899Z — long_term (owner_thread 6a1946de-9f92-5c49-a1a3-a69869a16358)
_revision 1, buddy_knowledge knowledge_5c86af22-eb14-4772-9751-199b331db921_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T18:59:30.245Z — working (owner_thread 949f0e05-242a-5732-a2c3-92f09ae77f81)
_revision 3, buddy_knowledge knowledge_d21abd24-f204-4b9c-b568-c5edc0a4ae73_

## 2026-09-25
#bugfixes post_57008736: owner asked for an out-of-tokens retry on a different harness, then directed full implementation (post_8ea23456). PDL reported (code reading only, not independently verified) that a started session cannot change harness; retry is a new seat via the mention-chip path. Channel vs chat behavior was the posted plan the owner then told PDL to build. PDL claimed the button and picker are live and did not press Retry (starts a real turn). Asked again whether done (turn completed 2026-09-25T18:58:00.917Z), PDL posted that the build is in review and a live retry has not been pressed. Tool output in both transcripts is truncated, so neither the implementation nor the review status is independently verified. Project buddy_project_7bf1c0e1 owns status. Notes: 2026-09-25T17:12:47.197Z:ad145133-5254-47d7-857f-15268e4c11fd; successor 2026-09-25T17:37:46.484Z:94c59c40-8152-464d-a25e-c2bfb2f40081.

## 2026-09-25T19:01:37.381Z — working (owner_thread 2e0d33e4-e57f-5e7d-af21-474cbfb265e4)
_revision 3, buddy_knowledge knowledge_4d17460e-d7b3-4b23-88c5-aac83968dac4_

## 2026-09-25
Assistant-recorded, not independently checked: #bugfixes mention chip follows each thread's latest seat (post_ac1f0975 Grok 4.7 Medium vs Codex profile; post_f6d906d6 grok-4.7-low). Restart replay of a settings change was not live-checked. First reply before a seat still uses the profile default. Evidence: note 2026-09-25T17:38:54.124Z:8ff13839-60cc-44a0-925b-be5c5e7ecdfc.

## 2026-09-25
Owner asked whether an unmentioned reply uses a prior poster's last seat, and whether the participant should-respond trigger broke (post_6022e680). Assistant answered from code, not a captured gate log: that seat is reused for the next reply and the gate; only prior posters are asked; a `<no>` is silent; an @mention skips the gate. This thread's only prior poster is Product Development Lead on Grok 4.7 Medium. Whether the 18:56 post actually ran a gate is unverified. Evidence: note 2026-09-25T19:01:20.614Z:93fbeed2-846c-41d4-be9d-82d34d17f04a.

## 2026-09-25T19:01:47.768Z — long_term (owner_thread 2e0d33e4-e57f-5e7d-af21-474cbfb265e4)
_revision 4, buddy_knowledge knowledge_4698c64c-7e3c-4668-85b2-4109bb46ae0e_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload (order, duplicates, cache recovery); labels distinguish tool-only vs prose/mixed. Hydrated messages keep inspectable scripts, commands, and JSON args; expanded view and Copy include literal exec previews. Filter recommended plugins only from the complete untagged startup envelope; keep explicit/later user messages; invalidate old caches. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md; ...080336...vanished-when-polling-replac...; ...084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation...; ...084839...exec-content-preview...; ...091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu....

## 2026-09-10
Owner accepted: chat → tool → chat → tool is one assistant message with ordered parts, one container, one Copy, ending at the next user/system message. Streaming and completed tools share one “▸ N tool calls” row; counts grow while streaming; tool-like text in user/code stays untouched. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md; ...105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity....

## 2026-09-25
Owner asked thread replies use each Buddy identity's latest harness, reasoning, and model, not the profile default, so a change keeps rolling. Assistant later recorded a live chip match on two #bugfixes threads (post_ac1f0975 Grok 4.7 Medium vs Codex profile; post_f6d906d6 grok-4.7-low). First reply before a seat still uses the profile default. Restart replay was cited from config-service tests, not live-checked. The later claim that an unmentioned reply and the should-respond gate reuse that seat is assistant-reported only. Evidence: note 2026-09-25T17:31:24.816Z:bde9106a-7e3b-4472-91a9-1eab5a2d0d48; note 2026-09-25T17:38:54.124Z:8ff13839-60cc-44a0-925b-be5c5e7ecdfc; note 2026-09-25T19:01:20.614Z:93fbeed2-846c-41d4-be9d-82d34d17f04a.

## 2026-09-25T19:10:00.269Z — working (owner_thread 6a1946de-9f92-5c49-a1a3-a69869a16358)
_revision 1, buddy_knowledge knowledge_07f3efa8-267f-4643-9021-b2b6043601a2_

## 2026-09-25
#bugfixes post_57008736 (list_ed62b9a8): owner asked for an out-of-tokens “Retry with a different harness” button and said fully implement. Buddy claimed it shipped, then the owner’s live turn showed only “Couldn’t reply: Provider completed the turn with reason: error” and no button.

Buddy diagnosis, not owner-accepted and not live-retried: Codex refused gpt-5.4 as unsupported on a ChatGPT account; the notice collapsed that to reason:error. Buddy then showed the same button on that failure and omitted Codex from the picker. Other failures stay plain text. Same harness is refused. A started session cannot switch harness; retry is a new seat (mention-chip path). Channel reruns the reply; chat resends the last message on a new conversation (Buddy DM keeps the old transcript above the divider).

Unverified here: test and picker claims are assistant-reported only. Retry was not pressed, so no retry turn has run, and the owner has not confirmed the button now appears. Task buddy_project_7bf1c0e1 was reported in review before this miss; status after the edit was not re-read.

Evidence: note 2026-09-25T19:09:52.984Z:efa13099-fe8a-4cb2-97da-71c9ee376131.

## 2026-09-25T19:13:48.714Z — long_term (owner_thread c7bcd02c-dcb4-52e7-b359-b5abac4b6882)
_revision 2, buddy_knowledge knowledge_79ebb794-0779-4e70-8576-5d190a49410b_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming and completed tools share one compact expandable “▸ N tool calls” row; counts grow during streaming; tool-like text in user/code content is untouched. Verified live DOM, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-25
Owner wants general Slack-style emoji reactions on channel posts: a small add button, search, most-used first. A single Done-check toggle was only a Buddy proposal and was superseded. Custom uploads were not owner-accepted. Evidence: note 2026-09-25T19:13:08.590Z:d1de6ea6-e499-4c4a-a7f1-c9466e29a791.

## 2026-09-25T19:26:17.313Z — long_term (owner_thread 75ffc9ad-bf22-5ff2-a414-33580679020b)
_revision 2, buddy_knowledge knowledge_675dd914-8c5d-4872-8d42-176fc2619180_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity share that same “▸ N tool calls” row: counts grow while streaming, prose/tool segmentation stays, and tool-like text in user/code content is untouched. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25
Owner (#channels-feature post_2352edd0): `/` is the workspace home — every workspace, notification totals, New workspace with a Folder button that reuses the path finder. The conversation list is being retired; on this view the owner asked to remove the convos sidebar, show icons for the most recent, and keep the design restrained. Empty path-finder input is reported as valid, so Create must require a chosen folder. Assistant claims only, unverified. Evidence: note 2026-09-25T19:25:27.978Z:5be373ab-5190-485f-80bc-e474e2cba05e

## 2026-09-25T19:40:25.613Z — long_term (owner_thread 616df7a0-867e-51d5-b5c9-e5fc6c429c14)
_revision 1, buddy_knowledge knowledge_0a075ad3-3681-4276-bce3-62dce5eea5af_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25T19:41:32.835Z — working (owner_thread 75ffc9ad-bf22-5ff2-a414-33580679020b)
_revision 2, buddy_knowledge knowledge_4c8dc1b0-1cb8-40e0-8765-3238356323a9_

## 2026-09-25 workspace home
Owner asked for `/` as the workspace home and to hide the conversation sidebar on that view (icons for most recent; restrained design). Owner later said that home “looks great,” then asked for a different icon system. Assistant claims the home is in 6d04860 and 89b27ad, including disabling Create when the path finder treats an empty input as valid. Unverified. Shared files were only partly committed; other sessions’ hunks remain uncommitted, and the full client suite still had 2 failures the assistant blamed on that other work. Evidence: note 2026-09-25T19:25:27.978Z:5be373ab-5190-485f-80bc-e474e2cba05e

## 2026-09-25 workspace emblems
Owner asked to fork workspace icons from Buddy sigils: mostly dark faded ground, unique non-rectangular kernels, pattern strong at the center and ~10% at the rim. Assistant claims c5e0ded and emblem.ts; Buddy icons unchanged; typecheck/lint clean; screenshots only; hard seams on some names from the shared generator. Owner has not accepted the result. Evidence: note 2026-09-25T19:41:14.890Z:ed050cfe-02da-4eb5-b144-d68fb507a2bd

## 2026-09-25T19:43:26.557Z — working (owner_thread f1bbacdb-dc52-55ec-9be9-27dfa0f48026)
_revision 2, buddy_knowledge knowledge_f8e527d0-dc1f-48e6-a0ba-56b6d14358f1_

## 2026-09-25
#channels-feature list_a19772a0, thread post_48a55848. Owner first asked for a small + next to Buddies that starts the existing new-buddy flow, looks like a DM, shows Pending on the name, and sits in the Buddies section.

Owner correction post_b4479cc5 (screenshot, ~10 pending): show only the latest buddy-creator conversation, one at a time, label "Creating buddy", italic, and archivable. Not owner-confirmed after the follow-up.

Assistant reported (not independently verified) on feat/channels-project-view-2026-09-22: newest in-flight builder is italic Creating buddy; × marks the conversation Done; Buddies + archives other open builders before starting one. Owner was asked to hard-refresh. Per-existing-Buddy new chat with a harness divider was left out of the first slice.

Evidence: note 2026-09-25T19:43:17.827Z:7d2138fb-3b37-4201-a2d1-e3b127a16e79

## 2026-09-25T19:43:55.099Z — long_term (owner_thread f1bbacdb-dc52-55ec-9be9-27dfa0f48026)
_revision 2, buddy_knowledge knowledge_515eb3b7-eb5e-472d-b4f9-74bfa93562a2_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified transcript 21/21, 24 server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity on its own reduced-spacing line; adjacent assistant prose may share a visual block, fresh header after user messages. Accepted rule: chat → tool → chat → tool is one assistant message with ordered parts, one outer container, one Copy, ending at the next user/system message. Streaming and completed tools share one “▸ N tool calls” row. Verified live DOM, desktop/mobile, 70 client tests, typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming; prose/tool segmentation is preserved; tool-like text in user/code content is untouched. Verified live, focused regressions, client typecheck, invariant gates. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-25
Channels Buddies rail, owner-stated in post_b4479cc5 (narrows post_48a55848): one latest in-flight Buddy Builder only, labeled "Creating buddy", italic, archivable. Multiple Pending rows are not wanted. Follow-up fix unverified. Evidence: note 2026-09-25T19:43:17.827Z:7d2138fb-3b37-4201-a2d1-e3b127a16e79

## 2026-09-25T19:47:02.050Z — working (owner_thread 303ea2d0-88ca-5d74-ade7-9f62d75412a9)
_revision 1, buddy_knowledge knowledge_79df2c78-4831-46c8-8984-3858e56158b5_

## 2026-09-25 ~19:46Z (Buddy-reported git inspection; not re-verified; Buddy did not commit or push; owner had not accepted the offer)
feat/channels-project-view-2026-09-22 at c5e0ded is 28 commits ahead of origin and unpushed. Newest six also absent from lean/integration: a2e4135, 6535b62, 92e8692, 6d04860, 89b27ad, c5e0ded. Those commits survive other editors and are lost if the branch is reset before a push.
Shared ~/git/unleashd checkout is dirty on top of c5e0ded (~2260 lines / 54 tracked files + 18 untracked channel/DM files, including ChannelDm*, dm-chain.ts, out-of-tokens.ts, UNLEASHD_2_0_LAUNCH). Another session can overwrite that. Dirty agent_notes JSON was called fixture churn.
Submodule: parent pins vendor/agent-cli-tool 85ba151; checkout is test/claude-bg-ceiling-2026-09-26 at efe0503 (no upstream) and does not contain 85ba151. Parent does not record efe0503.
Other agents' commits reported on other branches/worktrees (lean/integration, ingest/usage/CSS; d4a8337 still in worktree-agent-a0e54436fbec3f1d8; efc6f17 already here). main worktree called an older merge.
Detail: note 2026-09-25T19:46:53.612Z:250219f0-07cf-4a07-99db-7390a01716ed.

## 2026-09-26T08:16:33.032Z — long_term (owner_thread bcbe1841-9e1e-55a8-85d1-45d62612417d)
_revision 1, buddy_knowledge knowledge_12b07645-ead4-476c-8157-8f86bc60176c_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-26T08:20:49.801Z — long_term (owner_thread 2108df53-0e6d-5c3f-8368-33bd385174fb)
_revision 2, buddy_knowledge knowledge_eb9f5494-3a9c-4586-bf21-9beea627169e_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row (counts grow while streaming; user/code tool-like text untouched). Verified live DOM, expanded/copy, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md and ...105731...unified-live-and-completed-tool-activity....

## 2026-09-26
Channel markdown custom parts (including video) must be built once. A stable media URL still restarts if background member/Task refresh remounts the player. Buddy-reported fix 69eb4cf (feat/channels-project-view-2026-09-22, not pushed) in ChannelMarkdown.tsx. Evidence note: 2026-09-26T08:20:21.799Z:1cde75cf-f56b-45c9-b989-b42a4cb2dcb1.

## 2026-09-26T08:20:49.825Z — working (owner_thread 2108df53-0e6d-5c3f-8368-33bd385174fb)
_revision 1, buddy_knowledge knowledge_5534f44f-8dfb-49d6-8c00-2978562759bb_

## 2026-09-26 video restart
Owner reported (#bugfixes thread post_631cc070) videos restart after ~4s. Buddy attributed it to ChannelMarkdown remounts on 10–15s refresh, not unstable URLs, and reported commit 69eb4cf unpushed. Owner has not confirmed after reload. Hover-card stability was claimed as a side effect and not tested. Full evidence: note 2026-09-26T08:20:21.799Z:1cde75cf-f56b-45c9-b989-b42a4cb2dcb1.

## 2026-09-26T08:25:02.560Z — working (owner_thread bcbe1841-9e1e-55a8-85d1-45d62612417d)
_revision 1, buddy_knowledge knowledge_e60bab35-a4de-4526-9f13-07a32757db91_

## 2026-09-26
#bugfixes thread post_ae5c7907 (list_ed62b9a8): owner asked for screenshots of all product views, with separate mobile, iPad, and desktop threads. Buddy reported posting three threads (phone 390×844, desktop 1440×900, iPad portrait 768×1024 and landscape 1180×820), screen-only, real data (this Buddy's tabs, swarm ~/git/wave_sim, #bugfixes). Posts were not independently verified.

Buddy observed, not owner-accepted: width 768px uses the phone layout, so iPad portrait matches phone and landscape does not.

Reshoot was `node output/shoot-all-views.mjs` with the dev server up. That path is gitignored. Adding the views to `pnpm screenshots` was offered and not accepted.

## 2026-09-26T08:28:06.956Z — long_term (owner_thread 223d81f9-316e-53c9-bb1a-a4f5a591b143)
_revision 1, buddy_knowledge knowledge_55eff4c7-2383-4830-b4e2-8ca0d8d639c3_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-26T08:33:43.433Z — working (owner_thread 223d81f9-316e-53c9-bb1a-a4f5a591b143)
_revision 1, buddy_knowledge knowledge_bf76c5e5-732b-4b53-8c10-0755b2f780a8_

## 2026-09-26
Owner asked in #channels-feature (list_a19772a0, thread post_88b54cc0) for a way to open Settings / Color Palette. Buddy reported, without independent verification and without a commit, that ConfigDropdown only mounted in ShellDesktop, so Channels and `/` workspace home had no gear.

Claimed uncommitted working-tree fix: thin AppSettingsDropdown under client/src/components/buddies/, used from the desktop ChannelBrowser rail (next to ← Workspaces), WorkspaceHome top nav, and mobile Channels home plus workspace home. Buddy claimed client tsc -b, client invariant gates, then full pnpm typecheck exit 0. No live browser check in the turn. Owner has not accepted the placement.

## 2026-09-26T09:17:41.469Z — long_term (owner_thread 213b7523-6237-549f-919c-d1f7ccf9ef65)
_revision 2, buddy_knowledge knowledge_09030595-2c0e-4cbe-a20f-0c561ae4a819_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming and completed tools share one compact expandable “▸ N tool calls” row (counts grow while streaming; tool-like text in user/code is untouched). Verified live DOM, expanded/copy ordering, desktop/mobile, client tests and typecheck. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md; ...105731...unified-live-and-completed-tool-activity....

## 2026-09-26
Owner accepted #channels-feature thread post_4e306ec0: on start create "Product Dev" and "Upstream Release Manger" (owner spelling). Accepted: user-owned checkout as the unleashd workspace, #upstream, fetch-only behind check, Update/Later popup, merge only in that readable thread, never silently, no reset or rebase. Evidence: note 2026-09-26T09:17:23.479Z:2c359749-3a38-4851-b660-d065469b0f2e.

## 2026-09-26T11:03:35.626Z — working (owner_thread c7bcd02c-dcb4-52e7-b359-b5abac4b6882)
_revision 1, buddy_knowledge knowledge_e3a1ba8e-3e4f-46ca-83f0-44441ac6f5a7_

## 2026-09-26
Owner asked in #channels-feature thread post_8487c5a0 (list_a19772a0) whether Slack-style reactions are done. Buddy reported, after grep, that they are not: no reaction, add button, or picker yet, and posted that in the thread. That report is the assistant's claim, not independently verified here. Owner preference is unchanged (long-term 2026-09-25; note 2026-09-25T19:13:08.590Z:d1de6ea6-e499-4c4a-a7f1-c9466e29a791). Observed project buddy_project_0832c5f2 was still status ready at review; do not treat that as shipped.

## 2026-09-26T11:36:36.191Z — long_term (owner_thread fb7cb5eb-8199-5253-8e36-f65fa1199e8b)
_revision 1, buddy_knowledge knowledge_6be0be5a-6010-49c4-9047-1c1f118d9194_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-26T11:41:44.434Z — long_term (owner_thread 80e8d68e-57fb-56eb-b1e6-23c2be766906)
_revision 1, buddy_knowledge knowledge_157f1232-c592-4971-960e-b323ae6f4d7e_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-27T06:07:25.584Z — long_term (owner_thread 40b95da4-c0f9-5104-9007-ac59945f921e)
_revision 2, buddy_knowledge knowledge_6bb41bcf-e8fd-4a23-b3d0-e031f0ba103e_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks.

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed.

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks.

## 2026-09-27
Selectors expose latest GPT-6, not GPT-5.6; legacy IDs remain valid for existing conversations. Supported models default to medium thinking effort (including Claude); switching resets effort to configured default. Assistant-reported implementation/typecheck passed; stale running catalog means live behavior remains unverified. Detailed evidence note: 2026-09-27T06:06:24.767Z:41e7063c-450d-4007-b90f-32db343884d3.

## 2026-09-27T06:16:29.095Z — long_term (owner_thread 0d2a6f12-b879-5383-87c5-c241cf8b0700)
_revision 1, buddy_knowledge knowledge_7fca2b81-aa22-4935-b202-f838cac7bb1d_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-27T06:21:53.598Z — long_term (owner_thread 5edceb4b-412f-5364-bdb7-a9cfd1b9fcb7)
_revision 1, buddy_knowledge knowledge_c27515f5-7e5d-49d3-a41b-b4ddb335f581_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-27T06:24:35.811Z — long_term (owner_thread be6ae806-4f1f-5730-a08e-91b0985db4dc)
_revision 1, buddy_knowledge knowledge_b722679d-ca40-4495-8ff7-2a506d6db487_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Verified real transcript (21/21 calls), 24 targeted server tests, rendering/live checks. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Names alone are insufficient: hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Saved-input/cache, desktop/mobile, typechecks, regressions, and live recorded-call checks passed. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Native replay: first user “What is this buddy?”, zero setup rows, 147 tool calls; current CLI/bundled Codex report recommendations disabled. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling: tool activity stays on its own reduced-spacing line; adjacent assistant prose may share a visual block, with a fresh header after user messages. Final accepted data-model rule: chat → tool → chat → tool is one singular assistant response/message block with ordered parts, one outer container, and one Copy action across desktop/mobile; it ends at the next user/system message. Streaming/completed tools share one compact expandable “▸ N tool calls” row. Verified live DOM, expanded/copy ordering, desktop/mobile, 70 client tests and typecheck. Fuller evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md.

## 2026-09-10
Streaming and completed tool activity should share one compact expandable “▸ N tool calls” row, spacing, and input rendering; counts grow during streaming, prose/tool segmentation is preserved, and tool-like text in user/code content is untouched. Verified live with focused regressions, client typecheck, invariant gates, and diff/format checks. Evidence: agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-27T06:35:37.258Z — long_term (owner_thread c5cbc5bb-a139-555e-ba51-1baf4038fe04)
_revision 2, buddy_knowledge knowledge_91590bdb-2ba6-4623-9cc0-23bab1cd62da_

## 2026-08-20
Guard: Never git reset --hard / filter-branch / rebase -i on shared branch mobile-fixes-and-audit-2026-08-18 (orphaned 5a6cf40/vendor B1-B6 fc7751a and 79a8381). Use stash/throwaway branch; enforced in settings, shell wrapper, and AGENTS.md. Keep shared FS; worktrees only for parallel writers.

## 2026-08-20
Sidebar/Buddies: /buddies cards sort by recentRuns.lastActiveAt via ui-contract.ts. Sidebar uses restrained 2-layer nested Buddies/threads hierarchy; shared headers/rules; per-buddy + reuses createConversation+buddyContext.

## 2026-08-20
Lifecycle: reload drain must be bounded. Shutdown has drain/flush grace periods and 8s force-drain; server returns retryable 503; upload retries once during drain. Watcher boundedly restarts unexpected exit(0); transform errors do not burn budget.

## 2026-09-09
Owner prefers elegant, restrained UI; avoid sloppy decoration and preserve label alignment/hierarchy. Sidebar divider should be one subtle solid line after project name, not a leading dashed rule that displaces names.

## 2026-09-10
Codex history must preserve streamed tool calls through JSONL/cache reload, including order, duplicates, and cache recovery; labels distinguish tool-only vs prose/mixed activity. Evidence: agent_notes/20260910T083219Z_01M2574GMXX0KZDSP7MPK17W1S_tool-only-history-mislabeled-earlier-updates-aft_product-development-lead_c51402b4.md and ...080336...vanished-when-polling-replac....

## 2026-09-10
Hydrated saved messages preserve inspectable scripts, commands, and JSON arguments; expanded rendering and Copy support them, including literal exec previews/full scripts and safe marker rendering. Evidence: agent_notes/20260910T084220Z_01M257PVJ35NZC8ENCT19CR49E_codex-tool-history-detail-preservation_product-development-lead_c51402b4.md; ...084839...exec-content-preview....

## 2026-09-10
Recommended-plugin lists may be stale persisted setup; filter only the complete untagged startup envelope, preserve explicit/later user messages, invalidate old caches. Evidence: agent_notes/20260910T091804Z_01M259R97KZBQH665BQB7R37SV_resumed-codex-history-can-expose-pre-disable-plu_product-development-lead_c51402b4.md.

## 2026-09-10
Owner accepted compact tool-history styling and message grouping: ordered chat/tool parts in one assistant response, one Copy action across desktop/mobile; streaming/completed tools share compact expandable row. Evidence: agent_notes/20260910T125040Z_01M25NXJTZXQF1V3P0GKJFVSSS_assistant-response-tool-message-block-model_product-development-lead_c51402b4.md; agent_notes/20260910T105731Z_01M25FECZ5GTBZGVHMYFPWZV8V_unified-live-and-completed-tool-activity_product-development-lead_c51402b4.md.

## 2026-09-27
Owner-directed channel archiving reportedly implemented across storage/MCP/API/UI, but turn ended in review pending backend reload and safe phone UI integration. Evidence and scope caveats: note `2026-09-27T06:34:55.456Z:5f47a2d2-7e61-4927-8aa9-8b80ce31e770`. This does not accept the broader rename/unified MCP proposal.
