import { seedanceCost, type VideoResolution } from "./videoCost";
/**
 * Central model registry — the single place where model IDs, endpoints and
 * pricing live. Every ID can be overridden with an environment variable so
 * the app can track the (fast-moving) model landscape without code changes.
 *
 * IMPORTANT before going live with real API keys:
 *   1. Verify Gemini model IDs at https://ai.google.dev/gemini-api/docs/models
 *   2. Verify fal endpoint slugs at https://fal.ai/models
 *   3. Update PRICING if list prices moved (they inform the pre-flight cost
 *      estimator — generation still works if they drift, you just see a
 *      slightly wrong estimate).
 */

export type Provider = "gemini" | "fal" | "recraft";

export type ModelInfo = {
  id: string; // registry key, stable within this app
  provider: Provider;
  /** Provider-side model ID / endpoint slug (env-overridable). */
  endpoint: string;
  label: string;
  kind: "image" | "video" | "music" | "sfx";
  /** USD. Images: per image. Video/music: per second. */
  unitCost: number;
  unit: "image" | "second";
  /**
   * Which field this fal endpoint uses to size its output.
   *
   * Defaults to `aspect_ratio`, which is what every image endpoint here used
   * until GPT Image 2. That one takes `image_size` instead, and fal validates
   * its input schema strictly — an undefined field is a 422 at submit time,
   * not a field quietly ignored. This session already paid to learn that on
   * the video side; the fix is to name the field per endpoint rather than
   * send both and hope.
   */
  sizeField?: "aspect_ratio" | "image_size";
  /**
   * USD per supplied reference image, for endpoints that bill reference input
   * on top of the output image.
   *
   * GPT Image 2's edit endpoint charges input image tokens at $0.008/1k and
   * bills every reference at high fidelity regardless of output quality. A
   * 1024x1024 reference is ~1.1k tokens, so ~$0.009 each — which on a
   * six-reference packshot is a third of the bill again, and invisible if the
   * estimate only ever counts output images.
   */
  refImageCost?: number;
  /**
   * How many reference images this endpoint actually accepts.
   *
   * These differ by an order of magnitude — 3 on Gemini Flash Image, 16 on GPT
   * Image 2 — and the studio was offering six slots to all of them. Over the
   * cap the provider drops the extras or rejects the call, and either way the
   * face you uploaded to ground an angle silently stops grounding it.
   */
  maxReferenceImages?: number;
  /** What this endpoint will render, for the size picker. */
  outputSizes?: OutputSizeSupport;
  /**
   * How to spend the reference slots this model gives you.
   *
   * The count alone is not advice. Sixteen slots on an endpoint that bills
   * each one, three on an endpoint that drops the fourth, and one on an
   * endpoint that restages rather than reads are three different jobs, and
   * knowing which you are doing is the difference between a usable set and a
   * set of plausible pictures. Shown next to the upload control, where the
   * decision is actually made.
   */
  referenceGuidance?: string;
  strengths: string;
  bestFor: string;
};

/**
 * How an endpoint is told what size to render, and what it will accept.
 *
 * Three genuinely different surfaces hide behind one "resolution" control:
 *
 * - `pixels`  — takes explicit width and height, within bounds.
 * - `tiers`   — takes named steps (1K/2K/4K, auto_2K) and nothing between.
 * - `aspect`  — takes a shape only. The pixel count is the endpoint's to
 *               choose, so a size control here would be decoration.
 *
 * The picker is built from this rather than from one global list, because a
 * 4K option that silently renders 1K is worse than no 4K option.
 */
export type SizeMode = "pixels" | "tiers" | "aspect";

