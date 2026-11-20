/**
 * The Apple Wallet pass format, as Apple documents it: every object, key and allowed value in the
 * Wallet Passes reference (https://developer.apple.com/documentation/walletpasses), read in
 * November 2026 (iOS 27 era). Types only; nothing here runs.
 *
 * Conventions
 * - Descriptions are summaries, not Apple's wording. Each key's rules (which pass styles, which
 *   OS versions, limits) are the ones Apple states; nothing here comes from testing Wallet.
 * - Keys that appear only in Apple's articles, not in the object reference pages, are marked
 *   "(article only)" with the article named. Their exact JSON shape is less certain.
 * - `Localizable` marks strings that may instead be a key into the pass's `pass.strings` files.
 * - Required keys are the ones the reference marks required; everything else is optional.
 */

// ---------- Primitive aliases ----------

/** A string the system can localize: either the text itself or a key in `<lang>.lproj/pass.strings`. */
export type Localizable = string;
/** A CSS-style RGB triple, the only colour form Apple documents: `rgb(23, 187, 82)`. */
export type RGBColor = `rgb(${string})`;
/**
 * A W3C / ISO 8601 date and time. Pass-level dates (expirationDate, relevantDate) need hours and
 * minutes, seconds optional. Field values that are dates need a time zone.
 */
export type ISODateString = string;
/** An ISO 4217 currency code, e.g. `USD`. */
export type CurrencyCode = string;
/** A time zone database identifier, e.g. `America/Chicago`. */
export type TimeZoneIdentifier = string;
/** An IANA character-set name, e.g. `iso-8859-1`. */
export type CharacterSetName = string;
/** An absolute URL. */
export type URLString = string;

// ---------- pass.json: the top-level Pass object ----------

/** The five classic pass styles. A pass has exactly one of these keys (plus posterGeneric, below). */
export type PassStyleKey = 'boardingPass' | 'coupon' | 'eventTicket' | 'generic' | 'storeCard';

/**
 * Schemes for `preferredStyleSchemes` (article only: "Creating a poster event pass using semantic
 * tags" and "Creating an airline boarding pass using semantic tags"). Wallet validates the pass
 * against each scheme in turn and falls back to the classic style if none passes.
 */
export type PreferredStyleScheme = 'posterEventTicket' | 'semanticBoardingPass';

/** https://developer.apple.com/documentation/walletpasses/pass */
export interface Pass {
  // Required
  /** Short description for accessibility (VoiceOver). Required. */
  description: Localizable;
  /** File format version. Must be 1. */
  formatVersion: 1;
  /** Organization name; shown on the lock screen and in notifications. Required. */
  organizationName: Localizable;
  /** Pass type identifier registered with Apple; must match the signing certificate. */
  passTypeIdentifier: string;
  /** Unique (together with passTypeIdentifier) alphanumeric serial number. */
  serialNumber: string;
  /** Team ID of the developer account that registered the pass type identifier. */
  teamIdentifier: string;

  // Style: exactly one classic style dictionary. (posterGeneric may be added alongside one.)
  boardingPass?: BoardingPass;
  coupon?: Coupon;
  eventTicket?: EventTicket;
  generic?: Generic;
  storeCard?: StoreCard;
  /**
   * (article only: "Creating a Poster Generic Pass") iOS / watchOS 27+. Poster layout for
   * memberships, loyalty, coupons, gift cards. When present Wallet prefers it; include a classic
   * style dictionary as well for older systems.
   */
  posterGeneric?: PosterGeneric;
  /** Schemes to validate the pass against, in order of preference. */
  preferredStyleSchemes?: PreferredStyleScheme[];

