/**
 * Starter motion references.
 *
 * A clip reference is not decoration and it is not a background — the model
 * reads its camera move, its cutting rhythm and its energy, and applies them
 * to your product. Which means the useful clips are abstract: swirling
 * colour, particles, light sweeps. There is no subject in them to leak into
 * the render, only motion.
 *
 * That is also why the blurbs below are written as reference briefs rather
 * than as stock-library descriptions. "Vibrant spheres merging against a
 * dark blue background" tells you what the clip looks like. "Slow orbital
 * drift with soft collisions — use it when the product should feel weightless
 * rather than driven" tells you what it will do to your ad.
 */

export type ReferenceClip = {
  id: string;
  name: string;
  /** What the model will take from it, in production terms. */
  brief: string;
  /** The reference job this clip is best pointed at. */
  suggestedRole: "motion" | "rhythm" | "style" | "composition";
  /**
   * Where the clip lives. Either an absolute `https://` URL to a hosted file
   * — which is what these are, on Vercel Blob — or a path under
   * `public/references/` shipped with the repo.
   *
   * Filenames match the exports exactly, capitals and all. Object storage and
   * Linux filesystems are both case-sensitive, so `VibrantChurn.mp4` and
   * `vibrantchurn.mp4` are different files — matching what comes out of the
   * editor removes a rename step and the silent 404 that follows getting it
   * wrong.
   *
   * The hosted form exists because these are the one asset that has to be
   * reachable by two different parties: the browser, to show a preview, and
   * fal, to read the motion. A repo path satisfies both once deployed, but it
   * puts multi-megabyte video into git history forever. A URL — fal storage,
   * S3, any CDN — satisfies both without the repo ever holding the bytes.
   *
   * Both are resolved at build time, so either way a change needs a redeploy.
   * The difference is what git carries, not how fast you can swap one.
   */
  file: string;
  /**
   * Optional still frame. The clip animates itself once in view, so this only
   * covers the moment before the first frame decodes. A GIF is no use here —
   * `poster` renders a static image whatever you give it.
   */
  poster?: string;
};

export const REFERENCE_CLIPS: ReferenceClip[] = [
  {
    id: "vibrant-churn",
    name: "Vibrant churn",
    brief:
      "Continuous, fluid sweeping motion across tightly packed, chaotic clusters. Lively and playful, with no single fixed focal point — the elements constantly shift and churn. Point a product at this when it needs to feel highly creative, energetic, or bursting with variety. The wrong choice for minimalist, rigid, or highly serious branding.",
    suggestedRole: "motion",
    file: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/VibrantChurn.mp4",
  },
  {
    id: "symmetrical-pulse",
    name: "Symmetrical pulse",
    brief:
      "Fixed-camera, hypnotic vertical rippling that pulses at a steady, driving rhythm. Strictly mirrored, pulling the eye down a central axis in repetitive, wave-like contractions. Ideal for audio gear, tech hardware, or anything that demands rigid synchronisation and a futuristic, beat-driven feel. Unsuitable for organic, unpredictable or free-flowing concepts.",
    suggestedRole: "rhythm",
    file: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/SymmetricalPulse.mp4",
  },
  {
    id: "off-center-vortex",
    name: "Off-center vortex",
    brief:
      "A slow, creeping rotation that divides the frame, contrasting a solid block of colour against a swirling, suspended mixture. The camera feels like it is tracking a gentle, mechanical stirring motion with distinct floating elements. Use this for skincare, eco-friendly materials, or beverages where the product should feel balanced, mixed and carefully formulated.",
    suggestedRole: "composition",
    file: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/Off-CenterVortex.mp4",
  },
  {
    id: "directional-glide",
    name: "Directional glide",
    brief:
      "A relentless, smooth, unidirectional wave travelling steadily across a dense, textured surface. Unbroken, undulating and velvety, conveying deep liquid progression with no abrupt stops or collisions. Apply this to luxury goods or hydration tech to grant the product a sleek, premium sweep. Too continuous and soft for fast-paced, high-impact edits.",
    suggestedRole: "motion",
    file: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/DirectionalGlide.mp4",
  },
  {
    id: "explosive-bloom",
    name: "Explosive bloom",
    brief:
      "A sudden, aggressive outward expansion from the centre that quickly decelerates into a slow, intricate crawl at the edges. The energy shifts dramatically from immediate, forceful impact to a lingering, highly detailed settling phase. Perfect for striking centre-frame product reveals, intense flavour drops, or dramatic transformations. The wrong choice for subtle, ambient or continuous background motion.",
    suggestedRole: "rhythm",
    file: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/ExplosiveBloom.mp4",
  },
];

/**
 * fal fetches a reference URL from its own servers, so a site-relative path
 * has to become something reachable from outside this machine before it is
 * sent. See resolveClipUrl in the start route.
 */
/** A repo-shipped clip, which the server has to make fetchable before use. */
export const isStarterClipPath = (url: string) => url.startsWith("/references/");

/** A clip already hosted somewhere fal can reach — nothing to resolve. */
export const isHostedClip = (url: string) => /^https:\/\//.test(url);

/**
 * Env overrides, so the starter set can be re-pointed at hosted files without
 * a code change: REFERENCE_CLIP_VIBRANT_CHURN=https://…/vibrant-churn.mp4
 *
 * Read on the server, and this page is prerendered — so the value is baked at
 * build time. Changing one means changing the variable and redeploying, not
 * just restarting.
 */
export const clipEnvKey = (id: string) =>
  `REFERENCE_CLIP_${id.toUpperCase().replace(/-/g, "_")}`;
