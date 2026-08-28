import type { Metadata } from "next";
import Link from "next/link";
import { HomeNav } from "@/components/HomeNav";

export const metadata: Metadata = {
  title: "Ajwad Rauf — AI production systems",
  description:
    "Applied AI across marketing and CRM. I build production AI end to end — finding where it changes the economics, prototyping fast, and shipping systems built on real data for a specific context.",
};

type Project = {
  n: string;
  kind: string;
  status: { label: string; tone: "live" | "internal" };
  name: string;
  lede: string;
  href: string;
  cta: string;
  arrow: string;
  note: string;
  /** Why it is gated and who to ask — rendered as prose, not as a mono label. */
  access?: { text: string; linkLabel: string; href: string; after: string };
  body: string[];
  tags: string[];
};

const PROJECTS: Project[] = [
  {
    n: "01",
    kind: "Working AI production pipeline",
    status: { label: "Live", tone: "live" },
    name: "AI Content Studio",
    lede: "One product photo in, a multi-format retail campaign out.",
    href: "/ai-studio",
    cta: "Open the live studio",
    arrow: "↗",
    note: "Browsable end to end · live generation gated",
    access: {
      text: "Every render spends real credits, so generation is behind a passcode. Internal colleagues can reach out directly; recruiters, ",
      linkLabel: "message me on LinkedIn",
      href: "https://www.linkedin.com/in/ajwadrauf",
      after: " and I will open it up.",
    },
    body: [
      "A campaign studio that turns one product photo into stills, bilingual EN/FR promo tiles and video. A packshot generator that produces GS1 planogram angles without a reshoot. An Ad Lab of preset ad recipes — editable, reference-locked, with the sound built in layers the way a studio actually does it. And a prompt builder that teaches the structure rather than handing over a prompt.",
      "Thirteen models from six labs behind two APIs, routed by what each is actually good at: reference-to-video where the packaging must not drift, a cheap draft tier where it does not matter yet. Costed per render before you spend — including the token-billed models, where resolution moves the price more than length does.",
    ],
    tags: ["Generative AI", "Video", "Production systems", "Next.js"],
  },
  {
    n: "02",
    kind: "Consumer AI product",
    status: { label: "Market ready", tone: "live" },
    name: "Persopot",
    lede: "Selfies in, studio headshots and outfit try-ons out.",
    href: "https://persopot.com",
    cta: "persopot.com",
    arrow: "↗",
    note: "Pricing and static try-on demo open — generation needs an account",
    body: [
      "Two AI products on one trained identity: studio headshots ($29–$79 one-time) and an outfit try-on subscription that composites any Pinterest pin or retail product image onto the user's trained face ($5/mo, 30 credits).",
      "Solo build. Two parallel ML pipelines — FLUX.1 for headshots, FLUX.2 for outfits on fal.ai — share a Gemini 2.5-pro validation gate that catches identity drift before users see it. Next.js, Supabase, Stripe, Cloudflare R2 and Trigger.dev: about 95 API routes and 16 migrations across payments, generation and social features (collaborative outfit boards, “ask a bestie” reviews, wishlist with retailer affiliate).",
    ],
    tags: ["Consumer AI", "Full-stack", "Production ML"],
  },
  {
    n: "03",
    kind: "Internal production tool",
    status: { label: "Internal · Loblaw", tone: "internal" },
    name: "BadgeForge",
    lede: "A badge brief in, a reviewed, deployment-ready email badge out.",
    href: "/badgeforge",
    cta: "Read the case study",
    arrow: "→",
    note: "No public URL — internal Loblaw tool",
    body: [
      "An intake-to-deployment platform for the promotional badges in Shoppers Drug Mart and Loblaw CRM emails. Every request moves through a two-phase workflow, Brief then Badge Build, across submission, review, QA and sign-off, with role-based access for marketers, agency producers and admins over Microsoft Entra SSO.",
      "It generates PDF briefs, handles bilingual EN and FR copy, builds UTM links, and validates subject lines with AI (Gemini 2.5 Flash). Transactional email fires at each stage and scheduled jobs send the reminders: daily digest, link-plan and UTM nudges, rejection follow-ups. Next.js App Router on Firebase App Hosting with Firestore and Storage. Solo build at LA Digital.",
    ],
    tags: ["Internal tooling", "Workflow automation", "Next.js + Firebase"],
  },
];

