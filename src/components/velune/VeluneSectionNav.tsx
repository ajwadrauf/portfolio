"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Velune.module.css";

const sections = [
  { id: "campaign-brief", label: "Brief" },
  { id: "camera-study", label: "Camera plan" },
  { id: "creative-direction", label: "Creative decisions" },
  { id: "visual-references", label: "Visual references" },
  { id: "package-design", label: "Packaging" },
  { id: "production-workflow", label: "Production" },
  { id: "sound-direction", label: "Sound" },
  { id: "after-effects", label: "After Effects" },
  { id: "velune-film", label: "Finished film" },
] as const;

export function VeluneSectionNav() {
  const [current, setCurrent] = useState<(typeof sections)[number]>(sections[0]);
  const bar = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  useEffect(() => {
    const targets = sections.map(({ id }) => document.getElementById(id));
    let frame = 0;

    function update() {
      frame = 0;
      const readingLine = (bar.current?.offsetHeight ?? 0) + 40;
      const index = targets.findLastIndex((target) => target && target.getBoundingClientRect().top <= readingLine);
      setCurrent(sections[Math.max(0, index)]);
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, []);

  const links = sections.map((section) => (
    <li key={section.id}>
      <a
        href={`#${section.id}`}
        aria-current={section.id === current.id ? "location" : undefined}
        onClick={(event) => {
          if (!menu.current?.open || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          menu.current.open = false;
        }}
      >
        {section.label}
      </a>
    </li>
  ));

  return (
    <nav ref={bar} className={styles.chapterNav} aria-label="Campaign sections">
      <div className={`${styles.wrap} ${styles.chapterInner}`}>
        <ul className={styles.chapterLinks}>{links}</ul>
        <details
          ref={menu}
          className={styles.chapterMenu}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !event.currentTarget.open) return;
            event.currentTarget.open = false;
            summary.current?.focus();
          }}
        >
          <summary ref={summary}>
            <span>Jump to section</span>
            <span className={styles.chapterCurrent}>{current.label}</span>
          </summary>
          <ul>{links}</ul>
        </details>
      </div>
    </nav>
  );
}
