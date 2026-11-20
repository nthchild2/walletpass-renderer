import { useEffect, useRef, type ReactNode } from 'react';
import { FIELD_KEYS, LINKS, VARIANTS, type Variant } from '../pass/guide';
import type { PassStyle } from '../pass/types';
import { isPlainClick, variantSlug } from '../route';
import { PassView } from './PassView';

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="link" href={href} target="_blank" rel="noreferrer">
    {children}
    <span aria-hidden> ↗</span>
  </a>
);

/** A section heading that links to itself, so any section's URL can be copied. */
function Heading({ id, href, children }: { id?: string; href: string; children: ReactNode }) {
  return (
    <h2 id={id} className="anchor-heading">
      <a
        href={href}
        className="anchor-heading__link"
        onClick={(e) => {
          if (!isPlainClick(e)) return;
          // Stay on the current layout's URL; just add the section and scroll to it.
          e.preventDefault();
          const hash = new URL(href, window.location.href).hash;
          window.history.replaceState(null, '', window.location.pathname + hash);
          e.currentTarget.closest('section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        {children}
        <span className="anchor-heading__mark" aria-hidden>
          #
        </span>
      </a>
    </h2>
  );
}

export function Guide({
  onTry,
  variant: slug,
  onVariant,
}: {
  onTry: (style: PassStyle) => void;
  /** Selected layout, from the URL (/guide/<slug>). */
  variant?: string;
  onVariant: (slug: string) => void;
}) {
  const variant = VARIANTS.find((v) => variantSlug(v.id) === slug) ?? VARIANTS[0];

  // Opening a link to a section (/guide#field-dictionary) or a layout (/guide/coupon) scrolls to it.
  const variantRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const target = hash ? document.getElementById(hash) : slug ? variantRef.current : null;
    target?.scrollIntoView();
    // Only on first render: picking a layout afterwards shouldn't jump the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="guide">
      <section className="panel" id="layouts">
        <Heading href="/guide#layouts">Layouts</Heading>
        <p className="guide__lead">
          A classic pass has five styles. Each one places the same field groups (<code>headerFields</code>,{' '}
          <code>primaryFields</code>, <code>secondaryFields</code>, <code>auxiliaryFields</code>,{' '}
          <code>backFields</code>) in fixed slots on a 343×503 pt card. You choose which fields go in each group and how
          they're formatted; Wallet decides where and how big they are.
        </p>
        <div className="style-picker">
          {VARIANTS.map((v) => (
            <a
              key={v.id}
              href={`/guide/${variantSlug(v.id)}`}
              className={`chip ${v.id === variant.id ? 'chip--active' : ''}`}
              onClick={(e) => {
                if (!isPlainClick(e)) return;
                e.preventDefault();
                onVariant(variantSlug(v.id));
              }}
            >
              {v.title}
            </a>
          ))}
        </div>
      </section>

      <div ref={variantRef}>
        <VariantSection variant={variant} onTry={onTry} />
      </div>

      <section className="panel" id="field-dictionary">
        <Heading href="/guide#field-dictionary">Field dictionary</Heading>
        <p className="hint">
          Every entry in a field group is an object with these keys (Apple's <Ext href={LINKS.passFieldContent}>PassFieldContent</Ext>).
          Only some change what you see.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Type</th>
                <th>Effect</th>
                <th>Allowed in</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_KEYS.map((k) => (
                <tr key={k.key}>
                  <td><code>{k.key}</code></td>
                  <td className="muted">{k.type}</td>
                  <td>{k.effect}</td>
                  <td className="muted">{k.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" id="pkpass-file">
        <Heading href="/guide#pkpass-file">What's in a .pkpass file</Heading>
        <p className="hint">
          A <code>.pkpass</code> is a zip. Wallet reads images by file name; <code>pass.json</code> never refers to them.
          See Apple's <Ext href={LINKS.source}>Creating the source for a pass</Ext>.
        </p>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr><td><code>pass.json</code></td><td>Required. Every key: <Ext href={LINKS.pass}>Pass</Ext>.</td></tr>
              <tr><td><code>icon.png</code> (+ <code>@2x</code>, <code>@3x</code>)</td><td>Required. Notifications and the lock screen.</td></tr>
              <tr><td><code>logo</code>, <code>strip</code>, <code>background</code>, <code>thumbnail</code>, <code>footer</code></td><td>Optional PNGs; which ones show depends on the style (see each layout above).</td></tr>
              <tr><td><code>xx.lproj/pass.strings</code></td><td>Optional translations, plus localized images. Top-level images override localized ones.</td></tr>
              <tr><td><code>manifest.json</code></td><td>Required. SHA-1 of every other file.</td></tr>
              <tr><td><code>signature</code></td><td>Required. Signs the manifest with your Pass Type ID certificate.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" id="apple-documentation">
        <Heading href="/guide#apple-documentation">Apple documentation</Heading>
        <ul className="guide__links">
          <li><Ext href={LINKS.pass}>Pass</Ext>: every top-level key of pass.json.</li>
          <li><Ext href={LINKS.passFields}>PassFields</Ext>: the field groups (<Ext href={LINKS.headerFields}>header</Ext>, <Ext href={LINKS.primaryFields}>primary</Ext>, <Ext href={LINKS.secondaryFields}>secondary</Ext>, <Ext href={LINKS.auxiliaryFields}>auxiliary</Ext>, <Ext href={LINKS.backFields}>back</Ext>).</li>
          <li><Ext href={LINKS.passFieldContent}>PassFieldContent</Ext>: the keys of each field.</li>
          <li><Ext href={LINKS.barcodes}>Pass.Barcodes</Ext>: barcode formats and fallback.</li>
          <li><Ext href={LINKS.archivedGuide}>Wallet Developer Guide: Pass Design and Creation</Ext> (archived): Apple's original layout diagrams for each style.</li>
          <li><Ext href={LINKS.hig}>Human Interface Guidelines: Wallet</Ext>: design guidance.</li>
        </ul>
      </section>
    </div>
  );
}

function VariantSection({ variant, onTry }: { variant: Variant; onTry: (style: PassStyle) => void }) {
  return (
    <section className="panel guide__variant">
      <div className="panel__title">
        <Heading href={`/guide/${variantSlug(variant.id)}`}>{variant.title}</Heading>
        <div className="row-actions">
          <Ext href={LINKS.style(variant.style)}>Apple: {variant.style}</Ext>
          <button className="btn btn--small" onClick={() => onTry(variant.style)}>
            Try in configurator
          </button>
        </div>
      </div>
      <p className="guide__lead">{variant.summary}</p>

      <div className="guide__layout">
        <figure className="guide__figure">
          <div className="guide__stage">
            <PassView bundle={variant.bundle} wireframe flipped={false} onFlip={() => {}} />
          </div>
          <figcaption className="hint">
            Drawn by this app's renderer, every slot filled to its limit. Apple's own (schematic)
            diagram: <Ext href={LINKS.archivedGuide}>Wallet Developer Guide</Ext>.
          </figcaption>
        </figure>

        <div className="guide__info">
          <h3>Field groups</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Where it shows</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {variant.slots.map((s) => (
                  <tr key={s.key}>
                    <td><code>{s.key}</code></td>
                    <td>{s.shows}</td>
                    <td>{s.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Images</h3>
          <ul className="guide__list">
            {variant.images.map((i) => (
              <li key={i.name}>
                <code>{i.name}</code> <span className="muted">{i.size}</span>: {i.note}
              </li>
            ))}
          </ul>

          {variant.notes.length > 0 && (
            <>
              <h3>Notes</h3>
              <ul className="guide__list">
                {variant.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <h3>pass.json shape</h3>
      <p className="hint">The keys that change how this pass looks. Comments are explanations only; a real pass.json can't contain them.</p>
      <pre className="code">{variant.json}</pre>
    </section>
  );
}
