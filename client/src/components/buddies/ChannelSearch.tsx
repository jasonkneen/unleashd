import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { resource, usePolledFetch } from '../../hooks/usePolledFetch';
import { buddyApi } from './api';
import { authorName } from './channel-data';
import { channelLinkPath, postLink } from './channel-link';
import type { Post } from './types';
import '../../views/search/SearchView.css';

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 50;

function searchResource(workspaceId: string, query: string) {
  const params = new URLSearchParams({ q: query, limit: String(RESULT_LIMIT) });
  const url = `/api/buddies/workspaces/${encodeURIComponent(workspaceId)}/search?${params}`;
  return resource<readonly Post[]>(url, (signal) => buddyApi<Post[]>(url, { signal }));
}

function excerpt(body: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}…` : compact;
}

// The header trigger. It holds no state: the palette is mounted once per
// channel view (below) so ⌘F works in every pane, DMs included.
export function ChannelSearchButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="channel-search-trigger ui-row ui-muted"
      aria-label="Search all channel messages"
      title="Search all messages (⌘F)"
      onClick={onOpen}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>Search</span>
    </button>
  );
}

export function ChannelSearch({
  workspaceId,
  channelNames,
  buddyNames,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  channelNames: ReadonlyMap<string, string>;
  buddyNames: Readonly<Record<string, string>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const results = usePolledFetch(
    trimmed.length >= MIN_QUERY_LENGTH ? searchResource(workspaceId, trimmed) : null,
    0
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        onOpenChange(true);
      }
      if (open && event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    onOpenChange(false);
    setQuery('');
  };

  return (
    <>
      {open && (
        <div className="search-view-backdrop" onClick={close}>
          <div
            className="search-view search-view--palette ui-stack"
            style={{ alignSelf: 'center', maxHeight: '80vh' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="search-view__input-row ui-row">
              <span aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                className="search-view__input"
                aria-label="Search all channel messages"
                placeholder="Search all messages…"
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" className="search-view__esc ui-card ui-muted" onClick={close}>
                Esc
              </button>
            </div>
            {trimmed.length === 0 ? (
              <p className="search-view__status">Search every channel in this workspace.</p>
            ) : trimmed.length < MIN_QUERY_LENGTH ? (
              <p className="search-view__status">Type at least {MIN_QUERY_LENGTH} characters.</p>
            ) : results.kind === 'loading' || results.kind === 'idle' ? (
              <p className="search-view__status">Searching…</p>
            ) : results.kind === 'failed' ? (
              <p className="search-view__status" role="alert">
                Search failed: {results.error.message}
              </p>
            ) : results.kind === 'stale' && results.data.length === 0 ? (
              <p className="search-view__status" role="alert">
                Search could not refresh: {results.error.message}
              </p>
            ) : results.data.length === 0 ? (
              <p className="search-view__status">No messages found.</p>
            ) : (
              <ul
                className="search-view__results"
                style={{ margin: 0, padding: 'var(--sp-2)', overflowY: 'auto', listStyle: 'none' }}
              >
                {results.data.map((post) => (
                  <li key={post.id}>
                    <Link
                      to={channelLinkPath(workspaceId, postLink(post))}
                      onClick={close}
                      className="search-view__item"
                    >
                      <span className="search-view__head">
                        <span className="search-view__kind search-view__kind--chat">
                          {channelNames.get(post.channelId) ?? '#channel'}
                        </span>
                        <span className="search-view__title ui-truncate">
                          {authorName(post.author, buddyNames)}
                        </span>
                      </span>
                      <span className="search-view__snippet">{excerpt(post.body)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
