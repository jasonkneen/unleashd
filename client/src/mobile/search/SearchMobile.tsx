import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversationAtomFamily } from '../../atoms/conversations';
import { formatTimeAgo, getConversationLastActivity } from '../../utils/time';
import { mobileSearchResultsAtom, mobileSearchStateAtom } from '../atoms/search';
import type { MobileSearchState } from '../atoms/search';

// Server deep-search hit shape (GET /api/search?q=)
interface ServerHit {
  conversationId: string;
  messageIndex: number;
  role: string;
  snippet: string;
  workingDirectory: string;
  timestamp: string;
}

interface GroupedHit {
  conversationId: string;
  workingDirectory: string;
  hits: ServerHit[];
  latestTs: number;
}

// Pure dispatcher on MobileSearchState.kind — selects source (PLANNING §4, §10 Phase 2)
function selectSearchSource(
  state: MobileSearchState,
  clientCount: number,
  serverCount: number,
): string {
  if (state.kind === 'idle') return `All conversations (${clientCount})`;
  return `Client ${clientCount} · Deep ${serverCount}`;
}

function ClientResultRow({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const conv = useAtomValue(conversationAtomFamily(id));
  if (!conv) return null;
  const lastMsg = conv.messages[conv.messages.length - 1];
  const preview = lastMsg ? lastMsg.content.substring(0, 120) : '— no messages —';
  const roleBadge = lastMsg ? lastMsg.role : '—';
  const timeAgo = formatTimeAgo(getConversationLastActivity(conv));
  const shortDir = conv.workingDirectory.replace(/^\/Users\/[^/]+/, '~') || conv.id.slice(0, 8);
  return (
    <button type="button" className="mobile-search-row" onClick={() => onOpen(conv.id)}>
      <div className="mobile-search-row__top">
        <span className="mobile-search-row__dir" title={conv.workingDirectory}>
          {shortDir}
        </span>
        <span className={`mobile-search-row__role role-${roleBadge}`}>{roleBadge}</span>
        <span className="mobile-search-row__time">{timeAgo}</span>
      </div>
      <div className="mobile-search-row__snippet">{preview}</div>
    </button>
  );
}

function ServerGroupCard({
  group,
  onOpen,
}: {
  group: GroupedHit;
  onOpen: (id: string) => void;
}) {
  const timeAgo = formatTimeAgo(new Date(group.latestTs));
  const shortDir = group.workingDirectory.replace(/^\/Users\/[^/]+/, '~') || group.conversationId.slice(0, 8);
  return (
    <div className="mobile-search-group">
      <button type="button" className="mobile-search-group__header" onClick={() => onOpen(group.conversationId)}>
        <span className="mobile-search-group__dir" title={group.workingDirectory}>
          {shortDir}
        </span>
        <span className="mobile-search-group__count">{group.hits.length} hit{group.hits.length !== 1 ? 's' : ''}</span>
        <span className="mobile-search-group__time">{timeAgo}</span>
      </button>
      <div className="mobile-search-group__hits">
        {group.hits.slice(0, 3).map((h, idx) => (
          <button key={idx} type="button" className="mobile-search-hit" onClick={() => onOpen(h.conversationId)}>
            <span className={`mobile-search-hit__role role-${h.role}`}>{h.role}</span>
            <span className="mobile-search-hit__snippet">{h.snippet}</span>
          </button>
        ))}
        {group.hits.length > 3 && (
          <span className="mobile-search-hit__more">+{group.hits.length - 3} more</span>
        )}
      </div>
    </div>
  );
}

export function SearchMobile() {
  const [searchState, setSearchState] = useAtom(mobileSearchStateAtom);
  const clientResults = useAtomValue(mobileSearchResultsAtom);
  const navigate = useNavigate();

  const query = searchState.kind === 'searching' ? searchState.query : '';

  // Deep history via GET /api/search?q= (PLANNING §4 hybrid). Debounced 300ms.
  const [serverHits, setServerHits] = useState<ServerHit[]>([]);
  const [serverLoading, setServerLoading] = useState(false);

  useEffect(() => {
    if (searchState.kind !== 'searching' || query.trim().length < 2) {
      setServerHits([]);
      setServerLoading(false);
      return;
    }
    const q = query.trim();
    const timer = window.setTimeout(() => {
      setServerLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data: { results: ServerHit[] }) => {
          setServerHits(data.results ?? []);
          setServerLoading(false);
        })
        .catch(() => setServerLoading(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, searchState.kind]);

  const groupedServerHits = useMemo((): GroupedHit[] => {
    const map = new Map<string, GroupedHit>();
    for (const h of serverHits) {
      const ts = new Date(h.timestamp).getTime();
      const existing = map.get(h.conversationId);
      if (!existing) {
        map.set(h.conversationId, {
          conversationId: h.conversationId,
          workingDirectory: h.workingDirectory,
          hits: [h],
          latestTs: ts,
        });
      } else {
        existing.hits.push(h);
        if (ts > existing.latestTs) existing.latestTs = ts;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.latestTs - a.latestTs);
  }, [serverHits]);

  const handleOpen = (id: string) => navigate(`/chat/${id}`);

  const onInputChange = (value: string) => {
    if (value.trim().length === 0) {
      setSearchState({ kind: 'idle' });
    } else {
      setSearchState({ kind: 'searching', query: value });
    }
  };

  const sourceLabel = selectSearchSource(searchState, clientResults.length, groupedServerHits.length);

  return (
    <div className="mobile-search">
      <div className="mobile-search__header">
        <input
          type="search"
          className="mobile-search__input"
          placeholder="Search conversations…"
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          autoFocus
          aria-label="Search conversations"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="mobile-search__clear" onClick={() => onInputChange('')} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <div className="mobile-search__meta">{sourceLabel}</div>

      {/* Client-filtered results (fuzzyMatch over workingDirectory + preview) */}
      <div className="mobile-search__section">
        <div className="mobile-search__section-title">This device ({clientResults.length})</div>
        {clientResults.length === 0 ? (
          <div className="mobile-search__empty">No matches on this device.</div>
        ) : (
          <div className="mobile-search__list">
            {clientResults.slice(0, 50).map((conv) => (
              <ClientResultRow key={conv.id} id={conv.id} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </div>

      {/* Deep history via /api/search?q= — dispatcher on MobileSearchState.kind */}
      {searchState.kind === 'searching' && query.trim().length >= 2 && (
        <div className="mobile-search__section">
          <div className="mobile-search__section-title">
            Deep history {serverLoading ? '· searching…' : `· ${groupedServerHits.length} conversations`}
          </div>
          {serverLoading && serverHits.length === 0 ? (
            <div className="mobile-search__empty">Searching history…</div>
          ) : groupedServerHits.length === 0 ? (
            <div className="mobile-search__empty">No deep-history matches.</div>
          ) : (
            <div className="mobile-search__list">
              {groupedServerHits.slice(0, 20).map((g) => (
                <ServerGroupCard key={g.conversationId} group={g} onOpen={handleOpen} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
