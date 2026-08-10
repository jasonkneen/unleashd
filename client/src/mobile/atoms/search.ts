import { atom } from 'jotai';
import { allConversationsAtom } from '../../atoms/conversations';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

// =============================================================================
// Mobile search state — sum type, never string sentinel (T2)
// =============================================================================

export type MobileSearchState = { kind: 'idle' } | { kind: 'searching'; query: string };

export const mobileSearchStateAtom = atom<MobileSearchState>({ kind: 'idle' });

// PascalCase alias per spec naming
export const MobileSearchStateAtom = mobileSearchStateAtom;

// Derived: filtered conversation list. If idle → full sorted list, else
// filter via fuzzyMatch over workingDirectory + last-message preview/id.
// Conversation has no title field.
export const mobileSearchResultsAtom = atom((get) => {
  const state = get(mobileSearchStateAtom);
  const all = get(allConversationsAtom);
  if (state.kind === 'idle') return all;

  const query = state.query;
  if (query.length === 0) return all;

  return all.filter((conv) => {
    // Try workingDirectory
    if (fuzzyMatch(query, conv.workingDirectory) !== null) return true;
    // Try conversation id
    if (fuzzyMatch(query, conv.id) !== null) return true;
    // Try last-message preview (full content truncated to 500 chars for perf)
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (lastMsg) {
      const preview = lastMsg.content.substring(0, 500);
      if (fuzzyMatch(query, preview) !== null) return true;
    }
    return false;
  });
});
