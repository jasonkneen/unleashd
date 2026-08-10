# Mobile UI system

Mobile and desktop share the semantic color tokens in `client/src/index.css`, but
they intentionally have separate view trees. Reuse visual primitives inside the
mobile tree instead of importing desktop TSX or desktop feature CSS.

## Layers

1. `index.css` — palette and semantic tokens shared by every device.
2. `mobile/styles/mobile.css` — shell, safe areas, tab bar, and legacy detail views.
3. `mobile/styles/mobile-ui.css` — reusable mobile page and surface grammar.
4. Feature CSS — only layout or states unique to that feature.

## Primitives

Import from `mobile/components/MobileUI.tsx`:

- `MobilePage` for route title, subtitle, width containment, and page spacing.
- `MobileSection` for a labeled group inside a page.
- `MobileCardButton` for tappable cards with consistent focus and press feedback.
- `MobileSurface` for a non-interactive card.
- `MobileBadge` for compact status labels.
- `MobilePath` for a safe, truncated working-directory label.
- `MobileEmptyPanel` for an empty result inside an otherwise populated page.

Use the `mobile-ui-stack` class for one-column card lists. Keep data fetching,
domain copy, feature state, and feature-specific inner layouts in the feature.

```tsx
<MobilePage title="Swarms" subtitle="4 projects">
  <div className="mobile-ui-stack">
    <MobileCardButton onClick={openProject}>
      <strong>{project.name}</strong>
      <MobilePath>{project.path}</MobilePath>
    </MobileCardButton>
  </div>
</MobilePage>
```

## Restraint

Do not add a primitive for a one-off arrangement. Extract only a contract used
by at least two routes, and keep the API semantic rather than exposing dozens of
spacing or color props. New primitives must remain mobile-only and use existing
semantic tokens rather than introducing a second palette.
