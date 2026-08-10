/**
 * mobile/index.ts — barrel for the mobile view tree (§6, PLANNING_MOBILE.md §6).
 * Re-exports the public surface of the mobile tree so App.tsx and leaf views
 * have one canonical import root. Does NOT re-export desktop components.
 *
 * Allowed imports for mobile/ (enforced by G3):
 *   atoms/*, hooks/*, utils/*, shared/*, components/buddies/{api,types,ui-contract,buddies-shaping}
 * This barrel itself respects that boundary — it only re-exports from mobile/.
 */

// Shell + reusable mobile UI
export { ShellMobile } from './components/ShellMobile';
export { EmptyState } from './components/EmptyState';
export {
  MobileBadge,
  MobileCardButton,
  MobileEmptyPanel,
  MobilePage,
  MobilePath,
  MobileSection,
  MobileSurface,
} from './components/MobileUI';

// DeviceKind sum type (§3: 'mobile'|'desktop' — not boolean)
export { useDeviceKind, type DeviceKind } from './hooks/useDeviceKind';

// Mobile search state (§4: lives in mobile/atoms/ — device-specific view, not canonical conversations.ts)
export {
  mobileSearchStateAtom,
  mobileSearchResultsAtom,
  type MobileSearchState,
} from './atoms/search';
