# Incident: Codex Worked Natively While Its JSON Stdout Was Paused

Date: 2026-08-04 (KST)

## Outcome

The earlier ten-minute false-idle kill and this incident are related, but not identical.

- The earlier watchdog treated the absence of unified events as proof that Codex was idle and
  killed an active turn after 600 seconds.
- The first repair added a startup heartbeat and raised the provider-silence allowance. That kept
  the next turn alive, but it also treated a synthetic timer event as provider progress and the UI
  mislabeled that timer as "Last activity."
- In the live follow-up, native Codex continued reasoning and using tools while the parent process
  did not drain the first JSONL event from the child stdout socket.

The live socket contained exactly 77 unread bytes, equal to Codex's initial
`thread.started` JSON line. The native rollout continued growing for more than twenty minutes.
That localizes the failure below JSON framing and parsing: the child emitted the first record, but
Node's readable stream was not flowing.

## Evidence chain

```text
Codex model/API                    active
Codex native rollout              advancing
Codex tools and MCP children      active
Codex JSON stdout socket          77 bytes queued unread
shared CLI raw-stdout callback    never called
shared CLI synthetic heartbeat    healthy
Unleashd provider event stream    silent
UI assistant text                 empty
```

The synthetic heartbeat proved only that the shared CLI timer, async queue, and server consumer
were alive. It did not prove that the child process was advancing. Native rollout metadata supplied
that independent evidence.

## Twenty investigated hypotheses

1. **Child stdout stayed paused despite a data listener — confirmed.** The server end of the socket
   retained the complete first JSONL record unread.
2. **A Node 24/macOS detached-child stream-state interaction triggered the pause — likely.** The
   application used a detached, unref'd child with piped stdout and relied on implicit flowing mode.
3. **A spawn/listener timing race left the readable paused — plausible.** There was no explicit
   `resume()` after attaching the listener.
4. **Codex stopped its JSON reporter after its first undrained write — likely secondary effect.**
   Only the first 77 bytes were queued while native work continued.
5. **Codex 0.146 generally buffers `exec resume --json` until completion — ruled out.** Controlled
   fresh and resumed probes streamed normally.
6. **Code-mode or custom tools suppress all Codex JSON output — mostly ruled out.** Controlled tool
   probes streamed; they may still make the original race easier to trigger.
7. **The JSONL framer retained an incomplete line — ruled out.** The raw callback never received the
   already-complete line.
8. **The Codex parser rejected a new event family — ruled out as the initiating failure.** Parsing is
   downstream of the unread socket.
9. **The shared async event queue stopped forwarding — ruled out.** Synthetic heartbeat events used
   the same queue successfully.
10. **The server event consumer stopped iterating — ruled out.** It consumed and journaled every
    heartbeat.
11. **The model or upstream API hung — ruled out.** Native reasoning, token records, tool calls, and
    HTTPS activity continued.
12. **The native Codex process died while its wrapper remained — ruled out.** Both processes and
    tool children remained alive.
13. **The resume session ID was invalid — ruled out.** Codex opened and advanced the exact rollout.
14. **The large 12+ MB resumed session caused generic resume failure — not supported.** The session
    worked natively, although a large history remains a useful stress case.
15. **The required Buddy MCP server blocked startup — ruled out.** Native MCP/tool calls completed.
16. **Invalid model, effort, sandbox, or argv flags prevented execution — ruled out.** The native
    task used the requested configuration and ran tools.
17. **The ten-minute maximum runtime fired — ruled out.** The hard maximum is 24 hours; the old
    failure was the separate 600-second idle watchdog.
18. **The repaired heartbeat fully solved liveness — disproved.** It prevented a false kill but could
    keep a truly dead child alive until the hard cap.
19. **The UI's "Last activity" represented model activity — disproved.** It represented the wrapper's
    synthetic heartbeat timestamp.
20. **The typing ellipsis represented streamed assistant output — disproved.** It was created by a
    synthetic `turn.started` event before any text delta existed.

## Repairs

- Explicitly put child stdout into flowing mode after attaching the data listener.
- Record stdout attach/resume/pause/close state, `readableFlowing`, and buffered byte count.
- Probe Codex rollout progress using only file metadata; never read or expose prompts, reasoning, or
  tool content.
- Report bridge silence, raw-stdout silence, native-session advancement, and visible output as
  separate facts.
- Use separate watchdogs:
  - short bridge-health deadline;
  - longer provider/native-progress deadline;
  - independent 24-hour hard maximum.
- Never let a timer-only heartbeat refresh the provider-progress deadline.
- Label heartbeat-only state as waiting/output-silent rather than generic activity.
- Do not display a typing ellipsis until an actual text delta exists.

## Required regression cases

1. A child writes one JSON line while the stream begins paused; the line must be drained.
2. Heartbeats continue but stdout and the native file remain frozen; provider-idle termination wins.
3. Stdout is silent while the native rollout advances; the turn remains alive and reports native
   work without inventing UI output.
4. Both stdout and native progress resume; diagnostics transition back to provider output without
   duplicate events.
5. Bridge heartbeat stops; the short bridge watchdog terminates independently of provider timeout.
6. All evidence continues beyond the hard maximum; the 24-hour cap still terminates the turn.
7. A heartbeat-only turn renders no assistant typing dots.
8. A real first text delta transitions the UI into streaming state.
9. Backend reload with an active turn drains safely and does not start queued work on the old
   runtime.
10. A real Codex 0.146+ run lasting longer than ten minutes records stdout and rollout metadata side
    by side.

## Verification completed

- Shared CLI typecheck and build passed; 171 tests passed.
- Server build passed; 159 tests passed with one opt-in live test skipped.
- Dev watcher/supervisor suite: 20 passed.
- API integration suite: 16 passed.
- Client production build passed; 12 focused diagnostics/render tests passed.
- The previously stuck process was allowed to persist its filesystem changes, then its exact
  detached process group was stopped so the queued reload could complete.
- The replacement backend started with a new boot ID and restored 583 conversations.
- A fresh full-stack Codex canary traversed WebSocket creation, `codex exec --json`, a real shell
  tool call, streamed commentary, final text, `turn.complete`, and deletion successfully.
- The resumed Buddy path reports `stdoutReadableFlowing=true`, zero buffered bytes, and native
  rollout advancement separately while its long-running work continues.
