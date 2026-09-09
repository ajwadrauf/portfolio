import { NextResponse } from "next/server";
import { z } from "zod";
import { falPollAudio } from "@/lib/fal";
import { getModel } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Status only: no submission, spend or session-budget decrement. */
export async function POST(req: Request) {
  const parsed = z.object({ modelId: z.enum(["eleven-music", "eleven-sfx", "eleven-voice"]), requestId: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "An audio model and request ID are required." }, { status: 400 });
  try {
    return NextResponse.json(await falPollAudio({ endpoint: getModel(parsed.data.modelId).endpoint, requestId: parsed.data.requestId }));
  } catch (e) {
    return NextResponse.json({ status: "pending", error: e instanceof Error ? e.message : "Could not check audio yet. The saved request can be checked again." }, { status: 503 });
  }
}
