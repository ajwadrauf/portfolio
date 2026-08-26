/**
 * Mini product ad presets — structured, deconstructed video prompt recipes.
 *
 * Each preset is a reusable creative system, not a one-off prompt: core
 * aesthetics, a beat-by-beat action sequence, a text-overlay spec and an
 * audio design, with product parameters swappable per SKU. This is the
 * "prompt approaches that scale beyond one person" artifact in practice —
 * the concept is designed once, then any product runs through it.
 */

export type AdField = {
  key: string;
  label: string;
  placeholder: string;
  /** Example value used by the "Load example" button. */
  example: string;
  /**
   * Instruction for the vision autofill: how to derive this field from the
   * uploaded product photo. Fields the model must not invent (like price)
   * say so here explicitly.
   */
  autofill: string;
};

export type AdPreset = {
  id: string;
  name: string;
  hook: string;
  aspect: "9:16" | "16:9";
  durationSeconds: number;
  aesthetics: string[];
  scenes: { title: string; description: string }[];
  overlay: string;
  /** Sound design the VIDEO model renders — effects and ambience, never music. */
  sfx: string[];
  /** Default music-bed style id (see lib/music.ts) for the separate score layer. */
  musicStyleId: string;
  /**
   * True when the concept's action is cut to a musical pulse. A blindly
   * composed bed will visibly drift against these, so they need a manual
   * alignment pass in the edit.
   */
  beatSensitive?: boolean;
  /**
   * The model this concept was designed for. Selecting the preset switches
   * to it — some concepts only hold together on reference-to-video.
   */
  preferredModelId?: string;
  /**
   * Step-by-step guide to the references this concept wants, in the order
   * they should be uploaded. Shown in the UI as a recipe so the concept
   * arrives with instructions, not just an idea.
   */
  referenceRecipe?: RecipeStep[];
  fields: AdField[];
  /**
   * Deterministic template — the baseline prompt before AI composition.
   * `musicBrief` is the chosen music style's description (empty for none); in
   * native mode it goes into the video prompt, in layered mode it is scored
   * separately and the video prompt is told to stay silent.
   */
  template: (
    p: Record<string, string>,
    audioMode: AudioMode,
    musicBrief: string,
  ) => string;
};

/**
 * native  — let the video model handle all audio, music included (weaker music).
 * layered — video model renders SFX only; a music model scores it separately.
 */
export type AudioMode = "native" | "layered";

/** One instruction in a preset's reference recipe. */
export type RecipeStep = {
  media: "image" | "video";
  role: string;
  /** What to upload. */
  what: string;
  /** Why it earns its slot — the teaching half. */
  why: string;
  optional?: boolean;
};

/**
 * The recipe every product concept benefits from, before preset-specific
 * additions. Written as instructions a colleague can follow without having
 * built the pipeline.
 */
export const BASE_RECIPE: RecipeStep[] = [
  {
    media: "image",
    role: "product",
    what: "Your product photo, shot straight-on with the label readable.",
    why: "Becomes [Image1] and anchors identity. Everything else is judged against it.",
  },
  {
    media: "image",
    role: "product",
    what: "A second angle of the same product — three-quarter or side.",
    why: "Two angles give the model geometry to hold onto. This is the single biggest reduction in drift.",
  },
  {
    media: "video",
    role: "motion",
    what: "A 3-5 second clip whose camera move you want imitated.",
    why: "Camera language is far easier to show than to describe. Trim tight — the model reads the move, not the content.",
    optional: true,
  },
];

/**
 * Builds the trailing Audio: cue.
 *
 * layered — the bed is composed by a music model, so the video model must
 *           render effects only or the two layers fight.
 * native  — the video model is asked to carry the music too, using the same
 *           musical brief (genre, tempo, instrumentation) the music model
 *           would have received.
 */
export function audioCue(
  sfx: string[],
  audioMode: AudioMode,
  musicBrief: string,
): string {
  const effects = sfx.join(" ");
  if (audioMode === "layered") {
    return `Audio: ${effects} Sound effects and ambience only — no music, no musical score, no soundtrack.`;
  }
  return musicBrief.trim()
    ? `Audio: ${effects} Underscored throughout by music: ${musicBrief.trim()}`
    : `Audio: ${effects} No music — sound effects only.`;
}

