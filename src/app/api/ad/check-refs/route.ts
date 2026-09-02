import { NextResponse } from "next/server";
import { judge, readDimensions, type RefFinding } from "@/lib/refCheck";

export const dynamic = "force-dynamic";

/** Enough of any supported container to reach its dimension fields. */
const HEADER_BYTES = 64 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetches just enough of a reference to judge it.
 *
 * This runs from the server on purpose. The question being answered is
 * whether a machine that is not the user's browser can fetch the URL — a blob
 * that renders fine in a tab because the tab holds a session cookie is
 * exactly the file a provider cannot read, and that failure comes back from
 * the provider as a content-policy sentence with no mention of fetching.
 */
async function inspect(slot: string, url: string): Promise<RefFinding> {
  // A data URL is carried inside the request rather than fetched, so there is
  // no reachability question to answer and calling it unreachable would be a
  // false alarm on a file that works.
  if (/^data:/i.test(url)) {
    return {
      url: "data:…",
      slot,
      ok: true,
      problems: [],
      notes: ["Uploaded from this browser and sent inline, so nothing has to fetch it."],
    };
  }
  if (!/^https?:\/\//i.test(url)) {
    return judge(slot, url, undefined,
      "Not an http(s) URL. A generation provider fetches references over the public internet, so a local path is not reachable from there.");
  }
  // A non-https URL is still inspected rather than dismissed: the dimensions
  // and size are worth reporting even when the scheme is the blocking issue,
  // because they are usually the next thing to be wrong.
  const schemeNote = /^https:/i.test(url)
    ? []
    : ["Served over http, not https. Providers generally refuse to fetch a plain-http reference."];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok && res.status !== 206) {
      return judge(slot, url, undefined,
        `The URL returned ${res.status} ${res.statusText}. The provider fetches references itself, so a file it cannot download is rejected — often reported as a content problem rather than a missing file.`);
    }

    const contentType = res.headers.get("content-type") ?? undefined;
    // Range served: the full size is in content-range, not content-length.
    const range = res.headers.get("content-range");
    const bytes = range
      ? Number(range.split("/")[1]) || undefined
      : Number(res.headers.get("content-length")) || undefined;

    const buf = new Uint8Array(await res.arrayBuffer());
    const dims = readDimensions(buf);
    const finding = judge(slot, url, { bytes, contentType, ...(dims ?? {}) });
    return schemeNote.length
      ? { ...finding, ok: false, problems: [...schemeNote, ...finding.problems] }
      : finding;
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return judge(slot, url, undefined,
      aborted
        ? `The URL did not respond within ${FETCH_TIMEOUT_MS / 1000}s. A provider fetching it will time out too.`
        : `Could not be fetched: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { imageUrls?: string[]; videoUrls?: string[] };
  const images = (body.imageUrls ?? []).filter((u) => typeof u === "string").slice(0, 30);
  const videos = (body.videoUrls ?? []).filter((u) => typeof u === "string").slice(0, 10);

  const findings = await Promise.all([
    // Clips get the reachability half of the check only: the documented
    // pixel limits are for stills, and inventing limits for video would be
    // worse than saying nothing.
    ...videos.map((u, i) => inspect(`[Video${i + 1}]`, u)),
    ...images.map((u, i) => inspect(`[Image${i + 1}]`, u)),
  ]);

  return NextResponse.json({
    findings,
    ok: findings.every((f) => f.ok),
  });
}
