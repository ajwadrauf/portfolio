import { campaignImageInputs, campaignReferencePrompt, type CampaignReference } from "@/lib/campaignReferences";
import { NextResponse } from "next/server";
import { unlocked } from "@/lib/auth";
import { dataUrlToInline, reasonJson } from "@/lib/gemini";
import { hasGeminiKey, isDryRun } from "@/lib/models";
import { mockAnalyze } from "@/lib/mock";
import { ANALYZE_PROMPT, ANALYZE_RESPONSE_SCHEMA } from "@/lib/prompts";
import { AnalyzeResponseSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { imageDataUrl, referenceImages } = (await req.json()) as { imageDataUrl?: string; referenceImages?: CampaignReference[] };
    if (!imageDataUrl) {
      return NextResponse.json({ error: "imageDataUrl is required" }, { status: 400 });
    }

    let inputs: CampaignReference[];
    try { inputs = campaignImageInputs(imageDataUrl, referenceImages); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid references" }, { status: 400 }); }
    if (!hasGeminiKey() || isDryRun() || !unlocked(req)) {
      return NextResponse.json({ ...mockAnalyze(), mock: true });
    }

    const result = await reasonJson({
      prompt: campaignReferencePrompt(inputs) + ANALYZE_PROMPT,
      images: inputs.map((item) => dataUrlToInline(item.dataUrl)),
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
