import type { PassBundle, PassJson } from './types';

/**
 * Share links carry the pass in the URL hash: /#pass=<data>. The hash never reaches the server, so
 * nothing is stored anywhere. Only pass.json and the translations go in (a typical pass is about
 * 2 KB of link); images don't fit in a link, so the opened pass shows without them.
 *
 * <data> is "z" + base64url(deflate-raw(JSON)), or "j" + base64url(JSON) in browsers without
 * CompressionStream.
 */
const KEY = 'pass=';

interface Payload {
  v: 1;
  json: PassJson;
  strings: Record<string, string>;
}

export async function shareUrl(bundle: PassBundle): Promise<string> {
  const payload: Payload = { v: 1, json: bundle.json, strings: bundle.strings };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const data = typeof CompressionStream === 'undefined' ? 'j' + toBase64Url(bytes) : 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return `${window.location.origin}/#${KEY}${data}`;
}

/** The share data in a hash like "#pass=…", or null when the hash isn't a share link. */
export function readShareHash(hash = window.location.hash): string | null {
  const h = hash.replace(/^#/, '');
  return h.startsWith(KEY) ? h.slice(KEY.length) : null;
}

export async function decodeShare(data: string): Promise<PassBundle> {
  const kind = data[0];
  let bytes = fromBase64Url(data.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('unknown link format');
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Payload>;
  if (!payload || typeof payload.json !== 'object' || payload.json === null || Array.isArray(payload.json)) throw new Error('no pass in the link');
  const strings = payload.strings && typeof payload.strings === 'object' ? payload.strings : {};
  return { json: payload.json, strings, images: {} };
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
