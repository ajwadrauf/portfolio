import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { unlocked } from "@/lib/auth";
import { AUDIO_REF_LIMITS, VIDEO_REF_LIMITS } from "@/lib/adPresets";
import { blobConfigured } from "@/lib/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Issues short-lived tokens for browser-to-Blob uploads.
 *
 * Why this exists rather than the simpler server-upload route in Vercel's
 * docs: that one streams the file through a Function, and a Function request
 * body is capped at 4.5MB. Video references are routinely larger, so the
 * example pattern would fail on exactly the files this feature is for. Here
 * the browser uploads straight to Blob and the server only signs for it, which
 * also means the bytes never cost Function bandwidth.
 *
 * The gate matters more here than on most routes. A token endpoint with no
 * auth is an invitation to fill someone else's storage account, so
 * `onBeforeGenerateToken` runs behind the same live-mode check as generation
 * — and the size and type ceilings are set server-side, where the browser
 * cannot raise them.
 */
const ALL_MEDIA = [
  ...VIDEO_REF_LIMITS.mimeTypes,
  ...AUDIO_REF_LIMITS.mimeTypes,
] as string[];

export async function POST(req: Request) {
  if (!blobConfigured()) {
    return NextResponse.json(
      { error: "No Blob store is attached to this deployment." },
      { status: 400 },
    );
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate before signing anything — this is the whole security
        // boundary for the upload.
        if (!unlocked(req)) {
          throw new Error("Live mode required to upload references.");
        }
        const isAudio = AUDIO_REF_LIMITS.extensions.some((e) =>
          pathname.toLowerCase().endsWith(e),
        );
        const limits = isAudio ? AUDIO_REF_LIMITS : VIDEO_REF_LIMITS;
        return {
          allowedContentTypes: ALL_MEDIA,
          // The direct ceiling: nothing passes through a Function here.
          maximumSizeInBytes: limits.maxBytesDirect,
          // Two people uploading "clip.mp4" must not overwrite each other.
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
