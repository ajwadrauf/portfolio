import { campaignImageInputs, campaignReferencePrompt, type CampaignReference } from "@/lib/campaignReferences";
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
      referenceImages?: CampaignReference[];
      approvedHero?: boolean;
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

    let inputs: CampaignReference[];
    try { inputs = campaignImageInputs(body.imageDataUrl, body.referenceImages); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid references" }, { status: 400 }); }
    const model = getModel(body.modelId);
    if (spec.usesProductImage && inputs.length > (model.maxReferenceImages ?? 1)) return NextResponse.json({ error: `${model.label} supports up to ${model.maxReferenceImages ?? 1} campaign reference images. Choose Nano Banana Pro to use this whole set. No images were discarded or submitted.` }, { status: 400 });
    const prompt = (body.approvedHero === true
      ? "The first attached image is the approved campaign hero. The remaining images, when present, show the same product from other angles. Use its actual product, packaging design, lighting character and palette as visual grounding for this adaptation. Preserve product identity while recomposing for the requested format. "
      : "") + campaignReferencePrompt(inputs) + spec.buildPrompt(body.brief);
    const cost = estimateCost(model.id, { referenceImages: spec.usesProductImage ? inputs.length : 0 });

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
          spec.usesProductImage && inputs.length
            ? inputs.map((item) => dataUrlToInline(item.dataUrl))
            : undefined,
      });
      return liveJson(spend, { mock: false, imageDataUrl: dataUrl, prompt, cost });
    }

    const { url } = await falGenerateImage({
      endpoint: model.endpoint,
      prompt,
      aspectRatio: spec.aspect,
      referenceImageDataUrl: spec.usesProductImage ? inputs[0]?.dataUrl : undefined,
      ...(inputs.length > 1 && spec.usesProductImage ? { referenceImageDataUrls: inputs.map((item) => item.dataUrl) } : {}),
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
