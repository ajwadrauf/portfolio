"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/studio", label: "Studio" },
  { href: "/packshots", label: "Packshots" },
  { href: "/ads", label: "Ad Lab" },
  { href: "/models", label: "Models" },
  { href: "/build-vs-buy", label: "Build vs. Buy" },
  { href: "/playbook", label: "Playbook" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-background/85 backdrop-blur">
      <div className="brand-strip" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
            AI
          </span>
          Content Studio
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  active
                    ? "bg-surface-2 font-semibold text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
