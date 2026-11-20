import { IMAGE_NAMES, type ImageName, type PassBundle, type PassImages, type PassJson } from './types';

/**
 * Share links carry the pass in the URL hash: /#pass=<data>. The hash never reaches the server, so
 * nothing is stored anywhere. pass.json and the translations go in (a typical pass is about 1 KB of
 * link); images don't fit in a link, so only each image's name and pixel size go in, and the opened
 * pass shows a placeholder of that size in its place (same layout, plain picture).
 *
 * <data> is "z" + base64url(deflate-raw(JSON)), or "j" + base64url(JSON) in browsers without
 * CompressionStream. Links made before image sizes were added have no "images" key: they still
 * open, with no placeholders, and the app can't tell which images they had.
 */
const KEY = 'pass=';

interface Payload {
  v: 1;
  json: PassJson;
  strings: Record<string, string>;
  /** Each image the pass had: [width, height] in pixels. */
  images?: Partial<Record<ImageName, [number, number]>>;
}

export interface SharedPass {
  bundle: PassBundle;
  /** Images replaced by placeholders, or null for an older link that doesn't say. */
  placeholders: ImageName[] | null;
}

export async function shareUrl(bundle: PassBundle): Promise<string> {
  const payload: Payload = { v: 1, json: bundle.json, strings: bundle.strings, images: await imageSizes(bundle.images) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const data = typeof CompressionStream === 'undefined' ? 'j' + toBase64Url(bytes) : 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return `${window.location.origin}/#${KEY}${data}`;
}

/** The share data in a hash like "#pass=…", or null when the hash isn't a share link. */
export function readShareHash(hash = window.location.hash): string | null {
  const h = hash.replace(/^#/, '');
  return h.startsWith(KEY) ? h.slice(KEY.length) : null;
}

export async function decodeShare(data: string): Promise<SharedPass> {
  const kind = data[0];
  let bytes = fromBase64Url(data.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('unknown link format');
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Payload>;
  if (!payload || typeof payload.json !== 'object' || payload.json === null || Array.isArray(payload.json)) throw new Error('no pass in the link');
  const strings = payload.strings && typeof payload.strings === 'object' ? payload.strings : {};

  if (!payload.images || typeof payload.images !== 'object') return { bundle: { json: payload.json, strings, images: {} }, placeholders: null };
  const images: PassImages = {};
  const placeholders: ImageName[] = [];
  for (const name of IMAGE_NAMES) {
    const size = payload.images[name];
    if (!Array.isArray(size)) continue;
    const [w, h] = size.map((n) => Math.round(Number(n)));
    if (!(w > 0 && h > 0 && w <= 4096 && h <= 4096)) continue;
    images[name] = placeholderImage(name, w, h);
    placeholders.push(name);
  }
  return { bundle: { json: payload.json, strings, images }, placeholders };
}

/** Pixel size of each image the bundle carries (images that fail to load are left out). */
async function imageSizes(images: PassImages): Promise<Payload['images']> {
  const out: Payload['images'] = {};
  await Promise.all(
    IMAGE_NAMES.map(async (name) => {
      const src = images[name];
      if (!src) return;
      // The load event, not img.decode(), which can stay pending in a background tab; give up after 3 s.
      const size = await new Promise<[number, number] | null>((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => resolve(null), 3000);
        img.onload = () => {
          clearTimeout(timer);
          resolve(img.naturalWidth && img.naturalHeight ? [img.naturalWidth, img.naturalHeight] : null);
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        img.src = src;
      });
      // An unreadable image is left out of the link.
      if (size) out[name] = size;
    }),
  );
  return out;
}

/**
 * A stand-in for an image a shared link couldn't carry: same pixel size, so the pass lays out as the
 * original did; grey with a picture symbol, so it reads as a placeholder rather than artwork.
 */
export function placeholderImage(name: ImageName, w: number, h: number): string {
  const s = Math.min(w, h);
  // Picture symbol (frame, sun, hills), centred; left out where the image is too small to show it.
  const g = Math.min(s * 0.6, w * 0.5);
  const x = (w - g) / 2;
  const y = (h - g * 0.8) / 2;
  const symbol =
    g >= 12
      ? `<g fill="none" stroke="#fff" stroke-width="${Math.max(1, g * 0.06)}" stroke-linejoin="round" opacity="0.9">` +
        `<rect x="${x}" y="${y}" width="${g}" height="${g * 0.8}" rx="${g * 0.1}"/>` +
        `<circle cx="${x + g * 0.3}" cy="${y + g * 0.28}" r="${g * 0.09}" fill="#fff"/>` +
        `<path d="M${x + g * 0.08} ${y + g * 0.7} L${x + g * 0.38} ${y + g * 0.42} L${x + g * 0.58} ${y + g * 0.6} L${x + g * 0.72} ${y + g * 0.48} L${x + g * 0.92} ${y + g * 0.7}"/>` +
        `</g>`
      : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><pattern id="p" width="${Math.max(6, s / 6)}" height="${Math.max(6, s / 6)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="${Math.max(3, s / 12)}" height="${Math.max(6, s / 6)}" fill="#fff" opacity="0.12"/></pattern></defs>` +
    `<rect width="${w}" height="${h}" fill="#a1a1aa"/><rect width="${w}" height="${h}" fill="url(#p)"/>${symbol}` +
    `<title>${name}.png (placeholder)</title></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
