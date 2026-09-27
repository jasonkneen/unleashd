// Owner take, 2026-09-27 14:42:42 +08. Only its opening 1.5 seconds are used;
// hold the last home frame while the four benefits land, before the channel opens.
import type React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Block, INK, lerp } from './blocks';
import { MARIMBA, SFX, Soundtrack } from './soundtrack';

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const boundary = (i: number) => Math.round(i * 3 * (60 / 128) * FPS);
export const DURATION = boundary(4);
const SOURCE = staticFile('2026-09-27_post-intro_home.mov');
const HOME_END = 90;

export const TITLES = [
  { lines: ['Multi harness'], fill: INK.cyan, rot: -2 },
  { lines: ['Completely free'], fill: '#FDDB00', rot: 2 },
  { lines: ['Open source'], fill: INK.wordmarkOrange, rot: -2 },
  { lines: ['Completely', 'customizable'], fill: INK.cyan, rot: 1.5 },
];

const Home: React.FC = () => (
  <OffthreadVideo
    src={SOURCE}
    muted
    style={{ position: 'absolute', width: 2750, height: 1882, left: -490, top: -120 }}
  />
);

export const PostIntroBenefits: React.FC = () => {
  const frame = useCurrentFrame();
  const index = TITLES.findLastIndex((_, i) => frame >= boundary(i));
  const title = TITLES[index];
  const u = (frame - boundary(index)) / FPS;
  return (
    <AbsoluteFill style={{ background: INK.plate, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', left: 70, top: 62, width: 1780, height: 690,
          borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,.45)',
          border: '1px solid rgba(253,246,227,.14)',
          filter: 'brightness(1.25)',
          transform: `scale(${lerp(1, 1.055, frame / DURATION)})`,
        }}
      >
        <Freeze frame={Math.min(frame, HOME_END - 1)}><Home /></Freeze>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #002b36 2%, transparent 35%)' }} />
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 75, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {title.lines.map((line, i) => (
          <div key={`${index}-${line}`} style={{ transform: title.lines.length > 1 ? 'scale(.85)' : undefined, marginTop: title.lines.length > 1 && i > 0 ? -20 : 0 }}>
            <Block text={line} u={u - i * 0.07} size="xl" fill={title.fill} ink={INK.plate} rot={i % 2 ? -title.rot : title.rot} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// Continue the intro's own marimba into this insert. The final chord rings
// across the cut into the existing EDM build; the audio has no hard section cut.
export const BenefitsSound: React.FC = () => (
  <Soundtrack fps={FPS} cues={TITLES.flatMap((_, i) => [
    { at: boundary(i) / FPS, src: [MARIMBA.D4, MARIMBA.Fs4, MARIMBA.A4, MARIMBA.D5][i], volume: 0.72 },
    { at: boundary(i) / FPS, src: SFX.thud, volume: 0.13 },
    ...(i === 3 ? [
      { at: boundary(i) / FPS + 0.04, src: MARIMBA.Fs4, volume: 0.34 },
      { at: boundary(i) / FPS + 0.08, src: MARIMBA.A4, volume: 0.34 },
    ] : []),
  ])} />
);

export const BenefitsWithSound: React.FC = () => (
  <AbsoluteFill>
    <PostIntroBenefits />
    <Sequence layout="none"><BenefitsSound /></Sequence>
  </AbsoluteFill>
);
