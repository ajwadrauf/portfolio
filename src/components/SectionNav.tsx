"use client";

import { useEffect, useState } from "react";

export type NavSection = { id: string; num: string; label: string };

/**
 * Sticky table of contents with scroll-spy. A long reference document needs a
 * way in — without one it's just a scroll.
 */
export function SectionNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      // Bias the trigger line toward the top third of the viewport.
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Sections" className="text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Contents
      </p>
      <ol className="space-y-1">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`flex gap-2.5 rounded-md px-2 py-1.5 transition ${
                  isActive
                    ? "bg-surface-2 font-semibold text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`font-mono text-xs ${isActive ? "text-accent" : "text-muted/60"}`}
                >
                  {s.num}
                </span>
                {s.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
