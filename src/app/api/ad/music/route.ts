import { NextResponse } from "next/server";
import { consume, liveJson, unlocked } from "@/lib/auth";
import { falGenerateMusic } from "@/lib/fal";
import { mockMusicDataUrl } from "@/lib/mockAudio";
import { estimateCost, getModel, hasFalKey, isDryRun } from "@/lib/models";
import { MUSIC_MODEL_ID, getMusicStyle, musicLengthFor } from "@/lib/music";
import { z } from "zod";
import { compositionSchema } from "@/lib/soundPlan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const parsed = z.object({ styleId: z.string(), durationSeconds: z.number().min(3).max(30), customPrompt: z.string().trim().max(2000).optional(), timingReference: z.boolean().default(false), compositionPlan: compositionSchema.optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Use a 3–30 second cut and a music brief under 2,000 characters." }, { status: 400 });
    const body = parsed.data;

    // A structured score follows exact section lengths; a free bed gets handles.
    const seconds = body.compositionPlan ? body.compositionPlan.sections.reduce((sum, s) => sum + s.duration_ms, 0) / 1000 : musicLengthFor(body.durationSeconds, body.timingReference);
    if (body.compositionPlan && Math.abs(seconds - body.durationSeconds) > 0.001) return NextResponse.json({ error: "Music section lengths must add up to the video duration." }, { status: 400 });
    let prompt: string;
    try { prompt = body.customPrompt || getMusicStyle(body.styleId).prompt; }
    catch { return NextResponse.json({ error: "Choose a known music style or write a custom brief." }, { status: 400 }); }
    if (!prompt && !body.compositionPlan) return NextResponse.json({ error: "Choose a music style or write a brief first." }, { status: 400 });
    const model = getModel(MUSIC_MODEL_ID);
    const cost = estimateCost(MUSIC_MODEL_ID, { seconds });

    const spend =
      !isDryRun() && hasFalKey() && unlocked(req) ? consume(req) : null;
    if (!spend?.ok) {
      return NextResponse.json({
        mock: true,
        audioUrl: mockMusicDataUrl(seconds),
        prompt,
        cost: 0,
      });
    }

    const { requestId } = await falGenerateMusic({
      endpoint: model.endpoint,
      prompt,
      durationSeconds: seconds,
      compositionPlan: body.compositionPlan,
    });
    return liveJson(spend, { mock: false, status: "pending", requestId, modelId: MUSIC_MODEL_ID, prompt, seconds, cost });
  } catch (e) {
    console.error("music generation failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Music generation failed" },
      { status: 500 },
    );
  }
}
