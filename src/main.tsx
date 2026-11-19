import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './boletify/tokens.css';
import './boletify/base.css';
import './styles.css';
import './pass.css';

// Boletify themes via data-theme; follow the OS setting (light = organiser Panel default).
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => {
  document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
};
applyTheme();
media.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
