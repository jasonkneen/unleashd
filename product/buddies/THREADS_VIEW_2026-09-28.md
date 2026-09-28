# Threads view: every thread the owner is in, with what is new

Spec · 2026-09-28 · Buddies UI Engineer · status: **v1 implemented 2026-09-28** (branch
`threads-view`; §8 records what shipped and where it differs from this spec)

Builds on [Channel conversations](CHANNEL_CONVERSATIONS_2026-09-23.md) (one-level
threads, `root_id`, `threadStats`). Reference UI: Slack's "All Threads".

## 1. Problem

The owner starts threads and replies in many channels, and Buddies answer inside those
threads. Nothing collects them. Finding a new reply means opening each channel and
scanning for bold threads. There is also no per-thread read state:

- `post_read` is one cursor per (reader, channel). The inbox's channel `unread` counts
  **every** post after it, replies included, so a reply deep in one thread bolds the
  whole channel.
- The thread pane marks the **channel** read through the newest reply it shows
  (`ChannelBrowser.tsx` ThreadPane, `ChannelsMobile.tsx` ThreadScreen). A reply's
  `ord` can be newer than top-level posts the owner has not seen, so opening one thread
  silently marks those posts read.

## 2. What the owner sees

A **Threads** entry at the top of the channel rail (above Channels), bold with a count
when any followed thread has unread replies. It opens one pane:

```
Threads · 3 new replies
────────────────────────────────────────────────
# upstream · Release Manager, Product Dev and you
  You · 11:11      Should we merge the v34 schema before…
  View 13 previous replies
▌ Release Manager · 11:48   Merged in 4c1e…, tests green.      ← unread, tinted
▌ Product Dev · 11:52       One follow-up on the migration…    ← unread, tinted
  [ Reply… ]
────────────────────────────────────────────────
# buddy-ui · Buddies UI Engineer and you
  You · 09:02      Fix the DM wrap on mobile
  Buddies UI Engineer · 09:40   Done, screenshots in …         ← caught up, untinted
  [ Reply… ]
```

A card is always: **channel header → root post → a fold → the tail → the reply box.**

| Thread state | Fold | Tail |
|---|---|---|
| Unread replies | "View N previous replies" (the read ones) | the unread replies, tinted |
| Caught up | "View N previous replies" | the last 2 replies |
| ≤ 2 replies total | none | every reply |

