import { type CSSProperties, type ReactNode, useRef } from 'react';
import { bucketSpec, type Slot } from '../pass/buckets';
import { useFit, type BucketSpec } from '../pass/fit';
import { alignClass, formatFieldValue, localize, parseColor } from '../pass/format';
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
  if (style === 'boardingPass') return { secondary: secondary.slice(0, 5), auxiliary: auxiliary.slice(0, 5), auxiliary2: [] };
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
  return (
    <div className={`pass-flip ${flipped ? 'pass-flip--flipped' : ''}`} style={{ '--pass-w': `${width}px` } as CSSProperties}>
      <div className="pass-flip__face pass-flip__face--front" aria-hidden={flipped}>
        <PassFront bundle={bundle} style={style} ios27={ios27} wireframe={wireframe} pixelRatio={pixelRatio} width={width} />
      </div>
      <div className="pass-flip__face pass-flip__face--back" aria-hidden={!flipped}>
        <PassBack bundle={bundle} style={style} onFlip={onFlip} />
      </div>
    </div>
  );
}

function useColors(bundle: PassBundle, style: PassStyle) {
  const { json, images } = bundle;
  const hasBackgroundImage = style === 'eventTicket' && !!images.background && !images.strip;
  const bg = parseColor(json.backgroundColor) ?? (hasBackgroundImage ? 'rgb(60, 60, 67)' : 'rgb(255, 255, 255)');
  const fg = parseColor(json.foregroundColor) ?? (hasBackgroundImage ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
  const label = parseColor(json.labelColor) ?? fg;
  return { bg, fg, label, hasBackgroundImage };
}

function PassFront({ bundle, style, ios27, wireframe, pixelRatio, width }: { bundle: PassBundle; style: PassStyle; ios27: boolean; wireframe: boolean; pixelRatio: number; width: number }) {
  const { json, images, strings } = bundle;
  const s = json[style]!;
  const { bg, fg, label, hasBackgroundImage } = useColors(bundle, style);
  const barcode = getBarcode(json, ios27);

  const header = (s.headerFields ?? []).slice(0, fieldLimit(json, style, 'headerFields'));
  const primary = (s.primaryFields ?? []).slice(0, fieldLimit(json, style, 'primaryFields'));
  const slots = fieldSlots(json, style, ios27);

  const showStrip = (style === 'coupon' || style === 'storeCard' || style === 'eventTicket') && !!images.strip;
  const showThumbnail =
    !!images.thumbnail && (style === 'generic' || (style === 'eventTicket' && !images.strip));

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
  const invalidReason = json.voided ? 'This pass has been voided.' : expired ? 'This pass has expired.' : undefined;

  const vars = { '--pass-bg': bg, '--pass-fg': fg, '--pass-label': label } as CSSProperties;
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
            <Barcode barcode={{ ...barcode, altText: barcode.altText && localize(barcode.altText, strings) }} status={invalidReason} pixelRatio={pixelRatio} />
          ) : (
            invalidReason && <div className="pass__invalid">{invalidReason}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PassBack({ bundle, style, onFlip }: { bundle: PassBundle; style: PassStyle; onFlip: () => void }) {
  const { json, images, strings } = bundle;
  const { bg, fg, label } = useColors(bundle, style);
  const fields = json[style]?.backFields ?? [];
  const vars = { '--pass-bg': bg, '--pass-fg': fg, '--pass-label': label } as CSSProperties;

  return (
    <div className="pass-shadow">
      <div className="pass pass--back" style={vars}>
        <header className="pass__back-header">
          {images.icon && <img className="pass__back-icon" src={images.icon} alt="" />}
          <div>
            <div className="pass__back-org">{localize(json.organizationName, strings) || 'Organization'}</div>
            <div className="pass__back-desc">{localize(json.description, strings)}</div>
          </div>
          <button className="pass__done" onClick={onFlip}>
            Done
          </button>
        </header>
        <div className="pass__back-fields">
          {fields.length === 0 && <div className="pass__back-empty">No back fields.</div>}
          {fields.map((f, i) => (
            <div className="back-field" key={f.key || i}>
              {f.label && <div className="back-field__label" dir="auto">{localize(f.label, strings)}</div>}
              {/* textAlignment is invalid on back fields; data detectors apply only here. */}
              <div className="back-field__value" dir="auto">
                {f.attributedValue !== undefined ? (
                  <RichText html={localize(f.attributedValue, strings)} />
                ) : (
                  <Linkified text={formatFieldValue(f, strings)} detectors={f.dataDetectorTypes ?? DATA_DETECTORS} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
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
