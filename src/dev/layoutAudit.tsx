/**
 * Dev-only layout stress test. In the browser console (npm run dev):
 *
 *   await __layoutAudit()            // all styles, at the narrowest and widest iPhone
 *   await __layoutAudit('eventTicket')
 *   await __layoutAudit(undefined, [370]) // specific card widths
 *
 * It renders hundreds of pass variants off-screen with the real renderer — empty and full field
 * groups, long text, every image combination, every barcode kind, alt text, expired passes — and
 * reports anything that overlaps something else or spills outside the 343×503 pt card.
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PassView } from '../components/PassView';
import {
  PASS_STYLES,
  STYLE_IMAGES,
  type BarcodeFormat,
  type ImageName,
  type PassBundle,
  type PassField,
  type PassJson,
  type PassStyle,
} from '../pass/types';

const img = (w: number, h: number, color: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`);

// Deliberately large images: the renderer has to constrain them.
const IMAGES: Record<ImageName, string> = {
  icon: img(58, 58, '#888'),
  logo: img(320, 100, '#c80'), // widest/tallest Apple allows (160×50 pt @2x)
  strip: img(750, 288, '#246'),
  background: img(360, 440, '#624'),
  thumbnail: img(180, 180, '#2a6'),
  footer: img(572, 30, '#aa2'),
};

const LONG = 'An extremely long value that will never fit in its slot';
const field = (key: string, label: string, value: string | number, extra: Partial<PassField> = {}): PassField => ({ key, label, value, ...extra });
const many = (prefix: string, n: number, long: boolean): PassField[] =>
  Array.from({ length: n }, (_, i) => field(`${prefix}${i}`, long ? `Label number ${i}` : `L${i}`, long ? LONG : `Val ${i}`));

type Group = 'none' | 'short' | 'full' | 'long';
const GROUPS: Group[] = ['none', 'short', 'full', 'long'];
const BARCODES: (BarcodeFormat | null)[] = [null, 'PKBarcodeFormatQR', 'PKBarcodeFormatPDF417', 'PKBarcodeFormatCode128', 'PKBarcodeFormatEAN13'];
const MESSAGES: Partial<Record<BarcodeFormat, string>> = { PKBarcodeFormatEAN13: '4006381333931' };

function groupFields(prefix: string, g: Group, max: number): PassField[] | undefined {
  if (g === 'none') return undefined;
  if (g === 'short') return many(prefix, 1, false);
  return many(prefix, max, g === 'long');
}

/** The image sets each style can show. */
function imageSets(style: PassStyle): ImageName[][] {
  const allowed = STYLE_IMAGES[style];
  const sets: ImageName[][] = [[], ['logo']];
  if (allowed.includes('thumbnail')) sets.push(['logo', 'thumbnail']);
  if (allowed.includes('strip')) sets.push(['logo', 'strip']);
  if (allowed.includes('background')) sets.push(['logo', 'background', 'thumbnail']);
  if (allowed.includes('footer')) sets.push(['logo', 'footer']);
  return sets;
}

function build(style: PassStyle, imgs: ImageName[], header: Group, primary: Group, secondary: Group, aux: Group, format: BarcodeFormat | null, altText: string | undefined, voided: boolean, longLogo: boolean) {
  const s: Record<string, unknown> = {
    headerFields: groupFields('h', header, 3),
    primaryFields: groupFields('p', primary, style === 'boardingPass' ? 2 : 1),
    secondaryFields: groupFields('s', secondary, 4),
    auxiliaryFields:
      style === 'eventTicket' && (aux === 'full' || aux === 'long')
        ? [...many('a', 4, aux === 'long'), ...many('b', 4, aux === 'long').map((f) => ({ ...f, row: 1 as const }))]
        : groupFields('a', aux, style === 'boardingPass' ? 5 : 4),
  };
  if (style === 'boardingPass') s.transitType = 'PKTransitTypeAir';
  const json: PassJson = {
    formatVersion: 1,
    passTypeIdentifier: 'pass.audit',
    serialNumber: 'A',
    teamIdentifier: 'T',
    organizationName: 'Audit',
    description: 'Audit',
    logoText: longLogo ? 'A very long logo text that has to truncate' : 'Logo',
    backgroundColor: 'rgb(30, 30, 30)',
    foregroundColor: 'rgb(255, 255, 255)',
    ...(voided ? { voided: true } : {}),
    [style]: s,
    ...(format ? { barcodes: [{ format, message: MESSAGES[format] ?? 'AUDIT-0001', messageEncoding: 'iso-8859-1', altText }] } : {}),
  };
  const images = Object.fromEntries(imgs.map((i) => [i, IMAGES[i]]));
  return {
    name: `${style} imgs=[${imgs.join(',')}] header=${header} primary=${primary} secondary=${secondary} aux=${aux} barcode=${format?.replace('PKBarcodeFormat', '') ?? 'none'}${altText ? '+alt' : ''}${voided ? ' voided' : ''}`,
    bundle: { json, images, strings: {} } as PassBundle,
  };
}

