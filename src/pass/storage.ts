import { IMAGE_NAMES, type ImageName, type PassBundle } from './types';

/**
 * Keeps the pass being edited in IndexedDB, so it survives reloads. IndexedDB (not localStorage)
 * because images are stored as Blobs, which can be several MB. Everything is best-effort: if storage
 * is blocked (private windows, cleared site data), the app just starts from the sample.
 */

const DB_NAME = 'pass-renderer';
const STORE = 'state';
const KEY = 'current';

interface Stored {
  json: PassBundle['json'];
  strings: PassBundle['strings'];
  source?: PassBundle['source'];
  images: Partial<Record<ImageName, Blob>>;
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function saveBundle(bundle: PassBundle): Promise<void> {
  const images: Stored['images'] = {};
  for (const name of IMAGE_NAMES) {
    const url = bundle.images[name];
    if (!url) continue;
    try {
      images[name] = await (await fetch(url)).blob();
    } catch {
      /* an image URL that no longer resolves is simply not saved */
    }
  }
  const record: Stored = { json: bundle.json, strings: bundle.strings, source: bundle.source, images, savedAt: Date.now() };
  await run('readwrite', (s) => s.put(record, KEY));
}

export async function loadBundle(): Promise<PassBundle | null> {
  const record = await run<Stored | undefined>('readonly', (s) => s.get(KEY) as IDBRequest<Stored | undefined>);
  if (!record || typeof record.json !== 'object') return null;
  const images: PassBundle['images'] = {};
  for (const name of IMAGE_NAMES) {
    const blob = record.images?.[name];
    if (blob) images[name] = URL.createObjectURL(blob);
  }
  return { json: record.json, strings: record.strings ?? {}, source: record.source, images };
}
