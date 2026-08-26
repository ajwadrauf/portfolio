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

export type Provider = "gemini" | "fal";

export type ModelInfo = {
  id: string; // registry key, stable within this app
  provider: Provider;
  /** Provider-side model ID / endpoint slug (env-overridable). */
  endpoint: string;
  label: string;
  kind: "image" | "video" | "music";
  /** USD. Images: per image. Video/music: per second. */
  unitCost: number;
  unit: "image" | "second";
  strengths: string;
  bestFor: string;
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
    unitCost: 0.15,
    unit: "second",
    strengths:
      "Native 30-second single takes, audio generated jointly with the picture, strong multi-shot consistency.",
    bestFor: "Short-form product ads at volume; longer cuts no other model does in one pass.",
  },
  "seedance-2.5-ref": {
    id: "seedance-2.5-ref",
    provider: "fal",
    endpoint: env("FAL_SEEDANCE_REF_ENDPOINT", "bytedance/seedance-2.5/reference-to-video"),
    label: "Seedance 2.5 Reference (ByteDance, via fal.ai)",
    kind: "video",
    unitCost: 0.15,
    unit: "second",
    strengths:
      "Reference-to-video: up to 50 multimodal references addressed as [Image1], [Video1]... in the prompt, locking product, set and palette across the take. The strongest answer to product drift.",
    bestFor: "Product-identity-critical ads: the packaging must stay exactly itself while the camera moves.",
  },

  // ---------------- Music ----------------
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

export function estimateCost(modelId: string, opts?: { seconds?: number; images?: number }): number {
  const m = getModel(modelId);
  if (m.unit === "second") return m.unitCost * (opts?.seconds ?? 8);
  return m.unitCost * (opts?.images ?? 1);
}

export const hasGeminiKey = () => Boolean(process.env.GEMINI_API_KEY);
export const hasFalKey = () => Boolean(process.env.FAL_KEY);
export const isDryRun = () => process.env.DRY_RUN === "1";
