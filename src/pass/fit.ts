import { useLayoutEffect, type RefObject } from 'react';

/**
 * How Wallet fits a row of fields ("bucket"): a port of PassKitUI's PKPassBucketView /
 * PKPassFieldView layout (iOS 27), read from the framework and checked against PKPassView renders
 * of test passes in the Simulator.
 *
 * Every row has a template (see BUCKETS in pass/buckets.ts): a width, a height, a minimum gap
 * between fields, the template value font, and whether values may wrap onto a second line.
 *
 * 1. Each field takes its natural width: max(label width, value width on one line).
 * 2. Wrapping rows (event-ticket primary and first auxiliary row, generic primary, the coupon /
 *    store-card caption): while the row is too wide, the widest field is narrowed by
 *    min(step, 25 % of its width, the overflow), where step = max(ceil(overflow / fields),
 *    min(overflow, max(ceil(ceil(width / fields) × 0.15), 1 px))). A narrowed value wraps onto
 *    two lines; if two lines aren't enough its font drops 1 pt at a time until it fits, or until
 *    its x-height falls below the label's x-height × the row scale (one step past that is kept).
 *    A value that still doesn't fit is cut to what fits, without an ellipsis.
 * 3. If the row still doesn't fit, one scale for the whole row is found by bisection (to 0.01)
 *    between the row's minimum scale (label x-height ÷ value x-height, e.g. 12.25 pt for 20 pt
 *    values under 12 pt labels) and 1. Fonts are rounded to quarter points; the gap scales too.
 *    Widths are measured at each field's frame from its template size (the size its last fit
 *    resolved) × the scale. A wrapping value that still loses lines when measured again at its
 *    frame pulls the row scale down to its share. These measurements set the label's size as a
 *    side effect while the frame keeps its last fit, so a value can show smaller than its frame
 *    was laid out for (FieldFit.shown, measureAt).
 * 4. Still too wide: fields are narrowed again and their text shrinks to fit (down to the
 *    minimum scale), then truncates with an ellipsis.
 * 5. All fields in a row take the tallest field's height; each value is centred vertically in the
 *    space under its label. Fields are spread edge to edge with at least the minimum gap (header:
 *    laid out from the right, first field rightmost, gaps exactly the minimum).
 *
 * Measurements are taken in CSS px on the page's own fonts. The CSS font sizes are Apple's sizes
 * scaled so that text widths match Wallet's (e.g. 19.3 px for Apple's 20 pt), so widths can be
 * compared with Apple's point constants directly.
 */

export interface BucketSpec {
  /** Template row height (pt): with the label, decides whether a second value line is allowed. */
  height: number;
  /** Minimum gap between fields (pt). */
  padding: number;
  /** Template value font size (pt, Apple's). */
  valueSize: number;
  /** Value font family, for its x-height curve. */
  valueFont: 'sf' | 'mono';
  /** Label font x-height (pt). */
  labelXHeight: number;
  /** Label line height (pt); 0 when the template hides labels. */
  labelHeight: number;
  /** Space between label and value (pt, may be negative). */
  verticalPadding: number;
  /** Values may wrap onto two lines. */
  canWrap?: boolean;
  /** A wrapped value only counts as fitting on one line (it may still show two lines). */
  prefersSingleLine?: boolean;
  /** Header: fields laid out from the right with exactly the minimum gap. */
  fromEnd?: boolean;
  /** Even layout (boarding-pass origin / destination): each field fits its own column. */
  even?: boolean;
}

const PX = 1 / 3;
/** Rounding to @3x pixels as PassKit does it (k / 3, not k × ⅓: the two differ in the last bit for
 *  a third of all k), so that sums and differences of these come out as the same doubles as on the
 *  device. That decides some fits: 202/3 − 43/3 is 52.99999999999999, not 53 (see measureAt). */
const roundPx = (v: number) => Math.round(v * 3) / 3;
const ceilPx = (v: number) => Math.ceil(v * 3 - 1e-6) / 3;
/** UIFont line height ÷ point size for SF Pro / SF Mono. */
const LINE = 1.1934;
/** A value's box height: UIKit rounds text sizes up to whole points (e.g. 24 for one line at 20 pt,
 *  34 for two lines at 14 pt). */
