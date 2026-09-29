// The close, in type: GitHub + "Fork it", "Run it on your computer", the Vim ethos, the benefits
// recap and the end card. Every section is timed in beats of the EDM cue
// (../../sound/edm.py, 128 BPM) so the assembly can drop each one on its bar.
// Sections are data (text, beat, colour); the components just render them with <Block>.
import type React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, Series, staticFile, useCurrentFrame } from 'remotion';
import wordmark from '../../brand/unleashd-wordmark-3d_trimmed.png';
import { Block, clamp01, FONT, INK, lerp } from './blocks';

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BEAT = 60 / 128;
export const beats = (n: number) => Math.round(n * BEAT * FPS);

type Size = 'md' | 'xl' | 'xxl';
type Word = { text: string; beat: number; size: Size; fill: string; ink: string; rot: number };

const Stack: React.FC<{ words: Word[]; gap: number }> = ({ words, gap }) => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap }}>
      {words.map((w) => (
        <Block key={w.text} text={w.text} u={t - w.beat * BEAT} size={w.size} fill={w.fill} ink={w.ink} rot={w.rot} />
      ))}
    </AbsoluteFill>
  );
};

// ---- The recap, on the bar-29 hit after the Vim line: every benefit, one per beat, then the whole
// grid holds for the end card. Owner, 2026-09-30: "repeat the benefits to close out and sell". -----
const RECAP: Word[][] = [
  [
    { text: 'Multi harness!', beat: 0, size: 'xl', fill: INK.cyan, ink: INK.plate, rot: -3 },
    { text: 'Free!', beat: 1, size: 'xl', fill: INK.yellow, ink: INK.plate, rot: 2 },
  ],
  [
    { text: 'Private!', beat: 2, size: 'xl', fill: INK.red, ink: INK.cream, rot: 2 },
    { text: 'Open Source!', beat: 3, size: 'xl', fill: INK.wordmarkOrange, ink: INK.plate, rot: -2 },
  ],
  [{ text: 'Customizable!', beat: 4, size: 'xl', fill: '#859900', ink: INK.plate, rot: -1 }],
];
export const VALUES_FRAMES = beats(8);
export const Values: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: INK.plate, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      {RECAP.map((row) => (
        <div key={row[0].text} style={{ display: 'flex', gap: 28 }}>
          {row.map((w) => (
            <Block key={w.text} text={w.text} u={t - w.beat * BEAT} size={w.size} fill={w.fill} ink={w.ink} rot={w.rot} />
          ))}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---- Open source: the real GitHub page, a push-in to Fork, the click, "Fork it." --------------------
// Owner, 2026-09-30: "just show github and a fork real quick". The page is a logged-out dark-mode
// capture (../footage/2026-09-30_github_repo.png, 2974×1882). Nothing is forked: the click is a
// cursor and a press flash drawn over the still.
const REPO_SHOT = staticFile('2026-09-30_github_repo.png');
const REPO_URL = 'github.com/nbardy/unleashd';
const CARD_W = 1500;
const CHROME_H = 64;
const SHOT_SCALE = CARD_W / 2974;
// Fork button in capture px (x 2474–2678, y 177–231), as card px.
const FORK_BTN = { x: 2474 * SHOT_SCALE, y: CHROME_H + 177 * SHOT_SCALE, w: 204 * SHOT_SCALE, h: 54 * SHOT_SCALE };
const FORK_AT = { x: FORK_BTN.x + FORK_BTN.w / 2, y: FORK_BTN.y + FORK_BTN.h / 2 };
const CARD_AT = { x: (1920 - CARD_W) / 2, y: 60 };
const FORK_TO = { x: 1560, y: 200 }; // where the push-in carries the button: the card then overfills the frame, browser bar above it
const ZOOM = 2.0;
const CLICK_BEAT = 4;
const FORK: Word[] = [
  { text: 'Fork it.', beat: CLICK_BEAT, size: 'xl', fill: INK.yellow, ink: INK.plate, rot: -3 },
  { text: 'Add the features you want.', beat: CLICK_BEAT + 1, size: 'md', fill: INK.surface, ink: INK.cream, rot: 0 },
];
export const FORK_FRAMES = beats(8);

const BrowserBar: React.FC<{ url: string }> = ({ url }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: CHROME_H, padding: '0 22px', background: '#e8e8e8' }}>
    <div style={{ display: 'flex', gap: 10 }}>
      {[INK.red, INK.yellow, '#859900'].map((c) => (
        <span key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
      ))}
    </div>
    <div
      style={{
        flex: 1,
        height: 40,
        borderRadius: 20,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 22px',
        fontFamily: FONT,
        fontSize: 26,
        fontWeight: 600,
        color: '#333',
      }}
    >
      {url}
    </div>
  </div>
);

const Cursor: React.FC<{ x: number; y: number; press: number }> = ({ x, y, press }) => (
  <svg
    width={44}
    height={60}
    viewBox="0 0 22 30"
    style={{ position: 'absolute', left: x, top: y, transform: `scale(${1 - 0.15 * press})`, transformOrigin: '0 0' }}
  >
    <path d="M1 1 L1 23 L6.5 17.5 L10.5 27 L14 25.5 L10 16.5 L17.5 16.5 Z" fill="#fff" stroke="#000" strokeWidth={1.4} />
  </svg>
);

export const Fork: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const push = Easing.inOut(Easing.cubic)(clamp01(t / (3.5 * BEAT)));
  const s = lerp(1, ZOOM, push);
  const btn = { x: lerp(CARD_AT.x + FORK_AT.x, FORK_TO.x, push), y: lerp(CARD_AT.y + FORK_AT.y, FORK_TO.y, push) };
  const glide = Easing.out(Easing.cubic)(clamp01((t - BEAT) / (2.5 * BEAT)));
  const sinceClick = t - CLICK_BEAT * BEAT;
  const press = sinceClick < 0 ? 0 : Math.max(0, 1 - Math.abs(sinceClick - 0.06) / 0.12);
  const flash = sinceClick < 0 ? 0.12 * glide : lerp(0.45, 0.14, clamp01(sinceClick / 0.4));
  return (
    <AbsoluteFill style={{ background: INK.plate }}>
      <div
        style={{
          position: 'absolute',
          left: CARD_AT.x,
          top: CARD_AT.y,
          width: CARD_W,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,.55)',
          transformOrigin: `${FORK_AT.x}px ${FORK_AT.y}px`,
          transform: `translate(${btn.x - CARD_AT.x - FORK_AT.x}px, ${btn.y - CARD_AT.y - FORK_AT.y}px) scale(${s})`,
        }}
      >
        <BrowserBar url={REPO_URL} />
        <Img src={REPO_SHOT} style={{ display: 'block', width: CARD_W }} />
        <div
          style={{
            position: 'absolute',
            left: FORK_BTN.x,
            top: FORK_BTN.y,
            width: FORK_BTN.w,
            height: FORK_BTN.h,
            borderRadius: 4,
            background: `rgba(255,255,255,${flash})`,
          }}
        />
      </div>
      <Cursor x={lerp(1560, btn.x + 6, glide)} y={lerp(980, btn.y + 4, glide)} press={press} />
      <div style={{ position: 'absolute', left: 150, top: 640, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18 }}>
        {FORK.map((w) => (
          <Block key={w.text} text={w.text} u={t - w.beat * BEAT} size={w.size} fill={w.fill} ink={w.ink} rot={w.rot} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- Beat 9: "Run it on your computer." The real app, captured from localhost, in a browser
// frame whose address bar shows the URL it was captured from. -------------------------------------
// Captured 2026-09-30 at 4ddfa88 with ../capture/record-page.mjs (#unleashd-2, read-only), 4 s.
const APP = staticFile('2026-09-30_feature_app.mp4');
const APP_URL = 'localhost:7489';
const RUN: Word[] = [
  { text: 'Run it on', beat: 0, size: 'xl', fill: INK.cyan, ink: INK.plate, rot: -2 },
  { text: 'your computer.', beat: 0.5, size: 'xl', fill: INK.wordmarkOrange, ink: INK.plate, rot: 2 },
];
export const RUN_FRAMES = beats(8);

export const Run: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const settle = Easing.out(Easing.cubic)(clamp01(t / (2 * BEAT)));
  return (
    <AbsoluteFill style={{ background: INK.plate, alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 1500,
          borderRadius: 16,
          overflow: 'hidden',
          background: '#e8e8e8',
          boxShadow: '0 40px 100px rgba(0,0,0,.55)',
          transform: `translateY(${lerp(60, 110, settle)}px) scale(${lerp(1.08, 1, settle)})`,
        }}
      >
        <BrowserBar url={APP_URL} />
        <OffthreadVideo src={APP} muted style={{ display: 'block', width: 1500 }} />
      </div>
      <div style={{ position: 'absolute', left: 120, top: 70, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        {RUN.map((w) => (
          <Block key={w.text} text={w.text} u={t - w.beat * BEAT} size={w.size} fill={w.fill} ink={w.ink} rot={w.rot} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- The ethos, over the 4-bar breakdown, after the fork: why open source matters. Owner-approved
// wording (../brand/PROJECT_ETHOS.md), two cards with a hard cut on bar 3 of the breakdown. ---------
const VIM_CARDS: Word[][] = [
  [
    { text: 'Vim is open source', beat: 0, size: 'xl', fill: '#859900', ink: INK.plate, rot: -2 },
    { text: "and it's still here decades later.", beat: 1.5, size: 'md', fill: INK.surface, ink: INK.cream, rot: 0 },
  ],
  [
    { text: 'Agent software', beat: 0, size: 'xl', fill: INK.cyan, ink: INK.plate, rot: -2 },
    { text: 'should be too.', beat: 1, size: 'xl', fill: INK.wordmarkOrange, ink: INK.plate, rot: 2 },
  ],
];
const VIM_CARD = beats(8);
export const VIM_FRAMES = VIM_CARDS.length * VIM_CARD;
export const Vim: React.FC = () => (
  <AbsoluteFill style={{ background: INK.night }}>
    <Series>
      {VIM_CARDS.map((words) => (
        <Series.Sequence key={words[0].text} durationInFrames={VIM_CARD}>
          <Stack words={words} gap={26} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);

// ---- Beat 11: the end card, on the final hit. -----------------------------------------------------
export const END_FRAMES = Math.round(3.25 * FPS);
export const EndCard: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const reveal = Easing.out(Easing.back(1.6))(clamp01(t / 0.45));
  return (
    <AbsoluteFill style={{ background: INK.plate, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <Img src={wordmark} style={{ width: 1000, opacity: clamp01(t / 0.15), transform: `scale(${lerp(0.85, 1, reveal)})` }} />
      <Block text="Try Unleashd Today, Free!" u={t - 2 * BEAT} size="md" fill={INK.wordmarkOrange} ink={INK.plate} rot={-1.5} />
      <div
        style={{
          fontFamily: FONT,
          fontSize: 34,
          fontWeight: 600,
          color: INK.cream,
          opacity: clamp01((t - 4 * BEAT) / 0.3),
          marginTop: 18,
        }}
      >
        github.com/nbardy/unleashd
      </div>
    </AbsoluteFill>
  );
};

// Preview of the whole close in order (the assembly places each section on its own bar).
export const SECTIONS: { id: string; frames: number; C: React.FC }[] = [
  { id: 'fork', frames: FORK_FRAMES, C: Fork },
  { id: 'run', frames: RUN_FRAMES, C: Run },
  { id: 'vim', frames: VIM_FRAMES, C: Vim },
  { id: 'values', frames: VALUES_FRAMES, C: Values },
  { id: 'end', frames: END_FRAMES, C: EndCard },
];
export const DURATION = SECTIONS.reduce((n, s) => n + s.frames, 0);
export const Close: React.FC = () => (
  <Series>
    {SECTIONS.map(({ id, frames, C }) => (
      <Series.Sequence key={id} durationInFrames={frames}>
        <C />
      </Series.Sequence>
    ))}
  </Series>
);
