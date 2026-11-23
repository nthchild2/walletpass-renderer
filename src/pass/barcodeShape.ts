/**
 * The symbol shapes PassKit draws. PassKit renders PDF417 and Aztec codes with Core Image
 * (CIPDF417BarcodeGenerator, CIAztecCodeGenerator) at their default settings; measured in the iOS
 * 27 Simulator, every PDF417 and Aztec code in PKPassView had Core Image's columns, rows and
 * layers. Both generators behave like ZXing's encoders, so this ports the parts that decide the
 * shape, and the preview then asks bwip-js for a symbol of exactly that shape.
 *
 * Checked against Core Image on 4,000 random messages: PDF417 shapes match for every ASCII message
 * (1,920 of 1,920); Aztec sizes for 99.7 % of them. Messages with bytes above 0x7F can come out a
 * few codewords off (Core Image's byte compaction differs slightly), and so a row or a layer off.
 */

// ---------- PDF417 ----------

const MIXED_RAW = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 38, 13, 9, 44, 58, 35, 45, 46, 36, 47, 43, 37, 42, 61, 94, 0, 32, 0, 0, 0];
const PUNCT_RAW = [59, 60, 62, 64, 91, 92, 93, 95, 96, 126, 33, 13, 9, 44, 58, 10, 45, 46, 36, 47, 34, 124, 42, 40, 41, 63, 123, 125, 39, 0];
const MIXED = new Int8Array(128).fill(-1);
const PUNCT = new Int8Array(128).fill(-1);
MIXED_RAW.forEach((b, i) => b > 0 && (MIXED[b] = i));
PUNCT_RAW.forEach((b, i) => b > 0 && (PUNCT[b] = i));
const isDigit = (c: number) => c >= 48 && c <= 57;
const isUpper = (c: number) => c === 32 || (c >= 65 && c <= 90);
const isLower = (c: number) => c === 32 || (c >= 97 && c <= 122);
const isMixed = (c: number) => c < 128 && MIXED[c] !== -1;
const isPunct = (c: number) => c < 128 && PUNCT[c] !== -1;
const isText = (c: number) => c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126);

function textCount(m: Uint8Array, start: number): number {
  let idx = start;
  while (idx < m.length) {
    let ch = m[idx];
    let n = 0;
    while (n < 13 && isDigit(ch) && idx < m.length) {
      n++;
      idx++;
      if (idx < m.length) ch = m[idx];
    }
    if (n >= 13) return idx - start - n;
    if (n > 0) continue;
    if (!isText(m[idx])) break;
    idx++;
  }
  return idx - start;
}

function binaryCount(m: Uint8Array, start: number): number {
  let idx = start;
  while (idx < m.length) {
    let ch = m[idx];
    let n = 0;
    while (n < 13 && isDigit(ch)) {
      n++;
      if (idx + n >= m.length) break;
      ch = m[idx + n];
    }
    if (n >= 13) return idx - start;
    let t = 0;
    ch = m[idx];
    while (t < 5 && isText(ch)) {
      t++;
      if (idx + t >= m.length) break;
      ch = m[idx + t];
    }
    if (t >= 5) return idx - start;
    idx++;
  }
  return idx - start;
}

/** Text compaction: the number of codewords, and the submode it ends in. */
function textCodewords(m: Uint8Array, start: number, count: number, submode: number): [number, number] {
  let values = 0;
  let sub = submode;
  let idx = 0;
  for (;;) {
    const ch = m[start + idx];
    if (sub === 0) {
      if (isUpper(ch)) values++;
      else if (isLower(ch)) { sub = 1; values++; continue; }
      else if (isMixed(ch)) { sub = 2; values++; continue; }
      else values += 2;
    } else if (sub === 1) {
      if (isLower(ch)) values++;
      else if (isUpper(ch)) values += 2;
      else if (isMixed(ch)) { sub = 2; values++; continue; }
      else values += 2;
    } else if (sub === 2) {
      if (isMixed(ch)) values++;
      else if (isUpper(ch)) { sub = 0; values++; continue; }
      else if (isLower(ch)) { sub = 1; values++; continue; }
      else {
        // (ZXing compares the absolute position with the run length here.)
        if (start + idx + 1 < count && isPunct(m[start + idx + 1])) { sub = 3; values++; continue; }
        values += 2;
      }
    } else if (isPunct(ch)) values++;
    else { sub = 0; values++; continue; }
    idx++;
    if (idx >= count) break;
  }
  return [Math.ceil(values / 2), sub];
}

