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
- **Preview:** the front and back of the pass (the back flips with an animation), the per-style shapes (notched event ticket, boarding pass cut-outs, perforated coupon edge), the blurred background for event tickets, and the transit icon on boarding passes. QR, PDF417, Aztec and Code 128 barcodes are drawn with bwip-js. A validation list flags missing required keys, bad colors, images the style ignores, unsigned bundles, and similar problems.

**How accurate the preview is:** the pass is drawn at Wallet's real size, 343×503 pt (1 CSS px = 1 pt). Positions, fonts (SF Pro values, uppercase SF Mono labels), the event-ticket notch, the coupon perforation and the barcode boxes were measured from Apple's own 2× renders of classic passes on the Wallet Passes "Creating a pass with Pass Designer" page. Overlaid on those renders, the coupon, generic, store card and background-image event ticket match within about 1 pt. Apple has no current classic reference for the boarding pass, event tickets with a strip image, the footer image, barcode alt text or the back of the pass, so those are best estimates.

"Download pass.json" exports the pass description as JSON. Producing a signed `.pkpass` is out of scope.

## Layout

- `src/pass/types.ts`: the pass.json model and the images each style allows
- `src/pass/parse.ts`: reads the `.pkpass` zip, decodes `.strings` files (UTF-8 or UTF-16) and picks images
- `src/pass/format.ts`: colors, date/number/currency formatting, validation
- `src/pass/samples.ts`: the built-in example for each style
- `src/components/PassView.tsx`: the renderer
- `scripts/make-samples.mjs`: regenerates the unsigned sample passes in `public/samples/` (`npm run samples`)