  // Appearance
  /** Card background colour. */
  backgroundColor?: RGBColor;
  /** Colour of field values. */
  foregroundColor?: RGBColor;
  /** Colour of field labels. If omitted, the system picks one. */
  labelColor?: RGBColor;
  /** Text beside the logo. Not used on poster event tickets. */
  logoText?: Localizable;
  /** Poster event tickets only: text beside the logo. */
  eventLogoText?: Localizable;
  /** Poster event tickets only: footer background colour. */
  footerBackgroundColor?: RGBColor;
  /** Poster event tickets only: let Wallet derive foreground and label colours from the background image (overrides foregroundColor / labelColor). */
  useAutomaticColors?: boolean;
  /** Poster event tickets only: turn off the header darkening gradient. Default false. */
  suppressHeaderDarkening?: boolean;
  /** Show the strip image without the shine effect. Apple gives the default as true. */
  suppressStripShine?: boolean;

  // Barcodes and NFC
  /**
   * Barcodes, in order of preference: the system shows the first one the device can display.
   * Since iOS 27 more formats exist, so list an older format after a new one as a fallback.
   */
  barcodes?: Barcode[];
  /** Deprecated single barcode (QR, PDF417 or Aztec only). Use `barcodes`. */
  barcode?: LegacyBarcode;
  /** Value Added Services payload for Apple Pay terminals. */
  nfc?: NFC;

  // Relevance (lock screen)
  /** Up to 10 BLE beacons that make the pass relevant. */
  beacons?: Beacon[];
  /** Up to 10 locations that make the pass relevant. */
  locations?: Location[];
  /** Metres from a location within which the pass is relevant; the system uses the smaller of this and its default. */
  maxDistance?: number;
  /** Date intervals when the pass is relevant. */
  relevantDates?: RelevantDate[];
  /** Deprecated: the date the pass becomes relevant. Use `relevantDates`. */
  relevantDate?: ISODateString;

  // State
  /** When the pass expires (hours and minutes required). Generic passes don't expire on their own. */
  expirationDate?: ISODateString;
  /** The pass is void, e.g. a redeemed one-time coupon. Default false. */
  voided?: boolean;

  // Grouping, sharing, apps
  /** Groups related boarding passes or event tickets (same passTypeIdentifier and style). */
  groupingIdentifier?: string;
  /** iOS 11+: hide the Share button. Default false. Doesn't stop other ways of sharing. */
  sharingProhibited?: boolean;
  /** App Store IDs of apps linked from the pass. Not on watchOS. */
  associatedStoreIdentifiers?: number[];
  /** Poster event tickets only: more App Store IDs, linked from the event guide. Not on watchOS. */
  auxiliaryStoreIdentifiers?: number[];
  /** URL handed to the associated app when it launches from the pass. Not on watchOS. */
  appLaunchURL?: URLString;
  /** Custom JSON for companion apps; never shown. */
  userInfo?: unknown;

  // Web service
  /** Base URL of the update / personalization web service (may include a port). */
  webServiceURL?: URLString;
  /** Token the device sends to the web service (`Authorization: ApplePass <token>`). */
  authenticationToken?: string;

  // Machine-readable metadata
  semantics?: SemanticTags;
  /** Upcoming events shown with the pass, in order. */
  upcomingPassInformation?: UpcomingPassInformationEntry[];

  // Poster event ticket links ("This key works only for poster event tickets")
  accessibilityURL?: URLString;
  addOnURL?: URLString;
  bagPolicyURL?: URLString;
  contactVenueEmail?: string;
  contactVenuePhoneNumber?: string;
  contactVenueWebsite?: URLString;
  directionsInformationURL?: URLString;
  merchandiseURL?: URLString;
  orderFoodURL?: URLString;
  parkingInformationURL?: URLString;
  purchaseParkingURL?: URLString;
  sellURL?: URLString;
  transferURL?: URLString;
  transitInformationURL?: URLString;

  // Boarding pass links (airline and services page)
  changeSeatURL?: URLString;
  entertainmentURL?: URLString;
  managementURL?: URLString;
  purchaseAdditionalBaggageURL?: URLString;
  purchaseLoungeAccessURL?: URLString;
  purchaseWifiURL?: URLString;
  registerServiceAnimalURL?: URLString;
  reportLostBagURL?: URLString;
  requestWheelchairURL?: URLString;
  trackBagsURL?: URLString;
  upgradeURL?: URLString;
  transitProviderEmail?: string;
  transitProviderPhoneNumber?: string;
  transitProviderWebsiteURL?: URLString;
  /** (article only: "Creating an airline boarding pass using semantic tags", listed as "Business chat") */
  businessChatIdentifier?: string;
}

