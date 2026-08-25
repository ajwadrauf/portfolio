import { NextResponse } from "next/server";
import { dataUrlToInline, reasonJson } from "@/lib/gemini";
import { hasGeminiKey, isDryRun } from "@/lib/models";
import { mockAnalyze } from "@/lib/mock";
import { ANALYZE_PROMPT, ANALYZE_RESPONSE_SCHEMA } from "@/lib/prompts";
import { AnalyzeResponseSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { imageDataUrl } = (await req.json()) as { imageDataUrl?: string };
    if (!imageDataUrl) {
      return NextResponse.json({ error: "imageDataUrl is required" }, { status: 400 });
    }

    if (!hasGeminiKey() || isDryRun()) {
      return NextResponse.json({ ...mockAnalyze(), mock: true });
    }

    const result = await reasonJson({
      prompt: ANALYZE_PROMPT,
      image: dataUrlToInline(imageDataUrl),
      responseSchema: ANALYZE_RESPONSE_SCHEMA,
      validate: (raw) => AnalyzeResponseSchema.parse(raw),
    });
    return NextResponse.json({ ...result, mock: false });
  } catch (e) {
    console.error("analyze failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
