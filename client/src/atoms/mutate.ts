// §5 #8 — hand-rolled jotai-immer (no jotai-immer dep).
// Fuses jotai + immer without bifurcating the atom vocabulary.
// Partial collection updates go through mutate(); scalar/full-replace stays plain jotaiStore.set.
import { enableMapSet, produce } from 'immer';
import type { WritableAtom } from 'jotai';
import { jotaiStore } from './store';

enableMapSet();

export const mutate = <T>(atom: WritableAtom<T, [T], void>, recipe: (draft: T) => void): void =>
  jotaiStore.set(atom, produce(jotaiStore.get(atom), recipe));