function* cases(style: PassStyle): Generator<{ name: string; bundle: PassBundle }> {
  // 1. Every combination of field groups and image sets, rotating barcode / alt text / voided / logo text.
  for (const imgs of imageSets(style))
    for (const header of GROUPS)
      for (const primary of GROUPS)
        for (const secondary of GROUPS)
          for (const aux of GROUPS) {
            const n = GROUPS.indexOf(header) + GROUPS.indexOf(primary) * 2 + GROUPS.indexOf(secondary) * 3 + GROUPS.indexOf(aux) * 5;
            yield build(style, imgs, header, primary, secondary, aux, BARCODES[n % BARCODES.length], n % 2 === 0 ? 'ALT-TEXT-0001' : undefined, n % 7 === 0, n % 3 === 0);
          }
  // 2. The tallest field layouts against every bottom: each barcode kind × alt text × voided.
  //    (The barcode area is what grows; this is where a voided message once collided with the rows.)
  for (const imgs of imageSets(style))
    for (const secondary of ['full', 'long'] as Group[])
      for (const aux of ['full', 'long'] as Group[])
        for (const format of BARCODES)
          for (const alt of [undefined, 'ALT-TEXT-0001'])
            for (const voided of [false, true]) yield build(style, imgs, 'full', 'full', secondary, aux, format, alt, voided, false);
}

interface Box {
  what: string;
  r: DOMRect;
}

const intersects = (a: DOMRect, b: DOMRect, tol = 0.5) =>
  a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;

