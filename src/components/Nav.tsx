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
    <header className="nav-bar sticky top-0 z-40 border-b border-accent/20 backdrop-blur">
      <div className="brand-strip" />
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          {/* Same monogram as the portfolio header — the two halves are one site. */}
          <Link
            href="/"
            className="group flex items-center gap-2 whitespace-nowrap"
            title="Back to ajwadrauf.com"
          >
            <span
              aria-hidden
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[linear-gradient(135deg,var(--hue-1),var(--hue-2)_45%,var(--hue-3))] font-mono text-[10px] font-bold leading-none text-white transition group-hover:brightness-110"
            >
              AR
            </span>
            <span className="label !text-[12px] font-medium transition group-hover:text-accent min-[360px]:!text-[14px]">
              Ajwad Rauf
            </span>
          </Link>
          <span className="hidden h-4 w-px bg-accent/30 sm:block" />
          <Link
            href="/ai-studio"
            className="label !text-[12px] !text-accent whitespace-nowrap font-semibold min-[360px]:!text-[14px]"
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
