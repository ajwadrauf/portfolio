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

  const pill =
    "rounded-[6px] px-2 py-1.5 text-sm text-muted transition hover:bg-accent/8 hover:text-accent sm:px-3";

  return (
    <header className="nav-bar sticky top-0 z-40 border-b border-accent/20 backdrop-blur">
      <div className="brand-strip" />
      <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-12 lg:px-24">
        {/*
          The wordmark, not a nav item.
          
          It was mono uppercase in accent — the same treatment as every eyebrow
          on the page, which made a person's name read as another label. A
          monogram in the brand gradient plus the name set in the display face
          gives the bar something to be anchored by, and it is the one place
          the spectrum appears at a size anyone actually registers.
        */}
        <Link href="/" className="group flex items-center gap-2.5 whitespace-nowrap">
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[linear-gradient(135deg,var(--hue-1),var(--hue-2)_45%,var(--hue-3))] font-mono text-[11px] font-bold leading-none tracking-[0.02em] text-white shadow-sm transition group-hover:brightness-110"
          >
            AR
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground transition group-hover:text-accent">
              Ajwad Rauf
            </span>
            <span className="mt-[3px] font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
              AI production systems
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Sections">
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
