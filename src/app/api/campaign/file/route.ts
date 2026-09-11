import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function allowed(raw: string): boolean {
  try { const url = new URL(raw); return url.protocol === "https:" && !url.username && !url.password && !url.port &&
    ["fal.media", "fal.ai", "public.blob.vercel-storage.com"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)); }
  catch { return false; }
}

/** Read-only, bounded media download for a campaign ZIP or local text compositor. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams; let source = params.get("url") ?? "";
  const kind = params.get("kind") === "video" ? "video" : "image";
  if (!allowed(source)) return NextResponse.json({ error: "Choose an image or video from this studio's supported storage." }, { status: 400 });
  try {
    let upstream: Response | null = null;
    for (let redirect = 0; redirect < 4; redirect++) {
      upstream = await fetch(source, { redirect: "manual", signal: AbortSignal.timeout(45_000) });
      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get("location"); await upstream.body?.cancel();
        if (!location) throw new Error("Missing media location.");
        source = new URL(location, source).href;
        if (!allowed(source)) throw new Error("Media redirected outside supported storage.");
      } else break;
    }
    if (!upstream?.ok || !upstream.body) throw new Error("The media file is unavailable. Its provider link may have expired.");
    const type = (upstream.headers.get("content-type") ?? "").split(";")[0];
    if (kind === "image" ? !["image/png", "image/jpeg", "image/webp"].includes(type) : !["video/mp4", "video/webm"].includes(type)) throw new Error("Storage did not return a supported media file.");
    const limit = kind === "video" ? 100 * 1024 * 1024 : 24 * 1024 * 1024;
    if (Number(upstream.headers.get("content-length")) > limit) { await upstream.body.cancel(); return NextResponse.json({ error: "Download this large file directly from the provider." }, { status: 413 }); }
    // Stream instead of buffering: finished films can exceed Vercel's 4.5 MB
    // buffered-response limit. Keep the byte bound even without Content-Length.
    const reader = upstream.body.getReader(); let total = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) { controller.close(); return; }
          total += value.byteLength;
          if (total > limit) { await reader.cancel(); throw new Error("Media exceeds this download's size limit."); }
          controller.enqueue(value);
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    const extension = type === "image/jpeg" ? "jpg" : type.split("/")[1];
    return new Response(stream, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="campaign-asset.${extension}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not download media." }, { status: 502 }); }
}
