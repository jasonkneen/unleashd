import { create } from 'zustand';

/**
 * 14-token palette. The only source of truth for a theme.
 * CSS derives all other tokens (~60+) from these 14 values via color-mix().
 *
 * Semantic key names decouple themes from literal color names, so a
 * monochromatic or analogous palette works without forcing "blue" or "magenta".
 *
 * Structural tones:
 *   bgCanvas = darkest bg, bgSurface = surface bg,
 *   textMuted = muted text, textSubtle = secondary text,
 *   textBody = primary text, textBright = emphasis text
 *
 * Intent colors:
 *   primary, user, ai, success, warning, queue, danger, meta
 */
export interface Palette16 {
  name: string;
  bgCanvas: string;
  bgSurface: string;
  textMuted: string;
  textSubtle: string;
  textBody: string;
  textBright: string;
  primary: string;
  user: string;
  ai: string;
  success: string;
  warning: string;
  queue: string;
  danger: string;
  meta: string;
}

// Built-in palettes mapped to Palette16 format
export const PALETTES: Record<string, Palette16> = {
  solarized: {
    name: 'Solarized Dark',
    bgCanvas: '#002b36',
    bgSurface: '#073642',
    textMuted: '#586e75',
    textSubtle: '#657b83',
    textBody: '#839496',
    textBright: '#93a1a1',
    primary: '#6c71c4',
    user: '#268bd2',
    ai: '#2aa198',
    success: '#859900',
    warning: '#b58900',
    queue: '#cb4b16',
    danger: '#dc322f',
    meta: '#d33682',
  },
  oksolar: {
    name: 'OKSolar Dark',
    bgCanvas: '#002d38',
    bgSurface: '#093946',
    textMuted: '#5b7279',
    textSubtle: '#657377',
    textBody: '#98a8a8',
    textBright: '#8faaab',
    primary: '#7d80d1',
    user: '#2b90d8',
    ai: '#259d94',
    success: '#819500',
    warning: '#ac8300',
    queue: '#d56500',
    danger: '#f23749',
    meta: '#dd459d',
  },
  nord: {
    name: 'Nord',
    bgCanvas: '#2e3440',
    bgSurface: '#3b4252',
    textMuted: '#4c566a',
    textSubtle: '#d8dee9',
    textBody: '#e5e9f0',
    textBright: '#eceff4',
    primary: '#5e81ac',
    user: '#81a1c1',
    ai: '#88c0d0',
    success: '#a3be8c',
    warning: '#ebcb8b',
    queue: '#d08770',
    danger: '#bf616a',
    meta: '#b48ead',
  },
  dracula: {
    name: 'Dracula',
    bgCanvas: '#282a36',
    bgSurface: '#44475a',
    textMuted: '#6272a4',
    textSubtle: '#bfbfbf',
    textBody: '#f8f8f2',
    textBright: '#ffffff',
    primary: '#bd93f9',
    user: '#8be9fd',
    ai: '#8be9fd',
    success: '#50fa7b',
    warning: '#f1fa8c',
    queue: '#ffb86c',
    danger: '#ff5555',
    meta: '#ff79c6',
  },
  monokai: {
    name: 'Monokai',
    bgCanvas: '#272822',
    bgSurface: '#3e3d32',
    textMuted: '#75715e',
    textSubtle: '#a6a086',
    textBody: '#f8f8f2',
    textBright: '#f8f8f0',
    primary: '#ae81ff',
    user: '#66d9ef',
    ai: '#66d9ef',
    success: '#a6e22e',
    warning: '#e6db74',
    queue: '#fd971f',
    danger: '#f92672',
    meta: '#f92672',
  },
  gruvbox: {
    name: 'Gruvbox Dark',
    bgCanvas: '#282828',
    bgSurface: '#3c3836',
    textMuted: '#504945',
    textSubtle: '#a89984',
    textBody: '#ebdbb2',
    textBright: '#fbf1c7',
    primary: '#d3869b',
    user: '#83a598',
    ai: '#8ec07c',
    success: '#b8bb26',
    warning: '#fabd2f',
    queue: '#fe8019',
    danger: '#fb4934',
    meta: '#d3869b',
  },
  tokyo: {
    name: 'Tokyo Night',
    bgCanvas: '#1a1b26',
    bgSurface: '#24283b',
    textMuted: '#414868',
    textSubtle: '#565f89',
    textBody: '#a9b1d6',
    textBright: '#c0caf5',
    primary: '#7aa2f7',
    user: '#7dcfff',
    ai: '#7dcfff',
    success: '#9ece6a',
    warning: '#e0af68',
    queue: '#ff9e64',
    danger: '#f7768e',
    meta: '#bb9af7',
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    bgCanvas: '#1e1e2e',
    bgSurface: '#313244',
    textMuted: '#45475a',
    textSubtle: '#6c7086',
    textBody: '#cdd6f4',
    textBright: '#bac2de',
    primary: '#89b4fa',
    user: '#89dceb',
    ai: '#94e2d5',
    success: '#a6e3a1',
    warning: '#f9e2af',
    queue: '#fab387',
    danger: '#f38ba8',
    meta: '#cba6f7',
  },
};

