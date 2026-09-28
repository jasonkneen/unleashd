# iOS keyboard shell stability — 2026-09-28

Owner report: focusing and leaving a mobile composer could leave the whole app in a half-expanded, keyboard-sized layout. The shell was listening to `visualViewport` through `useKeyboardInset`, changing its height while `FullscreenComposer` independently sized a fixed frame to the visual viewport. During dismissal those two paths could disagree.

Fix: remove shell-level keyboard geometry and keep `.mobile-shell` on the stable layout viewport (`100dvh`, with the existing `svh`/`vh` fallbacks). `FullscreenComposer` remains the only owner of visual-viewport sizing while editing; the tab bar is hidden by the expanded composer state and returns on blur.

Browser evidence (Playwright CLI, generic mobile viewport 360×732, live dev server):

- closed: shell 732px; composer frame is inline; tab bar visible
- focused: shell remains 732px; composer frame is fixed at 360×732; tab bar display is `none`
- blurred: shell remains 732px; composer frame returns inline; tab bar display is `flex`; document `overflow` is restored

The client test suite also has an unrelated pre-existing failure in `client/test/channel-browser.test.tsx` at the Search assertion (expected visible `Search`, current render has the icon-only trigger). Invariants and typecheck passed.
