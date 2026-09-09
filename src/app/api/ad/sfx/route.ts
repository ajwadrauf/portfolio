import { NextResponse } from "next/server";
import { consume, liveJson, unlocked } from "@/lib/auth";
import { falGenerateSoundEffect } from "@/lib/fal";
import { mockSfxDataUrl } from "@/lib/mockAudio";
import { estimateCost, getModel, hasFalKey, isDryRun } from "@/lib/models";
import { SFX_LIMITS, SFX_MODEL_ID, clampSfxSeconds } from "@/lib/sfx";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Generates one named spot effect. One event per call — see lib/sfx.ts. */
export async function POST(req: Request) {
  try {
    const parsed = z.object({ text: z.string().trim().min(1).max(600), durationSeconds: z.number().min(SFX_LIMITS.minSeconds).max(SFX_LIMITS.maxSeconds).default(SFX_LIMITS.defaultSeconds), loop: z.boolean().default(false) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Describe one effect in 1–600 characters and choose a duration from 0.5 to 22 seconds." }, { status: 400 });
    const body = parsed.data;

    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Describe the effect first." }, { status: 400 });
    }
    if (text.length > 600) {
      return NextResponse.json(
        { error: "That description is too long — one event, described physically." },
        { status: 400 },
      );
    }

    const seconds = clampSfxSeconds(body.durationSeconds ?? SFX_LIMITS.defaultSeconds);
    const model = getModel(SFX_MODEL_ID);
    const cost = estimateCost(SFX_MODEL_ID, { seconds });

    const spend = !isDryRun() && hasFalKey() && unlocked(req) ? consume(req) : null;
    if (!spend?.ok) {
      return NextResponse.json({
        mock: true,
        audioUrl: mockSfxDataUrl(seconds),
        cost: 0,
      });
    }

    const { requestId } = await falGenerateSoundEffect({
      endpoint: model.endpoint,
      text,
      durationSeconds: seconds,
      promptInfluence: SFX_LIMITS.defaultInfluence,
      loop: body.loop === true,
    });
    return liveJson(spend, { mock: false, status: "pending", requestId, modelId: SFX_MODEL_ID, seconds, cost });
  } catch (e) {
    console.error("sound effect generation failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sound effect generation failed" },
      { status: 500 },
    );
  }
}
