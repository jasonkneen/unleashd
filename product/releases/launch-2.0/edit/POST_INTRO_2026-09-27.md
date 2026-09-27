# Post-intro benefits + current picker — review draft

Brief: for the Unleashd 2.0 launch audience, introduce the four benefits immediately
after the 18-second Overload intro. Use the opening of the owner's September 27 take,
keep the existing block typography, and replace the older model-picker proof with
the refreshed running UI. Deliver 1920×1080 / 60 fps review videos in #unleashd-2.
Owner request: `post_8b3f5688-be29-41be-baf4-a5058775cc17`; picker follow-up:
`post_d1df2100-62b4-4d85-868f-f0870ffbff6c`.

## Edit

| Review time | Picture |
|---|---|
| 0–18.000 | Existing Overload intro |
| 18.000–19.400 | Multi harness |
| 19.400–20.817 | Completely free |
| 20.817–22.217 | Open source |
| 22.217–23.633 | Completely / customizable |
| 23.633–33.017 | Existing Native multimedia segment, for the transition review |

The benefits use only source 0–1.5 seconds, then hold frame 89. A 5.5% push-in
continues through the hold. The crop shows the workspace cards and excludes the
recording's terminal edge and URL hover strip. Brightness is raised 25% for the
dark capture. Workspace names and relative repository paths remain visible.

The original is `../footage/2026-09-27_post-intro_home.mov`: 2750×1882 at 60 fps,
30.667 s, no audio. Embedded creation time is **2026-09-27 06:42:42 UTC**
(14:42:42 +08), matching the owner's take. It was copied byte-for-byte from the
attachment named `1790491401742_Screen_Recording_2026-09-27_at_2.42.41___PM.mov`.

Audio reuses our synthesized marimba and soft impacts; the existing intro and
Native multimedia sound stay in place. WAV is muxed separately to preserve the
project's AAC timing convention. No third-party music or new generated asset.

## Refreshed picker

`PickerRefresh.tsx` is an 8.433-second replacement: Claude → Codex → Cursor → Muse,
1.4 seconds each, then a 2.8-second hold on the new thinking slider at medium.
The footage is a sequence of real captured UI states with gentle pushes and hard
cuts. It does not depict typing, sending a message, or an agent completing work.
The capture selects GPT-6 Astra explicitly on Codex and uses the actual Muse model
and thinking control. No channel message is sent.

Capture: `capture-refreshed-picker.mjs`, through the repository CDP driver. Files
and exact live DOM rectangles are in `../footage/picker-refresh-20260927/`.
The accepted capture was made at **07:00:51 UTC on 2026-09-27**, with desktop viewport
1487×941 at 2×, on commit `2a07227cb2b52054e7114db4fdea4452e861f56e`;
picker TSX/CSS were clean at capture time. The manifest records the selected text.
Raw captures, like the other footage, are local and gitignored; preserve that folder
with the recordings. If recaptured after another layout change, use the new manifest
rectangles in `PickerRefresh.tsx`.

`Assembly.tsx` now places benefits after Overload, shifts the existing music grid
and later sections by 338 frames, and uses PickerRefresh in the old picker slot.
The standalone picker runs 8.433 seconds; the existing 8-second assembly slot trims
the end of its final held frame. All four harnesses and the medium slider remain.

## Re-export

From this directory, with the existing dependencies and raw footage available:

```bash
pnpm exec remotion studio src/post-intro-entry.tsx
pnpm exec remotion render src/post-intro-entry.tsx PostIntroReview out/post-intro-review.video.mp4 --crf=18 --muted --concurrency=4
pnpm exec remotion render src/post-intro-entry.tsx PostIntroReview out/post-intro-review.wav --codec=wav --concurrency=2
ffmpeg -y -i out/post-intro-review.video.mp4 -i out/post-intro-review.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart out/post-intro-review.mp4
pnpm exec remotion render src/post-intro-entry.tsx PickerRefresh out/picker-refresh.mp4 --crf=18 --muted --concurrency=2
```

Re-capture from the repository root:

```bash
node product/releases/launch-2.0/edit/capture-refreshed-picker.mjs product/releases/launch-2.0/footage/picker-refresh-20260927
```

## Scope of this review

These exports review the requested changes. They are not a newly rendered full
launch master. The full Assembly still expects the previously planned phone and
localhost-app footage (`2026-09-26_feature_phone.mp4`, `2026-09-26_feature_app.mp4`),
which are absent from the local footage bank. The intro still has its existing
unrecorded voice-line space. Those are full-video finishing work, separate from
the two changes shown here.
