import { NextResponse } from "next/server";
import { falPollVideo } from "@/lib/fal";
import { pollVeo } from "@/lib/gemini";
import { getModel } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      provider: "gemini" | "fal";
      operationName?: string;
      falRequestId?: string;
      modelId?: string;
    };

    if (body.provider === "gemini") {
      if (!body.operationName) {
        return NextResponse.json({ error: "operationName required" }, { status: 400 });
      }
      const result = await pollVeo(body.operationName);
      if (result.status === "done") {
        // Client streams the file through /api/video-file so the API key
        // never reaches the browser.
        return NextResponse.json({
          status: "done",
          videoUrl: `/api/video-file?uri=${encodeURIComponent(result.fileUri)}`,
        });
      }
      return NextResponse.json(result);
    }

    if (!body.falRequestId || !body.modelId) {
      return NextResponse.json({ error: "falRequestId and modelId required" }, { status: 400 });
    }
    const endpoint = getModel(body.modelId).endpoint;
    const result = await falPollVideo({ endpoint, requestId: body.falRequestId });
    return NextResponse.json(
      result.status === "done" ? { status: "done", videoUrl: result.videoUrl } : result,
    );
  } catch (e) {
    console.error("video status failed", e);
    return NextResponse.json(
      { status: "failed", error: e instanceof Error ? e.message : "Status check failed" },
      { status: 200 },
    );
  }
}
