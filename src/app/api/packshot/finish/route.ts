import { NextResponse } from "next/server";
import { consume, liveJson, unlocked } from "@/lib/auth";
import { hasRecraftKey, isDryRun } from "@/lib/models";
import { FINISH_OPS, recraftFinish, type FinishOp } from "@/lib/recraft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Body ceiling for an inline image.
 *
 * A serverless request body is capped at 4.5MB. Hosted results arrive as a
 * short URL and are nowhere near it; a Gemini result is a data URL and a 2K
 * PNG can be. Refusing with an explanation beats a 413 with none.
 */
const MAX_INLINE_BYTES = 3.6 * 1024 * 1024;

/**
 * Finishing pass over a generated packshot.
 *
 * Deliberately not a model in the picker: these are operations on an image
 * that already exists, they cost a fraction of a generation, and neither one
 * re-rolls the picture — which is the property that makes upscaling different
 * from regenerating at a higher tier.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { op: FinishOp; imageUrl: string };
    const spec = FINISH_OPS[body.op];
    if (!spec) {
      return NextResponse.json({ error: `Unknown operation: ${body.op}` }, { status: 400 });
    }
    if (!body.imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }
    if (body.imageUrl.startsWith("data:") && body.imageUrl.length * 0.75 > MAX_INLINE_BYTES) {
      return NextResponse.json(
        {
          error:
            "This render is too large to send through the finishing step inline. " +
            "Renders from fal and Recraft are hosted and always work; a large Gemini PNG is not. " +
            "Generate at a smaller tier, or run the angle on a hosted model.",
        },
        { status: 400 },
      );
    }

    const hasKey = hasRecraftKey();
    const spend = !isDryRun() && hasKey && unlocked(req) ? consume(req) : null;
    const live = spend?.ok ?? false;

    if (!live) {
      // Nothing to mock convincingly — a fake cutout would be the original
      // image with a claim attached, which is worse than saying so.
      return NextResponse.json({
        mock: true,
        error: hasKey
          ? "Finishing needs live mode — enter your access code to run it."
          : "Finishing runs on Recraft, and RECRAFT_API_TOKEN is not set.",
        cost: 0,
      });
    }

    const { url } = await recraftFinish({ op: body.op, imageUrl: body.imageUrl });
    return liveJson(spend, { mock: false, url, cost: spec.cost, op: body.op });
  } catch (e) {
    console.error("packshot finish failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Finishing failed" },
      { status: 500 },
    );
  }
}
