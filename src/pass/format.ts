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

/**
 * A color's lightness as PassKit measures it (drawn into a 1-pixel gray bitmap): luminance with
 * D50-adapted sRGB weights, encoded back with the sRGB curve. 0 = black, 1 = white.
 */
export function colorLightness(color: string): number {
  const hex = colorToHex(color);
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const y = 0.2225 * lin[0] + 0.7169 * lin[1] + 0.0606 * lin[2];
  return y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055;
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

// Wallet dates are W3C/ISO 8601 date-times with a time zone, e.g. 2026-12-04T19:30-08:00. PassKit
// shows nothing for anything else in a field with a date or time style (a date without a time, a
// date-time without a zone, a number, plain text).
/** iOS's NumberFormatter rounds half to even (¥1,234.5 → ¥1,234); Intl's default rounds half up. */
const HALF_EVEN = { roundingMode: 'halfEven' } as Intl.NumberFormatOptions;

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Format a field's value the way Wallet does (checked against PassKit, iOS 27): dates, numbers,
 * currency, localization. `locale` defaults to the viewer's, as Wallet uses the phone's.
 */
export function formatFieldValue(field: PassField, strings: Record<string, string>, locale?: string): string {
  const raw = field.value;
  if (raw === undefined || raw === null) return '';

  if (field.dateStyle !== undefined || field.timeStyle !== undefined) {
    if (typeof raw !== 'string' || !ISO_DATETIME.test(raw.trim())) return '';
    const date = new Date(raw.trim());
    if (Number.isNaN(date.getTime())) return '';
    return formatDate(raw.trim(), date, field, locale);
  }

  if (typeof raw === 'number') {
    // numberStyle wins over currencyCode.
    switch (field.numberStyle) {
      case 'PKNumberStylePercent':
        return new Intl.NumberFormat(locale, { style: 'percent', ...HALF_EVEN }).format(raw);
      case 'PKNumberStyleScientific':
        return new Intl.NumberFormat(locale, { notation: 'scientific', maximumFractionDigits: 20 }).format(raw);
      case 'PKNumberStyleSpellOut':
        return spellOut(raw);
      case 'PKNumberStyleDecimal':
        return new Intl.NumberFormat(locale, HALF_EVEN).format(raw);
    }
    if (field.currencyCode) {
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: field.currencyCode, ...HALF_EVEN }).format(raw);
      } catch {
        /* invalid currency code: fall through */
      }
    }
    return String(raw);
  }

  return localize(raw, strings);
}

function formatDate(raw: string, date: Date, field: PassField, locale?: string): string {
  const dateStyle = field.dateStyle ? STYLE_MAP[field.dateStyle] : undefined;
  const timeStyle = field.timeStyle ? STYLE_MAP[field.timeStyle] : undefined;
  if (!dateStyle && !timeStyle) return '';
  let when = date;
  let timeZone: string | undefined;
  if (field.ignoresTimeZone) {
    // The wall-clock time written in the pass, whatever the viewer's zone.
    const m = /([+-])(\d{2}):?(\d{2})$/.exec(raw);
    const offsetMin = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
    when = new Date(date.getTime() + offsetMin * 60_000);
    timeZone = 'UTC';
  }
  // iOS (CLDR 42+) puts a narrow no-break space (U+202F) before AM / PM; browsers use a plain space.
  const fmt = (o: Intl.DateTimeFormatOptions, d = when) =>
    new Intl.DateTimeFormat(locale, { ...o, timeZone })
      .formatToParts(d)
      .map((p, i, all) => (p.type === 'literal' && p.value === ' ' && all[i + 1]?.type === 'dayPeriod' ? '\u202f' : p.value))
      .join('');

  let datePart = dateStyle ? fmt({ dateStyle }) : '';
  if (field.isRelative && dateStyle) {
    // Only today, tomorrow and yesterday become words; other days stay dates.
    const day = (d: Date) => {
      const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      return Date.parse(p) / 86_400_000;
    };
    const days = Math.round(day(when) - day(timeZone ? new Date(Date.now() + (when.getTime() - date.getTime())) : new Date()));
    if (Math.abs(days) <= 1) {
      const word = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
      datePart = word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
    }
  }
  if (!timeStyle) return datePart;
  const timePart = fmt({ timeStyle });
  if (!dateStyle) return timePart;
  return datePart + dateTimeJoiner(dateStyle, locale) + timePart;
}

