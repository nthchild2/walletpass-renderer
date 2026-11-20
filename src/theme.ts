/**
 * Theme preference: 'system' follows the OS, 'light' / 'dark' override it. The Boletify styles
 * switch on <html data-theme>. The choice is remembered per browser (localStorage, best-effort).
 */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'pass-renderer:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage blocked: fall back to system */
  }
  return 'system';
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* not remembered, but still applied */
  }
  apply(pref);
}

/** Apply the saved preference now and keep following the OS while it's 'system'. */
export function initTheme() {
  apply(getThemePref());
  media.addEventListener('change', () => {
    if (getThemePref() === 'system') apply('system');
  });
}
