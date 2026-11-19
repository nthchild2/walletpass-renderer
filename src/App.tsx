import { useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { JsonEditor } from './components/JsonEditor';
import { PassView } from './components/PassView';
import { Upload } from './components/Upload';
import { exportPassImage, passFileName, type ImageFormat } from './pass/exportImage';
import { validate } from './pass/format';
import { loadPassFile } from './pass/parse';
import { sampleFor } from './pass/samples';
import { loadBundle, saveBundle } from './pass/storage';
import { getStyle, STYLE_LABELS, type PassBundle } from './pass/types';

type Tab = 'upload' | 'configure' | 'json';

export default function App() {
  const [tab, setTab] = useState<Tab>('upload');
  const [bundle, setBundle] = useState<PassBundle>(() => sampleFor('eventTicket'));
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which iOS to preview: only changes which barcode is shown (iOS 27 added four formats).
  const [ios27, setIos27] = useState(true);
  const issues = useMemo(() => validate(bundle, ios27), [bundle, ios27]);

  // Restore the last pass from the browser, then keep saving changes (debounced).
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    loadBundle()
      .then((saved) => saved && setBundle(saved))
      .catch(() => {})
      .finally(() => setRestored(true));
  }, []);
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => saveBundle(bundle).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [bundle, restored]);

  // The pass is drawn at Wallet's real size (343×503 pt); shrink it to fit narrow screens.
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setScale(Math.min(1, inner / 343));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const style = getStyle(bundle.json);

  const onFile = async (file: File, language?: string) => {
    try {
      const next = await loadPassFile(file, language);
      setBundle(next);
      setError(null);
      setFlipped(false);
    } catch (e) {
      setError(`Couldn't read ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(bundle.json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pass.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const [exporting, setExporting] = useState<ImageFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportImage = async (format: ImageFormat) => {
    const side = flipped ? 'back' : 'front';
    const el = stageRef.current?.querySelector<HTMLElement>(`.pass-flip__face--${side} .pass`);
    if (!el) return;
    setExporting(format);
    setExportError(null);
    try {
      await exportPassImage(el, format, passFileName(bundle.json.serialNumber ?? bundle.json.description, side));
    } catch (e) {
      setExportError(`Couldn't export the ${format.toUpperCase()}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__name">Pass Renderer</span>
          <span className="brand__product">Apple Wallet · classic passes</span>
        </div>
        <nav className="tabs" role="tablist">
          {(
            [
              ['upload', 'Upload'],
              ['configure', 'Configure'],
              ['json', 'JSON'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'tab--active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="layout">
        <div className="layout__left">
          {tab === 'upload' && <Upload bundle={bundle} onFile={onFile} error={error} onEdit={() => setTab('configure')} />}
          {tab === 'configure' && <Editor bundle={bundle} onChange={setBundle} />}
          {tab === 'json' && <JsonEditor bundle={bundle} onChange={setBundle} />}
        </div>

        <aside className="layout__right">
          <div className="preview">
            <div className="preview__bar">
              <span className="preview__style">{style ? STYLE_LABELS[style] : 'Unknown style'}</span>
              <label className="preview__ios" title="Which barcode Wallet shows depends on the iOS version">
                <span className="visually-hidden">Preview as</span>
                <select value={ios27 ? '27' : '26'} onChange={(e) => setIos27(e.target.value === '27')}>
                  <option value="27">iOS 27+</option>
                  <option value="26">iOS 26 or earlier</option>
                </select>
              </label>
              <div className="seg">
                <button className={!flipped ? 'seg--active' : ''} onClick={() => setFlipped(false)}>
                  Front
                </button>
                <button className={flipped ? 'seg--active' : ''} onClick={() => setFlipped(true)}>
                  Back
                </button>
              </div>
            </div>
            <div className="preview__stage" ref={stageRef}>
              <div style={scale < 1 ? { zoom: scale } : undefined}>
                <PassView bundle={bundle} ios27={ios27} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
              </div>
            </div>
            <div className="preview__actions">
              <span className="preview__actions-label">Export {flipped ? 'back' : 'front'}</span>
              <button className="btn btn--small" disabled={!!exporting || !style} onClick={() => exportImage('png')}>
                {exporting === 'png' ? 'Exporting…' : 'PNG'}
              </button>
              <button className="btn btn--small" disabled={!!exporting || !style} onClick={() => exportImage('svg')}>
                {exporting === 'svg' ? 'Exporting…' : 'SVG'}
              </button>
              <button className="btn btn--small" onClick={downloadJson}>
                pass.json
              </button>
            </div>
            {exportError && <div className="alert preview__error">{exportError}</div>}
            {issues.length > 0 && (
              <ul className="issues">
                {issues.map((i, n) => (
                  <li key={n} className={`issue issue--${i.level}`}>
                    <span className="issue__tag">{i.level}</span>
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
