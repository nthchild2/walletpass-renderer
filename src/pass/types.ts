// Types for the classic Apple Wallet pass.json format.
// https://developer.apple.com/documentation/walletpasses/pass

export const PASS_STYLES = ['boardingPass', 'coupon', 'eventTicket', 'generic', 'storeCard'] as const;
export type PassStyle = (typeof PASS_STYLES)[number];

export const STYLE_LABELS: Record<PassStyle, string> = {
  boardingPass: 'Boarding pass',
  coupon: 'Coupon',
  eventTicket: 'Event ticket',
  generic: 'Generic',
  storeCard: 'Store card',
};

export const FIELD_GROUPS = [
  'headerFields',
  'primaryFields',
  'secondaryFields',
  'auxiliaryFields',
  'backFields',
] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

export const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  headerFields: 'Header fields',
  primaryFields: 'Primary fields',
  secondaryFields: 'Secondary fields',
  auxiliaryFields: 'Auxiliary fields',
  backFields: 'Back fields',
};

export type TextAlignment =
  | 'PKTextAlignmentLeft'
  | 'PKTextAlignmentCenter'
  | 'PKTextAlignmentRight'
  | 'PKTextAlignmentNatural';

export type DateStyle =
  | 'PKDateStyleNone'
  | 'PKDateStyleShort'
  | 'PKDateStyleMedium'
  | 'PKDateStyleLong'
  | 'PKDateStyleFull';

export type NumberStyle =
  | 'PKNumberStyleDecimal'
  | 'PKNumberStylePercent'
  | 'PKNumberStyleScientific'
  | 'PKNumberStyleSpellOut';

export type DataDetectorType =
  | 'PKDataDetectorTypePhoneNumber'
  | 'PKDataDetectorTypeLink'
  | 'PKDataDetectorTypeAddress'
  | 'PKDataDetectorTypeCalendarEvent';

export const DATA_DETECTORS: DataDetectorType[] = [
  'PKDataDetectorTypePhoneNumber',
  'PKDataDetectorTypeLink',
  'PKDataDetectorTypeAddress',
  'PKDataDetectorTypeCalendarEvent',
];

/**
 * A field dictionary (Apple's PassFieldContent), plus `row` from AuxiliaryFields.
 * Restrictions from Apple's docs:
 * - textAlignment: "This key is invalid for primary and back fields."
 * - dataDetectorTypes: "You don't use data detectors for fields on the front of the pass."
 * - row (auxiliaryFields only): 0 or 1, "to add a row to the auxiliary field in an event ticket".
 */
export interface PassField {
  key: string;
  label?: string;
  value: string | number;
  attributedValue?: string | number;
  changeMessage?: string;
  dataDetectorTypes?: DataDetectorType[];
  textAlignment?: TextAlignment;
  dateStyle?: DateStyle;
  timeStyle?: DateStyle;
  ignoresTimeZone?: boolean;
  isRelative?: boolean;
  numberStyle?: NumberStyle;
  currencyCode?: string;
  row?: 0 | 1;
}

export type TransitType =
  | 'PKTransitTypeAir'
  | 'PKTransitTypeBoat'
  | 'PKTransitTypeBus'
  | 'PKTransitTypeGeneric'
  | 'PKTransitTypeTrain';

export interface PassStructure {
  headerFields?: PassField[];
  primaryFields?: PassField[];
  secondaryFields?: PassField[];
  auxiliaryFields?: PassField[];
  backFields?: PassField[];
  transitType?: TransitType;
}

export type BarcodeFormat =
  | 'PKBarcodeFormatQR'
  | 'PKBarcodeFormatPDF417'
  | 'PKBarcodeFormatAztec'
  | 'PKBarcodeFormatCode128';

export interface PassBarcode {
  format: BarcodeFormat;
  message: string;
  messageEncoding?: string;
  altText?: string;
}

export interface PassJson {
  formatVersion?: number;
  passTypeIdentifier?: string;
  serialNumber?: string;
  teamIdentifier?: string;
  organizationName?: string;
  description?: string;
  logoText?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  barcode?: PassBarcode;
  barcodes?: PassBarcode[];
  expirationDate?: string;
  relevantDate?: string;
  voided?: boolean;
  suppressStripShine?: boolean;
  boardingPass?: PassStructure;
  coupon?: PassStructure;
  eventTicket?: PassStructure;
  generic?: PassStructure;
  storeCard?: PassStructure;
  [key: string]: unknown;
}

export const IMAGE_NAMES = ['icon', 'logo', 'strip', 'background', 'thumbnail', 'footer'] as const;
export type ImageName = (typeof IMAGE_NAMES)[number];

/** Object or data URLs for each image the pass carries. */
export type PassImages = Partial<Record<ImageName, string>>;

export interface PassBundle {
  json: PassJson;
  images: PassImages;
  /** Localized strings (from <lang>.lproj/pass.strings), applied to labels and values. */
  strings: Record<string, string>;
  /** Information about where the pass came from, for the inspector panel. */
  source?: {
    fileName: string;
    files: string[];
    language?: string;
    languages: string[];
    signed: boolean;
  };
}

/** Which images each style can show, per Apple's pass design guidelines. */
export const STYLE_IMAGES: Record<PassStyle, ImageName[]> = {
  boardingPass: ['icon', 'logo', 'footer'],
  coupon: ['icon', 'logo', 'strip'],
  eventTicket: ['icon', 'logo', 'strip', 'background', 'thumbnail'],
  generic: ['icon', 'logo', 'thumbnail'],
  storeCard: ['icon', 'logo', 'strip'],
};

export function getStyle(json: PassJson): PassStyle | undefined {
  return PASS_STYLES.find((s) => json[s] && typeof json[s] === 'object');
}

export function getBarcode(json: PassJson): PassBarcode | undefined {
  if (Array.isArray(json.barcodes) && json.barcodes.length > 0) return json.barcodes[0];
  return json.barcode;
}

/** Square barcodes (QR, Aztec) change the generic layout; see sharesSecondaryRow. */
export function hasSquareBarcode(json: PassJson): boolean {
  const f = getBarcode(json)?.format;
  return f === 'PKBarcodeFormatQR' || f === 'PKBarcodeFormatAztec';
}

/**
 * Apple: "Coupons, store cards, and generic passes with a square barcode can have a
 * combined total of up to four secondary and auxiliary fields." They share one row.
 */
export function sharesSecondaryRow(json: PassJson, style: PassStyle): boolean {
  return style === 'coupon' || style === 'storeCard' || (style === 'generic' && hasSquareBarcode(json));
}

/** How many fields of a group Wallet shows. Auxiliary limits on event tickets are per row. */
export function fieldLimit(json: PassJson, style: PassStyle, group: FieldGroup): number {
  switch (group) {
    case 'headerFields':
      return 3;
    case 'primaryFields':
      return style === 'boardingPass' ? 2 : 1;
    case 'secondaryFields':
    case 'auxiliaryFields':
      if (sharesSecondaryRow(json, style)) return 4;
      return style === 'boardingPass' ? 5 : 4;
    case 'backFields':
      return Infinity;
  }
}

/** Groups where textAlignment is allowed (Apple: invalid for primary and back fields). */
export function allowsAlignment(group: FieldGroup): boolean {
  return group !== 'primaryFields' && group !== 'backFields';
}