- **Order: unread first, then latest activity** (Slack: "threads with unread replies
  appear at the top"). Latest activity alone is not the same: an old unread reply can sit
  below a newer read one.
- **Stable while reading.** The order is snapshotted when the pane opens. A new reply in a
  visible card appends to that card, tinted. A new or re-sorted thread shows a
  "N threads updated" pill at the top that re-sorts on click. Cards never jump under the
  reader, and marking read keeps the scroll position.
- Buddy replies are long, so each post in a card clamps to 4 lines with "Show more".
- **"View N previous replies" expands in place** inside the card (pages the thread
  oldest-first). The channel header opens the full thread in its channel
  (`?channel=<id>&thread=<root>`), a real navigation, so Back returns here.
- **"Replying…"**: when a Buddy is working on an answer in the thread, the card shows
  "<Buddy> is replying…" under the tail, from the channel's existing `/responding` data.
  This is the signal the owner most wants from a Buddy thread.
- **Failed replies** (`purpose: reply_failed`) render in the tail with the existing retry
  control, exactly as in the thread pane.
- The reply box is the thread composer the thread pane already uses, so @mention seats
  and follow-up gates behave exactly as they do in the pane. It adds an
  **"Also send to #channel"** checkbox (§3), and in the thread pane too. A card's draft
  survives refetches, keyed by root id.
- Viewing a card while the tab is visible marks that thread read through its newest
  rendered reply, the same way `useMarkChannelRead` works. The tint stays until the pane
  unmounts, like the "New messages" line.
- **Rail entry:** bold when any followed thread has unread replies. There is no count
  (Slack keeps count badges for mentions, and we have no owner mentions yet). The header
  says "N new replies".
- **Empty state:** "Threads you start or reply in show up here." Loading uses the same
  skeleton as the channel feed. A thread whose channel is archived stays listed, with an
  "archived" mark on the header.
- Mobile: a "Threads" row at the top of `ChannelsHome` opens a `ThreadsScreen` with the
  same cards, one column.

v1.1, on a per-card "⋯" menu: **Unfollow**, **Mark unread** (from a reply: moves the
cursor back to just before it), **Copy link**, **Open in channel**.

## 3. Model

**Following a thread is having a `thread_read` row.** One table is both the follow set
and the per-thread cursor (docs/patterns.md#one-store-one-index).

```sql
CREATE TABLE IF NOT EXISTS thread_read (
  reader TEXT NOT NULL,                        -- 'owner' or a buddy id (actor.key())
  root_id TEXT NOT NULL REFERENCES post(id),
  last_ord TEXT NOT NULL,                      -- read through this ordered id
  updated_at TEXT NOT NULL,
  PRIMARY KEY(reader, root_id)) STRICT, WITHOUT ROWID;
```

Created by `open` when missing (same pattern as `ensure_post_search`). Writes:

| Event | Effect |
|---|---|
| Actor posts a top-level post | insert `(actor, post, post.ord)` (you follow what you start) |
| Actor replies in a thread | upsert `(actor, root, reply.ord)`: follow, and read through your own reply |
| `mark_thread_read(actor, root, post)` | forward-only update of an **existing** row; never creates one (opening a thread you are not in does not follow it, as in Slack) |
| `mark_thread_unread(actor, root, post)` (v1.1) | sets `last_ord` to the ord just before `post`: the one deliberate backward move |
| `unfollow` / `follow` (v1.1) | delete / insert the row |
| Table created on an existing DB | one-time backfill: a row for every root the owner wrote or replied in, `last_ord` = that thread's newest `ord`. Existing threads arrive caught up rather than all-unread. |

**Channel unread counts top-level posts only** (`AND p.root_id IS NULL` in `inbox`).
Replies are counted by Threads (for followed threads) and by the bold thread row in the
channel (for the rest, via `threadStats` against the channel cursor, unchanged). The
thread pane stops calling the channel mark-read. A followed thread's pane calls
`mark_thread_read` instead. This fixes both defects in §1.

**Also send to #channel.** Because replies stop counting as channel unread, a decision
made in a thread is otherwise invisible to someone reading the channel. The fix is a flag
on the reply, not a second post: `post.broadcast INTEGER NOT NULL DEFAULT 0` (added on
open when missing). The channel feed's top-level filter becomes
`(p.root_id IS NULL OR p.broadcast = 1)` and so does the unread count. The feed renders a
broadcast reply with "replied to a thread: <root excerpt>" linking to the thread. Owner
posts only, set from the composer checkbox. The Buddy `post` tool gains no parameter
(Buddies coordinate with `send`, and letting them broadcast would bring back channel noise).

### Crate API (`posts.rs`)

```rust
pub fn followed_threads(&self, actor: &Actor, workspace_id: &str,
                        before: Option<Cursor>, limit: i64) -> Result<ThreadCardPage>;
pub fn mark_thread_read(&mut self, actor: &Actor, root_id: &str, post_id: &str) -> Result<()>;
```

```rust
pub struct ThreadCard {
    pub channel: Channel,
    pub root: Post,
    pub replies: i64,
    pub participants: Vec<Actor>,        // distinct authors, root first
    pub activity_ord: String,            // newest ord in the thread
    pub tail: ThreadTail,                // Unread sorts before CaughtUp; the cursor is (unread, activity_ord)
}
/// The fold/tail rule of §2 as data, so neither client decides it.
pub enum ThreadTail {
    Unread { hidden_read: i64, posts: Vec<Post> },    // posts capped at 20; more → "open thread"
    CaughtUp { hidden: i64, posts: Vec<Post> },       // the last 2
}
pub struct ThreadCardPage { pub cards: Vec<ThreadCard>, pub unread_threads: i64, pub next: Option<Cursor> }
```

`Inbox` gains `unread_threads: i64` (followed threads with a reply by someone else after
the cursor) so the rail badge needs no second poll. Readability: the same channel rule as
`search_posts` (the owner reads everything; a Buddy only its direct channels).

### Server (`routes.ts`)

- `GET /api/buddies/workspaces/:workspaceId/threads?before=` → `followedThreads(OWNER, …, 30)`
- `POST /api/buddies/threads/:rootId/read {postId}` → `markThreadRead`, then
  `channelChanged(root.channelId)` so other devices clear.

- `POST /api/buddies/channels/:channelId/posts` accepts `broadcast: boolean` (`.default(false)`)
  for a reply.
- The card's "Replying…" line reads the existing `GET /api/buddies/channels/:channelId/responding`
  for the channels on screen, filtered to the card's root.

No new push message. The pane refetches on the existing `channel_changed` for any channel
in the workspace, the same trigger the inbox uses. The client merges the refetch into the
snapshotted order (§2), never replacing it.

### Client

- `channel-data.ts`: `useFollowedThreads(workspaceId)` via `usePolledFetch` keyed by the
  URL; `useMarkThreadRead(rootId, tail, newestId)`; `unreadThreads` on the inbox type
  (`.default(0)` on the parsed shape so a not-yet-reloaded backend does not break the rail).
- Desktop: the main pane's selection is search params (`channel` / `dm` / `workers`);
  add `view=threads`. Fold the ladder in `ChannelBrowser` into one `MainView` sum
  (`Threads | Workers | Dm | Channel | Empty`) with a thin dispatcher while touching it.
- New `components/buddies/ThreadsPane.tsx` renders cards with the existing `LeadRow` /
  `ContinuationRow` / thread composer (exported from `ChannelBrowser.tsx` or moved to
  a shared module). The tint is one class. The clamp reuses the chat's collapse if one fits.
- Mobile: `ThreadsScreen` in `ChannelsMobile.tsx`, the same hook and card data.

## 4. Tests (behaviour, not mirrors)

1. **Crate, end to end:** owner starts a thread; a Buddy replies → `unread_threads = 1`,
   tail `Unread` with that reply; owner reads → `CaughtUp`; an older `mark_thread_read`
   does not move the cursor back; the owner opening a thread they never posted in
   creates no row.
2. **Crate, regression for §1:** a reply in a thread does not raise the channel's
   `unread`; marking a thread read does not move the channel cursor past an unseen
   top-level post.
3. **Crate, backfill:** a DB with an owner-replied thread, opened without the table,
   lists that thread `CaughtUp`, not all-unread.
4. **Crate, ordering:** an older unread thread sorts above a newer caught-up one, and
   paging across the unread/caught-up boundary returns every card exactly once.
5. **Crate, broadcast:** a broadcast reply appears in the channel feed and its unread
   count. A plain reply appears in neither.
6. **Client render (`client/test/threads-pane.test.tsx`):** a fixture with one `Unread`
   and one `CaughtUp` card renders "View N previous replies", the tint on the unread
   posts only, and a thread link that is a `<Link>`.
7. **Client, stable order:** merging a refetch in which a lower card got a new reply
   leaves the rendered order unchanged and raises the "threads updated" pill.
8. **Screenshots:** add a `threads` screen to `buildScreens()`; skip when the owner
   follows no thread.

## 5. Out of scope (v1)

The v1.1 card menu (§2). An `@owner` mention that follows a Buddy-only thread: Slack
follows threads you are mentioned in, but we have no owner mention yet, so v1's follow rule
is a subset of Slack's. Also out: a cross-workspace Threads view, Buddy-side use of
`followed_threads` via MCP, keyboard navigation, and notifications.

## 6. Decisions for the owner

1. **Channel unread = top-level + broadcast replies only** (Slack's rule; recommended).
   Without this, a reply is counted twice (channel and Threads) and reading it in Threads
   leaves the channel bold.
2. **Follow = you started it or replied in it.** Buddy-only threads never appear, even
   busy ones (recommended; otherwise this becomes a second channel feed).

Settled by checking Slack: unread-first ordering; unfollow and mark-unread in v1.1.

## 7. Plan

| Step | Scope | Size |
|---|---|---|
| 1 | Crate: table + backfill, follow on post, `followed_threads` (unread-first), `mark_thread_read`, inbox `unread_threads`, `post.broadcast`, channel unread = top-level + broadcast; tests 1–5 | ~250 lines |
| 2 | Server routes, `broadcast` on owner replies; thread pane switches to `mark_thread_read` | ~50 lines |
| 3 | Desktop rail entry + `ThreadsPane` + `MainView` dispatcher: in-place expand, stable order + pill, Replying…, failed-reply retry, "Also send" checkbox, drafts, empty state; tests 6–7; screenshot | ~350 lines |
| 4 | Mobile `ThreadsScreen` | ~120 lines |
| 5 (v1.1) | Card menu: unfollow, mark unread, copy link, open in channel | ~100 lines |

Step 1 changes the crate. Restart the backend after `pnpm addons` (AGENTS.md).

## 8. As built (2026-09-28)

The owner said "go ahead" on the recommended answers to §6: channel unread counts top-level
posts and broadcast replies only, and following means you started or replied in the thread.

**Where it lives**

| Layer | Code |
|---|---|
| Crate | `posts.rs`: `follow` (on every post and answer), `followed_threads`, `mark_thread_read`, `IN_CHANNEL_FEED`; `schema.rs`: `ensure_threads` (table, backfill, `post.broadcast`), index `thread_read_root` |
| Server | `routes.ts`: `GET /workspaces/:id/threads?limit=`, `POST /threads/:rootId/read`, `broadcast` on owner posts. Buddy posts always pass `broadcast: false` |
| Client, shared | `threads-view.ts` (`holdThreads`, `useThreadsView`), `channels-view.ts` (one URL grammar for both shells, `?view=threads`), `channel-data.ts` (`useMarkRead`, `useThreadView`, `anyUnread`) |
| Desktop | `ThreadsPane.tsx`, rows moved into `ChannelRows.tsx` (a `card` row place carries the tint) |
| Mobile | `ThreadsMobile.tsx`, rows and screen header moved into `ChannelRowsMobile.tsx` |
| Styles | `ThreadsPane.css`, one sheet for both shells. Net client CSS is zero: 31 lines of dead `mobile-ui-card--button` / `mobile-ui-path` were deleted |

**Refactors made on the way** (each removes a copy rather than adding a layer):
- The crate's `keyset_page` and `readable_by` replace three copies of the paging and "may read this channel" SQL. `ensure_column` replaces the one-off archive upgrade.
- `useThreadView` replaces the thread wiring that the desktop pane and the mobile screen each carried.
- `useMarkRead(ReadTarget)` replaces `useMarkChannelRead`. The thread pane marks the THREAD, so opening a thread no longer marks unseen top-level posts read (§1).
- `channelsView` replaces desktop's if-ladder over the same params that mobile already parsed into a sum type. Desktop's main pane is now a thin `mainPane` dispatcher.
- `anyUnread` is the one "something is new" test for the tab title, the mobile tab dot, the sidebar and Workspace Home, so thread replies count everywhere at once.

**Differences from §2–§3**
- Mobile's "View N previous replies" opens the thread screen instead of expanding in place: a phone card is too narrow to page inside. Desktop expands in place (the newest page; a longer thread links out).
- The server returns at most `limit` cards with `more`, not a keyset cursor. "Show more threads" raises the limit. Followed threads number in the hundreds, not the thousands.
- There is no 4-line clamp on long replies yet. Follow-up if Buddy reports make cards unwieldy.
- "Also send to channel" shows as a checkbox under thread and card composers. In the channel feed, a broadcast reply is marked "replied to a thread" (desktop), and mobile's Thread link opens its root.
- A card composer carries no seat baseline, so its @mention chips show the profile default. The server still keeps each seat's harness for un-picked mentions.

**Tests**: crate `followed_threads_track_replies_apart_from_the_channel` and
`a_database_from_before_threads_arrives_caught_up`; the query-plan guard covers the new
statements (it caught the missing `thread_read_root` index); client `threads-view.test.tsx`
(stable order, sticky tint, own reply is not an update, pane render).
