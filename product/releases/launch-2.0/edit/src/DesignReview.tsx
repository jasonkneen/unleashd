// "Design review" clip: owner asks the Product Development Lead to post screenshots of every
// product view, and the Lead posts Mobile / iPad / Desktop threads of live captures.
// Timeline and camera are data (CUTS, CAMERA); the card camera itself is ./card.
// Footage D and timecodes: ../footage/FOOTAGE.md. The real wait is ~6 min; the cut says so.
import type React from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FONT, INK } from './blocks';
import { CardEdit, FPS, type Cut, type Key, STILL, type Shot, hold, play, push, timeline } from './card';

export { FPS, HEIGHT, WIDTH } from './card';

// Main column x 524–2154, thread pane x 2156–2974 once it is open.
const D = staticFile('2026-09-26_design-review_D_post-screenshots-request.mov');

// Source seconds. The ending holds on a few screenshots with one quick scroll between them
// (owner, 2026-09-26: rough cut 2 "was too much scrolling at the end"; rough cut 3's final
// Desktop hold was dropped too: end on the quick scroll and cut to the next section).
const REQUEST = play(0.8, 5.3, 1.5, 'request appears in the composer, sent, thread opens');
const CUTS: Cut[] = [
  REQUEST,
  play(392.7, 395.2, 1, '~6 min later: "On it. I\'ve captured all 21 views…" lands'),
  play(395.6, 398.1, 1, 'Mobile / iPad / Desktop posts land in the channel (396.1)'),
  play(425.8, 426.8, 1, 'owner clicks the iPad thread (loading 426.8–430 cut)'),
  hold(431.75, 1.0, 'iPad landscape: the Buddies grid'),
  play(431.75, 435.0, 4, 'quick scroll down the iPad thread'),
  hold(435.0, 0.4, 'the scroll lands on an iPad channel; cut to the next section'),
];

const { starts, duration, at } = timeline(CUTS);
export const DURATION = duration;

const COMPOSER: Shot = { focus: 1, x: 540, w: 2080, top: 706, scale: 0.85, ...STILL, ox: 0.35, oy: 0.85 };
const FULL: Shot = { ...COMPOSER, focus: 0 };
const PANE_WAIT: Shot = { focus: 1, x: 2156, w: 818, top: 632, scale: 0.8, ...STILL, oy: 0.3 }; // request + typing
const PANE_REPLY: Shot = { ...PANE_WAIT, top: 480, oy: 0.7 }; // request + "On it"
const POSTS: Shot = { focus: 1, x: 540, w: 1620, top: 800, scale: 1, ...STILL, ox: 0.3, oy: 0.6 }; // iPad link
// Screenshot holds in the pane, framed on each picture (label above it, source rows).
const IPAD_BUDDIES: Shot = { focus: 1, x: 2156, w: 818, top: 740, scale: 1.2, ...STILL, oy: 0.45 };
const IPAD_CHANNEL: Shot = { ...IPAD_BUDDIES, top: 330 };

const SENT = (3.6 - REQUEST.from) / REQUEST.rate; // the post leaves the composer
const CAMERA: Key[] = [
  { t: 0, shot: FULL },
  { t: 0.15, shot: FULL },
  { t: 0.9, shot: COMPOSER },
  { t: SENT, shot: push(COMPOSER, 1.05) },
  { t: SENT + 0.8, shot: PANE_WAIT },
  { t: at(1), shot: push(PANE_WAIT, 1.04) },
  { t: at(1), shot: PANE_REPLY },
  { t: at(2), shot: push(PANE_REPLY, 1.08) },
  { t: at(2), shot: POSTS },
  { t: at(4), shot: push(POSTS, 1.1) },
  { t: at(4), shot: IPAD_BUDDIES },
  { t: at(5), shot: push(IPAD_BUDDIES, 1.05) },
  { t: at(6), shot: IPAD_CHANNEL },
  { t: duration / FPS, shot: push(IPAD_CHANNEL, 1.03) },
];

// The honest time-skip: the Lead took about six minutes to capture 21 views at four sizes.
const LaterChip: React.FC = () => {
  const u = useCurrentFrame() / FPS;
  const o = interpolate(u, [0, 0.2, 1.3, 1.6], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(u, [0, 0.3], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 70,
        display: 'flex',
        justifyContent: 'center',
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 44,
          fontWeight: 700,
          fontStretch: '90%',
          color: INK.cream,
          background: INK.surface,
          padding: '10px 28px 14px',
          borderRadius: 999,
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        }}
      >
        6 minutes later
      </span>
    </div>
  );
};

export const DesignReview: React.FC = () => (
  <AbsoluteFill>
    <CardEdit src={D} cuts={CUTS} camera={CAMERA} />
    <Sequence from={starts[1]} durationInFrames={starts[2] - starts[1]}>
      <LaterChip />
    </Sequence>
  </AbsoluteFill>
);
