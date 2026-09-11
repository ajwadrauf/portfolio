import { NextResponse } from "next/server";
import { consume, liveJson, unlocked } from "@/lib/auth";
import { falGenerateImage } from "@/lib/fal";
import { dataUrlToInline, generateImage } from "@/lib/gemini";
import { estimateCost, getModel, hasFalKey, hasGeminiKey, hasRecraftKey, isDryRun } from "@/lib/models";
import { recraftImageToImage } from "@/lib/recraft";
import { mockImageDataUrl } from "@/lib/mock";
import {
  PACKSHOT_MODELS,
  PACK_ANGLES,
  EMPTY_BRIEF,
  MAX_PACKSHOT_BODY_BYTES,
  MAX_PACKSHOT_REFERENCES,
  MAX_PACKSHOT_REFERENCE_BYTES,
  buildPackshotPrompt,
  getAngle,
  getCoverage,
  resolveSize,
  type PackAngle,
  type PackBrief,
  type PackFace,
  type PackReference,
} from "@/lib/packshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

class PackshotInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type PackshotRequest = {
  targetAngle: PackAngle;
  modelId: string;
  references: PackReference[];
  brief?: Partial<PackBrief>;
  productNotes?: string;
  sizePresetId?: string;
  sizePx?: number;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const angle = (value: unknown): value is PackAngle =>
  typeof value === "string" && PACK_ANGLES.some((spec) => spec.id === value);

/** Bound bytes while reading; Content-Length alone is neither required nor trusted. */
async function readBody(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > MAX_PACKSHOT_BODY_BYTES) {
    throw new PackshotInputError("Packshot request exceeds the 4 MiB upload limit. Use smaller or fewer references.", 413);
  }
  if (!req.body) throw new PackshotInputError("A JSON request body is required.");
  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_PACKSHOT_BODY_BYTES) {
        await reader.cancel();
        throw new PackshotInputError("Packshot request exceeds the 4 MiB upload limit. Use smaller or fewer references.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof PackshotInputError) throw error;
    throw new PackshotInputError("Send valid JSON encoded as UTF-8.");
  } finally {
    reader.releaseLock();
  }
}

function validateDataUrl(value: unknown, index: number): string {
  const prefix = `Reference ${index + 1}`;
  if (typeof value !== "string") throw new PackshotInputError(`${prefix} needs an image data URL.`);
  if (value.length > Math.ceil(MAX_PACKSHOT_REFERENCE_BYTES / 3) * 4 + 32) {
    throw new PackshotInputError(`${prefix} exceeds the 600 KiB image limit. Resize it before uploading.`, 413);
  }
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) {
    throw new PackshotInputError(`${prefix} must be a base64 JPEG, PNG or WebP image.`);
  }
  const image = Buffer.from(match[2], "base64");
  if (image.length > MAX_PACKSHOT_REFERENCE_BYTES) throw new PackshotInputError(`${prefix} exceeds the 600 KiB image limit.`, 413);
  const signatureValid = match[1] === "jpeg"
    ? image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : match[1] === "png"
      ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : image.length >= 12 && image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP";
  if (!signatureValid || image.toString("base64") !== match[2]) {
    throw new PackshotInputError(`${prefix} does not contain a valid ${match[1].toUpperCase()} image header.`);
  }
  return value;
}

