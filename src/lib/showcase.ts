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
 * Files come from one of three places, resolved on the server: an env
 * override (`SHOWCASE_REVERSE_REWIND=https://…`), an absolute URL written into
 * the manifest, or a file committed under `public/showcase/`. Anything that
 * resolves to nothing is dropped rather than rendered broken, so the strip
 * only ever shows work that exists — see `public/showcase/README.md`.
 */

export type ShowcaseItem = {
  /** Stable id, and the key for the env override. */
  id: string;
  /**
   * A path under `/public` or an absolute `https://` URL. `.mp4` renders as
   * looping motion, everything else as a still.
   *
   * The hosted form keeps multi-megabyte video out of git, which matters more
   * here than anywhere else on the site: these load before the rest of the
   * page, so they will be replaced and re-exported more than once.
   */
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
  /** Where the tile leads, when there is a case study behind it. */
  href?: string;
};

/**
 * Fill these in as you export renders. Names are suggestions, not fixtures —
 * change them freely; only `file` has to match what is on disk.
 */
export const SHOWCASE: ShowcaseItem[] = [
  {
    /*
     * A clay control pass, not a generated frame — which is why the strip no
     * longer claims everything in it came out of the pipeline. It earns the
     * lead position because it is the piece with a case study behind it, and
     * because "here is the geometry I built so the model could not improvise"
     * is a harder thing to claim than a nice render.
     */
    id: "the-wall",
    file: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/01_clay_1A.mp4",
    poster: "/the-wall/f288.jpg",
    title: "The Wall",
    note: "A clay control pass: 12s of untextured geometry that settles every camera decision before a credit is spent.",
    model: "Blender → Seedance 2.5",
    cost: "0 credits",
    href: "/ai-studio/blender/the-wall",
  },
  {
    id: "reverse-rewind",
    file: "/showcase/reverse-rewind.mp4",
    poster: "/showcase/reverse-rewind.jpg",
    title: "Reverse Rewind",
    note: "Assembly run backwards, product identity held across 14 seconds by reference-to-video.",
    model: "Seedance 2.5 Reference",
    cost: "$6.47",
  },
  {
    id: "anti-gravity",
    file: "/showcase/anti-gravity.mp4",
    poster: "/showcase/anti-gravity.jpg",
    title: "Anti-Gravity Assembly",
    note: "Weightless build, lit from a borrowed reference rather than a described one.",
    model: "Seedance 2.5 Reference",
    cost: "$3.70",
  },
  {
    id: "packshot-grid",
    file: "/showcase/packshot-grid.jpg",
    title: "Planogram angles",
    note: "Shot angles grounded, missing angles reconstructed and flagged for label QA.",
    model: "Nano Banana",
    cost: "$0.14",
  },
  {
    id: "bilingual-tile",
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

export const isMotion = (file: string) =>
  file.toLowerCase().split("?")[0].endsWith(".mp4");

/** Already reachable by a browser — nothing to look for on disk. */
export const isHosted = (url: string) => /^https:\/\//.test(url);

/**
 * Env override key for one item: SHOWCASE_REVERSE_REWIND, SHOWCASE_ANTI_GRAVITY…
 * Suffix `_POSTER` sets the poster frame for a motion item.
 */
export const showcaseEnvKey = (id: string, poster = false) =>
  `SHOWCASE_${id.toUpperCase().replace(/-/g, "_")}${poster ? "_POSTER" : ""}`;