// ---------- Field groups ----------

/** https://developer.apple.com/documentation/walletpasses/passfields */
export interface PassFields {
  /** Top of the pass; still visible when the pass is stacked in Wallet. */
  headerFields?: PassFieldContent[];
  /** The most important information. */
  primaryFields?: PassFieldContent[];
  /** Supporting information on the front. */
  secondaryFields?: PassFieldContent[];
  /** More information on the front. Coupons, store cards and generic passes with a square barcode get up to 4 secondary + auxiliary fields combined. */
  auxiliaryFields?: AuxiliaryField[];
  /** The back / pass details. Any number. Shown on watchOS 7+. */
  backFields?: PassFieldContent[];
  /** "Additional Info" section below the pass. Poster event tickets only. */
  additionalInfoFields?: PassFieldContent[];
}

/** https://developer.apple.com/documentation/walletpasses/pass/boardingpass-data.dictionary */
export interface BoardingPass extends PassFields {
  /** Required on boarding passes, invalid elsewhere. Picks the icon (e.g. on watchOS). */
  transitType: TransitType;
}
export type TransitType = 'PKTransitTypeAir' | 'PKTransitTypeBoat' | 'PKTransitTypeBus' | 'PKTransitTypeGeneric' | 'PKTransitTypeTrain';

/** https://developer.apple.com/documentation/walletpasses/pass/coupon-data.dictionary */
export type Coupon = PassFields;
/** https://developer.apple.com/documentation/walletpasses/pass/eventticket-data.dictionary */
export type EventTicket = PassFields;
/** https://developer.apple.com/documentation/walletpasses/pass/generic-data.dictionary */
export type Generic = PassFields;
/** https://developer.apple.com/documentation/walletpasses/pass/storecard-data.dictionary */
export type StoreCard = PassFields;

/**
 * (article only: "Creating a Poster Generic Pass") iOS / watchOS 27+. The article lists header,
 * primary, footer, back and additional-info fields: one header field, up to 4 primary fields and
 * 2 footer fields. `footerFields` is named only in that article's prose.
 */
export interface PosterGeneric {
  headerFields?: PassFieldContent[];
  primaryFields?: PassFieldContent[];
  footerFields?: PassFieldContent[];
  backFields?: PassFieldContent[];
  additionalInfoFields?: PassFieldContent[];
}

// ---------- Fields ----------

export type TextAlignment = 'PKTextAlignmentLeft' | 'PKTextAlignmentCenter' | 'PKTextAlignmentRight' | 'PKTextAlignmentNatural';
export type DateStyle = 'PKDateStyleNone' | 'PKDateStyleShort' | 'PKDateStyleMedium' | 'PKDateStyleLong' | 'PKDateStyleFull';
export type NumberStyle = 'PKNumberStyleDecimal' | 'PKNumberStylePercent' | 'PKNumberStyleScientific' | 'PKNumberStyleSpellOut';
export type DataDetectorType =
  | 'PKDataDetectorTypePhoneNumber'
  | 'PKDataDetectorTypeLink'
  | 'PKDataDetectorTypeAddress'
  | 'PKDataDetectorTypeCalendarEvent';

