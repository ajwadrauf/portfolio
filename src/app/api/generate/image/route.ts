import { NextResponse } from "next/server";
import { consume, liveJson, unlocked } from "@/lib/auth";
import { getDeliverable } from "@/lib/deliverables";
import { falGenerateImage } from "@/lib/fal";
import { dataUrlToInline, generateImage } from "@/lib/gemini";
import { estimateCost, getModel, hasFalKey, hasGeminiKey, isDryRun } from "@/lib/models";
import { mockImageDataUrl } from "@/lib/mock";
import type { CampaignBrief, DeliverableId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let label = "Still";
  try {
    const body = (await req.json()) as {
      deliverableId: DeliverableId;
      modelId: string;
      brief: CampaignBrief;
      imageDataUrl?: string;
    };

    const spec = getDeliverable(body.deliverableId);
    label = spec.label;
    if (spec.kind !== "still") {
      return NextResponse.json({ error: "Not a still deliverable" }, { status: 400 });
    }
    if (!spec.modelOptions.includes(body.modelId)) {
      return NextResponse.json(
        { error: `Model ${body.modelId} not allowed for ${spec.id}` },
        { status: 400 },
      );
    }

    const model = getModel(body.modelId);
    const prompt = spec.buildPrompt(body.brief);
    const cost = estimateCost(model.id);

    const hasKey = model.provider === "gemini" ? hasGeminiKey() : hasFalKey();
    // Gate first, then spend a unit of this session's budget. Either failing
    // degrades to demo mode rather than erroring.
    const spend = !isDryRun() && hasKey && unlocked(req) ? consume(req) : null;
    const live = spend?.ok ?? false;

    if (!live) {
      return NextResponse.json({
        mock: true,
        imageDataUrl: mockImageDataUrl({
          label: spec.label,
          sublabel: model.label,
          aspect: spec.aspect,
        }),
        prompt,
        cost: 0,
      });
    }

    if (model.provider === "gemini") {
      const { dataUrl } = await generateImage({
        model: model.endpoint,
        prompt,
        aspectRatio: spec.aspect,
        referenceImages:
          spec.usesProductImage && body.imageDataUrl
            ? [dataUrlToInline(body.imageDataUrl)]
            : undefined,
      });
      return liveJson(spend, { mock: false, imageDataUrl: dataUrl, prompt, cost });
    }

    const { url } = await falGenerateImage({
      endpoint: model.endpoint,
      prompt,
      aspectRatio: spec.aspect,
      referenceImageDataUrl: spec.usesProductImage ? body.imageDataUrl : undefined,
    });
    return liveJson(spend, { mock: false, imageUrl: url, prompt, cost });
  } catch (e) {
    console.error(`image generation failed (${label})`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Image generation failed" },
      { status: 500 },
    );
  }
}