export type OutputSizeSupport = {
  mode: SizeMode;
  /**
   * Named options, smallest first. Square, which is what a packshot is.
   *
   * `costMultiplier` is relative to the model's `unitCost`, which is quoted at
   * the preset that leaves it 1. Size moves the price on two of these models
   * and not at all on the rest, and a picker that showed one number for every
   * tier was quoting a 2048px GPT Image 2 render at a quarter of its price.
   */
  presets: { id: string; label: string; px: number; costMultiplier?: number; note?: string }[];
  /** Arbitrary square dimensions, for `pixels` endpoints that take them. */
  custom?: {
    min: number;
    max: number;
    multipleOf: number;
    /**
     * Price tracks pixel area rather than a tier.
     *
     * GPT Image 2 bills its output as image tokens, and three published sizes
     * — 1024x1024 at $0.133, 1024x1536 at $0.200, 1536x1024 at $0.199 — come
     * out at $0.127 per megapixel within half a percent of each other. So area
     * is the model, and `basePx` is the square size `unitCost` was quoted at.
     */
    costScalesWithArea?: boolean;
    basePx?: number;
  };
  /** One line naming the constraint, shown under the control. */
  note: string;
};

const env = (key: string, fallback: string) => process.env[key] ?? fallback;

export const MODELS: Record<string, ModelInfo> = {
  // ---------------- Stills ----------------
  "nano-banana-pro": {
    id: "nano-banana-pro",
    provider: "gemini",
    endpoint: env("GEMINI_IMAGE_PRO_MODEL", "gemini-3-pro-image-preview"),
    label: "Nano Banana Pro (Gemini 3 Pro Image)",
    kind: "image",
    unitCost: 0.134,
    unit: "image",
    strengths:
      "Reasoning-driven generation and editing, best-in-class text rendering (packaging, promo badges, EN/FR), strong brand consistency, up to 4K.",
    bestFor: "Promo tiles with live text, bilingual versioning, brand-critical hero shots.",
    maxReferenceImages: 14,
    referenceGuidance:
      "Give it every face you have — it reads all of them, and it holds label type better than anything else here. Front and back first, then the sides; each one you add is a face it no longer has to invent.",
    outputSizes: {
      mode: "tiers",
      presets: [
        { id: "1K", label: "1K — 1024²", px: 1024, costMultiplier: 1, note: "Web tiles and review rounds." },
        { id: "2K", label: "2K — 2048²", px: 2048, costMultiplier: 1.5, note: "The planogram default: enough for label type to survive a crop. Billed at 1.5x the 1K rate." },
        { id: "4K", label: "4K — 4096²", px: 4096, costMultiplier: 2, note: "Print and large in-store screens. Twice the 1K rate, and the slowest." },
      ],
      note: "Three named tiers, and the tier moves the price: 2K is 1.5x the 1K rate and 4K is 2x. Anything between them rounds to the nearest — there is no arbitrary pixel size here.",
    },
  },
  "nano-banana-flash": {
    id: "nano-banana-flash",
    provider: "gemini",
    endpoint: env("GEMINI_IMAGE_FAST_MODEL", "gemini-2.5-flash-image"),
    label: "Nano Banana (Gemini Flash Image)",
    kind: "image",
    unitCost: 0.039,
    unit: "image",
    strengths: "Fast and cheap generalist. The high-volume versioning workhorse.",
    bestFor: "Format adaptations, seasonal variants, bulk versioning at scale.",
    maxReferenceImages: 3,
    referenceGuidance:
      "Three is the hard limit and a fourth is dropped rather than blended, so spend them deliberately: the front, plus the two faces closest to the angles you actually need. For more than that, switch model.",
    outputSizes: {
      mode: "aspect",
      presets: [{ id: "1MP", label: "~1MP — 1024²", px: 1024 }],
      note: "Takes a shape, not a size: output is about one megapixel whatever you ask for. Also the tightest reference limit here at three images — a fourth face is dropped, not blended.",
    },
  },
  "flux-2-pro": {
    id: "flux-2-pro",
    provider: "fal",
    endpoint: env("FAL_FLUX_ENDPOINT", "fal-ai/flux-2-pro"),
    label: "Flux 2 Pro (Black Forest Labs)",
    kind: "image",
    unitCost: 0.05,
    unit: "image",
    strengths: "Best pure photorealism in market. Food and product photography excels here.",
    bestFor: "Photorealistic hero stills where the image is the product.",
  },
  "flux-kontext": {
    id: "flux-kontext",
    provider: "fal",
    endpoint: env("FAL_KONTEXT_ENDPOINT", "fal-ai/flux-pro/kontext/max/multi"),
    label: "Flux Kontext Max (BFL, via fal.ai)",
    kind: "image",
    unitCost: 0.08,
    unit: "image",
    strengths:
      "Instruction-based editing with strong subject identity preservation and multi-image input; superb surface texture.",
    bestFor: "Packshot challenger: identity-true edits where texture matters more than dense label text.",
    maxReferenceImages: 2,
    referenceGuidance:
      "Built to combine two images, so give it the front plus the single face nearest your target angle. Treat a third as unsupported rather than untested — and describe the pack in words, since it reads a description better than a crowd of references.",
    outputSizes: {
      mode: "aspect",
      presets: [{ id: "auto", label: "Endpoint default — ~1024²", px: 1024 }],
      note: "Aspect-ratio only; the endpoint picks the pixel count. Built around combining two images, so treat a third reference as unsupported rather than merely untested.",
    },
  },
  "seedream-4": {
    id: "seedream-4",
    provider: "fal",
    endpoint: env("FAL_SEEDREAM_ENDPOINT", "fal-ai/bytedance/seedream/v4/edit"),
    label: "Seedream 4.0 Edit (ByteDance, via fal.ai)",
    kind: "image",
    unitCost: 0.03,
    unit: "image",
    strengths:
      "Very strong subject-consistent editing at the lowest price in its class; multi-image input.",
    bestFor: "Packshot challenger: the value benchmark every bake-off should include.",
    maxReferenceImages: 10,
    referenceGuidance:
      "Ten available; front, back and one side is the practical sweet spot. Beyond that the returns flatten while the price does not move, so extra angles are free to add and rarely change the result.",
    outputSizes: {
      mode: "tiers",
      presets: [
        { id: "square_hd", label: "1K — 1024²", px: 1024 },
        { id: "auto_2K", label: "2K — 2048²", px: 2048, note: "Best value per pixel in the set." },
        { id: "auto_4K", label: "4K — 4096²", px: 4096 },
      ],
      note: "Named tiers up to 4K at one flat price — resolution does not move the bill here, which makes it the cheapest route to a 2K or 4K planogram angle by a wide margin.",
    },
  },
  "gpt-image-2-edit": {
    id: "gpt-image-2-edit",
    provider: "fal",
    // Namespaced under `openai/`, not `fal-ai/` — fal hosts this one as the
    // official partner API, and the fal-ai/ slug does not exist.
    endpoint: env("FAL_GPT_IMAGE_2_EDIT_ENDPOINT", "openai/gpt-image-2/edit"),
    label: "GPT Image 2 Edit (OpenAI, via fal.ai)",
    kind: "image",
    // High quality at 1024x1024, which is what a 1:1 packshot asks for.
    // Low is $0.009 and medium $0.034 at the same size; 4K high reaches $0.41.
    unitCost: 0.133,
    unit: "image",
    sizeField: "image_size",
    refImageCost: 0.009,
    strengths:
      "Instruction-following and text rendering at the top of the current field, with a mask input for constraining an edit to one region. Reads a reference set closely rather than paraphrasing it.",
    bestFor:
      "Packshot challenger where the label has to survive: the angle changes and the type on the pack stays readable and correct.",
    maxReferenceImages: 16,
    referenceGuidance:
      "Sixteen slots, but every one is billed as high-fidelity input — so add faces that show something new, not another crop of the same panel. It follows an instruction more literally than the others, which makes the written brief worth filling in properly.",
    outputSizes: {
      mode: "pixels",
      presets: [
        { id: "1024", label: "1024²", px: 1024, costMultiplier: 1, note: "The size the quoted rate is for." },
        { id: "1536", label: "1536²", px: 1536, costMultiplier: 2.25, note: "2.25x the area, and 2.25x the price." },
        { id: "2048", label: "2048²", px: 2048, costMultiplier: 4, note: "Four times the pixels of 1024², and four times the bill." },
      ],
      custom: { min: 512, max: 2048, multipleOf: 16, costScalesWithArea: true, basePx: 1024 },
      note: "The only model here that takes an arbitrary pixel size — both edges must divide by 16. It bills output as image tokens, so the price tracks area exactly: about $0.127 per megapixel, which makes a 2048² render four times the cost of a 1024² one.",
    },
  },

  "recraft-v4.1-utility-pro": {
    id: "recraft-v4.1-utility-pro",
    provider: "recraft",
    endpoint: env("RECRAFT_MODEL", "recraftv4_1_utility_pro"),
    label: "Recraft V4.1 Utility Pro",
    kind: "image",
    unitCost: 0.21,
    unit: "image",
    /*
     * One, and this is a property of the operation rather than a limit to work
     * around. Recraft's imageToImage takes a single `image_url` plus a prompt
     * and a strength; there is no multi-reference edit on this API. The
     * generations endpoint does take up to ten images, but as *style*
     * references — they carry look, not product identity, and they bill as a
     * separate style creation on top. Wrong tool for holding a label steady.
     */
    maxReferenceImages: 1,
    referenceGuidance:
      "One image, and it restages that photo rather than reading a set — so it cannot show a face your photo does not. Pick the reference closest to the angle you want, and lean on the written brief, which is carrying more weight here than on any other model.",
    outputSizes: {
      mode: "tiers",
      presets: [
        { id: "1024x1024", label: "1024²", px: 1024 },
        { id: "1:1", label: "Square, model native (2K)", px: 2048, note: "A ratio rather than a size — Recraft renders this model's native 2K." },
      ],
      note: "Size goes as WxH or w:h. The exact list of pixel sizes is published in Recraft's appendix and is worth checking before a batch; the ratio form is the safe one.",
    },
    strengths:
      "A utility-tier raster model built for product and catalogue work rather than illustration, at 2K, with background removal and crisp upscale available on the same API.",
    bestFor:
      "Restaging or cleaning a single pack photo. Not angle synthesis — that needs a model that reads several references at once.",
  },

  // ---------------- Video ----------------
  "veo-3.1-fast": {
    id: "veo-3.1-fast",
    provider: "gemini",
    endpoint: env("GEMINI_VEO_FAST_MODEL", "veo-3.1-fast-generate-preview"),
    label: "Veo 3.1 Fast (Google)",
    kind: "video",
    unitCost: 0.15,
    unit: "second",
    strengths: "Native synchronized audio, great quality/cost balance, rapid drafting tier.",
    bestFor: "Drafting, social clips, high-volume video versioning.",
  },
  "veo-3.1": {
    id: "veo-3.1",
    provider: "gemini",
    endpoint: env("GEMINI_VEO_MODEL", "veo-3.1-generate-preview"),
    label: "Veo 3.1 (Google)",
    kind: "video",
    unitCost: 0.75,
    unit: "second",
    strengths: "Best all-around: native 4K, native 48kHz audio, best lip-sync in market.",
    bestFor: "Hero spots and finished broadcast-style deliverables.",
  },
  "kling-3.0": {
    id: "kling-3.0",
    provider: "fal",
    endpoint: env("FAL_KLING_ENDPOINT", "fal-ai/kling-video/v3/standard/image-to-video"),
    label: "Kling 3.0 (Kuaishou, via fal.ai)",
    kind: "video",
    unitCost: 0.1,
    unit: "second",
    strengths:
      "4-7x cheaper than alternatives, uniquely strong multi-shot subject consistency.",
    bestFor: "Cost-efficient social cutdowns; same product across many shots.",
  },
  "kling-3.0-pro": {
    id: "kling-3.0-pro",
    provider: "fal",
    endpoint: env("FAL_KLING_PRO_ENDPOINT", "fal-ai/kling-video/v3/pro/image-to-video"),
    label: "Kling 3.0 Pro (Kuaishou, via fal.ai)",
    kind: "video",
    /*
     * The published rate is $0.112/s with audio off and $0.168/s with it on,
     * and this app does not send an audio switch to Kling — the field name is
     * not something to guess at on a strict-validation endpoint. So the
     * endpoint default decides, and the estimate quotes the higher of the two
     * rather than the one that would read better. An estimate that comes in
     * under the invoice is worse than no estimate.
     */
    unitCost: 0.168,
    unit: "second",
    strengths:
      "The quality tier above Kling Standard, at roughly 1.7x the price: better motion coherence and detail retention through a move, and it renders its own audio.",
    bestFor: "A finished-looking single shot when Veo is too expensive and Standard is not holding up.",
  },
  "runway-gen4": {
    id: "runway-gen4",
    provider: "fal",
    endpoint: env("FAL_RUNWAY_ENDPOINT", "fal-ai/runway-gen4/turbo/image-to-video"),
    label: "Runway Gen-4 (via fal.ai)",
    kind: "video",
    unitCost: 0.15,
    unit: "second",
    strengths:
      "The strongest creative-control surface: motion brush, camera control, video-to-video. Built for iteration — generate, then refine.",
    bestFor: "VFX-leaning brand films and shot-heavy storytelling where you expect to iterate on the motion.",
  },
  "seedance-2.5": {
    id: "seedance-2.5",
    provider: "fal",
    endpoint: env("FAL_SEEDANCE_VIDEO_ENDPOINT", "bytedance/seedance-2.5/image-to-video"),
    label: "Seedance 2.5 (ByteDance, via fal.ai)",
    kind: "video",
    // Token-billed. This is the 720p equivalent; 480p is ~$0.21/s and 1080p
    // ~$1.14/s. See lib/videoCost.ts.
    unitCost: 0.46,
    unit: "second",
    strengths:
      "First-and-last-frame control: supply both ends and it generates only the move between them. Native 30-second single takes, audio generated jointly with the picture, and no input footage on the bill.",
    bestFor: "A move between two frames you have already approved — and the cheapest Seedance route, since nothing is billed as input duration.",
  },
  "seedance-2.5-ref": {
    id: "seedance-2.5-ref",
    provider: "fal",
    endpoint: env("FAL_SEEDANCE_REF_ENDPOINT", "bytedance/seedance-2.5/reference-to-video"),
    label: "Seedance 2.5 Reference (ByteDance, via fal.ai)",
    kind: "video",
    // Token-billed; 720p equivalent. Supplying video references multiplies
    // the token price by 0.6 but also bills the input clip's duration.
    unitCost: 0.46,
    unit: "second",
    strengths:
      "Reference-to-video: up to 50 multimodal references addressed as [Image1], [Video1]... in the prompt, locking product, set and palette across the take. The strongest answer to product drift.",
    bestFor: "Product-identity-critical ads: the packaging must stay exactly itself while the camera moves.",
  },

  // ---------------- Music ----------------
  "eleven-sfx": {
    id: "eleven-sfx",
    provider: "fal",
    endpoint: env("FAL_SFX_ENDPOINT", "fal-ai/elevenlabs/sound-effects/v2"),
    label: "ElevenLabs Sound Effects v2 (via fal.ai)",
    kind: "sfx",
    unitCost: 0.002,
    unit: "second",
    strengths:
      "Text-to-sound-effect: one named effect at a time, 0.5-30s, optionally seamless-looping. Made to be dropped on a frame, not to underscore a whole cut.",
    bestFor:
      "The hero product sound — the crack, the pour, the seal breaking. The one noise the ad is actually selling, which a video model only ever approximates.",
  },

  "eleven-music": {
    id: "eleven-music",
    provider: "fal",
    endpoint: env("FAL_MUSIC_ENDPOINT", "fal-ai/elevenlabs/music"),
    label: "ElevenLabs Music (via fal.ai)",
    kind: "music",
    unitCost: 0.0133, // ~$0.80 / minute
    unit: "second",
    strengths:
      "Generates an actual composed track — genre, tempo, instrumentation and arrangement — from 3s to 10 minutes.",
    bestFor:
      "The music bed under an ad. Video models render SFX and ambience well but do not compose music; this layer does.",
  },
};

