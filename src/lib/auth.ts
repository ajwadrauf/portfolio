import "server-only";
import crypto from "node:crypto";

/**
 * Live-mode gate.
 *
 * Threat model: the site is public, so anyone who finds the URL could
 * otherwise spend the owner's API credits. Protection is layered:
 *
 *  1. The passcode never reaches the client — it lives in an env var and is
 *     compared server-side in constant time.
 *  2. A successful unlock issues an HMAC-signed, HttpOnly cookie. It cannot
 *     be forged or edited without the server secret.
 *  3. The generation budget is carried *inside* that signed cookie, so a
 *     serverless deployment enforces a per-session cap with no database.
 *  4. Every paid route re-checks the gate server-side. Client state is
 *     irrelevant — a crafted request without a valid cookie gets mocks.
 *  5. Locked visitors are not blocked; they transparently get demo mode.
 *
 * When LIVE_PASSCODE is unset the gate is disabled entirely, so local
 * development with keys just works.
 */

const COOKIE_NAME = "live_session";
const SESSION_HOURS = 12;

const passcode = () => process.env.LIVE_PASSCODE ?? "";

/** The gate only engages when a passcode is configured. */
export const gateEnabled = () => passcode().length > 0;

/** Generations allowed per unlocked session. */
export const sessionBudget = () => {
  const n = Number(process.env.LIVE_BUDGET ?? 40);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 40;
};

function secret(): string {
  // A dedicated secret is preferred; fall back to the passcode so the cookie
  // is still unforgeable without extra configuration.
  return process.env.SESSION_SECRET || passcode() || "dev-only-secret";
}

export type LiveSession = { exp: number; used: number; sid: string };

const sign = (payload: string) =>
  crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

/** Constant-time compare of equal-length digests, safe for unequal inputs. */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPasscode(input: unknown): boolean {
  if (!gateEnabled() || typeof input !== "string" || input.length === 0) return false;
  return safeEqual(input, passcode());
}

export function newSession(): LiveSession {
  return {
    exp: Date.now() + SESSION_HOURS * 3600_000,
    used: 0,
    sid: crypto.randomUUID(),
  };
}

export function issueCookie(s: LiveSession): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const maxAge = Math.max(0, Math.floor((s.exp - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict;${secure} Max-Age=${maxAge}`;
}

export function clearCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict;${secure} Max-Age=0`;
}

export function readSession(req: Request): LiveSession | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const raw = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;

  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  if (!safeEqual(mac, sign(payload))) return null;

  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as LiveSession;
    if (typeof s.exp !== "number" || typeof s.used !== "number") return null;
    if (Date.now() > s.exp) return null;
    return s;
  } catch {
    return null;
  }
}

/** True when paid calls are permitted for this request. */
export function unlocked(req: Request): boolean {
  if (!gateEnabled()) return true;
  const s = readSession(req);
  return s !== null && s.used < sessionBudget();
}

export type SpendResult = { ok: boolean; remaining: number; cookie?: string };

/**
 * Consume one generation from this session's budget. Returns the refreshed
 * cookie to set on the response. A no-op when the gate is disabled.
 */
export function consume(req: Request): SpendResult {
  if (!gateEnabled()) return { ok: true, remaining: Number.POSITIVE_INFINITY };
  const s = readSession(req);
  if (!s) return { ok: false, remaining: 0 };
  const budget = sessionBudget();
  if (s.used >= budget) return { ok: false, remaining: 0 };
  const next: LiveSession = { ...s, used: s.used + 1 };
  return { ok: true, remaining: budget - next.used, cookie: issueCookie(next) };
}

export function gateStatus(req: Request): {
  gate: "disabled" | "locked" | "unlocked" | "exhausted";
  remaining: number | null;
} {
  if (!gateEnabled()) return { gate: "disabled", remaining: null };
  const s = readSession(req);
  if (!s) return { gate: "locked", remaining: 0 };
  const remaining = Math.max(0, sessionBudget() - s.used);
  return { gate: remaining > 0 ? "unlocked" : "exhausted", remaining };
}

/**
 * JSON response that carries the refreshed budget cookie. Every paid route
 * returns through this so the session's remaining budget stays in sync.
 */
export function liveJson(spend: SpendResult | null, body: unknown): Response {
  const res = new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
  if (spend?.cookie) res.headers.set("Set-Cookie", spend.cookie);
  return res;
}