/**
 * What goes between date and time. iOS joins a short date with a comma ("28/07/26, 6:30 a.m.") and
 * medium, long and full dates with the locale's "at" form ("28 Jul 2026 at 6:30 a.m."); browsers
 * use the comma for medium dates too, so the joiner is taken from the locale's long pattern.
 */
function dateTimeJoiner(dateStyle: 'short' | 'medium' | 'long' | 'full', locale?: string): string {
  const pattern = dateStyle === 'short' ? 'short' : 'long';
  const sample = new Date(Date.UTC(2001, 0, 2, 3, 4));
  const o = { timeZone: 'UTC' } as const;
  const both = new Intl.DateTimeFormat(locale, { ...o, dateStyle: pattern, timeStyle: 'short' }).format(sample);
  const d = new Intl.DateTimeFormat(locale, { ...o, dateStyle: pattern }).format(sample);
  const t = new Intl.DateTimeFormat(locale, { ...o, timeStyle: 'short' }).format(sample);
  return both.startsWith(d) && both.endsWith(t) && both.length > d.length + t.length ? both.slice(d.length, both.length - t.length) : ', ';
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** English spell-out, as iOS does it: "one thousand two hundred thirty-four", "twelve point five". */
function spellOut(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return String(n);
  if (n < 0) return 'minus ' + spellOut(-n);
  if (!Number.isInteger(n)) {
    const [int, frac] = String(n).split('.');
    return spellOut(Number(int)) + ' point ' + [...frac].map((d) => ONES[Number(d)]).join(' ');
  }
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + spellOut(n % 100) : '');
  for (const [size, word] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) {
    if (n >= size) return spellOut(Math.floor(n / size)) + ' ' + word + (n % size ? ' ' + spellOut(n % size) : '');
  }
  return String(n);
}

/**
 * CSS alignment for a field. Explicit Left / Center / Right win; "natural" (or no key) uses the
 * slot's default, given as start/end so it follows the text's direction: right-to-left labels and
 * values (Arabic, Hebrew…) mirror automatically.
 */
