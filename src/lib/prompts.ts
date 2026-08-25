import type { Answer, ProductContext } from "./types";

/**
 * Flow 1 — image analysis with adaptive questioning. The restraint rule
 * ("never ask about what you can already see") is the difference between a
 * wizard people finish and one they abandon.
 */
export const ANALYZE_PROMPT = `You are a creative director planning a retail product campaign.

Analyze this product image and return:

1. productContext: Extract what you can confidently see — product type, category, visible colors, texture, packaging type.

2. questions: Ask 0-3 SHORT clarifying questions ONLY if the image doesn't make something clear. Ask about:
   - Target audience if the product is clearly gender/age neutral and it matters for campaign style
   - Primary use occasion if genuinely ambiguous (e.g., day vs. night cream)
   - Brand tone if packaging is minimal and gives no cues

Never ask about: colors (visible), packaging type (visible), or anything clearly shown in the image.
If the image gives enough context for a compelling campaign brief, return an empty questions array.

For each question, provide 2-4 short option labels and indicate the best default answer.`;

/**
 * Flow 2 — campaign brief. One brief drives every deliverable in the pack:
 * stills, adaptations, bilingual promo tiles, seasonal variant and video.
 */
export function buildBriefPrompt(
  ctx: ProductContext,
  answers: Answer[],
): string {
  const answerLines =
    answers.length > 0
      ? answers.map((a) => `- ${a.question}: ${a.answer}`).join("\n")
      : "(No additional context — use best judgment from the image)";

  return `You are a creative director at a Canadian retail agency writing one campaign brief that will drive an entire multi-format content pack: a hero still, format adaptations, bilingual (EN/FR) promo tiles with rendered headline text, a seasonal variant, and short video spots.

Product analysis:
- Type: ${ctx.name}
- Category: ${ctx.category}
- Colors: ${ctx.colors.join(", ")}
- Texture: ${ctx.texture}
- Packaging: ${ctx.packagingType}

User context:
${answerLines}

Create the brief with these requirements:
1. headlineEN: a short punchy retail promo headline (max 6 words). headlineFR: the SAME headline localized (not literally translated) to natural Canadian French.
2. stillPrompt: 2-4 sentences for a photorealistic hero product still — subject and action first, then lighting and surface details referencing the product's actual colors and textures. No brand names or logos.
3. videoPrompt: 2-5 sentences optimized for Google Veo (which generates native synchronized audio) — start with subject and primary action; include lighting, camera movement and setting; reference the product's real colors/textures; end with an "Audio:" cue describing sound design, then the style descriptor "Cinematic 4K, photorealistic lighting, product photography quality". No brand names.
4. negativePrompt: concise list of artifacts to avoid (e.g. "blurry, deformed packaging, warped text, watermark").
5. seasonalTheme: one evocative seasonal retheme direction relevant to Canadian retail moments (holiday, summer BBQ, back-to-school...).
6. Fill mood, setting, palette and targetAudience thoughtfully — they are appended to every image prompt in the pack.`;
}

/** JSON schemas (Gemini responseSchema format) */

export const ANALYZE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    productContext: {
      type: "object",
      properties: {
        name: { type: "string" },
        category: { type: "string" },
        colors: { type: "array", items: { type: "string" } },
        texture: { type: "string" },
        packagingType: { type: "string" },
      },
      required: ["name", "category", "colors", "texture", "packagingType"],
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          defaultAnswer: { type: "string" },
        },
        required: ["id", "question", "options", "defaultAnswer"],
      },
    },
  },
  required: ["productContext", "questions"],
} as const;

export const BRIEF_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    productName: { type: "string" },
    mood: { type: "string" },
    setting: { type: "string" },
    palette: { type: "string" },
    targetAudience: { type: "string" },
    headlineEN: { type: "string" },
    headlineFR: { type: "string" },
    stillPrompt: { type: "string" },
    videoPrompt: { type: "string" },
    negativePrompt: { type: "string" },
    seasonalTheme: { type: "string" },
  },
  required: [
    "productName",
    "mood",
    "setting",
    "palette",
    "targetAudience",
    "headlineEN",
    "headlineFR",
    "stillPrompt",
    "videoPrompt",
    "negativePrompt",
    "seasonalTheme",
  ],
} as const;
