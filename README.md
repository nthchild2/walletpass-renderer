# Wallet Pass Renderer

A browser-only previewer for **classic** Apple Wallet passes: boarding pass, coupon, event ticket, generic and store card. The newer poster-style event tickets and semantic layouts are out of scope.

```bash
npm install
npm run dev
```

## What it does

- **Upload:** drop a `.pkpass`, `.zip`, or bare `pass.json`. The pass is unzipped in the browser and rendered with its images (`@3x` > `@2x` > `1x`), colors and barcode. If the pass has `*.lproj/pass.strings`, it is localized and you can pick the language. Nothing is uploaded to a server.
- **Configure:** a form for the style, basics, colors, images, every field group (with date, number and currency formatting), the barcode, and validity (expired or voided). Changes show in the preview right away.
- **JSON:** edit `pass.json` directly. It applies live whenever the JSON parses.
- **Preview:** the front and back of the pass (the back flips with an animation), the per-style shapes (notched event ticket, boarding pass cut-outs, perforated coupon edge), the blurred background for event tickets, and the transit icon on boarding passes. All eight barcode formats in Apple's docs are drawn with bwip-js: QR, PDF417, Aztec, Code 128, plus Code 39, Codabar, EAN-13 and Interleaved 2 of 5 (iOS 27+). As in Wallet, the first barcode the device can display is shown; the "iOS 27+ / iOS 26 or earlier" switch previews the fallback. Messages are encoded with `messageEncoding`. A validation list flags missing required keys, bad colors, images the style ignores, unsigned bundles, and similar problems.

**How accurate the preview is:** the pass is drawn at Wallet's real size, 343×503 pt (1 CSS px = 1 pt). Positions, fonts (SF Pro values, uppercase SF Mono labels), the event-ticket notch, the coupon perforation and the barcode boxes were measured from Apple's own 2× renders of classic passes on the Wallet Passes "Creating a pass with Pass Designer" page. Overlaid on those renders, the coupon, generic, store card and background-image event ticket match within about 1 pt. Apple has no current classic reference for the boarding pass, event tickets with a strip image, the footer image, barcode alt text or the back of the pass, so those are best estimates.

The pass you're working on is saved in the browser (IndexedDB, images included) and restored on the next visit.

The preview exports as PNG (@3x) or SVG, and "pass.json" downloads the pass description. Producing a signed `.pkpass` is out of scope.

## Checking the layout

Each field group has a fixed slot per style, as in Wallet, so an empty group leaves a gap instead of pulling other rows into the thumbnail or strip. To catch regressions, run the layout stress test in the browser console while `npm run dev` is running:

```js
await __layoutAudit()              // all styles, ~4,300 variants
await __layoutAudit('eventTicket') // one style
```

It renders every combination of empty, short, full and overlong field groups, image sets, barcode kinds, alt text and voided passes, and reports anything that overlaps, leaves the 343×503 pt card, or falls into the event-ticket notch. It should report `failing: 0`.

## Layout

- `src/pass/types.ts`: the pass.json model and the images each style allows
- `src/pass/parse.ts`: reads the `.pkpass` zip, decodes `.strings` files (UTF-8 or UTF-16) and picks images
- `src/pass/format.ts`: colors, date/number/currency formatting, validation
- `src/pass/samples.ts`: the built-in example for each style
- `src/components/PassView.tsx`: the renderer
- `src/dev/layoutAudit.tsx`: the layout stress test (dev only)
- `scripts/make-samples.mjs`: regenerates the unsigned sample passes in `public/samples/` (`npm run samples`)

