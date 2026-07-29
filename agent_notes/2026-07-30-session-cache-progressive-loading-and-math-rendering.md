# Session cache, progressive loading, and math rendering

Date: 2026-07-30

## Outcome

This change closes the page-load investigation with three concrete improvements:

1. Provider-native session files are normalized once and reused from a durable cache while their
   source identity is unchanged.
2. Progressive startup emits a small first batch before returning to larger steady-state batches.
3. The virtualized chat starts at the newest estimated offset, so an enormous oldest prompt is not
   rendered as Markdown immediately before the UI scrolls to the bottom.

The same worktree also contained the completed chat math-rendering change. It is included in the
same commit and documented below.

## What was slow

The original 91 MiB WebSocket snapshot had already been replaced with summary-first loading and
lazy client detail fetching. The remaining costs were:

- backend restarts reparsed up to 500 raw Claude, Codex, Gemini, and OpenCode session sources;
- the first progressive update waited for the normal 100-item batch;
- a conversation whose first prompt was approximately 118,000 characters rendered that prompt
  before the virtualizer's layout effect moved to the newest message.

The full-conversation HTTP request was not the visible bottleneck. In the measured thread it
returned about 173 KiB in roughly 13–15 ms. The subsequent Markdown/render task reached 642 ms.

## Durable normalized-session cache

`server/src/adapters/session-cache.ts` stores one normalized JSON record per provider source under:

```text
~/.agent-viewer/session-cache-v1/
```

The raw CLI session remains authoritative. A cached record is accepted only when all of these
match:

- provider
- absolute source path
- source modification time
- source size
- cache format version

On a miss, the provider adapter parses the native source and writes the normalized `ParsedSession`
atomically through a temporary file and rename. Polling uses the same cache boundary, so a changed
source is reparsed and replaces its old record.

The cache is deliberately JSON rather than a private binary encoding:

- it remains inspectable and recoverable;
- Zod validates and revives dates on reads;
- invalid/corrupt records degrade to cache misses;
- source identity invalidation remains straightforward.

The cache can contain conversation text, just like the authoritative provider files. Startup
enforces directory mode `0700` and record mode `0600`.

### Measured cache behavior

With 500 startup sources:

```text
first populated/reused run: 498/500 hits, 2.73 s
fully warm run:             500/500 hits, 1.09 s
first 20-item batch:        93 ms
benchmark RSS:              approximately 461 MiB
cache size:                 approximately 95 MiB
```

The earlier raw startup investigation had climbed to roughly 1.6 GiB RSS and remained busy parsing
for much longer. The cache avoids reconstructing provider-native entry trees and rerunning all
provider extraction logic for unchanged sources.

## Progressive loading

Startup remains newest-first by source mtime with bounded concurrent parsing. It now uses:

```text
CWV_STARTUP_INITIAL_BATCH_SIZE=20
CWV_STARTUP_BATCH_SIZE=100
```

The first accepted 20 conversations are broadcast immediately. Later updates return to 100-item
batches to avoid excessive React state churn. Both values remain configurable through environment
variables.

Parallel parsing means completion order inside a batch is approximate; the client continues to
sort the resulting conversations by activity.

## Virtualized chat initialization

`VirtualizedMessageList` now supplies an estimated bottom offset when the virtualizer is created.
Previously it began at offset zero, rendered the oldest message, and only then scrolled to the
newest message in a layout effect.

Measured on the same large thread:

```text
maximum long task before: 642 ms
maximum long task after:  187 ms
FCP after:                 approximately 228 ms
LCP after:                 approximately 712 ms
CLS after:                 approximately 0.002
```

The existing layout-effect scroll remains as the authoritative correction after real element
measurements replace estimates.

## Chat math rendering

The included client change adds:

- `remark-math`
- `rehype-katex`
- `katex`

Both `$...$` / `$$...$$` and common model-produced `\(...\)` / `\[...\]` delimiters render through
KaTeX. Delimiter normalization skips fenced code and inline code spans. Display equations receive
horizontal overflow handling and theme-aligned error styling.

## Verification

- Client TypeScript check passed.
- Server TypeScript check passed.
- Biome passed on changed implementation files.
- Full server suite: 151 passed, 0 failed, 1 skipped.
- Cache regression coverage proves:
  - unchanged sources reuse normalized sessions;
  - source size/mtime changes invalidate the cache;
  - cached dates revive as `Date` values;
  - the first batch is smaller than steady-state batches.
- Live Playwright profiling confirmed the virtualizer improvement.

## Deliberate boundary

This cache reduces restart parsing and peak memory, but the server still retains the loaded
conversation histories after hydration. True summary-only server startup with LRU history eviction
requires an explicit `ensureHistoryLoaded(conversationId)` boundary across message send/resume,
merge, swarm, recovery, and read APIs. That should be introduced as one coordinated architecture
change rather than allowing individual consumers to observe incomplete history.