const boxHeight = (lines: number, size: number) => Math.ceil(lines * size * LINE - 1e-6);
const lineHeight = (size: number) => boxHeight(1, size);

/** x-height ÷ point size, from UIFont on iOS 27 (SF Pro changes optical size between 17 and 28 pt). */
const SF_XH: [number, number][] = [
  [17, 0.52637], [18, 0.52539], [19, 0.5249], [20, 0.52197], [21, 0.51904], [22, 0.5166],
  [23, 0.51367], [24, 0.51123], [25, 0.51025], [26, 0.50928], [27, 0.50879], [28, 0.50781],
];
export function xHeight(font: 'sf' | 'mono', size: number): number {
  if (font === 'mono') return size * 0.52881;
  if (size <= SF_XH[0][0]) return size * SF_XH[0][1];
  for (let i = 1; i < SF_XH.length; i++) {
    const [s1, r1] = SF_XH[i];
    if (size <= s1) {
      const [s0, r0] = SF_XH[i - 1];
      return size * (r0 + ((r1 - r0) * (size - s0)) / (s1 - s0));
    }
  }
  return size * SF_XH[SF_XH.length - 1][1];
}

// ---------- Text measurement ----------

let measurer: HTMLDivElement | null = null;
function getMeasurer(): HTMLDivElement {
  if (!measurer || !measurer.isConnected) {
    measurer = document.createElement('div');
    measurer.setAttribute('aria-hidden', 'true');
    Object.assign(measurer.style, { position: 'absolute', left: '-10000px', top: '0', visibility: 'hidden', pointerEvents: 'none' });
    document.body.appendChild(measurer);
  }
  return measurer;
}

interface TextBox {
  w: number;
  /** Lines the text takes when laid out (wrapped, or split at line breaks). */
  lines: number;
}

class Measure {
  private style: CSSStyleDeclaration;
  private cache = new Map<string, TextBox>();
  constructor(
    private el: HTMLElement,
    private text: string,
  ) {
    this.style = getComputedStyle(el);
  }