/** https://developer.apple.com/documentation/walletpasses/passfieldcontent */
export interface PassFieldContent {
  /** Unique key for the field within the pass, e.g. `departure-gate`. Required. */
  key: string;
  /** The value: text, a number, or an ISO 8601 date (which must include a time zone). Required. */
  value: Localizable | number | ISODateString;
  /** Label text. */
  label?: Localizable;
  /** Value with HTML links (only `<a href>`); overrides `value`. Not used on watchOS. */
  attributedValue?: Localizable | number | ISODateString;
  /** Notification text when the value changes; must contain `%@`. Without it, no notification. Not on watchOS. */
  changeMessage?: Localizable;
  /** Alignment. Default natural (follows the script direction). Invalid for primary and back fields. */
  textAlignment?: TextAlignment;
  /** Date style for a date value. */
  dateStyle?: DateStyle;
  /** Time style for a date value. */
  timeStyle?: DateStyle;
  /** Show the date in the value's own time zone instead of the device's. Default false. Doesn't affect relevance. */
  ignoresTimeZone?: boolean;
  /** Show the date relative to now. Default false. Doesn't affect relevance. */
  isRelative?: boolean;
  /** Number style for a number value (same meaning as NumberFormatter's styles). */
  numberStyle?: NumberStyle;
  /** Format a number value as this currency. */
  currencyCode?: CurrencyCode;
  /** Back fields only: which detectors turn text into links. Default all; [] for none. Not on watchOS. */
  dataDetectorTypes?: DataDetectorType[];
}

/** https://developer.apple.com/documentation/walletpasses/passfields/auxiliaryfields-data.dictionary */
export interface AuxiliaryField extends PassFieldContent {
  /** Event tickets: 1 puts the field in a second auxiliary row (up to 4 fields per row). */
  row?: 0 | 1;
}

// ---------- Barcodes, NFC ----------

export type BarcodeFormat =
  | 'PKBarcodeFormatQR'
  | 'PKBarcodeFormatPDF417'
  | 'PKBarcodeFormatAztec'
  | 'PKBarcodeFormatCode128'
  /** iOS 27+ */
  | 'PKBarcodeFormatCode39'
  /** iOS 27+ */
  | 'PKBarcodeFormatCodabar'
  /** iOS 27+ */
  | 'PKBarcodeFormatEAN13'
  /** iOS 27+ (Interleaved 2 of 5, ITF) */
  | 'PKBarcodeFormatI2of5';

/** https://developer.apple.com/documentation/walletpasses/pass/barcodes-data.dictionary */
export interface Barcode {
  format: BarcodeFormat;
  /** The payload. */
  message: string;
  /** Encoding used to turn `message` into bytes, e.g. `iso-8859-1`. */
  messageEncoding: CharacterSetName;
  /** Text near the barcode, e.g. a readable copy of the message. Not on watchOS. */
  altText?: string;
}

/** Deprecated `barcode`: https://developer.apple.com/documentation/walletpasses/pass/barcode-data.dictionary */
export interface LegacyBarcode {
  format: 'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417' | 'PKBarcodeFormatAztec';
  message: string;
  messageEncoding: CharacterSetName;
  altText?: string;
}

/** https://developer.apple.com/documentation/walletpasses/pass/nfc-data.dictionary */
export interface NFC {
  /** Payload sent to the terminal; at most 64 bytes (longer is truncated). */
  message: string;
  /** Base64 X.509 SubjectPublicKeyInfo with an ECDH P-256 public key. */
  encryptionPublicKey: string;
  /** iOS 13.1+: ask the user to authenticate on every use. Default false. */
  requiresAuthentication?: boolean;
}

// ---------- Relevance ----------

/** https://developer.apple.com/documentation/walletpasses/pass/beacons-data.dictionary */
export interface Beacon {
  proximityUUID: string;
  /** 16-bit unsigned. */
  major?: number;
  /** 16-bit unsigned. */
  minor?: number;
  /** Lock-screen text when relevant. */
  relevantText?: string;
}

/** https://developer.apple.com/documentation/walletpasses/pass/locations-data.dictionary */
export interface Location {
  latitude: number;
  longitude: number;
  /** Metres. */
  altitude?: number;
  /** Lock-screen text when relevant. */
  relevantText?: string;
}

/** https://developer.apple.com/documentation/walletpasses/pass/relevantdates-data.dictionary */
export interface RelevantDate {
  /** A single date; Wallet works out the interval. */
  date?: ISODateString;
  startDate?: ISODateString;
  /** Required with startDate. */
  endDate?: ISODateString;
}

