# Wallet Pass Renderer

A browser-only previewer for **classic** Apple Wallet passes: boarding pass, coupon, event ticket, generic and store card. The newer poster layouts (poster event tickets, iOS 27's `posterGeneric`) and semantic boarding passes are out of scope.

```bash
npm install
npm run dev
```

## What it does

- **Open:** the "Open .pkpass" button (or dropping a file anywhere on the page) opens a `.pkpass`, `.zip`, or bare `pass.json`. The pass is unzipped in the browser and rendered with its images (`@3x` > `@2x` > `1x`), colors and barcode. If the pass has `*.lproj/pass.strings`, it is localized, and a Language picker appears in the preview. Nothing is uploaded to a server.
- **Configure** (the default view): a form for the style, basics, colors, images, every field group (with date, number and currency formatting), the barcode, and validity (expired or voided). Changes show in the preview right away.
- **Guide:** how each classic layout works. A wireframe of every variant (drawn by the renderer itself, each slot labelled with its `pass.json` key and filled to its limit), the field limits, the images, an annotated `pass.json` shape, the field-dictionary keys, and links to Apple's documentation.
- **JSON:** edit `pass.json` directly. It applies live whenever the JSON parses.
- **Share:** the Share button copies a link with the pass in it: `pass.json` and its translations, compressed into the part of the URL after `#` (about 1 KB for the example ticket). That part never reaches the server, so nothing is stored. Images don't fit in a link, so the link carries each image's name and pixel size instead: the shared pass opens with grey placeholders of the same sizes (so it lays out exactly as the original) and a notice naming them. Links made before this opened without images and still do.
- **Links to sections:** each tab has its own URL (`/`, `/json`, `/guide`), as does each Guide layout (`/guide/coupon`, `/guide/event-ticket-strip`…) and section (`/guide#field-dictionary`); hover a Guide heading for its link. `vercel.json` serves the app for every path.
- **Preview:** the front of the pass and its back (Wallet's pass details screen on iOS 27), the per-style shapes (notched event ticket, boarding pass cut-outs, perforated coupon edge), the blurred background for event tickets, and the transit icon on boarding passes. All eight barcode formats in Apple's docs are drawn with bwip-js: QR, PDF417, Aztec, Code 128, plus Code 39, Codabar, EAN-13 and Interleaved 2 of 5 (iOS 27+). PDF417 and Aztec codes take the symbol shape Wallet's Core Image generators pick for the message. As in Wallet, the first barcode the device can display is shown; the "iOS 27+ / iOS 26 or earlier" switch previews the fallback. Messages are encoded with `messageEncoding`. A validation list flags missing required keys, bad colors, images the style ignores, unsigned bundles, and similar problems.

**How accurate the preview is:** the pass is drawn at Wallet's real size (1 CSS px = 1 pt). On iPhone the card is the screen width minus 32 pt and always 503 pt tall; nothing inside scales, and strip images stop growing at Apple's 375-pt allotment. The Device picker previews the iPhone sizes from 375 pt (343 pt card) to 440 pt (408 pt card).

Text layout is a port of PassKit's own field layout (PKPassBucketView / PKPassFieldView on iOS 27), read from the framework and checked against PassKit's renderer drawing the same test passes in the Simulator: on 75 of 86 test passes covering every style, every label, value and logo text matches PassKit's position within 0.7 pt and font size within 0.1 pt; the other 11 are long names and long boarding-pass origins that end a size step away from PassKit's (see "Checking against PassKit" below). A real iPhone screenshot matches PassKit's renderer to the point. The browser's SF Pro has exactly UIKit's advances, so the fonts are Apple's sizes (SF Mono gets a small letter-spacing to match iOS's wider monospaced font). What PassKit does:

- **Colors.** Values use `foregroundColor` and labels `labelColor`; without `labelColor`, labels are black (PassKit fills black in before its own "automatic" rule could apply). `logoText` takes `labelColor` on a dark card (PassKit's lightness below 0.22, or any background image) and `foregroundColor` on a lighter one.
- **Rows.** Each row has a template: its position, a minimum gap (16 pt on event-ticket auxiliary rows and coupons, 12 pt on generic rows, 0 on event-ticket secondary rows) and whether values may wrap. Fields are spread edge to edge.
- **Wrapping.** Event-ticket primary and first auxiliary rows, the generic primary and the coupon / store-card caption wrap onto two lines (your own line breaks count too). When a row is too wide, its widest field is narrowed step by step (by at most a quarter of its width at a time); a value that needs a third line drops 1 pt at a time until it fits, down to about the label's x-height. Text past the second line is cut without an ellipsis.
- **Shrinking.** A row that still doesn't fit gets one smaller font for all its values (to a quarter point, no smaller than the label's x-height, e.g. 12.25 pt), then each value shrinks to its width and truncates.
- **Header.** Header fields share a 115 pt box at the top right, first field rightmost, values in upper case; `logoText` stops 10 pt before that box. Without a logo image, `logoText` starts at x = 13, where the logo would.
- **Event ticket images.** `background.png` wins over `strip.png`: with both, Wallet shows the background layout (with the thumbnail) and ignores the strip. A strip without a background replaces the thumbnail. Text keeps your `foregroundColor` on a background image (iOS 27; a 2025 forum report of it turning white didn't reproduce, and the background isn't darkened, only blurred).
- **Primary field.** A long event-ticket primary shrinks 1 pt at a time until it fits on one line, or on two once two fit (about 13 pt). With a strip image, event tickets show the primary large (66 pt) and without its label. A boarding-pass origin or destination too wide for its 151 pt column shrinks both values to one size, and the gap between them by the same factor; the labels stay at the top and each value stays centred where a full-size value sits. A value too long even at the smallest size (11.5 pt) keeps that size and is cut off with an ellipsis, running under the transit icon as it does in Wallet.
- **Barcodes.** A white box with 5 pt corners, 6 pt around the code image (5 pt above, 7 pt below; 9 pt all round for PDF417), anchored 14 pt above the card's bottom for square codes and 32 pt for the others. QR modules are round(141 pt × pixel ratio ÷ (modules + 2)) device pixels with a one-module quiet zone (a 29-module QR: 135.3 pt on an iPhone 17, 130.5 pt on an iPhone SE). PDF417 and Aztec symbols have the columns, rows and layers Core Image picks for the message (`src/pass/barcodeShape.ts`). Aztec modules are sized like QR's but towards 164 pt, with a two-module quiet zone. A PDF417 is scaled towards a 245 × 64 pt image: in whole device pixels per module when that comes within 5 % of 245 pt, otherwise stretched to exactly that size. Code 128 and the other 1D codes fill a 245 × 64 pt image. Alt text is SF Pro 14 pt under the code. A voided or expired pass greys the code out and replaces its alt text with "this pass has expired"; a boarding pass's footer image sits 2 pt above the box.
- **Dates and numbers.** Formatted as iOS formats them (checked character for character): " at " between medium, long and full dates and the time, relative dates only for today, tomorrow and yesterday, a narrow no-break space before AM / PM, percent without decimals, banker's rounding, numberStyle before currencyCode, and nothing at all for a date style on something that isn't a full date-time with a time zone.
- **Back of the pass.** On iOS 27 there is no flip: the back is the pass details screen, with the top of the card, the description as its title, the Automatic Updates and Allow Notifications switches (only with a `webServiceURL`), Remove Pass and the back fields. A value sits on its label's row when both fit, otherwise under it; links and phone numbers are blue.

Images (logo, strip, thumbnail, background, footer) and the transit icon were measured from PassKit's render with opaque test images; the event-ticket notch and the coupon perforation from Apple's 2× renders. Not measured: row positions on cards narrower or wider than 370 pt (they follow the same rules), the glyph of each transit icon (its box is measured), and the dark-mode details screen.

**Checking against PassKit:** `npm run test:layout` (macOS, with Google Chrome installed) renders the 86 passes in `tests/layout/apple-frames.json` and compares every label, value and logo text with PassKit's own layout of the same pass (position within 0.7 pt, value width within 1.5 pt, height within 1 pt, font size within 0.1 pt), formats the 57 values in `tests/layout/passkit-values.json` and compares them with PassKit's text character for character, and draws the 57 barcodes in `tests/layout/passkit-barcodes.json` against PassKit's box and image frames. It currently passes 75 of 86 layouts, 57 of 57 values and 55 of 57 barcodes. The known differences:

- Nine long generic names. PassKit's value frame is the two-line box of one size, but the font it sets is 1 pt or more smaller (a 340 × 53 pt frame, two lines at 22 pt, set at 21 pt). This hasn't been traced in PassKit yet. The preview sets the frame's size, and for the three longest names it shrinks the whole row instead, to 13.25 pt where PassKit sets 15–17 pt.
- Two long boarding-pass origins that come out a quarter point smaller than PassKit's (39 pt for 39.25, 25.25 pt for 25.5).
- Two-column PDF417 codes at 7 px per module, which PassKit places 1.2 pt left of centre in their box. In the dev server the same check is `await __layoutCheck()` in the console. The frames come from `tools/passkit-probe`, which draws passes with PassKit in the iOS Simulator; see its README to re-measure or add cases.

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

- `src/pass/spec.ts`: the whole pass format as Apple documents it, as TypeScript types (pass.json, semantic tags, upcoming events, the bundle files, the web service), each key with its documented rules
- `src/pass/types.ts`: the subset the renderer uses, and the images each style allows
- `src/pass/parse.ts`: reads the `.pkpass` zip, decodes `.strings` files (UTF-8 or UTF-16) and picks images
- `src/pass/format.ts`: colors, date/number/currency formatting, validation
- `src/pass/barcodeShape.ts`: the PDF417 and Aztec symbol shapes Core Image picks for a message
- `src/pass/samples.ts`: the built-in example for each style
- `src/components/PassView.tsx`: the renderer
- `src/dev/layoutAudit.tsx`: the layout stress test (dev only)
- `scripts/make-samples.mjs`: regenerates the unsigned sample passes in `public/samples/` (`npm run samples`), handy for testing "Open .pkpass"

