import type { PassBundle, PassJson, PassStyle } from './types';

const svg = (body: string, w: number, h: number) =>
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

// Drawn on a 50-unit grid, shown at 26 pt, the size of the logos in Apple's example passes.
const logoMark = (color: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 50 50"><circle cx="25" cy="25" r="19" fill="none" stroke="${color}" stroke-width="5"/><circle cx="25" cy="25" r="7" fill="${color}"/></svg>`,
  );

const gradient = (w: number, h: number, a: string, b: string, extra = '') =>
  svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${extra}`,
    w,
    h,
  );

const icon = gradient(58, 58, '#555', '#222');

const base = {
  formatVersion: 1,
  passTypeIdentifier: 'pass.com.example.demo',
  teamIdentifier: 'ABCDE12345',
};

const SAMPLES: Record<PassStyle, () => PassBundle> = {
  boardingPass: () => ({
    json: {
      ...base,
      serialNumber: 'BP-0001',
      organizationName: 'Northwind Air',
      description: 'Boarding pass',
      logoText: 'Northwind Air',
      backgroundColor: 'rgb(22, 52, 92)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(150, 190, 235)',
      boardingPass: {
        transitType: 'PKTransitTypeAir',
        headerFields: [
          { key: 'gate', label: 'Gate', value: 'B22' },
          { key: 'seat', label: 'Seat', value: '14A' },
        ],
        primaryFields: [
          { key: 'origin', label: 'San Francisco', value: 'SFO' },
          { key: 'destination', label: 'Tokyo', value: 'HND' },
        ],
        auxiliaryFields: [
          { key: 'boards', label: 'Boards', value: '2026-12-04T10:05-08:00', timeStyle: 'PKDateStyleShort', ignoresTimeZone: true },
          { key: 'departs', label: 'Departs', value: '2026-12-04T10:45-08:00', timeStyle: 'PKDateStyleShort', ignoresTimeZone: true },
          { key: 'flight', label: 'Flight', value: 'NW 837' },
          { key: 'date', label: 'Date', value: '2026-12-04T10:45-08:00', dateStyle: 'PKDateStyleMedium', ignoresTimeZone: true, textAlignment: 'PKTextAlignmentRight' },
        ],
        secondaryFields: [
          { key: 'passenger', label: 'Passenger', value: 'Alex Morgan' },
          { key: 'zone', label: 'Zone', value: '3' },
          { key: 'class', label: 'Class', value: 'Economy', textAlignment: 'PKTextAlignmentRight' },
        ],
        backFields: [
          { key: 'confirmation', label: 'Confirmation', value: 'XK4PQ7' },
          { key: 'ff', label: 'Frequent flyer', value: 'NW 4421 9930' },
          { key: 'help', label: 'Need help?', value: 'Call +1 (555) 010-2000 or visit https://example.com/help' },
        ],
      },
      barcodes: [{ format: 'PKBarcodeFormatPDF417', message: 'M1MORGAN/ALEX EXK4PQ7 SFOHNDNW 0837 338Y014A0042 100', messageEncoding: 'iso-8859-1' }],
    },
    images: {
      icon,
      logo: logoMark('#fff'),
      footer: svg(`<text x="143" y="12" font-family="-apple-system,Helvetica" font-size="10" fill="#96beeb" text-anchor="middle" letter-spacing="2">PRIORITY BOARDING</text>`, 286, 15),
    },
    strings: {},
  }),

  eventTicket: () => ({
    json: {
      ...base,
      serialNumber: 'EV-0001',
      organizationName: 'Harbor Hall',
      description: 'Concert ticket',
      logoText: 'Harbor Hall',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(255, 214, 140)',
      backgroundColor: 'rgb(48, 20, 70)',
      eventTicket: {
        headerFields: [{ key: 'date', label: 'Date', value: '2026-12-12T20:00-05:00', dateStyle: 'PKDateStyleMedium', ignoresTimeZone: true }],
        primaryFields: [{ key: 'event', label: 'Event', value: 'The Midnight Tide' }],
        secondaryFields: [
          { key: 'loc', label: 'Location', value: 'Boston' },
          { key: 'doors', label: 'Doors', value: '2026-12-12T19:00-05:00', timeStyle: 'PKDateStyleShort', ignoresTimeZone: true },
        ],
        auxiliaryFields: [
          { key: 'section', label: 'Section', value: 'Floor' },
          { key: 'row', label: 'Row', value: 'F' },
          { key: 'seat', label: 'Seat', value: '18' },
          { key: 'entrance', label: 'Entrance', value: 'North', row: 1 },
          { key: 'admit', label: 'Admit', value: '1 adult', row: 1, textAlignment: 'PKTextAlignmentRight' },
        ],
        backFields: [
          { key: 'terms', label: 'Terms', value: 'No re-entry. Tickets are non-refundable.' },
          { key: 'web', label: 'Venue', attributedValue: '<a href="https://example.com/venue">Directions & parking</a>', value: 'Directions & parking' },
        ],
      },
      barcodes: [{ format: 'PKBarcodeFormatQR', message: 'EV-0001-HARBOR-F18', messageEncoding: 'iso-8859-1', altText: 'EV-0001' }],
    },
    images: {
      icon,
      logo: logoMark('#ffd68c'),
      background: gradient(180, 220, '#7b2ff7', '#f107a3', '<circle cx="140" cy="40" r="50" fill="#ffb347" opacity="0.6"/>'),
      thumbnail: gradient(90, 90, '#ffb347', '#ff5e62', '<text x="45" y="58" font-family="-apple-system,Helvetica" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">♪</text>'),
    },
    strings: {},
  }),

  coupon: () => ({
    json: {
      ...base,
      serialNumber: 'CP-0001',
      organizationName: 'Paper Lantern Café',
      description: 'Coffee coupon',
      logoText: 'Paper Lantern',
      backgroundColor: 'rgb(206, 94, 44)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(255, 229, 205)',
      expirationDate: '2027-01-31T23:59-08:00',
      coupon: {
        primaryFields: [{ key: 'offer', label: 'on any latte', value: '25% off' }],
        secondaryFields: [{ key: 'expires', label: 'Expires', value: '2027-01-31T23:59-08:00', dateStyle: 'PKDateStyleMedium', ignoresTimeZone: true }],
        auxiliaryFields: [{ key: 'store', label: 'Valid at', value: 'All locations', textAlignment: 'PKTextAlignmentRight' }],
        backFields: [{ key: 'terms', label: 'Terms', value: 'One coupon per customer. Cannot be combined with other offers.' }],
      },
      barcodes: [{ format: 'PKBarcodeFormatAztec', message: 'LATTE25-0001', messageEncoding: 'iso-8859-1' }],
    },
    images: {
      icon,
      logo: logoMark('#fff'),
      strip: gradient(375, 144, '#e9814d', '#a8401b', '<g fill="#fff" opacity="0.12"><circle cx="320" cy="30" r="70"/><circle cx="40" cy="140" r="50"/></g>'),
    },
    strings: {},
  }),

  storeCard: () => ({
    json: {
      ...base,
      serialNumber: 'SC-0001',
      organizationName: 'Greenleaf Market',
      description: 'Gift card',
      logoText: 'Greenleaf',
      backgroundColor: 'rgb(31, 107, 72)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(196, 236, 210)',
      storeCard: {
        headerFields: [{ key: 'points', label: 'Points', value: 1280, numberStyle: 'PKNumberStyleDecimal' }],
        primaryFields: [{ key: 'balance', label: 'Balance', value: 42.5, currencyCode: 'USD' }],
        secondaryFields: [{ key: 'member', label: 'Member', value: 'Jordan Lee' }],
        auxiliaryFields: [{ key: 'tier', label: 'Tier', value: 'Gold', textAlignment: 'PKTextAlignmentRight' }],
        backFields: [{ key: 'support', label: 'Customer care', value: 'support@example.com' }],
      },
      barcodes: [{ format: 'PKBarcodeFormatCode128', message: '6011000990139424', messageEncoding: 'iso-8859-1', altText: '6011 0009 9013 9424' }],
    },
    images: {
      icon,
      logo: logoMark('#fff'),
      strip: gradient(375, 144, '#2f9e6a', '#13492f', '<g fill="#fff" opacity="0.1"><path d="M250 144 C 270 60, 340 40, 375 20 L375 144 Z"/></g>'),
    },
    strings: {},
  }),

  generic: () => ({
    json: {
      ...base,
      serialNumber: 'GN-0001',
      organizationName: 'Summit Gym',
      description: 'Membership card',
      logoText: 'Summit Gym',
      backgroundColor: 'rgb(242, 242, 247)',
      foregroundColor: 'rgb(28, 28, 30)',
      labelColor: 'rgb(110, 110, 115)',
      generic: {
        headerFields: [{ key: 'level', label: 'Level', value: 'All access' }],
        primaryFields: [{ key: 'name', label: 'Member', value: 'Sam Rivera' }],
        secondaryFields: [
          { key: 'id', label: 'Member ID', value: 'SG-20481' },
          { key: 'since', label: 'Member since', value: '2024-03-01T00:00Z', dateStyle: 'PKDateStyleMedium', ignoresTimeZone: true, textAlignment: 'PKTextAlignmentRight' },
        ],
        auxiliaryFields: [{ key: 'home', label: 'Home club', value: 'Downtown' }],
        backFields: [{ key: 'hours', label: 'Hours', value: 'Mon–Fri 5am–11pm\nSat–Sun 7am–9pm' }],
      },
      barcodes: [{ format: 'PKBarcodeFormatQR', message: 'SG-20481', messageEncoding: 'iso-8859-1', altText: 'SG-20481' }],
    },
    images: {
      icon,
      logo: logoMark('#1c1c1e'),
      thumbnail: gradient(90, 90, '#c7c7cc', '#8e8e93', '<circle cx="45" cy="36" r="16" fill="#fff"/><path d="M15 90c4-22 16-30 30-30s26 8 30 30z" fill="#fff"/>'),
    },
    strings: {},
  }),
};

export function sampleFor(style: PassStyle): PassBundle {
  return SAMPLES[style]();
}

/** A blank pass of the given style, for starting from scratch. */
export function blankPass(style: PassStyle): PassBundle {
  const json: PassJson = {
    ...base,
    serialNumber: '0001',
    organizationName: 'My Organization',
    description: 'My pass',
    logoText: 'My Pass',
    backgroundColor: 'rgb(255, 255, 255)',
    foregroundColor: 'rgb(0, 0, 0)',
    [style]: {
      ...(style === 'boardingPass' ? { transitType: 'PKTransitTypeGeneric' } : {}),
      primaryFields: [{ key: 'primary', label: 'Label', value: 'Value' }],
    },
  };
  return { json, images: {}, strings: {} };
}