// ---------- Semantic tags ----------

export type SecurityProgram =
  | 'PKTransitSecurityProgramTSAPreCheck'
  | 'PKTransitSecurityProgramTSAPreCheckTouchlessID'
  | 'PKTransitSecurityProgramOSS'
  | 'PKTransitSecurityProgramITI'
  | 'PKTransitSecurityProgramITD'
  | 'PKTransitSecurityProgramGlobalEntry'
  | 'PKTransitSecurityProgramCLEAR';

export type PassengerCapability =
  | 'PKPassengerCapabilityPreboarding'
  | 'PKPassengerCapabilityPriorityBoarding'
  | 'PKPassengerCapabilityCarryon'
  | 'PKPassengerCapabilityPersonalItem'
  | 'PKPassengerCapabilityLapInfant';

export type EventType =
  | 'PKEventTypeGeneric'
  | 'PKEventTypeLivePerformance'
  | 'PKEventTypeMovie'
  | 'PKEventTypeSports'
  | 'PKEventTypeConference'
  | 'PKEventTypeConvention'
  | 'PKEventTypeWorkshop'
  | 'PKEventTypeSocialGathering';

/** SSR codes Wallet shows as badges (article only: "Creating an airline boarding pass using semantic tags"). */
export type PassengerInformationSSR = 'INFT';
export type PassengerServiceSSR = 'PETC' | 'SVAN' | 'UMNR' | 'WCBD' | 'WCBW' | 'WCHC' | 'WCHR' | 'WCHS' | 'WCLB' | 'WCMP' | 'WCOB';

/**
 * https://developer.apple.com/documentation/walletpasses/semantictags
 *
 * Required for a semantic boarding pass (else Wallet shows the classic one): airlineCode,
 * flightNumber, departureAirportCode, departureCityName, departureLocationTimeZone,
 * destinationAirportCode, destinationCityName, destinationLocationTimeZone, originalArrivalDate,
 * originalBoardingDate, originalDepartureDate, passengerName.
 *
 * Required for a poster event ticket (else the classic event ticket): eventName, venueName,
 * venueRegionName, venueRoom; for sports also awayTeamAbbreviation and homeTeamAbbreviation; for
 * live performances also performerNames. (Both lists: Apple's articles.)
 */
