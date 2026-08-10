import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import {
  allConversationsAtom,
  conversationCountAtom,
  workerIdsAtom,
  workersByProjectAtom,
} from '../../atoms/conversations';

/**
 * MainScreen — mobile hub at "/" (§3 ROUTES: desktop Gallery ↔ mobile MainScreen).
 * Full-screen menu of cards for Chats / Swarms / Buddies / Search.
 * Not a duplicate of ConversationList — that's the filtered inbox at "/done"
 * (see ROUTES table). This is the entry hub that fans out to each leaf.
 *
 * Counts reuse derived atoms only — never useAtomValue(conversationsAtom) (§7 #2).
 * workersByProjectAtom / workerIdsAtom are the canonical swarm views
 * (conversations.ts:160-189); conversationCountAtom / allConversationsAtom
 * are the canonical chat views. No per-conversation atomFamily needed here
 * because we only show aggregates, not per-row subscriptions.
 */

type HubCard = {
  label: string;
  description: string;
  to: string;
  icon: string;
  countLabel: string;
};

export function MainScreen() {
  const navigate = useNavigate();

  // Derived aggregates — cheap, stable, no structural sharing break.
  const totalCount = useAtomValue(conversationCountAtom);
  const all = useAtomValue(allConversationsAtom);
  const workerIds = useAtomValue(workerIdsAtom);
  const workersByProject = useAtomValue(workersByProjectAtom);

  const nonWorkerCount = all.filter((c) => !c.isWorker).length;
  const swarmCount = workersByProject.size;
  const workerCount = workerIds.length;

  const cards: HubCard[] = [
    {
      label: 'Chats',
      description: 'Recent conversations',
      to: '/',
      // Self-link: hub lives at "/"; Chats card re-anchors or could push to
      // a filtered view — keep "/" for now so the hub is reachable via the tab.
      // Swiping the card navigates to the hub itself (idempotent); a future
      // "/chats" alias can retarget this without changing the tab.
      icon: '◈',
      countLabel: totalCount === 0 ? 'No chats yet' : `${nonWorkerCount} chats · ${totalCount} total`,
    },
    {
      label: 'Swarms',
      description: 'Worker groups by project',
      to: '/workers',
      icon: '⬡',
      countLabel:
        workerCount === 0
          ? 'No workers'
          : `${workerCount} workers · ${swarmCount} project${swarmCount === 1 ? '' : 's'}`,
    },
    {
      label: 'Buddies',
      description: 'Directory & per-buddy detail',
      to: '/buddies',
      icon: '◎',
      countLabel: 'Browse buddies',
    },
    {
      label: 'Search',
      description: 'Find by directory or preview',
      to: '/search',
      icon: '⌕',
      countLabel: 'Search conversations',
    },
  ];

  return (
    <div className="mobile-hub">
      <header className="mobile-hub__header">
        <h1 className="mobile-hub__title">Unleashd</h1>
        <p className="mobile-hub__subtitle">Chats · Swarms · Buddies · Search</p>
      </header>

      <div className="mobile-hub__grid" role="list">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            role="listitem"
            className="mobile-hub__card"
            onClick={() => navigate(card.to)}
            aria-label={`${card.label}: ${card.countLabel}`}
          >
            <span className="mobile-hub__card-icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="mobile-hub__card-body">
              <span className="mobile-hub__card-label">{card.label}</span>
              <span className="mobile-hub__card-desc">{card.description}</span>
              <span className="mobile-hub__card-count">{card.countLabel}</span>
            </span>
            <span className="mobile-hub__card-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
