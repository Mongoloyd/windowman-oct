import type { ProphecyIntentOption } from "./ProphecyIntentCard";

/**
 * The fork, in the visitor's own words.
 *
 * Wording rules for this file:
 *  - Say what they have, not what we do. "I have an estimate" beats
 *    "Estimate analysis service".
 *  - Name the payoff in the detail line, including the part people are
 *    suspicious of — that we don't sell windows, and there is no obligation.
 *  - Never imply the contractor is dishonest. WindowMan points at lines and
 *    tells you what to ask; it does not accuse anyone.
 *
 * Replace the art at `public/images/prophecy/`. `<imageBase>.jpg` is the only
 * required file. If you also produce `.avif` or `.webp`, list them in
 * `imageFormats` — listing a format you have not actually shipped breaks the
 * image, because `<picture>` never falls back from a source it selected.
 */
export const PROPHECY_INTENT_OPTIONS: readonly ProphecyIntentOption[] = [
  {
    value: "has_quote",
    eyebrow: "I have one",
    title: "I've got an estimate in hand.",
    detail:
      "Upload it and we'll read every line — price, scope, fees, warranty, fine print — then show you exactly what to ask before you sign.",
    imageBase: "/images/prophecy/intent-has-quote",
    imageAlt:
      "A printed window estimate on a kitchen table, lit from one side",
  },
  {
    value: "no_quote",
    eyebrow: "Not yet",
    title: "I don't have an estimate yet.",
    detail:
      "We'll help you get a first one from a contractor worth talking to — then review it free, with no pressure to buy anything.",
    imageBase: "/images/prophecy/intent-needs-quote",
    imageAlt:
      "Impact windows in a Florida home with afternoon light coming through",
  },
] as const;
