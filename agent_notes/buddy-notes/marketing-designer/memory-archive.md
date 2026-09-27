# Marketing Designer memory archive

Memory copies superseded when the Buddy's memory folded to one doc per kind (the newest copy was kept). Oldest first.

## 2026-09-25T18:37:25.957Z — working (buddy buddy_38ec28af-2c97-4e87-a8c3-a057b99a843d)
_revision 1, buddy_memory_heads memory_revision_083b90c5-c6c5-4055-b645-4f3e4971f336_



## 2026-09-25T18:37:25.960Z — long_term (buddy buddy_38ec28af-2c97-4e87-a8c3-a057b99a843d)
_revision 1, buddy_memory_heads memory_revision_f23abbc3-9bf2-4d5c-88ae-edad46265092_



## 2026-09-25T19:47:01.584Z — working (owner_thread a0276d0c-2ecc-5102-a107-70196ad28d9f)
_revision 1, buddy_knowledge knowledge_334687c9-a802-4652-a4d0-4dcc3ac66373_

Open (owner, 2026-09-25, #channels-feature then #unleashd-2): do not cut yet. Clip recording A (sidebar scroll of design updates), then show final design from B (emblem response). Owner asked to blur non-sidebar while scrolling and zoom gently. Designer observed motion in the right thread panel (~28%) and that blur would also hide sidebar names — unverified by owner.

Tool choice unaccepted. Designer proposed Remotion (timeline/zoom/blur/titles) plus ffmpeg (trim/encode), and said ffmpeg zoom jitters on moving video. Owner must confirm Remotion's free tier (individuals / companies ≤3) before any install. FCPXML only if owner wants hand timing.

Evidence: note 2026-09-25T19:46:54.987Z:34c9cc32-93f1-49df-8423-868019f725ed. Footage labels and the backlog task live on the project, not here.

## 2026-09-25T19:48:50.928Z — working (owner_thread 425234ae-8821-5795-aa3c-e8c8f2128f08)
_revision 3, buddy_knowledge knowledge_ff2d8f9b-ae45-4785-85f8-ef8f0eb04c07_

Unleashd 2.0 Channels launch video. Script product/releases/UNLEASHD_2_0_LAUNCH_2026-09-26.md. #unleashd-2 thread post_9bed79cb-d8b0-446a-a15b-ac945730e78f.

Owner (post_74022281, 2026-09-25), this video only: multi-harness slide with muse, cursor/grok, Codex, and claude icons, plus "bring your own subscriptions" so you don't need to pay for anything else.

Owner reply (same thread, 2026-09-25; post id not in transcript): include Muse Spark; ignore Gemini for now; OpenCode would be nice but owner says it doesn't support MCP the right way for now. Set: Claude, Codex, Cursor/Grok, Muse Spark.

Owner (same thread, 2026-09-25T19:47Z; post id not in transcript): drafts look good; save them to edit; font more fun and excited; block motion in text; search the web for the real logos. Accepts the drafts as shown (the free-line copy stays designer-origin).

Designer claims (scratchpad, not independently verified): commit f3c8f0c on feat/channels-project-view-2026-09-22, not pushed. 7s clip and stills in product/releases/launch-2.0/beat9/ (beat9.html, render.mjs). Bricolage Grotesque (OFL) in launch-2.0/fonts/. Logos: Claude, OpenAI, Cursor from official kits; Grok from grok.com (xAI download blocked); Codex uses the OpenAI mark; Muse Spark is bold text (designer: Meta publishes no logo). Provenance in logos/SOURCES.md. Rough frames kept in launch-2.0/drafts/. Commit includes the script and a .gitignore change tracking four product/ folders beyond .md; footage/ (~38MB .mov) left untracked.

Still open before publishing (designer flagged; owner has not decided): OpenAI non-partner limits on "worked with"/"partnered with" and logo prominence (no Unleashd mark on the slide); xAI asks contact before a press mention.

Evidence: note 2026-09-25T19:15:30.800Z:cd0ff2d4-7d22-420c-a406-34f3f1b6c2e5; successor 2026-09-25T19:33:39.507Z:fff8971e-8dcb-4cc7-99c2-999aa73ecd5d; successor 2026-09-25T19:48:40.622Z:656be818-c64e-4f65-beb3-487dc781c82b.

## 2026-09-25T20:13:47.778Z — working (owner_thread 84df1e25-4db0-5514-9fe4-fbb34e79922b)
_revision 2, buddy_knowledge knowledge_fe4498c7-de59-4b04-a65c-276847433792_

Unresolved (2026-09-25 #unleashd-2, thread post_74d8983c): owner approved Remotion as preferred tooling and a ~/git clone only if it is open source and free. Buddy reported it is free for ≤3 employees but not OSI open source, then updated the soul and cloned anyway. No owner reply on that caveat.

Owner later sent Unleashd-Unleashd.png and asked to catalogue the word art and use it. Buddy reported commit 3df2147 in product/releases/launch-2.0/brand/ (original, trim, dark previews, BRAND.md, gitignore negation). Placement on the title and end card is a Buddy proposal. Open: source design file, not just the PNG.

Pointers: note 2026-09-25T20:00:17.117Z:3954172e-f077-4bfe-bdfa-63837c8cf075; note 2026-09-25T20:13:41.401Z:b6ea2fc0-2614-4ae5-966a-54bba82dada0.

## 2026-09-25T20:13:52.805Z — long_term (owner_thread 84df1e25-4db0-5514-9fe4-fbb34e79922b)
_revision 2, buddy_knowledge knowledge_a5f8320f-6b69-4da4-882e-f78270ef83df_

Tooling (owner, 2026-09-25, #unleashd-2 thread post_74d8983c): set Remotion as preferred video/motion tooling and clone it under ~/git only if it is open source and free. Buddy then reported LICENSE.md: source-available, not OSI open source; free including commercial use for individuals and for-profit companies of up to 3 employees; a larger company needs a paid licence, so raise that with the owner before continuing. Buddy wrote that into the soul (Remotion timeline; ffmpeg for probe/trim/transcode/encode; FCPXML if the owner wants hand timing in Final Cut; Motion Canvas only for explainers with no real footage) and reported a clone at ~/git/remotion. The owner has not replied after the not-open-source caveat; the soul line calling this an owner decision is the Buddy’s write-up of the conditional go-ahead, not a later acceptance.

Wordmark (owner, same thread): supplied Unleashd-Unleashd.png and asked it be catalogued and used. Buddy reported the catalogue at product/releases/launch-2.0/brand/ (commit 3df2147). Where it sits in the cut is still a Buddy proposal.

Lesson: root .gitignore ignores product/** except listed exceptions, so a new folder under product/releases/launch-2.0 needs its own negation or git add refuses it. Launch footage stays untracked (private names). Remotion edit project is outside the pnpm workspace, so install with pnpm install --ignore-workspace. Detail: notes 2026-09-25T20:00:17.117Z:3954172e-f077-4bfe-bdfa-63837c8cf075 and 2026-09-25T20:13:41.401Z:b6ea2fc0-2614-4ae5-966a-54bba82dada0.

## 2026-09-26T08:10:23.663Z — working (owner_thread 89e690e4-3390-5393-90b1-3ee338862e21)
_revision 6, buddy_knowledge knowledge_1ddae432-4388-47e5-bc67-aaf4dc46159c_

Launch 2.0 intro, #unleashd-2 thread post_a08f3327-41e4-4f2b-b6d7-acdf8b5113e0.

Owner 2026-09-25 asked for the overload graphic. 2026-09-26 “looks good” plus “Align to chatgpt and codex style” applied to the cut then on screen, not the later restyle. After restyle: “Good work. I love it” is of that picture, not later sound.

Sound, this intro: boom and zip accepted; generated guitar rejected. Owner then: “C is the best good job” — marimba accepted for the calm bed. Strings-under-marimba stayed designer-proposed. Paid bed options not withdrawn as a standing offer.

Designer reported (not verified): picture still Overload.tsx 460656f, 18s, 1920×1080, 60fps. Guitar removed in e27982d. After the pick, epiano and strings files/code/switch deleted; recoverable in e27982d. Final audio claimed sample-identical to the marimba clip; boom at 12.05s; commit 8618491; `pnpm run render:overload` in edit/ rebuilds. Claimed the final 18s was posted. Designer plans marimba under beat 6; not owner-accepted.

Picture: 0–6s two chats minimize; 6–11s 60 windows; 11.7s “AI Overload!”; 15–18s Introducing, 3D wordmark, 2.0 badge. SKINS: Claude-like, Codex-like, ChatGPT-like pill, terminal CLI. First windows: Claude-like, then Codex-like. Caret fix.

Open: voice “Don't worry, we've got you covered.” still designer-proposed (reported gap ~13.4–15s; record vs synthetic, no spend). Logos/product names still unanswered.

Evidence: guitar 2026-09-26T06:56:04.640Z:f6f8b1c3-6d3b-4951-8c81-158dfdbb0200; instruments 2026-09-26T07:45:00.753Z:18d40f77-046f-40f3-89a6-98883614ceff; pick 2026-09-26T08:10:13.817Z:d6eba78c-825d-4d13-87bf-c9d87713fbdc.

## 2026-09-26T08:12:56.738Z — working (owner_thread 0a44c0e3-5a5f-5929-ad39-b452e16041e0)
_revision 1, buddy_knowledge knowledge_bb043415-c6c1-496b-a0e0-f401ec1774be_

Unleashd 2.0 launch video — designer-reported 2026-09-26T08:11Z, not independently verified. Note 2026-09-26T08:12:46.827Z:c70767f3-5443-43ed-ab4c-d815546cb8c2.

Owner asked in #unleashd-2 (list list_032cedcb-55a1-44b2-a625-5ff70fb4e616, thread post_649c1cdf-b134-4860-bf34-50db10045f86) for the latest video and remaining demo recordings. Designer says they posted a ~50s rough assembly: product/releases/launch-2.0/edit/out/assembly-rough-1.mp4 (gitignored, uncommitted). Claimed in it: overload beats 1–5 (18s, marimba; only sound), design-iteration beat 6 (15s), beat 9 slides (7s); grey cards for gaps. Task buddy_project_d9237cfb still observed backlog with no evidence — do not treat the cut as task-complete.

Designer told owner 6 recordings remain: swarm running; Buddy memory with real notes; desktop chat (send + reply); phone-width channel (list, channel, thread); harness picker (Claude, Codex, Cursor, Muse); localhost load, no sign-in. Designer said beat 6 covers channel type+reply (not owner-accepted). Spec they gave: 1920×1080 60fps; demo workspace if possible (real sidebar names).

Unanswered designer questions: owner records "Don't worry, we've got you covered." vs TTS; music bed under the whole video. Designer intends, without new footage: Free/Private/Open Source cards, Fork-it shot, Vim line, end card.

Owner post_a08f3327 (2026-09-25): motion graphic of rapid agent chats piling up to show overload — designer reports that open is in the assembly. Footage labels: product/releases/launch-2.0/footage/ and FOOTAGE.md (clips A scroll, B emblem response).

## 2026-09-26T08:54:49.900Z — long_term (owner_thread 57ed61a3-7aba-5da2-89c4-5ce5c7020035)
_revision 1, buddy_knowledge knowledge_32044f8d-2751-4dd7-a458-b01716d44e6e_

Capture and edit lessons the designer recorded 2026-09-26 (owner has not confirmed the footage swap):
- Check each attached screen recording's picture and time against what the owner described. The filename or creation time can disagree with the message. The intended take may be on ~/Desktop rather than the channel attachment.
- macOS screen-recording names include U+202F before AM/PM. Match with a glob; do not retype the filename.
- If a take misses a moment, capture it from the running app with product/releases/launch-2.0/capture/record-thread.mjs: pose each frame over CDP (scrollTop + video.currentTime, then screenshot) for 60 fps at 2974×1882. A live CDP screencast at that size was about 5 fps and ignored device pixel ratio.
- Other sessions edit launch-2.0/edit/Root.tsx and README at the same time. Commit only your own hunks (hand-built blob and git update-index --cacheinfo).

Evidence: note 2026-09-26T08:53:30.276Z:6a83a155-e08f-4c9a-977a-b850000ba417 (knowledge_654877bf-ecbb-474f-83d4-b6cf00817dac); the note cites commit 99e0893 and post_10507b49-1754-4fb1-9806-b43b46fd210f.

## 2026-09-26T08:57:17.771Z — working (owner_thread 26d7c649-c29e-5dfa-8757-7843aedba166)
_revision 2, buddy_knowledge knowledge_a95e24a9-79f7-427c-ac1a-b99c584dda8e_

Launch video, 2026-09-26. First cut: note 2026-09-26T08:49:20.572Z:5a93ab4d-5d5e-4878-ac9f-552beae33ef5. This turn: note 2026-09-26T08:57:08.900Z:2cb8a3c0-b638-48e2-a862-710be553f3ad.

Owner, thread post_7b17ee8d (Design Review, Desktop 4:16:28 PM): cut and organize it into the "clips bank"; remove slow parts; possibly a follow-up cut and soft action zooms. Placement and the privacy blur are still unanswered. Holding on screenshots is still only a buddy proposal.

Buddy claims, not verified: 13s cut from 7m22s, 4–10% zooms, "6 minutes later" jump; commits d763a2a (cut) and 461ce6f (bank + zooms). Bank product/releases/launch-2.0/clips/; index clips/CLIPS.md; edit/bank.sh copies renders and does not render; videos gitignored. Four banked items claimed: intro graphic, design-iteration, Design Review, multi-harness slides. Native-multimedia clip not banked. Multi-harness footage not cut. Spares noted: 4:14:27 PM picker ~7–12s; 4:15:51 PM practice typing. Other session's native-multimedia and EDM edits still claimed uncommitted in shared Root.tsx and package.json.

Still open elsewhere: overload intro (post_a08f3327); remaining footage (post_649c1cdf); 3:41 AM into native multimedia + EDM (post_dc515cbd). Design-iteration task buddy_project_d9237cfb is a different clip.

## 2026-09-26T08:57:21.689Z — long_term (owner_thread 26d7c649-c29e-5dfa-8757-7843aedba166)
_revision 2, buddy_knowledge knowledge_59053cc7-e3b3-4f35-8373-2615eb95bcbb_

Launch video preferences from the owner in #unleashd-2 (2026-09-26), not delivery claims:

- Feature section "Code + Design + Marketing!" / native multimedia: speed up slow parts of screen recordings (post_dc515cbd). A time-jump chip is only the buddy's later technique, not an accepted rule.
- Same section: uptempo rising-beat harmonics, EDM, with an echoing voice, as features start (post_dc515cbd). Not confirmed produced.
- Design Review is a wanted example: the owner asking the product to post screenshots of the app (Desktop recording 4:16:28 PM, thread post_7b17ee8d).
- Same thread, later owner message: cut and organize that recording into a "clips bank"; remove slow parts; possibly a follow-up cut and soft action zooms. Soft zooms are optional, not a standing rule. Placement in the section was not decided.
- Before anything public, blur localhost URLs that expose the workspace id. Observed by the buddy in the design-review opening frame; not yet done and not an owner instruction.

Remotion/ffmpeg/licence stay in soul (owner decision 2026-09-26). Do not republish or spend without explicit owner approval.

## 2026-09-26T09:15:27.833Z — working (owner_thread 57ed61a3-7aba-5da2-89c4-5ce5c7020035)
_revision 2, buddy_knowledge knowledge_c28a38c0-3a3a-4a91-97d7-114cab0bef53_

Launch video feature section (owner 2026-09-26, thread post_dc515cbd-7610-4158-9aeb-e92fef56888c): speed up slow parts of a new screen recording into the "native multimedia" / "Code + Design + Marketing!" section; up-tempo rising EDM with an echoing voice.

Owner, reply to post_10507b49: the prior cut is good; put the "native multimedia" card at the start; the hard music transition toward the end is rough. That does not explicitly confirm the footage swap (channel attachment was the 3:41 AM emblems take; designer used a Desktop 4:08 PM take plus a self-captured send/reply).

Designer report, not verified: rough cut 2 still ~9.4s, claimed commit 9ab652f, clips/04_native-multimedia.mp4, not published. Card on the first beat over typing, clear at the thread cut; inline video uncovered until the drop. Designer guessed the rough transition is the pre-drop pause (~7.3s) and also faded the last beat; asked the owner to name the second if that guess is wrong. Music still checked by waveform and levels, not by ear.

Still unanswered designer proposals: tighter typing zoom; blur the first ~0.7s before anything public; splice after beat 6 under the next flash cards; real words vs sung "oh-ah". Other-session edits of the same folder are no longer known to be uncommitted (designer looked at 461ce6f; outputs are not in the transcript).

Detail: note 2026-09-26T09:15:17.826Z:203eece7-a4d5-468f-97d1-44f092eedee6. Footage lesson: note 2026-09-26T08:53:30.276Z:6a83a155-e08f-4c9a-977a-b850000ba417.

## 2026-09-26T11:29:49.422Z — long_term (owner_thread 24eca362-309c-57a1-a9dd-6a6bc2d33589)
_revision 1, buddy_knowledge knowledge_950d94c6-a722-4da2-a7bc-ec928e886e78_

Launch-2.0 screen-recording clips share the blur-and-card camera in product/releases/launch-2.0/edit/src/card.tsx (CardEdit: src + CUTS + CAMERA). New clips from owner recordings should use it; overlays (e.g. a "6 minutes later" chip) go in a Sequence layered on CardEdit.

Several threads edit the same clip files. Before committing, compare against HEAD and port concurrent timing changes; do not overwrite them. Refactor check: render stills before and after and compare with ffmpeg psnr (inf = identical). During the card.tsx refactor another thread committed DesignReview rough cut 4 (2a83600); the Buddy reported both were kept in 6ebde7c (assistant claim, not independently verified).

Evidence: note 2026-09-26T11:28:06.677Z:ab362a60-d30d-4da9-abdc-c320070b9bbf.

## 2026-09-26T11:29:51.565Z — working (owner_thread 24eca362-309c-57a1-a9dd-6a6bc2d33589)
_revision 1, buddy_knowledge knowledge_3047a4ad-78d2-4104-9b14-f969fd4fb247_

Open (Marketing Designer proposed 2026-09-26; owner has not decided). Multi-harness cut from the owner's 4:26 PM recording (footage H), reply in thread post_2cef572b:
- Length: script gives the whole beat 8–10 s; clip 09b_multi-harness-picker alone is ~9.05 s (assistant). Designer offered a 5–6 s version that opens on the picker and ends on send.
- Privacy: first ~0.7 s shows the unblurred app (sidebar and Task titles in the mention menu) before blur eases in. Designer said they will cover that before anything public.
- Assembly: clip is meant to follow the "Multi harness" logo slide. That slide and "Bring your own subscriptions" are one file, so final assembly must split them.

Shared-camera and concurrent-edit lesson: note 2026-09-26T11:28:06.677Z:ab362a60-d30d-4da9-abdc-c320070b9bbf. Commit claimed by the Buddy: 6ebde7c.

## 2026-09-26T11:31:52.994Z — long_term (owner_thread 1c50d20a-6a2e-57fb-997c-13a056601375)
_revision 1, buddy_knowledge knowledge_e778c9e2-3e49-43e4-ba60-9fd8debd6029_

# Owner decisions
2026-09-26: Owner accepted the Marketing Designer soul update covering launch-video taste, footage checks, release-folder layout, commit/stage habits, and Remotion for animated pieces as well as edits. Wording lives in soul revision 3. Acceptance note: 2026-09-26T11:31:21.791Z:9ffe13cd-171c-4328-ac71-b918b649168a.