function inspect(pass: HTMLElement): string[] {
  const p = pass.getBoundingClientRect();
  const problems: string[] = [];
  const box = (el: Element, what: string): Box => ({ what, r: el.getBoundingClientRect() });
  const boxes: Box[] = [];
  pass.querySelectorAll('.pass__header-fields > .field').forEach((el, i) => boxes.push(box(el, `header field ${i + 1}`)));
  pass.querySelectorAll('.pass__logo img').forEach((el) => boxes.push(box(el, 'logo')));
  pass.querySelectorAll('.pass__logo-text').forEach((el) => boxes.push(box(el, 'logo text')));
  pass.querySelectorAll('.pass__primary .field, .pass__strip .field').forEach((el, i) => boxes.push(box(el, `primary field ${i + 1}`)));
  pass.querySelectorAll('.pass__row').forEach((row) => {
    const slot = [...row.classList].find((c) => /pass__row--(secondary|auxiliary2?)$/.test(c))!.replace('pass__row--', '');
    row.querySelectorAll(':scope > .field').forEach((el, i) => boxes.push(box(el, `${slot} field ${i + 1}`)));
  });
  // The drawn glyph, not its 42 × 40 pt box (PassKit's box overlaps the primary columns).
  pass.querySelectorAll('.transit-icon path').forEach((el) => boxes.push(box(el, 'transit icon')));
  pass.querySelectorAll('.pass__thumbnail').forEach((el) => boxes.push(box(el, 'thumbnail')));
  pass.querySelectorAll('.pass__footer').forEach((el) => boxes.push(box(el, 'footer image')));
  pass.querySelectorAll('.barcode').forEach((el) => boxes.push(box(el, 'barcode')));
  pass.querySelectorAll('.pass__invalid').forEach((el) => boxes.push(box(el, 'voided text')));

  // The voided/expired message must stay inside the barcode box it's drawn on.
  pass.querySelectorAll('.barcode__status').forEach((el) => {
    const st = el.getBoundingClientRect();
    const bc = el.closest('.barcode')!.getBoundingClientRect();
    if (st.left < bc.left - 0.5 || st.right > bc.right + 0.5 || st.top < bc.top - 0.5 || st.bottom > bc.bottom + 0.5) {
      problems.push('voided text spills out of the barcode box');
    }
  });

  // Rows must not run over the strip image (only the primary field lives on it).
  const strip = pass.querySelector('.pass__strip')?.getBoundingClientRect();

  for (const b of boxes) {
    if (b.r.width === 0 && b.r.height === 0) continue;
    if (b.r.left < p.left - 0.5 || b.r.right > p.right + 0.5 || b.r.top < p.top - 0.5 || b.r.bottom > p.bottom + 0.5) {
      problems.push(`${b.what} spills outside the card`);
    }
    if (strip && /secondary|auxiliary/.test(b.what) && intersects(b.r, strip)) problems.push(`${b.what} overlaps the strip`);
  }
  // Text extent of a field (its label and value as laid out), for checks where the boxes may overlap.
  const textRect = (field: Element): DOMRect | null => {
    const rects = [...field.querySelectorAll('.field__label, .field__value')].flatMap((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return [...r.getClientRects()];
    });
    if (!rects.length) return null;
    // Clipped to the field: text cut off by overflow (with an ellipsis) isn't drawn.
    const f = field.getBoundingClientRect();
    const l = Math.max(f.left, Math.min(...rects.map((r) => r.left)));
    const t = Math.max(f.top, Math.min(...rects.map((r) => r.top)));
    const r = Math.min(f.right, Math.max(...rects.map((x) => x.right)));
    const b = Math.min(f.bottom, Math.max(...rects.map((x) => x.bottom)));
    return new DOMRect(l, t, Math.max(0, r - l), Math.max(0, b - t));
  };
  const primaryFields = [...pass.querySelectorAll('.pass__primary .field, .pass__strip .field')];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      // Boarding passes: PassKit's origin / destination columns run under the transit icon's box;
      // only their text has to stay clear of it.
      const pair = [a, b].map((x) => x.what);
      const iconWith = pair.includes('transit icon') ? pair.find((w) => /^primary field \d$/.test(w)) : undefined;
      if (iconWith) {
        const field = primaryFields[Number(iconWith.slice(-1)) - 1];
        const icon = (a.what === 'transit icon' ? a : b).r;
        const text = field && textRect(field);
        if (text && intersects(text, icon)) problems.push(`${iconWith}'s text overlaps transit icon`);
        continue;
      }
      if (intersects(a.r, b.r)) problems.push(`${a.what} overlaps ${b.what}`);
    }

  // Event tickets: nothing may sit in the notch (r = 50.8 pt circle centred 37.3 pt above the top edge).
  if (pass.classList.contains('pass--eventTicket')) {
    const cx = p.left + p.width / 2;
    const cy = p.top - 37.3;
    for (const b of boxes) {
      // Wallet draws a full-width logo under the notch and lets the notch cut it; text must stay clear.
      if (b.what === 'logo') continue;
      // Text line boxes start 1.4 pt above the letters' cap height; the notch only matters for ink.
      const top = /field|logo text/.test(b.what) ? b.r.top + 1.4 : b.r.top;
      const nx = Math.max(b.r.left, Math.min(cx, b.r.right));
      const ny = Math.max(top, Math.min(cy, b.r.bottom));
      if (Math.hypot(nx - cx, ny - cy) < 50.8 - 0.5) problems.push(`${b.what} is cut by the notch`);
    }
  }
  return problems;
}

export async function layoutAudit(only?: PassStyle, widths: number[] = [343, 408]) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-2000px;top:0;width:460px;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  const root = createRoot(host);
  const failures: { name: string; problems: string[] }[] = [];
  let total = 0;
  try {
    for (const style of only ? [only] : PASS_STYLES) {
      for (const width of widths) for (const c of cases(style)) {
        total++;
        window.__layoutAuditProgress = `${style} ${width} #${total}`;
        // Let the page breathe now and then, so the console (and progress checks) stay responsive.
        if (total % 25 === 0) await new Promise<void>((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
        flushSync(() => root.render(<PassView bundle={c.bundle} width={width} flipped={false} onFlip={() => {}} />));
        await Promise.all([...host.querySelectorAll('img')].map((i) => (i.complete ? null : i.decode().catch(() => null))));
        const pass = host.querySelector<HTMLElement>('.pass-flip__face--front .pass');
        const problems = pass ? [...new Set(inspect(pass))] : ['did not render'];
        if (problems.length) failures.push({ name: `${c.name} width=${width}`, problems });
      }
    }
  } finally {
    root.unmount();
    host.remove();
  }
  // Group by problem so the report reads as a list of distinct bugs.
  const byProblem = new Map<string, string[]>();
  for (const f of failures) for (const p of f.problems) byProblem.set(p, [...(byProblem.get(p) ?? []), f.name]);
  const summary = [...byProblem].map(([problem, names]) => ({ problem, count: names.length, example: names[0] }));
  summary.sort((a, b) => b.count - a.count);
  return { cases: total, failing: failures.length, problems: summary };
}

declare global {
  interface Window {
    __layoutAudit: typeof layoutAudit;
    /** The case the running audit is on. */
    __layoutAuditProgress?: string;
  }
}
window.__layoutAudit = layoutAudit;