export function alignClass(field: PassField, natural: 'start' | 'end' | 'left' | 'center' | 'right' = 'start'): string {
  switch (field.textAlignment) {
    case 'PKTextAlignmentLeft':
      return 'left';
    case 'PKTextAlignmentCenter':
      return 'center';
    case 'PKTextAlignmentRight':
      return 'right';
    default:
      return natural;
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
    const v = json[k];
    if (v === undefined) continue;
    if (!parseColor(v)) {
      issues.push({ level: 'warning', message: `${k} "${String(v)}" is not a valid color. Use rgb(r, g, b).` });
    } else if (String(v).trim().startsWith('#')) {
      // Rendered here, but Apple only documents the rgb() form.
      issues.push({ level: 'warning', message: `${k} is hex ("${String(v)}"). Apple documents only rgb(): use "${hexToRgb(colorToHex(v))}".` });
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
    if (style === 'eventTicket' && images.strip && images.background) {
      issues.push({ level: 'info', message: 'Event tickets with a background image ignore the strip image (Wallet shows the background layout).' });
    } else if (style === 'eventTicket' && images.strip && images.thumbnail) {
      issues.push({ level: 'info', message: 'Event tickets with a strip image ignore the thumbnail image.' });
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

  // ---- Non-visual keys (Pass.Locations, Beacons, NFC, RelevantDates, …) ----
  const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const hasTime = (v: unknown) => typeof v === 'string' && /T\d{2}:\d{2}/.test(v);
  if (json.locations !== undefined) {
    if (!Array.isArray(json.locations)) issues.push({ level: 'warning', message: '"locations" must be an array.' });
    else
      json.locations.forEach((l: Record<string, unknown>, i: number) => {
        if (!isNum(l?.latitude) || !isNum(l?.longitude)) {
          issues.push({ level: 'warning', message: `Location ${i + 1} needs numeric "latitude" and "longitude" (required).` });
        }
        if (l?.altitude !== undefined && !isNum(l.altitude)) issues.push({ level: 'warning', message: `Location ${i + 1}: "altitude" must be a number (meters).` });
      });
  }
  if (json.maxDistance !== undefined && !(isNum(json.maxDistance) && (json.maxDistance as number) >= 0)) {
    issues.push({ level: 'warning', message: '"maxDistance" must be a number of meters.' });
  }
  if (json.beacons !== undefined) {
    if (!Array.isArray(json.beacons)) issues.push({ level: 'warning', message: '"beacons" must be an array.' });
    else
      json.beacons.forEach((b: Record<string, unknown>, i: number) => {
        if (typeof b?.proximityUUID !== 'string' || !b.proximityUUID) issues.push({ level: 'warning', message: `Beacon ${i + 1} needs a "proximityUUID" (required).` });
        for (const k of ['major', 'minor'] as const) {
          const v = b?.[k];
          if (v !== undefined && !(Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 65535)) {
            issues.push({ level: 'warning', message: `Beacon ${i + 1}: "${k}" must be a 16-bit unsigned integer (0–65535).` });
          }
        }
      });
  }
  if (json.nfc !== undefined) {
    const nfc = json.nfc as Record<string, unknown>;
    if (typeof nfc?.message !== 'string' || !nfc.message) issues.push({ level: 'warning', message: 'NFC needs a "message" (required).' });
    else if (new TextEncoder().encode(nfc.message).length > 64) {
      issues.push({ level: 'warning', message: 'NFC "message" is over 64 bytes; Wallet truncates it.' });
    }
    if (typeof nfc?.encryptionPublicKey !== 'string' || !nfc.encryptionPublicKey) {
      issues.push({ level: 'warning', message: 'NFC needs an "encryptionPublicKey" (required).' });
    }
    issues.push({ level: 'info', message: 'NFC passes need a special entitlement from Apple.' });
  }
  if (json.relevantDates !== undefined) {
    if (!Array.isArray(json.relevantDates)) issues.push({ level: 'warning', message: '"relevantDates" must be an array.' });
    else
      json.relevantDates.forEach((d: Record<string, unknown>, i: number) => {
        const which = `Relevant date ${i + 1}`;
        if (d?.date === undefined && d?.startDate === undefined) issues.push({ level: 'warning', message: `${which} needs "date" or "startDate".` });
        if (d?.startDate !== undefined && d?.endDate === undefined) issues.push({ level: 'warning', message: `${which}: "endDate" is required with "startDate".` });
        for (const k of ['date', 'startDate', 'endDate'] as const) {
          if (d?.[k] !== undefined && !hasTime(d[k])) issues.push({ level: 'warning', message: `${which}: "${k}" needs a complete date with hours and minutes.` });
        }
      });
  }
  if (json.authenticationToken !== undefined && json.webServiceURL === undefined) {
    issues.push({ level: 'info', message: '"authenticationToken" is only used with "webServiceURL", which is missing.' });
  }
  if (json.appLaunchURL !== undefined && !Array.isArray(json.associatedStoreIdentifiers)) {
    issues.push({ level: 'info', message: '"appLaunchURL" is passed to the app in "associatedStoreIdentifiers", which is missing.' });
  }
  if (json.groupingIdentifier !== undefined && style && style !== 'boardingPass' && style !== 'eventTicket') {
    issues.push({ level: 'info', message: '"groupingIdentifier" only groups boarding passes and event tickets.' });
  }
  for (const k of ['voided', 'sharingProhibited', 'suppressStripShine'] as const) {
    if (json[k] !== undefined && typeof json[k] !== 'boolean') issues.push({ level: 'warning', message: `"${k}" must be true or false.` });
  }
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
  if (json.preferredStyleSchemes) {
    issues.push({ level: 'info', message: 'This pass also declares newer styles ("preferredStyleSchemes"). Only its classic layout is rendered here.' });
  }
  if (source && source.files.length > 1 && !source.signed) {
    issues.push({ level: 'info', message: 'Pass is unsigned (no signature file). Wallet would refuse to install it, but it renders fine here.' });
  }
  return issues;
}
