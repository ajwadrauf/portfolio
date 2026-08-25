import { NextResponse } from "next/server";
import { hasFalKey, hasGeminiKey, isDryRun } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  const gemini = hasGeminiKey();
  const fal = hasFalKey();
  const dryRun = isDryRun();
  return NextResponse.json({
    gemini,
    fal,
    dryRun,
    live: (gemini || fal) && !dryRun,
  });
}
