# Wallet Pass Renderer

A browser-only previewer for **classic** Apple Wallet passes: boarding pass, coupon, event ticket, generic and store card. The newer poster-style event tickets and semantic layouts are out of scope.

```bash
npm install
npm run dev
```

## What it does

- **Open:** the "Open .pkpass" button (or dropping a file anywhere on the page) opens a `.pkpass`, `.zip`, or bare `pass.json`. The pass is unzipped in the browser and rendered with its images (`@3x` > `@2x` > `1x`), colors and barcode. If the pass has `*.lproj/pass.strings`, it is localized, and a Language picker appears in the preview. Nothing is uploaded to a server.
- **Configure** (the default view): a form for the style, basics, colors, images, every field group (with date, number and currency formatting), the barcode, and validity (expired or voided). Changes show in the preview right away.
- **Guide:** how each classic layout works. A wireframe of every variant (drawn by the renderer itself, each slot labelled with its `pass.json` key and filled to its limit), the field limits with where each number comes from, the images, an annotated `pass.json` shape, the field-dictionary keys, and links to Apple's documentation.
- **JSON:** edit `pass.json` directly. It applies live whenever the JSON parses.
- **Preview:** the front and back of the pass (the back flips with an animation), the per-style shapes (notched event ticket, boarding pass cut-outs, perforated coupon edge), the blurred background for event tickets, and the transit icon on boarding passes. All eight barcode formats in Apple's docs are drawn with bwip-js: QR, PDF417, Aztec, Code 128, plus Code 39, Codabar, EAN-13 and Interleaved 2 of 5 (iOS 27+). As in Wallet, the first barcode the device can display is shown; the "iOS 27+ / iOS 26 or earlier" switch previews the fallback. Messages are encoded with `messageEncoding`. A validation list flags missing required keys, bad colors, images the style ignores, unsigned bundles, and similar problems.

**How accurate the preview is:** the pass is drawn at Wallet's real size (1 CSS px = 1 pt). On iPhone the card is the screen width minus 32 pt and always 503 pt tall; nothing inside scales, and strip images stop growing at Apple's 375-pt allotment. The Device picker previews the iPhone sizes from 375 pt (343 pt card) to 440 pt (408 pt card). The rule was measured with one signed pass shown in Apple's own Add Pass sheet in the iOS Simulator, at exact screenshot scale: iPhone SE 343.0 × 503.0 pt and iPhone 17 370.0 × 503.0 pt, both with 16.0 pt margins (and matching a real iPhone 17 screenshot). The other sizes follow the same rule but weren't measured.

Two behaviors were matched to those Simulator renders:

- **Shrink to fit.** When a row's values don't fit, Wallet shrinks them together (labels and header values never shrink) and only truncates below about half size. Fields sit edge to edge when tight. The preview measures the text as laid out, so SF Pro's looser small-size tracking is included. With the test pass it matches the iPhone 17 exactly (0.66×). On the iPhone SE it uses the same total width, but Wallet split it unevenly (0.51× and 0.65×) where the preview uses 0.58× for both.
- **QR / Aztec size.** Wallet aims for a ~136 pt code with each module rounded down to whole device pixels, so the size depends on the code and the screen: a 29-module QR is 130.5 pt in a 150 pt box on an @2x iPhone SE and 135.3 pt in a 153.8 × 155.8 pt box on an @3x iPhone 17, as measured. That's why the device list separates the iPhone SE (@2x) from the 13 mini (@3x).

Positions, fonts (SF Pro values, uppercase SF Mono labels), the event-ticket notch, the coupon perforation and the barcode boxes were measured from Apple's own 2× renders of classic passes on the Wallet Passes "Creating a pass with Pass Designer" page. Overlaid on those renders, the coupon, generic, store card and background-image event ticket match within about 1 pt. Apple has no current classic reference for the boarding pass, event tickets with a strip image, the footer image, barcode alt text or the back of the pass, so those are best estimates.

Colors can be picked or typed as `#RRGGBB`, `#RGB` or `rgb(r, g, b)`; they're saved as `rgb(…)`, the only form Apple documents (hex in an uploaded pass still renders, with a warning). The interface has a theme button that cycles System / Light / Dark. Natural text alignment follows each line's direction, so right-to-left labels and values align right.

The pass you're working on is saved in the browser (IndexedDB, images included) and restored on the next visit.

The preview exports as PNG (@3x) or SVG, and "pass.json" downloads the pass description. Producing a signed `.pkpass` is out of scope.

## Checking the layout

Each field group has a fixed slot per style, as in Wallet, so an empty group leaves a gap instead of pulling other rows into the thumbnail or strip. To catch regressions, run the layout stress test in the browser console while `npm run dev` is running:

```js
await __layoutAudit()              // all styles, at the narrowest and widest cards
await __layoutAudit('eventTicket') // one style
await __layoutAudit(undefined, [343, 370, 408]) // chosen card widths
```

It renders every combination of empty, short, full and overlong field groups and image sets, plus every barcode kind × alt text × voided for the fullest layouts, and reports anything that overlaps, leaves the card, or falls into the event-ticket notch. Across all seven device widths that's about 40,000 variants (~20 s). It should report `failing: 0`.

## Layout

- `src/pass/types.ts`: the pass.json model and the images each style allows
- `src/pass/parse.ts`: reads the `.pkpass` zip, decodes `.strings` files (UTF-8 or UTF-16) and picks images
- `src/pass/format.ts`: colors, date/number/currency formatting, validation
- `src/pass/samples.ts`: the built-in example for each style
- `src/components/PassView.tsx`: the renderer
- `src/dev/layoutAudit.tsx`: the layout stress test (dev only)
- `scripts/make-samples.mjs`: regenerates the unsigned sample passes in `public/samples/` (`npm run samples`), handy for testing "Open .pkpass"

