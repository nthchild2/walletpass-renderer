import { useState } from 'react';
import { colorToHex, hexToRgb, parseColor } from '../pass/format';
import { blankPass, sampleFor } from '../pass/samples';
import {
  allowsAlignment,
  BARCODE_FORMATS,
  DATA_DETECTORS,
  FIELD_GROUP_LABELS,
  fieldLimit,
  getBarcode,
  getStyle,
  PASS_STYLES,
  sharesSecondaryRow,
  STYLE_IMAGES,
  STYLE_LABELS,
  type BarcodeFormat,
  type DataDetectorType,
  type DateStyle,
  type FieldGroup,
  type ImageName,
  type NumberStyle,
  type PassBundle,
  type PassField,
  type PassBarcode,
  type PassJson,
  type PassStyle,
  type TextAlignment,
  type TransitType,
} from '../pass/types';

interface Props {
  bundle: PassBundle;
  onChange: (bundle: PassBundle) => void;
}

const IMAGE_HINTS: Record<ImageName, string> = {
  icon: 'Required. Lock screen, notifications, Mail (29×29 pt)',
  logo: 'Top-left of the pass (max 160×50 pt)',
  strip: 'Behind the primary field (375×144 pt, 375×98 for event tickets)',
  background: 'Blurred behind the whole event ticket (180×220 pt)',
  thumbnail: 'Beside the primary field (90 pt tall, 60–90 wide)',
  footer: 'Above the barcode (286×15 pt)',
};

/** One editable list: a field group, or one auxiliary row of an event ticket. */
interface Section {
  id: string;
  title: string;
  group: FieldGroup;
  row?: 0 | 1;
  hint?: string;
}

function sectionsFor(json: PassJson, style: PassStyle): Section[] {
  const shared = sharesSecondaryRow(json, style);
  const sections: Section[] = [
    { id: 'header', title: FIELD_GROUP_LABELS.headerFields, group: 'headerFields' },
    { id: 'primary', title: FIELD_GROUP_LABELS.primaryFields, group: 'primaryFields' },
    { id: 'secondary', title: FIELD_GROUP_LABELS.secondaryFields, group: 'secondaryFields' },
  ];
  if (style === 'eventTicket') {
    sections.push(
      { id: 'aux0', title: 'Auxiliary fields · row 1', group: 'auxiliaryFields', row: 0 },
      {
        id: 'aux1',
        title: 'Auxiliary fields · row 2',
        group: 'auxiliaryFields',
        row: 1,
        hint: 'Event tickets only: fields here get "row": 1. Each row shows up to four fields.',
      },
    );
  } else {
    sections.push({ id: 'aux', title: FIELD_GROUP_LABELS.auxiliaryFields, group: 'auxiliaryFields' });
  }
  sections.push({ id: 'back', title: FIELD_GROUP_LABELS.backFields, group: 'backFields' });
  if (shared) {
    const why =
      style === 'generic'
        ? 'Generic passes with a square barcode (QR, Aztec)'
        : style === 'coupon'
          ? 'Coupons'
          : 'Store cards';
    sections[2].hint = `${why} show secondary and auxiliary fields in one row: up to four in total.`;
  }
  return sections;
}

