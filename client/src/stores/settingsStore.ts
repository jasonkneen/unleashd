import { create } from 'zustand';

/**
 * 16-token palette. The only source of truth for a theme.
 * CSS derives all other tokens (~60+) from these 14 values via color-mix().
 *
 * Naming follows Solarized convention:
 *   base03 = darkest background, base02 = surface bg,
 *   base01 = muted text, base00 = secondary text,
 *   base0 = primary text, base1 = emphasis text,
 *   + 8 accent colors
 */
export interface Palette16 {
  name: string;
  base03: string;
  base02: string;
  base01: string;
  base00: string;
  base0: string;
  base1: string;
  yellow: string;
  orange: string;
  red: string;
  magenta: string;
  violet: string;
  blue: string;
  cyan: string;
  green: string;
}

// Built-in palettes mapped to Palette16 format
export const PALETTES: Record<string, Palette16> = {
  solarized: {
    name: 'Solarized Dark',
    base03: '#002b36',
    base02: '#073642',
    base01: '#586e75',
    base00: '#657b83',
    base0: '#839496',
    base1: '#93a1a1',
    yellow: '#b58900',
    orange: '#cb4b16',
    red: '#dc322f',
    magenta: '#d33682',
    violet: '#6c71c4',
    blue: '#268bd2',
    cyan: '#2aa198',
    green: '#859900',
  },
  oksolar: {
    name: 'OKSolar Dark',
    base03: '#002d38',
    base02: '#093946',
    base01: '#5b7279',
    base00: '#657377',
    base0: '#98a8a8',
    base1: '#8faaab',
    yellow: '#ac8300',
    orange: '#d56500',
    red: '#f23749',
    magenta: '#dd459d',
    violet: '#7d80d1',
    blue: '#2b90d8',
    cyan: '#259d94',
    green: '#819500',
  },
  nord: {
    name: 'Nord',
    base03: '#2e3440',
    base02: '#3b4252',
    base01: '#4c566a',
    base00: '#d8dee9',
    base0: '#e5e9f0',
    base1: '#eceff4',
    yellow: '#ebcb8b',
    orange: '#d08770',
    red: '#bf616a',
    magenta: '#b48ead',
    violet: '#5e81ac',
    blue: '#81a1c1',
    cyan: '#88c0d0',
    green: '#a3be8c',
  },
  dracula: {
    name: 'Dracula',
    base03: '#282a36',
    base02: '#44475a',
    base01: '#6272a4',
    base00: '#bfbfbf',
    base0: '#f8f8f2',
    base1: '#ffffff',
    yellow: '#f1fa8c',
    orange: '#ffb86c',
    red: '#ff5555',
    magenta: '#ff79c6',
    violet: '#bd93f9',
    blue: '#8be9fd',
    cyan: '#8be9fd',
    green: '#50fa7b',
  },
  monokai: {
    name: 'Monokai',
    base03: '#272822',
    base02: '#3e3d32',
    base01: '#75715e',
    base00: '#a6a086',
    base0: '#f8f8f2',
    base1: '#f8f8f0',
    yellow: '#e6db74',
    orange: '#fd971f',
    red: '#f92672',
    magenta: '#f92672',
    violet: '#ae81ff',
    blue: '#66d9ef',
    cyan: '#66d9ef',
    green: '#a6e22e',
  },
  gruvbox: {
    name: 'Gruvbox Dark',
    base03: '#282828',
    base02: '#3c3836',
    base01: '#504945',
    base00: '#a89984',
    base0: '#ebdbb2',
    base1: '#fbf1c7',
    yellow: '#fabd2f',
    orange: '#fe8019',
    red: '#fb4934',
    magenta: '#d3869b',
    violet: '#d3869b',
    blue: '#83a598',
    cyan: '#8ec07c',
    green: '#b8bb26',
  },
  tokyo: {
    name: 'Tokyo Night',
    base03: '#1a1b26',
    base02: '#24283b',
    base01: '#414868',
    base00: '#565f89',
    base0: '#a9b1d6',
    base1: '#c0caf5',
    yellow: '#e0af68',
    orange: '#ff9e64',
    red: '#f7768e',
    magenta: '#bb9af7',
    violet: '#7aa2f7',
    blue: '#7dcfff',
    cyan: '#7dcfff',
    green: '#9ece6a',
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    base03: '#1e1e2e',
    base02: '#313244',
    base01: '#45475a',
    base00: '#6c7086',
    base0: '#cdd6f4',
    base1: '#bac2de',
    yellow: '#f9e2af',
    orange: '#fab387',
    red: '#f38ba8',
    magenta: '#cba6f7',
    violet: '#89b4fa',
    blue: '#89dceb',
    cyan: '#94e2d5',
    green: '#a6e3a1',
  },
};

interface Settings {
  colorPalette: string; // Key into PALETTES or customPalettes
}

const DEFAULT_SETTINGS: Settings = {
  colorPalette: 'solarized',
};

/**
 * Apply a Palette16 to CSS by setting 14 --pal-* custom properties.
 * CSS color-mix() rules derive the remaining ~60 tokens automatically.
 */
const PALETTE_KEYS = [
  'base03',
  'base02',
  'base01',
  'base00',
  'base0',
  'base1',
  'yellow',
  'orange',
  'red',
  'magenta',
  'violet',
  'blue',
  'cyan',
  'green',
] as const;

export function applyPalette(palette: Palette16) {
  const root = document.documentElement;
  for (const key of PALETTE_KEYS) {
    root.style.setProperty(`--pal-${key}`, palette[key]);
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