  /** Lay out the text at a CSS font size; width null = no wrapping (lines split only at \n). */
  box(cssSize: number, width: number | null): TextBox {
    const key = `${cssSize}|${width}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const m = getMeasurer();
    const s = this.style;
    Object.assign(m.style, {
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontStyle: s.fontStyle,
      // Computed letter-spacing is in px at the element's own size; keep it proportional.
      letterSpacing: `${(parseFloat(s.letterSpacing) || 0) / (parseFloat(s.fontSize) || 1)}em`,
      textTransform: s.textTransform,
      fontSize: `${cssSize}px`,
      lineHeight: `${cssSize * 2}px`,
      // pre-wrap: like UIKit, a wrapped line's width includes the space it ends on.
      whiteSpace: width === null ? 'pre' : 'pre-wrap',
      overflowWrap: 'break-word',
      wordBreak: 'normal',
      width: width === null ? 'max-content' : `${width}px`,
      direction: this.el.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr',
    });
    m.textContent = this.text || ' ';
    const range = document.createRange();
    range.selectNodeContents(m);
    // Group the line boxes by their top edge.
    const rows = new Map<number, { l: number; r: number }>();
    for (const r of range.getClientRects()) {
      if (r.width === 0 && r.height === 0) continue;
      const k = Math.round(r.top);
      const row = rows.get(k);
      if (row) {
        row.l = Math.min(row.l, r.left);
        row.r = Math.max(row.r, r.right);
      } else rows.set(k, { l: r.left, r: r.right });
    }
    // (SF Mono's letter-spacing stands in for iOS's wider monospaced advances, last one included.)
    let w = 0;
    for (const row of rows.values()) w = Math.max(w, row.r - row.l);
    // A space hanging past the box doesn't widen the line beyond it.
    if (width !== null) w = Math.min(w, width);
    const lines = Math.max(1, Math.round(m.getBoundingClientRect().height / (cssSize * 2)));
    const out = { w, lines };
    this.cache.set(key, out);
    return out;
  }

  /** Width of the text truncated with an ellipsis to fit `width` on one line. */
  truncated(cssSize: number, width: number): number {
    const full = this.text;
    let lo = 0;
    let hi = full.length;
    let best = this.withText('…', () => this.box(cssSize, null).w);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const w = this.withText(full.slice(0, mid).trimEnd() + '…', () => this.box(cssSize, null).w);
      if (w <= width) {
        best = w;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best;
  }

  private withText<T>(text: string, fn: () => T): T {
    const saved = this.text;
    const cache = this.cache;
    this.text = text;
    this.cache = new Map();
    try {
      return fn();
    } finally {
      this.text = saved;
      this.cache = cache;
    }
  }
}

// ---------- One field ----------

interface Metrics {
  /** Apple font size of the value (pt). */
  size: number;
  /** Value box width / height (pt). */
  w: number;
  h: number;
  /** Lines shown, and lines the box is tall (more when hard line breaks are clipped). */
  lines: number;
  boxLines: number;
  /** Width needed with all lines (type 1) and with at most two (type 2), for the row scale. */
  fullH: number;
  /** Field size. */
  fieldW: number;
  fieldH: number;
}

class FieldFit {
  readonly label: HTMLElement | null;
  readonly value: HTMLElement;
  readonly text: string;
  readonly labelW: number;
  /** CSS px per Apple pt for this value. */
  readonly k: number;
  readonly cssLine: number;
  readonly marginTop: number;
  readonly key: string;
  private measure: Measure;
  /** Starting value size for the next fit (pt). */
  base: number;
  /** The field template's value size as PassKit keeps it (pt): the original size × the row scale
   *  when the row resets, then the resolved size after each sizeThatFits (_updateMetricsForSize
   *  writes it back with setValueFont:). Later fits and measurements start from it. */
  tpl: number;
  /** The size the value label shows (pt). PassKit's measuring calls (PKValueWidthForFieldView, the
   *  row's wrap check) set the label's text at the size they resolve, while the field's frame keeps
   *  its last sizeThatFits; so the label shows the last measurement's size, which can be smaller
   *  than its frame was laid out for. */
  shown: number;
  /** PKValueWidthForFieldView's per-layout cache: value size → value width. */
  readonly widthMemo = new Map<number, number>();
  bucketScale = 1;
  frameW = 0;
  m!: Metrics;
  /** Shrink-to-fit floor when the row falls back to it (UILabel minimumScaleFactor). */
  shrinkFloor: number | null = null;

  constructor(
    readonly el: HTMLElement,
    readonly spec: BucketSpec,
  ) {
    this.label = el.querySelector<HTMLElement>('.field__label');
    this.value = el.querySelector<HTMLElement>('.field__value')!;
    const multi = !!spec.canWrap;
    this.text = (this.value.dataset.text ?? this.value.textContent ?? '').replace(/\r\n?/g, '\n');
    const cs = getComputedStyle(this.value);
    this.k = parseFloat(cs.fontSize) / spec.valueSize;
    const lh = parseFloat(cs.lineHeight);
    this.cssLine = Number.isFinite(lh) ? lh / parseFloat(cs.fontSize) : LINE;
    this.marginTop = parseFloat(cs.marginTop) || 0;
    // Single-line values show only their first line.
    this.measure = new Measure(this.value, multi ? this.text : this.text.split('\n')[0]);
    this.labelW = this.label && spec.labelHeight > 0 ? ceilPx(new Measure(this.label, this.label.textContent ?? '').box(parseFloat(getComputedStyle(this.label).fontSize), null).w) : 0;
    this.key = el.dataset.key ?? '';
    this.base = spec.valueSize;
    this.tpl = spec.valueSize;
    this.shown = spec.valueSize;
  }

  /** Value text box (pt): UIKit rounds value widths up to whole points. */
  box(size: number, width: number | null): TextBox {
    const b = this.measure.box(size * this.k, width === null ? null : width);
    return { w: Math.ceil(b.w - 1e-6), lines: b.lines };
  }

  private get labelH() {
    return this.label && this.spec.labelHeight > 0 && this.label.textContent ? this.spec.labelHeight : 0;
  }

  private get vpad() {
    return this.labelH > 0 ? this.spec.verticalPadding : 0;
  }

  /** PKPassFieldView sizeThatFits: (W, H). */
  fit(W: number, H: number): Metrics {
    const spec = this.spec;
    const labelW = Math.min(this.labelW, W);
    const nat = this.box(this.base, null);
    const natH = boxHeight(nat.lines, this.base);
    const hAvail = Math.max(H - this.labelH - this.vpad, natH);
    let m: Omit<Metrics, 'fieldW' | 'fieldH'>;
    if (!spec.canWrap) {
      // One line; too long, it's truncated and its box is the truncated text's width.
      const w = nat.w <= W ? nat.w : Math.ceil(this.measure.truncated(this.base * this.k, W) - 1e-6);
      m = { size: this.base, w: Math.min(w, W), h: lineHeight(this.base), lines: 1, boxLines: 1, fullH: lineHeight(this.base) };
    } else {
      m = this.resize(W, hAvail, nat, natH);
    }
    const fieldW = Math.min(roundPx(Math.max(labelW, m.w)), W);
    const fieldH = roundPx(this.vpad + this.labelH + m.h);
    this.m = { ...m, fieldW, fieldH };
    this.shown = m.size;
    return this.m;
  }

  /** PKPassFieldView sizeThatFits: fits from the template's size and writes the resolved size back
   *  to the template; the field's frame follows from it. */
  sizeThatFits(W: number, H: number): Metrics {
    this.base = this.tpl;
    const m = this.fit(W, H);
    this.tpl = m.size;
    return m;
  }

  /** PassKit's measuring calls (_metricsForSize:inLayout:scale:): the value's metrics at the field's
   *  current frame from a given size, without touching the frame. The available height is the
   *  frame's minus the label's, so with frames in thirds of a point it can come out a hair short
   *  (67.333… − 14.333… = 52.99999999999999): a value that filled its box exactly then no longer
   *  fits and drops a point (PKPassView: a 22 pt name in a 340 × 53 pt frame shows at 21 pt).
   *  The label shows the size this resolves. */
  measureAt(size: number): Metrics {
    const saved = { m: this.m, base: this.base };
    this.base = size;
    const m = this.fit(this.frameW, saved.m.fieldH);
    this.m = saved.m;
    this.base = saved.base;
    return m;
  }

  /** PKPassFieldView _resizeMultiLineValueFontForAvailableSize: two lines, shrinking 1 pt at a time. */
  private resize(W: number, hAvail: number, nat: TextBox, natH: number): Omit<Metrics, 'fieldW' | 'fieldH'> {
    const N = 2;
    const P = !!this.spec.prefersSingleLine;
    const fitsLines = (lines: number) => lines === 1 || (lines <= N && !P);
    let size = this.base;
    let w: number, h: number, lines: number, fits: boolean;
    if (nat.w > W) {
      const b = this.box(size, W);
      w = b.w;
      lines = b.lines;
      h = boxHeight(lines, size);
      fits = fitsLines(lines);
    } else {
      // Fits on one line (or splits only at its own line breaks): the natural size counts as fitting.
      w = nat.w;
      h = natH;
      lines = 1;
      fits = true;
    }
    if (!fits && h > hAvail) {
      const labelXH = this.spec.labelXHeight;
      let ratio = xHeight(this.spec.valueFont, size) / labelXH;
      if (ratio >= this.bucketScale) {
        let trial = size;
        for (;;) {
          trial -= 1;
          if (trial < 1) break;
          const b = this.box(trial, W);
          const bh = boxHeight(b.lines, trial);
          const f2 = fitsLines(b.lines);
          // No smaller in either direction and still not fitting: try the next size down.
          if (!f2 && b.w >= w && bh >= h) continue;
          size = trial;
          w = b.w;
          h = bh;
          lines = b.lines;
          fits = f2;
          if (fits || h <= hAvail) break;
          ratio = xHeight(this.spec.valueFont, size) / labelXH;
          if (ratio < this.bucketScale) break;
        }
      }
    }
    const fullH = h;
    if (lines <= N && fits) {
      // Hard line breaks beyond two lines: the box keeps their height but shows two, centred.
      const hard = this.text.split('\n').length;
      const boxLines = nat.w <= W ? Math.max(1, hard) : lines;
      const bh = boxHeight(boxLines, size);
      return { size, w, h: bh, lines: Math.min(boxLines, N), boxLines, fullH: bh };
    }
    // Doesn't fit: cut to the lines that fit in the available height (at most two).
    const shown = Math.max(1, Math.min(N, fits ? lines : Math.floor((hAvail + 0.01) / (size * LINE))));
    const cut = shown === 1 ? Math.min(this.box(size, null).w, W) : w;
    return { size, w: cut, h: boxHeight(shown, size), lines: shown, boxLines: shown, fullH };
  }

  /** Field width at a row scale, as PKValueWidthForFieldView measures it: from the template's
   *  current size × the scale (to a quarter point), at the field's current frame, a wrapping value
   *  shrunk to fit as usual; value widths are cached per size for the row's layout. */
  widthAtScale(scale: number): number {
    const size = quarter(this.tpl * scale);
    let w = this.widthMemo.get(size);
    if (w === undefined) {
      const m = this.measureAt(size);
      w = this.spec.canWrap ? m.w : this.box(size, null).w;
      this.widthMemo.set(size, w);
    }
    return Math.max(this.labelW, w);
  }

  /** Apply the result to the DOM. */
  apply(rowH: number) {
    const { m, value, el } = this;
    const valueTop = (rowH - m.fieldH) / 2;
    el.style.width = `${this.frameW}px`;
    el.style.flex = 'none';
    // The frame is the last sizeThatFits; the text is the size the label was last measured at.
    const size = this.shown;
    const css = size * this.k;
    // Wrapped values: UIFont line spacing, in a box rounded up to whole points.
    const cssLine = this.spec.canWrap ? size * LINE : css * this.cssLine;
    value.style.fontSize = `${css}px`;
    value.style.lineHeight = `${cssLine}px`;
    if (this.spec.canWrap) {
      value.style.whiteSpace = 'pre-wrap';
      value.style.overflowWrap = 'break-word';
      value.style.textOverflow = 'clip';
      value.style.boxSizing = 'border-box';
      value.style.height = `${m.h}px`;
      value.style.maxHeight = 'none';
      value.style.overflow = 'hidden';
      // Clipped hard line breaks: the box keeps every line's height and shows two in its middle.
      if (m.boxLines > m.lines) {
        const pad = ((m.boxLines - m.lines) * cssLine) / 2;
        value.style.paddingTop = `${pad}px`;
        value.style.clipPath = `inset(${pad}px 0)`;
      } else if (size < m.size) {
        // Text smaller than its box (see shown): UILabel centres it vertically in its frame.
        const lines = Math.min(this.box(size, m.w).lines, 2);
        const pad = Math.max(0, (m.h - boxHeight(lines, size)) / 2);
        if (pad > 0) value.style.paddingTop = `${pad}px`;
      }
    }
    if (valueTop > 0) value.style.marginTop = `${this.marginTop + valueTop}px`;
    if (this.shrinkFloor !== null) shrinkToWidth(value, this.frameW, this.shrinkFloor);
  }

  reset() {
    this.shrinkFloor = null;
  }
}

/** Remove what a previous layout set, so computed styles are the stylesheet's again. */
function clearField(el: HTMLElement) {
  const v = el.querySelector<HTMLElement>('.field__value');
  if (v) for (const p of ['fontSize', 'lineHeight', 'whiteSpace', 'overflowWrap', 'textOverflow', 'height', 'maxHeight', 'boxSizing', 'paddingTop', 'overflow', 'clipPath', 'marginTop'] as const) v.style[p] = '';
  el.style.width = '';
  el.style.flex = '';
}

const quarter = (size: number) => Math.round(size * 4) / 4;

/** UILabel adjustsFontSizeToFitWidth: shrink the (single-line) text to the width, down to a floor. */
function shrinkToWidth(el: HTMLElement, width: number, floor: number) {
  const size = parseFloat(el.style.fontSize || getComputedStyle(el).fontSize);
  const range = document.createRange();
  range.selectNodeContents(el);
  const zoom = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
  const natural = range.getBoundingClientRect().width / zoom;
  if (natural <= width || natural === 0) return;
  const scale = Math.max(floor, width / natural);
  el.style.fontSize = `${size * scale}px`;
  el.style.lineHeight = el.style.lineHeight ? `${parseFloat(el.style.lineHeight) * scale}px` : '';
}

// ---------- One row ----------

interface State {
  avail: number;
  total: number;
  padding: number;
  minScale: number;
}

/** Lay out the fields of one row (the `.field` children of `container`). */
export function layoutBucket(container: HTMLElement, spec: BucketSpec) {
  const els = [...container.querySelectorAll<HTMLElement>(':scope > .field')];
  if (els.length === 0) return;
  els.forEach(clearField);
  const fields = els.map((el) => new FieldFit(el, spec));
  container.style.columnGap = '';
  const cs = getComputedStyle(container);
  const width = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  if (width <= 0) return;
  fields.forEach((f) => f.reset());

  if (spec.even) {
    container.style.removeProperty('--even-gap');
    const colW = (f: FieldFit) => (f.el.parentElement === container ? f.el.clientWidth || width / fields.length : width);
    const cols = fields.map(colW);
    // A value too wide for its column: one scale for both values and the gap between them, the
    // largest (by bisection, to 0.01) at which every value fits its column at the full gap
    // (measured in the Simulator: "SAN FRANCISCO" / "NYC" → both 20 pt, gap 19 pt, 160.33 pt columns).
    if (fields.length > 1 && fields.some((f, i) => f.box(spec.valueSize, null).w > cols[i] + 0.05)) {
      const fitsAt = (scale: number) => fields.every((f, i) => f.box(quarter(spec.valueSize * scale), null).w <= cols[i] + 0.05);
      let lo = Math.min(1, Math.max(0, spec.labelXHeight / xHeight(spec.valueFont, spec.valueSize)));
      let hi = 1;
      if (fitsAt(lo)) {
        for (let i = 0; i < 20 && hi - lo >= 0.01; i++) {
          const mid = hi - (hi - lo) / 2;
          if (fitsAt(mid)) lo = mid;
          else hi = mid;
        }
      }
      const size = quarter(spec.valueSize * lo);
      fields.forEach((f) => (f.base = size));
      container.style.setProperty('--even-gap', `${Math.max(roundPx(spec.padding * lo), PX)}px`);
    }
    // Each field fits its own column on its own.
    fields.forEach((f) => layoutSingle(f, colW(f)));
    return;
  }

  const n = fields.length;
  const minScale = Math.min(1, Math.max(0, spec.labelXHeight / xHeight(spec.valueFont, spec.valueSize)));

  const reset = (scale: number): State => {
    const s = Math.min(1, Math.max(scale, 0));
    const padding = s < 1 ? Math.max(roundPx(spec.padding * s), PX) : spec.padding;
    const size = s < 1 ? quarter(spec.valueSize * s) : spec.valueSize;
    let total = 0;
    for (const f of fields) {
      // _resetFieldTemplatesWithBucketScale: the template goes back to its original size × the scale.
      f.tpl = Math.min(size, spec.valueSize);
      f.bucketScale = s;
      f.shrinkFloor = null;
      const m = f.sizeThatFits(width, spec.height);
      f.frameW = m.fieldW;
      total += m.fieldW;
    }
    return { avail: width - padding * (n - 1), total: roundPx(total), padding, minScale };
  };

  /** _measureAndFitVariablySizedSubviews: narrow the widest fields until the row fits. */
  const narrow = (st: State, shrinkMode: boolean): State => {
    let excess = st.total - st.avail;
    if (!(st.total > st.avail) || excess < PX) return st;
    let candidates = fields;
    // Wrap passes only narrow values that can wrap (every field in a row shares the template).
    if (!shrinkMode && !spec.canWrap) candidates = [];
    if (candidates.length === 0) return st;
    let stepA: number, minW: number;
    if (n >= 2) {
      stepA = Math.ceil(excess / n);
      minW = Math.max(Math.ceil(Math.ceil(st.avail / n) * 0.15), PX);
    } else {
      stepA = excess;
      minW = PX;
    }
    const d14 = excess / minW <= 2 ? excess : minW;
    const step = Math.max(stepA, d14);
    let total = st.total;
    for (;;) {
      // The widest field; between equals, the one whose key sorts last.
      let widest = candidates[0];
      for (const f of candidates.slice(1)) {
        if (f.frameW > widest.frameW || (f.frameW === widest.frameW && widest.key.localeCompare(f.key, undefined, { numeric: true }) < 0)) widest = f;
      }
      const w = widest.frameW;
      if (w <= 0) break;
      let r = excess;
      if (excess > d14 && n >= 2) r = Math.min(roundPx(Math.max(0.25 * w, PX)), excess);
      r = Math.min(step, r);
      if (r <= 0 || r >= w) break;
      const req = roundPx(w - r);
      const m = widest.sizeThatFits(req, spec.height);
      let newW = m.fieldW;
      if (shrinkMode) {
        if (newW - w < PX) newW = req;
        widest.shrinkFloor = Math.min(widest.bucketScale, st.minScale) / Math.max(widest.bucketScale, 1e-6);
      }
      widest.frameW = newW;
      const newTotal = roundPx(total + newW - w);
      const progress = newTotal < total;
      total = newTotal;
      excess = roundPx(total - st.avail);
      if (!(total > st.avail && excess > 0 && progress)) break;
    }
    return { ...st, total };
  };

  /** Sum of field widths at a row scale (fields keep their current widths). */
  const widthAt = (scale: number) => fields.reduce((s, f) => s + f.widthAtScale(scale), 0);

  let st = reset(1);
  st = narrow(st, false);
  // Widths here are the browser's, which can differ from UIKit's by a hair: allow 0.05 pt.
  const over = (w: number) => w > st.avail + 0.05;
  let s14 = 1;
  if (over(widthAt(1))) {
    s14 = Math.max(st.minScale, 0);
    if (Math.abs(1 - s14) >= 1e-7 && !over(widthAt(s14)) && 1 - s14 >= 0.01) {
      let lo = s14;
      let hi = 1;
      for (let i = 0; i < 20 && hi - lo >= 0.01; i++) {
        const mid = hi - (hi - lo) / 2;
        if (over(widthAt(mid))) hi = mid;
        else lo = mid;
      }
      s14 = lo;
    }
  }
  // Wrapped values that had to shrink and still lose lines pull the row scale down with them.
  // PassKit measures each one again at its frame, from the template's (resolved) size
  // (_valueSizeThatFits:type: 1 and 2): a value cut to two lines in the first pass often fits two
  // lines a few points smaller in the frame it got, and then pulls nothing down (the label shows
  // that smaller size; PKPassView: a long name at 17 pt in a frame laid out at 20 pt).
  let d15 = 1;
  if (spec.canWrap) {
    for (const f of fields) {
      const fontRatio = f.tpl < spec.valueSize ? f.tpl / spec.valueSize : 1;
      const m = f.measureAt(f.tpl);
      const h1 = m.fullH;
      const h2 = m.h;
      if (h2 > 0 && h1 > h2) d15 = Math.min(d15, fontRatio * (h2 / h1));
    }
  }
  const scale = s14 >= d15 ? d15 : s14;
  if (scale < 1) {
    st = reset(Math.max(scale, st.minScale));
    st = narrow(st, false);
  }
  if (st.total > st.avail) st = narrow(st, true);

  // Equal heights; values centred under their labels.
  const rowH = Math.max(...fields.map((f) => f.m.fieldH));
  fields.forEach((f) => f.apply(rowH));

  const sum = fields.reduce((s, f) => s + f.frameW, 0);
  const gap = n > 1 ? (spec.fromEnd ? st.padding : Math.max(roundPx((width - sum) / (n - 1)), st.padding)) : 0;
  container.style.columnGap = `${gap}px`;
}

/** A single field in its own column (boarding-pass origin / destination). */
function layoutSingle(f: FieldFit, width: number) {
  const m = f.fit(width, f.spec.height);
  f.frameW = m.fieldW;
  if (m.fieldW < width && f.box(f.base, null).w > width) {
    // Shrinks to fit, but never below the row's minimum size (the label's x-height): a pair the
    // row has already scaled down to it is only truncated (PKPassView: an overlong origin stays
    // 11.5 pt and is cut with an ellipsis).
    const min = (f.spec.labelXHeight / xHeight(f.spec.valueFont, f.spec.valueSize)) * f.spec.valueSize;
    f.shrinkFloor = Math.min(1, min / f.base);
  }
  f.apply(m.fieldH);
  f.el.style.width = '';
  f.el.style.flex = '';
}

/** Re-fit after render, when fonts finish loading, and when the container's size changes. */
export function useFit(ref: RefObject<HTMLElement | null>, key: string, spec: BucketSpec | null) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !spec) return;
    const run = () => layoutBucket(el, spec);
    run();
    let alive = true;
    document.fonts?.ready.then(() => alive && run()).catch(() => {});
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastW) {
        lastW = el.clientWidth;
        run();
      }
    });
    ro.observe(el);
    return () => {
      alive = false;
      ro.disconnect();
    };
    // spec is a module constant per slot; key covers content and size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, key, spec]);
}