interface Settings {
  colorPalette: string; // Key into PALETTES or customPalettes
}

const DEFAULT_SETTINGS: Settings = {
  colorPalette: 'solarized',
};

/**
 * Apply a Palette16 to CSS by setting 14 --theme-* custom properties.
 * CSS color-mix() rules derive the remaining ~60 tokens automatically.
 *
 * Key-to-CSS-property mapping: each Palette16 key maps to --theme-{cssName}.
 * This array drives applyPalette() and must stay in sync with index.css :root.
 */
const PALETTE_KEYS: { key: keyof Omit<Palette16, 'name'>; css: string }[] = [
  { key: 'bgCanvas', css: 'bg-canvas' },
  { key: 'bgSurface', css: 'bg-surface' },
  { key: 'textMuted', css: 'text-muted' },
  { key: 'textSubtle', css: 'text-subtle' },
  { key: 'textBody', css: 'text-body' },
  { key: 'textBright', css: 'text-bright' },
  { key: 'primary', css: 'primary' },
  { key: 'user', css: 'user' },
  { key: 'ai', css: 'ai' },
  { key: 'success', css: 'success' },
  { key: 'warning', css: 'warning' },
  { key: 'queue', css: 'queue' },
  { key: 'danger', css: 'danger' },
  { key: 'meta', css: 'meta' },
];

export function applyPalette(palette: Palette16) {
  const root = document.documentElement;
  for (const { key, css } of PALETTE_KEYS) {
    root.style.setProperty(`--theme-${css}`, palette[key]);
  }
}

// =============================================================================
// Settings Store — Single source of truth for server-persisted settings
// =============================================================================

interface SettingsState {
  // Core state
  settings: Settings;
  customPalettes: Record<string, Palette16>;
  loaded: boolean;

  // Derived — merged palette map (built-in + custom)
  allPalettes: () => Record<string, Palette16>;

  // Actions
  _init: () => Promise<void>;
  setColorPalette: (paletteKey: string) => void;
  addCustomPalette: (key: string, palette: Palette16) => void;
  previewPalette: (paletteKey: string) => void;
  restorePalette: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // State
  settings: DEFAULT_SETTINGS,
  customPalettes: {},
  loaded: false,

  // Derived selector — returns merged palette map
  allPalettes: () => ({ ...PALETTES, ...get().customPalettes }),

  // Private init action — called once at app startup
  _init: async () => {
    try {
      const [settingsData, palettesData] = await Promise.all([
        fetch('/api/settings').then((res) => res.json()),
        fetch('/api/custom-palettes').then((res) => res.json()),
      ]);

      // Merge custom palettes first
      const customPalettes =
        palettesData && typeof palettesData === 'object'
          ? (palettesData as Record<string, Palette16>)
          : {};

      const mergedPalettes = { ...PALETTES, ...customPalettes };

      // Apply saved palette or fallback to solarized
      const savedKey = settingsData?.colorPalette;
      const savedPalette = savedKey ? mergedPalettes[savedKey] : null;

      if (savedPalette) {
        // Apply saved palette
        applyPalette(savedPalette);
        set({ settings: settingsData, customPalettes, loaded: true });
      } else {
        // No valid saved palette — apply solarized and save it as default
        applyPalette(PALETTES.solarized);
        set({ customPalettes, loaded: true });

        // Save default to server
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(DEFAULT_SETTINGS),
        }).catch(console.error);
      }
    } catch (err) {
      // Fetch failed — apply solarized as fallback
      console.error('Failed to load settings:', err);
      applyPalette(PALETTES.solarized);
      set({ loaded: true });
    }
  },

  // Set active palette and save to server
  setColorPalette: (paletteKey) => {
    const newSettings = { colorPalette: paletteKey };
    set({ settings: newSettings });

    // Apply palette immediately
    const palette = get().allPalettes()[paletteKey] || PALETTES.solarized;
    applyPalette(palette);

    // Save to server
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    }).catch(console.error);
  },

  // Add a newly generated custom palette without re-fetching
  addCustomPalette: (key, palette) => {
    set((s) => ({
      customPalettes: { ...s.customPalettes, [key]: palette },
    }));
  },

  // Preview a palette without saving
  previewPalette: (paletteKey) => {
    const palette = get().allPalettes()[paletteKey];
    if (palette) {
      applyPalette(palette);
    }
  },

  // Restore current saved palette (after preview)
  restorePalette: () => {
    const { settings, allPalettes } = get();
    const palette = allPalettes()[settings.colorPalette] || PALETTES.solarized;
    applyPalette(palette);
  },
}));

// =============================================================================
// Initialization — call once at app startup to load settings and apply palette
// =============================================================================

export async function initSettings() {
  await useSettingsStore.getState()._init();
}