const COMMON_FIELDS: AdField[] = [
  {
    key: "brand", label: "Brand name", placeholder: "KOLDA", example: "KOLDA",
    autofill: "Read the brand name exactly as printed on the packaging. Return an empty string if no brand is legible — do not guess.",
  },
  {
    key: "tagline", label: "Tagline", placeholder: "Simple. Done right.", example: "Dark roast. Zero drama.",
    autofill: "Write one punchy retail tagline for this exact product, maximum 6 words, matching the tone the packaging projects (premium, playful, no-nonsense...).",
  },
  {
    key: "price", label: "Price", placeholder: "$3.99", example: "$9.99",
    autofill: "Only a price that is actually printed and legible on the packaging, formatted like \"$3.99\". Return an empty string otherwise — NEVER invent a price; a wrong price in an ad is a compliance failure.",
  },
];

const BG_AUTOFILL =
  "Choose ONE bold, saturated background color that complements the packaging's palette and makes the product pop (e.g. a coffee bag in kraft brown suits ultra-bright yellow or teal). Name the color vividly.";

export const AD_PRESETS: AdPreset[] = [
  {
    id: "reverse-rewind",
    name: "Reverse Rewind",
    hook: "Start with the finished dish, deconstruct it backwards into the package. Ends on a price ding.",
    aspect: "9:16",
    durationSeconds: 8,
    aesthetics: [
      "Top-down, overhead flat-lay. Static camera — zero panning or zooming.",
      "Snappy, high-contrast stop-motion aesthetic.",
      "Monochromatic ultra-bright single-color background; minimalist environment.",
      "Reverse-chronological timeline: finished product back to original packaging.",
    ],
    scenes: [
      { title: "The finished product", description: "Fully prepared, plated item centered on the colored background." },
      { title: "The removal", description: "A human hand enters frame and pulls the plated item away." },
      { title: "Deconstruction — toppings", description: "A utensil scoops the topping off in fluid, reverse-gravity motion." },
      { title: "Deconstruction — base", description: "A second utensil lifts the base food upward and out of frame." },
      { title: "Raw transformation", description: "Cooked product snaps to raw state, flying backward out of the cooking vessel and sliding into its branded packaging." },
      { title: "The product shot", description: "A hand places the raw, packaged product flat against the background." },
      { title: "Text overlay", description: "Bold stark text snaps on: brand top-left, tagline middle-left, price bottom-right." },
    ],
    overlay: "Brand name top-left, tagline middle-left, price bottom-right — bold, stark, snapping on in sync with the final audio cue.",
    sfx: [
      "Rewind / reverse-playback whoosh distortion matching the reverse visuals.",
      "Utensil clinks and soft food movement, played backwards.",
      "Crisp cash-register ding synced to the price text appearing.",
    ],
    musicStyleId: "playful-indie",
    referenceRecipe: [
      ...BASE_RECIPE,
      {
        media: "image",
        role: "product",
        what: "A photo of the product's prepared form, if you have one.",
        why: "This concept ends on the raw pack but opens on the finished dish — showing both halves stops the model inventing the food.",
        optional: true,
      },
    ],
    fields: [
      {
        key: "product", label: "Product (raw, packaged)", placeholder: "a bag of spaghetti", example: "a bag of dried spaghetti in simple packaging",
        autofill: "Describe the packaged product exactly as photographed — packaging type, contents, dominant colors, finish.",
      },
      {
        key: "plated", label: "Finished form (plated)", placeholder: "a white bowl of spaghetti with red sauce", example: "a white bowl of spaghetti topped with rich red tomato sauce",
        autofill: "Describe the most appetizing prepared, plated or served form of this product — the finished result a shopper imagines (for coffee: a steaming mug; for pasta: a sauced bowl).",
      },
      {
        key: "vessel", label: "Cooking vessel", placeholder: "a pot on a stove", example: "a yellow pot on a yellow stove",
        autofill: "Name the vessel or appliance used to prepare this product (pot, kettle, French press, pan...), colored to match the background color you chose.",
      },
      { key: "bg", label: "Background color", placeholder: "ultra-bright yellow", example: "ultra-bright yellow", autofill: BG_AUTOFILL },
      ...COMMON_FIELDS,
    ],
    template: (p, mode, musicBrief) =>
      `Top-down overhead flat-lay on a ${p.bg} monochromatic background, static camera, snappy high-contrast stop-motion aesthetic. Reverse-chronological sequence: it opens on ${p.plated} centered in frame; a human hand pulls the plate away; a ladle scoops the topping off in fluid reverse-gravity motion; tongs lift the cooked base up and out of frame; the food abruptly transforms to its raw state, flying backward out of ${p.vessel} and sliding into ${p.product}; a hand places the packaged product flat on the background. Bold stark text snaps on at the end: "${p.brand}" top-left, "${p.tagline}" middle-left, "${p.price}" bottom-right. ${audioCue(["Rewind reverse-playback whoosh throughout, backwards utensil clinks and food movement, and a crisp cash-register ding synced to the price appearing."], mode, musicBrief)}`,
  },
  {
    id: "anti-gravity",
    name: "Anti-Gravity Assembly",
    hook: "Raw ingredients float up and assemble mid-air into the finished product. Ends on a clean hero.",
    aspect: "9:16",
    durationSeconds: 8,
    aesthetics: [
      "Eye-level macro studio shot, slow subtle push-in only.",
      "Soft dimensional lighting on a single saturated background color.",
      "Ingredients levitate with weightless, choreographed motion.",
      "Ends as a poised hero shot with text lockup.",
    ],
    scenes: [
      { title: "The lift", description: "Raw ingredients rise from the bottom of frame, rotating slowly, weightless." },
      { title: "The orbit", description: "Ingredients orbit a central point, arranging themselves in sequence." },
      { title: "The assembly", description: "They converge and snap together into the finished product mid-air." },
      { title: "The landing", description: "The finished product settles gently onto a clean surface, one soft bounce." },
      { title: "Text overlay", description: "Brand and tagline fade in beside the product; price stamps bottom-right." },
    ],
    overlay: "Brand and tagline beside the product, price stamping bottom-right on the final beat.",
    sfx: [
      "Soft airy whoosh accents as each ingredient floats and orbits.",
      "One satisfying mechanical click at the moment of assembly.",
      "Warm pop synced to the price stamp.",
    ],
    musicStyleId: "premium-cinematic",
    referenceRecipe: [
      ...BASE_RECIPE,
      {
        media: "image",
        role: "style",
        what: "A lighting reference — any image with the glow you want.",
        why: "Weightless assembly lives or dies on light. Borrowing a lighting mood is faster than describing one.",
        optional: true,
      },
    ],
    fields: [
      {
        key: "ingredients", label: "Ingredients (floating)", placeholder: "coffee beans, a cinnamon stick...", example: "glossy roasted coffee beans and a curl of steam",
        autofill: "Name 2-3 visually striking raw ingredients or components of this product that would look beautiful levitating (beans, grains, droplets, a curl of steam...).",
      },
      {
        key: "product", label: "Finished product", placeholder: "a bag of coffee", example: "a kraft bag of dark roast whole-bean coffee",
        autofill: "Describe the finished packaged product exactly as photographed — packaging type, colors, finish.",
      },
      { key: "bg", label: "Background color", placeholder: "deep forest green", example: "deep forest green", autofill: BG_AUTOFILL },
      ...COMMON_FIELDS,
    ],
    template: (p, mode, musicBrief) =>
      `Eye-level macro studio shot on a ${p.bg} seamless background, soft dimensional lighting, slow subtle push-in. ${p.ingredients} rise weightlessly from the bottom of frame, rotating slowly, then orbit a central point and converge, snapping together mid-air into ${p.product}. The finished product settles gently onto a clean surface with one soft bounce and poses as a hero shot. Text fades in beside it: "${p.brand}" with the tagline "${p.tagline}", and "${p.price}" stamps bottom-right on the final beat. ${audioCue(["Soft airy whooshes with the floating motion, a satisfying click at assembly, and a warm pop synced to the price stamp."], mode, musicBrief)}`,
  },
  {
    id: "macro-loop",
    name: "Satisfying Macro Loop",
    hook: "One extreme close-up, one hypnotic action, engineered to loop seamlessly on social.",
    aspect: "9:16",
    durationSeconds: 6,
    aesthetics: [
      "Extreme macro close-up; the texture IS the star.",
      "One continuous, hypnotic action (pour, crack, steam, drizzle).",
      "Rich natural lighting; shallow depth of field.",
      "First and last frames match for a seamless loop.",
    ],
    scenes: [
      { title: "The texture", description: "Extreme close-up of the product surface, light raking across it." },
      { title: "The action", description: "The single satisfying action unfolds in slow motion." },
      { title: "The loop point", description: "The action resolves back to the opening framing so the clip loops invisibly." },
    ],
    overlay: "Minimal: a small brand watermark bottom corner only — the texture carries the ad.",
    sfx: [
      "ASMR-forward: the action's real sound, close-mic'd, crisp and intimate.",
      "Nothing else in the mix — the texture carries it.",
    ],
    musicStyleId: "minimal-ambient",
    referenceRecipe: [
      BASE_RECIPE[0],
      {
        media: "image",
        role: "product",
        what: "A macro close-up of the product's surface or contents.",
        why: "The whole concept is texture. A macro reference tells the model what the surface actually looks like at that distance.",
      },
      {
        media: "video",
        role: "motion",
        what: "A clip of the satisfying action you want echoed.",
        why: "Pours, cracks and blooms are motion, not description. Three seconds is plenty.",
        optional: true,
      },
    ],
    fields: [
      {
        key: "product", label: "Product surface", placeholder: "sparkling water over ice", example: "sparkling water cascading over clear ice cubes",
        autofill: "Describe this product's most texturally rich surface or contents at extreme close-up (crema, condensation, crumb, grain, fizz...).",
      },
      {
        key: "action", label: "The satisfying action", placeholder: "a slow pour with rising bubbles", example: "a slow pour, bubbles racing to the surface in slow motion",
        autofill: "Describe ONE hypnotic, satisfying macro action true to this product — a pour, crack, drizzle, bloom, fizz or steam — worth watching on loop.",
      },
      ...COMMON_FIELDS.filter((f) => f.key === "brand"),
    ],
    template: (p, mode, musicBrief) =>
      `Extreme macro close-up, shallow depth of field, rich natural lighting raking across the surface. ${p.product}: ${p.action}, unfolding in luxurious slow motion. The action resolves back to the exact opening framing so the clip loops seamlessly. A small "${p.brand}" watermark sits in the bottom corner; no other text. ${audioCue(["ASMR-forward — the real sound of the action, close-mic'd, crisp and intimate."], mode, musicBrief)}`,
  },
  {
    id: "ordered-array",
    name: "Ordered Array",
    hook: "Product and its raw ingredient in precise geometric arrays, cut to the beat, ending on a slow-motion payoff.",
    aspect: "16:9",
    durationSeconds: 15,
    preferredModelId: "seedance-2.5-ref",
    aesthetics: [
      "Bright, colourful commercial style on one saturated background.",
      "Highly ordered geometric arrays — everything gridded, aligned, deliberate.",
      "Clean and premium, but rhythmically driven: cuts land on the beat.",
      "Ends on a slow-motion sensory climax, not a product card.",
    ],
    scenes: [
      { title: "Visual focus", description: "Opens tight on the raw ingredient, music dropping on the downbeat." },
      { title: "The array", description: "Product and ingredient arrange into a precise geometric grid, top-down." },
      { title: "Formations", description: "Variants line up in neat formations, cutting to close-ups on each." },
      { title: "The climax", description: "The sensory payoff hits and instantly enters slow motion." },
      { title: "Text overlay", description: "Bold stark text snaps on over the settled frame." },
    ],
    overlay: "Brand top-left, tagline middle-left, price bottom-right — snapping on with the final beat.",
    sfx: [
      "Crisp granular sounds of the raw ingredient moving and settling.",
      "Tight mechanical snaps as each formation locks into place.",
      "A deep slow-motion whoosh at the climax, then a clean stamp on the price.",
    ],
    musicStyleId: "punchy-electronic",
    beatSensitive: true,
    referenceRecipe: [
      ...BASE_RECIPE,
      {
        media: "video",
        role: "composition",
        what: "A clip or still with the gridded, top-down look you want.",
        why: "This concept lives on precise arrangement. Showing the model an array beats describing one.",
      },
      {
        media: "video",
        role: "rhythm",
        what: "A short clip whose cut timing you want matched.",
        why: "Becomes [Video2]. The cuts key off its beats, which is what makes the array feel choreographed rather than assembled.",
        optional: true,
      },
      {
        media: "image",
        role: "style",
        what: "A palette reference — any image with the colour mood you want.",
        why: "Borrows colour and lighting only, never subject matter. Useful when the packaging alone is too plain to set a mood.",
        optional: true,
      },
    ],
    fields: [
      {
        key: "product", label: "Product (packaged)", placeholder: "a bag of whole bean coffee", example: "a bright yellow bag of No Frills whole bean dark roast coffee",
        autofill: "Describe the packaged product exactly as photographed — packaging type, dominant colours, finish.",
      },
      {
        key: "variants", label: "Variants to array", placeholder: "three roasts: dark, medium, decaf", example: "three roasts: dark, medium and decaf",
        autofill: "Name 3-4 variants of this product that would read as a set (flavours, roasts, sizes). Infer plausible ones from the category if the photo shows only one.",
      },
      {
        key: "rawElement", label: "Raw ingredient", placeholder: "glossy roasted coffee beans", example: "glossy roasted coffee beans",
        autofill: "Name the raw ingredient or contents that pairs with this product and looks good arrayed in bulk (beans, grains, leaves, nuts).",
      },
      {
        key: "climax", label: "Slow-motion climax", placeholder: "a scoop lifts and beans cascade back", example: "a metal scoop plunges into a mound of beans and lifts, beans cascading back in a arc",
        autofill: "Describe ONE tactile, sensory action with this product worth seeing in slow motion — a pour, a cascade, a crack, a bloom of steam.",
      },
      { key: "bg", label: "Background colour", placeholder: "ultra-bright yellow", example: "ultra-bright yellow", autofill: BG_AUTOFILL },
      ...COMMON_FIELDS,
    ],
    template: (p, mode, musicBrief) =>
      `Bright, colourful commercial style on a ${p.bg} background — ${p.product} as the star, featuring ${p.variants}. ${p.rawElement} and their corresponding packs are arranged in highly ordered geometric arrays; the overall frame is clean, premium and rhythmically driven. The opening establishes visual focus tight on ${p.rawElement}, with the music dropping on the downbeat. The variants then line up in neat formations, cutting to close-ups on each in turn. At the climax ${p.climax} — instantly entering slow motion, every grain and highlight readable, before the frame settles back into its grid. Bold stark text snaps on at the end: "${p.brand}" top-left, "${p.tagline}" middle-left, "${p.price}" bottom-right. ${audioCue(["Crisp granular sounds of the ingredient moving and settling, tight mechanical snaps as each formation locks into place, a deep slow-motion whoosh at the climax and a clean stamp on the price."], mode, musicBrief)}`,
  },
  {
    id: "multiply-grid",
    name: "Stop-Motion Multiply",
    hook: "One product becomes many — duplicating in rhythm until it fills a perfect grid. Price lands center.",
    aspect: "9:16",
    durationSeconds: 8,
    aesthetics: [
      "Top-down flat-lay, static camera, punchy stop-motion rhythm.",
      "Bold single-color background; hard graphic shadows.",
      "The product duplicates on musical beats — 1, 2, 4, 8 — into a tidy grid.",
      "Ends as a poster-like frame with the price dead center.",
    ],
    scenes: [
      { title: "The one", description: "A single product lands in the center of the colored background with a thud." },
      { title: "The multiply", description: "On each beat, the products double, snapping into place around the original." },
      { title: "The grid", description: "The full grid locks into perfect alignment, filling the frame edge to edge." },
      { title: "The price", description: "Everything scales down slightly and the price stamps into the center gap." },
    ],
    overlay: "Brand name small at top; the price is the hero, stamping dead-center on the final beat.",
    sfx: [
      "Snappy stop-motion foley for each product landing.",
      "Rhythmic thuds as the grid multiplies.",
      "Big final stamp sound with the price.",
    ],
    musicStyleId: "punchy-electronic",
    beatSensitive: true,
    referenceRecipe: [
      ...BASE_RECIPE,
      {
        media: "video",
        role: "rhythm",
        what: "A clip whose cut timing you want the duplications to match.",
        why: "This concept multiplies on the beat. Without a rhythm reference the grid fills at the model's tempo, not yours.",
      },
    ],
    fields: [
      {
        key: "product", label: "Product", placeholder: "a can of sparkling water", example: "a teal can of sparkling water",
        autofill: "Describe the packaged product exactly as photographed, compactly — it must read clearly as one repeated unit in a grid.",
      },
      { key: "bg", label: "Background color", placeholder: "hot coral", example: "hot coral", autofill: BG_AUTOFILL },
      ...COMMON_FIELDS,
    ],
    template: (p, mode, musicBrief) =>
      `Top-down flat-lay on a ${p.bg} seamless background, static camera, punchy stop-motion rhythm with hard graphic shadows. ${p.product} lands center-frame with a thud; on each beat it duplicates — one, two, four, eight — snapping into a perfect tidy grid that fills the frame edge to edge. The grid scales down slightly and "${p.price}" stamps dead-center on the final beat, with "${p.brand}" small at the top and the tagline "${p.tagline}" beneath it. ${audioCue(["Snappy stop-motion foley on every product landing, rhythmic thuds as the grid multiplies, and a big stamp sound with the price."], mode, musicBrief)}`,
  },
];

