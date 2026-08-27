/**
 * The prompt reference library.
 *
 * These prompts are NOT mine and are not presented as mine. They come from
 * the GokuScraper Seedance 2 dataset, published under CC BY 4.0 — a licence
 * that permits reuse, including commercially, on the condition that credit
 * is given. So credit is given: the source, its licence and each record's
 * own id travel with the data rather than sitting in a footer.
 *
 * What IS mine is the filter. The dataset is thousands of prompts across
 * every subject a video model gets pointed at; almost none of it is retail.
 * The rubric below is the thing worth looking at: how a general corpus gets
 * narrowed to the few hundred entries that teach you something about
 * shooting a product.
 */

export type PromptCategory =
  | "packshot"
  | "macro-texture"
  | "motion-physics"
  | "set-lighting"
  | "food-craft"
  | "graphic-motion";

export const CATEGORIES: {
  id: PromptCategory;
  label: string;
  blurb: string;
}[] = [
  {
    id: "packshot",
    label: "Packshot & hero",
    blurb: "The product held still and shot properly — the shape most retail work actually needs.",
  },
  {
    id: "macro-texture",
    label: "Macro & texture",
    blurb: "Close enough that the surface is the subject. Where a model either knows the material or invents it.",
  },
  {
    id: "motion-physics",
    label: "Motion & physics",
    blurb: "Pours, splashes, falls, float. The prompts that describe how something behaves rather than how it looks.",
  },
  {
    id: "set-lighting",
    label: "Set & lighting",
    blurb: "Studio construction: seamless, gels, rim light, the vocabulary a photographer would use on the day.",
  },
  {
    id: "food-craft",
    label: "Food & craft",
    blurb: "Appetite work — steam, sear, crumb, gloss. The hardest thing to fake and the easiest to get wrong.",
  },
  {
    id: "graphic-motion",
    label: "Graphic & type",
    blurb: "Stop-motion, kinetic layout, on-screen text. Where the ad is a designed object, not a filmed one.",
  },
];

export type LibraryPrompt = {
  id: string;
  /** The dataset's own record id, so an entry can be traced back. */
  sourceId?: string;
  /** The dataset's own coarse label, kept beside my retail category. */
  sourceCategory?: string;
  text: string;
  category: PromptCategory;
  /** Rubric score that got it in, kept so the filter can be inspected. */
  score: number;
  /** Signals that fired, so a reader can see why it was selected. */
  signals: string[];
  /** Original creator handle where the dataset recorded one. */
  author?: string;
  /** Link back to the source item, where the dataset recorded one. */
  sourceUrl?: string;
  aspect?: string;
  durationSeconds?: number;
};

export type PromptLibrary = {
  prompts: LibraryPrompt[];
  /** Provenance, carried with the data rather than written into a page. */
  source: {
    name: string;
    url: string;
    licenseNote: string;
    /** How many rows the rubric started from. */
    consideredRows: number;
    ingestedAt: string;
  };
};

/**
 * The rubric, exported so the page can show it rather than assert it.
 *
 * Positive terms are weighted by how strongly they indicate commercial
 * product work. Negative terms knock out the bulk of the corpus — character
 * work, landscapes, anime — which is most of what a general video dataset
 * contains and none of what a retail studio needs.
 */
export const RUBRIC = {
  categories: {
    packshot: [
      "packshot", "product shot", "hero shot", "bottle", "can of", "jar",
      "packaging", "package", "label", "box of", "tube of", "carton",
      "cosmetic", "perfume", "skincare", "sneaker", "watch", "handbag",
      "on a pedestal", "turntable", "rotating product", "on white",
    ],
    "macro-texture": [
      "macro", "extreme close-up", "close-up of the surface", "texture",
      "droplet", "condensation", "grain", "fibre", "fiber", "powder",
      "crystal", "bubbles", "foam", "shallow depth of field",
    ],
    "motion-physics": [
      "slow motion", "slow-motion", "pour", "pouring", "splash", "falling",
      "levitat", "float", "spins", "rotates", "collides", "shatter",
      "ripple", "swirl", "cascade", "bounce", "physics",
    ],
    "set-lighting": [
      "studio lighting", "softbox", "rim light", "backlit", "seamless",
      "cyclorama", "gel", "key light", "gradient background", "spotlight",
      "volumetric", "caustics", "reflection on", "glossy surface",
    ],
    "food-craft": [
      "steam rising", "sizzl", "melting", "drizzl", "crumb", "sear",
      "garnish", "plated", "coffee", "chocolate", "ice cream", "juice",
      "cocktail", "batter", "dough", "glaze",
    ],
    "graphic-motion": [
      "stop motion", "stop-motion", "kinetic typography", "text animates",
      "typography", "flat lay", "flat-lay", "grid of", "graphic",
      "on-screen text", "title card", "isometric",
    ],
  } satisfies Record<PromptCategory, string[]>,

  /** Generic commercial signals — weak on their own, useful as tie-breakers. */
  commercial: [
    "commercial", "advertisement", "advertising", "brand", "campaign",
    "premium", "luxury", "minimalist", "clean background", "product",
  ],

  /** Subjects a retail content studio has no use for. */
  exclude: [
    "anime", "manga", "cartoon character", "video game", "gameplay",
    "portrait of a woman", "portrait of a man", "young woman", "young man",
    "beautiful girl", "handsome", "nsfw", "nude", "bikini", "lingerie",
    "war", "weapon", "gun", "blood", "gore", "zombie", "monster",
    "dragon", "spaceship", "alien", "cyberpunk city", "samurai",
    "landscape", "mountain range", "forest", "ocean waves", "sunset over",
    "cityscape", "street scene", "crowd", "dancing", "vlog", "selfie",
    "celebrity", "politician", "president",
  ],
} as const;

/** Minimum score to make the cut. Tuned so the set stays genuinely on-brief. */
export const MIN_SCORE = 3;
export const MAX_PROMPTS = 500;
/** Below this a "prompt" is a fragment, above it it is usually a transcript. */
export const LENGTH_BOUNDS = { min: 80, max: 1800 } as const;

export const getCategory = (id: string) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