/** Data codewords (without the length descriptor) of ZXing's PDF417 high-level encoding. */
export function pdf417Codewords(m: Uint8Array): number {
  let n = 0;
  let p = 0;
  let sub = 0;
  let mode: 'text' | 'num' | 'byte' = 'text';
  while (p < m.length) {
    let digits = 0;
    while (p + digits < m.length && isDigit(m[p + digits])) digits++;
    if (digits >= 13) {
      n += 1;
      for (let i = 0; i < digits; i += 44) n += Math.floor(Math.min(44, digits - i) / 3) + 1;
      mode = 'num';
      sub = 0;
      p += digits;
      continue;
    }
    const t = textCount(m, p);
    if (t >= 5 || digits === m.length) {
      if (mode !== 'text') {
        n++;
        mode = 'text';
        sub = 0;
      }
      const [cw, s] = textCodewords(m, p, t, sub);
      n += cw;
      sub = s;
      p += t;
      continue;
    }
    const b = binaryCount(m, p) || 1;
    if (b === 1 && mode === 'text') n += 2;
    else {
      n += 1 + Math.floor(b / 6) * 5 + (b % 6);
      mode = 'byte';
      sub = 0;
    }
    p += b;
  }
  return n;
}

export interface Pdf417Shape {
  columns: number;
  rows: number;
  /** Error correction level (0–8). */
  eclevel: number;
}

/** Core Image's PDF417 shape: the recommended error correction for the data, and the columns
 *  whose image (with its 2-module quiet zone, rows 3 modules tall) is closest to 3 : 1. */
export function pdf417Shape(bytes: Uint8Array): Pdf417Shape | null {
  const data = pdf417Codewords(bytes);
  const eclevel = data <= 40 ? 2 : data <= 160 ? 3 : data <= 320 ? 4 : 5;
  const total = data + 1 + 2 ** (eclevel + 1);
  let best: Pdf417Shape | null = null;
  let ratio = 0;
  for (let columns = 1; columns <= 30; columns++) {
    const rows = Math.max(3, Math.ceil(total / columns));
    if (Math.ceil(total / columns) < 3) break;
    if (rows > 90) continue;
    const r = (17 * columns + 73) / (3 * rows + 4);
    if (best && Math.abs(r - 3) > Math.abs(ratio - 3)) continue;
    ratio = r;
    best = { columns, rows, eclevel };
  }
  return best;
}

// ---------- Aztec ----------

const UPPER = 0, LOWER = 1, DIGIT = 2, MIX = 3, PUNC = 4;
const LATCH_BITS = [
  [0, 5, 5, 5, 10],
  [9, 0, 5, 5, 10],
  [4, 9, 0, 9, 14],
  [5, 5, 10, 0, 5],
  [5, 10, 10, 10, 0],
];
const CHAR = Array.from({ length: 5 }, () => new Uint8Array(256));
CHAR[UPPER][32] = 1;
for (let c = 65; c <= 90; c++) CHAR[UPPER][c] = c - 63;
CHAR[LOWER][32] = 1;
for (let c = 97; c <= 122; c++) CHAR[LOWER][c] = c - 95;
CHAR[DIGIT][32] = 1;
for (let c = 48; c <= 57; c++) CHAR[DIGIT][c] = c - 46;
CHAR[DIGIT][44] = 12;
CHAR[DIGIT][46] = 13;
[0, 32, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 27, 28, 29, 30, 31, 64, 92, 94, 95, 96, 124, 126, 127].forEach((c, i) => (CHAR[MIX][c] = i));
[13, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 58, 59, 60, 61, 62, 63, 91, 93, 123, 125].forEach((c) => (CHAR[PUNC][c] = 1));
const CAN_SHIFT = (from: number, to: number) => (to === PUNC && from !== PUNC) || (to === UPPER && (from === LOWER || from === DIGIT));
const shiftCost = (n: number) => (n > 62 ? 21 : n > 31 ? 20 : n > 0 ? 10 : 0);

