# Color System Reference

## Architecture

Two layers. No more, no less.

```
PALETTE TOKENS (14, set by JS)     →     DERIVED + SEMANTIC (~60, CSS computes via color-mix)
--theme-bg-canvas, --theme-user, ...     --bg-card, --user-dim, --accent-user, ...
```

**Components use ONLY derived/semantic tokens.** Never `--theme-*` directly.

See `docs/color_palette_redesign.md` for the full debate, rationale, and implementation plan.

---

## Palette Tokens (14 values per theme)

These are the ONLY values `applyPalette()` sets. CSS derives everything else.

| Token | Solarized | OKSolar | Slot Purpose |
|-------|-----------|---------|-------------|
| `--theme-bg-canvas` | `#002b36` | `#002d38` | Darkest background |
| `--theme-bg-surface` | `#073642` | `#093946` | Surface / raised bg |
| `--theme-text-muted` | `#586e75` | `#5b7279` | Muted text |
| `--theme-text-subtle` | `#657b83` | `#657377` | Secondary text |
| `--theme-text-body` | `#839496` | `#98a8a8` | Primary text |
| `--theme-text-bright` | `#93a1a1` | `#8faaab` | Emphasis text |
| `--theme-warning` | `#b58900` | `#ac8300` | Accent: warning |
| `--theme-queue` | `#cb4b16` | `#d56500` | Accent: queue/pending |
| `--theme-danger` | `#dc322f` | `#f23749` | Accent: error |
| `--theme-meta` | `#d33682` | `#dd459d` | Accent: loop |
| `--theme-primary` | `#6c71c4` | `#7d80d1` | Accent: primary UI |
| `--theme-user` | `#268bd2` | `#2b90d8` | Accent: user |
| `--theme-ai` | `#2aa198` | `#259d94` | Accent: assistant |
| `--theme-success` | `#859900` | `#819500` | Accent: success/active |

### OKSolar Difference

OKSolar normalizes all 8 accent colors to equal OKLCh lightness (63.1%). Solarized accents range from L=58 (orange) to L=65 (yellow), causing uneven perceived brightness. OKSolar fixes this while preserving hues.

---

## Derived Tokens (CSS computes these)

### Accent Families: 4 variants per color

| Variant | CSS Formula | Purpose |
|---------|------------|---------|
| `--{color}` | `var(--theme-{color})` | Base accent |
| `--{color}-dim` | `color-mix(in oklch, var(--theme-{color}) 65%, black)` | Disabled, subtle |
| `--{color}-bright` | `color-mix(in oklch, var(--theme-{color}) 75%, white)` | Hover, emphasis |
| `--{color}-glow` | `color-mix(in srgb, var(--theme-{color}) 22%, transparent)` | Glow/halo overlay |

8 colors x 4 variants = 32 derived accent tokens.

### Background Elevation

Derived from `--theme-bg-canvas` and `--theme-bg-surface` via `color-mix()`:

| Token | Semantic Use |
|-------|-------------|
| `--bg-darkest` | Overlay backdrop |
| `--bg-base` | Page background |
| `--bg-content` | Content area (= bgCanvas) |
| `--bg-card` | Cards, list items |
| `--bg-sidebar` | Sidebar |
| `--bg-panel` | Panels (= bgSurface) |
| `--bg-hover` | Hover states |
| `--bg-active` | Active/selected |
| `--bg-popup` | Popups, dropdowns |
| `--bg-highlight` | Focus rings |

### Text Scale

| Token | Source |
|-------|--------|
| `--text-muted` | `var(--theme-text-muted)` |
| `--text-secondary` | `var(--theme-text-subtle)` |
| `--text-primary` | `var(--theme-text-body)` |
| `--text-emphasis` | `var(--theme-text-bright)` |
| `--text-bright` | `color-mix(in oklch, var(--theme-text-bright) 70%, white)` |
| `--text-on-accent` | `color-mix(in oklch, var(--theme-bg-canvas) 90%, black)` |

### Borders

All derived from `--theme-text-bright` at varying alpha via `color-mix(in srgb, ... N%, transparent)`.

### Message Backgrounds

Derived from accent + background: `color-mix(in oklch, accent 8%, bg-content)`.

### Semantic Accent Mappings

| Token | Maps To | Purpose |
|-------|---------|---------|
| `--accent-primary` | `var(--primary)` | Buttons, focus |
| `--accent-primary-hover` | `var(--primary-bright)` | Button hover |
| `--accent-user` | `var(--user)` | User messages |
| `--accent-assistant` | `var(--ai)` | Assistant messages |
| `--accent-success` | `var(--ai)` | Success states |
| `--accent-warning` | `var(--warning)` | Warnings |
| `--accent-error` | `var(--danger)` | Errors |
| `--accent-queue` | `var(--queue)` | Queue/pending |
| `--accent-loop` | `var(--meta)` | Loop mode |

---

## Rules

1. **No hardcoded hex in component CSS.** Use variables. Always.
2. **Components use semantic tokens**, not palette tokens. `var(--accent-error)`, not `var(--theme-danger)`.
3. **For alpha/tint overlays**, use `color-mix(in srgb, var(--color) N%, transparent)`. Never `rgba(R,G,B,a)` with magic numbers.
4. **Text on colored backgrounds** uses `var(--text-on-accent)`, not `#fff`.
5. **Adding a new palette:** Create a `Palette16` object with 14 hex values. CSS derives the rest.
6. **Adding a new accent:** Add `--theme-{name}` token + 4 `color-mix()` derivations in `:root`. Map it to a `--accent-*` semantic token.

---

## AI Palette Generation

`POST /api/generate-palette` with `{ description: string }`.

Claude returns 14 hex values matching the `Palette16` shape. Server validates:
- All keys present, valid `#RRGGBB`
- Base ramp is monotonic (bgCanvas darkest, textBright lightest)
- Accent contrast vs bgCanvas >= 4.5:1 (WCAG AA)
- No duplicate colors
- Accents perceptually distinct (deltaE >= 15)

Client applies via `applyPalette()`. CSS derives the full system.

---

## Token Count

| Category | Count | How |
|----------|-------|-----|
| Palette tokens | 14 | Set by JS |
| Accent families | 32 | CSS `color-mix()` from palette |
| Background scale | 10 | CSS `color-mix()` from palette |
| Text scale | 6 | Direct + CSS `color-mix()` |
| Borders | 5 | CSS `color-mix()` from palette |
| Semantic accents | 9 | CSS `var()` aliases |
| Message backgrounds | 4 | CSS `color-mix()` from accents |
| Code styling | 3 | CSS `var()` aliases |
| **Total** | **~83** | **14 set, ~69 derived** |
