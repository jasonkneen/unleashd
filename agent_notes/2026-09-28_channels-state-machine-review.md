# channels.ts state-machine review — 2026-09-28

Question (owner, #channels-feature thread post_01a0e42e-fc7a-7343-bdbb-f18a34320edb):
"Review this code carefully … tight state machines. Does it need a refactor? Would TLA+ or
other proofs help?" Subject: `server/src/buddies/channels.ts` at a38bdc2 (Buddy mentions
dispatch through the owner's mention path).

Status: assistant recommendation (Buddies Development Lead), awaiting owner decision.

## Findings

### F1 CONFIRMED — a gate in flight plus a mention for the same pair runs a duplicate turn
Repro (scratch test, same `world()` fixture as buddies-v2, gate held on a promise):
1. Owner posts P1 "Thoughts?" in a thread where Lead and Designer have posted → both gates start.
2. Before they answer, owner posts P2 "@Lead answer" → Lead's mention turn runs and its
   context includes P1.
3. The held P1 gate returns yes → `followUp` calls `reply()` unconditionally → Lead runs a
   second turn answering P1 ("Thoughts?"), which it already read.
Observed: turns = [Lead←P2, Lead←P1, Designer←P1]; Lead posted "Answer 1" and "Answer 2".
Cause: "has this pair already read past this post?" is checked only in `settle()` (for a
deferred post), not when a follow-up reply is admitted. `gate` → `respond` → `reply()` skips it.


### F2 — one pair's state is spread over six structures
`queues`, `gating`, `deferred`, `queuedForSlot`, `contextReadAt` (per pair) and `seenThrough`
(per seat) together encode ONE per-(thread, Buddy) machine: idle | gating | replying(queue),
plus a pending post and a read-through mark. The legal combinations are enforced only by the order
of `.add/.delete/.set` calls spread over `reply`, `gate`, `settle`, `runReply` and
`trackRunSlot`. F1 happened because of this: the admission rule sits in one transition (`settle`)
and not in the others.

### F3 — two read marks, two clocks
`contextReadAt` (wall-clock ISO, per pair) and `seenThrough` (post id, per seat) both mean
"the last post this seat has read". `settle` compares a store `createdAt` against a server
`new Date()`. Store `ord` is the monotonic order the core already provides; use one mark, as an ord.
Neither map is ever pruned, and both are lost on restart. After a restart the seat gets
the full prompt, which is safe ("more, never less") but not stated as a rule.

### F4 — mention dispatch has two entry points split on author kind
Owner mentions: `publishOwnerPost` (routes.ts) → `respondToMentions(chosen picks)`.
Buddy mentions: the `posted` listener → `respondToMentions(new Map())`, gated by
`post.author.kind !== 'buddy'`. It is the same function but has two call sites and one structural branch. The chip picks
are the only reason: they are a *seat* choice ("open this Buddy's seat on model X") being
passed as a dispatch parameter.

### F5 — whole-thread reads per event
Each post: `considerThreadPost` + `respondToMentions` read the whole thread. Each reply:
`runReply` (before-set), `seatPrompt`, `postedSince`, and `followUp` read it again. Every
read pages the whole thread, so a thread with N posts costs O(N²) in total.

### Independent review (Opus subagent, read-only, same commit): additional findings
- R2 CONFIRMED by reading `crates/unleashd-buddies/src/store.rs` `idempotent()`: a replayed
  post key returns the ORIGINAL post, and `mcp.ts` `post` / `announcePost` emit `posted`
  anyway. The mentions and gates therefore run again, so an agent that retries a tool call wakes
  people twice.
- R3 `retryReply` takes no key: a double click starts two turns.
- R4 In `runReply`, `before`, `postedSince` and `postFailure` sit outside the try. If one
  throws, an owner mention ends with neither a reply nor a notice (logged only).
- R5 A gap between `untilIdle` and the send: an owner typing into the seat meanwhile makes the
  send drop, and `awaitTurn` has no timeout, so the pair's queue can wedge.
- R6 The chain cap is checked at gate/mention dispatch, not when a follow-up is admitted
  (`settle` re-gate, yes verdict). k Buddies can produce ~3k-2 replies to one owner post.
- R7 **Opened by a38bdc2**: the chain counts one thread only. A→B→A over NEW top-level posts or
  other threads has no bound. What limits this is the model's choices, not the code.
- R8 Rejected Buddy mentions are only logged, so a dead chip is still silent in those cases.
- R9 `postedSince` accepts any post by the Buddy (not only from this seat's conversation).
- R11 A failure notice (not announced) that lands before `considerThreadPost` reads the
  thread makes the owner's post "not newest", so it is never gated.
- R13 `reply_failed` is excluded from `postedSince` but counts in `buddyChain` and in the
  participant list.
- Also: `eligible` `.catch(() => null)` is a silent fallback, and `attempt: ''` is a sentinel.

## Verdict: yes, refactor the dispatch core (not a rewrite)
1. One `PairState` sum per (thread, Buddy): `Idle{readThrough: ord} | Gating{pending} |
   Replying{queue, pending, slot}`. A pure `step(state, event) -> {state, effects}` and a thin
   driver. There is ONE admission rule: skip a follow-up for a post at or before `readThrough`, and apply the cap there.
   Fixes F1, R6, F3/R10/R12, and pruning (Idle entries drop).
2. One dispatch entry: the `posted` event, for FRESH posts only. The crate returns
   `Created | Replayed` and only `Created` is announced. The chip pick becomes a seat operation
   the route performs before posting, so dispatch has no parameters and no author branch. Fixes
   R2 and F4, and makes the asBuddy response honest.
3. Causal hops replace the per-thread chain. A turn started by a Buddy post carries `hops`, its
   posts inherit hops+1 (via `fromConversationId`), an owner post resets to 0, and the cap
   applies to hops. That is one rule instead of two, and it closes R7.
4. `runReply`: one try around everything, so a mention ALWAYS ends in a reply or a notice (R4).
   One `isReply(post, seat)` predicate for R9/R13. Retry keyed (R3). A rejected Buddy mention is
   posted as a visible notice (R8).
5. Seat send: an atomic "enqueue as seat turn, await its settle, with the turn deadline"
   in the runtime, replacing the `untilIdle` poll and send (R5).

## TLA+ / proofs
Invariants that matter: S1 at most one turn per seat; S2 every mention ends in exactly one reply
or notice; S3 no follow-up for a post the pair already read; S4 Buddy-only activity is bounded.
Recommendation: do not write a separate TLA+ spec for this layer, because it would drift from the TS. Make `step`
pure and exhaustively model-check it IN the test suite: breadth-first search over every interleaving at a
small scope (2 Buddies, 3-4 posts, gate yes/no/fail, turn settle/fail), asserting S1-S4 on every
reachable state. That is TLC's method run on the real code, in milliseconds, in CI. F1 is exactly the
kind of interleaving it finds. TLA+ earns its keep later for the durable, cross-process part
(restart with a turn in flight, run slots, grant revocation), if replies become durable.

## Successor — 2026-09-29: implemented (owner decision)

Decision: owner, #channels-feature thread post_01a0e73a-981c-7289-9f24-0537ec13c4fd, 2026-09-29:
"Complete all work … simple code, no slop, deslop this part of the code base … implement fully."
That accepted the seat proposals #2/#3 from the same thread plus this review's dispatch cleanup.

Landed (one commit; channels.ts, runtime-config.ts, buddy-conversation-slots.ts, server.ts, tests):
- #2 A mention-chip pick on the SAME provider is applied to the current seat through the one config
  write path (`replaceRuntimeConfig` → `updateRuntimeConfig`), so its provider session resumes;
  only a provider change opens a new seat generation. Evidence that motivated it: wave_sim thread
  post_01a0e430…, 2026-09-28 — Wave Sim Lead's effort pick high→max and the CEO's high→xhigh each
  opened a new seat (conversation-records.sqlite: one provider session per seat).
- #3 A fresh seat's prompt includes the Buddy's own earlier replies (newest first, 8k chars).
- F1 fixed by ONE admission rule at run time (`admitted`): follow-up only for an unread post in an
  uncapped thread; mentions and retries always run. Also closes R6 (cap at admission).
- F2/F3: six structures → four with one meaning each; `contextReadAt` (wall clock) and
  `seenThrough` (post id) → one `readThrough` ord per pair, set when a turn completes.
- R3 retry dedupe by failed-post id while queued/running; R4 one try around every step; R5 compose
  after idle and send in the same tick as the last idle check; R8 a capped mention leaves a notice;
  R9 only the seat's own posts count as its reply; R11/R13 notices excluded from dispatch
  (`talkOf`); `eligible` no longer swallows errors (`listBuddies` lookup).

Not done, and why:
- Pure `step(state, event)` + exhaustive interleaving search: the four maps with one rule proved
  enough to fix F1 with a regression test (mutation-checked: disabling the rule fails it). Revisit
  if another interleaving bug appears in this layer.
- F4 (two mention entry points): the owner route needs the dispatch result (client opens the
  thread on `started`); unifying it means an event→route result channel. Not worth it now.
- R2 (replayed post key re-announces): mitigated, not fixed — a replayed mention while its reply is
  queued/running is deduped by reply id; a follow-up for an already-read post is skipped. A replay
  after the reply finished still wakes once more. The real fix is `Created | Replayed` from the
  crate's `post`, which changes the napi return type for every caller.
- R7 (Buddy chains across new threads): still bounded only by model choices.
- Persisting `readThrough` across restarts: a restart still costs one full-context prompt.
