import { NextResponse } from "next/server";
import { getDeliverable } from "@/lib/deliverables";
import { falStartVideo } from "@/lib/fal";
import { dataUrlToInline, startVeo } from "@/lib/gemini";
import { estimateCost, getModel, hasFalKey, hasGeminiKey, isDryRun } from "@/lib/models";
import { mockImageDataUrl } from "@/lib/mock";
import type { CampaignBrief, DeliverableId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let label = "Video";
  try {
    const body = (await req.json()) as {
      deliverableId: DeliverableId;
      modelId: string;
      brief: CampaignBrief;
      imageDataUrl?: string;
    };

    const spec = getDeliverable(body.deliverableId);
    label = spec.label;
    if (spec.kind !== "video") {
      return NextResponse.json({ error: "Not a video deliverable" }, { status: 400 });
    }
    if (!spec.modelOptions.includes(body.modelId)) {
      return NextResponse.json(
        { error: `Model ${body.modelId} not allowed for ${spec.id}` },
        { status: 400 },
      );
    }

    const model = getModel(body.modelId);
    const seconds = spec.durationSeconds ?? 8;
    const prompt = spec.buildPrompt(body.brief);
    const cost = estimateCost(model.id, { seconds });

    const live =
      !isDryRun() && (model.provider === "gemini" ? hasGeminiKey() : hasFalKey());

    if (!live) {
      return NextResponse.json({
        mock: true,
        posterDataUrl: mockImageDataUrl({
          label: spec.label,
          sublabel: model.label,
          aspect: spec.aspect,
        }),
        prompt,
        cost: 0,
      });
    }

    if (model.provider === "gemini") {
      const { operationName } = await startVeo({
        model: model.endpoint,
        prompt,
        negativePrompt: body.brief.negativePrompt,
        aspectRatio: spec.aspect === "9:16" ? "9:16" : "16:9",
        durationSeconds: seconds,
        firstFrame:
          spec.usesProductImage && body.imageDataUrl
            ? dataUrlToInline(body.imageDataUrl)
            : undefined,
      });
      return NextResponse.json({ mock: false, provider: "gemini", operationName, prompt, cost });
    }

    const { requestId } = await falStartVideo({
      endpoint: model.endpoint,
      prompt,
      durationSeconds: seconds,
      aspectRatio: spec.aspect,
      referenceImageDataUrl: spec.usesProductImage ? body.imageDataUrl : undefined,
      negativePrompt: body.brief.negativePrompt,
    });
    return NextResponse.json({ mock: false, provider: "fal", falRequestId: requestId, prompt, cost });
  } catch (e) {
    console.error(`video start failed (${label})`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Video generation failed to start" },
      { status: 500 },
    );
  }
}
