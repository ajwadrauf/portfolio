"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  announceLiveModeChange,
  LIVE_GATE_OPEN_EVENT,
  LIVE_MODE_EVENT,
} from "@/lib/useHealth";

type Health = {
  gate: "disabled" | "locked" | "unlocked" | "exhausted";
  remaining: number | null;
  live: boolean;
  ungated: boolean;
};

/**
 * Live-mode indicator and unlock. The passcode is posted to the server and
 * never stored client-side; the session lives in an HttpOnly cookie the
 * browser cannot read.
 */
export function LiveGate() {
  const [health, setHealth] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      setHealth(await r.json());
    } catch {
      /* leave as-is */
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Other pages consume budget; keep the pill roughly current.
    const t = setInterval(refresh, 30_000);
    const on = () => void refresh();
    window.addEventListener(LIVE_MODE_EVENT, on);
    return () => {
      clearInterval(t);
      window.removeEventListener(LIVE_MODE_EVENT, on);
    };
  }, [refresh]);

  /*
   * Drive a native <dialog> rather than a positioned div.
   *
   * showModal() is what makes the rest of the page genuinely inert: focus
   * cannot leave, Escape closes, and background controls cannot be reached or
   * activated. The previous overlay had none of that — Tab from Cancel walked
   * straight out into the page behind it — and re-implementing a focus trap by
   * hand is strictly worse than the one the browser already has.
   *
   * The browser also returns focus to whatever opened it, which covers both
   * the header pill and a generation button several screens down.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !health?.live && !dialog.open) {
      dialog.showModal();
      // The passcode field is the point of the dialog, so it keeps the focus
      // it had before rather than the browser's first-focusable default.
      inputRef.current?.focus();
    } else if ((!open || health?.live) && dialog.open) {
      dialog.close();
    }
    if (health?.live && open) setOpen(false);
  }, [open, health]);

  // The native modal opens over the current viewport. Keep the visitor's place in the page.
  useEffect(() => {
    const on = () => {
      if (health?.live) return;
      setError(null);
      setOpen(true);
    };
    window.addEventListener(LIVE_GATE_OPEN_EVENT, on);
    return () => window.removeEventListener(LIVE_GATE_OPEN_EVENT, on);
  }, [health?.live]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const r = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: code }),
        });
        await r.json();
        if (!r.ok) throw new Error(r.status === 401 ? "That passcode didn't match. Give it another try." : r.status === 429 ? "Too many tries for now. Please wait 15 minutes, then try again." : "Couldn't unlock the studio. Please try again in a moment.");
        setCode("");
        setOpen(false);
        await refresh();
        announceLiveModeChange();
      } catch (err) {
        setError(err instanceof Error && !(err instanceof TypeError) ? err.message : "Couldn't check the passcode. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [code, refresh],
  );

  const lock = useCallback(async () => {
    await fetch("/api/unlock", { method: "DELETE" });
    await refresh();
    announceLiveModeChange();
  }, [refresh]);

  if (!health) return null;

  // No passcode configured and no keys: nothing meaningful to show.
  if (health.gate === "disabled" && !health.live) return null;

  // The ungated warning is not a pill any more — it is the banner under the
  // nav, which is both harder to miss and impossible to collide with a link.
  if (health.ungated) return null;

  if (health.gate === "disabled") {
    return (
      <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
        Live
      </span>
    );
  }

  return (
    <span className="contents">
      {health.gate === "unlocked" ? (
        <button
          onClick={() => void lock()}
          title="Click to lock again"
          className="-my-1.5 inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2.5 py-1.5 text-xs font-semibold text-success transition hover:border-success"
        >
          Live · {health.remaining} left
        </button>
      ) : (
        <button
          onClick={() => { setError(null); setOpen(true); }}
          className="-my-1.5 inline-flex items-center rounded-full border border-border-soft bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-foreground"
        >
          {health.gate === "exhausted" ? "Live runs used · Demo mode" : "Demo mode · Unlock"}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="live-gate-title"
        aria-describedby="live-gate-description"
        className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(440px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-border-soft bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50"
        // Escape and the close button both land here, so state follows the
        // element rather than the two drifting apart.
        onClose={() => { setOpen(false); setCode(""); }}
        onCancel={() => setOpen(false)}
        // A click on the backdrop targets the dialog itself; anything inside
        // targets a descendant. That is the whole test.
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <form onSubmit={submit} className="w-full p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">A quick heads-up</p>
          <h2 id="live-gate-title" className="mt-3 text-2xl tracking-[-0.025em]">
            {health.gate === "exhausted" ? "You're back in demo mode" : "You're in demo mode"}
          </h2>
          <p id="live-gate-description" className="mt-3 text-sm leading-relaxed text-muted">
            {health.gate === "exhausted"
              ? "This session has used its live runs. Enter the passcode I shared with you to start a fresh session, or keep exploring."
              : "I built this studio for you to explore. To create your own images, films or sound, enter the passcode I shared with you."}
          </p>
          <label htmlFor="live-passcode" className="label-sm mt-4 block">
            Passcode
          </label>
          <input
            ref={inputRef}
            id="live-passcode"
            type="password"
            autoComplete="off"
            className="input mt-1.5"
            placeholder="Enter your passcode"
            disabled={busy}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "live-gate-error" : undefined}
          />
          {error && (
            <p id="live-gate-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">After unlocking, click Generate again when you're ready.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary !px-4 !py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              Keep exploring
            </button>
            <button
              type="submit"
              className="btn-primary !px-4 !py-2 text-sm"
              disabled={busy || !code}
            >
              {busy ? "Checking…" : "Unlock live tools"}
            </button>
          </div>
          <p className="mt-5 border-t border-border-soft pt-4 text-xs text-muted">No passcode? <a className="inline-flex min-h-6 items-center font-semibold text-accent underline underline-offset-4" href="mailto:hello@ajwadrauf.com?subject=Studio%20passcode">Ask me for one.</a></p>
        </form>
      </dialog>
    </span>
  );
}

/**
 * Live API keys with no passcode in front of them: anyone who can load this
 * URL can spend real money.
 *
 * This used to be a pill in the nav, where it was both easy to miss and wide
 * enough to overlap the last link. It is a full-width strip under the nav
 * instead — it cannot collide with anything, and a warning about strangers
 * spending your credits deserves more than a chip.
 */
export function UngatedBanner() {
  const [ungated, setUngated] = useState(false);

  useEffect(() => {
    let live = true;
    const read = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const h = (await r.json()) as Health;
        if (live) setUngated(Boolean(h.ungated));
      } catch {
        /* leave as-is */
      }
    };
    void read();
    const t = setInterval(read, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (!ungated) return null;

  return (
    <div className="border-b border-danger/40 bg-danger/10">
      <p className="mx-auto max-w-6xl px-6 py-2 text-xs leading-relaxed text-danger">
        <span className="font-bold">⚠ Ungated live keys.</span> Generation is
        billing a real account with no passcode in front of it. Anyone who can
        open this URL can spend your credits. Set{" "}
        <code className="font-mono">LIVE_PASSCODE</code> in{" "}
        <code className="font-mono">.env.local</code> and restart to put the
        gate back.
      </p>
    </div>
  );
}