export interface SemanticTags {
  // Event
  eventName?: Localizable;
  eventType?: EventType;
  eventStartDate?: ISODateString;
  eventEndDate?: ISODateString;
  eventStartDateInfo?: EventDateInfo;
  genre?: Localizable;
  performerNames?: Localizable[];
  artistIDs?: Localizable[];
  albumIDs?: Localizable[];
  playlistIDs?: Localizable[];
  admissionLevel?: Localizable;
  admissionLevelAbbreviation?: Localizable;
  additionalTicketAttributes?: Localizable;
  attendeeName?: Localizable;
  entranceDescription?: Localizable;
  silenceRequested?: boolean;
  tailgatingAllowed?: boolean;
  // Sports
  sportName?: Localizable;
  leagueName?: Localizable;
  leagueAbbreviation?: Localizable;
  homeTeamName?: Localizable;
  homeTeamLocation?: Localizable;
  homeTeamAbbreviation?: Localizable;
  awayTeamName?: Localizable;
  awayTeamLocation?: Localizable;
  awayTeamAbbreviation?: Localizable;
  // Venue
  venueName?: Localizable;
  venueRegionName?: Localizable;
  venueRoom?: Localizable;
  venueLocation?: SemanticLocation;
  venuePhoneNumber?: Localizable;
  venueEntrance?: Localizable;
  venueEntranceDoor?: Localizable;
  venueEntranceGate?: Localizable;
  venueEntrancePortal?: Localizable;
  venueOpenDate?: ISODateString;
  venueCloseDate?: ISODateString;
  venueDoorsOpenDate?: ISODateString;
  venueGatesOpenDate?: ISODateString;
  venueBoxOfficeOpenDate?: ISODateString;
  venueFanZoneOpenDate?: ISODateString;
  venueParkingLotsOpenDate?: ISODateString;
  // Seats and money
  seats?: Seat[];
  totalPrice?: CurrencyAmount;
  balance?: CurrencyAmount;
  confirmationNumber?: Localizable;
  // Transit
  transitProvider?: Localizable;
  transitStatus?: Localizable;
  transitStatusReason?: Localizable;
  vehicleName?: Localizable;
  vehicleNumber?: Localizable;
  vehicleType?: Localizable;
  carNumber?: Localizable;
  duration?: number;
  boardingGroup?: Localizable;
  boardingSequenceNumber?: Localizable;
  boardingZone?: Localizable;
  originalBoardingDate?: ISODateString;
  originalDepartureDate?: ISODateString;
  originalArrivalDate?: ISODateString;
  currentBoardingDate?: ISODateString;
  currentDepartureDate?: ISODateString;
  currentArrivalDate?: ISODateString;
  departureLocation?: SemanticLocation;
  departureLocationDescription?: Localizable;
  departureLocationTimeZone?: TimeZoneIdentifier;
  departureLocationSecurityPrograms?: SecurityProgram[];
  departureCityName?: Localizable;
  departureStationName?: Localizable;
  departurePlatform?: Localizable;
  departureAirportCode?: Localizable;
  departureAirportName?: Localizable;
  departureTerminal?: Localizable;
  departureGate?: Localizable;
  destinationLocation?: SemanticLocation;
  destinationLocationDescription?: Localizable;
  destinationLocationTimeZone?: TimeZoneIdentifier;
  destinationLocationSecurityPrograms?: SecurityProgram[];
  destinationCityName?: Localizable;
  destinationStationName?: Localizable;
  destinationPlatform?: Localizable;
  destinationAirportCode?: Localizable;
  destinationAirportName?: Localizable;
  destinationTerminal?: Localizable;
  destinationGate?: Localizable;
  // Flights
  airlineCode?: Localizable;
  flightCode?: Localizable;
  flightNumber?: number;
  ticketFareClass?: Localizable;
  priorityStatus?: Localizable;
  securityScreening?: Localizable;
  loungePlaceIDs?: string[];
  internationalDocumentsAreVerified?: boolean;
  internationalDocumentsVerifiedDeclarationName?: Localizable;
  // Passenger
  passengerName?: PersonNameComponents;
  passengerCapabilities?: PassengerCapability[];
  passengerEligibleSecurityPrograms?: SecurityProgram[];
  passengerAirlineSSRs?: string[];
  passengerInformationSSRs?: (PassengerInformationSSR | string)[];
  passengerServiceSSRs?: (PassengerServiceSSR | string)[];
  membershipProgramName?: Localizable;
  membershipProgramNumber?: Localizable;
  membershipProgramStatus?: Localizable;
  // Other
  wifiAccess?: WifiNetwork[];
}

/** https://developer.apple.com/documentation/walletpasses/semantictagtype/currencyamount-data.dictionary */
export interface CurrencyAmount {
  amount?: string;
  currencyCode?: CurrencyCode;
}

/** https://developer.apple.com/documentation/walletpasses/semantictagtype/eventdateinfo-data.dictionary */
export interface EventDateInfo {
  date?: ISODateString;
  ignoreTimeComponents?: boolean;
  timeZone?: TimeZoneIdentifier;
  unannounced?: boolean;
  undetermined?: boolean;
}

/** https://developer.apple.com/documentation/walletpasses/semantictagtype/location-data.dictionary */
export interface SemanticLocation {
  latitude: number;
  longitude: number;
}

/** https://developer.apple.com/documentation/walletpasses/semantictagtype/personnamecomponents-data.dictionary */
export interface PersonNameComponents {
  givenName?: string;
  middleName?: string;
  familyName?: string;
  namePrefix?: string;
  nameSuffix?: string;
  nickname?: string;
  phoneticRepresentation?: string;
}

