import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from 'react';
import { bucketSpec, type Slot } from '../pass/buckets';
import { useFit, type BucketSpec } from '../pass/fit';
import { alignClass, colorLightness, formatFieldValue, localize, parseColor } from '../pass/format';
import {
  BARCODE_FORMATS,
  DATA_DETECTORS,
  fieldLimit,
  getBarcode,
  getStyle,
  sharesSecondaryRow,
  type DataDetectorType,
  type PassBundle,
  type PassField,
  type PassJson,
  type PassStyle,
} from '../pass/types';
import { Barcode } from './Barcode';
import { TransitIcon } from './TransitIcon';

/**
 * The field rows under the primary area, by slot, trimmed to what Wallet shows. Each slot has a
 * fixed position per style (pass.css), so an empty group leaves its slot empty instead of letting
 * the rows below move up (e.g. into the space beside an event ticket's thumbnail).
 */
interface Slots {
  secondary: PassField[];
  auxiliary: PassField[];
  /** Event tickets only: auxiliary fields with "row": 1. */
  auxiliary2: PassField[];
}

function fieldSlots(json: PassJson, style: PassStyle, ios27: boolean): Slots {
  const s = json[style] ?? {};
  const secondary = s.secondaryFields ?? [];
  const auxiliary = s.auxiliaryFields ?? [];
  if (sharesSecondaryRow(json, style, ios27)) {
    // Coupons, store cards and generic passes with a square barcode: one shared row of up to four.
    return { secondary: [...secondary, ...auxiliary].slice(0, 4), auxiliary: [], auxiliary2: [] };
  }
  if (style === 'boardingPass') return { secondary: secondary.slice(0, 4), auxiliary: auxiliary.slice(0, 5), auxiliary2: [] };
  if (style === 'eventTicket') {
    return {
      secondary: secondary.slice(0, 4),
      auxiliary: auxiliary.filter((f) => (f.row ?? 0) !== 1).slice(0, 4),
      auxiliary2: auxiliary.filter((f) => f.row === 1).slice(0, 4),
    };
  }
  return { secondary: secondary.slice(0, 4), auxiliary: auxiliary.slice(0, 4), auxiliary2: [] };
}

interface Props {
  bundle: PassBundle;
  /** Preview as iOS 27+ (true) or iOS 26 and earlier; decides which barcode is shown. */
  ios27?: boolean;
  /** Outline and name every slot (used by the layout guide). */
  wireframe?: boolean;
  /** Card width in points: the iPhone's screen width minus 32. Height is always 503 pt. */
  width?: number;
  /** Device pixels per point, for pixel-snapped QR / Aztec sizing. */
  pixelRatio?: number;
  flipped: boolean;
  onFlip: () => void;
}

export function PassView({ bundle, ios27 = true, wireframe = false, width = 343, pixelRatio = 3, flipped, onFlip }: Props) {
  const style = getStyle(bundle.json);
  if (!style) {
    return <div className="pass-empty">This pass.json has no classic style key, so there is nothing to render.</div>;
  }
  // iOS 27 has no flip: the "back" is the pass details screen, shown in place of the card.
  void onFlip;
  return (
    <div className={`pass-flip ${flipped ? 'pass-flip--flipped' : ''}`} style={{ '--pass-w': `${width}px` } as CSSProperties}>
      {flipped ? (
        <div className="pass-flip__face pass-flip__face--back">
          <PassBack bundle={bundle} style={style} ios27={ios27} pixelRatio={pixelRatio} width={width} />
        </div>
      ) : (
        <div className="pass-flip__face pass-flip__face--front">
          <PassFront bundle={bundle} style={style} ios27={ios27} wireframe={wireframe} pixelRatio={pixelRatio} width={width} />
        </div>
      )}
    </div>
  );
}

