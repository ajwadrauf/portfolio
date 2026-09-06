"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UngatedBanner } from "./LiveGate";

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
        <div className="flex items-start justify-between gap-4 sm:justify-start">
          {/* The portfolio wordmark, at back-link scale. */}
          <Link
            href="/"
            className="group flex flex-col gap-[5px]"
            title="Back to ajwadrauf.com"
          >
            <span className="flex items-baseline gap-[7px] leading-none">
              <span className="text-[15px] font-bold tracking-[-0.04em] text-foreground transition group-hover:text-accent min-[360px]:text-[17px]">
                Ajwad
              </span>
              <span className="text-[15px] font-normal tracking-[-0.02em] text-muted min-[360px]:text-[17px]">
                Rauf
              </span>
            </span>
            <span
              aria-hidden
              className="block h-[2px] w-[86px] bg-[linear-gradient(90deg,var(--hue-1)_0%,var(--hue-2)_46%,transparent_100%)] transition-[width] duration-300 group-hover:w-[100px]"
            />
          </Link>
          <span className="hidden h-5 w-px self-start bg-border-strong sm:block" />
          <Link
            href="/ai-studio"
            className="label !text-[12px] !text-accent self-start whitespace-nowrap font-semibold min-[360px]:!text-[14px]"
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
                    ? "bg-accent font-semibold text-white shadow-[0_1px_6px_rgba(142,58,124,0.35)]"
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
