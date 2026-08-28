"use client";

import { useCallback, useEffect, useState } from "react";

export type Health = {
  gemini: boolean;
  fal: boolean;
  live: boolean;
  gate: "disabled" | "locked" | "unlocked" | "exhausted";
  remaining: number | null;
  ungated: boolean;
  /** A Vercel Blob store is attached, so uploads bypass the Function limit. */
  blob: boolean;
};

/**
 * Broadcast when live mode is unlocked or locked.
 *
 * The gate control and the tools that depend on it are separate components in
 * separate parts of the tree, and each used to read `/api/health` once on
 * mount. So unlocking updated the pill and nothing else: the Ad Lab went on
 * believing it was in demo mode and refused clip uploads — while the pill next
 * to it said Live — until the page was reloaded. One event fixes every
 * consumer at once.
 */
export const LIVE_MODE_EVENT = "live-mode-changed";

export const announceLiveModeChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LIVE_MODE_EVENT));
  }
};

/**
 * Current provider/gate state, kept current across the whole page.
 *
 * Refreshes on mount, whenever live mode changes anywhere, when the tab is
 * brought back to the foreground (budget is spent by other tabs), and on a
 * slow interval as a backstop.
 */
export function useHealth(pollMs = 30_000) {
  const [health, setHealth] = useState<Health | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      setHealth(await r.json());
    } catch {
      setHealth((prev) => prev ?? { gemini: false, fal: false, live: false, gate: "disabled", remaining: null, ungated: false, blob: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener(LIVE_MODE_EVENT, onChange);
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(refresh, pollMs);
    return () => {
      window.removeEventListener(LIVE_MODE_EVENT, onChange);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
    };
  }, [refresh, pollMs]);

  return { health, refresh };
}
