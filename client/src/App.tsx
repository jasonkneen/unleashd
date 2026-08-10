import { Provider, useAtomValue } from 'jotai';
import { useEffect, useRef, type ComponentType, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { handleMessage, setSendFn, setWsStatus } from './atoms/actions';
import { allConversationsAtom, conversationsAtom } from './atoms/conversations';
import { jotaiStore } from './atoms/store';
import { BuddiesDashboard } from './components/BuddiesDashboard';
import { Chat } from './components/Chat';
import { Gallery } from './components/Gallery';
import { RobotLoader } from './components/RobotLoader';
import { ShellDesktop } from './components/ShellDesktop';
import { SwarmAnalytics } from './components/SwarmAnalytics';
import { SwarmDashboard } from './components/SwarmDashboard';
import { SwarmDetail } from './components/SwarmDetail';
import { useWebSocket } from './hooks/useWebSocket';
import { initSettings } from './stores/settingsStore';
import { useUIStore } from './stores/uiStore';
import './App.css';

// =============================================================================
// DeviceKind — canonical sum type at the shell (§3, PLANNING_MOBILE.md §3).
// Agent 2 owns client/src/mobile/hooks/useDeviceKind.ts as the canonical
// definition; this local type keeps the shell compiling until that file lands.
// When Agent 2 lands, replace the stub hook below with:
//   import { useDeviceKind, type DeviceKind } from './mobile/hooks/useDeviceKind';
// and remove the local type + stub.
// =============================================================================
export type DeviceKind = 'mobile' | 'desktop';

/**
 * Stub hook — sticky per page load, not resize-reactive.
 * Agent 2 will replace with matchMedia('(max-width: 768px)') κ that throws
 * a typed Error when matchMedia is missing (T4, no silent desktop default).
 * Until then, desktop is the safe default so restore-on-load keeps working.
 */
function useDeviceKind(): DeviceKind {
  // TODO(Agent 2): import real hook from './mobile/hooks/useDeviceKind'
  return 'desktop';
}

// =============================================================================
// κ: location.protocol → ws:// | wss://  (exhaustive D3, no silent fallback)
// Verification: http: → ws://, https: → wss://, else throw typed Error.
// Required before any https:// test; otherwise mixed-content blocks (PLANNING §5 #2).
// =============================================================================
function wsUrlForLocation(loc: Location): string {
  const protocol = loc.protocol;
  if (protocol === 'http:') {
    return `ws://${loc.host}/ws`;
  }
  if (protocol === 'https:') {
    return `wss://${loc.host}/ws`;
  }
  throw new Error(`Unsupported protocol for WebSocket: ${protocol}`);
}

/**
 * Connects the useWebSocket hook to the Jotai atom store.
 * Hoisted to App above AppRoutes so there is exactly one socket (§3).
 */
function useWebSocketBridge() {
  const wsUrl = wsUrlForLocation(window.location);
  const { send, status } = useWebSocket(wsUrl, handleMessage);

  useEffect(() => {
    setSendFn(send);
  }, [send]);

  useEffect(() => {
    setWsStatus(status);
  }, [status]);
}

/**
 * DeviceKind-aware restore on load (§5 #1).
 * Desktop: restores "/" → /chat/:id from uiStore.activeConversationId.
 * Mobile: keeps MainScreen hub — no redirect (MainScreen is the hub at "/").
 * Must be hoisted above AppRoutes so the nav fires once before the shell mounts.
 */
function useRestoreOnLoad(device: DeviceKind) {
  const navigate = useNavigate();
  const location = useLocation();
  const allConversations = useAtomValue(allConversationsAtom);
  const savedActiveId = useUIStore((s) => s.activeConversationId);
  const didRestore = useRef(false);

  useEffect(() => {
    // Mobile keeps the hub — never auto-redirect to a chat (PLANNING §5 #1).
    if (device === 'mobile') return;
    if (didRestore.current || allConversations.length === 0) return;
    didRestore.current = true;

    if (location.pathname === '/' && savedActiveId) {
      const conversations = jotaiStore.get(conversationsAtom);
      if (conversations.has(savedActiveId)) {
        navigate(`/chat/${savedActiveId}`, { replace: true });
      }
    }
  }, [allConversations.length, navigate, savedActiveId, location.pathname, device]);
}

// =============================================================================
// RouteTable — element FACTORIES, not ComponentType (§3).
// ComponentType silently drops props: `desktop: Gallery` for "/done" compiles
// (filter is optional) and renders the wrong view. Factories make
// "/done" → <Gallery filter="done"/> expressible.
// =============================================================================
type RouteDef = { path: string; desktop: () => ReactElement; mobile: () => ReactElement };

// ---------------------------------------------------------------------------
// Mobile placeholders — Agent 6-9 will replace these stubs with real imports
// from client/src/mobile/* . Keeping factories here preserves the RouteTable
// shape and lets `npx tsc --noEmit` pass before those files exist.
// Each stub is a distinct symbol so ROUTES rows remain one-clean-path per leaf.
// ---------------------------------------------------------------------------
function MainScreen() {
  return null as unknown as ReactElement;
}
function ChatMobile() {
  return null as unknown as ReactElement;
}
function BuddiesMobile() {
  return null as unknown as ReactElement;
}
function BuddyDetailMobile() {
  return null as unknown as ReactElement;
}
function SwarmsMobile() {
  return null as unknown as ReactElement;
}
function SwarmDetailMobile() {
  return null as unknown as ReactElement;
}
function SwarmAnalyticsMobile() {
  return null as unknown as ReactElement;
}
function ConversationListMobile() {
  return null as unknown as ReactElement;
}

// ShellMobile placeholder — Agent 6 owns client/src/mobile/components/ShellMobile.tsx.
// Until it lands, mobile shell renders just <Outlet/> so routes still mount.
function ShellMobile() {
  return <Outlet />;
}

const ROUTES: RouteDef[] = [
  { path: '/', desktop: () => <Gallery />, mobile: () => <MainScreen /> },
  { path: '/chat/:id', desktop: () => <Chat />, mobile: () => <ChatMobile /> },
  { path: '/buddies', desktop: () => <BuddiesDashboard />, mobile: () => <BuddiesMobile /> },
  { path: '/buddies/:buddyId', desktop: () => <BuddiesDashboard />, mobile: () => <BuddyDetailMobile /> },
  { path: '/workers', desktop: () => <SwarmDashboard />, mobile: () => <SwarmsMobile /> },
  { path: '/workers/detail', desktop: () => <SwarmDetail />, mobile: () => <SwarmDetailMobile /> },
  { path: '/workers/analytics', desktop: () => <SwarmAnalytics />, mobile: () => <SwarmAnalyticsMobile /> },
  { path: '/done', desktop: () => <Gallery filter="done" />, mobile: () => <ConversationListMobile /> },
];

const SHELLS: Record<DeviceKind, ComponentType> = {
  desktop: ShellDesktop,
  mobile: ShellMobile,
};

function AppRoutes({ device }: { device: DeviceKind }) {
  const Shell = SHELLS[device]; // δ #1 — shell
  const pick = (r: RouteDef) => (device === 'mobile' ? r.mobile() : r.desktop()); // δ #2 — leaf
  return (
    <Routes>
      <Route path="/robot" element={<RobotLoader />} />
      <Route element={<Shell />}>
        {ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={pick(r)} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppInner() {
  const device = useDeviceKind();
  useWebSocketBridge();
  useRestoreOnLoad(device);

  useEffect(() => {
    initSettings().catch(console.error);
  }, []);

  return <AppRoutes device={device} />;
}

function App() {
  return (
    <Provider store={jotaiStore}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
