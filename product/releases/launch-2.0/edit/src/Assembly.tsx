// The whole launch video, beats 1–11, in script order. The open keeps its own sound design; from
// the end of the open one continuous EDM cue (../../sound/edm-full.wav, 128 BPM) runs to the end
// card, and every later section starts on a bar of it. Sections are data (SECTIONS); a section
// plays its clip from `offset` and holds the clip's last frame if its slot outlasts it.
import type React from 'react';
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence } from 'remotion';
import beat9 from '../../beat9/beat9.mp4';
import edmFull from '../../sound/edm-full.wav';
import * as Close from './Close';
import * as DesignIterationShort from './DesignIterationShort';
import * as DesignReview from './DesignReview';
import * as FeatureFlash from './FeatureFlash';
import * as NativeMultimedia from './NativeMultimedia';
import * as Overload from './Overload';
import * as PickerRefresh from './PickerRefresh';
import * as PostIntroBenefits from './PostIntroBenefits';

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const BAR = (4 * 60) / 128; // 1.875 s
const MUSIC_IN = Overload.DURATION + PostIntroBenefits.DURATION;
// Frame where bar b (1-based) of the cue starts. Bars are 112.5 frames, so round per bar, never accumulate.
const bar = (b: number) => MUSIC_IN + Math.round((b - 1) * BAR * FPS);

// beat9.mp4 is two slides: "Multi harness" (0–3.4 s) and "Bring your own subscriptions" (3.4–7 s).
const SLIDE_SPLIT = Math.round(3.4 * FPS);
const SLIDES_END = Math.round(7.0 * FPS);
const Slides: React.FC = () => <OffthreadVideo src={beat9} muted />;

// A section: component C (intrinsic length `frames`) starts at `from`, runs to `to`, and plays
// C from `offset` frames in. Silent sections hold C's last frame to fill a bar-aligned slot.
type Section = { id: string; from: number; to: number; C: React.FC; frames: number; offset: number };
const section = (id: string, from: number, to: number, C: React.FC, frames: number, offset = 0): Section => ({
  id,
  from,
  to,
  C,
  frames,
  offset,
});

// Bars 20–27: harness slide, refreshed picker proof, subscriptions slide.
// The picker starts on Claude and ends on the new thinking slider.
const PICKER_FROM = bar(20) + SLIDE_SPLIT;
const PICKER_TO = bar(28) - (SLIDES_END - SLIDE_SPLIT);

export const SECTIONS: Section[] = [
  section('overload', 0, Overload.DURATION, Overload.Overload, Overload.DURATION),
  section('post-intro-benefits', Overload.DURATION, MUSIC_IN, PostIntroBenefits.PostIntroBenefits, PostIntroBenefits.DURATION),
  section('native-multimedia', bar(1), bar(6), NativeMultimedia.NativeMultimediaPicture, NativeMultimedia.DURATION),
  section('design-review', bar(6), bar(12), DesignReview.DesignReview, DesignReview.DURATION),
  section('design-iteration', bar(12), bar(15), DesignIterationShort.DesignIterationShort, DesignIterationShort.DURATION),
  section('features', bar(15), bar(18), FeatureFlash.FeatureFlash, FeatureFlash.DURATION),
  section('values', bar(18), bar(20), Close.Values, Close.VALUES_FRAMES),
  section('harness-slide', bar(20), PICKER_FROM, Slides, SLIDE_SPLIT),
  section('picker', PICKER_FROM, PICKER_TO, PickerRefresh.PickerRefresh, PickerRefresh.DURATION),
  section('subscriptions-slide', PICKER_TO, bar(28), Slides, SLIDES_END, SLIDE_SPLIT),
  section('fork', bar(28), bar(29), Close.Fork, Close.FORK_FRAMES),
  section('run', bar(29), bar(30), Close.Run, Close.RUN_FRAMES),
  section('vim', bar(30), bar(32), Close.Vim, Close.VIM_FRAMES),
  section('end', bar(32), bar(32) + Close.END_FRAMES, Close.EndCard, Close.END_FRAMES),
];
export const DURATION = SECTIONS[SECTIONS.length - 1].to;

const Place: React.FC<{ s: Section }> = ({ s }) => {
  const plays = Math.min(s.to - s.from, s.frames - s.offset);
  return (
    <>
      <Sequence from={s.from} durationInFrames={plays} name={s.id}>
        <Sequence from={-s.offset} layout="none">
          <s.C />
        </Sequence>
      </Sequence>
      {s.to - s.from > plays ? (
        <Sequence from={s.from + plays} durationInFrames={s.to - s.from - plays} name={`${s.id} (hold)`}>
          <Freeze frame={s.frames - 1}>
            <s.C />
          </Freeze>
        </Sequence>
      ) : null}
    </>
  );
};

export const Assembly: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {SECTIONS.map((s) => (
      <Place key={s.id} s={s} />
    ))}
    <Sequence from={Overload.DURATION} layout="none">
      <PostIntroBenefits.BenefitsSound />
    </Sequence>
    <Sequence from={MUSIC_IN} layout="none">
      <Audio src={edmFull} />
    </Sequence>
  </AbsoluteFill>
);
