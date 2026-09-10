import { consume, unlocked, type SpendResult } from "@/lib/auth";
import { hasGeminiKey, isDryRun } from "@/lib/models";
import { PreflightInputError, parsePreflightRequest, preparePreflightMedia, readPreflightBody, runPreflight } from "@/lib/adPreflightServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function result(body: unknown, status: number, spend?: SpendResult): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (spend?.cookie) headers.set("Set-Cookie", spend.cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export async function POST(req: Request): Promise<Response> {
  // Unlike a generation demo, an inspection must never fabricate a passing result.
  if (!hasGeminiKey() || isDryRun()) return result({ error: "AI preflight is unavailable in demo mode. The manual playbook checklist is still available.", code: "review_unavailable", spendAttempted: false }, 503);
  if (!unlocked(req)) return result({ error: "Unlock live access before running an AI review.", code: "review_locked", spendAttempted: false }, 403);
  let spend: SpendResult | undefined;
  let spendAttempted = false;
  try {
    const request = parsePreflightRequest(await readPreflightBody(req));
    const media = await preparePreflightMedia(request);
    spend = consume(req);
    if (!spend.ok) return result({ error: "Your live review budget has been used. Unlock a new session to continue.", code: "review_budget", spendAttempted: false }, 403);
    spendAttempted = true;
    const report = await runPreflight(request, media);
    return result({ report, remaining: Number.isFinite(spend.remaining) ? spend.remaining : null }, 200, spend);
  } catch (error) {
    if (!spendAttempted && error instanceof PreflightInputError) return result({ error: error.message, code: "review_input", spendAttempted: false }, error.status);
    // Once Google has been called, an error is NOT permission to silently submit again.
    // Refresh the spent session cookie on this path too; failure does not restore a paid slot.
    return result({ error: spendAttempted ? "The AI review did not return a usable report. It may have been billed; no automatic retry was made. Your video is unchanged." : "The video could not be prepared for review. No AI review was submitted.", code: spendAttempted ? "review_outcome_unknown" : "review_input", spendAttempted }, spendAttempted ? 502 : 422, spend);
  }
}
