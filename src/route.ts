/**
 * URLs for each part of the app, so a tab or Guide section can be linked to:
 *   /                     Configure
 *   /json                 JSON
 *   /guide                Guide (first layout)
 *   /guide/<layout>       Guide, with that layout selected (e.g. /guide/store-card)
 *   /guide#<section>      a Guide section (e.g. /guide#field-dictionary)
 * A shared pass lives in the hash of / (see pass/share.ts). Vercel serves index.html for every path
 * (vercel.json), and Vite's dev server does the same.
 */
export type Tab = 'configure' | 'json' | 'guide';

export interface Route {
  tab: Tab;
  /** Guide layout slug, e.g. "event-ticket-strip". */
  variant?: string;
}

/** "eventTicket-strip" → "event-ticket-strip". */
export const variantSlug = (id: string) => id.replace(/([A-Z])/g, '-$1').toLowerCase();

export function parseRoute(path = window.location.pathname): Route {
  const [first, second] = path.split('/').filter(Boolean);
  if (first === 'json') return { tab: 'json' };
  if (first === 'guide') return { tab: 'guide', variant: second };
  return { tab: 'configure' };
}

export function routePath(route: Route): string {
  if (route.tab === 'json') return '/json';
  if (route.tab === 'guide') return route.variant ? `/guide/${route.variant}` : '/guide';
  return '/';
}

/** Let the browser handle Cmd/Ctrl/Shift/middle clicks on in-app links (new tab, new window). */
export const isPlainClick = (e: React.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
