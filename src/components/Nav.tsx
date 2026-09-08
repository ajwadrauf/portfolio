"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UngatedBanner } from "./LiveGate";
import { Wordmark } from "./Wordmark";

const LINKS = [
  { href: "/ai-studio", label: "Overview" },
  { href: "/ai-studio/ads", label: "Ad Lab" },
  { href: "/ai-studio/studio", label: "Studio" },
  { href: "/ai-studio/packshots", label: "Packshots" },
  { href: "/ai-studio/prompts", label: "Prompt builder" },
  { href: "/ai-studio/blender", label: "Blender" },
  { href: "/ai-studio/models", label: "Models" },
  { href: "/ai-studio/build-vs-buy", label: "Build vs. Buy" },
  { href: "/ai-studio/playbook", label: "Playbook" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    /* Same treatment as the portfolio header — no wash, no strip, one hairline. */
    <header className="sticky top-0 z-40 border-b border-border-soft bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          {/*
            The site wordmark at back-link scale — the same mark the homepage
            header carries, not a second one that resembles it. It used to be
            a two-weight "Ajwad Rauf" over a gradient rule, which introduced
            the site differently depending on which page you landed on.
          */}
          <Link href="/" title="Back to ajwadrauf.com" className="self-center">
            <Wordmark size="sm" />
          </Link>
          <span className="hidden h-5 w-px self-center bg-border-strong sm:block" />
          <Link
            href="/ai-studio"
            className="label !text-[12px] !text-accent self-center whitespace-nowrap font-semibold min-[360px]:!text-[14px]"
          >
            AI Content Studio
          </Link>
        </div>

        <nav className="no-scrollbar -mx-4 flex min-w-0 items-center gap-1 overflow-x-auto px-4 text-sm sm:-mx-6 sm:px-6 xl:mx-0 xl:overflow-visible xl:px-0">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-[6px] px-3 py-1.5 transition ${
                  active
                    ? "bg-accent font-semibold text-white shadow-[0_1px_6px_rgba(118,61,93,0.35)]"
                    : "text-muted hover:bg-accent/8 hover:text-accent"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <UngatedBanner />
    </header>
  );
}
