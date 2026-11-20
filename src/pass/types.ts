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
  | 'PKBarcodeFormatCode128'
  | 'PKBarcodeFormatCode39'
  | 'PKBarcodeFormatCodabar'
  | 'PKBarcodeFormatEAN13'
  | 'PKBarcodeFormatI2of5';

export interface BarcodeFormatInfo {
  label: string;
  /** bwip-js encoder id. */
  bcid: string;
  square: boolean;
  /** Formats Apple added in iOS 27; earlier iOS skips them and falls back to the next barcode. */
  ios27: boolean;
}

/** Every value Apple's Pass.Barcodes `format` allows. */
export const BARCODE_FORMATS: Record<BarcodeFormat, BarcodeFormatInfo> = {
  PKBarcodeFormatQR: { label: 'QR', bcid: 'qrcode', square: true, ios27: false },
  PKBarcodeFormatPDF417: { label: 'PDF417', bcid: 'pdf417', square: false, ios27: false },
  PKBarcodeFormatAztec: { label: 'Aztec', bcid: 'azteccode', square: true, ios27: false },
  PKBarcodeFormatCode128: { label: 'Code 128', bcid: 'code128', square: false, ios27: false },
  PKBarcodeFormatCode39: { label: 'Code 39 (iOS 27+)', bcid: 'code39', square: false, ios27: true },
  PKBarcodeFormatCodabar: { label: 'Codabar (iOS 27+)', bcid: 'rationalizedCodabar', square: false, ios27: true },
  PKBarcodeFormatEAN13: { label: 'EAN-13 (iOS 27+)', bcid: 'ean13', square: false, ios27: true },
  PKBarcodeFormatI2of5: { label: 'Interleaved 2 of 5 (iOS 27+)', bcid: 'interleaved2of5', square: false, ios27: true },
};

export function isDisplayable(format: string, ios27: boolean): boolean {
  const info = BARCODE_FORMATS[format as BarcodeFormat];
  return !!info && (ios27 || !info.ios27);
}

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

/**
 * The barcode Wallet shows. Apple: "The system uses the first displayable barcode for the device."
 * The deprecated single `barcode` key is used only when there's no `barcodes` array.
 */
export function getBarcode(json: PassJson, ios27 = true): PassBarcode | undefined {
  if (Array.isArray(json.barcodes) && json.barcodes.length > 0) {
    return json.barcodes.find((b) => b && isDisplayable(b.format, ios27));
  }
  return json.barcode && isDisplayable(json.barcode.format, ios27) ? json.barcode : undefined;
}

/** Square barcodes (QR, Aztec) change the generic layout; see sharesSecondaryRow. */
export function hasSquareBarcode(json: PassJson, ios27 = true): boolean {
  const f = getBarcode(json, ios27)?.format;
  return !!f && !!BARCODE_FORMATS[f]?.square;
}

/**
 * Apple: "Coupons, store cards, and generic passes with a square barcode can have a
 * combined total of up to four secondary and auxiliary fields." They share one row. On iOS 27
 * (PassKit's own renderer) a generic pass with a square barcode keeps two rows of up to four.
 */
export function sharesSecondaryRow(json: PassJson, style: PassStyle, ios27 = true): boolean {
  return style === 'coupon' || style === 'storeCard' || (style === 'generic' && !ios27 && hasSquareBarcode(json, ios27));
}

/** How many fields of a group Wallet shows. Auxiliary limits on event tickets are per row. */
export function fieldLimit(json: PassJson, style: PassStyle, group: FieldGroup, ios27 = true): number {
  switch (group) {
    case 'headerFields':
      return 3;
    case 'primaryFields':
      return style === 'boardingPass' ? 2 : 1;
    case 'secondaryFields':
    case 'auxiliaryFields':
      if (sharesSecondaryRow(json, style, ios27)) return 4;
      // Apple: "Boarding passes can have up to two primary fields and up to five auxiliary fields";
      // every other row takes up to four.
      return style === 'boardingPass' && group === 'auxiliaryFields' ? 5 : 4;
    case 'backFields':
      return Infinity;
  }
}

/** Groups where textAlignment is allowed (Apple: invalid for primary and back fields). */
export function allowsAlignment(group: FieldGroup): boolean {
  return group !== 'primaryFields' && group !== 'backFields';
}
