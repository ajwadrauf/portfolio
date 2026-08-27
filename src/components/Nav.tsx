"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveGate } from "./LiveGate";

const LINKS = [
  { href: "/ai-studio", label: "Overview" },
  { href: "/ai-studio/studio", label: "Studio" },
  { href: "/ai-studio/packshots", label: "Packshots" },
  { href: "/ai-studio/ads", label: "Ad Lab" },
  { href: "/ai-studio/prompts", label: "Prompts" },
  { href: "/ai-studio/models", label: "Models" },
  { href: "/ai-studio/build-vs-buy", label: "Build vs. Buy" },
  { href: "/ai-studio/playbook", label: "Playbook" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-background/90 backdrop-blur">
      <div className="brand-strip" />
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <Link
            href="/"
            className="label whitespace-nowrap transition hover:text-foreground"
            title="Back to ajwadrauf.com"
          >
            ← Ajwad Rauf
          </Link>
          <span className="hidden h-4 w-px bg-border-strong sm:block" />
          <Link href="/ai-studio" className="label !text-foreground whitespace-nowrap">
            AI Content Studio
          </Link>
          <span className="sm:hidden">
            <LiveGate />
          </span>
        </div>

        <div className="flex items-center gap-3 sm:order-last">
          <span className="hidden sm:block">
            <LiveGate />
          </span>
        </div>

        <nav className="no-scrollbar -mx-6 flex min-w-0 items-center gap-1 overflow-x-auto px-6 text-sm lg:mx-0 lg:overflow-visible lg:px-0">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-[6px] px-3 py-1.5 transition ${
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
