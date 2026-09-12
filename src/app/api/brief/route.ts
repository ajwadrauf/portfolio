import { campaignImageInputs, campaignReferencePrompt, type CampaignReference } from "@/lib/campaignReferences";
import { NextResponse } from "next/server";
import { unlocked } from "@/lib/auth";
import { dataUrlToInline, reasonJson } from "@/lib/gemini";
import { hasGeminiKey, isDryRun } from "@/lib/models";
import { mockBrief } from "@/lib/mock";
import { BRIEF_RESPONSE_SCHEMA, buildBriefPrompt } from "@/lib/prompts";
import { CampaignBriefSchema, type Answer, type ProductContext } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      imageDataUrl?: string;
      referenceImages?: CampaignReference[];
      productContext?: ProductContext;
      answers?: Answer[];
    };
    if (!body.productContext) {
      return NextResponse.json({ error: "productContext is required" }, { status: 400 });
    }

    let inputs: CampaignReference[];
    try { inputs = campaignImageInputs(body.imageDataUrl, body.referenceImages); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid references" }, { status: 400 }); }
    if (!hasGeminiKey() || isDryRun() || !unlocked(req)) {
      return NextResponse.json({ brief: mockBrief(), mock: true });
    }

    const brief = await reasonJson({
      prompt: campaignReferencePrompt(inputs) + buildBriefPrompt(body.productContext, body.answers ?? []),
      images: inputs.map((item) => dataUrlToInline(item.dataUrl)),
      responseSchema: BRIEF_RESPONSE_SCHEMA,
      validate: (raw) => CampaignBriefSchema.parse(raw),
    });
    return NextResponse.json({ brief, mock: false });
  } catch (e) {
    console.error("brief failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Brief generation failed" },
      { status: 500 },
    );
  }
}
