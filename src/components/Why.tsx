"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small "why does this exist" bubble.
 *
 * Click, not hover: a hover tooltip is unreachable on touch and disappears the
 * moment you move toward it, which makes it useless for anything longer than a
 * label. This holds a paragraph, so it has to stay open while it is read.
 *
 * The content is the reasoning behind a control, not a description of it. A
 * label already says what a button does; this says why the button is worth
 * pressing, which is the part that is usually only in someone's head.
 */
export function Why({
  title,
  children,
  align = "left",
}: {
  title: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  // Close on outside click and on Escape — the two ways anyone expects to
  // dismiss a popover, and neither is free with a plain conditional render.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrap} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Why: ${title}`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none transition ${
          open
            ? "border-accent bg-accent text-background"
            : "border-muted/50 text-muted hover:border-accent hover:text-accent"
        }`}
      >
        ?
      </button>
      {open && (
        <span
          role="note"
          className={`absolute bottom-[calc(100%+8px)] z-30 w-[min(19rem,72vw)] rounded-[6px] border border-border-strong bg-surface p-3 text-left shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="block label !text-accent">{title}</span>
          <span className="mt-1.5 block text-xs leading-[1.6] font-normal normal-case tracking-normal text-muted">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}
