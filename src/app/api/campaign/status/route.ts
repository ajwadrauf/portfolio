import { NextResponse } from "next/server";
import { falPollVideo } from "@/lib/fal";
import { pollVeo } from "@/lib/gemini";
import { getModel } from "@/lib/models";
import { DELIVERABLES } from "@/lib/deliverables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A status transport error is not a failed generation and never starts new work. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!DELIVERABLES.some((item) => item.kind === "video" && item.modelOptions.includes(body.modelId))) return NextResponse.json({ error: "Unknown campaign video model." }, { status: 400 });
    const model = getModel(body.modelId);
    if (body.provider === "gemini" && model.provider === "gemini" && typeof body.operationName === "string" && body.operationName.length <= 500) {
      const result = await pollVeo(body.operationName);
      return NextResponse.json(result.status === "done" ? { status: "done", videoUrl: `/api/video-file?uri=${encodeURIComponent(result.fileUri)}` } : result);
    }
    if (body.provider === "fal" && model.provider === "fal" && typeof body.falRequestId === "string" && /^[a-zA-Z0-9_-]{8,200}$/.test(body.falRequestId)) {
      const result = await falPollVideo({ endpoint: model.endpoint, requestId: body.falRequestId });
      return NextResponse.json(result.status === "done" ? { status: "done", videoUrl: result.videoUrl } : result);
    }
    return NextResponse.json({ error: "A valid saved request handle is required." }, { status: 400 });
  } catch { return NextResponse.json({ error: "Status is temporarily unavailable. The saved request has not been resubmitted." }, { status: 503 }); }
}