export const getAdPreset = (id: string): AdPreset => {
  const p = AD_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown ad preset: ${id}`);
  return p;
};

export const AD_VIDEO_MODELS = [
  "veo-3.1-fast",
  "veo-3.1",
  "seedance-2.5-ref",
  "seedance-2.5",
  "runway-gen4",
  "kling-3.0",
];

/** Models whose endpoint accepts multiple positional references ([Image1]...). */
export const MULTI_REF_MODELS = ["seedance-2.5-ref"];

/**
 * What a reference is FOR. Reference-to-video models don't just want more
 * inputs — each reference is assigned a job in the prompt, which is how the
 * model knows to copy the product's identity from one and only the palette
 * from another.
 *
 * `media` says which kinds suit that job: a camera move reads far better
 * from a clip than from a still.
 */
export const REFERENCE_ROLES = [
  {
    id: "product",
    label: "Product identity",
    hint: "The packaging must stay exactly this. Add several angles for a tighter lock.",
    instruction: "the exact appearance, packaging, proportions and label of the product",
    media: ["image"],
  },
  {
    id: "style",
    label: "Style / palette",
    hint: "Colour, lighting and mood to borrow — not the subject.",
    instruction: "the colour palette, lighting and overall mood only — not its subject matter",
    media: ["image", "video"],
  },
  {
    id: "composition",
    label: "Composition",
    hint: "Framing and layout to echo.",
    instruction: "the framing, layout and staging of the shot",
    media: ["image", "video"],
  },
  {
    id: "motion",
    label: "Motion / camera",
    hint: "The camera move and pacing to imitate — best read from a clip.",
    instruction: "the camera movement, pacing and shot dynamics",
    media: ["video", "image"],
  },
  {
    id: "rhythm",
    label: "Edit rhythm",
    hint: "Cut timing to match. Video only.",
    instruction: "the edit rhythm and cut timing — match the action to its beats",
    media: ["video"],
  },
] as const;

export type ReferenceRole = (typeof REFERENCE_ROLES)[number]["id"];
export type ReferenceMedia = "image" | "video";
export type ReferenceSpec = { role: ReferenceRole; media: ReferenceMedia };

export const getReferenceRole = (id: string) =>
  REFERENCE_ROLES.find((r) => r.id === id) ?? REFERENCE_ROLES[0];

/**
 * Builds the reference-addressing block appended to the prompt.
 *
 * References are positional and numbered PER MEDIA TYPE — the first image is
 * [Image1] and the first clip is [Video1], independent of upload order —
 * which is how these models resolve them.
 */
export function referenceBlock(refs: ReferenceSpec[]): string {
  if (refs.length === 0) return "";
  let images = 0;
  let videos = 0;
  const lines: string[] = [];
  let productToken: string | null = null;

  for (const r of refs) {
    const token = r.media === "video" ? `[Video${++videos}]` : `[Image${++images}]`;
    if (r.role === "product" && !productToken) productToken = token;
    lines.push(`${token} is the reference for ${getReferenceRole(r.role).instruction}.`);
  }

  const lock = productToken
    ? ` Hold the product in ${productToken} pixel-consistent throughout: same packaging, same label text, same proportions, no drift, no re-imagining, even as the camera moves.`
    : "";
  return ` Reference usage — ${lines.join(" ")}${lock}`;
}

/** Per-model duration ceiling (seconds). Seedance 2.5 does native 30s takes. */
export function maxAdSeconds(modelId: string): number {
  return modelId.startsWith("seedance-2.5") ? 30 : 10;
}

export const AD_NEGATIVE_PROMPT =
  "blurry, warped product, deformed packaging, illegible text, watermark artifacts, camera shake, extra hands, morphing errors";
