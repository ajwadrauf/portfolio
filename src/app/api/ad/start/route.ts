import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isStarterClipPath } from "@/lib/referenceClips";
import { falUpload } from "@/lib/fal";
import { resolutionsFor, type VideoResolution } from "@/lib/videoCost";
import { consume, liveJson, unlocked } from "@/lib/auth";
import {
  AD_VIDEO_MODELS,
  supportsNegativePromptField,
  withExclusions,
  snapAdSeconds,
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
import { audioReferenceProblem } from "@/lib/adAudio";
import { VELUNE_MEDIA } from "@/components/velune/veluneStudy";
import { VELUNE_REFERENCES } from "@/lib/veluneReferences";

export const dynamic = "force-dynamic";

/** Seedance's own ceiling for a reference clip; nothing longer is accepted. */
const MAX_CLIP_SECONDS = 30.2;
export const maxDuration = 60;

/** Hosts fal cannot reach from its own network. */
const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

/** One upload per starter clip per process, not one per generation. */
const starterClipUrls = new Map<string, string>();
// Keep the explicit allowlist aligned with the files the example actually loads.
// No arbitrary site-relative paths may reach the local file upload branch.
const VELUNE_SOURCES = new Set<string>([
  ...Object.values(VELUNE_MEDIA),
  ...VELUNE_REFERENCES.map((reference) => reference.url),
]);
const MAX_BODY_BYTES = 4_194_304;

function validReference(value: unknown, media: "image" | "video" | "audio"): value is string {
  if (typeof value !== "string" || !value || value.length > MAX_BODY_BYTES) return false;
  if (value.startsWith("data:")) return new RegExp(`^data:${media}/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$`, "i").test(value);
  if (VELUNE_SOURCES.has(value)) return media === (value.endsWith(".mp4") ? "video" : "image");
  if (media === "video" && /^\/references\/[a-zA-Z0-9_/-]+\.(mp4|webm|mov)$/.test(value) && !value.includes("..")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !PRIVATE_HOST.test(url.hostname); } catch { return false; }
}

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
    new Blob([new Uint8Array(bytes)], { type: pathname.endsWith(".mp4") ? "video/mp4" : "image/jpeg" }),
  );
  starterClipUrls.set(pathname, url);
  return url;
}

