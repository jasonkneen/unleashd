import { useAtomValue } from 'jotai';
import { Outlet, useNavigate } from 'react-router-dom';
import { mergeModeAtom } from '../atoms/mergeAtoms';
import { ConfigDropdown } from './ConfigDropdown';
import { MergeModal } from './MergeModal';
import { Sidebar } from './Sidebar';

/**
 * ShellDesktop — desktop chrome around <Outlet/>.
 * Extracted from AppLayout (§5 #1). Owns:
 *   Sidebar + top-bar ConfigDropdown + mergeMode ? <MergeModal/> : <Outlet/> switch.
 * Merge mode stays desktop-only; ShellMobile never renders it (Not in v1).
 */
export function ShellDesktop() {
  const mergeMode = useAtomValue(mergeModeAtom);
  const navigate = useNavigate();

  const handleMergeComplete = (parentId: string) => {
    navigate(`/chat/${parentId}`);
  };

  return (
    <div className="app">
      <Sidebar />
      <div className={`main-content ${mergeMode ? 'main-content--merge-dim' : ''}`}>
        {mergeMode ? (
          <MergeModal onComplete={handleMergeComplete} />
        ) : (
          <>
            <div className="top-bar">
              <ConfigDropdown />
            </div>
            <Outlet />
          </>
        )}
      </div>
    </div>
  );
}
