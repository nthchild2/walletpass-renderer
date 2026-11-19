import JSZip from 'jszip';
import { IMAGE_NAMES, type ImageName, type PassBundle, type PassImages, type PassJson } from './types';

/** Decode bytes that may be UTF-8 or UTF-16 (with or without BOM), as pass.strings often is. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  // UTF-16 without BOM: every other byte of ASCII text is zero.
  if (bytes.length >= 4 && bytes[1] === 0 && bytes[3] === 0) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[2] === 0) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/** Parse an Apple .strings file: `"key" = "value";` with C-style comments. */
export function parseStrings(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const re = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    out[unescape(m[1])] = unescape(m[2]);
  }
  return out;
}

function unescape(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, c: string) => {
    if (c[0] === 'u' && c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16));
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c === 'r') return '\r';
    return c;
  });
}

/** Parse pass.json leniently: strip a BOM and trailing commas, which Wallet tolerates. */
export function parsePassJson(text: string): PassJson {
  const clean = text.replace(/^﻿/, '');
  try {
    return JSON.parse(clean);
  } catch {
    return JSON.parse(clean.replace(/,\s*([}\]])/g, '$1'));
  }
}

const IMAGE_RE = /^(?:([^/]+)\.lproj\/)?(icon|logo|strip|background|thumbnail|footer)(@([23])x)?\.png$/i;

function pickLanguage(languages: string[]): string | undefined {
  if (languages.length === 0) return undefined;
  const prefs = (typeof navigator !== 'undefined' ? navigator.languages : []) ?? [];
  for (const pref of prefs) {
    const exact = languages.find((l) => l.toLowerCase() === pref.toLowerCase().replace('-', '_'));
    if (exact) return exact;
    const base = languages.find((l) => l.toLowerCase().split(/[-_]/)[0] === pref.toLowerCase().split('-')[0]);
    if (base) return base;
  }
  return languages.find((l) => l.toLowerCase().startsWith('en')) ?? languages[0];
}

export async function loadPkpass(file: Blob, fileName: string, language?: string): Promise<PassBundle> {
  const zip = await JSZip.loadAsync(file);
  // Some tools zip the pass inside a top-level folder; normalise paths relative to pass.json.
  const allPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir && !p.startsWith('__MACOSX/'));
  const passJsonPath = allPaths
    .filter((p) => p === 'pass.json' || p.endsWith('/pass.json'))
    .sort((a, b) => a.length - b.length)[0];
  if (!passJsonPath) throw new Error('No pass.json found in this file.');
  const root = passJsonPath.slice(0, -'pass.json'.length);
  const files = allPaths.filter((p) => p.startsWith(root)).map((p) => p.slice(root.length));
  const read = (p: string) => zip.file(root + p)!.async('uint8array');

  const json = parsePassJson(decodeText(await read('pass.json')));

  const languages = Array.from(
    new Set(files.map((f) => /^([^/]+)\.lproj\//.exec(f)?.[1]).filter((l): l is string => !!l)),
  ).sort();
  const lang = language && languages.includes(language) ? language : pickLanguage(languages);

  let strings: Record<string, string> = {};
  if (lang && files.includes(`${lang}.lproj/pass.strings`)) {
    strings = parseStrings(decodeText(await read(`${lang}.lproj/pass.strings`)));
  }

  // For each image, prefer the localized copy, then the highest resolution.
  const best: Partial<Record<ImageName, { path: string; score: number }>> = {};
  for (const f of files) {
    const m = IMAGE_RE.exec(f);
    if (!m) continue;
    const [, fileLang, rawName, , scale] = m;
    if (fileLang && fileLang !== lang) continue;
    const name = rawName.toLowerCase() as ImageName;
    const score = (fileLang ? 10 : 0) + (scale ? Number(scale) : 1);
    if (!best[name] || best[name]!.score < score) best[name] = { path: f, score };
  }
  const images: PassImages = {};
  for (const name of IMAGE_NAMES) {
    const hit = best[name];
    if (!hit) continue;
    const bytes = await read(hit.path);
    images[name] = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }));
  }

  return {
    json,
    images,
    strings,
    source: {
      fileName,
      files: files.sort(),
      language: lang,
      languages,
      signed: files.includes('signature') && files.includes('manifest.json'),
    },
  };
}

export async function loadPassFile(file: File, language?: string): Promise<PassBundle> {
  if (/\.json$/i.test(file.name)) {
    const json = parsePassJson(await file.text());
    return {
      json,
      images: {},
      strings: {},
      source: { fileName: file.name, files: ['pass.json'], languages: [], signed: false },
    };
  }
  return loadPkpass(file, file.name, language);
}
