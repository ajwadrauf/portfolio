"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type WorkLink = { name: string; href: string };

const SECTIONS = [
  { href: "#approach", label: "Approach" },
  { href: "#contact", label: "Contact" },
] as const;

/** External destinations open in a new tab; internal routes navigate. */
const isExternal = (href: string) => /^https?:\/\//.test(href);

/**
 * Portfolio header, built to match the studio nav rather than merely
 * resemble it — same purple wash, same pill links, same wordmark size — so
 * crossing between the two halves of the site does not feel like leaving.
 *
 * Work is a menu because the three projects are the actual content of this
 * page; making someone scroll to find out what "Work" contains wastes the
 * one moment they are definitely paying attention. The items come from the
 * page's own project list, so the menu cannot drift from what is below it.
 */
export function HomeNav({ work }: { work: WorkLink[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Click-outside and Escape. Both are what people actually try first when a
  // menu is in the way.
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

  const openTo = (index: number) => {
    setOpen(true);
    // The menu has to exist before it can take focus.
    requestAnimationFrame(() => itemRefs.current[index]?.focus());
  };

  const onItemKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemRefs.current[(i + 1) % work.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemRefs.current[(i - 1 + work.length) % work.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  /*
   * Direction C's pills: a touch heavier and roomier than before, so a row of
   * four reads as a considered group rather than as small grey text floating
   * beside a large name.
   */
  const pill =
    "rounded-[6px] px-2.5 py-2 text-[13.5px] font-semibold text-muted transition hover:bg-accent/[0.09] hover:text-accent sm:px-[15px]";

  return (
    /*
     * The bar carries nothing but the wordmark and the links.
     *
     * It used to sit under a seven-colour strip on a purple wash, which made
     * the heaviest band on the page the one with the least in it. The strip is
     * gone and the wash with it; what separates the header from the page now
     * is a single hairline and a translucent surface, so the name is the
     * loudest thing in the bar rather than competing with its background.
     */
    <header className="sticky top-0 z-40 border-b border-border-soft bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-12 lg:px-24">
        {/*
          The wordmark: two weights of one name, over a rule that runs out.
          
          The monogram tile is gone — a rounded square with initials in it is
          the single most common personal-site move, and it was doing the
          identity work the name should have been doing. Splitting the weight
          between given and family name makes "Ajwad" the thing you read
          first, and the rule underneath is the only drawn mark on the page:
          it starts in brand purple and dissolves, so it reads as a signature
          rather than a border.
        */}
        <Link href="/" className="group flex flex-col gap-[7px]">
          <span className="flex items-baseline gap-[9px] leading-none">
            <span className="text-[21px] font-bold tracking-[-0.04em] text-foreground transition group-hover:text-accent">
              Ajwad
            </span>
            <span className="text-[21px] font-normal tracking-[-0.02em] text-muted">
              Rauf
            </span>
          </span>
          <span
            aria-hidden
            className="block h-[3px] w-[132px] bg-[linear-gradient(90deg,var(--hue-1)_0%,var(--hue-2)_46%,transparent_100%)] transition-[width] duration-300 group-hover:w-[150px]"
          />
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1 sm:pt-0.5" aria-label="Sections">
          <div className="relative" ref={wrapRef}>
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={open}
              aria-haspopup="true"
              aria-controls="work-menu"
              className={`${pill} inline-flex items-center gap-1.5 ${
                open ? "bg-accent/8 !text-accent" : ""
              }`}
              onClick={() => setOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  openTo(0);
                }
              }}
            >
              Work
              <span
                aria-hidden
                className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}
              >
                ▼
              </span>
            </button>

            {open && (
              <div
                id="work-menu"
                role="menu"
                aria-label="Work"
                /*
                 * Follows the trigger, which moves: the header stacks below
                 * sm, putting Work on the left, so the menu hangs left there
                 * and right-aligns once the header is a single row. Anchoring
                 * it one way for both ran the menu off the screen edge.
                 */
                className="absolute left-0 z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[6px] border border-accent/25 bg-surface py-1 shadow-[0_8px_24px_rgba(43,37,34,0.13)] sm:left-auto sm:right-0"
              >
                {work.map((w, i) => {
                  const external = isExternal(w.href);
                  const cls =
                    "flex items-center justify-between gap-3 px-3 py-2 text-sm text-foreground transition hover:bg-accent/10 hover:text-accent focus:bg-accent/10 focus:text-accent focus:outline-none";
                  const label = (
                    <>
                      {w.name}
                      <span aria-hidden className="text-xs text-muted">
                        {external ? "↗" : "→"}
                      </span>
                    </>
                  );
                  return external ? (
                    <a
                      key={w.href}
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      role="menuitem"
                      href={w.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cls}
                      onKeyDown={(e) => onItemKey(e, i)}
                      onClick={() => setOpen(false)}
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      key={w.href}
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      role="menuitem"
                      href={w.href}
                      className={cls}
                      onKeyDown={(e) => onItemKey(e, i)}
                      onClick={() => setOpen(false)}
                    >
                      {label}
                    </Link>
                  );
                })}
                <a
                  href="#work"
                  role="menuitem"
                  className="mt-1 block border-t border-border-soft px-3 py-2 text-xs text-muted transition hover:text-accent"
                  onClick={() => setOpen(false)}
                >
                  All selected work ↓
                </a>
              </div>
            )}
          </div>

          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className={pill}>
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