export function getModel(id: string): ModelInfo {
  const m = MODELS[id];
  if (!m) throw new Error(`Unknown model: ${id}`);
  return m;
}

/** Gemini text/vision model used for analysis + brief writing (cheap, multimodal). */
export const GEMINI_REASONING_MODEL = env("GEMINI_REASONING_MODEL", "gemini-2.5-flash");

export function estimateCost(
  modelId: string,
  opts?: {
    seconds?: number;
    images?: number;
    /** Seedance only: pixel area drives the token count, so it drives the bill. */
    resolution?: VideoResolution;
    aspect?: string;
    hasVideoInputs?: boolean;
    inputVideoSeconds?: number;
    /** Supplied reference images, for endpoints that bill them as input. */
    referenceImages?: number;
    /** Chosen output size, which moves the price on some image models. */
    sizePresetId?: string;
    sizePx?: number;
  },
): number {
  const m = getModel(modelId);
  // Seedance bills per token, not per second, and the token count scales with
  // pixel area — a per-second rate would be wrong by a factor that changes
  // with resolution. See lib/videoCost.ts.
  if (usesTokenPricing(modelId)) {
    return seedanceCost({
      resolution: opts?.resolution ?? "720p",
      aspect: opts?.aspect ?? "16:9",
      durationSeconds: opts?.seconds ?? 8,
      inputVideoSeconds: opts?.inputVideoSeconds,
      hasVideoInputs: opts?.hasVideoInputs,
    });
  }
  if (m.unit === "second") return m.unitCost * (opts?.seconds ?? 8);
  // Reference input is billed separately on some edit endpoints, and a
  // packshot run supplies up to six of them.
  const refs = (m.refImageCost ?? 0) * (opts?.referenceImages ?? 0);
  return m.unitCost * sizeMultiplier(m, opts) * (opts?.images ?? 1) + refs;
}

