# Settings Store Migration

**Date**: 2026-02-03
**Issue**: Color palette not loading correctly on initial page load

## Problem

The color palette was showing as grey/solarized on page load instead of the user's saved palette (e.g., nord). However, opening the color palette picker would immediately apply the correct palette.

## Root Cause

**React hooks create isolated state instances.** The old implementation used `useSettings()` as a React hook, which meant:

1. **ConfigDropdown** mounted first and called `useSettings()` → created instance A
2. Instance A fetched settings from server and applied the saved palette
3. **ColorPalettePicker** mounted later and called `useSettings()` → created instance B (new state!)
4. Instance B started with `DEFAULT_SETTINGS = { colorPalette: 'solarized' }`
5. Instance B's fetch was still pending when the picker rendered
6. Picker used stale default instead of server data

**Each `useSettings()` call created a new fetch request and independent state**, causing:
- Race conditions between multiple fetch requests
- Inconsistent state across components
- Palette being applied multiple times with different values
- No guarantee which component's fetch would complete first

## Solution

**Migrated settings to a Zustand store** (`settingsStore.ts`):

```typescript
// OLD: React hook with isolated state
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);  // ❌ New state per call
  useEffect(() => { fetch('/api/settings')... }, []);          // ❌ New fetch per call
  // ...
}

// NEW: Zustand store with shared state
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  _init: async () => { /* Single fetch at app startup */ },
  // ...
}));
```

**Benefits**:
1. **Single source of truth** — all components read from the same store
2. **One fetch at startup** — `initSettings()` called once in `App.tsx`
3. **Palette applied immediately** — before any component renders
4. **No race conditions** — settings load once and propagate to all subscribers
5. **Predictable initialization** — explicit init order in app lifecycle

## Changes Made

### Created: `client/src/stores/settingsStore.ts`
- Zustand store with settings state
- `initSettings()` function called at app startup
- Actions: `setColorPalette`, `previewPalette`, `restorePalette`, `addCustomPalette`
- Moved all palette definitions from hook to store

### Updated: `client/src/App.tsx`
- Import `initSettings` from `settingsStore`
- Call `initSettings()` in `AppLayout` useEffect (line 58-60)
- Ensures settings load before any component tries to access them

### Updated: `client/src/components/ConfigDropdown.tsx`
- Changed from `useSettings()` hook to `useSettingsStore()` store
- Uses targeted selector: `useSettingsStore((s) => s.settings)`

### Updated: `client/src/components/ColorPalettePicker.tsx`
- Changed from `useSettings()` hook to `useSettingsStore()` store
- Extracts multiple selectors for different parts of state/actions
- Uses `allPalettes()` derived selector for merged palette map

### Deleted: `client/src/hooks/useSettings.ts`
- Replaced entirely by Zustand store

## Architecture Notes

### Why Zustand over React Context?

1. **Simpler API** — no Provider wrapper needed
2. **Better performance** — targeted selectors prevent unnecessary re-renders
3. **Consistent with codebase** — matches existing `conversationStore` and `uiStore` patterns
4. **Easy initialization** — export `initSettings()` for explicit app startup sequence

### Initialization Flow

```typescript
// App.tsx:58-60
useEffect(() => {
  initSettings().catch(console.error);
}, []);

// settingsStore.ts:_init()
1. Fetch settings and custom palettes in parallel
2. Merge palettes (built-in + custom)
3. Look up saved palette key
4. Apply palette to CSS immediately via applyPalette()
5. Update store state
6. Set loaded = true
```

### State Shape

```typescript
interface SettingsState {
  settings: Settings;              // { colorPalette: string }
  customPalettes: Record<...>;     // AI-generated palettes
  loaded: boolean;                 // Fetch complete flag

  allPalettes: () => Record<...>;  // Derived — merges PALETTES + customPalettes

  setColorPalette: (key) => void;  // Save to server + apply
  previewPalette: (key) => void;   // Apply without saving
  restorePalette: () => void;      // Revert to saved
  addCustomPalette: (...) => void; // Add AI-generated palette
}
```

## Lessons Learned

### 1. **Don't use React hooks for shared global state**

React hooks are designed for **component-local** state. When multiple components need the same data:
- ❌ Hook → Each call creates new state + new fetch
- ✅ Store → Single source of truth, one fetch

### 2. **Initialize app-wide dependencies explicitly**

Instead of lazy-loading settings when first component mounts:
- ❌ First component to mount triggers fetch (unpredictable timing)
- ✅ Call `initSettings()` at app startup (predictable order)

### 3. **Server-persisted state ≠ localStorage state**

- `uiStore` uses Zustand `persist()` middleware for localStorage (client-only state)
- `settingsStore` fetches from server at startup, then syncs on change (server-persisted state)
- These are two different persistence patterns — don't mix them

### 4. **One fetch, apply once**

The old code had multiple `applyPalette()` calls scattered across effects:
- Line 172: Apply after initial fetch
- Line 175: Apply fallback if no saved palette
- Line 186: Apply fallback on fetch error
- Line 200: Apply when settings change
- Line 232: Apply during preview

This led to confusion about which call was "winning." The new code:
- Applies once during `_init()` (guaranteed before any component renders)
- Only reapplies when user explicitly changes palette or previews

## Testing

After migration, verify:
1. ✅ Saved palette loads correctly on page refresh
2. ✅ Opening color picker shows correct active palette
3. ✅ Changing palette saves and applies immediately
4. ✅ AI palette generation works (adds to customPalettes, applies immediately)
5. ✅ Preview mode applies temporarily, cancel restores saved palette
6. ✅ No flicker/FOUC on initial load
7. ✅ Settings persist to `~/.agent-viewer/settings.json`
8. ✅ Multiple tabs share settings (via server persistence, not localStorage)

## Related Files

- `client/src/stores/settingsStore.ts` — New settings store
- `client/src/stores/uiStore.ts` — Example of localStorage-persisted store
- `client/src/stores/conversationStore.ts` — Example of WebSocket-driven store
- `client/src/App.tsx` — App initialization (`initSettings()` call)
- `server/src/server.ts:1039-1226` — Settings API endpoints and cache
- `CLAUDE.md` — React hooks rules (never call hooks after early returns)
