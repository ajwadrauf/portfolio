import { NextResponse } from "next/server";
import { VIDEO_REF_LIMITS } from "@/lib/adPresets";
import { unlocked } from "@/lib/auth";
import { falUpload } from "@/lib/fal";
import { hasFalKey, isDryRun } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Uploads a reference video to fal storage and returns its URL.
 *
 * Serverless request bodies are capped (~4.5MB on Vercel), which is fine
 * for a reference clip — a few seconds is all the model needs to read a
 * camera move. Longer footage should be trimmed before upload rather than
 * streamed through here.
 */
const MAX_BYTES = VIDEO_REF_LIMITS.maxBytes;
const ALLOWED: readonly string[] = VIDEO_REF_LIMITS.mimeTypes;

export async function POST(req: Request) {
  try {
    if (!hasFalKey() || isDryRun() || !unlocked(req)) {
      return NextResponse.json(
        {
          error:
            "Video references need live mode — they upload to the generation provider. Unlock live mode, or use image references in demo mode.",
        },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Clip is ${(file.size / 1024 / 1024).toFixed(1)}MB — trim it under ${VIDEO_REF_LIMITS.maxMB}MB. A few seconds is enough for a motion reference.`,
        },
        { status: 413 },
      );
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type ${file.type}. Use ${VIDEO_REF_LIMITS.formats}.` },
        { status: 415 },
      );
    }

    const { url } = await falUpload(file);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("reference upload failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }
}
