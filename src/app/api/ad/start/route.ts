import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isStarterClipPath } from "@/lib/referenceClips";
import { falUpload } from "@/lib/fal";
import { resolutionsFor, type VideoResolution } from "@/lib/videoCost";
import { consume, liveJson, unlocked } from "@/lib/auth";
import {
  AD_VIDEO_MODELS,
  AUDIO_REF_MODELS,
  MULTI_REF_MODELS,
  REF_CEILINGS,
  audioCapability,
  maxAdSeconds,
  supportsEndFrame,
} from "@/lib/adPresets";
import { falStartVideo } from "@/lib/fal";
import { dataUrlToInline, startVeo } from "@/lib/gemini";
import { estimateCost, getModel, hasFalKey, hasGeminiKey, isDryRun } from "@/lib/models";
import { mockImageDataUrl } from "@/lib/mock";

export const dynamic = "force-dynamic";

/** Seedance's own ceiling for a reference clip; nothing longer is accepted. */
const MAX_CLIP_SECONDS = 30.2;
export const maxDuration = 60;

/** Hosts fal cannot reach from its own network. */
const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

/** One upload per starter clip per process, not one per generation. */
const starterClipUrls = new Map<string, string>();

/**
 * Turns a starter clip's site-relative path into something fal can fetch.
 *
 * fal pulls reference URLs from its own servers, so "/references/x.mp4" means
 * nothing to it and localhost means less. On a deployed site the public URL
 * is enough. On a laptop it is not, so the file is read off disk and pushed
 * to fal's storage instead — the same path a user upload takes.
 */
