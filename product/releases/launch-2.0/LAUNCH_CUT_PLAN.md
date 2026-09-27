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

## Existing timeline audit

Times rounded from the current Assembly.tsx frame schedule (60 fps).

| Current time | Section | Evidence / state |
|---|---|---|
| 0–18.0 | Overload and title | Render exists; intro voice line unresolved |
| 18.0–23.6 | Four benefits over home | September 27 review render exists |
| 23.6–33.0 | Native multimedia | Cut and sound exist |
| 33.0–44.3 | Design review | Rough cut 4 exists |
| 44.3–49.9 | Short design iteration | Short version wired in source; long standalone render exists |
| 49.9–55.5 | Swarm / memory / chat / phone flashes | First three source files exist; phone source missing |
| 55.5–59.3 | Free / Private / Open Source | Built in source; duplicates early benefits in part |
| 59.3–74.3 | Harness slide / refreshed picker / subscriptions | Slides and refreshed picker exports exist |
| 74.3–78.0 | Fork / run locally | Built in source; localhost app source missing |
| 78.0–81.8 | Older Vim wording | Built in source; saved ethos not yet inserted |
| 81.8–85.0 | End card | Built in source |

The original 45–60-second estimate is stale. `out/assembly-rough-1.mp4` predates the
latest additions. `out/post-intro-review.mp4` is a 33-second section review, not a
finished master. File presence/source inspection is not a fresh visual approval.

## Remaining work, in order

1. Capture the two missing shots from the running app: phone-width channel →
   thread (for `2026-09-26_feature_phone.mp4`), and a clean local app view with the
   genuine localhost context (for `2026-09-26_feature_app.mp4`). Designer can record
   these; no new owner take is needed.
2. Check the September 26 swarm, memory, chat and design shots against the shipping
   UI and claims. The picker has already been refreshed. Replace stale visible UI
   where necessary; verify that the swarm shot actually supports “running swarm.”
3. Make the closing copy/timing change above; consolidate duplicated claims. Keep
   the owner's four immediate post-intro benefits. Recommend on-screen text for
   “Don't worry, we've got you covered” so voice recording is not a dependency.
   Voice remains an owner preference, not an asset we already have.
4. Verify the fork/install command and launch URL against the current README;
   distinguish the free app from any provider subscription costs in the close.
5. Render one complete master and review the actual film end to end: readable type,
   shot continuity, music joins, truthful elapsed-time chips and privacy on every
   frame. Known exposure windows include the unblurred openings of product clips
   and visible workspace names on the new home shot.
6. Post that single full draft for owner review; then export the approved master,
   thumbnail and optional short cut. Publishing requires separate owner approval.

Done means a complete export with no missing media, the agreed copy, checked
privacy/audio, and owner review. Choosing the software release commit and shipping
the package remain the release team's separate task.

## Sources

- `../UNLEASHD_2_0_LAUNCH_2026-09-26.md` — historical kickoff script.
- `edit/src/Assembly.tsx`, `Close.tsx`, `FeatureFlash.tsx` — current source timeline.
- `edit/POST_INTRO_2026-09-27.md` — latest inserts and capture provenance.
- `clips/CLIPS.md`, `footage/FOOTAGE.md` — clip bank and privacy notes.
- `brand/PROJECT_ETHOS.md` — exact owner-approved ethos.
- #unleashd-2 threads `post_b4c4e4bd-9c32-4306-84fe-c1b7b6987a24`,
  `post_8b3f5688-be29-41be-baf4-a5058775cc17`,
  `post_62a6fa1c-c73c-4873-8cdd-ad7b2a9ff004`.
