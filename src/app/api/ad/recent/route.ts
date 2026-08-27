import { NextResponse } from "next/server";
import { AD_VIDEO_MODELS } from "@/lib/adPresets";
import { falRecentVideoRequests } from "@/lib/fal";
import { getModel, hasFalKey } from "@/lib/models";
import { unlocked } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Renders this fal key has actually submitted, so a finished video can be
 * found again when its request id was never written down.
 *
 * Read-only and free: it lists work already paid for. It still requires an
 * unlocked session, because the list is an account's generation history and
 * not something a public URL should hand out.
 */
export async function GET(req: Request) {
  if (!hasFalKey()) {
    return NextResponse.json(
      { error: "No fal key configured, so there is no render history to read." },
      { status: 400 },
    );
  }
  if (!unlocked(req)) {
    return NextResponse.json(
      { error: "Unlock live mode to read this account's render history." },
      { status: 403 },
    );
  }

  const endpoints = [
    ...new Set(
      AD_VIDEO_MODELS.map((id) => getModel(id))
        .filter((m) => m.provider === "fal")
        .map((m) => m.endpoint),
    ),
  ];

  try {
    const requests = await falRecentVideoRequests(endpoints);
    return NextResponse.json({ requests });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not read render history" },
      { status: 502 },
    );
  }
}
