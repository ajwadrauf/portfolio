import { NextResponse } from "next/server";
import { unlocked } from "@/lib/auth";
import {
  AD_NEGATIVE_PROMPT,
  MULTI_REF_MODELS,
  getAdPreset,
  referenceBlock,
  type AudioMode,
  type ReferenceSpec,
} from "@/lib/adPresets";
import { dataUrlToInline, reasonJson } from "@/lib/gemini";
import { getMusicStyle } from "@/lib/music";
import { hasGeminiKey, isDryRun } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMPOSE_SCHEMA = {
  type: "object",
  properties: {
    finalPrompt: { type: "string" },
    negativePrompt: { type: "string" },
  },
  required: ["finalPrompt", "negativePrompt"],
} as const;

/**
 * Turns a preset recipe + product parameters into a final video prompt.
 * The deterministic template is always the baseline; when Gemini is
 * available it refines pacing, physics and audio sync for the target
 * duration. Demo mode returns the template directly — still a complete,
 * usable prompt.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      presetId: string;
      params: Record<string, string>;
      audioMode?: AudioMode;
      imageDataUrl?: string;
      musicStyleId?: string;
      modelId?: string;
      references?: ReferenceSpec[];
    };
    const preset = getAdPreset(body.presetId);
    const params = Object.fromEntries(
      preset.fields.map((f) => [f.key, (body.params?.[f.key] ?? "").trim() || f.placeholder]),
    );
    const audioMode: AudioMode = body.audioMode ?? "layered";
    const musicBrief = getMusicStyle(body.musicStyleId ?? preset.musicStyleId).prompt;
    // Reference-to-video models want each reference assigned a job.
    const usesRefs = MULTI_REF_MODELS.includes(body.modelId ?? "");
    const refs = usesRefs ? (body.references ?? []) : [];
    const baseline = preset.template(params, audioMode, musicBrief) + referenceBlock(refs);

    if (!hasGeminiKey() || isDryRun() || !unlocked(req)) {
      return NextResponse.json({
        finalPrompt: baseline,
        negativePrompt: AD_NEGATIVE_PROMPT,
        mock: true,
      });
    }

    const result = await reasonJson({
      prompt: `You are a creative director finalizing a short-form product ad prompt for Google Veo (native synchronized audio; text in quotes renders as on-screen or spoken content).

The ad concept is a fixed preset — do NOT change its concept, camera style, structure or audio design. Your job is to polish the draft prompt below into the strongest possible ${preset.durationSeconds}-second execution: compress the beats to fit the duration, sharpen the physics and motion verbs, keep every text overlay EXACTLY as quoted, and keep it as one flowing prompt of 4-8 sentences. Preserve the Audio: cue's instructions exactly in spirit — ${audioMode === "layered" ? "in particular it MUST still forbid music/score/soundtrack, because the music bed is composed separately and layered in" : "including its musical direction"}. No real-world brand names other than the quoted brand text.${
        refs.length > 0
          ? "\n\nThe draft ends with a reference-usage block addressing references positionally as [Image1], [Video1] and so on. Keep every one of those bracketed tokens EXACTLY as written and keep the instruction that the product must not drift — the video model resolves them against the uploaded reference files."
          : ""
      }
${body.imageDataUrl ? "\nA photo of the ACTUAL product is attached, and it will also be passed to the video model as the grounding first frame. Anchor the prompt in what the photo really shows — the packaging's true colors, materials, finish and proportions — and correct any detail in the draft that contradicts the photo. The product in the ad must be recognizably THIS product.\n" : ""}
Preset: ${preset.name} — ${preset.hook}

Draft prompt:
${baseline}

Return finalPrompt (the polished prompt) and negativePrompt (short artifact-avoidance list appropriate to this style).`,
      image: body.imageDataUrl ? dataUrlToInline(body.imageDataUrl) : undefined,
      responseSchema: COMPOSE_SCHEMA,
      validate: (raw) => raw as { finalPrompt: string; negativePrompt: string },
    });

    return NextResponse.json({ ...result, mock: false });
  } catch (e) {
    console.error("ad compose failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Compose failed" },
      { status: 500 },
    );
  }
}