async function resolveClipUrl(pathname: string, origin: string): Promise<string> {
  const cached = starterClipUrls.get(pathname);
  if (cached) return cached;

  const host = (() => {
    try {
      return new URL(origin).host;
    } catch {
      return "";
    }
  })();

  if (host && !PRIVATE_HOST.test(host)) {
    const url = new URL(pathname, origin).toString();
    starterClipUrls.set(pathname, url);
    return url;
  }

  // Not publicly reachable — hand the bytes to fal directly.
  const file = path.join(process.cwd(), "public", pathname.replace(/^\//, ""));
  const bytes = await fs.readFile(file);
  const { url } = await falUpload(
    new Blob([new Uint8Array(bytes)], { type: "video/mp4" }),
  );
  starterClipUrls.set(pathname, url);
  return url;
}

/** Starts a mini-ad video job from a composed prompt. Polled via /api/generate/video/status. */
export async function POST(req: Request) {
  // Hoisted so the error path can tell whether the stills were fetched by the
  // provider or carried inside the request, which changes what a rejection
  // can possibly mean.
  let allImageRefs: string[] = [];
  try {
    const body = (await req.json()) as {
      prompt: string;
      negativePrompt?: string;
      modelId: string;
      aspect: "9:16" | "16:9";
      durationSeconds: number;
      imageDataUrl?: string;
      /** Extra image references (data URLs) for reference-to-video models. */
      referenceImageDataUrls?: string[];
      /** Video reference URLs, already uploaded to the provider's storage. */
      referenceVideoUrls?: string[];
      /** Audio reference URLs, already uploaded — timing signals, not stems. */
      referenceAudioUrls?: string[];
      /** False renders the take silent at the API level, where the model allows it. */
      generateAudio?: boolean;
      /** Pixel tier. On token-billed models this drives most of the cost. */
      resolution?: VideoResolution;
      /** Measured total duration of the supplied clips, which is billed too. */
      inputVideoSeconds?: number;
      /** Optional frame to land on, for endpoints that interpolate two stills. */
      endImageDataUrl?: string;
      presetName?: string;
    };

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (!AD_VIDEO_MODELS.includes(body.modelId)) {
      return NextResponse.json(
        { error: `Model ${body.modelId} not allowed for ads` },
        { status: 400 },
      );
    }

    const model = getModel(body.modelId);
    const seconds = Math.min(
      Math.max(body.durationSeconds ?? 8, 4),
      maxAdSeconds(body.modelId),
    );
    /*
     * Validated against what THIS endpoint renders, not against the full list.
     * A resolution the endpoint does not publish is a 422 at submit time,
     * after the estimate has been shown and the confirm dialog accepted — so
     * an out-of-range value falls back to the best size this model does
     * render, which is also the size the cost below is computed from.
     */
    const allowed = resolutionsFor(body.modelId);
    const resolution: VideoResolution = allowed.includes(body.resolution!)
      ? body.resolution!
      : allowed[allowed.length - 1];
    /*
     * Billed input duration. The client measures each clip from its own
     * metadata and sends the total; this was previously a flat five seconds
     * per clip, which under-read a 12s clay pass by more than half and put
     * the difference on the bill without it ever appearing in the estimate.
     *
     * The client's figure is clamped rather than trusted outright — it
     * decides what gets charged against the session budget, so a bad value
     * should be capped instead of believed. The fallback keeps the old
     * nominal figure for a clip whose duration could not be read.
     */
    const clipCount = body.referenceVideoUrls?.length ?? 0;
    const claimed = Number(body.inputVideoSeconds);
    const inputVideoSeconds =
      Number.isFinite(claimed) && claimed >= 0
        ? Math.min(claimed, clipCount * MAX_CLIP_SECONDS)
        : clipCount * 5;
    const cost = estimateCost(model.id, {
      seconds,
      resolution,
      aspect: body.aspect,
      hasVideoInputs: inputVideoSeconds > 0,
      inputVideoSeconds,
    });

    const hasKey = model.provider === "gemini" ? hasGeminiKey() : hasFalKey();
    const spend = !isDryRun() && hasKey && unlocked(req) ? consume(req) : null;
    const live = spend?.ok ?? false;

    if (!live) {
      return NextResponse.json({
        mock: true,
        posterDataUrl: mockImageDataUrl({
          label: body.presetName ?? "Mini ad",
          sublabel: model.label,
          aspect: body.aspect,
        }),
        cost: 0,
      });
    }

    if (model.provider === "gemini") {
      const { operationName } = await startVeo({
        model: model.endpoint,
        prompt: body.prompt,
        negativePrompt: body.negativePrompt,
        aspectRatio: body.aspect,
        durationSeconds: seconds,
        firstFrame: body.imageDataUrl ? dataUrlToInline(body.imageDataUrl) : undefined,
      });
      return liveJson(spend, { mock: false, provider: "gemini", operationName, cost });
    }

    // Reference-to-video models take every reference positionally; the rest
    // take a single grounding frame.
    const multiRef = MULTI_REF_MODELS.includes(body.modelId);
    allImageRefs = [body.imageDataUrl, ...(body.referenceImageDataUrls ?? [])].filter(
      (u): u is string => Boolean(u),
    );
    const allRefs = allImageRefs;
    const rawVideoRefs = multiRef ? (body.referenceVideoUrls ?? []) : [];
    // Starter clips arrive as site-relative paths and have to be made
    // fetchable before they are any use to the model.
    const origin = new URL(req.url).origin;
    const videoRefs: string[] = [];
    for (const u of rawVideoRefs) {
      try {
        videoRefs.push(isStarterClipPath(u) ? await resolveClipUrl(u, origin) : u);
      } catch (e) {
        return NextResponse.json(
          {
            error:
              `Could not make the starter clip ${u} reachable by the generation provider. ` +
              `On a deployed site its public URL is used directly; locally it has to be uploaded first, which needs fal storage. ` +
              (e instanceof Error ? e.message : ""),
          },
          { status: 400 },
        );
      }
    }
    // Audio references are a Seedance Reference feature — sending them to an
    // endpoint that doesn't define the field would just fail validation.
    const audioRefs = AUDIO_REF_MODELS.includes(body.modelId)
      ? (body.referenceAudioUrls ?? [])
      : [];
    // Only pass the native-audio switch to models that actually expose one;
    // the rest are told to stay silent in the prompt instead.
    const cap = audioCapability(body.modelId);
    const { requestId } = await falStartVideo({
      endpoint: model.endpoint,
      prompt: body.prompt,
      durationSeconds: seconds,
      aspectRatio: body.aspect,
      referenceImageDataUrl: multiRef ? undefined : body.imageDataUrl,
      // Only the single-image endpoints define an end frame; sending it to a
      // reference endpoint that has no such field is a 422.
      endImageDataUrl: supportsEndFrame(body.modelId) ? body.endImageDataUrl : undefined,
      referenceImageDataUrls: multiRef ? allRefs.slice(0, REF_CEILINGS.image) : undefined,
      referenceVideoUrls: videoRefs.slice(0, REF_CEILINGS.video),
      referenceAudioUrls: audioRefs.slice(0, REF_CEILINGS.audio),
      generateAudio: cap.switchable ? (body.generateAudio ?? true) : undefined,
      resolution: model.id.startsWith("seedance") ? resolution : undefined,
      negativePrompt: body.negativePrompt,
    });
    return liveJson(spend, { mock: false, provider: "fal", falRequestId: requestId, cost });
  } catch (e) {
    console.error("ad start failed", e);
    let error = e instanceof Error ? e.message : "Ad generation failed to start";
    /*
     * A content-filter rejection already establishes that the files were read,
     * because fal reports an unreachable file under a different type entirely.
     * Inlining adds one more thing that cannot be at fault, so it is worth a
     * clause rather than a different explanation.
     */
    const inlinedOnly =
      allImageRefs.length > 0 && allImageRefs.every((u) => u.startsWith("data:"));
    if (inlinedOnly && /content filter/i.test(error)) {
      error +=
        " These stills were also sent inline rather than fetched, and resized, flattened and re-encoded on the way, so nothing about hosting or file handling is involved either.";
    }
    return NextResponse.json({ error }, { status: 500 });
  }
}
