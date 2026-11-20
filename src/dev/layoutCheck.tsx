/**
 * Dev-only regression check against PassKit itself. In the browser console (npm run dev):
 *
 *   await __layoutCheck()           // every case
 *   await __layoutCheck('wynn')     // cases whose name contains "wynn"
 *
 * or from a terminal: npm run test:layout (macOS: needs SF Pro, so it uses the system fonts).
 *
 * tests/layout/apple-frames.json holds PassKit's own layout of 56 test passes (PKPassView on iOS 27,
 * 370 pt card): the frame of every label, value and logo text. Each pass is rendered here with the
 * real renderer at 370 pt and every frame compared: position within 0.7 pt, value width within
 * 1.5 pt and height within 1 pt, font size within 0.1 pt.
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PassView } from '../components/PassView';
import type { ImageName, PassBundle, PassJson } from '../pass/types';
import fixtures from '../../tests/layout/apple-frames.json';

interface AppleFrame {
  text: string;
  frame: [number, number, number, number];
  size: number;
}

interface Case {
  name: string;
  images: ImageName[];
  pass: PassJson;
  frames: AppleFrame[];
}

/** Known, understood differences: reported, but not counted as failures. */
const KNOWN: Record<string, string> = {
  m5_generic_primary_vlong: 'PassKit breaks this 22 pt name onto three lines where the browser fits two, so it ends at 21 pt, the preview at 22 pt',
};

const img = (w: number, h: number, color: string) =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`);

// The probe's images, at @2x: logo 160×50 pt, thumbnail 90×90 pt, strip / background 180×220 pt.
const IMAGES: Partial<Record<ImageName, string>> = {
  logo: img(320, 100, '#c80'),
  thumbnail: img(180, 180, '#2a6'),
  strip: img(360, 440, '#246'),
  background: img(360, 440, '#624'),
};

const TOL = { pos: 0.7, width: 1.5, height: 1, size: 0.1 };

interface Ours {
  text: string;
  kind: 'label' | 'value' | 'logo';
  r: [number, number, number, number];
  size: number;
}

function collect(pass: HTMLElement): Ours[] {
  const p = pass.getBoundingClientRect();
  const z = p.width / pass.offsetWidth || 1;
  const rect = (el: Element): Ours['r'] => {
    const b = el.getBoundingClientRect();
    return [(b.left - p.left) / z, (b.top - p.top) / z, b.width / z, b.height / z];
  };
  const shown = (el: HTMLElement) => {
    const t = el.textContent ?? '';
    return getComputedStyle(el).textTransform === 'uppercase' ? t.toUpperCase() : t;
  };
  const out: Ours[] = [];
  for (const f of pass.querySelectorAll<HTMLElement>('.field')) {
    const l = f.querySelector<HTMLElement>('.field__label');
    const v = f.querySelector<HTMLElement>('.field__value')!;
    if (l) out.push({ text: shown(l), kind: 'label', r: rect(l), size: parseFloat(getComputedStyle(l).fontSize) });
    out.push({ text: shown(v), kind: 'value', r: rect(v), size: parseFloat(getComputedStyle(v).fontSize) });
  }
  const logo = pass.querySelector<HTMLElement>('.pass__logo-text');
  if (logo) out.push({ text: logo.textContent ?? '', kind: 'logo', r: rect(logo), size: parseFloat(getComputedStyle(logo).fontSize) });
  return out;
}

const firstLine = (t: string) => t.split('\n')[0];

function compare(c: Case, ours: Ours[]): string[] {
  const used = new Set<number>();
  const problems: string[] = [];
  for (const a of c.frames) {
    // Single-line labels show only the first line of a value with line breaks.
    const i = ours.findIndex((o, k) => !used.has(k) && (o.text === a.text || o.text === firstLine(a.text)));
    if (i < 0) {
      problems.push(`"${a.text}" is missing`);
      continue;
    }
    used.add(i);
    const o = ours[i];
    const [ax, ay, aw, ah] = a.frame;
    const [ox, oy, ow, oh] = o.r;
    const off: string[] = [];
    if (Math.abs(ox - ax) > TOL.pos) off.push(`x ${ox.toFixed(1)} vs ${ax}`);
    if (Math.abs(oy - ay) > TOL.pos) off.push(`y ${oy.toFixed(1)} vs ${ay}`);
    if (o.kind === 'value') {
      if (Math.abs(ow - aw) > TOL.width) off.push(`width ${ow.toFixed(1)} vs ${aw}`);
      if (Math.abs(oh - ah) > TOL.height) off.push(`height ${oh.toFixed(1)} vs ${ah}`);
      if (Math.abs(o.size - a.size) > TOL.size) off.push(`font ${o.size} vs ${a.size} pt`);
    }
    if (off.length) problems.push(`${o.kind} "${a.text.replace(/\n/g, '⏎')}": ${off.join(', ')}`);
  }
  return problems;
}

export async function layoutCheck(only?: string) {
  const cases = (fixtures.cases as unknown as Case[]).filter((c) => !only || c.name.toLowerCase().includes(only.toLowerCase()));
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-2000px;top:0;width:460px;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  const root = createRoot(host);
  await document.fonts?.ready;
  const failing: { name: string; problems: string[] }[] = [];
  const known: { name: string; why: string; problems: string[] }[] = [];
  try {
    for (const c of cases) {
      const images = Object.fromEntries(c.images.filter((i) => IMAGES[i]).map((i) => [i, IMAGES[i]!]));
      const bundle = { json: c.pass, images, strings: {} } as PassBundle;
      flushSync(() => root.render(<PassView bundle={bundle} width={370} pixelRatio={3} flipped={false} onFlip={() => {}} />));
      await Promise.all([...host.querySelectorAll('img')].map((i) => (i.complete ? null : i.decode().catch(() => null))));
      const pass = host.querySelector<HTMLElement>('.pass-flip__face--front .pass');
      const problems = pass ? compare(c, collect(pass)) : ['did not render'];
      if (!problems.length) continue;
      if (KNOWN[c.name]) known.push({ name: c.name, why: KNOWN[c.name], problems });
      else failing.push({ name: c.name, problems });
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return { cases: cases.length, passing: cases.length - failing.length - known.length, failing, known };
}

declare global {
  interface Window {
    __layoutCheck: typeof layoutCheck;
  }
}
window.__layoutCheck = layoutCheck;
