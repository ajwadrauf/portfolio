import { z } from "zod";

// ---------- Product analysis ----------

export const ProductContextSchema = z.object({
  name: z.string().describe("Short product type, e.g. 'sparkling water', 'moisturizer'"),
  category: z.string().describe("skincare, beverage, food, household, electronics..."),
  colors: z.array(z.string()).describe("Primary visible colors"),
  texture: z.string().describe("matte, glossy, frosted, metallic..."),
  packagingType: z.string().describe("can, bottle, jar, box, pouch, tube..."),
});
export type ProductContext = z.infer<typeof ProductContextSchema>;

export const ClarifyingQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  defaultAnswer: z.string(),
});
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>;

export const AnalyzeResponseSchema = z.object({
  productContext: ProductContextSchema,
  questions: z.array(ClarifyingQuestionSchema).max(3),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export type Answer = { questionId: string; question: string; answer: string };

// ---------- Campaign brief ----------

export const CampaignBriefSchema = z.object({
  productName: z.string(),
  mood: z.string(),
  setting: z.string(),
  palette: z.string(),
  targetAudience: z.string(),
  headlineEN: z.string().describe("Short retail promo headline in English, max 6 words"),
  headlineFR: z.string().describe("The same headline localized to Canadian French"),
  stillPrompt: z
    .string()
    .describe("2-4 sentence base prompt for a photorealistic hero product still"),
  videoPrompt: z
    .string()
    .describe("2-5 sentence Veo-optimized prompt with camera, lighting and an Audio: cue"),
  negativePrompt: z.string(),
  seasonalTheme: z.string().describe("A seasonal retheme direction, e.g. 'cozy winter holiday'"),
});
export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;

// ---------- Deliverables ----------

export type DeliverableKind = "still" | "video";
export type AspectRatio = "1:1" | "9:16" | "16:9" | "4:5";

export type DeliverableId =
  | "hero_still"
  | "adapt_story"
  | "adapt_banner"
  | "promo_tile_en"
  | "promo_tile_fr"
  | "seasonal_variant"
  | "hero_video"
  | "social_cutdown";

export type GenerationJob = {
  deliverableId: DeliverableId;
  modelId: string;
  status: "queued" | "running" | "polling" | "done" | "failed" | "mock";
  startedAt?: number;
  finishedAt?: number;
  // stills
  imageDataUrl?: string;
  imageUrl?: string;
  // video
  operationName?: string; // Veo
  falRequestId?: string; // fal queue
  videoUrl?: string;
  posterDataUrl?: string;
  error?: string;
  estimatedCost: number;
};
