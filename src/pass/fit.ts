import { useLayoutEffect, type RefObject } from 'react';

/**
 * Wallet shrinks field values to fit before truncating them. Measured in Apple's Add Pass sheet
 * (iOS 27 Simulator, same signed pass):
 *   - a row whose values don't fit shrinks them together: on an iPhone 17 both values in a
 *     two-field row came out at 0.66× (exactly the proportional fit), with ~2–4 pt between fields;
 *   - on an iPhone SE the split was uneven (0.51× and 0.65×), so the lowest observed scale is ~0.5;
 *   - shrunk text keeps its top edge (the baseline moves up);
 *   - labels and header values are never shrunk (the header value truncates at full size).
 * We fit proportionally with a 0.5× floor; below that the existing ellipsis truncation applies.
 *
 * Text is measured as laid out (not with canvas measureText): at small sizes SF Pro switches to its
 * Text optical size with looser tracking, so a value at 0.66× is wider than 0.66 × its full width,
 * just as in Wallet, where the shrunk Attendee / Venue values end up touching.
 */
export const MIN_SCALE = 0.5;

/** Width of an element's text as laid out, in CSS px (undoing any on-screen transform scale). */
function textWidth(el: Element | null, zoom: number): number {
  if (!el) return 0;
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width / zoom;
}

function resetValue(v: HTMLElement) {
  v.style.fontSize = '';
  v.style.lineHeight = '';
}

/** Fit the fields inside `container` (a row, or a single primary field) to its content width. */
export function fitFields(container: HTMLElement) {
  const fields = [...container.querySelectorAll<HTMLElement>('.field')].filter((f) => !f.classList.contains('field--header'));
  if (fields.length === 0) return;
  const values = fields.map((f) => f.querySelector<HTMLElement>('.field__value'));
  values.forEach((v) => v && resetValue(v));
  if (!container.offsetWidth) return;

  const zoom = container.getBoundingClientRect().width / container.offsetWidth || 1;
  const cs = getComputedStyle(container);
  const available = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const gap = (parseFloat(cs.columnGap) || 0) * (fields.length - 1);
  const labels = fields.map((f) => textWidth(f.querySelector('.field__label'), zoom));
  const base = values.map((v) => {
    const s = v ? getComputedStyle(v) : null;
    return { size: s ? parseFloat(s.fontSize) : 0, line: s ? parseFloat(s.lineHeight) : NaN };
  });
  const apply = (scale: number) =>
    values.forEach((v, i) => {
      if (!v) return;
      v.style.fontSize = `${base[i].size * scale}px`;
      if (Number.isFinite(base[i].line)) v.style.lineHeight = `${base[i].line * scale}px`;
    });
  const total = () => values.reduce((sum, v, i) => sum + Math.max(labels[i], textWidth(v, zoom)), 0) + gap;

  if (total() <= available + 0.5) return;
  apply(MIN_SCALE);
  if (total() > available) return; // even the floor doesn't fit: truncate at 0.5×
  let lo = MIN_SCALE;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    apply(mid);
    if (total() <= available) lo = mid;
    else hi = mid;
  }
  apply(lo);
}

/** Fit each field separately (boarding-pass origin / destination each have their own column). */
export function fitEachField(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>(':scope > .field').forEach((f) => fitFields(f));
}

/** Re-fit after render, when fonts finish loading, and when the container's size changes. */
export function useFit(ref: RefObject<HTMLElement | null>, key: string, each = false) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => (each ? fitEachField(el) : fitFields(el));
    run();
    let alive = true;
    document.fonts?.ready.then(() => alive && run()).catch(() => {});
    const ro = new ResizeObserver(() => run());
    ro.observe(el);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [ref, key, each]);
}
