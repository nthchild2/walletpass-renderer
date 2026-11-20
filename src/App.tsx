import { useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { Guide } from './components/Guide';
import { JsonEditor } from './components/JsonEditor';
import { PassView } from './components/PassView';
import { Upload } from './components/Upload';
import { exportPassImage, passFileName, type ImageFormat } from './pass/exportImage';
import { validate } from './pass/format';
import { loadPassFile } from './pass/parse';
import { sampleFor } from './pass/samples';
import { loadBundle, saveBundle } from './pass/storage';
import { getStyle, STYLE_LABELS, type PassBundle, type PassStyle } from './pass/types';
import { getThemePref, setThemePref, type ThemePref } from './theme';

type Tab = 'upload' | 'configure' | 'json' | 'guide';

export default function App() {
  const [tab, setTab] = useState<Tab>('upload');
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const chooseTheme = (t: ThemePref) => {
    setTheme(t);
    setThemePref(t);
  };
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

  // From the guide: open that style's example in the configurator (it replaces the current pass).
  const tryExample = (next: PassStyle) => {
    if (!window.confirm(`Replace the pass you're working on with the ${STYLE_LABELS[next].toLowerCase()} example?`)) return;
    setBundle(sampleFor(next));
    setFlipped(false);
    setTab('configure');
    window.scrollTo(0, 0);
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
              ['guide', 'Guide'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'tab--active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="theme-switch" role="radiogroup" aria-label="Theme">
          {(
            [
              ['system', 'System', 'M4 5h16v10H4z M8 19h8 M12 15v4'],
              ['light', 'Light', 'M12 3v2 M12 19v2 M5 5l1.5 1.5 M17.5 17.5 19 19 M3 12h2 M19 12h2 M5 19l1.5-1.5 M17.5 6.5 19 5 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
              ['dark', 'Dark', 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'],
            ] as const
          ).map(([id, label, d]) => (
            <button
              key={id}
              role="radio"
              aria-checked={theme === id}
              aria-label={`${label} theme`}
              title={`${label} theme`}
              className={`theme-switch__btn ${theme === id ? 'theme-switch__btn--active' : ''}`}
              onClick={() => chooseTheme(id)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={d} />
              </svg>
            </button>
          ))}
        </div>
      </header>

      {tab === 'guide' ? (
        <main className="layout layout--guide">
          <Guide onTry={tryExample} />
        </main>
      ) : (
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
      )}
    </div>
  );
}
