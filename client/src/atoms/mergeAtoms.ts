import type { MergeChildStatus } from '@unleashd/shared';
import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import { conversationAtomFamily } from './conversations';

// =============================================================================
// Merge mode — UI state for the "merge conversations" feature
// =============================================================================
//
// mergeModeAtom: true while the user is picking source conversations in the
// sidebar. Sidebar glows, main panel dims, row clicks are hijacked into
// selection toggles instead of navigation.
//
// mergeSelectionAtom: the set of conversation IDs currently picked. Cleared
// when merge mode exits or after a successful merge confirm.
//
// mergeChildStatusMapAtom: keyed by CHILD conversation id. Updated by the
// merge_child_status WS handler (actions.ts). Low frequency (one transition
// per child lifetime) — kept as a standalone Map to match the CLAUDE.md rule
// that dedicated Maps hold state that is mutated outside React.
// =============================================================================

export const mergeModeAtom = atom<boolean>(false);

export const mergeSelectionAtom = atom<Set<string>>(new Set<string>());

export const mergeChildStatusMapAtom = atom<Map<string, MergeChildStatus>>(
  new Map<string, MergeChildStatus>()
);

// Doc path reported by the server on complete. Hover tooltip fetches content.
export const mergeChildReviewDocPathMapAtom = atom<Map<string, string>>(
  new Map<string, string>()
);

// Per-child derived status. Default 'spinning' until the server reports.
export const mergeChildStatusAtomFamily = atomFamily((childId: string) =>
  atom((get): MergeChildStatus => get(mergeChildStatusMapAtom).get(childId) ?? 'spinning')
);

export const mergeChildReviewDocPathAtomFamily = atomFamily((childId: string) =>
  atom((get): string | null => get(mergeChildReviewDocPathMapAtom).get(childId) ?? null)
);

// True iff every child in the parent's mergeParentMeta.children has settled
// (complete or error). Drives the parent chat's send-button gate.
export const allMergeChildrenSettledAtomFamily = atomFamily((parentId: string) =>
  atom((get): boolean => {
    const parent = get(conversationAtomFamily(parentId));
    if (!parent || !parent.mergeParentMeta) return true;
    const statusMap = get(mergeChildStatusMapAtom);
    for (const child of parent.mergeParentMeta.children) {
      const s = statusMap.get(child.childConversationId);
      if (s !== 'complete' && s !== 'error') return false;
    }
    return true;
  })
);
