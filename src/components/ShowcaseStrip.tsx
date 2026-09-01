"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TILE_BOX, isMotion, type ShowcaseItem } from "@/lib/showcase";

/**
 * Motion plays only while it is on screen, and only if the reader has not
 * asked for less of it. Four clips autoplaying above the fold on a phone is
 * a way to make a portfolio feel expensive to look at.
 */
function Motion({ item }: { item: ShowcaseItem }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <video
      ref={ref}
      src={item.file}
      poster={item.poster}
      muted
      loop
      playsInline
      preload="metadata"
      // Reduced motion still gets the poster frame and a working control.
      controls={reduced}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/** Wraps a tile in a link only when there is somewhere for it to go. */
function Tile({
  href,
  split,
  children,
}: {
  href?: string;
  /** Lone tile: frame and caption sit side by side rather than stacked. */
  split?: boolean;
  children: React.ReactNode;
}) {
  const cls = split
    ? "grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
    : "block";
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/**
 * The output strip. Craft first, argument second.
 *
 * Rendered only when there is real work to show — `page.tsx` filters the
 * manifest against the filesystem at build time, so an empty showcase is an
 * absent section rather than a row of broken images in front of a recruiter.
 */
export function ShowcaseStrip({ items }: { items: ShowcaseItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Selected output"
      className="mx-auto max-w-[1440px] px-6 pb-4 sm:px-12 lg:px-24"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <span className="label !tracking-[0.16em]">Made with the studio</span>
        <span className="text-xs text-muted/80">
          Made with the tools on this site — each tile names what produced it.
        </span>
      </div>

      {/*
        Columns follow the count. A single tile in a four-wide grid reads as
        three tiles that failed to load, which is a worse first impression than
        no strip at all — so one piece of work is presented as one piece of
        work, sized to be looked at.
      */}
      <ul
        className={`mt-6 grid gap-3 sm:gap-4 ${
          items.length === 1
            ? "grid-cols-1"
            : items.length === 2
              ? "grid-cols-2"
              : items.length === 3
                ? "grid-cols-2 lg:grid-cols-3"
                : "grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {items.map((item) => (
          <li key={item.id} className="group">
            {/* A tile with a case study behind it should be clickable. */}
            <Tile href={item.href} split={items.length === 1}>
            <div
              className={`relative overflow-hidden rounded-[6px] border border-border-soft bg-surface-2 transition ${TILE_BOX} ${
                item.href ? "group-hover:border-accent" : ""
              }`}
            >
              {isMotion(item.file) ? (
                <Motion item={item} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.file}
                  alt={item.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>
            <div className={items.length === 1 ? "" : "mt-2.5"}>
              <p className="text-sm font-semibold leading-snug">
                {item.title}
                {item.href && (
                  <span aria-hidden className="ml-1.5 text-accent">
                    →
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-[1.55] text-muted">{item.note}</p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted/70">
                {item.model}
                {item.cost ? ` · ${item.cost}` : ""}
              </p>
            </div>
            </Tile>
          </li>
        ))}
      </ul>
    </section>
  );
}
