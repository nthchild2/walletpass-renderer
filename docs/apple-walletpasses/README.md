# Apple Wallet Passes documentation (snapshot)

A local copy of Apple's Wallet Passes documentation, downloaded 2026-11-20 from
developer.apple.com/documentation/walletpasses.

- `raw/` — the JSON Apple's documentation site serves for each page.
- `spec.json` — the pass.json keys and types, extracted from `raw/`.
- `outline.txt` — every page in the set, by title and kind.
- `articles/` — the articles converted to Markdown.

This is reference material, not ground truth: where Apple's docs and what
PassKit actually renders disagree, `tools/passkit-probe` in the Simulator wins.
