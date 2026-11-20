import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initTheme } from './theme';
import './boletify/tokens.css';
import './boletify/base.css';
import './styles.css';
import './pass.css';

// Boletify themes via data-theme: System (follows the OS, default), Light or Dark.
initTheme();

// Dev only: `await __layoutAudit()` in the console stress-tests the pass layout.
if (import.meta.env.DEV) void import('./dev/layoutAudit');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
