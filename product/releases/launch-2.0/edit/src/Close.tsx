// The close, beats 8–11, in type: "Free! Private! Open Source!", "Fork it", "Run it on your
// computer", the Vim line and the end card. Every section is timed in beats of the EDM cue
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

// ---- Beat 8: one word per beat from the bar-18 hit, then the full stack holds. --------------------
const VALUES: Word[] = [
  { text: 'Free!', beat: 0, size: 'xxl', fill: INK.cyan, ink: INK.plate, rot: -4 },
  { text: 'Private!', beat: 1, size: 'xxl', fill: INK.yellow, ink: INK.plate, rot: 2 },
  { text: 'Open Source!', beat: 2, size: 'xxl', fill: INK.wordmarkOrange, ink: INK.plate, rot: -3 },
];
export const VALUES_FRAMES = beats(8);
export const Values: React.FC = () => (
  <AbsoluteFill style={{ background: INK.plate }}>
    <Stack words={VALUES} gap={10} />
  </AbsoluteFill>
);

// ---- Beat 9: "Fork it." over the real clone-and-run commands from the README. --------------------
const REPO = 'https://github.com/nbardy/unleashd';
const TERMINAL: { prompt: boolean; text: string; beat: number; typeBeats: number }[] = [
  { prompt: true, text: `git clone ${REPO}`, beat: 0.3, typeBeats: 1.3 },
  { prompt: true, text: 'cd unleashd && pnpm install && pnpm dev', beat: 1.9, typeBeats: 1.2 },
  { prompt: false, text: '➜  Local:  http://localhost:7489', beat: 3.3, typeBeats: 0 },
];
const FORK: Word[] = [
  { text: 'Fork it.', beat: 0, size: 'xl', fill: INK.yellow, ink: INK.plate, rot: -3 },
  { text: 'Add the features you want.', beat: 1, size: 'md', fill: INK.surface, ink: INK.cream, rot: 0 },
];
export const FORK_FRAMES = beats(4);

const Terminal: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <div
      style={{
        width: 1240,
        padding: '26px 36px 34px',
        borderRadius: 18,
        background: INK.night,
        boxShadow: '0 40px 100px rgba(0,0,0,.55)',
        outline: '1px solid rgba(255,255,255,.08)',
        fontFamily: 'Menlo, monospace',
        fontSize: 34,
        lineHeight: 1.6,
        color: INK.cream,
      }}
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {[INK.red, INK.yellow, '#859900'].map((c) => (
          <span key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
        ))}
      </div>
      {TERMINAL.map((line) => {
        const u = t - line.beat * BEAT;
        const shown = line.typeBeats === 0 ? line.text.length : Math.floor(line.text.length * clamp01(u / (line.typeBeats * BEAT)));
        return (
          <div key={line.text} style={{ visibility: u < 0 ? 'hidden' : 'visible', color: line.prompt ? INK.cream : INK.cyan }}>
            {line.prompt ? <span style={{ color: INK.wordmarkOrange }}>$ </span> : null}
            {line.text.slice(0, shown)}
          </div>
        );
      })}
    </div>
  );
};

export const Fork: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: INK.plate, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `translateY(90px) scale(${lerp(0.96, 1.02, t / (4 * BEAT))})` }}>
        <Terminal />
      </div>
      <div style={{ position: 'absolute', left: 150, top: 110, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18 }}>
        {FORK.map((w) => (
          <Block key={w.text} text={w.text} u={t - w.beat * BEAT} size={w.size} fill={w.fill} ink={w.ink} rot={w.rot} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- Beat 9: "Run it on your computer." The real app, captured from localhost, in a browser
// frame whose address bar shows the URL it was captured from. -------------------------------------
const APP = staticFile('2026-09-26_feature_app.mp4');
const APP_URL = 'localhost:7489/channels';
const RUN: Word[] = [
  { text: 'Run it on', beat: 0, size: 'xl', fill: INK.cyan, ink: INK.plate, rot: -2 },
  { text: 'your computer.', beat: 0.5, size: 'xl', fill: INK.wordmarkOrange, ink: INK.plate, rot: 2 },
];
export const RUN_FRAMES = beats(4);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: 64, padding: '0 22px' }}>
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
            {APP_URL}
          </div>
        </div>
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

// ---- Beat 10: the Vim line, over the breakdown. Owner wording. -----------------------------------
const VIM: Word[] = [
  { text: 'Inspired by Vim.', beat: 0, size: 'xl', fill: '#859900', ink: INK.plate, rot: -2 },
  { text: 'We need open source agent software', beat: 2.5, size: 'md', fill: INK.surface, ink: INK.cream, rot: 0 },
  { text: 'for the future.', beat: 4, size: 'md', fill: INK.cyan, ink: INK.plate, rot: 0 },
];
export const VIM_FRAMES = beats(8);
export const Vim: React.FC = () => (
  <AbsoluteFill style={{ background: INK.night }}>
    <Stack words={VIM} gap={26} />
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
  { id: 'values', frames: VALUES_FRAMES, C: Values },
  { id: 'fork', frames: FORK_FRAMES, C: Fork },
  { id: 'run', frames: RUN_FRAMES, C: Run },
  { id: 'vim', frames: VIM_FRAMES, C: Vim },
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
