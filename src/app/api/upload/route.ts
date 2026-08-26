import { NextResponse } from "next/server";
import { AUDIO_REF_LIMITS, VIDEO_REF_LIMITS } from "@/lib/adPresets";
import { unlocked } from "@/lib/auth";
import { falUpload } from "@/lib/fal";
import { hasFalKey, isDryRun } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Uploads a reference clip or track to fal storage and returns its URL.
 *
 * Serverless request bodies are capped (~4.5MB on Vercel), which is fine
 * for a reference — a few seconds is all the model needs to read a camera
 * move, and a bed is only ever as long as the cut. Longer footage should be
 * trimmed before upload rather than streamed through here.
 */
const KINDS = {
  video: VIDEO_REF_LIMITS,
  audio: AUDIO_REF_LIMITS,
} as const;

export async function POST(req: Request) {
  try {
    if (!hasFalKey() || isDryRun() || !unlocked(req)) {
      return NextResponse.json(
        {
          error:
            "Clip and track references need live mode — they upload to the generation provider. Unlock live mode, or use image references in demo mode.",
        },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const kind = file.type.startsWith("audio/") ? "audio" : "video";
    const limits = KINDS[kind];

    if (file.size > limits.maxBytes) {
      return NextResponse.json(
        {
          error: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — trim it under ${limits.maxMB}MB. A reference only has to be as long as the moment you want copied.`,
        },
        { status: 413 },
      );
    }
    if (file.type && !(limits.mimeTypes as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type ${file.type}. Use ${limits.formats}.` },
        { status: 415 },
      );
    }

    const { url } = await falUpload(file);
    return NextResponse.json({ url, kind });
  } catch (e) {
    console.error("reference upload failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }
}
