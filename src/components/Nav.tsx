"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { UngatedBanner } from "./LiveGate";
import { Wordmark } from "./Wordmark";

const LINKS = [
  { href: "/ai-studio", label: "Overview" },
  { href: "/ai-studio/ads", label: "Ad Lab" },
  // "Studio" alone read as the whole AI Content Studio rather than one tool
  // inside it, which is the single most confusable label in the row.
  { href: "/ai-studio/studio", label: "Campaign Studio" },
  { href: "/ai-studio/packshots", label: "Packshots" },
  { href: "/ai-studio/prompts", label: "Prompt builder" },
  { href: "/ai-studio/blender", label: "Blender" },
  { href: "/ai-studio/models", label: "Models" },
  { href: "/ai-studio/build-vs-buy", label: "Build vs. Buy" },
  { href: "/ai-studio/playbook", label: "Playbook" },
] as const;

/**
 * Which entry a path belongs to.
 *
 * Exact matching left /ai-studio/blender/the-wall with nothing highlighted at
 * all — the case study is inside the Blender section, so the section is where
 * you are. Longest prefix wins, and /ai-studio itself only claims its own
 * exact path or it would swallow every route below it.
 */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const l of LINKS) {
    const isMatch =
      l.href === "/ai-studio"
        ? pathname === "/ai-studio"
        : pathname === l.href || pathname.startsWith(`${l.href}/`);
    if (isMatch && (best === null || l.href.length > best.length)) best = l.href;
  }
  return best;
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const current = activeHref(pathname);
  const currentLabel = LINKS.find((l) => l.href === current)?.label ?? "AI Content Studio";

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Escape and click-outside, the two things anyone tries first.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Arriving somewhere new closes the menu that took you there.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const linkClass = (href: string) =>
    `whitespace-nowrap rounded-[6px] px-3 py-1.5 transition ${
      href === current
        ? "bg-accent font-semibold text-white shadow-[0_1px_6px_rgba(118,61,93,0.35)]"
        : "text-muted hover:bg-accent/8 hover:text-accent"
    }`;

  return (
    /* Same treatment as the portfolio header — no wash, no strip, one hairline. */
    <header className="sticky top-0 z-40 border-b border-border-soft bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center justify-between gap-4 lg:justify-start">
          {/*
            The site wordmark at back-link scale — the same mark the homepage
            header carries, not a second one that resembles it.
          */}
          <Link href="/" title="Back to ajwadrauf.com" className="self-center">
            <Wordmark size="sm" />
          </Link>
          <span className="hidden h-5 w-px self-center bg-border-strong sm:block" />
          <Link
            href="/ai-studio"
            className="-my-2 inline-flex items-center self-center whitespace-nowrap py-2 label !text-[12px] !text-accent font-semibold min-[360px]:!text-[14px]"
          >
            AI Content Studio
          </Link>
        </div>

        {/*
          Below lg this was a horizontally scrolling strip with its scrollbar
          hidden and no attempt to bring the current item into view — on
          Playbook at 390px the active link sat around x=747, entirely outside
          the viewport, so the row looked like it started at "Overview" and
          gave no clue where you were. A disclosure that names the current page
          says both things at once, and every destination is one tap away.
        */}
        <div className="relative lg:hidden" ref={wrapRef}>
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-[6px] border border-border-soft bg-surface px-3 py-2.5 text-sm transition hover:border-accent"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="label-sm shrink-0">Tools &amp; guides</span>
              <span className="truncate font-semibold text-foreground">{currentLabel}</span>
            </span>
            <span
              aria-hidden
              className={`shrink-0 text-[10px] text-muted transition-transform ${open ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>

          {open && (
            <ul
              id={menuId}
              className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-[6px] border border-accent/25 bg-surface py-1 shadow-[0_8px_24px_rgba(43,37,34,0.13)]"
            >
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={pathname === l.href ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition ${
                      l.href === current
                        ? "bg-accent/10 font-semibold text-accent"
                        : "text-foreground hover:bg-accent/8 hover:text-accent"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                    {l.href === current && (
                      <span aria-hidden className="text-xs">
                        ●
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav
          aria-label="Studio sections"
          className="no-scrollbar hidden min-w-0 items-center gap-1 overflow-x-auto text-sm lg:flex xl:overflow-visible"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              // Only the exact page is "page"; a parent section is highlighted
              // but is not where you are.
              aria-current={pathname === l.href ? "page" : undefined}
              className={linkClass(l.href)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <UngatedBanner />
    </header>
  );
}
