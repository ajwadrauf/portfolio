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
  audio: string[];
  fields: AdField[];
  /** Deterministic template — the baseline prompt before AI composition. */
  template: (p: Record<string, string>) => string;
};

const COMMON_FIELDS: AdField[] = [
  { key: "brand", label: "Brand name", placeholder: "KOLDA", example: "KOLDA" },
  { key: "tagline", label: "Tagline", placeholder: "Simple. Done right.", example: "Dark roast. Zero drama." },
  { key: "price", label: "Price", placeholder: "$3.99", example: "$9.99" },
];

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
    audio: [
      "Quirky, upbeat, staccato synth track.",
      "Rewind / reverse-playback distortion matching the reverse visuals.",
      "Crisp cash-register ding synced to the price text appearing.",
    ],
    fields: [
      { key: "product", label: "Product (raw, packaged)", placeholder: "a bag of spaghetti", example: "a bag of dried spaghetti in simple packaging" },
      { key: "plated", label: "Finished form (plated)", placeholder: "a white bowl of spaghetti with red sauce", example: "a white bowl of spaghetti topped with rich red tomato sauce" },
      { key: "vessel", label: "Cooking vessel", placeholder: "a pot on a stove", example: "a yellow pot on a yellow stove" },
      { key: "bg", label: "Background color", placeholder: "ultra-bright yellow", example: "ultra-bright yellow" },
      ...COMMON_FIELDS,
    ],
    template: (p) =>
      `Top-down overhead flat-lay on a ${p.bg} monochromatic background, static camera, snappy high-contrast stop-motion aesthetic. Reverse-chronological sequence: it opens on ${p.plated} centered in frame; a human hand pulls the plate away; a ladle scoops the topping off in fluid reverse-gravity motion; tongs lift the cooked base up and out of frame; the food abruptly transforms to its raw state, flying backward out of ${p.vessel} and sliding into ${p.product}; a hand places the packaged product flat on the background. Bold stark text snaps on at the end: "${p.brand}" top-left, "${p.tagline}" middle-left, "${p.price}" bottom-right. Audio: quirky upbeat staccato synth with a rewind reverse-playback distortion throughout, ending on a crisp cash-register ding synced to the price appearing.`,
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
    audio: [
      "Airy, minimal electronic track with rising anticipation.",
      "Soft whoosh accents as ingredients move; one satisfying click at assembly.",
      "Warm pop on the price stamp.",
    ],
    fields: [
      { key: "ingredients", label: "Ingredients (floating)", placeholder: "coffee beans, a cinnamon stick...", example: "glossy roasted coffee beans and a curl of steam" },
      { key: "product", label: "Finished product", placeholder: "a bag of coffee", example: "a kraft bag of dark roast whole-bean coffee" },
      { key: "bg", label: "Background color", placeholder: "deep forest green", example: "deep forest green" },
      ...COMMON_FIELDS,
    ],
    template: (p) =>
      `Eye-level macro studio shot on a ${p.bg} seamless background, soft dimensional lighting, slow subtle push-in. ${p.ingredients} rise weightlessly from the bottom of frame, rotating slowly, then orbit a central point and converge, snapping together mid-air into ${p.product}. The finished product settles gently onto a clean surface with one soft bounce and poses as a hero shot. Text fades in beside it: "${p.brand}" with the tagline "${p.tagline}", and "${p.price}" stamps bottom-right on the final beat. Audio: airy minimal electronic track building anticipation, soft whooshes with the floating motion, a satisfying click at assembly, and a warm pop synced to the price stamp.`,
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
    audio: [
      "ASMR-forward: the action's real sound, close-mic'd and crisp.",
      "No music, or a barely-there ambient pad.",
    ],
    fields: [
      { key: "product", label: "Product surface", placeholder: "sparkling water over ice", example: "sparkling water cascading over clear ice cubes" },
      { key: "action", label: "The satisfying action", placeholder: "a slow pour with rising bubbles", example: "a slow pour, bubbles racing to the surface in slow motion" },
      ...COMMON_FIELDS.filter((f) => f.key === "brand"),
    ],
    template: (p) =>
      `Extreme macro close-up, shallow depth of field, rich natural lighting raking across the surface. ${p.product}: ${p.action}, unfolding in luxurious slow motion. The action resolves back to the exact opening framing so the clip loops seamlessly. A small "${p.brand}" watermark sits in the bottom corner; no other text. Audio: ASMR-forward — the real sound of the action, close-mic'd, crisp and intimate, with no music.`,
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
    audio: [
      "Percussive, beat-driven track — every duplication lands on a hit.",
      "Snappy stop-motion foley for each product landing.",
      "Big final stamp sound with the price.",
    ],
    fields: [
      { key: "product", label: "Product", placeholder: "a can of sparkling water", example: "a teal can of sparkling water" },
      { key: "bg", label: "Background color", placeholder: "hot coral", example: "hot coral" },
      ...COMMON_FIELDS,
    ],
    template: (p) =>
      `Top-down flat-lay on a ${p.bg} seamless background, static camera, punchy stop-motion rhythm with hard graphic shadows. ${p.product} lands center-frame with a thud; on each musical beat it duplicates — one, two, four, eight — snapping into a perfect tidy grid that fills the frame edge to edge. The grid scales down slightly and "${p.price}" stamps dead-center on the final beat, with "${p.brand}" small at the top and the tagline "${p.tagline}" beneath it. Audio: percussive beat-driven track where every duplication lands on a hit, snappy stop-motion foley per landing, and a big stamp sound with the price.`,
  },
];

export const getAdPreset = (id: string): AdPreset => {
  const p = AD_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown ad preset: ${id}`);
  return p;
};

export const AD_VIDEO_MODELS = ["veo-3.1-fast", "veo-3.1", "kling-3.0"];

export const AD_NEGATIVE_PROMPT =
  "blurry, warped product, deformed packaging, illegible text, watermark artifacts, camera shake, extra hands, morphing errors";
