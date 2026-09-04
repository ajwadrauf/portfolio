import { NextResponse } from "next/server";
import { consume, liveJson, unlocked } from "@/lib/auth";
import { falGenerateImage } from "@/lib/fal";
import { dataUrlToInline, generateImage } from "@/lib/gemini";
import { estimateCost, getModel, hasFalKey, hasGeminiKey, hasRecraftKey, isDryRun } from "@/lib/models";
import { recraftImageToImage } from "@/lib/recraft";
import { mockImageDataUrl } from "@/lib/mock";
import {
  PACKSHOT_MODELS,
  buildPackshotPrompt,
  getAngle,
  isGrounded,
  resolveSize,
  type PackAngle,
  type PackBrief,
} from "@/lib/packshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ceiling across all models. The per-model cap is tighter on most of them and
 * is enforced below — three references on Gemini Flash Image, two on Kontext.
 */
const MAX_REFERENCES = 16;

export async function POST(req: Request) {
  let label = "Packshot";
  try {
    const body = (await req.json()) as {
      targetAngle: PackAngle;
      modelId: string;
      references: { angle: PackAngle; dataUrl: string }[];
      brief?: Partial<PackBrief>;
      productNotes?: string;
      sizePresetId?: string;
      sizePx?: number;
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
    /*
     * Enforced here, not just warned about in the UI.
     *
     * Over the cap the provider drops the extras or rejects the call. Dropping
     * is the worse outcome: the angle you uploaded to ground a face is gone,
     * the render still succeeds, and it comes back a reconstruction labelled
     * as grounded. Better to refuse and say which references to remove.
     */
    const refCap = model.maxReferenceImages ?? MAX_REFERENCES;
    if (references.length > refCap) {
      return NextResponse.json(
        {
          error:
            `${model.label} accepts ${refCap} reference image${refCap === 1 ? "" : "s"}, and ${references.length} were sent. ` +
            `Remove ${references.length - refCap}, or switch to a model with a higher limit.`,
        },
        { status: 400 },
      );
    }

    const size = resolveSize(model.outputSizes, {
      presetId: body.sizePresetId,
      px: body.sizePx,
    });
    const providedAngles = references.map((r) => r.angle);
    const grounded = isGrounded(body.targetAngle, providedAngles);
    const prompt = buildPackshotPrompt(
      body.targetAngle,
      providedAngles,
      body.brief ?? body.productNotes,
    );
    // Reference images are billed as input on some edit endpoints, so the
    // estimate has to know how many are going up, not just what comes back.
    // Priced against the size that will actually be rendered, not the one
    // requested — resolveSize may have snapped it — and against the references
    // going up, which some edit endpoints bill as input.
    const cost = estimateCost(model.id, {
      referenceImages: references.length,
      sizePresetId: size.presetId,
      sizePx: size.px,
    });

    const hasKey =
      model.provider === "gemini"
        ? hasGeminiKey()
        : model.provider === "recraft"
          ? hasRecraftKey()
          : hasFalKey();
    // Gate first, then spend a unit of this session's budget. Either failing
    // degrades to demo mode rather than erroring.
    const spend = !isDryRun() && hasKey && unlocked(req) ? consume(req) : null;
    const live = spend?.ok ?? false;

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
        // Only the Pro tier exposes a size; Flash renders ~1MP regardless, so
        // it is left unset rather than sent and ignored.
        imageSize: model.outputSizes?.mode === "tiers" ? size.presetId : undefined,
        referenceImages: references.map((r) => dataUrlToInline(r.dataUrl)),
      });
      return liveJson(spend, {
        mock: false,
        imageDataUrl: dataUrl,
        prompt,
        grounded,
        cost,
        sizeNote: size.note,
        renderedPx: size.px,
      });
    }

    if (model.provider === "recraft") {
      /*
       * Single-reference restage. Recraft takes one image, so the reference
       * cap above has already held this to one — this picks the one that best
       * grounds the target rather than whichever was uploaded first.
       *
       * `strength` is the whole game here: too low and the output is the input
       * with the same camera on it, too high and the label stops being the
       * label. 0.35 is a compromise that moves the staging while holding the
       * artwork, and it is stated in the response so a bad result is
       * attributable rather than mysterious.
       */
      const best =
        references.find((r) => getAngle(body.targetAngle).groundedBy.includes(r.angle)) ??
        references[0];
      const strength = 0.35;
      const { url: recraftUrl } = await recraftImageToImage({
        model: model.endpoint,
        prompt,
        imageDataUrl: best.dataUrl,
        strength,
        size: size.presetId,
      });
      return liveJson(spend, {
        mock: false,
        imageUrl: recraftUrl,
        prompt,
        grounded,
        cost,
        sizeNote: size.note,
        renderedPx: size.px,
        strength,
      });
    }

    const { url } = await falGenerateImage({
      endpoint: model.endpoint,
      prompt,
      aspectRatio: "1:1",
      sizeField: model.sizeField,
      // A tier id goes on the wire as fal's own enum; explicit pixels only
      // where the endpoint publishes a range for them.
      sizePreset: model.outputSizes?.mode === "tiers" ? size.presetId : undefined,
      sizePixels:
        model.outputSizes?.mode === "pixels" && size.px
          ? { width: size.px, height: size.px }
          : undefined,
      referenceImageDataUrls: references.map((r) => r.dataUrl),
    });
    return liveJson(spend, {
      mock: false,
      imageUrl: url,
      prompt,
      grounded,
      cost,
      sizeNote: size.note,
      renderedPx: size.px,
    });
  } catch (e) {
    console.error(`packshot generation failed (${label})`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Packshot generation failed" },
      { status: 500 },
    );
  }
}
