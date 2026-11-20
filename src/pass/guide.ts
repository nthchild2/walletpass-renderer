/**
 * Content for the layout guide: one entry per classic layout variant, with a wireframe pass
 * (rendered by the real renderer), the slots and their limits, the images, an annotated
 * pass.json skeleton, and links to Apple's documentation.
 */
import type { ImageName, PassBundle, PassField, PassJson, PassStyle } from './types';

const DOCS = 'https://developer.apple.com/documentation/walletpasses';
export const LINKS = {
  pass: `${DOCS}/pass`,
  passFields: `${DOCS}/passfields`,
  passFieldContent: `${DOCS}/passfieldcontent`,
  barcodes: `${DOCS}/pass/barcodes-data.dictionary`,
  headerFields: `${DOCS}/passfields/headerfields-data.dictionary`,
  primaryFields: `${DOCS}/passfields/primaryfields-data.dictionary`,
  secondaryFields: `${DOCS}/passfields/secondaryfields-data.dictionary`,
  auxiliaryFields: `${DOCS}/passfields/auxiliaryfields-data.dictionary`,
  backFields: `${DOCS}/passfields/backfields-data.dictionary`,
  source: `${DOCS}/creating-the-source-for-a-pass`,
  archivedGuide:
    'https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html',
  hig: 'https://developer.apple.com/design/human-interface-guidelines/wallet',
  style: (key: PassStyle) => `${DOCS}/pass/${key.toLowerCase()}-data.dictionary`,
};

// ---------- Wireframe passes ----------

