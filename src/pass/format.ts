import { encodeMessage } from './encoding';
import {
  allowsAlignment,
  BARCODE_FORMATS,
  type BarcodeFormat,
  type PassBarcode,
  FIELD_GROUPS,
  fieldLimit,
  getBarcode,
  getStyle,
  IMAGE_NAMES,
  sharesSecondaryRow,
  STYLE_IMAGES,
  type DateStyle,
  type PassBundle,
  type PassField,
} from './types';

/** Accept Wallet's `rgb(r, g, b)` strings, plus hex for convenience. */
export function parseColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(v);
  if (rgb) return `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  return undefined;
}

export function colorToHex(value: unknown): string {
  const c = parseColor(value);
  if (!c) return '#000000';
  if (c.startsWith('#')) {
    if (c.length === 4) return '#' + [...c.slice(1)].map((x) => x + x).join('');
    return c;
  }
  const [r, g, b] = c.match(/\d+/g)!.map(Number);
  return '#' + [r, g, b].map((n) => Math.min(255, n).toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

export function localize(text: string | number | undefined, strings: Record<string, string>): string {
  if (text === undefined || text === null) return '';
  const s = String(text);
  return strings[s] ?? s;
}

const STYLE_MAP: Record<DateStyle, 'short' | 'medium' | 'long' | 'full' | undefined> = {
  PKDateStyleNone: undefined,
  PKDateStyleShort: 'short',
  PKDateStyleMedium: 'medium',
  PKDateStyleLong: 'long',
  PKDateStyleFull: 'full',
};

// Wallet dates are W3C/ISO 8601 with a time zone, e.g. 2026-12-04T19:30-08:00.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Format a field's value the way Wallet would: dates, numbers, currency, localization. */
export function formatFieldValue(field: PassField, strings: Record<string, string>): string {
  const raw = field.value;
  if (raw === undefined || raw === null) return '';

  if ((field.dateStyle || field.timeStyle) && typeof raw === 'string' && ISO_DATE.test(raw.trim())) {
    const date = new Date(raw.trim());
    if (!Number.isNaN(date.getTime())) {
      const dateStyle = field.dateStyle ? STYLE_MAP[field.dateStyle] : undefined;
      const timeStyle = field.timeStyle ? STYLE_MAP[field.timeStyle] : undefined;
      if (!dateStyle && !timeStyle) return '';
      if (field.isRelative && dateStyle) {
        const rel = relativeDate(date, timeStyle);
        if (rel) return rel;
      }
      const opts: Intl.DateTimeFormatOptions = { dateStyle, timeStyle };
      if (field.ignoresTimeZone) {
        // Show the wall-clock time written in the pass, regardless of viewer's zone.
        const m = /([+-]\d{2}):?(\d{2})$|Z$/.exec(raw.trim());
        const offsetMin = m && m[1] ? (Number(m[1]) * 60 + Math.sign(Number(m[1]) || 1) * Number(m[2])) : 0;
        const shifted = new Date(date.getTime() + offsetMin * 60_000);
        opts.timeZone = 'UTC';
        return new Intl.DateTimeFormat(undefined, opts).format(shifted);
      }
      return new Intl.DateTimeFormat(undefined, opts).format(date);
    }
  }

  const num = typeof raw === 'number' ? raw : undefined;
  if (num !== undefined) {
    if (field.currencyCode) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: field.currencyCode }).format(num);
      } catch {
        /* invalid currency code: fall through */
      }
    }
    switch (field.numberStyle) {
      case 'PKNumberStylePercent':
        return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(num);
      case 'PKNumberStyleScientific':
        return new Intl.NumberFormat(undefined, { notation: 'scientific' }).format(num);
      case 'PKNumberStyleSpellOut':
        return spellOut(num);
      case 'PKNumberStyleDecimal':
        return new Intl.NumberFormat(undefined).format(num);
      default:
        return String(num);
    }
  }

  return localize(raw, strings);
}

/** "Today", "Tomorrow, 9:00 PM" and the like, for fields with isRelative; undefined beyond a week. */
function relativeDate(date: Date, timeStyle?: 'short' | 'medium' | 'long' | 'full'): string | undefined {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(new Date())) / 86_400_000);
  if (Math.abs(days) > 6) return undefined;
  const day = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(days, 'day');
  const cap = day.charAt(0).toUpperCase() + day.slice(1);
  return timeStyle ? `${cap}, ${new Intl.DateTimeFormat(undefined, { timeStyle }).format(date)}` : cap;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function spellOut(n: number): string {
  if (!Number.isInteger(n) || Math.abs(n) >= 1e9) return String(n);
  if (n < 0) return 'minus ' + spellOut(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + spellOut(n % 100) : '');
  for (const [size, word] of [[1e6, 'million'], [1e3, 'thousand']] as const) {
    if (n >= size) return spellOut(Math.floor(n / size)) + ' ' + word + (n % size ? ' ' + spellOut(n % size) : '');
  }
  return String(n);
}

export function alignClass(field: PassField, fallback: 'left' | 'center' | 'right' = 'left'): string {
  switch (field.textAlignment) {
    case 'PKTextAlignmentLeft':
      return 'left';
    case 'PKTextAlignmentCenter':
      return 'center';
    case 'PKTextAlignmentRight':
      return 'right';
    default:
      return fallback;
  }
}

/** Top-level keys Apple documents as working only for poster event tickets. */
const POSTER_ONLY_KEYS = [
  'accessibilityURL', 'addOnURL', 'auxiliaryStoreIdentifiers', 'bagPolicyURL', 'contactVenueEmail',
  'contactVenuePhoneNumber', 'contactVenueWebsite', 'directionsInformationURL', 'eventLogoText',
  'footerBackgroundColor', 'merchandiseURL', 'orderFoodURL', 'parkingInformationURL', 'purchaseParkingURL',
  'sellURL', 'suppressHeaderDarkening', 'transferURL', 'transitInformationURL', 'useAutomaticColors',
] as const;

export interface Issue {
  level: 'error' | 'warning' | 'info';
  message: string;
}

const REQUIRED_KEYS = [
  'formatVersion',
  'passTypeIdentifier',
  'serialNumber',
  'teamIdentifier',
  'organizationName',
  'description',
] as const;

/** Lightweight checks against Apple's pass.json rules for the classic styles. */
export function validate(bundle: PassBundle, ios27 = true): Issue[] {
  const { json, images, source } = bundle;
  const issues: Issue[] = [];
  const style = getStyle(json);

  if (!style) {
    issues.push({
      level: 'error',
      message: 'No classic pass style found (boardingPass, coupon, eventTicket, generic or storeCard).',
    });
  }
  for (const k of REQUIRED_KEYS) {
    if (json[k] === undefined || json[k] === '') issues.push({ level: 'warning', message: `Missing required key "${k}".` });
  }
  if (json.formatVersion !== undefined && json.formatVersion !== 1) {
    issues.push({ level: 'warning', message: `formatVersion should be 1 (found ${String(json.formatVersion)}).` });
  }
  for (const k of ['backgroundColor', 'foregroundColor', 'labelColor'] as const) {
    if (json[k] !== undefined && !parseColor(json[k])) {
      issues.push({ level: 'warning', message: `${k} "${String(json[k])}" is not a valid rgb() color.` });
    }
  }
  if (source && !images.icon) issues.push({ level: 'warning', message: 'Missing icon.png (required by Wallet).' });

  if (style) {
    const s = json[style]!;
    if (style === 'boardingPass' && !s.transitType) {
      issues.push({ level: 'warning', message: 'Boarding passes require a transitType.' });
    }
    const allowed = new Set(STYLE_IMAGES[style]);
    for (const name of IMAGE_NAMES) {
      if (images[name] && !allowed.has(name)) {
        issues.push({ level: 'info', message: `${name}.png is not shown on ${style} passes.` });
      }
    }
    if (style === 'eventTicket' && images.strip && (images.background || images.thumbnail)) {
      issues.push({ level: 'info', message: 'Event tickets with a strip image ignore background and thumbnail images.' });
    }
    const keys = new Set<string>();
    for (const group of FIELD_GROUPS) {
      for (const f of s[group] ?? []) {
        const name = f.key ? `"${f.key}"` : `A field in ${group}`;
        if (!f.key) issues.push({ level: 'warning', message: `A field in ${group} has no key.` });
        else if (keys.has(f.key)) issues.push({ level: 'warning', message: `Field key "${f.key}" is used more than once.` });
        keys.add(f.key);
        if (f.textAlignment && !allowsAlignment(group)) {
          issues.push({ level: 'warning', message: `${name}: textAlignment is invalid for ${group === 'backFields' ? 'back' : 'primary'} fields, so Wallet ignores it.` });
        }
        if (f.dataDetectorTypes && group !== 'backFields') {
          issues.push({ level: 'info', message: `${name}: data detectors only apply to back fields.` });
        }
        if (f.row !== undefined && (group !== 'auxiliaryFields' || style !== 'eventTicket')) {
          issues.push({ level: 'info', message: `${name}: "row" only applies to auxiliary fields on event tickets.` });
        }
        if (f.row !== undefined && f.row !== 0 && f.row !== 1) {
          issues.push({ level: 'warning', message: `${name}: "row" must be 0 or 1.` });
        }
        if (typeof f.attributedValue === 'string' && /<(?!\/?a[\s>])[a-z/][^>]*>/i.test(f.attributedValue)) {
          issues.push({ level: 'warning', message: `${name}: attributedValue only supports the <a> tag; other tags are ignored.` });
        }
        if (f.changeMessage && !f.changeMessage.includes('%@')) {
          issues.push({ level: 'warning', message: `${name}: changeMessage needs a %@ placeholder for the new value.` });
        }
        if ((f.numberStyle || f.currencyCode) && typeof f.value !== 'number') {
          issues.push({ level: 'warning', message: `${name}: numberStyle and currencyCode only apply when value is a number.` });
        }
        if ((f.dateStyle || f.timeStyle) && typeof f.value === 'string' && !/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(f.value.trim())) {
          issues.push({ level: 'warning', message: `${name}: a date value needs a time and a time zone (e.g. 2026-12-04T19:30-06:00).` });
        }
      }
    }
    // Fields beyond what Wallet shows.
    const over = (n: number, limit: number, what: string) => {
      if (n > limit) issues.push({ level: 'warning', message: `${n} ${what}; Wallet shows ${limit}, the rest are hidden.` });
    };
    over((s.headerFields ?? []).length, fieldLimit(json, style, 'headerFields'), 'header fields');
    over((s.primaryFields ?? []).length, fieldLimit(json, style, 'primaryFields'), 'primary fields');
    if (sharesSecondaryRow(json, style)) {
      over((s.secondaryFields ?? []).length + (s.auxiliaryFields ?? []).length, 4, 'secondary + auxiliary fields');
    } else if (style === 'eventTicket') {
      over((s.secondaryFields ?? []).length, 4, 'secondary fields');
      over((s.auxiliaryFields ?? []).filter((f) => f.row !== 1).length, 4, 'fields in auxiliary row 1');
      over((s.auxiliaryFields ?? []).filter((f) => f.row === 1).length, 4, 'fields in auxiliary row 2');
    } else {
      over((s.secondaryFields ?? []).length, fieldLimit(json, style, 'secondaryFields'), 'secondary fields');
      over((s.auxiliaryFields ?? []).length, fieldLimit(json, style, 'auxiliaryFields'), 'auxiliary fields');
    }
  }

  // ---- Barcodes (Pass.Barcodes) ----
  const list: PassBarcode[] = Array.isArray(json.barcodes) ? json.barcodes : json.barcode ? [json.barcode] : [];
  if (!Array.isArray(json.barcodes) && json.barcode) {
    issues.push({ level: 'warning', message: 'The "barcode" key is deprecated. Use "barcodes" (an array) instead.' });
  }
  list.forEach((b, i) => {
    const which = list.length > 1 ? `Barcode ${i + 1}` : 'The barcode';
    if (!b || typeof b !== 'object') return;
    if (!BARCODE_FORMATS[b.format as BarcodeFormat]) issues.push({ level: 'warning', message: `${which} has an unknown format "${String(b.format)}".` });
    if (!b.message) issues.push({ level: 'warning', message: `${which} has no message (required).` });
    if (!b.messageEncoding) {
      issues.push({ level: 'warning', message: `${which} has no messageEncoding (required), e.g. "iso-8859-1".` });
    } else if (b.message) {
      const enc = encodeMessage(b.message, b.messageEncoding);
      if (!enc.known) issues.push({ level: 'warning', message: `${which}: unknown messageEncoding "${b.messageEncoding}" (previewed as UTF-8).` });
      if (enc.unmappable.length) {
        issues.push({ level: 'warning', message: `${which}: "${[...new Set(enc.unmappable)].join('')}" can't be encoded as ${b.messageEncoding}; it becomes "?".` });
      }
    }
  });
  if (list.length > 0) {
    const shownNew = getBarcode(json, true);
    const shownOld = getBarcode(json, false);
    if (!getBarcode(json, ios27)) {
      issues.push({ level: ios27 ? 'warning' : 'info', message: `No barcode here can be displayed on ${ios27 ? 'iOS 27+' : 'iOS 26 and earlier'}, so Wallet shows none.` });
    } else if (shownNew && BARCODE_FORMATS[shownNew.format]?.ios27 && !shownOld) {
      issues.push({ level: 'info', message: `${BARCODE_FORMATS[shownNew.format].label.replace(' (iOS 27+)', '')} needs iOS 27. Add a QR, PDF417, Aztec or Code 128 barcode after it as a fallback for older iOS.` });
    }
  }

  // ---- Keys that don't apply to classic passes, or are deprecated ----
  const posterOnly = POSTER_ONLY_KEYS.filter((k) => json[k] !== undefined);
  if (posterOnly.length) {
    issues.push({ level: 'info', message: `Only poster event tickets use ${posterOnly.join(', ')}; classic passes ignore ${posterOnly.length > 1 ? 'them' : 'it'}.` });
  }
  if (json.relevantDate !== undefined) issues.push({ level: 'info', message: '"relevantDate" is deprecated. Use "relevantDates" instead.' });
  if (Array.isArray(json.locations) && json.locations.length > 10) {
    issues.push({ level: 'warning', message: `${json.locations.length} locations; Apple allows up to 10.` });
  }
  if (style) {
    const s = json[style] as Record<string, unknown>;
    if (s.transitType !== undefined && style !== 'boardingPass') {
      issues.push({ level: 'warning', message: '"transitType" is invalid for passes other than boarding passes.' });
    }
    if (s.additionalInfoFields !== undefined) {
      issues.push({ level: 'info', message: 'Only poster event tickets show additionalInfoFields; classic passes ignore them.' });
    }
  }
  if (json.expirationDate && !/T\d{2}:\d{2}/.test(json.expirationDate)) {
    issues.push({ level: 'warning', message: 'expirationDate needs a complete date with hours and minutes.' });
  }
  if (json.preferredStyleSchemes || json.semantics) {
    issues.push({
      level: 'info',
      message: 'This pass declares newer (poster/semantic) styles. Only the classic layout is rendered here.',
    });
  }
  if (source && source.files.length > 1 && !source.signed) {
    issues.push({ level: 'info', message: 'Pass is unsigned (no signature file). Wallet would refuse to install it, but it renders fine here.' });
  }
  return issues;
}
