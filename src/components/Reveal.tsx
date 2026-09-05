"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades a section in as it arrives, once.
 *
 * The distinction from the marquee this page used to carry: that looped
 * forever and had to be waited out, this resolves and is then done. Motion
 * that ends is punctuation; motion that repeats is noise.
 *
 * Starts visible and is only hidden after the observer is confirmed to exist,
 * so no path through this component can leave content permanently invisible —
 * not an old browser, not a crawler, not a JS failure between render and
 * effect. Anyone who has asked their OS for less motion is opted out entirely
 * and never has the class applied.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  /** ms, for staggering siblings. */
  delay?: number;
  as?: "div" | "section" | "article";
  /** Merged with the stagger delay — lets a caller set --rule per item. */
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    // Already on screen at mount — reveal without hiding it first, so the top
    // of the page never flashes.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setArmed(true);
    let live = true;
    const done = () => {
      if (!live) return;
      live = false;
      setShown(true);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(failsafe);
    };

    /*
     * Position check, and the reason it exists rather than IntersectionObserver
     * alone.
     *
     * An observer only fires when the intersection ratio crosses a threshold.
     * Jump from the top of the page to #contact and an element goes from ratio
     * zero (below the fold) to ratio zero (above it) without ever crossing
     * anything — so no callback arrives and the element stays hidden. That is
     * not a corner case: it is what every anchor link in the nav does, plus
     * scroll restoration on reload and a hard flick on a phone.
     */
    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9) done();
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        check();
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) done();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    // The jump may already have happened before this effect ran.
    check();

    /*
     * Last resort. Nothing here is worth being unreadable over, so everything
     * reveals on its own if neither route fired.
     */
    const failsafe = window.setTimeout(done, 2000);

    return () => {
      live = false;
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLElement>}
      className={`${armed ? `reveal${shown ? " is-in" : ""}` : ""} ${className}`}
      style={{ ...style, ...(delay && armed ? { transitionDelay: `${delay}ms` } : {}) }}
    >
      {children}
    </Tag>
  );
}