/** Starts a mini-ad video job from a composed prompt. Polled via /api/generate/video/status. */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "The combined prompt and references exceed the 4 MiB request limit. Use smaller images or hosted media links." }, { status: 413 });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: "Malformed JSON request." }, { status: 400 }); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "An ad request object is required." }, { status: 400 });
    const body = parsed as {
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
      referenceAudioDurations?: number[];
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

    if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 30_000) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (!AD_VIDEO_MODELS.includes(body.modelId)) {
      return NextResponse.json(
        { error: `Model ${body.modelId} not allowed for ads` },
        { status: 400 },
      );
    }
    for (const [media, references, limit] of [["image", body.referenceImageDataUrls, REF_CEILINGS.image - (body.imageDataUrl ? 1 : 0)], ["video", body.referenceVideoUrls, REF_CEILINGS.video], ["audio", body.referenceAudioUrls, REF_CEILINGS.audio]] as const) {
      if (references === undefined) continue;
      if (!Array.isArray(references)) return NextResponse.json({ error: `Invalid ${media} references: a file list is required. No references were discarded or submitted.` }, { status: 400 });
      if (references.length > limit) return NextResponse.json({ error: `Too many ${media} references: ${references.length} attached; attach at most ${limit}. No references were discarded or submitted.` }, { status: 400 });
      const invalidIndex = references.findIndex((reference) => !validReference(reference, media));
      if (invalidIndex !== -1) {
        const position = invalidIndex + 1 + (media === "image" && body.imageDataUrl ? 1 : 0);
        const token = `[${media[0].toUpperCase()}${media.slice(1)}${position}]`;
        return NextResponse.json({ error: `Unsupported ${media} reference ${token}. Reattach that file or use a public HTTPS media URL. No references were discarded or submitted.` }, { status: 400 });
      }
    }
    if ((body.imageDataUrl !== undefined && !validReference(body.imageDataUrl, "image")) || (body.endImageDataUrl !== undefined && !validReference(body.endImageDataUrl, "image"))) return NextResponse.json({ error: "Invalid first or end image reference." }, { status: 400 });
    if (body.referenceAudioDurations !== undefined && (!Array.isArray(body.referenceAudioDurations) || !body.referenceAudioDurations.every((seconds) => typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0))) return NextResponse.json({ error: "Audio durations must be positive finite numbers." }, { status: 400 });

    const model = getModel(body.modelId);
    if (AUDIO_REF_MODELS.includes(body.modelId) && body.referenceAudioUrls?.length) {
      const audioCount = body.referenceAudioUrls.length;
      const visualCount = (body.imageDataUrl ? 1 : 0) + (body.referenceImageDataUrls?.length ?? 0) + (body.referenceVideoUrls?.length ?? 0);
      if (audioCount > 10 || visualCount === 0) return NextResponse.json({ error: "Seedance audio needs at least one image or video and at most 10 audio files." }, { status: 400 });
      if (body.referenceAudioDurations) {
        const problem = body.referenceAudioDurations.length !== audioCount ? "Audio durations must match the audio references." : audioReferenceProblem(body.referenceAudioDurations, visualCount);
        if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      }
    }
    // Clamped to the model's ceiling, then snapped to a length it will
    // actually accept — Kling publishes duration as an enum, so an in-range
    // value it does not list is still a 422.
    const seconds = snapAdSeconds(
      body.modelId,
      Math.min(Math.max(body.durationSeconds ?? 8, 4), maxAdSeconds(body.modelId)),
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
    const allImageRefs = [body.imageDataUrl, ...(body.referenceImageDataUrls ?? [])].filter(
      (u): u is string => Boolean(u),
    );
    const origin = new URL(req.url).origin;
    // Only bundled, explicitly named concept media may be read from this extra directory.
    // Preparation occurs only after the existing live gate; demo requests never upload anything.
    const allRefs = await Promise.all(allImageRefs.map((url) => VELUNE_SOURCES.has(url) ? resolveClipUrl(url, origin) : url));
    const rawVideoRefs = multiRef ? (body.referenceVideoUrls ?? []) : [];
    // Starter clips arrive as site-relative paths and have to be made
    // fetchable before they are any use to the model.
    const videoRefs: string[] = [];
    for (const u of rawVideoRefs) {
      try {
        videoRefs.push(isStarterClipPath(u) || VELUNE_SOURCES.has(u) ? await resolveClipUrl(u, origin) : u);
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
      prompt: supportsNegativePromptField(model.id)
        ? body.prompt
        : withExclusions(body.prompt, body.negativePrompt),
      durationSeconds: seconds,
      aspectRatio: body.aspect,
      referenceImageDataUrl: multiRef ? undefined : body.imageDataUrl,
      // Only the single-image endpoints define an end frame; sending it to a
      // reference endpoint that has no such field is a 422.
      endImageDataUrl: supportsEndFrame(body.modelId) ? body.endImageDataUrl : undefined,
      referenceImageDataUrls: multiRef ? allRefs : undefined,
      referenceVideoUrls: videoRefs,
      referenceAudioUrls: audioRefs,
      generateAudio: cap.switchable ? (body.generateAudio ?? true) : undefined,
      resolution: model.id.startsWith("seedance") ? resolution : undefined,
      /*
       * Only where the endpoint publishes the field. Everywhere else the same
       * constraints ride the prompt (see the prompt argument above), because a
       * field an endpoint does not define is dropped in silence — and these
       * are the constraints the product depends on.
       */
      negativePrompt: supportsNegativePromptField(model.id) ? body.negativePrompt : undefined,
    });
    return liveJson(spend, { mock: false, provider: "fal", falRequestId: requestId, cost });
  } catch (e) {
    console.error("ad start failed", e);
    const error = e instanceof Error ? e.message : "Ad generation failed to start";
    return NextResponse.json({ error }, { status: 500 });
  }
}
