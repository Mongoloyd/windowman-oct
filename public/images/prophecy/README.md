# Prophecy intent card art

The two images a visitor picks between on `/prophecy`. Replacing them is a file
swap — no code change.

## Required files

| Card | Base name |
|---|---|
| "I've got an estimate in hand." | `intent-has-quote` |
| "I don't have an estimate yet." | `intent-needs-quote` |

For each base name:

- `<base>.jpg` — **required.** The file every browser loads by default.
- `<base>.webp` / `<base>.avif` — optional, smaller, preferred when present.

**If you add a `.webp` or `.avif`, you must also list it** in `imageFormats` in
`src/pages/CampaignProphecy/prophecyIntentOptions.ts`:

```ts
imageFormats: ["avif", "webp"],
```

This is not boilerplate. `<picture>` picks the first `<source>` whose format the
browser supports and then commits to it — if that file is missing it shows a
broken image rather than falling back to the JPG. So the code only ever
advertises formats that actually exist on disk. (A load failure still degrades
to the card's gradient rather than a broken-image glyph, but you lose the
photograph.)

## What the art needs to do

- **Portrait, roughly 4:5.** The cards render `aspect-[5/4]` stacked on mobile
  and `aspect-[4/5]` side by side above the `sm` breakpoint. Supply at least
  1000 × 1250.
- **Keep the bottom third quiet.** A scrim sits over it carrying the eyebrow,
  title and detail line. Faces, text and focal detail belong in the top two
  thirds.
- **One light source, warm, upper right.** It has to sit inside the page's
  lighting: warm key from the upper right, cool fill from the left. A flatly lit
  or cool-keyed photograph will read as pasted on.
- **Two states, one glance.** "Has an estimate" should read as a document in a
  domestic setting. "Needs an estimate" should read as the windows themselves.
  Someone scanning at arm's length has to tell them apart without reading.

## Current state

The committed JPGs are generated placeholders — flat gradients with the base
name burned in. They exist so the page renders and so swapping in real art is a
drop-in. Replace both before the campaign goes live.
