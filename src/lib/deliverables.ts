import type { AspectRatio, CampaignBrief, DeliverableId, DeliverableKind } from "./types";

export type DeliverableSpec = {
  id: DeliverableId;
  label: string;
  kind: DeliverableKind;
  aspect: AspectRatio;
  description: string;
  /** Why this deliverable exists in a retail content pipeline. */
  rationale: string;
  modelOptions: string[]; // registry ids from models.ts
  defaultModel: string;
  /** Video only */
  durationSeconds?: number;
  /** Uses the uploaded product photo as visual grounding (first frame / reference). */
  usesProductImage: boolean;
  buildPrompt: (brief: CampaignBrief) => string;
};

const stillBase = (brief: CampaignBrief) =>
  `${brief.stillPrompt} Mood: ${brief.mood}. Setting: ${brief.setting}. Color palette: ${brief.palette}. Professional product photography, sharp focus on the product, commercial retail quality.`;

export const DELIVERABLES: DeliverableSpec[] = [
  {
    id: "hero_still",
    label: "Hero Still",
    kind: "still",
    aspect: "4:5",
    description: "The campaign's anchor image — one photorealistic hero shot.",
    rationale: "Every retail campaign starts from one hero asset that everything else adapts from.",
    modelOptions: ["nano-banana-pro", "flux-2-pro"],
    defaultModel: "nano-banana-pro",
    usesProductImage: true,
    buildPrompt: (brief) => `${stillBase(brief)} Dramatic hero composition, 4:5 vertical crop.`,
  },
  {
    id: "adapt_story",
    label: "Story Adaptation (9:16)",
    kind: "still",
    aspect: "9:16",
    description: "The hero recomposed for Stories / Reels / in-store vertical screens.",
    rationale: "Format adaptation is the highest-volume ask in retail — same idea, every surface.",
    modelOptions: ["nano-banana-flash", "nano-banana-pro"],
    defaultModel: "nano-banana-flash",
    usesProductImage: true,
    buildPrompt: (brief) =>
      `${stillBase(brief)} Recomposed as a 9:16 vertical story format: product lower third, generous negative space above for UI overlays.`,
  },
  {
    id: "adapt_banner",
    label: "Web Banner (16:9)",
    kind: "still",
    aspect: "16:9",
    description: "Wide e-commerce / homepage banner crop with copy space.",
    rationale: "Demonstrates modular composition: the same brief driving a horizontal layout.",
    modelOptions: ["nano-banana-flash", "flux-2-pro"],
    defaultModel: "nano-banana-flash",
    usesProductImage: true,
    buildPrompt: (brief) =>
      `${stillBase(brief)} Wide 16:9 banner composition: product on the right third, clean uncluttered copy space on the left for a headline.`,
  },
  {
    id: "promo_tile_en",
    label: "Promo Tile — EN",
    kind: "still",
    aspect: "1:1",
    description: "Square promo tile with the campaign headline rendered in-image (English).",
    rationale: "Text-in-image is where most models fail — Nano Banana Pro's rendering makes live promo text viable.",
    modelOptions: ["nano-banana-pro"],
    defaultModel: "nano-banana-pro",
    usesProductImage: true,
    buildPrompt: (brief) =>
      `${stillBase(brief)} Square 1:1 retail promo tile. Render the headline text "${brief.headlineEN}" in clean bold modern typography integrated into the composition, high contrast, fully legible. No other text.`,
  },
  {
    id: "promo_tile_fr",
    label: "Promo Tile — FR",
    kind: "still",
    aspect: "1:1",
    description: "The same tile, localized to Canadian French — the bilingual versioning story.",
    rationale: "EN/FR duplication doubles Canadian retail content volume; automating it is the studio's clearest win.",
    modelOptions: ["nano-banana-pro"],
    defaultModel: "nano-banana-pro",
    usesProductImage: true,
    buildPrompt: (brief) =>
      `${stillBase(brief)} Square 1:1 retail promo tile, identical composition and styling to the English version. Render the headline text "${brief.headlineFR}" in clean bold modern typography integrated into the composition, high contrast, fully legible. No other text.`,
  },
  {
    id: "seasonal_variant",
    label: "Seasonal Variant",
    kind: "still",
    aspect: "4:5",
    description: "The hero rethemed for a seasonal moment without reshooting.",
    rationale: "Seasonal rethemes are a recurring retail cadence — AI turns a reshoot into an edit.",
    modelOptions: ["nano-banana-flash", "nano-banana-pro"],
    defaultModel: "nano-banana-flash",
    usesProductImage: true,
    buildPrompt: (brief) =>
      `${stillBase(brief)} Rethemed for the season: ${brief.seasonalTheme}. Keep the product identical and recognizable; transform only the environment, props and lighting.`,
  },
  {
    id: "hero_video",
    label: "Hero Video (8s)",
    kind: "video",
    aspect: "16:9",
    description: "Broadcast-style product spot with native synchronized audio.",
    rationale: "Proves finished motion deliverables, not just stills — with sound, from one photo.",
    modelOptions: ["veo-3.1-fast", "veo-3.1"],
    defaultModel: "veo-3.1-fast",
    durationSeconds: 8,
    usesProductImage: true,
    buildPrompt: (brief) => brief.videoPrompt,
  },
  {
    id: "social_cutdown",
    label: "Social Cutdown (5s, 9:16)",
    kind: "video",
    aspect: "9:16",
    description: "Vertical short-form cut on the cost-efficient tier.",
    rationale: "Model routing in action: the hero runs on Veo, volume cutdowns run 5-7x cheaper on Kling.",
    modelOptions: ["kling-3.0"],
    defaultModel: "kling-3.0",
    durationSeconds: 5,
    usesProductImage: true,
    buildPrompt: (brief) =>
      `${brief.videoPrompt} Vertical 9:16 composition optimized for mobile social feeds, punchy pacing, product always in frame.`,
  },
];

export const getDeliverable = (id: DeliverableId): DeliverableSpec => {
  const d = DELIVERABLES.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown deliverable: ${id}`);
  return d;
};
