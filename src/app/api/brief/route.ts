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
      productContext?: ProductContext;
      answers?: Answer[];
    };
    if (!body.productContext) {
      return NextResponse.json({ error: "productContext is required" }, { status: 400 });
    }

    if (!hasGeminiKey() || isDryRun() || !unlocked(req)) {
      return NextResponse.json({ brief: mockBrief(), mock: true });
    }

    const brief = await reasonJson({
      prompt: buildBriefPrompt(body.productContext, body.answers ?? []),
      image: body.imageDataUrl ? dataUrlToInline(body.imageDataUrl) : undefined,
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
