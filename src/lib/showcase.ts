/**
 * Finished output for the home page — the proof that comes before the
 * argument.
 *
 * A reader arriving from a job posting sees prose about systems until they
 * click twice and enter a passcode. That is the wrong order for a craft role:
 * the work should land first and the reasoning should explain it afterwards.
 *
 * Every entry names the recipe, the model and what the render cost, because
 * the combination is the actual claim — not "here is a nice frame" but "here
 * is a nice frame, made this way, for this much, repeatably." A gallery any
 * agency could screenshot proves nothing; a gallery with unit economics
 * attached proves a production system.
 *
 * Files live in `public/showcase/`. Anything whose file is missing at build
 * time is dropped rather than rendered broken, so the strip only ever shows
 * work that exists — see `public/showcase/README.md`.
 */

export type ShowcaseItem = {
  /** Path under /public. `.mp4` renders as looping motion, everything else as a still. */
  file: string;
  /** Optional poster for a motion item — a still frame shown before it plays. */
  poster?: string;
  /** The concept, in the words used in the Ad Lab. */
  title: string;
  /** What the reader should notice — the craft claim, not a description. */
  note: string;
  /** Model that produced it. */
  model: string;
  /** What this render cost, to the cent. Omit where it genuinely does not apply. */
  cost?: string;
};

/**
 * Fill these in as you export renders. Names are suggestions, not fixtures —
 * change them freely; only `file` has to match what is on disk.
 */
export const SHOWCASE: ShowcaseItem[] = [
  {
    file: "/showcase/reverse-rewind.mp4",
    poster: "/showcase/reverse-rewind.jpg",
    title: "Reverse Rewind",
    note: "Assembly run backwards, product identity held across 14 seconds by reference-to-video.",
    model: "Seedance 2.5 Reference",
    cost: "$6.47",
  },
  {
    file: "/showcase/anti-gravity.mp4",
    poster: "/showcase/anti-gravity.jpg",
    title: "Anti-Gravity Assembly",
    note: "Weightless build, lit from a borrowed reference rather than a described one.",
    model: "Seedance 2.5 Reference",
    cost: "$3.70",
  },
  {
    file: "/showcase/packshot-grid.jpg",
    title: "Planogram angles",
    note: "Shot angles grounded, missing angles reconstructed and flagged for label QA.",
    model: "Nano Banana",
    cost: "$0.14",
  },
  {
    file: "/showcase/bilingual-tile.jpg",
    title: "Bilingual promo tile",
    note: "EN/FR from one brief — routed to the pro tier because type is where image models fail.",
    model: "Seedream v4",
    cost: "$0.06",
  },
];

/**
 * One box for every tile, whatever the source aspect.
 *
 * Mixed 9:16 and 1:1 tiles in a four-column row produced a ragged strip half
 * a screen tall — the vertical ads towered over the packshots and pushed the
 * writing off the page. Uniform 4:5 with a centre crop keeps the row scannable
 * and above the fold; the full aspect of any piece is one click away in the
 * studio, which is where someone judging composition will end up anyway.
 */
export const TILE_BOX = "aspect-[4/5]";

export const isMotion = (file: string) => file.toLowerCase().endsWith(".mp4");
