# 🍵 Clinical Tea Cards / Teák / Ceaiuri / Tees
🌐 **Live site:** https://medicinal-tea-atlas.pages.dev/#en
Languages: [HU](https://medicinal-tea-atlas.pages.dev/#hu) · [RO](https://medicinal-tea-atlas.pages.dev/#ro) · [EN](https://medicinal-tea-atlas.pages.dev/#en) · [DE](https://medicinal-tea-atlas.pages.dev/#de) · [Magyar README](README.md)

A single, self-contained HTML file (`index.html`): cards for 34 medicinal, spice,
fruit, calming, ginseng and mushroom teas. Each card shows the effect, how to prepare it,
and the results of the clinical studies behind it — **with study links right below the
description**.

## Languages

Four languages, switchable in the top-right corner: **HU · RO · EN · DE**

- The chosen language is remembered (`localStorage`) and added to the end of the URL
  (`index.html#en`), so the link can be shared in a specific language.
- On first open it picks the browser's language if it is one of the four — otherwise Hungarian.

## What it contains

- **34 tea cards** — tap to flip; the back has *Preparation* and *Clinical result*
  (for traditional-use plants, *Traditional use*).
- **Study links after the description** — in every popup, in every language, the scientific
  background is present: 68 concrete references (study type, year, journal), each with a
  **PubMed + DOI + OpenAlex** link, plus a PubMed and OpenAlex search that opens the plant's
  full literature.
- **References verified** — all 67 unique PMIDs are real, the stored titles match the titles
  in PubMed, and none of them is a retracted publication.
- **Filter by goal** — the button row above the cards — sleep, digestion, cold, blood pressure, pain, mood, women's health,
  immunity, blood sugar.
- **Search** in the sidebar, by tea name.
- **Sources page** — brief summaries of the referenced studies, with links.
- **Videos** – the ▶ Videos page in the menu: one slot per `videos.json` entry in a grid, each a lazy-loaded `youtube-nocookie.com` player with a two-line title. The slots are filled in `videos.json`.
- **Print / PDF** — all teas with full text, in the current language, including the links.

## Mobile

Verified on phones with an automated test (Playwright), across **5 screen sizes × 4 languages**
(320, 375, 390, 768, 1280 px):

- no horizontal scrolling in any language or size;
- card height adapts to the content, so the longer German/Romanian text does not overflow;
- the popup stays within the screen and is fully scrollable;
- touch targets are at least ~44 px tall;
- the sidebar menu opens/closes (☰, ×, tap on the backdrop) and does not run off-screen;
- there is a link below the description for all 34 teas, in all 4 languages.

The test can be re-run with `check.mjs` (Playwright required):

```bash
node check.mjs /absolute/path/index.html
```

## Build

Edit `template.html` and the JSON files, run `python build.py`, then `node check.mjs "<absolute path>/index.html"`.

## Videos

The videos live in `videos.json`: the slots are the entries of the file (1 to 48, non-empty `id`s unique), each shaped like `{ "id": "abcDEF12345", "t": ["title", "channel"] }`. The `id` is the 11 characters after `watch?v=` in a YouTube link. An empty `id` shows a "Coming soon…" placeholder. After editing, run `python build.py`, then `node check.mjs "<absolute path>/index.html"`.

## Look

Dark, colorful gradient background + **glass-panel (liquid glass) effect** on every panel,
with a smaller blur on mobile (11px) for speed and readability, and 15px on desktop.
`-webkit-backdrop-filter` is set everywhere for Safari.

## Important

This is informational, a scientific overview — **not personalized medical advice**.
In case of an existing illness, pregnancy/breastfeeding or medication use, and before taking
concentrated extracts / dietary supplements, medical advice is required. The effect of teas
is typically milder than the concentrated extracts used in the studies.
