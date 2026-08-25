import { NextResponse } from "next/server";
import { falGenerateImage } from "@/lib/fal";
import { dataUrlToInline, generateImage } from "@/lib/gemini";
import { estimateCost, getModel, hasFalKey, hasGeminiKey, isDryRun } from "@/lib/models";
import { mockImageDataUrl } from "@/lib/mock";
import {
  PACKSHOT_MODELS,
  buildPackshotPrompt,
  getAngle,
  isGrounded,
  type PackAngle,
} from "@/lib/packshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_REFERENCES = 6;

export async function POST(req: Request) {
  let label = "Packshot";
  try {
    const body = (await req.json()) as {
      targetAngle: PackAngle;
      modelId: string;
      references: { angle: PackAngle; dataUrl: string }[];
      productNotes?: string;
    };

    const spec = getAngle(body.targetAngle);
    label = spec.label;
    if (!PACKSHOT_MODELS.includes(body.modelId)) {
      return NextResponse.json(
        { error: `Model ${body.modelId} not allowed for packshots` },
        { status: 400 },
      );
    }
    const references = (body.references ?? []).slice(0, MAX_REFERENCES);
    if (references.length === 0) {
      return NextResponse.json(
        { error: "At least one reference photo is required" },
        { status: 400 },
      );
    }

    const model = getModel(body.modelId);
    const providedAngles = references.map((r) => r.angle);
    const grounded = isGrounded(body.targetAngle, providedAngles);
    const prompt = buildPackshotPrompt(body.targetAngle, providedAngles, body.productNotes);
    const cost = estimateCost(model.id);

    const live =
      !isDryRun() && (model.provider === "gemini" ? hasGeminiKey() : hasFalKey());

    if (!live) {
      return NextResponse.json({
        mock: true,
        imageDataUrl: mockImageDataUrl({
          label: `${spec.label} packshot`,
          sublabel: model.label,
          aspect: "1:1",
        }),
        prompt,
        grounded,
        cost: 0,
      });
    }

    if (model.provider === "gemini") {
      const { dataUrl } = await generateImage({
        model: model.endpoint,
        prompt,
        aspectRatio: "1:1",
        referenceImages: references.map((r) => dataUrlToInline(r.dataUrl)),
      });
      return NextResponse.json({ mock: false, imageDataUrl: dataUrl, prompt, grounded, cost });
    }

    const { url } = await falGenerateImage({
      endpoint: model.endpoint,
      prompt,
      aspectRatio: "1:1",
      referenceImageDataUrls: references.map((r) => r.dataUrl),
    });
    return NextResponse.json({ mock: false, imageUrl: url, prompt, grounded, cost });
  } catch (e) {
    console.error(`packshot generation failed (${label})`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Packshot generation failed" },
      { status: 500 },
    );
  }
}
