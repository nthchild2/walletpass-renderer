import type { BucketSpec } from './fit';
import type { PassStyle } from './types';

/**
 * Row templates (PKPassBucketTemplate) per style, read from PassKitUI on iOS 27: height, minimum gap,
 * value font, label font metrics, label-to-value padding and whether values wrap onto two lines.
 * Widths come from the page (the row's own box).
 */

// Label fonts: x-height and line height (pt).
const MONO_12 = { labelXHeight: 6.4043, labelHeight: 14 + 1 / 3 }; // SF Mono Semibold 12 (and SF Pro Semibold 12)
const SF_11 = { labelXHeight: 5.8706, labelHeight: 13 + 1 / 3 }; // SF Pro Semibold 11 (boarding pass)
const SF_BOLD_11 = { labelXHeight: 5.9136, labelHeight: 13 + 1 / 3 }; // SF Pro Bold 11 (boarding-pass header)
const NO_LABEL = { labelXHeight: 9.5186, labelHeight: 0 }; // strip primaries: the label is drawn elsewhere

export type Slot = 'header' | 'primary' | 'secondary' | 'auxiliary' | 'auxiliary2';

const HEADER: BucketSpec = { height: 40, padding: 16, valueSize: 17, valueFont: 'mono', ...MONO_12, verticalPadding: -3, fromEnd: true };
const BOARDING_HEADER: BucketSpec = { height: 40, padding: 16, valueSize: 21, valueFont: 'sf', ...SF_BOLD_11, verticalPadding: -3, fromEnd: true };

const row = (padding: number, verticalPadding: number, canWrap = false): BucketSpec => ({
  height: 36,
  padding,
  valueSize: 20,
  valueFont: 'sf',
  ...MONO_12,
  verticalPadding,
  canWrap,
});

const STRIP_PRIMARY: BucketSpec = { height: 74, padding: 0, valueSize: 66, valueFont: 'sf', ...NO_LABEL, verticalPadding: 0 };

/** The template for a slot of a style (strip: the pass shows a strip image). */
export function bucketSpec(style: PassStyle, slot: Slot, strip: boolean): BucketSpec {
  if (slot === 'header') return style === 'boardingPass' ? BOARDING_HEADER : HEADER;
  switch (style) {
    case 'eventTicket':
      if (strip) return slot === 'primary' ? STRIP_PRIMARY : row(16, 0);
      if (slot === 'primary') return { height: 46, padding: 0, valueSize: 20, valueFont: 'sf', ...MONO_12, verticalPadding: -2, canWrap: true, prefersSingleLine: true };
      if (slot === 'secondary') return row(0, -2);
      if (slot === 'auxiliary') return row(16, -1, true);
      return row(16, 0);
    case 'generic':
      if (slot === 'primary') return { height: 88, padding: 0, valueSize: 30, valueFont: 'sf', ...MONO_12, verticalPadding: 0, canWrap: true, prefersSingleLine: true };
      return row(12, -2);
    case 'coupon':
      return slot === 'primary' ? STRIP_PRIMARY : row(16, -4);
    case 'storeCard':
      return slot === 'primary' ? STRIP_PRIMARY : row(16, 2);
    case 'boardingPass':
      if (slot === 'primary') return { height: 60, padding: 38, valueSize: 40, valueFont: 'sf', ...SF_11, verticalPadding: -3, even: true };
      return { height: 40, padding: 10, valueSize: 17, valueFont: 'sf', ...SF_11, verticalPadding: -2 };
  }
}
