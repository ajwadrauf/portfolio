import { NextResponse } from "next/server";
import { fetchVeoFile } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streams a generated Veo file to the browser. The Gemini Files API requires
 * the API key on download, so the client never fetches the file directly —
 * this proxy attaches the key server-side. Locked to Google's API host so it
 * can't be used as an open proxy (and the key is only ever sent to Google).
 */
export async function GET(req: Request) {
  const uri = new URL(req.url).searchParams.get("uri");
  if (!uri) return NextResponse.json({ error: "uri required" }, { status: 400 });

  let host: string;
  try {
    host = new URL(uri).hostname;
  } catch {
    return NextResponse.json({ error: "invalid uri" }, { status: 400 });
  }
  if (host !== "generativelanguage.googleapis.com") {
    return NextResponse.json({ error: "uri host not allowed" }, { status: 400 });
  }

  const upstream = await fetchVeoFile(uri);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream fetch failed (${upstream.status})` },
      { status: 502 },
    );
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