export function Editor({ bundle, onChange }: Props) {
  const { json } = bundle;
  const style = getStyle(json) ?? 'generic';
  const structure = json[style] ?? {};

  const setJson = (patch: Partial<PassJson>) => onChange({ ...bundle, json: { ...json, ...patch } });
  const setStructure = (patch: Partial<typeof structure>) => setJson({ [style]: { ...structure, ...patch } });

  const changeStyle = (next: PassStyle) => {
    if (next === style) return;
    const copy: PassJson = { ...json };
    const moved = { ...structure };
    delete copy[style];
    if (next === 'boardingPass' && !moved.transitType) moved.transitType = 'PKTransitTypeGeneric';
    if (next !== 'boardingPass') delete moved.transitType;
    // `row` only means something on event tickets.
    if (next !== 'eventTicket' && moved.auxiliaryFields) {
      moved.auxiliaryFields = moved.auxiliaryFields.map(({ row: _row, ...f }) => f);
    }
    copy[next] = moved;
    onChange({ ...bundle, json: copy });
  };

  const inSection = (s: Section, f: PassField) => s.row === undefined || (f.row ?? 0) === s.row;

  /** How many more fields this section can take before Wallet stops showing them. */
  const remaining = (s: Section): number => {
    const limit = fieldLimit(json, style, s.group);
    if (sharesSecondaryRow(json, style) && (s.group === 'secondaryFields' || s.group === 'auxiliaryFields')) {
      return limit - (structure.secondaryFields ?? []).length - (structure.auxiliaryFields ?? []).length;
    }
    return limit - (structure[s.group] ?? []).filter((f) => inSection(s, f)).length;
  };

  const setList = (group: FieldGroup, list: PassField[]) => setStructure({ [group]: list.length ? list : undefined });

  const addField = (s: Section) => {
    const list = structure[s.group] ?? [];
    const used = new Set(
      (['headerFields', 'primaryFields', 'secondaryFields', 'auxiliaryFields', 'backFields'] as const).flatMap((g) =>
        (structure[g] ?? []).map((f) => f.key),
      ),
    );
    const base = s.group.replace('Fields', '');
    let n = list.length + 1;
    while (used.has(`${base}${n}`)) n++;
    const field: PassField = { key: `${base}${n}`, label: 'Label', value: 'Value' };
    if (s.row === 1) field.row = 1;
    setList(s.group, [...list, field]);
  };

  return (
    <div className="editor">
      <section className="panel">
        <h2>Pass style</h2>
        <div className="style-picker">
          {PASS_STYLES.map((s) => (
            <button key={s} className={`chip ${s === style ? 'chip--active' : ''}`} onClick={() => changeStyle(s)}>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="row-actions">
          <button className="btn btn--small" onClick={() => onChange(sampleFor(style))}>
            Load {STYLE_LABELS[style].toLowerCase()} example
          </button>
          <button className="btn btn--small btn--ghost" onClick={() => onChange(blankPass(style))}>
            Start blank
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Basics</h2>
        <div className="grid2">
          <Text label="Organization name" value={json.organizationName} onChange={(v) => setJson({ organizationName: v })} />
          <Text label="Logo text" value={json.logoText} onChange={(v) => setJson({ logoText: v || undefined })} />
          <Text label="Description" value={json.description} onChange={(v) => setJson({ description: v })} />
          <Text label="Serial number" mono value={json.serialNumber} onChange={(v) => setJson({ serialNumber: v })} />
          {(style === 'eventTicket' || style === 'boardingPass') && (
            <Text
              label="Grouping identifier"
              mono
              placeholder="Optional"
              value={typeof json.groupingIdentifier === 'string' ? json.groupingIdentifier : ''}
              onChange={(v) => setJson({ groupingIdentifier: v || undefined })}
            />
          )}
        </div>
        {(style === 'eventTicket' || style === 'boardingPass') && (
          <p className="hint">
            Passes with the same pass type identifier and grouping identifier are stacked together in Wallet (e.g. the tickets
            for one event). It doesn't change how a pass looks.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Colors</h2>
        <div className="grid3">
          <Color label="Background" value={json.backgroundColor} onChange={(v) => setJson({ backgroundColor: v })} />
          <Color label="Foreground" value={json.foregroundColor} onChange={(v) => setJson({ foregroundColor: v })} />
          <Color label="Label" value={json.labelColor} onChange={(v) => setJson({ labelColor: v })} />
        </div>
      </section>

      <section className="panel">
        <h2>Images</h2>
        <p className="hint">The images a {STYLE_LABELS[style].toLowerCase()} can show. Use PNGs at @2x or @3x for a sharp result.</p>
        <div className="images">
          {STYLE_IMAGES[style].map((name) => (
            <ImageSlot
              key={name}
              name={name}
              src={bundle.images[name]}
              onChange={(file) => {
                const images = { ...bundle.images };
                if (file) images[name] = URL.createObjectURL(file);
                else delete images[name];
                onChange({ ...bundle, images });
              }}
            />
          ))}
        </div>
      </section>

      {style === 'boardingPass' && (
        <section className="panel">
          <h2>Transit type</h2>
          <select
            value={structure.transitType ?? 'PKTransitTypeGeneric'}
            onChange={(e) => setStructure({ transitType: e.target.value as TransitType })}
          >
            {['Air', 'Train', 'Bus', 'Boat', 'Generic'].map((t) => (
              <option key={t} value={`PKTransitType${t}`}>
                {t}
              </option>
            ))}
          </select>
        </section>
      )}

      {sectionsFor(json, style).map((s) => {
        const all = structure[s.group] ?? [];
        const indices = all.map((f, i) => (inSection(s, f) ? i : -1)).filter((i) => i >= 0);
        const left = remaining(s);
        const limit = fieldLimit(json, style, s.group);
        return (
          <section className="panel" key={s.id}>
            <div className="panel__title">
              <h2>
                {s.title}
                {Number.isFinite(limit) && (
                  <span className="count mono">
                    {' '}
                    {indices.length}/{sharesSecondaryRow(json, style) && s.group !== 'headerFields' && s.group !== 'primaryFields' ? '4 shared' : limit}
                  </span>
                )}
              </h2>
              <button className="btn btn--small" disabled={left <= 0} onClick={() => addField(s)}>
                + Add field
              </button>
            </div>
            {s.hint && <p className="hint">{s.hint}</p>}
            {indices.length === 0 && <p className="hint">No fields.</p>}
            {indices.map((index, pos) => (
              <FieldEditor
                key={`${s.id}-${index}`}
                field={all[index]}
                group={s.group}
                overLimit={left < 0 && pos >= indices.length + left}
                onChange={(nf) => {
                  const list = [...all];
                  list[index] = nf;
                  setList(s.group, list);
                }}
                onRemove={() => setList(s.group, all.filter((_, i) => i !== index))}
                onUp={
                  pos > 0
                    ? () => {
                        const list = [...all];
                        const j = indices[pos - 1];
                        [list[index], list[j]] = [list[j], list[index]];
                        setList(s.group, list);
                      }
                    : undefined
                }
                onDown={
                  pos < indices.length - 1
                    ? () => {
                        const list = [...all];
                        const j = indices[pos + 1];
                        [list[index], list[j]] = [list[j], list[index]];
                        setList(s.group, list);
                      }
                    : undefined
                }
              />
            ))}
          </section>
        );
      })}

      <BarcodeEditor bundle={bundle} onChange={onChange} />

      <section className="panel">
        <h2>Validity</h2>
        <div className="grid2">
          <Text
            label="Expiration date (ISO 8601, with time)"
            placeholder="2027-01-31T23:59-08:00"
            mono
            value={json.expirationDate}
            onChange={(v) => setJson({ expirationDate: v || undefined })}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={!!json.voided} onChange={(e) => setJson({ voided: e.target.checked || undefined })} />
          Voided
        </label>
      </section>
    </div>
  );
}

function BarcodeEditor({ bundle, onChange }: Props) {
  const { json } = bundle;
  // The deprecated single `barcode` is shown as a one-item list; editing saves it as `barcodes`.
  const list: PassBarcode[] = Array.isArray(json.barcodes) ? json.barcodes : json.barcode ? [json.barcode] : [];
  const shownNew = getBarcode(json, true);
  const shownOld = getBarcode(json, false);

  const save = (next: PassBarcode[]) => {
    const copy: PassJson = { ...json };
    delete copy.barcode;
    if (next.length) copy.barcodes = next;
    else delete copy.barcodes;
    onChange({ ...bundle, json: copy });
  };
  const update = (i: number, patch: Partial<PassBarcode>) => {
    const next = [...list];
    const b = { ...next[i], ...patch };
    if (!b.altText) delete b.altText;
    next[i] = b;
    save(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    save(next);
  };

  return (
    <section className="panel">
      <div className="panel__title">
        <h2>Barcodes</h2>
        <button
          className="btn btn--small"
          onClick={() => save([...list, { format: 'PKBarcodeFormatQR', message: '', messageEncoding: 'iso-8859-1' }])}
        >
          + Add barcode
        </button>
      </div>
      <p className="hint">
        Wallet shows the first barcode the device can display. EAN-13, Code 39, Codabar and Interleaved 2 of 5 need iOS 27,
        so put an older format after them as a fallback.
      </p>
      {list.length === 0 && <p className="hint">No barcode.</p>}
      {list.map((b, i) => (
        <div className="field-editor field-editor--barcode" key={i}>
          <div className="barcode-tags">
            {b === shownNew && <span className="tag">Shown on iOS 27+</span>}
            {b === shownOld && <span className="tag">Shown on iOS 26 and earlier</span>}
            {b !== shownNew && b !== shownOld && <span className="tag tag--muted">Fallback, not shown</span>}
          </div>
          <div className="field-editor__main">
            <label className="input input--key">
              <span>Format</span>
              <select value={b.format} onChange={(e) => update(i, { format: e.target.value as BarcodeFormat })}>
                {(Object.keys(BARCODE_FORMATS) as BarcodeFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {BARCODE_FORMATS[f].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input">
              <span>Message</span>
              <input className="mono" value={b.message ?? ''} onChange={(e) => update(i, { message: e.target.value })} />
            </label>
            <label className="input input--value">
              <span>Alt text (shown below)</span>
              <input value={b.altText ?? ''} onChange={(e) => update(i, { altText: e.target.value })} />
            </label>
            <div className="field-editor__buttons">
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Move up" aria-label="Move up">↑</button>
              <button className="icon-btn" disabled={i === list.length - 1} onClick={() => move(i, 1)} title="Move down" aria-label="Move down">↓</button>
              <button className="icon-btn icon-btn--danger" onClick={() => save(list.filter((_, j) => j !== i))} title="Remove barcode" aria-label="Remove barcode">×</button>
            </div>
          </div>
          <div className="field-editor__advanced">
            <label className="input">
              <span>Message encoding</span>
              <select value={b.messageEncoding ?? ''} onChange={(e) => update(i, { messageEncoding: e.target.value })}>
                {!b.messageEncoding && <option value="">— (required)</option>}
                <option value="iso-8859-1">iso-8859-1</option>
                <option value="utf-8">utf-8</option>
                <option value="us-ascii">us-ascii</option>
                {b.messageEncoding && !['iso-8859-1', 'utf-8', 'us-ascii'].includes(b.messageEncoding) && (
                  <option value={b.messageEncoding}>{b.messageEncoding}</option>
                )}
              </select>
            </label>
          </div>
        </div>
      ))}
    </section>
  );
}

function ImageSlot({ name, src, onChange }: { name: ImageName; src?: string; onChange: (file: File | null) => void }) {
  return (
    <div className="image-slot">
      <div className="image-slot__preview">{src ? <img src={src} alt="" /> : <span>none</span>}</div>
      <div className="image-slot__meta">
        <strong>{name}.png</strong>
        <span className="hint">{IMAGE_HINTS[name]}</span>
        <div className="row-actions">
          <label className="btn btn--small">
            Choose…
            <input
              type="file"
              accept="image/png,image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onChange(f);
                e.target.value = '';
              }}
            />
          </label>
          {src && (
            <button className="btn btn--small btn--ghost" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="input">
      <span>{label}</span>
      <input className={mono ? 'mono' : undefined} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * Color: pick it, or type hex (#RRGGBB / #RGB) or rgb(r, g, b). Apple documents only the
 * rgb() form for pass.json, so whatever is typed is saved as rgb().
 */
function Color({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string | undefined) => void }) {
  const set = parseColor(value) !== undefined;
  const [text, setText] = useState<string | null>(null); // what's being typed, until it's valid
  const [invalid, setInvalid] = useState(false);
  const shown = text ?? (set ? colorToHex(value).toUpperCase() : '');

  const commit = (raw: string) => {
    const v = raw.trim();
    if (!v) {
      onChange(undefined);
      setText(null);
      setInvalid(false);
      return;
    }
    if (parseColor(v)) {
      onChange(toRgb(v));
      setText(null);
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div className="input">
      <div className="color__head">
        <span>{label}</span>
        {set && (
          <button className="color__auto" onClick={() => onChange(undefined)} title="Remove the color and let Wallet decide">
            Auto
          </button>
        )}
      </div>
      <div className={`color-field ${invalid ? 'color-field--invalid' : ''}`}>
        <span className={`color-field__swatch ${set ? '' : 'color-field__swatch--auto'}`} style={set ? { background: colorToHex(value) } : undefined}>
          <input
            type="color"
            aria-label={`${label} color picker`}
            value={set ? colorToHex(value) : '#ffffff'}
            onChange={(e) => {
              onChange(hexToRgb(e.target.value));
              setText(null);
              setInvalid(false);
            }}
          />
        </span>
        <input
          className="color-field__text"
          aria-label={`${label} as hex or rgb()`}
          aria-invalid={invalid}
          title={set ? `Saved in pass.json as ${toRgb(value)}` : 'Type #RRGGBB, #RGB or rgb(r, g, b)'}
          value={shown}
          placeholder="Automatic"
          spellCheck={false}
          onFocus={() => setText(set ? colorToHex(value).toUpperCase() : '')}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
            if (parseColor(e.target.value.trim())) onChange(toRgb(e.target.value.trim()));
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      {invalid && <span className="color__error">Use #RRGGBB, #RGB or rgb(r, g, b)</span>}
    </div>
  );
}

/** Normalises any accepted color to Apple's rgb(r, g, b) form. */
function toRgb(v: unknown): string {
  return hexToRgb(colorToHex(v));
}

const DATE_STYLES: DateStyle[] = ['PKDateStyleNone', 'PKDateStyleShort', 'PKDateStyleMedium', 'PKDateStyleLong', 'PKDateStyleFull'];
type ValueFormat = 'text' | 'date' | 'number' | 'currency';
const NUMBER_STYLES: NumberStyle[] = ['PKNumberStyleDecimal', 'PKNumberStylePercent', 'PKNumberStyleScientific', 'PKNumberStyleSpellOut'];
const DETECTOR_LABELS: Record<DataDetectorType, string> = {
  PKDataDetectorTypePhoneNumber: 'Phone numbers',
  PKDataDetectorTypeLink: 'Links',
  PKDataDetectorTypeAddress: 'Addresses',
  PKDataDetectorTypeCalendarEvent: 'Calendar events',
};

/**
 * Every option here is a real PassFieldContent key; each is shown only where Apple allows it.
 * Value formatting (date/time/number/currency) is how Wallet itself formats values, so it stays.
 */
function FieldEditor({
  field,
  group,
  overLimit,
  onChange,
  onRemove,
  onUp,
  onDown,
}: {
  field: PassField;
  group: FieldGroup;
  overLimit: boolean;
  onChange: (f: PassField) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isBack = group === 'backFields';
  const isDate = !!(field.dateStyle || field.timeStyle);
  const isNumber = !!(field.currencyCode || field.numberStyle);

  const set = (patch: Partial<PassField>) => {
    const next: PassField = { ...field, ...patch };
    for (const k of Object.keys(patch) as (keyof PassField)[]) {
      if (next[k] === '' || next[k] === undefined || next[k] === false) delete next[k];
    }
    if (next.value === undefined) next.value = '';
    // numberStyle and currencyCode only apply when the value is a JSON number.
    const numeric = !!(next.currencyCode || next.numberStyle);
    if (numeric && typeof next.value === 'string' && next.value.trim() !== '' && !isNaN(Number(next.value))) {
      next.value = Number(next.value);
    } else if (!numeric && typeof next.value === 'number') {
      next.value = String(next.value);
    }
    if (!next.dateStyle && !next.timeStyle) {
      delete next.ignoresTimeZone;
      delete next.isRelative;
    }
    onChange(next);
  };

  const detectors = field.dataDetectorTypes ?? DATA_DETECTORS;

  // One choice decides how Wallet formats the value; only that format's keys are kept.
  const format: ValueFormat = isDate ? 'date' : field.currencyCode ? 'currency' : field.numberStyle ? 'number' : 'text';
  const changeFormat = (next: ValueFormat) => {
    const cleared: Partial<PassField> = { dateStyle: undefined, timeStyle: undefined, numberStyle: undefined, currencyCode: undefined };
    if (next === 'date') set({ ...cleared, dateStyle: field.dateStyle ?? 'PKDateStyleMedium', timeStyle: field.timeStyle });
    else if (next === 'number') set({ ...cleared, numberStyle: field.numberStyle ?? 'PKNumberStyleDecimal' });
    else if (next === 'currency') set({ ...cleared, currencyCode: field.currencyCode || 'USD' });
    else set(cleared);
  };

  return (
    <div className={`field-editor ${overLimit ? 'field-editor--hidden' : ''}`}>
      {overLimit && <p className="hint">Wallet won't show this field: the row is already full.</p>}
      <div className="field-editor__main">
        <label className="input input--key">
          <span>Key</span>
          <input value={field.key} onChange={(e) => set({ key: e.target.value })} />
        </label>
        <label className="input">
          <span>Label</span>
          <input value={field.label ?? ''} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className="input input--value">
          <span>Value{isNumber ? ' (number)' : isDate ? ' (ISO 8601 date)' : ''}</span>
          {isBack ? (
            <textarea rows={2} value={String(field.value ?? '')} onChange={(e) => set({ value: e.target.value })} />
          ) : (
            <input className={isDate || isNumber ? 'mono' : undefined} value={String(field.value ?? '')} onChange={(e) => set({ value: e.target.value })} />
          )}
        </label>
        <div className="field-editor__buttons">
          <button className="icon-btn" disabled={!onUp} onClick={onUp} title="Move up" aria-label="Move up">↑</button>
          <button className="icon-btn" disabled={!onDown} onClick={onDown} title="Move down" aria-label="Move down">↓</button>
          <button className={`icon-btn ${open ? 'icon-btn--active' : ''}`} onClick={() => setOpen(!open)} title="More options" aria-label="More options" aria-expanded={open}>⋯</button>
          <button className="icon-btn icon-btn--danger" onClick={onRemove} title="Remove field" aria-label="Remove field">×</button>
        </div>
      </div>
      {open && (
        <div className="field-editor__advanced">
          {allowsAlignment(group) && (
            <label className="input">
              <span>Alignment</span>
              <select value={field.textAlignment ?? ''} onChange={(e) => set({ textAlignment: (e.target.value || undefined) as TextAlignment })}>
                <option value="">Natural</option>
                <option value="PKTextAlignmentLeft">Left</option>
                <option value="PKTextAlignmentCenter">Center</option>
                <option value="PKTextAlignmentRight">Right</option>
              </select>
            </label>
          )}
          <label className={`input ${allowsAlignment(group) ? '' : 'input--first'}`}>
            <span>Format</span>
            <select value={format} onChange={(e) => changeFormat(e.target.value as ValueFormat)}>
              <option value="text">Text</option>
              <option value="date">Date &amp; time</option>
              <option value="number">Number</option>
              <option value="currency">Currency</option>
            </select>
          </label>
          {format === 'date' && (
            <>
              <label className="input">
                <span>Date style</span>
                <select value={field.dateStyle ?? 'PKDateStyleNone'} onChange={(e) => set({ dateStyle: e.target.value as DateStyle })}>
                  {DATE_STYLES.map((s) => (
                    <option key={s} value={s}>{s.replace('PKDateStyle', '')}</option>
                  ))}
                </select>
              </label>
              <label className="input">
                <span>Time style</span>
                <select value={field.timeStyle ?? 'PKDateStyleNone'} onChange={(e) => set({ timeStyle: e.target.value as DateStyle })}>
                  {DATE_STYLES.map((s) => (
                    <option key={s} value={s}>{s.replace('PKDateStyle', '')}</option>
                  ))}
                </select>
              </label>
              <div className="field-editor__checks">
                <label className="check">
                  <input type="checkbox" checked={!!field.ignoresTimeZone} onChange={(e) => set({ ignoresTimeZone: e.target.checked })} />
                  Ignore time zone
                </label>
                <label className="check">
                  <input type="checkbox" checked={!!field.isRelative} onChange={(e) => set({ isRelative: e.target.checked })} />
                  Relative date
                </label>
              </div>
            </>
          )}
          {format === 'number' && (
            <label className="input">
              <span>Number style</span>
              <select value={field.numberStyle ?? 'PKNumberStyleDecimal'} onChange={(e) => set({ numberStyle: e.target.value as NumberStyle })}>
                {NUMBER_STYLES.map((s) => (
                  <option key={s} value={s}>{s.replace('PKNumberStyle', '')}</option>
                ))}
              </select>
            </label>
          )}
          {format === 'currency' && (
            <label className="input">
              <span>Currency code (ISO 4217)</span>
              <input className="mono" value={field.currencyCode ?? ''} placeholder="USD" maxLength={3} onChange={(e) => set({ currencyCode: e.target.value.toUpperCase() || 'USD' })} />
            </label>
          )}
          <label className="input input--wide">
            <span>Change message (update notification, must contain %@)</span>
            <input value={field.changeMessage ?? ''} placeholder="Gate changed to %@" onChange={(e) => set({ changeMessage: e.target.value })} />
          </label>
          <label className="input input--wide">
            <span>Attributed value (overrides value; only &lt;a href&gt; tags)</span>
            <input value={String(field.attributedValue ?? '')} onChange={(e) => set({ attributedValue: e.target.value })} />
          </label>
          {isBack && (
            <div className="detectors">
              <span className="overline">Data detectors (back of pass only)</span>
              {DATA_DETECTORS.map((d) => (
                <label className="check" key={d}>
                  <input
                    type="checkbox"
                    checked={detectors.includes(d)}
                    onChange={(e) => {
                      const nextList = e.target.checked ? [...detectors, d] : detectors.filter((x) => x !== d);
                      // Omitting the key means "all"; an empty array means "none".
                      set({ dataDetectorTypes: nextList.length === DATA_DETECTORS.length ? undefined : (DATA_DETECTORS.filter((x) => nextList.includes(x)) as DataDetectorType[]) });
                    }}
                  />
                  {DETECTOR_LABELS[d]}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
