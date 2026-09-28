import { useAtomValue } from 'jotai';
import { transcriptFamily } from '../atoms/conversations';
import type { TurnAttemptSnapshotLike } from '../utils/turn-diagnostics';

export interface ConversationTurnDiagnostics {
  attempt: TurnAttemptSnapshotLike | null;
  error: string | null;
  isLoading: boolean;
}

/** Current attempt arrives with conversation detail and subsequent WS patches. */
export function useTurnDiagnostics(
  conversationId: string | undefined
): ConversationTurnDiagnostics {
  const transcript = useAtomValue(transcriptFamily(conversationId ?? ''));
  return {
    attempt: transcript.tag === 'loaded' ? transcript.detail.latestAttempt : null,
    error: transcript.tag === 'failed' ? transcript.error : null,
    isLoading: transcript.tag === 'loading',
  };
}
