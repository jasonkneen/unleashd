// Pattern: pure-core (docs/patterns.md#pure-core)
// One (thread, Buddy) PAIR's reply machine, with no I/O: channels.ts applies the effects and feeds
// back their outcomes as events. Until 2026-09-29 this state lived in four maps mutated from five
// functions, and the one admission rule sat in one transition only: a gate in flight whose post a
// mention turn had already answered started a second turn (F1 in
// agent_notes/2026-09-28_channels-state-machine-review.md). Guard: channel-pair.test.ts searches
// every interleaving of posts, mentions, gate verdicts and turn endings at a small scope.

/** Store order of posts (`post.ord`, ordered ids): any post's ord is greater than this. */
export const NOTHING_READ = '';

/** A post the pair's Buddy may follow up on: the gate asks it first. */
export type Trigger<F> = { ord: string; followUp: F };
/** A reply turn. `mustAnswer`: a mention or a retry; otherwise a follow-up the gate said yes to. */
export type Job<R> = { id: string; ord: string; mustAnswer: boolean; reply: R };

export type Pair<F, R> = {
  /** A gate question is in flight. */
  gating: boolean;
  /** The newest post that arrived while the pair was busy; gated once it is idle. */
  deferred: Trigger<F> | null;
  /** Serial reply turns; the head is running. */
  queue: readonly Job<R>[];
  /** The newest post a completed turn of this pair was shown. */
  readThrough: string;
};

export type PairEvent<F, R> =
  | { kind: 'posted'; trigger: Trigger<F> }
  | { kind: 'mentioned'; job: Job<R> }
  | { kind: 'gate_yes'; job: Job<R> }
  | { kind: 'gate_no' }
  /** The head's turn ended however it ended; `through` is the newest post its prompt showed. */
  | { kind: 'replied'; through: string };

export type PairEffect<F, R> = { kind: 'gate'; trigger: Trigger<F> } | { kind: 'run'; job: Job<R> };

export const idlePair = <F, R>(): Pair<F, R> => ({
  gating: false,
  deferred: null,
  queue: [],
  readThrough: NOTHING_READ,
});

const busy = (pair: Pair<unknown, unknown>) => pair.gating || pair.queue.length > 0;
const unread = (pair: Pair<unknown, unknown>, ord: string) => ord > pair.readThrough;
const newer = <T extends { ord: string }>(held: T | null, next: T) =>
  held !== null && held.ord > next.ord ? held : next;

export function step<F, R>(
  pair: Pair<F, R>,
  event: PairEvent<F, R>
): { pair: Pair<F, R>; effects: PairEffect<F, R>[] } {
  const effects: PairEffect<F, R>[] = [];

  // The ONE admission rule, applied whenever a job becomes the head: a mention or retry must
  // answer; a follow-up runs only for a post the pair has not read.
  const start = (next: Pair<F, R>): Pair<F, R> => {
    const queue = [...next.queue];
    while (queue.length > 0 && !queue[0].mustAnswer && !unread(next, queue[0].ord)) queue.shift();
    if (queue.length > 0) effects.push({ kind: 'run', job: queue[0] });
    return { ...next, queue };
  };
  const enqueue = (next: Pair<F, R>, job: Job<R>): Pair<F, R> => {
    if (next.queue.some((queued) => queued.id === job.id)) return next;
    const queued = { ...next, queue: [...next.queue, job] };
    return next.queue.length === 0 ? start(queued) : queued;
  };
  // Idle again: gate the post that arrived meanwhile, unless a turn already read it.
  const settle = (next: Pair<F, R>): Pair<F, R> => {
    if (busy(next) || next.deferred === null) return next;
    const trigger = next.deferred;
    if (!unread(next, trigger.ord)) return { ...next, deferred: null };
    effects.push({ kind: 'gate', trigger });
    return { ...next, deferred: null, gating: true };
  };

  switch (event.kind) {
    case 'posted':
      return { pair: settle({ ...pair, deferred: newer(pair.deferred, event.trigger) }), effects };
    case 'mentioned':
      return { pair: enqueue(pair, event.job), effects };
    case 'gate_yes':
      return { pair: settle(enqueue({ ...pair, gating: false }, event.job)), effects };
    case 'gate_no':
      return { pair: settle({ ...pair, gating: false }), effects };
    case 'replied': {
      const readThrough = event.through > pair.readThrough ? event.through : pair.readThrough;
      return {
        pair: settle(start({ ...pair, queue: pair.queue.slice(1), readThrough })),
        effects,
      };
    }
  }
}
