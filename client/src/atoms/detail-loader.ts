/**
 * Fetch a snapshot only across a quiet local-state interval.
 *
 * Conversation details arrive over HTTP while live updates arrive over a
 * WebSocket, so transport arrival order cannot establish freshness. Object
 * identity can: every structural WebSocket update replaces the conversation
 * value in the atom map. If that value changed while HTTP was in flight, fetch
 * again instead of allowing the older response to overwrite newer live state.
 */
export async function applyStableSnapshot<T>(
  readCurrent: () => T | undefined,
  fetchSnapshot: () => Promise<T>,
  applySnapshot: (snapshot: T, baseline: T) => void
): Promise<boolean> {
  while (true) {
    const baseline = readCurrent();
    if (!baseline) return false;

    const snapshot = await fetchSnapshot();
    if (readCurrent() !== baseline) continue;

    // No asynchronous boundary is permitted between the final freshness check
    // and application of the snapshot.
    applySnapshot(snapshot, baseline);
    return true;
  }
}