/** A state of ZXing's Aztec HighLevelEncoder, keeping only what decides the bit count. */
class AzState {
  readonly mode: number;
  readonly bs: number;
  readonly bits: number;
  constructor(mode: number, bs: number, bits: number) {
    this.mode = mode;
    this.bs = bs;
    this.bits = bits;
  }
  latch(mode: number) {
    return new AzState(mode, 0, this.bits + (mode !== this.mode ? LATCH_BITS[this.mode][mode] : 0) + (mode === DIGIT ? 4 : 5));
  }
  shift() {
    return new AzState(this.mode, 0, this.bits + (this.mode === DIGIT ? 4 : 5) + 5);
  }
  binary() {
    let mode = this.mode;
    let bits = this.bits;
    if (mode === PUNC || mode === DIGIT) {
      bits += LATCH_BITS[mode][UPPER];
      mode = UPPER;
    }
    const delta = this.bs === 0 || this.bs === 31 ? 18 : this.bs === 62 ? 9 : 8;
    const s = new AzState(mode, this.bs + 1, bits + delta);
    return s.bs === 2047 + 31 ? s.end() : s;
  }
  end() {
    return this.bs === 0 ? this : new AzState(this.mode, 0, this.bits);
  }
  covers(o: AzState) {
    let n = this.bits + LATCH_BITS[this.mode][o.mode];
    if (this.bs < o.bs) n += shiftCost(o.bs) - shiftCost(this.bs);
    else if (this.bs > o.bs && o.bs > 0) n += 10;
    return n <= o.bits;
  }
}

function simplify(states: AzState[]): AzState[] {
  const out: AzState[] = [];
  outer: for (const s of states) {
    for (let i = 0; i < out.length; i++) {
      if (out[i].covers(s)) continue outer;
      if (s.covers(out[i])) out.splice(i--, 1);
    }
    out.push(s);
  }
  return out;
}

/** Bits of ZXing's (optimal) Aztec high-level encoding. */
export function aztecBits(m: Uint8Array): number {
  let states = [new AzState(UPPER, 0, 0)];
  for (let i = 0; i < m.length; i++) {
    const c = m[i];
    const next = m[i + 1];
    const pair = c === 13 && next === 10 ? 2 : c === 46 && next === 32 ? 3 : c === 44 && next === 32 ? 4 : c === 58 && next === 32 ? 5 : 0;
    const res: AzState[] = [];
    if (pair) {
      for (const s of states) {
        const nb = s.end();
        res.push(nb.latch(PUNC));
        if (s.mode !== PUNC) res.push(nb.shift());
        if (pair === 3 || pair === 4) res.push(nb.latch(DIGIT).latch(DIGIT));
        if (s.bs > 0) res.push(s.binary().binary());
      }
      i++;
    } else {
      for (const s of states) {
        const inCurrent = CHAR[s.mode][c] > 0;
        for (let mode = 0; mode <= PUNC; mode++) {
          if (!CHAR[mode][c]) continue;
          const nb = s.end();
          if (!inCurrent || mode === s.mode || mode === DIGIT) res.push(nb.latch(mode));
          if (!inCurrent && CAN_SHIFT(s.mode, mode)) res.push(nb.shift());
        }
        if (s.bs > 0 || !inCurrent) res.push(s.binary());
      }
    }
    states = simplify(res);
  }
  return Math.min(...states.map((s) => s.bits));
}

export interface AztecShape {
  compact: boolean;
  layers: number;
  /** Symbol width in modules, without the quiet zone. */
  size: number;
}

/** Core Image's Aztec symbol (fitted to its output): compact with 1–3 layers, else full; the
 *  smallest whose capacity holds the data with 23 % to spare: bits ≤ ⌊capacity × 0.77⌋ − 4. */
export function aztecShape(bytes: Uint8Array): AztecShape | null {
  const bits = aztecBits(bytes);
  // Compact 1–3 layers, then full 4–32 (Core Image never picks a compact 4-layer symbol).
  const sizes = [1, 2, 3].map((layers) => ({ compact: true, layers })).concat(Array.from({ length: 29 }, (_, i) => ({ compact: false, layers: i + 4 })));
  for (const { compact, layers } of sizes) {
    const capacity = ((compact ? 88 : 112) + 16 * layers) * layers;
    if (bits > Math.floor(capacity * 0.77) - 4) continue;
    const base = (compact ? 11 : 14) + layers * 4;
    return { compact, layers, size: compact ? base : base + 1 + 2 * Math.floor((Math.floor(base / 2) - 1) / 15) };
  }
  return null;
}
