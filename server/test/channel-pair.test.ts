import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type Job,
  type Pair,
  type PairEffect,
  type PairEvent,
  type Trigger,
  idlePair,
  step,
} from '../src/buddies/channel-pair';

// Exhaustive search over one pair's machine, the way a model checker (TLC) would: every
// interleaving of posts (each a plain reply or an @mention of the pair's Buddy), gate verdicts and
// turn endings, at a small scope, with the invariants asserted on every reachable state. The
// environment plays the gate and the turn: it answers only the effects the machine emitted.
// F1 (2026-09-28): a gate in flight whose post a mention turn then read started a second turn;
// disabling the admission rule in `start` fails "no follow-up runs for a post already read".

type P = Pair<string, string>;
type World = {
  pair: P;
  posted: number;
  gate: Trigger<string> | null;
  run: Job<string> | null;
  /** The newest post any completed turn showed. */
  read: string;
  ran: string[];
  gated: string[];
  mentions: string[];
  replies: string[];
};

const ORDS = ['a', 'b', 'c', 'd', 'e'];
const job = (ord: string, mustAnswer: boolean): Job<string> => ({
  id: ord,
  ord,
  mustAnswer,
  reply: ord,
});

function apply(world: World, event: PairEvent<string, string>): World {
  const { pair, effects } = step(world.pair, event);
  const next: World = { ...world, pair, ran: [...world.ran], gated: [...world.gated] };
  for (const effect of effects as PairEffect<string, string>[]) {
    switch (effect.kind) {
      case 'gate':
        assert.equal(next.gate, null, 'at most one gate in flight per pair');
        assert.ok(effect.trigger.ord > next.read, 'no gate for a post already read');
        next.gate = effect.trigger;
        next.gated.push(effect.trigger.ord);
        break;
      case 'run':
        assert.equal(next.run, null, 'at most one turn per seat');
        assert.ok(
          effect.job.mustAnswer || effect.job.ord > next.read,
          `no follow-up runs for a post already read (${effect.job.ord} <= ${next.read})`
        );
        assert.ok(!next.ran.includes(effect.job.id), `one turn per job (${effect.job.id})`);
        next.run = effect.job;
        next.ran.push(effect.job.id);
        break;
    }
  }
  return next;
}

function moves(world: World): World[] {
  const out: World[] = [];
  if (world.posted < ORDS.length) {
    const ord = ORDS[world.posted];
    const posted = { ...world, posted: world.posted + 1 };
    out.push(
      apply(
        { ...posted, replies: [...world.replies, ord] },
        {
          kind: 'posted',
          trigger: { ord, followUp: ord },
        }
      )
    );
    out.push(
      apply(
        { ...posted, mentions: [...world.mentions, ord] },
        {
          kind: 'mentioned',
          job: job(ord, true),
        }
      )
    );
  }
  if (world.gate) {
    const { ord } = world.gate;
    out.push(apply({ ...world, gate: null }, { kind: 'gate_yes', job: job(ord, false) }));
    out.push(apply({ ...world, gate: null }, { kind: 'gate_no' }));
  }
  if (world.run) {
    // The turn composed its prompt at some moment after its post: it showed through its own post
    // or through the newest post by then.
    const latest = ORDS[world.posted - 1];
    for (const through of new Set([world.run.ord, latest])) {
      const read = through > world.read ? through : world.read;
      out.push(apply({ ...world, run: null, read }, { kind: 'replied', through }));
    }
  }
  return out;
}

test('every interleaving keeps one turn per seat, answers every mention, and loses no post', () => {
  const start: World = {
    pair: idlePair(),
    posted: 0,
    gate: null,
    run: null,
    read: '',
    ran: [],
    gated: [],
    mentions: [],
    replies: [],
  };
  const seen = new Set<string>();
  const frontier = [start];
  let quiescent = 0;
  while (frontier.length > 0) {
    const world = frontier.pop() as World;
    const key = JSON.stringify(world);
    if (seen.has(key)) continue;
    seen.add(key);
    const next = moves(world);
    if (next.length > 0) {
      frontier.push(...next);
      continue;
    }
    quiescent++;
    // Nothing left to happen: every mention was answered exactly once…
    for (const ord of world.mentions)
      assert.equal(world.ran.filter((id) => id === ord).length, 1, `mention ${ord} answered once`);
    // …and every plain reply was gated (itself or a newer one: a burst is gated once) or read.
    for (const ord of world.replies)
      assert.ok(
        world.read >= ord || world.gated.some((gated) => gated >= ord),
        `reply ${ord} was neither gated nor read: ${key}`
      );
    assert.equal(world.pair.queue.length, 0);
    assert.equal(world.pair.gating, false);
    assert.equal(world.pair.deferred, null);
  }
  assert.ok(seen.size > 2000, `searched ${seen.size} states`);
  assert.ok(quiescent > 100, `${quiescent} end states`);
});
