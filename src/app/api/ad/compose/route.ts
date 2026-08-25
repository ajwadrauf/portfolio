import { NextResponse } from "next/server";
import { AD_NEGATIVE_PROMPT, getAdPreset } from "@/lib/adPresets";
import { reasonJson } from "@/lib/gemini";
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
    };
    const preset = getAdPreset(body.presetId);
    const params = Object.fromEntries(
      preset.fields.map((f) => [f.key, (body.params?.[f.key] ?? "").trim() || f.placeholder]),
    );
    const baseline = preset.template(params);

    if (!hasGeminiKey() || isDryRun()) {
      return NextResponse.json({
        finalPrompt: baseline,
        negativePrompt: AD_NEGATIVE_PROMPT,
        mock: true,
      });
    }

    const result = await reasonJson({
      prompt: `You are a creative director finalizing a short-form product ad prompt for Google Veo (native synchronized audio; text in quotes renders as on-screen or spoken content).

The ad concept is a fixed preset — do NOT change its concept, camera style, structure or audio design. Your job is to polish the draft prompt below into the strongest possible ${preset.durationSeconds}-second execution: compress the beats to fit the duration, sharpen the physics and motion verbs, keep every text overlay EXACTLY as quoted, keep the Audio: cue, and keep it as one flowing prompt of 4-8 sentences. No real-world brand names other than the quoted brand text.

Preset: ${preset.name} — ${preset.hook}

Draft prompt:
${baseline}

Return finalPrompt (the polished prompt) and negativePrompt (short artifact-avoidance list appropriate to this style).`,
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
