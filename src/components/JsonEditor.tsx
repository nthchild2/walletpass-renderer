import { useEffect, useState } from 'react';
import { parsePassJson } from '../pass/parse';
import type { PassBundle } from '../pass/types';

export function JsonEditor({ bundle, onChange }: { bundle: PassBundle; onChange: (b: PassBundle) => void }) {
  const pretty = JSON.stringify(bundle.json, null, 2);
  const [text, setText] = useState(pretty);
  const [error, setError] = useState<string | null>(null);

  // Keep in sync when the pass changes elsewhere, unless the user has unparseable edits.
  useEffect(() => {
    setText((current) => {
      try {
        if (JSON.stringify(parsePassJson(current)) === JSON.stringify(bundle.json)) return current;
      } catch {
        return current;
      }
      return pretty;
    });
  }, [pretty, bundle.json]);

  const update = (value: string) => {
    setText(value);
    try {
      const json = parsePassJson(value);
      if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new Error('pass.json must be an object');
      setError(null);
      onChange({ ...bundle, json });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="panel json-editor">
      <h2>pass.json</h2>
      <p className="hint">Edits apply live as soon as the JSON is valid. Images are kept from the current pass.</p>
      <textarea spellCheck={false} wrap="off" value={text} onChange={(e) => update(e.target.value)} />
      {error && <div className="alert alert--error">{error}</div>}
    </section>
  );
}
