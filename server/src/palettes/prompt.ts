export function buildPalettePrompt(description: string): string {
  // Example palettes spanning both polarities so the AI has references for dark AND light
  const examplePalettes = `
Here are 6 example palettes from our library for reference. Keys are semantic roles, not literal colors.
The system supports BOTH dark and light palettes — the UI auto-adapts based on bgCanvas luminance.

DARK EXAMPLES (bgCanvas is darkest, text is light):

Solarized Dark:
{"name":"Solarized Dark","bgCanvas":"#002b36","bgSurface":"#073642","textMuted":"#586e75","textSubtle":"#657b83","textBody":"#839496","textBright":"#93a1a1","primary":"#6c71c4","user":"#268bd2","ai":"#2aa198","success":"#859900","warning":"#b58900","queue":"#cb4b16","danger":"#dc322f","meta":"#d33682"}

Tokyo Night:
{"name":"Tokyo Night","bgCanvas":"#1a1b26","bgSurface":"#24283b","textMuted":"#414868","textSubtle":"#565f89","textBody":"#a9b1d6","textBright":"#c0caf5","primary":"#7aa2f7","user":"#7dcfff","ai":"#7dcfff","success":"#9ece6a","warning":"#e0af68","queue":"#ff9e64","danger":"#f7768e","meta":"#bb9af7"}

Catppuccin Mocha:
{"name":"Catppuccin Mocha","bgCanvas":"#1e1e2e","bgSurface":"#313244","textMuted":"#45475a","textSubtle":"#6c7086","textBody":"#cdd6f4","textBright":"#bac2de","primary":"#89b4fa","user":"#89dceb","ai":"#94e2d5","success":"#a6e3a1","warning":"#f9e2af","queue":"#fab387","danger":"#f38ba8","meta":"#cba6f7"}

LIGHT EXAMPLES (bgCanvas is lightest, text is dark):

Solarized Light:
{"name":"Solarized Light","bgCanvas":"#fdf6e3","bgSurface":"#eee8d5","textMuted":"#93a1a1","textSubtle":"#839496","textBody":"#586e75","textBright":"#073642","primary":"#6c71c4","user":"#268bd2","ai":"#2aa198","success":"#859900","warning":"#b58900","queue":"#cb4b16","danger":"#dc322f","meta":"#d33682"}

Catppuccin Latte:
{"name":"Catppuccin Latte","bgCanvas":"#eff1f5","bgSurface":"#e6e9ef","textMuted":"#9ca0b0","textSubtle":"#7c7f93","textBody":"#4c4f69","textBright":"#303446","primary":"#7287fd","user":"#209fb5","ai":"#179299","success":"#40a02b","warning":"#df8e1d","queue":"#fe640b","danger":"#d20f39","meta":"#8839ef"}

GitHub Light:
{"name":"GitHub Light","bgCanvas":"#ffffff","bgSurface":"#f6f8fa","textMuted":"#8b949e","textSubtle":"#656d76","textBody":"#1f2328","textBright":"#0d1117","primary":"#0969da","user":"#0550ae","ai":"#1a7f37","success":"#1a7f37","warning":"#9a6700","queue":"#bc4c00","danger":"#cf222e","meta":"#8250df"}`;

  // Detect polarity and expressiveness from the description.
  // The palette system is polarity-agnostic — this only steers the prompt
  // so the LLM generates appropriate luminance ordering and contrast.
  const lightKeywords =
    /\blight\b|\bbright\b|\bpastel\b|\bwhite\b|\bcream\b|\blatte\b|\bday\b|\bsnow\b|\bpaper\b|\bchalk\b|\bmorning\b/i;
  const wildKeywords =
    /\brainbow\b|\bneon\b|\bchaos\b|\bwild\b|\bcrazy\b|\bfun\b|\bvaporwave\b|\bpsychedelic\b|\bglitch\b|\bacid\b|\bfunky\b|\bparty\b|\bmatrix\b|\bcyberpunk\b|\bretro\b|\b80s\b|\b90s\b|\bunreadable\b/i;
  const isLightRequest = lightKeywords.test(description);
  const isWildRequest = wildKeywords.test(description);

  const prompt = `Design a 14-token semantic color palette for a code editor UI based on this description: "${description.trim()}"
${examplePalettes}

## Color theory guidelines for healthy palettes

These are the default principles for producing readable, balanced palettes.
Apply them unless the user's description explicitly asks for something expressive or extreme.

STRUCTURAL TONES (bgCanvas, bgSurface, textMuted, textSubtle, textBody, textBright):
- These 6 values form a luminance ramp from background to foreground.
- bgCanvas and bgSurface should be close in luminance (delta ~5-10%) for subtle elevation.
- textMuted through textBright should span a wider range for clear hierarchy.
- The ramp should feel even — no large jumps between adjacent steps.

INTENT COLORS (primary, user, ai, success, warning, queue, danger, meta):
- Distribute accents around the hue wheel for maximum distinctness.
  Good starting points: split-complementary, triadic, or tetradic harmony.
- Keep all 8 accents at roughly equal perceived lightness (OKLCH L* ~0.65-0.75 for dark mode, ~0.45-0.55 for light mode).
  This prevents some accents from visually dominating others.
- Saturation should be moderate-high (OKLCH C ~0.12-0.18). Too low = muddy. Too high = fatiguing.
- For monochromatic/analogous themes (e.g. "forest", "ocean"), vary hue within a 60-90° arc
  and use saturation + lightness shifts to maintain distinctness.

LIGHT vs DARK:
- Dark palettes: cool-tinted canvas (blue, teal, purple undertones) reduces eye strain.
  Warm accents pop more against cool backgrounds.
- Light palettes: warm-tinted canvas (cream, ivory, warm gray) feels softer than pure white.
  Use medium-saturated accents (not washed-out pastels) — they need contrast against the light bg.
- In both modes, bgCanvas ↔ textBright should have >= 7:1 contrast ratio (WCAG AAA for body text).
  Intent accents against bgCanvas should be >= 4.5:1 (WCAG AA).

${
  isWildRequest
    ? `## CREATIVE MODE — rules are suggestions, not constraints

The user is asking for something expressive, fun, or extreme. Lean into it hard:
- Colored/tinted backgrounds are encouraged (neon green canvas, deep purple, hot pink — whatever fits).
- Accents can clash, oversaturate, or cluster in hue if that serves the vibe.
- Luminance ramps can be compressed (low contrast) or blown out (extreme contrast).
- Readability is secondary to aesthetics — the user knows what they're asking for.
- bgCanvas can be ANY color. bgSurface should still be visually distinguishable from it.
- Have fun. Be bold. If "rainbow" is requested, actually use the full spectrum, not pastel approximations.
- The only hard rule: all 14 values must be valid #RRGGBB hex and all 8 accents should be visually
  distinguishable from each other (even if they're all neon).`
    : ''
}
You MUST respond with ONLY a JSON object (no markdown, no explanation) with exactly these 15 keys:
{
  "name": "Palette Name",
  "bgCanvas": "#hex",
  "bgSurface": "#hex",
  "textMuted": "#hex",
  "textSubtle": "#hex",
  "textBody": "#hex",
  "textBright": "#hex",
  "primary": "#hex",
  "user": "#hex",
  "ai": "#hex",
  "success": "#hex",
  "warning": "#hex",
  "queue": "#hex",
  "danger": "#hex",
  "meta": "#hex"
}

Requirements:
- All values must be valid #RRGGBB hex strings.
- bgCanvas is the outermost background. bgSurface is the surface/card background (one step toward text).
- textMuted = muted/comment text. textSubtle = secondary text. textBody = primary body text. textBright = emphasis text.
${
  isLightRequest
    ? `- LIGHT MODE: bgCanvas should be the lightest value. bgSurface slightly darker.
- Monotonic luminance: bgCanvas (lightest) > bgSurface > textMuted > textSubtle > textBody >= textBright (darkest).
- Intent colors should have good contrast (WCAG AA, >= 4.5:1) against the LIGHT bgCanvas background.
  For pastels/light palettes, use medium-saturated accent colors (not washed-out pastels) so text remains readable.
- bgCanvas should be very light (white, cream, or pale tint).`
    : `- DARK MODE: bgCanvas should be the darkest value. bgSurface slightly lighter.
- Monotonic luminance: bgCanvas (darkest) < bgSurface < textMuted < textSubtle < textBody <= textBright (lightest).
- Intent colors should have good contrast (WCAG AA, >= 4.5:1) against the DARK bgCanvas background.
- bgCanvas should be very dark (suitable for long coding sessions).`
}
- The 8 intent colors (primary, user, ai, success, warning, queue, danger, meta) should be visually distinct.`;
  return prompt;
}