const placeholder = (name: string, w: number, h: number, size = 11) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="#dfe7f5" stroke="#0a66d8" stroke-dasharray="4 3"/>` +
      `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="${size}" fill="#0a66d8">${name}</text></svg>`,
  );

const WF_IMAGES: Partial<Record<ImageName, string>> = {
  logo: placeholder('logo.png', 96, 32, 10),
  thumbnail: placeholder('thumbnail', 90, 90, 11),
  footer: placeholder('footer.png · 286×15 pt', 286, 15, 9),
  background:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="220"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9d8f2"/><stop offset="1" stop-color="#e9d6ef"/></linearGradient></defs><rect width="180" height="220" fill="url(#g)"/></svg>',
    ),
};
const stripImage = (event: boolean) =>
  placeholder(event ? 'strip.png · 375×98 pt' : 'strip.png · 375×144 pt', 375, event ? 98 : 144, 10);

const f = (key: string, label = 'Label', value: string | number = 'Value', extra: Partial<PassField> = {}): PassField => ({
  key,
  label,
  value,
  ...extra,
});
const row = (prefix: string, n: number, extra: Partial<PassField> = {}) =>
  Array.from({ length: n }, (_, i) => f(`${prefix}${i + 1}`, 'Label', 'Value', extra));

function wireframe(style: PassStyle, structure: Record<string, unknown>, images: ImageName[], barcode: 'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417'): PassBundle {
  const json: PassJson = {
    formatVersion: 1,
    passTypeIdentifier: 'pass.example.guide',
    serialNumber: 'GUIDE',
    teamIdentifier: 'ABCDE12345',
    organizationName: 'Guide',
    description: 'Layout guide',
    logoText: 'logoText',
    backgroundColor: 'rgb(246, 247, 251)',
    foregroundColor: 'rgb(28, 28, 30)',
    labelColor: 'rgb(98, 98, 112)',
    [style]: structure,
    barcodes: [{ format: barcode, message: 'GUIDE-0001', messageEncoding: 'iso-8859-1', altText: 'altText' }],
  };
  const imgs: PassBundle['images'] = {};
  for (const name of images) imgs[name] = name === 'strip' ? stripImage(style === 'eventTicket') : WF_IMAGES[name];
  return { json, images: imgs, strings: {} };
}

// ---------- Variants ----------

export interface SlotInfo {
  key: string;
  shows: string;
  max: string;
  source: 'Apple docs' | 'Older Apple guide' | 'Measured' | 'Estimate';
}

/** What each source tag means, shown as a legend and as tooltips in the guide. */
export const SOURCES: { tag: SlotInfo['source']; meaning: string }[] = [
  { tag: 'Apple docs', meaning: "Stated in Apple's current Wallet Passes documentation." },
  { tag: 'Older Apple guide', meaning: "From Apple's archived Wallet Developer Guide; the current docs give no number." },
  { tag: 'Measured', meaning: "Not documented: measured from Apple's renders and a real iPhone screenshot." },
  { tag: 'Estimate', meaning: 'No documentation and no reference image to measure: a best guess.' },
];

export interface ImageInfo {
  name: string;
  size: string;
  note: string;
}

export interface Variant {
  id: string;
  title: string;
  style: PassStyle;
  summary: string;
  bundle: PassBundle;
  slots: SlotInfo[];
  images: ImageInfo[];
  notes: string[];
  json: string;
  /** How sure we are about this variant's positions. */
  accuracy: string;
}

const HEADER: SlotInfo = {
  key: 'headerFields',
  shows: 'Top right. The only fields still visible when the pass is stacked behind others in Wallet.',
  max: '3 (they truncate when space runs out)',
  source: 'Older Apple guide',
};
const BACK: SlotInfo = { key: 'backFields', shows: 'The back of the pass, as a list. Links and phone numbers become tappable.', max: 'No limit', source: 'Apple docs' };

const IMG = {
  icon: { name: 'icon.png', size: '29×29 pt', note: 'Required. Notifications and the lock screen; not on the pass itself.' },
  logo: { name: 'logo.png', size: 'up to 160×50 pt', note: 'Top left, followed by logoText.' },
  stripTall: { name: 'strip.png', size: '375×144 pt', note: 'Full width under the header; the primary field sits on it.' },
  stripEvent: { name: 'strip.png', size: '375×98 pt', note: 'Full width under the header. Replaces background and thumbnail.' },
  background: { name: 'background.png', size: '180×220 pt', note: 'Blurred and scaled to fill the whole card.' },
  thumbnail: { name: 'thumbnail.png', size: '90×90 pt', note: 'Right side, beside the primary field.' },
  footer: { name: 'footer.png', size: '286×15 pt', note: 'Just above the barcode.' },
};

/** Annotated pass.json skeleton. Comments are explanations only; real pass.json can't contain them. */
function skeleton(style: PassStyle, lines: string[]): string {
  return [
    '{',
    '  "formatVersion": 1,                        // required, always 1',
    '  "passTypeIdentifier": "pass.com.example",  // required, not shown',
    '  "serialNumber": "0001",                    // required, not shown',
    '  "teamIdentifier": "ABCDE12345",            // required, not shown',
    '  "organizationName": "Example",             // required, used in notifications',
    '  "description": "Concert ticket",           // required, used by VoiceOver',
    '',
    '  "backgroundColor": "rgb(20, 20, 30)",      // card',
    '  "foregroundColor": "rgb(255, 255, 255)",   // field values, logoText',
    '  "labelColor": "rgb(255, 200, 120)",        // field labels',
    '  "logoText": "Example",                     // next to logo.png',
    '',
    `  "${style}": {`,
    ...lines.map((l) => `    ${l}`),
    '  },',
    '',
    '  "barcodes": [                              // first one the device can display is shown',
    '    { "format": "PKBarcodeFormatQR", "message": "…", "messageEncoding": "iso-8859-1", "altText": "…" }',
    '  ]',
    '}',
  ].join('\n');
}

export const VARIANTS: Variant[] = [
  {
    id: 'eventTicket-background',
    title: 'Event ticket · background image',
    style: 'eventTicket',
    summary: 'Entry to concerts, games, plays and movies. With a background image, the card is the blurred image and the thumbnail sits beside the main fields.',
    bundle: wireframe(
      'eventTicket',
      {
        headerFields: row('h', 1),
        primaryFields: [f('p1')],
        secondaryFields: row('s', 3),
        auxiliaryFields: [...row('a', 4), ...row('b', 4, { row: 1 })],
      },
      ['logo', 'background', 'thumbnail'],
      'PKBarcodeFormatQR',
    ),
    slots: [
      HEADER,
      { key: 'primaryFields', shows: 'Beside the thumbnail. Same size as the other values.', max: '1', source: 'Measured' },
      { key: 'secondaryFields', shows: 'Under the primary field, still beside the thumbnail.', max: '4', source: 'Older Apple guide' },
      { key: 'auxiliaryFields', shows: 'Full width under the thumbnail.', max: '4', source: 'Apple docs' },
      { key: 'auxiliaryFields with "row": 1', shows: 'A second auxiliary row under the first. Event tickets only.', max: '4', source: 'Apple docs' },
      BACK,
    ],
    images: [IMG.icon, IMG.logo, IMG.background, IMG.thumbnail],
    notes: [
      'The notch at the top is part of the event-ticket shape; logos are kept clear of it.',
      'Each slot is fixed: an empty secondary row leaves a gap; the auxiliary rows don\'t move up beside the thumbnail.',
    ],
    json: skeleton('eventTicket', [
      '"headerFields":    [ /* up to 3 */ ],',
      '"primaryFields":   [ /* 1 */ ],',
      '"secondaryFields": [ /* up to 4, beside the thumbnail */ ],',
      '"auxiliaryFields": [ /* up to 4, plus up to 4 more with "row": 1 */ ],',
      '"backFields":      [ /* any number */ ]',
    ]),
    accuracy: 'Positions measured from Apple\'s render of this layout (within ~1 pt).',
  },
  {
    id: 'eventTicket-strip',
    title: 'Event ticket · strip image',
    style: 'eventTicket',
    summary: 'The same pass with a strip image instead: the primary field sits on the strip, and there is no thumbnail or background.',
    bundle: wireframe(
      'eventTicket',
      {
        headerFields: row('h', 1),
        primaryFields: [f('p1')],
        secondaryFields: row('s', 4),
        auxiliaryFields: [...row('a', 4), ...row('b', 4, { row: 1 })],
      },
      ['logo', 'strip'],
      'PKBarcodeFormatQR',
    ),
    slots: [
      HEADER,
      { key: 'primaryFields', shows: 'On the strip image.', max: '1', source: 'Older Apple guide' },
      { key: 'secondaryFields', shows: 'Full width under the strip.', max: '4', source: 'Older Apple guide' },
      { key: 'auxiliaryFields', shows: 'Under the secondary row.', max: '4', source: 'Apple docs' },
      { key: 'auxiliaryFields with "row": 1', shows: 'A second auxiliary row.', max: '4', source: 'Apple docs' },
      BACK,
    ],
    images: [IMG.icon, IMG.logo, IMG.stripEvent],
    notes: ['With strip.png present, Wallet ignores background.png and thumbnail.png.'],
    json: skeleton('eventTicket', [
      '"headerFields":    [ /* up to 3 */ ],',
      '"primaryFields":   [ /* 1, on the strip */ ],',
      '"secondaryFields": [ /* up to 4 */ ],',
      '"auxiliaryFields": [ /* up to 4, plus up to 4 more with "row": 1 */ ],',
      '"backFields":      [ /* any number */ ]',
    ]),
    accuracy: 'No Apple render of this variant to measure: positions are an estimate.',
  },
  {
    id: 'boardingPass',
    title: 'Boarding pass',
    style: 'boardingPass',
    summary: 'Flights, trains, buses and boats. Two primary fields (origin and destination) with a transit icon between them.',
    bundle: wireframe(
      'boardingPass',
      {
        transitType: 'PKTransitTypeAir',
        headerFields: row('h', 2),
        primaryFields: [f('p1', 'Label', 'ABC'), f('p2', 'Label', 'XYZ')],
        auxiliaryFields: row('a', 5),
        secondaryFields: row('s', 5),
      },
      ['logo', 'footer'],
      'PKBarcodeFormatQR',
    ),
    slots: [
      HEADER,
      { key: 'primaryFields', shows: 'Origin (left) and destination (right), large, with the transitType icon between.', max: '2', source: 'Apple docs' },
      { key: 'auxiliaryFields', shows: 'First row under the primary fields (above secondary on boarding passes).', max: '5', source: 'Older Apple guide' },
      { key: 'secondaryFields', shows: 'Second row.', max: '5', source: 'Older Apple guide' },
      BACK,
    ],
    images: [IMG.icon, IMG.logo, IMG.footer],
    notes: [
      '"transitType" is required: PKTransitTypeAir, Train, Bus, Boat or Generic. It picks the icon and is invalid on other styles.',
      'The small cut-outs on the sides are part of the boarding-pass shape.',
    ],
    json: skeleton('boardingPass', [
      '"transitType":     "PKTransitTypeAir",       // required',
      '"headerFields":    [ /* up to 3 */ ],',
      '"primaryFields":   [ /* 2: origin, destination */ ],',
      '"auxiliaryFields": [ /* up to 5, first row */ ],',
      '"secondaryFields": [ /* up to 5, second row */ ],',
      '"backFields":      [ /* any number */ ]',
    ]),
    accuracy: 'Apple\'s only current boarding-pass render is the new iOS 26 design, so these classic positions are an estimate.',
  },
  {
    id: 'coupon',
    title: 'Coupon',
    style: 'coupon',
    summary: 'Coupons, discounts and special offers. A big primary value on the strip image, and a perforated top and bottom edge.',
    bundle: wireframe(
      'coupon',
      {
        primaryFields: [f('p1', 'Label', 'Value')],
        secondaryFields: row('s', 2),
        auxiliaryFields: row('a', 2),
      },
      ['logo', 'strip'],
      'PKBarcodeFormatPDF417',
    ),
    slots: [
      HEADER,
      { key: 'primaryFields', shows: 'Large value on the strip, label underneath in normal case.', max: '1', source: 'Measured' },
      { key: 'secondaryFields + auxiliaryFields', shows: 'One shared row under the strip.', max: '4 in total', source: 'Apple docs' },
      BACK,
    ],
    images: [IMG.icon, IMG.logo, IMG.stripTall],
    notes: ['Secondary and auxiliary fields fill the same row: the secondary ones first, then the auxiliary ones.'],
    json: skeleton('coupon', [
      '"headerFields":    [ /* up to 3 */ ],',
      '"primaryFields":   [ /* 1, big value on the strip */ ],',
      '"secondaryFields": [ /* these two groups share one row: */ ],',
      '"auxiliaryFields": [ /*   4 fields in total */ ],',
      '"backFields":      [ /* any number */ ]',
    ]),
    accuracy: 'Positions measured from Apple\'s render of a coupon (within ~1 pt).',
  },
  {
    id: 'storeCard',
    title: 'Store card',
    style: 'storeCard',
    summary: 'Loyalty, gift and points cards, often showing a balance. Laid out like a coupon, with rounded corners.',
    bundle: wireframe(
      'storeCard',
      {
        headerFields: row('h', 1),
        primaryFields: [f('p1', 'Label', '$0.00')],
        secondaryFields: row('s', 2),
        auxiliaryFields: row('a', 2),
      },
      ['logo', 'strip'],
      'PKBarcodeFormatQR',
    ),
    slots: [
      HEADER,
      { key: 'primaryFields', shows: 'Large value on the strip (e.g. a balance), label underneath.', max: '1', source: 'Measured' },
      { key: 'secondaryFields + auxiliaryFields', shows: 'One shared row under the strip.', max: '4 in total', source: 'Apple docs' },
      BACK,
    ],
    images: [IMG.icon, IMG.logo, IMG.stripTall],
    notes: ['A balance is usually a number value with "currencyCode", so Wallet formats it for the reader\'s locale.'],
    json: skeleton('storeCard', [
      '"headerFields":    [ /* up to 3 */ ],',
      '"primaryFields":   [ /* 1, e.g. { "value": 42.5, "currencyCode": "USD" } */ ],',
      '"secondaryFields": [ /* these two groups share one row: */ ],',
      '"auxiliaryFields": [ /*   4 fields in total */ ],',
      '"backFields":      [ /* any number */ ]',
    ]),
    accuracy: 'Positions measured from Apple\'s render of a store card (within ~1 pt).',
  },
  {
    id: 'generic',
    title: 'Generic',
    style: 'generic',
    summary: 'Anything that doesn\'t fit the other styles: memberships, IDs, claim tickets. A larger primary value with a thumbnail beside it.',
    bundle: wireframe(
      'generic',
      {
        headerFields: row('h', 2),
        primaryFields: [f('p1')],
        secondaryFields: row('s', 4),
        auxiliaryFields: row('a', 4),
      },
      ['logo', 'thumbnail'],
      'PKBarcodeFormatPDF417',
    ),
    slots: [
      HEADER,
      { key: 'primaryFields', shows: 'Larger value (30 pt), beside the thumbnail.', max: '1', source: 'Measured' },
      { key: 'secondaryFields', shows: 'Full width under the thumbnail.', max: '4', source: 'Older Apple guide' },
      { key: 'auxiliaryFields', shows: 'Under the secondary row.', max: '4', source: 'Older Apple guide' },
      BACK,
    ],
    images: [IMG.icon, IMG.logo, IMG.thumbnail],
    notes: [
      'With a square barcode (QR or Aztec), secondary and auxiliary fields share one row of 4 in total, as on coupons. That rule is in Apple\'s docs.',
    ],
    json: skeleton('generic', [
      '"headerFields":    [ /* up to 3 */ ],',
      '"primaryFields":   [ /* 1 */ ],',
      '"secondaryFields": [ /* up to 4 */ ],',
      '"auxiliaryFields": [ /* up to 4 (shared with secondary if the barcode is square) */ ],',
      '"backFields":      [ /* any number */ ]',
    ]),
    accuracy: 'Positions measured from Apple\'s render of a generic pass (within ~1 pt).',
  },
];

/** Every key a field dictionary can have, and whether it changes what the pass looks like. */
export const FIELD_KEYS: { key: string; type: string; effect: string; where: string }[] = [
  { key: 'key', type: 'string', effect: 'None. Must be unique within the pass.', where: 'Required' },
  { key: 'label', type: 'string', effect: 'Small uppercase text above the value.', where: 'All groups' },
  { key: 'value', type: 'string, number or ISO 8601 date', effect: 'The text shown. Dates need a time zone.', where: 'Required' },
  { key: 'textAlignment', type: 'PKTextAlignmentLeft | Center | Right | Natural', effect: 'Aligns the field in its slot.', where: 'Not primary or back fields' },
  { key: 'dateStyle / timeStyle', type: 'PKDateStyleNone … Full', effect: 'Formats a date value in the reader\'s locale.', where: 'All groups' },
  { key: 'ignoresTimeZone', type: 'boolean', effect: 'Shows the time as written instead of converting it.', where: 'Date values' },
  { key: 'isRelative', type: 'boolean', effect: 'Shows dates like "Tomorrow".', where: 'Date values' },
  { key: 'numberStyle', type: 'PKNumberStyleDecimal | Percent | Scientific | SpellOut', effect: 'Formats a number value.', where: 'Number values' },
  { key: 'currencyCode', type: 'ISO 4217 code', effect: 'Formats a number value as money.', where: 'Number values' },
  { key: 'attributedValue', type: 'string with <a href> only', effect: 'Replaces value; links are tappable on the back.', where: 'All groups' },
  { key: 'dataDetectorTypes', type: 'array of PKDataDetectorType…', effect: 'Which links, phone numbers etc. become tappable.', where: 'Back fields only' },
  { key: 'changeMessage', type: 'string with %@', effect: 'Notification text when the value changes. Not drawn on the pass.', where: 'All groups' },
  { key: 'row', type: '0 or 1', effect: '1 puts the field in a second auxiliary row.', where: 'Event-ticket auxiliary fields only' },
];

