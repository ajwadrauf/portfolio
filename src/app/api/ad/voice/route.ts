import { NextResponse } from "next/server";
import { z } from "zod";
import { consume, liveJson, unlocked } from "@/lib/auth";
import { falGenerateVoice } from "@/lib/fal";
import { estimateCost, getModel, hasFalKey, isDryRun } from "@/lib/models";
import { mockMusicDataUrl } from "@/lib/mockAudio";
import { VOICES, VOICE_MODEL_ID } from "@/lib/soundPlan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = z.object({
    text: z.string().trim().min(1).max(1200).refine((s) => !/<[^>]*>/.test(s)),
    voice: z.enum(VOICES), stability: z.union([z.literal(0), z.literal(0.5), z.literal(1)]).default(0.5),
  }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use 1–1,200 spoken characters without markup and choose a listed voice." }, { status: 400 });
  try {
    const model = getModel(VOICE_MODEL_ID);
    const cost = estimateCost(VOICE_MODEL_ID, { characters: parsed.data.text.length });
    const spend = !isDryRun() && hasFalKey() && unlocked(req) ? consume(req) : null;
    if (!spend?.ok) return NextResponse.json({ mock: true, audioUrl: mockMusicDataUrl(3), cost: 0 });
    const { requestId } = await falGenerateVoice({ endpoint: model.endpoint, ...parsed.data });
    return liveJson(spend, { mock: false, status: "pending", requestId, modelId: VOICE_MODEL_ID, seconds: 0, cost });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Voice submission failed" }, { status: 500 });
  }
}