/**
 * How much the chosen output size moves the price.
 *
 * 1 for every model that charges one rate whatever it renders — Seedream,
 * Kontext, Flash Image, Recraft — which is most of them, and the reason this
 * was easy to miss. Nano Banana Pro steps 1x / 1.5x / 2x across its tiers, and
 * GPT Image 2 tracks pixel area continuously.
 */
export function sizeMultiplier(
  m: ModelInfo,
  opts?: { sizePresetId?: string; sizePx?: number },
): number {
  const sizes = m.outputSizes;
  if (!sizes) return 1;
  const preset = sizes.presets.find((p) => p.id === opts?.sizePresetId);
  if (preset) return preset.costMultiplier ?? 1;
  const custom = sizes.custom;
  if (custom?.costScalesWithArea && opts?.sizePx && custom.basePx) {
    return Math.pow(opts.sizePx / custom.basePx, 2);
  }
  // No size chosen yet: quote the tier the picker will land on, not the
  // cheapest one, so the number never falls when the user makes it explicit.
  const fallback = sizes.presets[Math.min(1, sizes.presets.length - 1)];
  return fallback?.costMultiplier ?? 1;
}

/** Models billed by token rather than by second. */
export const usesTokenPricing = (modelId: string) => modelId.startsWith("seedance-2.5");

export const hasGeminiKey = () => Boolean(process.env.GEMINI_API_KEY);
export const hasFalKey = () => Boolean(process.env.FAL_KEY);
export const hasRecraftKey = () => Boolean(process.env.RECRAFT_API_TOKEN);
export const isDryRun = () => process.env.DRY_RUN === "1";
