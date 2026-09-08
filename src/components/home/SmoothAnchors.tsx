"use client";

import { useEffect } from "react";

/**
 * Makes the page's in-page anchors glide rather than jump, for as long as the
 * homepage is mounted.
 *
 * One line, because the browser is better at this than a click handler. An
 * earlier version intercepted every anchor and called scrollIntoView, which
 * meant re-implementing three things the browser already does correctly —
 * pushing a history entry so Back undoes the jump, moving focus into the
 * target so a keyboard visitor carries on from there, and honouring the
 * scroll-margin-top the sections set. Handing scroll-behavior to the document
 * instead keeps every link a plain <a href="#..."> that still works with
 * JavaScript switched off, and keeps all of that behaviour intact.
 *
 * It is set here rather than in globals.css so it lasts exactly as long as
 * this page does: the studio's scrolling is untouched, on this visit and on
 * the next one after a client-side navigation away.
 *
 * Anyone who has asked for reduced motion is never opted in.
 */
export function SmoothAnchors() {
  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  return null;
}
