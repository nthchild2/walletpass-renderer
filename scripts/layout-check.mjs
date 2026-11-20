// npm run test:layout — compare the renderer's text layout with PassKit's own (tests/layout/apple-frames.json).
//
// Starts the Vite dev server, opens it in the installed Google Chrome (headless, via playwright-core)
// and runs window.__layoutCheck() (src/dev/layoutCheck.tsx). macOS only: the comparison needs the
// system's SF Pro and SF Mono, which the preview uses. Exits 1 if any case differs.
//
//   npm run test:layout            every case
//   npm run test:layout -- wynn    cases whose name contains "wynn"
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const only = process.argv[2];
if (process.platform !== 'darwin') {
  console.error('test:layout needs macOS: it compares against Apple fonts (SF Pro, SF Mono).');
  process.exit(1);
}

const server = await createServer({ logLevel: 'error', server: { port: 0, strictPort: false, open: false } });
await server.listen();
const url = server.resolvedUrls?.local[0];
let browser;
let failed = true;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  // The value fixtures were recorded in this locale and time zone.
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, locale: 'en-US', timezoneId: 'America/Mexico_City' });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => typeof window.__layoutCheck === 'function', null, { timeout: 30000 });
  const result = await page.evaluate((o) => window.__layoutCheck(o), only);

  console.log(`PassKit layout check: ${result.passing}/${result.cases} cases match${result.known.length ? `, ${result.known.length} known difference(s)` : ''}.`);
  for (const k of result.known) console.log(`  known  ${k.name}: ${k.why}`);
  for (const f of result.failing) {
    console.log(`  FAIL   ${f.name}`);
    for (const p of f.problems) console.log(`           ${p}`);
  }
  const v = result.values;
  if (v.skipped) console.log(`Field values: skipped (${v.skipped}).`);
  else {
    console.log(`Field values: ${v.passing}/${v.cases} formatted exactly as PassKit does.`);
    for (const f of v.failing) console.log(`  FAIL   ${f}`);
  }
  const b = result.barcodes;
  console.log(`Barcodes: ${b.passing}/${b.cases} sized exactly as PassKit sizes them${b.known.length ? `, ${b.known.length} known difference(s)` : ''}.`);
  for (const k of b.known) console.log(`  known  ${k}`);
  for (const f of b.failing) console.log(`  FAIL   ${f}`);
  failed = result.failing.length > 0 || result.cases === 0 || (v.failing?.length ?? 0) > 0 || b.failing.length > 0;
} catch (e) {
  console.error(e.message);
  if (/chrome/i.test(e.message)) console.error('Is Google Chrome installed? playwright-core uses the installed Chrome.');
} finally {
  await browser?.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
