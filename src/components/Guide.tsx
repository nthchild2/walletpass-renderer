import { useState } from 'react';
import { FIELD_KEYS, LINKS, OTHER_KEYS, SOURCES, VARIANTS, type SlotInfo, type Variant } from '../pass/guide';
import type { PassStyle } from '../pass/types';
import { PassView } from './PassView';

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="link" href={href} target="_blank" rel="noreferrer">
    {children}
    <span aria-hidden> ↗</span>
  </a>
);

export function Guide({ onTry }: { onTry: (style: PassStyle) => void }) {
  const [id, setId] = useState(VARIANTS[0].id);
  const variant = VARIANTS.find((v) => v.id === id)!;

  return (
    <div className="guide">
      <section className="panel">
        <h2>Layouts</h2>
        <p className="guide__lead">
          A classic pass has five styles. Each one places the same field groups (<code>headerFields</code>,{' '}
          <code>primaryFields</code>, <code>secondaryFields</code>, <code>auxiliaryFields</code>,{' '}
          <code>backFields</code>) in fixed slots on a 343×503 pt card. You choose which fields go in each group and how
          they're formatted; Wallet decides where and how big they are.
        </p>
        <div className="style-picker">
          {VARIANTS.map((v) => (
            <button key={v.id} className={`chip ${v.id === id ? 'chip--active' : ''}`} onClick={() => setId(v.id)}>
              {v.title}
            </button>
          ))}
        </div>
      </section>

      <VariantSection variant={variant} onTry={onTry} />

      <section className="panel">
        <h2>Field dictionary</h2>
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

      <section className="panel">
        <h2>Keys that don't change the look</h2>
        <p className="hint">
          Other top-level keys in <code>pass.json</code> control when the pass appears, how it updates and what it connects to.
          The preview doesn't draw them, but the issues list checks them. Full reference: <Ext href={LINKS.pass}>Pass</Ext>.
        </p>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {OTHER_KEYS.map((k) => (
                <tr key={k.keys}>
                  <td>
                    <code>{k.keys}</code>
                  </td>
                  <td>{k.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>What's in a .pkpass file</h2>
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

      <section className="panel">
        <h2>Apple documentation</h2>
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
        <h2>{variant.title}</h2>
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
            Drawn by this app's renderer, every slot filled to its limit. {variant.accuracy} Apple's own (schematic)
            diagram: <Ext href={LINKS.archivedGuide}>Wallet Developer Guide</Ext>.
          </figcaption>
        </figure>

        <div className="guide__info">
          <h3>Field groups</h3>
          <dl className="source-legend">
            {SOURCES.map((src) => (
              <div key={src.tag}>
                <dt>
                  <SourceTag source={src.tag} />
                </dt>
                <dd>{src.meaning}</dd>
              </div>
            ))}
          </dl>
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
                    <td className="nowrap">
                      {s.max}
                      <SourceTag source={s.source} />
                    </td>
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

function SourceTag({ source }: { source: SlotInfo['source'] }) {
  const meaning = SOURCES.find((x) => x.tag === source)?.meaning;
  return (
    <span className={`source source--${source.split(' ')[0].toLowerCase()}`} title={meaning}>
      {source}
    </span>
  );
}
