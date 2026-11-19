// Generates unsigned sample .pkpass files in public/samples for trying the upload flow.
// Usage: npm run samples
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import JSZip from 'jszip';

const OUT = new URL('../public/samples/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------- tiny PNG encoder ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
/** pixel(x, y, w, h) -> [r, g, b, a] in 0..255 */
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = pixel(x, y, w, h);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const gradient = (from, to) => (x, y, w, h) => mix(hex(from), hex(to), (x / w + y / h) / 2);

/** A ring + dot logo mark, antialiased, on transparent. */
const ringLogo = (color) => (x, y, w, h) => {
  const s = h;
  const cx = s / 2, cy = h / 2;
  const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  const ring = 1 - Math.min(1, Math.max(0, Math.abs(d - s * 0.38) - s * 0.05));
  const dot = 1 - Math.min(1, Math.max(0, d - s * 0.14));
  const a = Math.max(ring, dot) * (x < s ? 1 : 0);
  return [...hex(color), Math.round(a * 255)];
};

const circles = (base, accent) => (x, y, w, h) => {
  const bg = mix(hex(base), [0, 0, 0], (x / w + y / h) * 0.15);
  const d1 = Math.hypot(x - w * 0.85, y - h * 0.2) / h;
  const d2 = Math.hypot(x - w * 0.1, y - h * 1.0) / h;
  const t = (d1 < 0.5 ? 0.18 : 0) + (d2 < 0.35 ? 0.12 : 0);
  return mix(bg, hex(accent), t);
};

const scaled = (name, w, h, fn) => ({
  [`${name}.png`]: png(w, h, fn),
  [`${name}@2x.png`]: png(w * 2, h * 2, fn),
});

// ---------- pkpass builder ----------
async function writePass(file, passJson, files) {
  const zip = new JSZip();
  const all = { 'pass.json': Buffer.from(JSON.stringify(passJson, null, 2)), ...files };
  const manifest = {};
  for (const [name, data] of Object.entries(all)) {
    zip.file(name, data);
    manifest[name] = createHash('sha1').update(data).digest('hex');
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  writeFileSync(new URL(file, OUT), buf);
  console.log('wrote', file, buf.length, 'bytes');
}

const base = { formatVersion: 1, passTypeIdentifier: 'pass.com.example.demo', teamIdentifier: 'ABCDE12345' };
const icon = scaled('icon', 29, 29, gradient('#555555', '#222222'));

await writePass(
  'boarding-pass.pkpass',
  {
    ...base,
    serialNumber: 'BP-2001',
    organizationName: 'Coastline Rail',
    description: 'Train ticket',
    logoText: 'Coastline Rail',
    backgroundColor: 'rgb(245, 245, 240)',
    foregroundColor: 'rgb(30, 30, 30)',
    labelColor: 'rgb(178, 34, 52)',
    relevantDate: '2026-12-20T08:15-08:00',
    boardingPass: {
      transitType: 'PKTransitTypeTrain',
      headerFields: [{ key: 'car', label: 'Car', value: '6' }, { key: 'seat', label: 'Seat', value: '42' }],
      primaryFields: [
        { key: 'from', label: 'Los Angeles', value: 'LAX' },
        { key: 'to', label: 'San Diego', value: 'SAN' },
      ],
      auxiliaryFields: [
        { key: 'dep', label: 'Departs', value: '2026-12-20T08:15-08:00', timeStyle: 'PKDateStyleShort', ignoresTimeZone: true },
        { key: 'arr', label: 'Arrives', value: '2026-12-20T11:02-08:00', timeStyle: 'PKDateStyleShort', ignoresTimeZone: true },
        { key: 'train', label: 'Train', value: '774' },
        { key: 'date', label: 'Date', value: '2026-12-20T08:15-08:00', dateStyle: 'PKDateStyleShort', ignoresTimeZone: true },
      ],
      secondaryFields: [
        { key: 'name', label: 'Passenger', value: 'Robin Park' },
        { key: 'fare', label: 'Fare', value: 'Flexible', textAlignment: 'PKTextAlignmentRight' },
      ],
      backFields: [{ key: 'ref', label: 'Booking reference', value: 'CR-7K2M9' }],
    },
    barcodes: [{ format: 'PKBarcodeFormatAztec', message: 'CR-7K2M9-774-6-42', messageEncoding: 'iso-8859-1' }],
  },
  {
    ...icon,
    ...scaled('logo', 50, 50, ringLogo('#b22234')),
    ...scaled('footer', 286, 15, (x, y, w) => [178, 34, 52, (y === 7 && x % 6 < 3) ? 200 : 0]),
  },
);

await writePass(
  'event-ticket.pkpass',
  {
    ...base,
    serialNumber: 'EV-3001',
    organizationName: 'City Stadium',
    description: 'Match ticket',
    logoText: 'City Stadium',
    backgroundColor: 'rgb(12, 18, 32)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(120, 200, 255)',
    eventTicket: {
      headerFields: [{ key: 'gate', label: 'Gate', value: 'C' }],
      primaryFields: [{ key: 'match', label: 'Match', value: 'Harbors vs. Comets' }],
      secondaryFields: [
        { key: 'date', label: 'Kick-off', value: '2026-12-06T15:00Z', dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleShort' },
      ],
      auxiliaryFields: [
        { key: 'block', label: 'Block', value: '114' },
        { key: 'row', label: 'Row', value: 'K' },
        { key: 'seat', label: 'Seat', value: '7' },
        { key: 'entry', label: 'Entry', value: 'Gate C · Turnstile 4', row: 1 },
      ],
      backFields: [{ key: 'info', label: 'Info', value: 'Gates open 90 minutes before kick-off. https://example.com/stadium' }],
    },
    barcodes: [{ format: 'PKBarcodeFormatQR', message: 'EV-3001-114-K-7', messageEncoding: 'iso-8859-1', altText: 'EV-3001' }],
  },
  {
    ...icon,
    ...scaled('logo', 50, 50, ringLogo('#78c8ff')),
    ...scaled('strip', 375, 98, (x, y, w, h) => {
      const g = gradient('#1c3b70', '#0c1220')(x, y, w, h);
      const line = Math.abs(x - w / 2) < 1 || Math.abs(Math.hypot(x - w / 2, y - h / 2) - h * 0.32) < 1;
      return line ? mix(g, [255, 255, 255], 0.35) : g;
    }),
  },
);

await writePass(
  'coupon.pkpass',
  {
    ...base,
    serialNumber: 'CP-4001',
    organizationName: 'Bloom Florist',
    description: 'Discount coupon',
    logoText: 'Bloom',
    backgroundColor: 'rgb(214, 51, 108)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(255, 214, 228)',
    expirationDate: '2025-02-14T23:59-08:00',
    coupon: {
      primaryFields: [{ key: 'offer', label: 'off bouquets', value: '$10' }],
      secondaryFields: [{ key: 'code', label: 'Code', value: 'ROSES10' }],
      auxiliaryFields: [{ key: 'exp', label: 'Expires', value: '2025-02-14T23:59-08:00', dateStyle: 'PKDateStyleMedium', ignoresTimeZone: true, textAlignment: 'PKTextAlignmentRight' }],
      backFields: [{ key: 'terms', label: 'Terms', value: 'Minimum purchase $40.' }],
    },
    barcodes: [{ format: 'PKBarcodeFormatQR', message: 'ROSES10', messageEncoding: 'iso-8859-1' }],
  },
  {
    ...icon,
    ...scaled('logo', 50, 50, ringLogo('#ffffff')),
    ...scaled('strip', 375, 144, circles('#e04a84', '#ffffff')),
  },
);

await writePass(
  'store-card.pkpass',
  {
    ...base,
    serialNumber: 'SC-5001',
    organizationName: 'Ink & Page Books',
    description: 'Loyalty card',
    logoText: 'Ink & Page',
    backgroundColor: 'rgb(40, 36, 32)',
    foregroundColor: 'rgb(250, 240, 220)',
    labelColor: 'rgb(214, 170, 100)',
    storeCard: {
      headerFields: [{ key: 'tier', label: 'Tier', value: 'Reader+' }],
      primaryFields: [{ key: 'balance', label: 'Store credit', value: 18, currencyCode: 'EUR' }],
      secondaryFields: [{ key: 'name', label: 'Member', value: 'Charlie Dunn' }],
      auxiliaryFields: [
        { key: 'stamps', label: 'Stamps', value: 0.7, numberStyle: 'PKNumberStylePercent' },
        { key: 'books', label: 'Books', value: 12, numberStyle: 'PKNumberStyleSpellOut', textAlignment: 'PKTextAlignmentRight' },
      ],
      backFields: [{ key: 'web', label: 'Website', attributedValue: '<a href="https://example.com">example.com</a>', value: 'example.com' }],
    },
    barcodes: [{ format: 'PKBarcodeFormatPDF417', message: 'INKPAGE-5001-CHARLIE', messageEncoding: 'iso-8859-1' }],
  },
  {
    ...icon,
    ...scaled('logo', 50, 50, ringLogo('#d6aa64')),
    ...scaled('strip', 375, 144, circles('#3c342c', '#d6aa64')),
  },
);

const utf16 = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, 'utf16le')]);
await writePass(
  'generic-localized.pkpass',
  {
    ...base,
    serialNumber: 'GN-6001',
    organizationName: 'Riverside Library',
    description: 'LIBRARY_CARD',
    logoText: 'LOGO_TEXT',
    backgroundColor: 'rgb(235, 243, 250)',
    foregroundColor: 'rgb(16, 42, 67)',
    labelColor: 'rgb(72, 101, 129)',
    generic: {
      headerFields: [{ key: 'branch', label: 'BRANCH', value: 'Central' }],
      primaryFields: [{ key: 'name', label: 'MEMBER', value: 'Kai Nakamura' }],
      secondaryFields: [
        { key: 'card', label: 'CARD_NO', value: '2 9087 00412 3381' },
        { key: 'exp', label: 'EXPIRES', value: '2028-06-30T00:00Z', dateStyle: 'PKDateStyleMedium', ignoresTimeZone: true, textAlignment: 'PKTextAlignmentRight' },
      ],
      auxiliaryFields: [{ key: 'limit', label: 'LOAN_LIMIT', value: 'LOAN_LIMIT_VALUE' }],
      backFields: [{ key: 'hours', label: 'HOURS', value: 'HOURS_VALUE' }],
    },
    barcodes: [{ format: 'PKBarcodeFormatCode128', message: '29087004123381', messageEncoding: 'iso-8859-1', altText: '2 9087 00412 3381' }],
  },
  {
    ...icon,
    ...scaled('logo', 50, 50, ringLogo('#102a43')),
    ...scaled('thumbnail', 90, 90, (x, y, w, h) => {
      const g = gradient('#9fb3c8', '#486581')(x, y, w, h);
      const head = Math.hypot(x - w / 2, y - h * 0.38) < h * 0.17;
      const body = Math.hypot(x - w / 2, y - h * 1.05) < h * 0.42;
      return head || body ? [255, 255, 255] : g;
    }),
    'en.lproj/pass.strings': Buffer.from(
      [
        '/* English */',
        '"LIBRARY_CARD" = "Library card";',
        '"LOGO_TEXT" = "Riverside Library";',
        '"BRANCH" = "Branch";',
        '"MEMBER" = "Member";',
        '"CARD_NO" = "Card number";',
        '"EXPIRES" = "Expires";',
        '"LOAN_LIMIT" = "Loan limit";',
        '"LOAN_LIMIT_VALUE" = "30 items";',
        '"HOURS" = "Opening hours";',
        '"HOURS_VALUE" = "Mon–Sat 9:00–20:00\\nSun 12:00–17:00";',
      ].join('\n'),
    ),
    'es.lproj/pass.strings': utf16(
      [
        '/* Español (UTF-16) */',
        '"LIBRARY_CARD" = "Carné de biblioteca";',
        '"LOGO_TEXT" = "Biblioteca Riverside";',
        '"BRANCH" = "Sede";',
        '"MEMBER" = "Socio";',
        '"CARD_NO" = "Número de carné";',
        '"EXPIRES" = "Caduca";',
        '"LOAN_LIMIT" = "Límite de préstamo";',
        '"LOAN_LIMIT_VALUE" = "30 artículos";',
        '"HOURS" = "Horario";',
        '"HOURS_VALUE" = "Lun–Sáb 9:00–20:00\\nDom 12:00–17:00";',
      ].join('\n'),
    ),
  },
);