function parseBody(value: unknown): PackshotRequest {
  if (!record(value)) throw new PackshotInputError("A JSON object is required.");
  if (!angle(value.targetAngle)) throw new PackshotInputError("Choose a valid target angle.");
  if (typeof value.modelId !== "string" || !PACKSHOT_MODELS.includes(value.modelId)) {
    throw new PackshotInputError("Choose a model supported by the packshot studio.");
  }
  if (!Array.isArray(value.references) || value.references.length === 0) {
    throw new PackshotInputError("At least one reference photo is required.");
  }
  const model = getModel(value.modelId);
  const cap = Math.min(MAX_PACKSHOT_REFERENCES, model.maxReferenceImages ?? MAX_PACKSHOT_REFERENCES);
  if (value.references.length > cap) {
    throw new PackshotInputError(`${model.label} accepts ${cap} reference image${cap === 1 ? "" : "s"}, and ${value.references.length} were sent. Remove ${value.references.length - cap}, or switch to a model with a higher limit.`);
  }
  const references = value.references.map((ref, index): PackReference => {
    if (!record(ref) || !angle(ref.angle)) throw new PackshotInputError(`Reference ${index + 1} needs a valid angle.`);
    const dataUrl = validateDataUrl(ref.dataUrl, index);
    if (ref.visibleFaces !== undefined && (
      !Array.isArray(ref.visibleFaces) || ref.visibleFaces.length > 6 ||
      ref.visibleFaces.some((face) => !angle(face) || face === "hero34") ||
      new Set(ref.visibleFaces).size !== ref.visibleFaces.length
    )) throw new PackshotInputError(`Reference ${index + 1} needs a list of distinct visible package faces.`);
    for (const key of ["name", "id"] as const) {
      if (ref[key] !== undefined && (typeof ref[key] !== "string" || ref[key].length > 256)) {
        throw new PackshotInputError(`Reference ${index + 1} ${key} must be text of at most 256 characters.`);
      }
    }
    return { angle: ref.angle, dataUrl, visibleFaces: ref.visibleFaces as PackFace[] | undefined, name: ref.name as string | undefined, id: ref.id as string | undefined };
  });
  let brief: Partial<PackBrief> | undefined;
  if (value.brief !== undefined) {
    if (!record(value.brief)) throw new PackshotInputError("Pack brief must be an object of text fields.");
    brief = {};
    for (const key of Object.keys(EMPTY_BRIEF) as (keyof PackBrief)[]) {
      const text = value.brief[key];
      if (text === undefined) continue;
      if (typeof text !== "string" || text.length > 4000) throw new PackshotInputError(`Brief ${key} must be text of at most 4000 characters.`);
      brief[key] = text;
    }
  }
  if (value.productNotes !== undefined && (typeof value.productNotes !== "string" || value.productNotes.length > 4000)) {
    throw new PackshotInputError("Product notes must be text of at most 4000 characters.");
  }
  if (value.sizePx !== undefined && (typeof value.sizePx !== "number" || !Number.isInteger(value.sizePx) || value.sizePx <= 0 || value.sizePx > 16384)) {
    throw new PackshotInputError("Requested size must be a whole pixel count between 1 and 16384.");
  }
  if (value.sizePresetId !== undefined && (typeof value.sizePresetId !== "string" || !value.sizePresetId || value.sizePresetId.length > 64)) {
    throw new PackshotInputError("Output-size preset must be a nonempty name of at most 64 characters.");
  }
  if (typeof value.sizePresetId === "string" && !PACKSHOT_MODELS.some((id) => getModel(id).outputSizes?.presets.some((preset) => preset.id === value.sizePresetId))) {
    throw new PackshotInputError("Choose a recognized output-size preset or send an explicit pixel size.");
  }
  return { targetAngle: value.targetAngle, modelId: value.modelId, references, brief, productNotes: value.productNotes as string | undefined, sizePresetId: value.sizePresetId as string | undefined, sizePx: value.sizePx as number | undefined };
}

export async function POST(req: Request) {
  let label = "Packshot";
  try {
    const body = parseBody(await readBody(req));

    const spec = getAngle(body.targetAngle);
    label = spec.label;
    const references = body.references;
    const model = getModel(body.modelId);
    const size = resolveSize(model.outputSizes, {
      presetId: body.sizePresetId,
      px: body.sizePx,
    });
    const coverage = getCoverage(body.targetAngle, references);
    const grounded = coverage.status === "full";
    const prompt = buildPackshotPrompt(
      body.targetAngle,
      references,
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
        coverage,
        cost: 0,
        sizeNote: size.note,
        renderedPx: size.px,
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
        coverage,
        cost,
        sizeNote: size.note,
        renderedPx: size.px,
      });
    }

    if (model.provider === "recraft") {
      /*
       * Single-reference restage. Recraft takes one image, so the reference
       * cap above has already held this to exactly one.
       *
       * `strength` is the whole game here: too low and the output is the input
       * with the same camera on it, too high and the label stops being the
       * label. 0.35 is a compromise that moves the staging while holding the
       * artwork, and it is stated in the response so a bad result is
       * attributable rather than mysterious.
       */
      const best = references[0];
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
        coverage,
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
      coverage,
      cost,
      sizeNote: size.note,
      renderedPx: size.px,
    });
  } catch (e) {
    if (e instanceof PackshotInputError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(`packshot generation failed (${label})`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Packshot generation failed" },
      { status: 500 },
    );
  }
}
