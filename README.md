# Wallet Pass Renderer

A browser-only previewer for **classic** Apple Wallet passes: boarding pass, coupon, event ticket, generic and store card. The newer poster-style event tickets and semantic layouts are out of scope.

```bash
npm install
npm run dev
```

## What it does

- **Open:** the "Open .pkpass" button (or dropping a file anywhere on the page) opens a `.pkpass`, `.zip`, or bare `pass.json`. The pass is unzipped in the browser and rendered with its images (`@3x` > `@2x` > `1x`), colors and barcode. If the pass has `*.lproj/pass.strings`, it is localized, and a Language picker appears in the preview. Nothing is uploaded to a server.
- **Configure** (the default view): a form for the style, basics, colors, images, every field group (with date, number and currency formatting), the barcode, and validity (expired or voided). Changes show in the preview right away.
- **Guide:** how each classic layout works. A wireframe of every variant (drawn by the renderer itself, each slot labelled with its `pass.json` key and filled to its limit), the field limits, the images, an annotated `pass.json` shape, the field-dictionary keys, and links to Apple's documentation.
- **JSON:** edit `pass.json` directly. It applies live whenever the JSON parses.
- **Share:** the Share button copies a link with the pass in it: `pass.json` and its translations, compressed into the part of the URL after `#` (about 1 KB for the example ticket). That part never reaches the server, so nothing is stored. Images don't fit in a link, so a shared pass opens without them, with a notice saying so.
- **Links to sections:** each tab has its own URL (`/`, `/json`, `/guide`), as does each Guide layout (`/guide/coupon`, `/guide/event-ticket-strip`…) and section (`/guide#field-dictionary`); hover a Guide heading for its link. `vercel.json` serves the app for every path.
- **Preview:** the front and back of the pass (the back flips with an animation), the per-style shapes (notched event ticket, boarding pass cut-outs, perforated coupon edge), the blurred background for event tickets, and the transit icon on boarding passes. All eight barcode formats in Apple's docs are drawn with bwip-js: QR, PDF417, Aztec, Code 128, plus Code 39, Codabar, EAN-13 and Interleaved 2 of 5 (iOS 27+). As in Wallet, the first barcode the device can display is shown; the "iOS 27+ / iOS 26 or earlier" switch previews the fallback. Messages are encoded with `messageEncoding`. A validation list flags missing required keys, bad colors, images the style ignores, unsigned bundles, and similar problems.

**How accurate the preview is:** the pass is drawn at Wallet's real size (1 CSS px = 1 pt). On iPhone the card is the screen width minus 32 pt and always 503 pt tall; nothing inside scales, and strip images stop growing at Apple's 375-pt allotment. The Device picker previews the iPhone sizes from 375 pt (343 pt card) to 440 pt (408 pt card).

Text layout is a port of PassKit's own field layout (PKPassBucketView / PKPassFieldView on iOS 27), read from the framework and checked against PassKit's renderer drawing the same test passes in the Simulator: on 57 test passes covering every style, every field's position, width and font size matches within a third of a point, save one line-break difference at 22 pt. A real iPhone screenshot matches PassKit's renderer to the point. The browser's SF Pro has exactly UIKit's advances, so the fonts are Apple's sizes (SF Mono gets a small letter-spacing to match iOS's wider monospaced font). What PassKit does:

- **Colors.** Values use `foregroundColor`; labels and `logoText` use `labelColor`.
- **Rows.** Each row has a template: its position, a minimum gap (16 pt on event-ticket auxiliary rows and coupons, 12 pt on generic rows, 0 on event-ticket secondary rows) and whether values may wrap. Fields are spread edge to edge.
- **Wrapping.** Event-ticket primary and first auxiliary rows, the generic primary and the coupon / store-card caption wrap onto two lines (your own line breaks count too). When a row is too wide, its widest field is narrowed step by step (by at most a quarter of its width at a time); a value that needs a third line drops 1 pt at a time until it fits, down to about the label's x-height. Text past the second line is cut without an ellipsis.
- **Shrinking.** A row that still doesn't fit gets one smaller font for all its values (to a quarter point, no smaller than the label's x-height, e.g. 12.25 pt), then each value shrinks to its width and truncates.
- **Header.** Header fields share a 115 pt box at the top right, first field rightmost, values in upper case; `logoText` stops 10 pt before that box.
- **Primary field.** A long event-ticket primary shrinks 1 pt at a time until it fits on one line, or on two once two fit (about 13 pt). With a strip image, event tickets show the primary large (66 pt) and without its label.
- **QR / Aztec size.** Wallet aims for a ~136 pt code with each module rounded down to whole device pixels, so the size depends on the code and the screen: a 29-module QR is 130.5 pt in a 150 pt box on an @2x iPhone SE and 135.3 pt in a 153.8 × 155.8 pt box on an @3x iPhone 17, as measured in Apple's Add Pass sheet. That's why the device list separates the iPhone SE (@2x) from the 13 mini (@3x).

Images (logo, strip, thumbnail, background), the event-ticket notch, the coupon perforation and the barcode boxes were measured from Apple's own 2× renders of classic passes and from the Add Pass sheet. Not measured: the transit icon's position on boarding passes, the footer image, barcode alt text and the back of the pass, which are best estimates; row positions on cards narrower or wider than 370 pt follow the same rules but weren't checked against PassKit; and `labelColor` left out (PassKit picks it automatically; the preview uses the foreground color).

**Checking against PassKit:** `npm run test:layout` (macOS, with Google Chrome installed) renders the 56 passes in `tests/layout/apple-frames.json` and compares every label, value and logo text with PassKit's own layout of the same pass: position within 0.7 pt, value width within 1.5 pt, height within 1 pt, font size within 0.1 pt. It currently passes 55 of 56, plus one known difference (a 22 pt line break). In the dev server the same check is `await __layoutCheck()` in the console. The frames come from `tools/passkit-probe`, which draws passes with PassKit in the iOS Simulator; see its README to re-measure or add cases.

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

