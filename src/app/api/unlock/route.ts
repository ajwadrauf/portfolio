import { NextResponse } from "next/server";
import {
  checkPasscode,
  clearCookie,
  gateEnabled,
  issueCookie,
  newSession,
  sessionBudget,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Brute-force defence. The passcode itself should carry enough entropy that
 * guessing is infeasible, but this makes automated attempts expensive and
 * pointless. In-memory means it is per-instance and resets on cold start —
 * best-effort by design, layered under the passcode's entropy rather than
 * relied on alone.
 */
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  if (!gateEnabled()) {
    return NextResponse.json(
      { error: "No passcode is configured on this deployment." },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  let body: { passcode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!checkPasscode(body.passcode)) {
    // Uniform delay so failures cost the attacker time and leak no timing signal.
    await sleep(400);
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  // Success clears this IP's attempt record.
  attempts.delete(ip);

  const res = NextResponse.json({ ok: true, remaining: sessionBudget() });
  res.headers.set("Set-Cookie", issueCookie(newSession()));
  return res;
}

/** Lock again — clears the session cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookie());
  return res;
}
