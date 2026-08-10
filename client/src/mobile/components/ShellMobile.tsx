import { NavLink, Outlet } from 'react-router-dom';
import '../styles/mobile.css';

/**
 * ShellMobile — mobile chrome around <Outlet/>.
 * Bottom tab bar = persistent chrome (like ShellDesktop's Sidebar+top-bar).
 * Never renders mergeMode (Not in v1 — merge stays desktop-only, see PLANNING §1).
 * Safe-area bottom inset expands tap target into home-indicator area (§7 #9).
 */

type TabDef = {
  label: string;
  to: string;
  end?: boolean;
  icon: string;
  ariaLabel: string;
};

// Tabs map to the RouteTable leaves (§3). Chats is the hub at "/" (MainScreen),
// not a raw list — see ROUTES desktop:Gallery ↔ mobile:MainScreen.
// Search lives at /search (query param variant is handled inside SearchMobile).
const TABS: readonly TabDef[] = [
  { label: 'Chats', to: '/', end: true, icon: '◈', ariaLabel: 'Chats' },
  { label: 'Swarms', to: '/workers', icon: '⬡', ariaLabel: 'Swarms' },
  { label: 'Buddies', to: '/buddies', icon: '◎', ariaLabel: 'Buddies' },
  { label: 'Search', to: '/search', icon: '⌕', ariaLabel: 'Search' },
] as const;

export function ShellMobile() {
  return (
    <div className="mobile-shell">
      <div className="mobile-content">
        <div className="mobile-content__inner">
          <Outlet />
        </div>
      </div>
      <nav className="mobile-tab-bar" aria-label="Primary">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            aria-label={tab.ariaLabel}
            className={({ isActive }) =>
              isActive ? 'mobile-tab mobile-tab--active' : 'mobile-tab'
            }
          >
            <span className="mobile-tab__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="mobile-tab__label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
