import { NextResponse } from "next/server";
import { consume, liveJson, unlocked } from "@/lib/auth";
import {
  AD_VIDEO_MODELS,
  AUDIO_REF_MODELS,
  MULTI_REF_MODELS,
  REF_CEILINGS,
  audioCapability,
  maxAdSeconds,
} from "@/lib/adPresets";
import { falStartVideo } from "@/lib/fal";
import { dataUrlToInline, startVeo } from "@/lib/gemini";
import { estimateCost, getModel, hasFalKey, hasGeminiKey, isDryRun } from "@/lib/models";
import { mockImageDataUrl } from "@/lib/mock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Starts a mini-ad video job from a composed prompt. Polled via /api/generate/video/status. */
export async function POST(req: Request) {
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
    const cost = estimateCost(model.id, { seconds });

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
    const allRefs = [body.imageDataUrl, ...(body.referenceImageDataUrls ?? [])].filter(
      (u): u is string => Boolean(u),
    );
    const videoRefs = multiRef ? (body.referenceVideoUrls ?? []) : [];
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
      referenceImageDataUrls: multiRef ? allRefs.slice(0, REF_CEILINGS.image) : undefined,
      referenceVideoUrls: videoRefs.slice(0, REF_CEILINGS.video),
      referenceAudioUrls: audioRefs.slice(0, REF_CEILINGS.audio),
      generateAudio: cap.switchable ? (body.generateAudio ?? true) : undefined,
      negativePrompt: body.negativePrompt,
    });
    return liveJson(spend, { mock: false, provider: "fal", falRequestId: requestId, cost });
  } catch (e) {
    console.error("ad start failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ad generation failed to start" },
      { status: 500 },
    );
  }
}
