import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streams a generated packshot to the browser under its GS1 filename.
 *
 * Two things were broken without this, both silently.
 *
 * The HTML `download` attribute is ignored on a cross-origin URL — the browser
 * navigates to the image instead of saving it. Gemini results are data URLs
 * and downloaded fine; fal and Recraft results are hosted on their own CDNs,
 * so "Download" opened a tab and the GS1 filename the whole page is built
 * around was silently dropped. Naming is not decoration here: a planogram
 * asset is identified by its filename.
 *
 * Serving the bytes from our own origin with an explicit Content-Disposition
 * fixes both. Locked to the hosts our own providers return, so it cannot be
 * used as an open proxy.
 */
const ALLOWED_SUFFIXES = [
  ".fal.media",
  "fal.media",
  ".fal.ai",
  ".recraft.ai",
  "recraft.ai",
  ".public.blob.vercel-storage.com",
];

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const src = params.get("url");
  const name = params.get("name") ?? "packshot";
  if (!src) return NextResponse.json({ error: "url required" }, { status: 400 });

  let host: string;
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "https only" }, { status: 400 });
    }
    host = parsed.hostname;
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (!ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith(s))) {
    return NextResponse.json({ error: "url host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(src);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream fetch failed (${upstream.status})` },
      { status: 502 },
    );
  }

  const type = upstream.headers.get("content-type") ?? "image/jpeg";
  // The extension follows what actually came back rather than what the
  // filename builder assumed — Gemini returns PNG, fal returns JPEG.
  const ext = EXT_BY_TYPE[type.split(";")[0].trim()] ?? "jpg";
  const safe = name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.(jpg|jpeg|png|webp)$/i, "");

  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${safe}.${ext}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
