import { NextResponse } from "next/server";
import { gateEnabled, gateStatus } from "@/lib/auth";
import { hasFalKey, hasGeminiKey, isDryRun } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gemini = hasGeminiKey();
  const fal = hasFalKey();
  const dryRun = isDryRun();
  const keysPresent = gemini || fal;
  const { gate, remaining } = gateStatus(req);

  return NextResponse.json({
    gemini,
    fal,
    dryRun,
    gate,
    remaining,
    /** True when this request may actually make paid calls. */
    live: keysPresent && !dryRun && (gate === "disabled" || gate === "unlocked"),
    /**
     * Loud warning for a misconfigured public deployment: real keys, no
     * passcode. Anyone with the URL could spend the owner's credits.
     */
    ungated: keysPresent && !dryRun && !gateEnabled(),
  });
}
