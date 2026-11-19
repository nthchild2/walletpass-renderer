import { useState } from 'react';
import type { PassBundle } from '../pass/types';

const SAMPLE_FILES = [
  { file: 'boarding-pass.pkpass', label: 'Boarding pass' },
  { file: 'event-ticket.pkpass', label: 'Event ticket (strip)' },
  { file: 'coupon.pkpass', label: 'Coupon' },
  { file: 'store-card.pkpass', label: 'Store card' },
  { file: 'generic-localized.pkpass', label: 'Generic (en + es)' },
];

interface Props {
  bundle: PassBundle;
  onFile: (file: File, language?: string) => Promise<void>;
  error: string | null;
  onEdit: () => void;
}

export function Upload({ bundle, onFile, error, onEdit }: Props) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const source = bundle.source;

  const handle = async (file: File, language?: string) => {
    setBusy(true);
    setLastFile(file);
    try {
      await onFile(file, language);
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async (name: string) => {
    const res = await fetch(`${import.meta.env.BASE_URL}samples/${name}`);
    const blob = await res.blob();
    await handle(new File([blob], name, { type: 'application/vnd.apple.pkpass' }));
  };

  return (
    <div className="upload">
      <section className="panel">
        <h2>Open a pass</h2>
        <label
          className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handle(f);
          }}
        >
          <input
            type="file"
            accept=".pkpass,.zip,.json,application/vnd.apple.pkpass"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handle(f);
              e.target.value = '';
            }}
          />
          <svg className="dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 15V3" />
            <path d="m7 8 5-5 5 5" />
            <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
          </svg>
          <div className="dropzone__title">{busy ? 'Reading…' : 'Drop a .pkpass file here'}</div>
          <div className="hint">or click to choose a .pkpass, .zip or pass.json</div>
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <div className="samples">
          <span className="hint">Or try a sample file:</span>
          {SAMPLE_FILES.map((s) => (
            <button key={s.file} className="chip" onClick={() => loadSample(s.file)}>
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {source && (
        <section className="panel">
          <div className="panel__title">
            <h2>{source.fileName}</h2>
            <button className="btn btn--primary btn--small" onClick={onEdit}>
              Edit in configurator
            </button>
          </div>
          <dl className="facts">
            <dt>Signed</dt>
            <dd>{source.signed ? 'Yes (manifest.json + signature present)' : 'No'}</dd>
            <dt>Pass type ID</dt>
            <dd className="mono">{String(bundle.json.passTypeIdentifier ?? '—')}</dd>
            <dt>Serial</dt>
            <dd className="mono">{String(bundle.json.serialNumber ?? '—')}</dd>
            {source.languages.length > 0 && (
              <>
                <dt>Language</dt>
                <dd>
                  <select
                    value={source.language}
                    onChange={(e) => lastFile && handle(lastFile, e.target.value)}
                    disabled={!lastFile}
                  >
                    {source.languages.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </dd>
              </>
            )}
          </dl>
          <details>
            <summary>{source.files.length} files in bundle</summary>
            <ul className="file-list">
              {source.files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}
