import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OpenDm } from './ChannelAuthor';
import { ChannelComposer } from './ChannelComposer';
import { ChannelLoader } from './ChannelLoader';
import { LeadRow, Replying, type RowContext, renderRow } from './ChannelRows';
import {
  type WorkspaceDirectory,
  channelHeading,
  channelRows,
  joinNames,
  threadFeed,
  useChannelFeed,
  useChannelResponding,
  useMarkRead,
  useWithOutbox,
} from './channel-data';
import { channelLinkPath } from './channel-link';
import { type ThreadCard, participantNames, useThreadsView } from './threads-view';
import './ThreadsPane.css';

type CardBase = Omit<RowContext, 'place'>;

// Slack's Threads view (product/buddies/THREADS_VIEW_2026-09-28.md): every thread the owner
// started or replied in, unread first, each card its root, a fold, the new replies and a reply box.
// Mount keyed by workspace: the held order is per visit.
export function ThreadsPane({
  workspaceId,
  directory,
  availableConversationIds,
  openDm,
}: {
  workspaceId: string;
  directory: WorkspaceDirectory;
  availableConversationIds: ReadonlySet<string>;
  openDm: OpenDm;
}) {
  const threads = useThreadsView(workspaceId);
  const { view, followed } = threads;
  const base: CardBase = {
    workspaceId,
    directory,
    availableConversationIds,
    openDm,
    linkedPostId: null,
  };
  const refetch = () => void followed.refetch();
  return (
    <section className="channel-browser-pane ui-stack" aria-label="Threads">
      <header className="channel-browser-pane-header ui-row" data-channel-header>
        <div className="channel-browser-pane-title">
          <h2>Threads</h2>
          {view !== null && view.newReplies > 0 && (
            <p className="ui-muted">
              {view.newReplies} new {view.newReplies === 1 ? 'reply' : 'replies'}
            </p>
          )}
        </div>
      </header>
      {view !== null && view.updated > 0 && (
        <button
          type="button"
          className="threads-pill ui-control ui-badge--accent"
          onClick={threads.resort}
        >
          {view.updated} {view.updated === 1 ? 'thread' : 'threads'} updated · Show
        </button>
      )}
      <div className="channel-browser-scroll ui-stack">
        {(followed.kind === 'failed' || followed.kind === 'stale') && (
          <p className="channel-browser-error" role="alert">
            Threads could not refresh: {followed.error.message}
          </p>
        )}
        {view === null ? (
          <ChannelLoader label="Loading threads…" />
        ) : view.cards.length === 0 ? (
          <div className="channel-browser-empty ui-muted ui-row">
            <span>Threads you start or reply in show up here.</span>
          </div>
        ) : (
          <ol className="threads-list ui-stack">
            {view.cards.map((card) => (
              <ThreadCardView
                key={card.thread.root.id}
                card={card}
                base={base}
                onPosted={refetch}
              />
            ))}
          </ol>
        )}
        {threads.more && (
          <button type="button" className="threads-pill ui-control" onClick={threads.showMore}>
            Show more threads
          </button>
        )}
      </div>
    </section>
  );
}

function ThreadCardView({
  card,
  base,
  onPosted,
}: {
  card: ThreadCard;
  base: CardBase;
  onPosted(): void;
}) {
  const { thread } = card;
  const channelId = thread.channel.id;
  const rootId = thread.root.id;
  const { buddyNames } = base.directory;
  const [expanded, setExpanded] = useState(false);
  const heading = channelHeading(thread.channel.kind, buddyNames);
  const threadPath = channelLinkPath(base.workspaceId, { kind: 'thread', channelId, rootId });
  const replying = useChannelResponding(channelId, buddyNames).get(rootId);
  useMarkRead(
    { kind: 'thread', rootId },
    thread.tail.kind === 'unread',
    card.posts.at(-1)?.id ?? rootId
  );
  const context: RowContext = { ...base, place: { kind: 'card', unread: card.unread } };
  // channelRows reads newest-first, like every feed.
  const rows = useMemo(() => channelRows([...card.posts].reverse()), [card.posts]);
  return (
    <li className="threads-card ui-card ui-surface ui-stack">
      <header className="threads-header ui-row">
        <Link className="threads-head" to={threadPath} title="Open thread">
          {heading.mark}
          {heading.name}
        </Link>
        {thread.channel.archivedAt && <span className="ui-muted">archived</span>}
        <span className="ui-muted ui-truncate">
          {joinNames(participantNames(thread, buddyNames))}
        </span>
        <Link className="threads-fold threads-open" to={threadPath}>
          Open thread ›
        </Link>
      </header>
      <ol className="channel-browser-messages">
        <LeadRow post={thread.root} context={context} />
      </ol>
      {expanded ? (
        <ExpandedReplies channelId={channelId} rootId={rootId} context={context} />
      ) : (
        <>
          {card.hidden > 0 && (
            <button type="button" className="threads-fold" onClick={() => setExpanded(true)}>
              View {card.hidden} previous {card.hidden === 1 ? 'reply' : 'replies'}
            </button>
          )}
          <ol className="channel-browser-messages">{rows.map((row) => renderRow(row, context))}</ol>
        </>
      )}
      {replying !== undefined && <Replying text={replying} />}
      {!thread.channel.archivedAt && (
        <ChannelComposer
          channelId={channelId}
          rootId={rootId}
          placeholder="Reply…"
          references={base.directory.references}
          submit="enter"
          onPosted={onPosted}
        />
      )}
    </li>
  );
}

// "View N previous replies" opens the thread inside the card: its newest page, oldest first.
// A longer thread links out to the full pane rather than paging inside a card.
function ExpandedReplies({
  channelId,
  rootId,
  context,
}: {
  channelId: string;
  rootId: string;
  context: RowContext;
}) {
  const thread = useChannelFeed(threadFeed(rootId, null));
  const replies = useWithOutbox(channelId, rootId, thread.posts);
  const rows = useMemo(() => channelRows(replies ?? []), [replies]);
  return (
    <>
      {thread.edge.kind === 'more' && (
        <Link
          className="threads-fold"
          to={channelLinkPath(context.workspaceId, { kind: 'thread', channelId, rootId })}
        >
          Earlier replies are in the thread
        </Link>
      )}
      {replies === null && <ChannelLoader label="Loading replies…" />}
      <ol className="channel-browser-messages">{rows.map((row) => renderRow(row, context))}</ol>
    </>
  );
}
