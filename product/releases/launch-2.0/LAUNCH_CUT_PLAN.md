# Launch cut plan — 2026-09-28

Audit and proposed finishing brief, for owner review. This reconciles the kickoff
script with Assembly.tsx and the September 27 additions; it does not claim a new
render or an approved final cut. Audience: people juggling agent apps. Message:
Unleashd brings that work into channels, with a choice of harness and an open-source
app they can run and change. Primary destination: launch post and product page.

## Deliverables

1. Required: one complete 16:9 launch master, approximately 80–85 seconds, readable
   without audio, using the existing motion, footage and synthesized score.
2. Recommended after the master: one 20–30-second social cut derived from it;
   reframe as 9:16 where needed. Lead with a real request and its result, then the
   picker and CTA. This is a derivative, not another production or launch blocker.
3. Existing design-review, multimedia and picker clips remain reusable feature
   demos. No separate manifesto film or additional walkthrough is needed to launch.

## Story and the ethos line

Overload → one workspace → real work/results → harness choice → ownership → CTA.
The ethos replaces the older “Inspired by Vim / …for the future” close. It explains
why open source matters after the viewer has seen the product.

Exact closing copy, split into two readable cards:

> Vim is open source and it's still here decades later.
>
> Agent software should be too.

Allow roughly 7–8 seconds, then the Unleashd wordmark and existing CTA. The current
Vim slot is only 3.75 seconds; inserting the sentence without retiming would rush
it. Recover the extra time by removing the repeated Free / Open Source title
stack later in the film: the owner-requested post-intro benefits already say both.
Keep the privacy/local-running point with its real app proof. Retiming the music
is part of this change. This is an edit recommendation, not yet implemented.

## Timeline (as built 2026-09-30)

Owner, 2026-09-30 (`post_01a0ee26-b3f1-7506-8ec1-51273329235a` thread): open source is "just github
and a fork real quick"; keep repeating the benefits "to close out and sell"; place the Vim line.
The terminal clone/run card and the mid-film Free / Private / Open Source stack are gone; the
benefits now return as the recap before the end card. The EDM cue (`sound/edm.py` FULL_CUE) was
retimed to match: 67.0 s, `edm-build.wav` unchanged (byte-identical).

| Time (s) | Bars | Section |
|---|---|---|
| 0–18.0 | — | Overload and title |
| 18.0–23.6 | — | Four benefits over home |
| 23.6–33.0 | 1–5 | Native multimedia (build, drop) |
| 33.0–44.3 | 6–11 | Design review |
| 44.3–49.9 | 12–14 | Short design iteration |
| 49.9–55.5 | 15–17 | Swarm / memory / chat / phone flashes |
| 55.5–70.5 | 18–25 | "Multi harness" (on the hit), picker, subscriptions |
| 70.5–74.3 | 26–27 | GitHub page, push-in, Fork click, "Fork it." |
| 74.3–76.1 | 28 | Run it on your computer (localhost capture, 2026-09-30) |
| 76.1–83.6 | 29–32 | Breakdown: "Vim is open source / and it's still here decades later." then "Agent software / should be too." |
| 83.6–87.4 | 33–34 | Hit: Multi harness! Free! Private! Open Source! Customizable! |
| 87.4–90.6 | 35 | End card |

## Remaining work, in order

1. Owner review of the full master (`edit/out/assembly.mp4`).
2. Before publishing: re-capture the GitHub still once the repo's About text is updated (it still
   says "swarm orchestrator") and CI on the latest commit is green.
3. Check the September 26 swarm, memory, chat and design shots against the shipping UI.
4. Privacy pass on every frame (unblurred openings of product clips, workspace names on the home
   shot and the localhost shot).
5. Export the approved master, thumbnail and optional 20–30 s social cut. Publishing requires
   separate owner approval.

## Sources

- `../UNLEASHD_2_0_LAUNCH_2026-09-26.md` — historical kickoff script.
- `edit/src/Assembly.tsx`, `Close.tsx`, `FeatureFlash.tsx` — current source timeline.
- `edit/POST_INTRO_2026-09-27.md` — latest inserts and capture provenance.
- `clips/CLIPS.md`, `footage/FOOTAGE.md` — clip bank and privacy notes.
- `brand/PROJECT_ETHOS.md` — exact owner-approved ethos.
- #unleashd-2 threads `post_b4c4e4bd-9c32-4306-84fe-c1b7b6987a24`,
  `post_8b3f5688-be29-41be-baf4-a5058775cc17`,
  `post_62a6fa1c-c73c-4873-8cdd-ad7b2a9ff004`.
