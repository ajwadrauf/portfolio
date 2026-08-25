"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

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
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Unlock failed");
        setCode("");
        setOpen(false);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unlock failed");
      } finally {
        setBusy(false);
      }
    },
    [code, refresh],
  );

  const lock = useCallback(async () => {
    await fetch("/api/unlock", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  if (!health) return null;

  // No passcode configured and no keys: nothing meaningful to show.
  if (health.gate === "disabled" && !health.live) return null;

  if (health.ungated) {
    return (
      <span
        className="rounded-full border border-danger/50 bg-danger/10 px-2.5 py-0.5 text-xs font-bold text-danger"
        title="Live keys with no passcode — anyone with this URL can spend your credits. Set LIVE_PASSCODE."
      >
        ⚠ Ungated live
      </span>
    );
  }

  if (health.gate === "disabled") {
    return (
      <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
        Live
      </span>
    );
  }

  return (
    <>
      {health.gate === "unlocked" ? (
        <button
          onClick={() => void lock()}
          title="Click to lock again"
          className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success transition hover:border-success"
        >
          Live · {health.remaining} left
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-border-soft bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-foreground"
        >
          {health.gate === "exhausted" ? "Budget used · Demo mode" : "Demo mode · Unlock"}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-6"
          onClick={() => setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="card w-full max-w-sm p-6"
          >
            <h2 className="text-lg tracking-[-0.02em]">Enable live generation</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Browsing works without this — every page runs in demo mode with
              realistic mock outputs. Enter the passcode from the application
              to run real generations against the live models.
            </p>
            <input
              ref={inputRef}
              type="password"
              autoComplete="off"
              className="input mt-4"
              placeholder="Passcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary !px-4 !py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary !px-4 !py-2 text-sm"
                disabled={busy || !code}
              >
                {busy ? "Checking…" : "Unlock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