const APPROACH = [
  {
    h: "Production first",
    p: "I start from the output a team actually has to ship — a planogram angle, a bilingual tile, a signed-off badge — and build backwards to the model.",
    short: "I start from the output a team has to ship and build backwards to the model.",
  },
  {
    h: "Gates, not vibes",
    p: "Every pipeline has a quality gate and a cost ceiling. Bad generations get caught before a user or a reviewer sees them.",
    short: "Every pipeline has a quality gate and a cost ceiling.",
  },
  {
    h: "Solo to shipped",
    p: "Design, build, deploy, support. All three projects here went from idea to live users without a hand-off, including one through enterprise SSO and review.",
    short: "Design, build, deploy, support — no hand-off.",
  },
];

/**
 * The marquee list. Duplicated in the markup so the track can travel exactly
 * -50% and rejoin itself without a seam.
 */
const SKILLS = [
  "Built & shipped",
  "Agentic workflows",
  "Production AI",
  "Marketing & CRM",
  "Conversational analytics",
  "Generative media",
  "Data infrastructure",
  "Text-to-SQL",
  "Personalization",
  "Prompt systems",
];

const LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ajwadrauf" },
  { label: "GitHub", href: "https://github.com/ajwadrauf" },
];

function StatusDot({ status }: { status: Project["status"] }) {
  const color = status.tone === "live" ? "text-success" : "text-warning";
  const bg = status.tone === "live" ? "bg-success" : "bg-warning";
  return (
    <span className={`inline-flex items-center gap-1.5 ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${bg}`} />
      {status.label}
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Work menu is built from the projects below, so it cannot go stale. */}
      <HomeNav work={PROJECTS.map((p) => ({ name: p.name, href: p.href }))} />

      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto grid max-w-[1440px] items-end gap-10 px-6 pb-16 pt-12 sm:px-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-[88px] lg:px-24 lg:pb-28 lg:pt-24">
        <div>
          <h1 className="text-[clamp(2.875rem,8.5vw,6.5rem)] leading-[0.94] tracking-[-0.045em]">
            I build working
            <br className="hidden sm:block" /> AI production
            <br className="hidden sm:block" /> systems.
          </h1>
          <p className="mt-6 max-w-[20ch] text-xl leading-[1.45] tracking-[-0.01em] sm:text-2xl lg:mt-9">
            Not decks about them.
          </p>
        </div>
        <div className="lg:pb-3.5">
          <p className="text-[15px] leading-[1.7] text-muted sm:text-[17px]">
            Applied AI, mostly across marketing and CRM. I look for where AI
            changes the economics of a job, prototype fast, then ship something
            built on real data for a specific context — end to end, through
            security review, into people&apos;s hands. Built by hand, not bought
            off a shelf. Three of those systems are below.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <span className="chip">Toronto</span>
            <span className="chip">AI · Marketing &amp; CRM</span>
            <span className="chip">Solo builds, shipped</span>
          </div>
        </div>
      </section>

      {/* ---------------- Skills marquee ---------------- */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex">
              {SKILLS.map((skill) => (
                <span key={`${copy}-${skill}`} className="marquee-item">
                  {skill}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* The loop is decorative; the same list, readable, for screen readers. */}
      <p className="sr-only">
        Focus areas: {SKILLS.join(", ")}.
      </p>

      {/* ---------------- Selected work ---------------- */}
      <div
        id="work"
        className="mx-auto flex max-w-[1440px] items-baseline justify-between border-t border-border-soft px-6 pb-8 pt-8 sm:px-12 lg:px-24"
      >
        <span className="label !tracking-[0.16em]">Selected work</span>
        <span className="label !tracking-[0.16em]">Three projects</span>
      </div>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-6 pb-20 sm:px-12 lg:gap-7 lg:px-24 lg:pb-26">
        {PROJECTS.map((p) => (
          <article
            key={p.n}
            className="card grid gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:px-14 lg:py-13"
          >
            <div>
              <div className="label flex flex-wrap items-center gap-x-3.5 gap-y-1">
                <span className="text-accent">{p.n}</span>
                <span>{p.kind}</span>
                <StatusDot status={p.status} />
              </div>
              <h2 className="mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02] tracking-[-0.035em]">
                {p.name}
              </h2>
              <p className="mt-4 text-lg leading-[1.35] tracking-[-0.015em] sm:text-[23px] sm:leading-[1.4]">
                {p.lede}
              </p>
              <div className="mt-7">
                <Link
                  href={p.href}
                  target={p.href.startsWith("http") ? "_blank" : undefined}
                  rel={p.href.startsWith("http") ? "noreferrer" : undefined}
                  className="link-rule text-[15px] sm:text-base"
                >
                  {p.cta} <span className="font-mono">{p.arrow}</span>
                </Link>
              </div>
              <p className="label-sm mt-3.5">{p.note}</p>
              {p.access && (
                <p className="mt-3 max-w-[46ch] text-[13px] leading-[1.65] text-muted">
                  {p.access.text}
                  <a
                    href={p.access.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-accent hover:underline"
                  >
                    {p.access.linkLabel}
                  </a>
                  {p.access.after}
                </p>
              )}
            </div>

            <div>
              {p.body.map((para, i) => (
                <p
                  key={i}
                  className={`text-sm leading-[1.75] text-muted sm:text-[17px] ${i > 0 ? "mt-4" : ""}`}
                >
                  {para}
                </p>
              ))}
              <div className="label-sm mt-7 flex flex-wrap items-center gap-2 border-t border-border-soft pt-5">
                {p.tags.map((t, i) => (
                  <span key={t} className="flex items-center gap-2">
                    {i > 0 && <span className="text-accent">·</span>}
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* ---------------- Approach ---------------- */}
      <section
        id="approach"
        className="mx-auto max-w-[1440px] border-t border-border-soft px-6 py-14 sm:px-12 lg:px-24 lg:pb-24 lg:pt-16"
      >
        <span className="label !tracking-[0.16em]">How I work</span>
        <div className="mt-8 grid gap-8 lg:mt-11 lg:grid-cols-3 lg:gap-14">
          {APPROACH.map((a) => (
            <div key={a.h}>
              <h3 className="text-xl leading-[1.2] tracking-[-0.02em] sm:text-[26px]">
                {a.h}
              </h3>
              <p className="mt-3 text-sm leading-[1.7] text-muted sm:text-base">
                <span className="hidden sm:inline">{a.p}</span>
                <span className="sm:hidden">{a.short}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Contact ---------------- */}
      <footer id="contact" className="border-t border-border-soft bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 px-6 py-12 sm:px-12 lg:flex-row lg:items-end lg:px-24 lg:pb-22 lg:pt-18">
          <div>
            <span className="label !tracking-[0.16em]">Contact</span>
            <div className="mt-4 text-2xl tracking-[-0.02em] sm:text-4xl lg:mt-5 lg:text-[44px] lg:tracking-[-0.03em]">
              <a
                href="mailto:ajwadrauf@gmail.com"
                className="border-b border-accent/40 pb-1 transition hover:border-accent"
              >
                ajwadrauf@gmail.com
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 lg:gap-[30px] lg:pb-2.5">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="label !tracking-[0.12em] text-accent transition hover:text-accent-soft"
              >
                {l.label} ↗
              </a>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] px-6 pb-8 sm:px-12 lg:px-24">
          <p className="label-sm !text-[10px] !tracking-[0.12em]">
            Ajwad Rauf · Toronto · 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