/** https://developer.apple.com/documentation/walletpasses/semantictagtype/seat-data.dictionary */
export interface Seat {
  seatIdentifier?: Localizable;
  seatNumber?: Localizable;
  seatRow?: Localizable;
  seatSection?: Localizable;
  seatLevel?: Localizable;
  seatAisle?: Localizable;
  seatType?: Localizable;
  seatDescription?: Localizable;
  /** Replaces the material strip at the bottom of a poster event ticket. */
  seatSectionColor?: RGBColor;
}

/** https://developer.apple.com/documentation/walletpasses/semantictagtype/wifinetwork-data.dictionary */
export interface WifiNetwork {
  ssid: string;
  password: string;
  captiveToken?: string;
  captiveTokenAuthURL?: URLString;
}

// ---------- Upcoming pass information ----------

/** https://developer.apple.com/documentation/walletpasses/upcomingpassinformationentry */
export interface UpcomingPassInformationEntry {
  /** Unique among the entries. */
  identifier: string;
  name: Localizable;
  type: 'event';
  /** Default false. */
  isActive?: boolean;
  /** Without it the entry is shown as TBD. */
  dateInformation?: UpcomingDateInformation;
  semantics?: SemanticTags;
  images?: UpcomingImages;
  URLs?: UpcomingURLs;
  additionalInfoFields?: PassFieldContent[];
  backFields?: PassFieldContent[];
  auxiliaryStoreIdentifiers?: number[];
}

/** https://developer.apple.com/documentation/walletpasses/upcomingpassinformationentry/dateinformation-data.dictionary */
export interface UpcomingDateInformation {
  date?: ISODateString;
  ignoreTimeComponents?: boolean;
  isAllDay?: boolean;
  isUnannounced?: boolean;
  isUndetermined?: boolean;
  /** Defaults to the device's time zone. */
  timeZone?: TimeZoneIdentifier;
}

/** https://developer.apple.com/documentation/walletpasses/upcomingpassinformationentry/images-data.dictionary */
export interface UpcomingImages {
  headerImage?: UpcomingImage;
  /** Event entries. */
  venueMap?: UpcomingImage;
}

/** https://developer.apple.com/documentation/walletpasses/upcomingpassinformationentrytype/image-data.dictionary */
export interface UpcomingImage {
  /** Candidates; the one closest to the device's scale is used. */
  URLs?: UpcomingImageURL[];
  /** Use the local equivalent image instead. */
  reuseExisting?: boolean;
}

/** https://developer.apple.com/documentation/walletpasses/upcomingpassinformationentrytype/imageurlentry-data.dictionary */
export interface UpcomingImageURL {
  /** https only. */
  URL: URLString;
  SHA256: string;
  /** Default 1. */
  scale?: number;
  /** Bytes; at most 2 MB. */
  size?: number;
}

/** https://developer.apple.com/documentation/walletpasses/upcomingpassinformationentry/urls-data.dictionary */
export interface UpcomingURLs {
  accessibilityURL?: URLString;
  addOnURL?: URLString;
  bagPolicyURL?: URLString;
  contactVenueEmail?: string;
  contactVenuePhoneNumber?: string;
  contactVenueWebsite?: URLString;
  directionsInformationURL?: URLString;
  merchandiseURL?: URLString;
  orderFoodURL?: URLString;
  parkingInformationURL?: URLString;
  purchaseParkingURL?: URLString;
  sellURL?: URLString;
  transferURL?: URLString;
  transitInformationURL?: URLString;
}

// ---------- Featured actions ----------

/**
 * (article only: "Defining the metadata of your Wallet Pass") Featured Action names. Apple lists
 * them but doesn't document the pass.json key they go in.
 */
export type FeaturedAction =
  | 'viewSchedule'
  | 'watchTrailer'
  | 'listenToMusic'
  | 'call'
  | 'place'
  | 'addToBalance'
  | 'order'
  | 'shop'
  | 'membershipBenefits'
  | 'bookAppointment'
  | 'bookCar'
  | 'bookFlight'
  | 'bookStay'
  | 'viewOffersRewards';

