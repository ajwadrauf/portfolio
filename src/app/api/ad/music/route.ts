import { NextResponse } from "next/server";
import { falGenerateMusic } from "@/lib/fal";
import { mockMusicDataUrl } from "@/lib/mockAudio";
import { estimateCost, getModel, hasFalKey, isDryRun } from "@/lib/models";
import { MUSIC_MODEL_ID, getMusicStyle, musicLengthFor } from "@/lib/music";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      styleId: string;
      durationSeconds: number;
      customPrompt?: string;
    };

    // Generate past the cut length so the edit has trim handles.
    const cutSeconds = Math.min(Math.max(body.durationSeconds ?? 8, 3), 30);
    const seconds = musicLengthFor(cutSeconds);
    const prompt = body.customPrompt?.trim() || getMusicStyle(body.styleId).prompt;
    const model = getModel(MUSIC_MODEL_ID);
    const cost = estimateCost(MUSIC_MODEL_ID, { seconds });

    if (!hasFalKey() || isDryRun()) {
      return NextResponse.json({
        mock: true,
        audioUrl: mockMusicDataUrl(seconds),
        prompt,
        cost: 0,
      });
    }

    const { url } = await falGenerateMusic({
      endpoint: model.endpoint,
      prompt,
      durationSeconds: seconds,
    });
    return NextResponse.json({ mock: false, audioUrl: url, prompt, cost });
  } catch (e) {
    console.error("music generation failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Music generation failed" },
      { status: 500 },
    );
  }
}
