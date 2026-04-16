import type { MergeChildStatus } from '@unleashd/shared';
import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import { conversationAtomFamily } from './conversations';

// =============================================================================
// Merge atoms — sidebar selection mode + per-child review status
// =============================================================================
//
// mergeModeAtom: true while user is picking source conversations in sidebar.
// mergeSelectionAtom: set of conversation IDs currently picked.
// Both are atoms (not local state) so App.tsx can read them to position the
// merge modal over the main-content area while the sidebar stays interactive.
// =============================================================================

export const mergeModeAtom = atom<boolean>(false);
export const mergeSelectionAtom = atom<Set<string>>(new Set<string>());

export const mergeChildStatusMapAtom = atom<Map<string, MergeChildStatus>>(
  new Map<string, MergeChildStatus>()
);

// Doc path reported by the server on complete. Hover tooltip fetches content.
export const mergeChildReviewDocPathMapAtom = atom<Map<string, string>>(new Map<string, string>());

// Error message reported by the server on failure. Shown in error chip tooltip.
export const mergeChildErrorMapAtom = atom<Map<string, string>>(new Map<string, string>());

// Per-child derived status. Default 'spinning' until the server reports.
export const mergeChildStatusAtomFamily = atomFamily((childId: string) =>
  atom((get): MergeChildStatus => get(mergeChildStatusMapAtom).get(childId) ?? 'spinning')
);

export const mergeChildReviewDocPathAtomFamily = atomFamily((childId: string) =>
  atom((get): string | null => get(mergeChildReviewDocPathMapAtom).get(childId) ?? null)
);

export const mergeChildErrorAtomFamily = atomFamily((childId: string) =>
  atom((get): string | null => get(mergeChildErrorMapAtom).get(childId) ?? null)
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