function useColors(bundle: PassBundle, style: PassStyle) {
  const { json, images } = bundle;
  // Event tickets: a background image wins over a strip image (PassKit draws the background
  // layout and ignores strip.png when both are present).
  const hasBackgroundImage = style === 'eventTicket' && !!images.background;
  // PassKit's defaults (iOS 27): white card and black text; behind a background image the card is
  // black and the text white. A missing labelColor is black (PassKit fills it in before its own
  // "automatic" rule could run), whatever the background.
  const bg = parseColor(json.backgroundColor) ?? (hasBackgroundImage ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
  const fg = parseColor(json.foregroundColor) ?? (hasBackgroundImage ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
  const label = parseColor(json.labelColor) ?? 'rgb(0, 0, 0)';
  // Logo text takes labelColor on a dark card (lightness below 0.22, or any background image) and
  // foregroundColor otherwise.
  const logo = hasBackgroundImage || colorLightness(bg) < 0.22 ? label : fg;
  return { bg, fg, label, logo, hasBackgroundImage };
}

function PassFront({ bundle, style, ios27, wireframe, pixelRatio, width }: { bundle: PassBundle; style: PassStyle; ios27: boolean; wireframe: boolean; pixelRatio: number; width: number }) {
  const { json, images, strings } = bundle;
  const s = json[style]!;
  const { bg, fg, label, logo, hasBackgroundImage } = useColors(bundle, style);
  const barcode = getBarcode(json, ios27);

  const header = (s.headerFields ?? []).slice(0, fieldLimit(json, style, 'headerFields'));
  const primary = (s.primaryFields ?? []).slice(0, fieldLimit(json, style, 'primaryFields'));
  const slots = fieldSlots(json, style, ios27);

  // Event tickets: background.png beats strip.png, and strip.png beats thumbnail.png (PassKit, iOS 27).
  const showStrip = !!images.strip && (style === 'coupon' || style === 'storeCard' || (style === 'eventTicket' && !images.background));
  const showThumbnail = !!images.thumbnail && (style === 'generic' || (style === 'eventTicket' && !showStrip));

  // Fit the header and primary fields as Wallet does (see pass/fit.ts). The key changes with the
  // content and with anything that changes the slot's box (style, strip, thumbnail, width).
  const boxKey = Object.keys(strings).length + style + (showStrip ? ':strip' : '') + (showThumbnail ? ':thumb' : '') + ':' + width;
  const primaryRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const spec = (slot: Slot) => bucketSpec(style, slot, showStrip);
  useFit(primaryRef, JSON.stringify(primary) + boxKey, spec('primary'));
  useFit(headerRef, JSON.stringify(header) + boxKey, spec('header'));
  // Coupons and store cards always set the primary value large (on the strip, or where it would be);
  // so do event tickets with a strip, which show no primary label at all.
  const bigPrimary = style === 'coupon' || style === 'storeCard' || (style === 'eventTicket' && showStrip);

  const expired = !!json.expirationDate && new Date(json.expirationDate).getTime() < Date.now();
  // Voided or expired: PassKit greys the barcode out (and swaps its alt text for a notice).
  const invalid = !!json.voided || expired;

  const vars = { '--pass-bg': bg, '--pass-fg': fg, '--pass-label': label, '--pass-logo': logo } as CSSProperties;
  const ctx = { strings, width };

  // Layout variant, used by pass.css to place blocks at the positions measured from Apple's renders.
  const layout = style === 'boardingPass' ? 'boarding' : showStrip ? 'strip' : hasBackgroundImage ? 'background' : 'plain';
  const square = !!barcode && !!BARCODE_FORMATS[barcode.format]?.square;

  return (
    <div className="pass-shadow">
      <div
        className={`pass pass--${style} pass--layout-${layout} ${showThumbnail ? 'pass--thumb' : ''} ${wireframe ? 'pass--wireframe' : ''}`}
        style={vars}
      >
        {hasBackgroundImage && (
          <div className="pass__background" style={{ backgroundImage: `url("${images.background}")` }} />
        )}

        <header className={`pass__header ${header.length === 0 ? 'pass__header--bare' : ''}`}>
          <div className="pass__logo" data-slot="logo + logoText">
            {images.logo && <img src={images.logo} alt="" />}
            {/* One line: like UILabel, only the text before a line break shows. */}
            {json.logoText && <span className="pass__logo-text" dir="auto">{localize(json.logoText, strings).split(/\r\n?|\n/)[0]}</span>}
          </div>
          {header.length > 0 && (
            // Wallet lays header fields out from the right: the first one is rightmost.
            <div className="pass__header-fields" data-slot="headerFields" ref={headerRef}>
              {header.map((f, i) => (
                <Field key={f.key || i} field={f} ctx={ctx} variant="header" align={alignClass(f, 'end')} />
              ))}
            </div>
          )}
        </header>

        {/* textAlignment is invalid on primary fields, so their alignment is fixed per style. */}
        {style === 'boardingPass' ? (
          <div className="pass__primary pass__primary--boarding" data-slot="primaryFields" ref={primaryRef}>
            {primary[0] ? <Field field={primary[0]} ctx={ctx} variant="primary" align="start" /> : <span />}
            <TransitIcon type={s.transitType} color={label} />
            {primary[1] ? <Field field={primary[1]} ctx={ctx} variant="primary" align="end" /> : <span />}
          </div>
        ) : showStrip ? (
          <div className="pass__strip" data-slot="strip.png · primaryFields" ref={primaryRef} style={{ backgroundImage: `url("${images.strip}")` }}>
            {primary[0] && <Field field={primary[0]} ctx={ctx} variant="primary-strip" align="start" caption={style !== 'eventTicket'} />}
          </div>
        ) : (
          <div className="pass__primary" data-slot="primaryFields" ref={primaryRef}>
            {primary[0] && (
              <Field field={primary[0]} ctx={ctx} variant={bigPrimary ? 'primary-strip' : 'primary'} align="start" wrap={!bigPrimary} />
            )}
          </div>
        )}

        {showThumbnail && <img className="pass__thumbnail" src={images.thumbnail} alt="" />}

        {/* Only the event ticket's secondary slot sits beside the thumbnail; the generic thumbnail ends above it. */}
        <FieldRow
          slot="secondary"
          name={sharesSecondaryRow(json, style, ios27) ? 'secondaryFields + auxiliaryFields' : undefined}
          fields={slots.secondary}
          ctx={ctx}
          spec={spec('secondary')}
          fitKey={boxKey}
          beside={showThumbnail && style === 'eventTicket'}
        />
        <FieldRow slot="auxiliary" fields={slots.auxiliary} ctx={ctx} spec={spec('auxiliary')} fitKey={boxKey} />
        <FieldRow slot="auxiliary2" fields={slots.auxiliary2} ctx={ctx} spec={spec('auxiliary2')} fitKey={boxKey} />

        <div className={`pass__bottom ${square ? 'pass__bottom--square' : ''}`} data-slot="barcodes[0]">
          {style === 'boardingPass' && images.footer && <img className="pass__footer" src={images.footer} alt="" />}
          {barcode ? (
            <Barcode barcode={{ ...barcode, altText: barcode.altText && localize(barcode.altText, strings) }} invalid={invalid} pixelRatio={pixelRatio} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The back: Wallet's pass details screen on iOS 27 (PKBarcodePassDetailViewController), measured in
 * the Simulator. Screen width = card width + 32. From the top: the navigation area with the share
 * button (116 pt), the top of the card at 116 pt wide, the description as the title, the Automatic
 * Updates / Allow Notifications switches (only with a webServiceURL), Remove Pass, then the back
 * fields. A value sits on its label's row, right-aligned, when both fit; otherwise it goes under the
 * label. Links and phone numbers (per dataDetectorTypes) and attributedValue links are blue.
 */
function PassBack({ bundle, style, ios27, pixelRatio, width }: { bundle: PassBundle; style: PassStyle; ios27: boolean; pixelRatio: number; width: number }) {
  const { json, strings } = bundle;
  const fields = (json[style]?.backFields ?? []).filter((f) => f.value !== undefined || f.attributedValue !== undefined);
  const title = localize(json.description, strings);
  const mini = 116 / width;
  // A value stays on its label's row when label + 16 pt + value fit the row; otherwise it goes under.
  const fieldsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const group = fieldsRef.current;
    if (!group) return;
    const place = () => {
      for (const row of group.querySelectorAll<HTMLElement>('.details__field')) {
        row.classList.remove('details__field--stacked');
        const label = row.querySelector<HTMLElement>('.details__label');
        const value = row.querySelector<HTMLElement>('.details__value');
        if (!label || !value) continue;
        const cs = getComputedStyle(row);
        const room = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        // Natural widths: no shrinking, no wrapping (a value's own line breaks still count).
        const natural = (el: HTMLElement, ws: string) => {
          el.style.flex = 'none';
          el.style.whiteSpace = ws;
          const w = el.getBoundingClientRect().width;
          el.style.flex = '';
          el.style.whiteSpace = '';
          return w;
        };
        const fits = natural(label, 'pre') + 16 + natural(value, 'pre') <= room + 0.5;
        row.classList.toggle('details__field--stacked', !fits);
      }
    };
    place();
    document.fonts?.ready.then(place).catch(() => {});
  }, [fields, strings, width]);
  return (
    <div className="pass pass--details" style={{ '--screen-w': `${width + 32}px` } as CSSProperties}>
      <div className="details__nav">
        <span className="details__share" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
          </svg>
        </span>
      </div>
      <div className="details__card" aria-hidden="true">
        <div className="details__card-scale" style={{ transform: `scale(${mini})`, width }}>
          <PassFront bundle={bundle} style={style} ios27={ios27} wireframe={false} pixelRatio={pixelRatio} width={width} />
        </div>
      </div>
      <div className="details__rule" />
      {title ? <h2 className="details__title">{title}</h2> : <div className="details__title-space" />}
      {!!json.webServiceURL && (
        <div className="details__group">
          {['Automatic Updates', 'Allow Notifications'].map((t) => (
            <div className="details__row details__row--setting" key={t}>
              <span>{t}</span>
              <span className="details__switch" aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
      <div className="details__group">
        <div className="details__row details__row--setting details__remove">Remove Pass</div>
      </div>
      {fields.length > 0 && (
        <div className="details__group" ref={fieldsRef}>
          {fields.map((f, i) => {
            const label = localize(f.label, strings);
            return (
              <div className={`details__field ${label ? '' : 'details__field--nolabel'}`} key={f.key || i}>
                {label && (
                  <div className="details__label" dir="auto">
                    {label}
                  </div>
                )}
                <div className="details__value" dir="auto">
                  {f.attributedValue !== undefined ? (
                    <RichText html={localize(f.attributedValue, strings)} />
                  ) : (
                    <Linkified text={formatFieldValue(f, strings)} detectors={f.dataDetectorTypes ?? DATA_DETECTORS} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Variant = 'header' | 'primary' | 'primary-strip' | 'aux';

function Field({
  field,
  ctx,
  variant,
  align,
  wrap = false,
  caption = true,
}: {
  field: PassField;
  ctx: { strings: Record<string, string> };
  variant: Variant;
  align: string;
  /** The value may wrap onto a second line (and keeps its own line breaks). */
  wrap?: boolean;
  /** Strip primaries: show the label as a caption under the value. */
  caption?: boolean;
}) {
  const labelText = localize(field.label, ctx.strings);
  // attributedValue overrides value; on the front its links aren't interactive, so show its text.
  const full = (
    field.attributedValue !== undefined ? htmlToText(localize(field.attributedValue, ctx.strings)) : formatFieldValue(field, ctx.strings)
  ).replace(/\r\n?/g, '\n');
  // Single-line values show only their first line, as UILabel does.
  const value = wrap ? full : full.split('\n')[0];
  // On coupon / store card strips the big value sits above its label.
  const valueFirst = variant === 'primary-strip';
  return (
    <div className={`field field--${variant} align-${align} ${wrap ? 'field--wrap' : ''}`} data-key={field.key}>
      {!valueFirst && labelText && <div className="field__label" dir="auto">{labelText}</div>}
      <div className="field__value" dir="auto">{value || ' '}</div>
      {valueFirst && caption && labelText && <div className="field__label" dir="auto">{labelText}</div>}
    </div>
  );
}

const SLOT_NAMES: Record<keyof Slots, string> = {
  secondary: 'secondaryFields',
  auxiliary: 'auxiliaryFields',
  auxiliary2: 'auxiliaryFields · "row": 1',
};

function FieldRow({
  slot,
  name,
  fields,
  ctx,
  spec,
  fitKey,
  beside,
}: {
  slot: keyof Slots;
  /** Slot name shown in wireframe mode, when it differs from the default. */
  name?: string;
  fields: PassField[];
  ctx: { strings: Record<string, string>; width?: number };
  spec: BucketSpec;
  fitKey: string;
  beside?: boolean;
}) {
  // Wallet's row layout: wrapping, narrowing and shrinking (see pass/fit.ts).
  const ref = useRef<HTMLDivElement>(null);
  // The box key is in the fit key so it re-runs on a device change even where ResizeObserver is held
  // back (background tabs, image export).
  useFit(ref, JSON.stringify(fields) + String(beside) + fitKey, spec);
  if (fields.length === 0) return null;
  return (
    <div
      ref={ref}
      className={`pass__row pass__row--${slot} pass__row--${fields.length} ${beside ? 'pass__row--beside' : ''}`}
      data-slot={name ?? SLOT_NAMES[slot]}
    >
      {fields.map((f, i) => {
        // Natural alignment: each field is left-aligned in its slot; slots are spread with equal gaps
        // (measured on Apple's coupon, generic and store card renders).
        return <Field key={f.key || i} field={f} ctx={ctx} variant="aux" align={alignClass(f, 'start')} wrap={!!spec.canWrap} />;
      })}
    </div>
  );
}

const URL_RE = String.raw`https?:\/\/[^\s<]+[^\s<.,;:!?)\]]|[\w.+-]+@[\w-]+\.[\w.-]+\w`;
const PHONE_RE = String.raw`\+?\d[\d ()-]{7,}\d`;

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.textContent ?? '';
}

/** Turns links and phone numbers into tappable links, honouring the field's dataDetectorTypes. */
function Linkified({ text, detectors }: { text: string; detectors: DataDetectorType[] }) {
  const sources = [
    detectors.includes('PKDataDetectorTypeLink') && URL_RE,
    detectors.includes('PKDataDetectorTypePhoneNumber') && PHONE_RE,
  ].filter(Boolean);
  if (sources.length === 0) return <>{text}</>;
  const re = new RegExp(`(${sources.join('|')})`, 'g');
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const t = m[0];
    const idx = m.index!;
    if (idx > last) parts.push(text.slice(last, idx));
    const href = t.startsWith('http') ? t : t.includes('@') ? `mailto:${t}` : `tel:${t.replace(/[^\d+]/g, '')}`;
    parts.push(
      <a key={idx} href={href} target="_blank" rel="noreferrer">
        {t}
      </a>,
    );
    last = idx + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** attributedValue may contain <a href> tags; render only text and safe links. */
function RichText({ html }: { html: string }) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node: Node, key: string): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element;
    const children = Array.from(el.childNodes).map((c, i) => walk(c, `${key}.${i}`));
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') ?? '';
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        return (
          <a key={key} href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      }
    }
    if (el.tagName === 'BR') return <br key={key} />;
    return <span key={key}>{children}</span>;
  };
  return <>{Array.from(doc.body.childNodes).map((c, i) => walk(c, String(i)))}</>;
}