// ---------- The .pkpass bundle ----------

/**
 * Image file base names (each as name.png, name@2x.png, name@3x.png, optionally per .lproj).
 * `icon` is required on every pass. The current reference names only icon, logo and strip as
 * files; the rest are the names Apple's archived Wallet Developer Guide uses. The Pass Designer
 * article also lists a primary logo, secondary logo and background artwork without file names.
 */
export type PassImageName = 'icon' | 'logo' | 'strip' | 'thumbnail' | 'background' | 'footer' | 'personalizationLogo';

/** Files in a .pkpass (a zip). */
export interface PassBundleFiles {
  'pass.json': Pass;
  /** SHA-1 of every other file, keyed by its path in the bundle. */
  'manifest.json': Record<string, string>;
  /** PKCS #7 detached signature of manifest.json. */
  signature: Uint8Array;
  /** Rewards-signup passes. */
  'personalization.json'?: Personalize;
  /** `<lang>[-<region>].lproj/pass.strings`: "key" = "text"; lines (UTF-16 for non-ASCII). */
  [localizedPath: string]: unknown;
}

/** personalization.json: https://developer.apple.com/documentation/walletpasses/personalize */
export interface Personalize {
  /** Shown on the signup sheet under the personalization logo. */
  description: string;
  requiredPersonalizationFields: PersonalizationField[];
  /** May contain HTML links; shown after the user enters their details. */
  termsAndConditions?: string;
}
export type PersonalizationField =
  | 'PKPassPersonalizationFieldName'
  | 'PKPassPersonalizationFieldPostalCode'
  | 'PKPassPersonalizationFieldEmailAddress'
  | 'PKPassPersonalizationFieldPhoneNumber';

// ---------- Web service (bodies exchanged with webServiceURL) ----------

/** Body of "Register a Pass for Update Notifications": https://developer.apple.com/documentation/walletpasses/pushtoken */
export interface PushToken {
  pushToken?: string;
}

/** Response of "Get the List of Updatable Passes": https://developer.apple.com/documentation/walletpasses/serialnumbers */
export interface SerialNumbers {
  serialNumbers?: string[];
  /** Your own tag for the update time; sent back as previousLastUpdated. */
  lastUpdated?: string;
}

/** Body of "Log a Message": https://developer.apple.com/documentation/walletpasses/logentries */
export interface LogEntries {
  logs: string[];
}

/** Body of "Return a Personalized Pass": https://developer.apple.com/documentation/walletpasses/personalizationdictionary */
export interface PersonalizationDictionary {
  personalizationToken: string;
  requiredPersonalizationInfo: RequiredPersonalizationInfo;
}

/** https://developer.apple.com/documentation/walletpasses/personalizationdictionary/requiredpersonalizationinfo-data.dictionary */
export interface RequiredPersonalizationInfo {
  fullName?: string;
  givenName?: string;
  familyName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  postalCode?: string;
  ISOCountryCode?: string;
}

/**
 * The web-service endpoints, relative to webServiceURL. Register, unregister and fetch-pass requests
 * carry `Authorization: ApplePass <authenticationToken>`; 401 if it doesn't match.
 */
export interface WebServiceEndpoints {
  /** Register a device for a pass's updates. Body: PushToken. 201 new, 200 already registered. */
  'POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}': PushToken;
  /** Unregister. 200. */
  'DELETE /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}': void;
  /** Serial numbers of updated passes (?passesUpdatedSince=previousLastUpdated). 200, or 204 if none. */
  'GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}': SerialNumbers;
  /** The latest signed .pkpass. 200. */
  'GET /v1/passes/{passTypeIdentifier}/{serialNumber}': Blob;
  /** Personalize a rewards pass with the user's details. 200. */
  'POST /v1/passes/{passTypeIdentifier}/{serialNumber}/personalize': PersonalizationDictionary;
  /** Error messages from devices. */
  'POST /v1/log': LogEntries;
}
