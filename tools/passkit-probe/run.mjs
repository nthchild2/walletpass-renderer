// Measure PassKit's own layout of test passes, to (re)generate tests/layout/apple-frames.json.
//
//   node tools/passkit-probe/run.mjs [cases.json] [out.json]
//
// cases.json defaults to tests/layout/apple-frames.json itself (its "cases": name, images, pass);
// out.json defaults to the same file. Needs Xcode and a booted iOS Simulator (an existing one; the
// card width is that phone's screen width minus 32 pt, 370 pt on an iPhone 17). It builds
// Probe.swift into a tiny app, installs it on the booted simulator with the passes inside, and
// collects every UILabel's frame from PKPassView. See README.md.
import { execFileSync } from 'node:child_process';
import { crc32, deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const casesPath = resolve(process.argv[2] ?? join(root, 'tests/layout/apple-frames.json'));
const outPath = resolve(process.argv[3] ?? casesPath);
const work = join(tmpdir(), 'passkit-probe');
const BUNDLE_ID = 'local.passkit-probe';

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts });

// ---------- Solid-colour PNGs at @1x / @2x / @3x ----------
function png(w, h, [r, g, b]) {
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Image sizes in points (the probe used these when the fixtures were made).
const IMAGES = {
  icon: [29, 29, [128, 128, 128]],
  logo: [160, 50, [204, 136, 0]],
  thumbnail: [90, 90, [34, 170, 102]],
  strip: [180, 220, [34, 68, 102]],
  background: [180, 220, [102, 34, 68]],
  footer: [286, 15, [170, 170, 34]],
};

// ---------- Build the app ----------
const input = JSON.parse(readFileSync(casesPath, 'utf8'));
const cases = input.cases ?? input;
rmSync(work, { recursive: true, force: true });
const app = join(work, 'Probe.app');
mkdirSync(join(app, 'passes'), { recursive: true });

for (const c of cases) {
  const dir = join(app, 'passes', `${c.name}.pass`);
  mkdirSync(dir);
  writeFileSync(join(dir, 'pass.json'), JSON.stringify(c.pass));
  for (const name of new Set(['icon', ...c.images])) {
    const [w, h, color] = IMAGES[name];
    for (const [suffix, s] of [['', 1], ['@2x', 2], ['@3x', 3]]) writeFileSync(join(dir, `${name}${suffix}.png`), png(w * s, h * s, color));
  }
}

const sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']).trim();
const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
run('xcrun', ['--sdk', 'iphonesimulator', 'swiftc', '-parse-as-library', '-O', '-target', `${arch}-apple-ios17.0-simulator`, '-sdk', sdk, join(here, 'Probe.swift'), '-o', join(app, 'Probe')], { stdio: 'inherit' });
writeFileSync(
  join(app, 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
<key>CFBundleExecutable</key><string>Probe</string>
<key>CFBundleName</key><string>PassKitProbe</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1</string>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>UILaunchScreen</key><dict/>
</dict></plist>
`,
);
run('codesign', ['-f', '-s', '-', app], { stdio: 'ignore' });

// ---------- Run it on the booted simulator ----------
const booted = Object.values(JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'])).devices).flat();
if (!booted.length) {
  console.error('No booted simulator. Boot an existing one first (xcrun simctl boot <name>).');
  process.exit(1);
}
const device = booted[0];
console.log(`Probing ${cases.length} passes on ${device.name}…`);
const quiet = (args) => {
  try {
    run('xcrun', args, { stdio: 'ignore' });
  } catch {
    // e.g. terminating an app that isn't running
  }
};
quiet(['simctl', 'terminate', device.udid, BUNDLE_ID]);
run('xcrun', ['simctl', 'install', device.udid, app]);
const data = run('xcrun', ['simctl', 'get_app_container', device.udid, BUNDLE_ID, 'data']).trim();
const out = join(data, 'tmp', 'out');
rmSync(out, { recursive: true, force: true });
run('xcrun', ['simctl', 'launch', device.udid, BUNDLE_ID]);
const deadline = Date.now() + 120_000;
while (!existsSync(join(out, 'DONE'))) {
  if (Date.now() > deadline) {
    console.error('Timed out waiting for the probe.');
    process.exit(1);
  }
  execFileSync('sleep', ['0.5']);
}
quiet(['simctl', 'terminate', device.udid, BUNDLE_ID]);

// ---------- Collect ----------
const width = new Set();
const results = cases.map((c) => {
  const file = join(out, `${c.name}.json`);
  if (!existsSync(file)) throw new Error(`No result for ${c.name}: PassKit couldn't load it.`);
  const r = JSON.parse(readFileSync(file, 'utf8'));
  width.add(r.width);
  return { name: c.name, images: c.images, pass: c.pass, frames: r.frames.map(({ text, frame, size }) => ({ text, frame, size })) };
});
writeFileSync(
  outPath,
  JSON.stringify(
    {
      _about: `PassKit's own layout of each pass (PKPassView, ${device.name}, ${[...width].join('/')} pt card). 'images' lists the images present (solid-colour PNGs, sizes in tools/passkit-probe/run.mjs). frame = [x, y, width, height] in pt of each UILabel (labels, values, logo text). Regenerate with: node tools/passkit-probe/run.mjs`,
      cases: results,
    },
    null,
    1,
  ) + '\n',
);
console.log(`Wrote ${results.length} cases to ${outPath} (PNG renders in ${out}).`);
