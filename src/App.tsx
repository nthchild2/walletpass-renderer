import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { Guide } from './components/Guide';
import { JsonEditor } from './components/JsonEditor';
import { PassView } from './components/PassView';
import { DEVICES, getDeviceId, passWidth, saveDeviceId } from './pass/devices';
import { exportPassImage, passFileName, type ImageFormat } from './pass/exportImage';
import { validate } from './pass/format';
import { loadPassFile } from './pass/parse';
import { sampleFor } from './pass/samples';
import { decodeShare, readShareHash, shareUrl } from './pass/share';
import { loadBundle, saveBundle } from './pass/storage';
import { getStyle, STYLE_LABELS, type PassBundle, type PassStyle } from './pass/types';
import { isPlainClick, parseRoute, routePath, type Route, type Tab } from './route';
import { getThemePref, setThemePref, type ThemePref } from './theme';

// Read once at startup: React's dev double-mount must not see the hash after it's been cleared.
const initialShare = readShareHash();

export default function App() {
  // Each tab (and Guide layout) has its own URL; see route.ts.
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const tab = route.tab;
  const navigate = (next: Route, opts: { replace?: boolean; hash?: string } = {}) => {
    const url = routePath(next) + (opts.hash ?? '');
    if (url !== window.location.pathname + window.location.hash) {
      if (opts.replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    }
    setRoute(next);
  };
  const setTab = (t: Tab) => navigate({ tab: t });
  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const chooseTheme = (t: ThemePref) => {
    setTheme(t);
    setThemePref(t);
  };
  const [bundle, setBundle] = useState<PassBundle>(() => sampleFor('eventTicket'));
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Which iPhone to preview on: the card is the screen width minus 32 pt.
  const [deviceId, setDeviceId] = useState(getDeviceId);
  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0];
  const width = passWidth(device);

  // Which iOS to preview: only changes which barcode is shown (iOS 27 added four formats).
  const [ios27, setIos27] = useState(true);
  const issues = useMemo(() => validate(bundle, ios27), [bundle, ios27]);

  // A shared link (/#pass=…) opens that pass; otherwise restore the last pass from the browser.
  // Either way, changes are then saved (debounced).
  const [restored, setRestored] = useState(false);
  const openShared = async (data: string) => {
    try {
      const shared = await decodeShare(data);
      setBundle(shared);
      setFlipped(false);
      setError(null);
      setOpenedFile(null);
      setNotice("This pass was opened from a shared link. Images aren't included in shared links, so it's shown without them.");
    } catch {
      setError("This share link is damaged or incomplete, so its pass couldn't be opened.");
    }
    navigate({ tab: 'configure' }, { replace: true });
  };
  const openSharedRef = useRef(openShared);
  openSharedRef.current = openShared;
  useEffect(() => {
    const load = initialShare ? openSharedRef.current(initialShare) : loadBundle().then((saved) => saved && setBundle(saved));
    load.catch(() => {}).finally(() => setRestored(true));
    // A share link pasted into the address bar while the app is open.
    const onHash = () => {
      const data = readShareHash();
      if (data) openSharedRef.current(data);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => saveBundle(bundle).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [bundle, restored]);

  // The pass is drawn at Wallet's real size (width × 503 pt); shrink it to fit narrow screens.
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setScale(Math.min(1, inner / width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, tab]);
  const style = getStyle(bundle.json);

  // Opening a pass: the "Open .pkpass" button, or dropping a file anywhere on the page.
  const fileInput = useRef<HTMLInputElement>(null);
  const [openedFile, setOpenedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const onFile = async (file: File, language?: string) => {
    try {
      const next = await loadPassFile(file, language);
      setBundle(next);
      setOpenedFile(file);
      setError(null);
      setNotice(null);
      if (!language) setFlipped(false);
      if (tab === 'guide') setTab('configure');
    } catch (e) {
      setError(`Couldn't read ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const f = e.dataTransfer?.files[0];
      if (f) onFileRef.current(f);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  const languages = bundle.source?.languages ?? [];

  // From the guide: open that style's example in the configurator (it replaces the current pass).
  const tryExample = (next: PassStyle) => {
    if (!window.confirm(`Replace the pass you're working on with the ${STYLE_LABELS[next].toLowerCase()} example?`)) return;
    setBundle(sampleFor(next));
    setFlipped(false);
    setNotice(null);
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

  // Copies a link with the pass in it (no images; see pass/share.ts).
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const hasImages = Object.keys(bundle.images).length > 0;
  const share = async () => {
    try {
      const url = await shareUrl(bundle);
      try {
        await navigator.clipboard.writeText(url);
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2500);
      } catch {
        window.prompt('Copy this link to share the pass:', url);
      }
    } catch (e) {
      setError(`Couldn't create a share link: ${e instanceof Error ? e.message : String(e)}`);
    }
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
        <button className="btn btn--small topbar__open" onClick={() => fileInput.current?.click()} title="Open a .pkpass, .zip or pass.json (or drop it anywhere)" aria-label="Open .pkpass">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 15V3 M7 8l5-5 5 5 M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
          </svg>
          <span className="topbar__open-label">Open .pkpass</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".pkpass,.zip,.json,application/vnd.apple.pkpass"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        <nav className="tabs" role="tablist">
          {(
            [
              ['configure', 'Configure'],
              ['json', 'JSON'],
              ['guide', 'Guide'],
            ] as const
          ).map(([id, label]) => (
            <a
              key={id}
              href={routePath({ tab: id })}
              role="tab"
              aria-selected={tab === id}
              className={`tab ${tab === id ? 'tab--active' : ''}`}
              onClick={(e) => {
                if (!isPlainClick(e)) return;
                e.preventDefault();
                setTab(id);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <ThemeButton theme={theme} onChange={chooseTheme} />
      </header>

      {error && (
        <div className="alert app__error" role="alert">
          {error}
          <button className="app__error-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      {notice && (
        <div className="alert alert--info app__error" role="status">
          {notice}
          <button className="app__error-close" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-overlay__box">Drop to open the pass</div>
        </div>
      )}

      {tab === 'guide' ? (
        <main className="layout layout--guide">
          <Guide
            onTry={tryExample}
            variant={route.variant}
            onVariant={(slug) => navigate({ tab: 'guide', variant: slug }, { replace: true })}
          />
        </main>
      ) : (
      <main className="layout">
        <div className="layout__left">
          {tab === 'configure' && <Editor bundle={bundle} onChange={setBundle} />}
          {tab === 'json' && <JsonEditor bundle={bundle} onChange={setBundle} />}
        </div>

        <aside className="layout__right">
          <div className="preview">
            <div className="preview__bar">
              <span className="preview__style">{style ? STYLE_LABELS[style] : 'Unknown style'}</span>
              <button
                className="btn btn--small preview__share"
                onClick={share}
                title={hasImages ? "Copy a link to this pass. Images aren't included in the link." : 'Copy a link to this pass'}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                </svg>
                <span aria-live="polite">{shareState === 'copied' ? 'Link copied' : 'Share'}</span>
              </button>
              <div className="seg">
                <button className={!flipped ? 'seg--active' : ''} onClick={() => setFlipped(false)}>
                  Front
                </button>
                <button className={flipped ? 'seg--active' : ''} onClick={() => setFlipped(true)}>
                  Back
                </button>
              </div>
            </div>
            <div className="preview__options">
              <label className="preview__select" title="The card is the screen width minus 32 pt; its height and everything inside stay the same">
                <span>Device</span>
                <select
                  value={device.id}
                  onChange={(e) => {
                    setDeviceId(e.target.value);
                    saveDeviceId(e.target.value);
                  }}
                >
                  {DEVICES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} · {passWidth(d)} pt
                    </option>
                  ))}
                </select>
              </label>
              <label className="preview__select" title="Which barcode Wallet shows depends on the iOS version">
                <span>iOS</span>
                <select value={ios27 ? '27' : '26'} onChange={(e) => setIos27(e.target.value === '27')}>
                  <option value="27">27+</option>
                  <option value="26">26 or earlier</option>
                </select>
              </label>
              {languages.length > 1 && openedFile && (
                <label className="preview__select" title="The pass's translations (.lproj folders)">
                  <span>Language</span>
                  <select value={bundle.source?.language} onChange={(e) => onFile(openedFile, e.target.value)}>
                    {languages.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="preview__stage" ref={stageRef}>
              <div style={scale < 1 ? { zoom: scale } : undefined}>
                <PassView bundle={bundle} ios27={ios27} width={width} pixelRatio={device.scale} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
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

const THEME_ICONS: Record<ThemePref, ReactNode> = {
  // Half-filled circle: the usual "follows the system" symbol.
  system: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
};

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/** One control that cycles System → Light → Dark, labelled with the current theme. */
function ThemeButton({ theme, onChange }: { theme: ThemePref; onChange: (t: ThemePref) => void }) {
  const i = Math.max(0, THEMES.findIndex((t) => t.id === theme));
  const current = THEMES[i];
  const next = THEMES[(i + 1) % THEMES.length];
  return (
    <button
      className="theme-button"
      onClick={() => onChange(next.id)}
      title={`Theme: ${current.label}. Click for ${next.label}.`}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {THEME_ICONS[current.id]}
      </svg>
      <span className="theme-button__label">{current.label}</span>
    </button>
  );
}
