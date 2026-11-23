// Measure PassKit's barcode boxes and images, to (re)generate tests/layout/passkit-barcodes.json.
//
//   node tools/passkit-probe/barcodes.mjs [barcodes.json]
//
// Takes the "cases" (name, barcode) of barcodes.json (default: tests/layout/passkit-barcodes.json),
// draws each on a minimal event ticket with run.mjs, and writes back the frame of the sticker
// (PKBarcodeStickerView) as "box" and of the code image inside it as "image". Keeps "known".
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(process.argv[2] ?? join(here, '../../tests/layout/passkit-barcodes.json'));
const fixture = JSON.parse(readFileSync(path, 'utf8'));
const cases = fixture.cases.map((c) => ({
  name: c.name,
  images: [],
  pass: {
    formatVersion: 1,
    passTypeIdentifier: 'pass.test',
    serialNumber: c.name,
    teamIdentifier: 'T',
    organizationName: 'Test',
    description: 'Test',
    eventTicket: { primaryFields: [{ key: 'e', label: 'E', value: 'x' }] },
    barcodes: [c.barcode],
  },
}));
const input = join(tmpdir(), 'passkit-barcodes-in.json');
const output = join(tmpdir(), 'passkit-barcodes-out.json');
writeFileSync(input, JSON.stringify({ cases }));
execFileSync('node', [join(here, 'run.mjs'), input, output], { stdio: 'inherit' });
const measured = new Map(JSON.parse(readFileSync(output, 'utf8')).cases.map((c) => [c.name, c.views ?? []]));
for (const c of fixture.cases) {
  const views = measured.get(c.name);
  const box = views.find((v) => v.class === 'PKBarcodeStickerView');
  const image = views.find((v) => v.class === 'UIImageView');
  if (!box || !image) throw new Error(`${c.name}: no barcode drawn`);
  c.box = box.frame;
  c.image = image.frame;
}
writeFileSync(path, JSON.stringify(fixture, null, 1) + '\n');
console.log(`Wrote ${fixture.cases.length} barcode cases to ${path}.`);
