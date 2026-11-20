# PassKit layout probe

Gets Apple's exact layout for any `pass.json`, from PassKit's own renderer, to keep the preview honest.

Wallet's Add Pass sheet only accepts signed passes, so this draws passes in-process with PassKit's
`PKPassView` instead, loading them with a private initializer that skips the signature check
(Simulator / development use only). A real iPhone screenshot of a pass matched `PKPassView`'s
layout to the point.

```bash
node tools/passkit-probe/run.mjs
```

regenerates `tests/layout/apple-frames.json` from the cases already in it. To probe new passes,
pass a JSON file with `{ "cases": [{ "name", "images": ["logo", …], "pass": { …pass.json… } }] }`
and an output path:

```bash
node tools/passkit-probe/run.mjs my-cases.json /tmp/frames.json
```

Needs Xcode and a **booted** iOS Simulator. It uses whichever is booted, so it doesn't create
simulators; the card width is that phone's screen width minus 32 pt (370 pt on an iPhone 17).
Images are solid-colour PNGs at the sizes in `run.mjs`; only their sizes affect the layout. The
probe app (`local.passkit-probe`) stays installed on the simulator, along with each pass's PNG
render (the path is printed).

What it records per pass: every `UILabel` (field labels, values, logo text) with its frame, font
and line count, and each row's template (`PKPassBucketTemplate`: rect, minimum gap, value font,
whether values wrap). `src/pass/fit.ts` ports the row layout these produce; `npm run test:layout`
checks the preview against the recorded frames.

Not visible to the probe: images (logo, strip, thumbnail, background) are drawn into one face
image, so measure those from the PNG with an opaque test image; colors that PassKit picks
automatically (no `labelColor`) are applied with vibrancy filters that the snapshot doesn't show.
