import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

declare global {
  interface Window {
    __unleashdBoot?: {
      fail: (message: string) => void;
      ready: () => void;
    };
  }
}

function BootMarker() {
  useEffect(() => {
    window.__unleashdBoot?.ready();
  }, []);

  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootMarker />
    <App />
  </StrictMode>
);
