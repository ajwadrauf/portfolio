import type { Metadata } from "next";
import Link from "next/link";
import { CreamCompare } from "@/components/studio/CreamCompare";
import { VeluneCard } from "@/components/velune/VeluneCard";
import { StudioStart } from "@/components/studio/StudioStart";

export const metadata: Metadata = {
  title: "AI Content Studio — Ajwad Rauf",
  description:
    "A working AI content studio: product imagery, bilingual campaigns, motion and sound. Watch a finished Seedance film beside its Blender motion guide and explore the tools behind it.",
};

const SHELL = "mx-auto w-full max-w-6xl px-6";

/**
 * Six ways in, in the order someone would use them.
 *
 * The page used to lead with four mandates and a job posting quoted back at
 * the reader, then show the tools most of the way down. This is the part a
 * visitor came for, so it sits directly under the work.
 */
const TOOLS = [
  {
    href: "/ai-studio/ads",
    name: "Ad Lab",
    task: "Shape a product ad with a beat sheet, references and sound direction",
    body: "Preset ad recipes any SKU can run through — aesthetics, beat-by-beat action, overlay spec — every part editable, with the product held still by reference-to-video. Sound is built in layers rather than asked for in one go.",
    tags: ["Short-form video", "Prompt systems", "Sound design"],
    cta: "Open Ad Lab",
  },
  {
    href: "/ai-studio/studio",
    name: "Campaign Studio",
    task: "Build an editable campaign brief and a multi-format creative pack",
    body: "Vision analysis, an AI-written brief you can edit, then stills and video across formats, languages and seasons — each routed to the model that suits it at the price it deserves.",
    tags: ["Stills", "Motion", "EN/FR versioning"],
    cta: "Open Campaign Studio",
  },
  {
    href: "/ai-studio/packshots",
    name: "Packshot Studio",
    task: "Turn product photos or packaging artwork into usable views",
    body: "Start from photos, or map flat artwork onto a measured package. Inspect it in 3D, render clean views and send a completed packshot into the same campaign project. Reconstructed views remain flagged for label QA.",
    tags: ["Product on white", "A/B bake-offs", "Governance"],
    cta: "Open Packshot Studio",
  },
  {
    href: "/ai-studio/blender",
    name: "Blender",
    task: "Build a shot brief for editable 3D motion guidance",
    body: "Camera, timing and blocking settled in geometry before a generative pass ever runs — the same route that produced the study above. The builder checks the brief for the mistakes that fail quietly.",
    tags: ["3D control passes", "Camera plans", "Motion reference"],
    cta: "Build a Blender brief",
  },
  {
    href: "/ai-studio/prompts",
    name: "Prompt Builder",
    task: "Give references distinct roles and plan the timeline",
    body: "Register, subject, and what each reference is actually for, then a timeline that makes you spend the seconds on purpose. Every field says what goes wrong without it.",
    tags: ["Teaching", "Prompt structure", "Timing"],
    cta: "Open Prompt Builder",
  },
  {
    href: "/ai-studio/models",
    name: "Model landscape",
    task: "Compare the configured models and choose a route for the job",
    body: "Every route with its price, what it is good at, and where it breaks — image, video and sound in one table, so picking one is a decision rather than a habit.",
    tags: ["Routing", "Cost per render", "Ready / emerging"],
    cta: "Open the model landscape",
  },
] as const;

/** The hands-on story, condensed to what each claim can be checked against. */
const PRACTICE = [
  {
    h: "Produce the work",
    p: "Everything here is a working tool rather than a case-study screenshot. A product photo goes in and finished stills, bilingual tiles, packshots and scored video come out, in the browser, in minutes.",
  },
  {
    h: "Stand up the workflow",
    p: "Self-filling intake, one brief driving every deliverable, routing by job and price, and named quality gates — written down in the playbook so it survives past one person.",
  },
  {
    h: "Evaluate the tools",
    p: "Image, video and sound routes sit behind one table with a written view on what is ready, what is emerging and what is not viable yet, plus a one-pager on suites versus aggregators versus direct APIs.",
  },
  {
    h: "Govern it",
    p: "Review with evidence: preserve prompts and source references, flag reconstructed angles for label QA, and record the human decisions that an AI observation cannot establish.",
  },
] as const;

/** Judgment that cost something to acquire — the least substitutable part. */
const LEARNED = [
  {
    h: "Video models don't compose music",
    p: "They render effects, ambience and dialogue convincingly, then approximate a score. So the layers split: the video model does sound design, a music model composes, the mix stays a finishing step.",
  },
  {
    h: "Text-in-image is a routing decision",
    p: "Bilingual tiles need legible, editable copy. Approve the image first, then set EN/FR typography in the layout; use model tiers for the visual job rather than asking generation to guarantee every letter.",
  },
  {
    h: "AI can't know what it never saw",
    p: "A generated packshot of a panel no camera captured is a plausible reconstruction, not a record. It gets labelled that way every time — a wrong ingredient list is a recall, not a retouch.",
  },
  {
    h: "The models change. The production record stays.",
    p: "New models earn their place against a real brief, a cost estimate and a review of the result. Shared projects keep the references and decisions portable; provider adapters keep each model's requirements explicit.",
  },
] as const;

const DETAIL = [
  { href: "/ai-studio/playbook", label: "Read the playbook" },
  { href: "/ai-studio/build-vs-buy", label: "Build vs. buy" },
  { href: "/ai-studio/models", label: "Model landscape" },
] as const;

export default function StudioOverview() {
  return (
    <div>
      {/* ------------------------------- Hero ------------------------------ */}
      <section className={`${SHELL} pb-14 pt-14 sm:pb-16 sm:pt-20`}>
        <p className="chip mb-6">Portfolio · applied AI for content production</p>
        <h1 className="max-w-3xl text-[clamp(2.4rem,6vw,4rem)] font-medium leading-[1.02] tracking-[-0.04em]">
          Make the work.
          <span className="block text-accent">Build the system.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Product imagery, campaigns and motion, connected by clear briefs, model
          choices and quality checks. Explore the tools, then see how I plan the
          work in Blender and bring it to life with Seedance.
        </p>
        <div className="mt-9 flex max-w-lg flex-col gap-3 sm:flex-row">
          <a href="#tools" className="btn-block">
            Explore the tools <span aria-hidden>↓</span>
          </a>
          <a href="#motion-study" className="btn-block">
            See Blender → Seedance <span aria-hidden>↓</span>
          </a>
        </div>
      </section>

      <StudioStart />
      {/* ------------------------- The work, first ------------------------- */}
      <CreamCompare />

      <section className={`${SHELL} py-12`} aria-label="New film in production">
        <VeluneCard compact />
      </section>

      {/* ------------------------------ The tools -------------------------- */}
      {/* 28, not 4: the studio header is sticky and ~100px tall stacked on a
          phone, so a 16px margin dropped the heading underneath it. */}
      <section id="tools" className={`${SHELL} scroll-mt-28 py-16 lg:py-20`}>
        <div className="max-w-2xl">
          <p className="label !text-accent">Six surfaces, one production system</p>
          <h2 className="mt-2 text-[clamp(1.7rem,3.4vw,2.4rem)] tracking-[-0.035em]">
            Choose your starting point.
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            Each covers a different slice of what a retail agency actually ships,
            and they share the same intake, routing, cost and governance layer.
          </p>
        </div>

        {/*
          Cards are articles with one button inside, not links wrapping links.
          A whole-card anchor with a second anchor inside it is invalid, and the
          version where the action is a caption is the discoverability problem
          the homepage just fixed.
        */}
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <article key={t.href} className="card flex flex-col p-6">
              <h3 className="text-lg tracking-[-0.02em]">{t.name}</h3>
              <p className="mt-1.5 text-sm font-medium text-accent">{t.task}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{t.body}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.tags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
              <Link href={t.href} className="btn-block mt-5">
                {t.cta} <span aria-hidden>↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------- How it is made ------------------------ */}
      <section className={`${SHELL} border-t border-border-soft py-16 lg:py-20`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="label !text-accent">How the work gets made</p>
            <h2 className="mt-2 text-[clamp(1.7rem,3.4vw,2.4rem)] leading-[1.1] tracking-[-0.035em]">
              Retail content is a versioning business.
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              One campaign multiplies across formats, placements, seasons, banners
              and — in Canada — two official languages. One idea becomes forty
              assets before it reaches a shopper. Traditional production can make
              the one beautifully; it cannot make the forty at that cadence.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              That is the gap this closes, and it moves where craft lives. An
              adaptation that took a studio day becomes a routed call costing
              cents, so judgment moves upstream — into the brief, the prompt
              system and the quality gate.
            </p>
          </div>

          <div>
            <div className="grid gap-7 sm:grid-cols-2">
              {PRACTICE.map((m) => (
                <div key={m.h}>
                  <h3 className="text-base font-semibold tracking-[-0.01em]">{m.h}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{m.p}</p>
                </div>
              ))}
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {DETAIL.map((d) => (
                <Link key={d.href} href={d.href} className="btn-block">
                  {d.label} <span aria-hidden>↗</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- What it taught ----------------------- */}
      <section className={`${SHELL} border-t border-border-soft py-16 lg:py-20`}>
        <div className="max-w-2xl">
          <p className="label !text-accent">What shipping taught me</p>
          <h2 className="mt-2 text-[clamp(1.7rem,3.4vw,2.4rem)] tracking-[-0.035em]">
            Four things you only learn by shipping.
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            Knowing what is ready, what is emerging and what is not viable comes
            from hitting the limits rather than reading about them.
          </p>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-[6px] border border-border-soft bg-border-soft sm:grid-cols-2">
          {LEARNED.map((l) => (
            <div key={l.h} className="bg-surface p-6">
              <h3 className="font-semibold leading-snug">{l.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{l.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- Access ---------------------------- */}
      <section className={`${SHELL} border-t border-border-soft py-16 lg:py-20`}>
        <div className="max-w-2xl">
          <h2 className="text-[clamp(1.7rem,3.4vw,2.4rem)] tracking-[-0.035em]">
            Browse it free. Generating is the part that costs.
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Every page here is open, and demo mode walks the whole pipeline —
            intake, brief, routing, quality gates — at zero spend. Live rendering
            is behind a passcode, because each run bills a real account. Every live
            run shows its estimated cost and asks before it spends.
          </p>
          <p className="mt-4 leading-relaxed text-muted">
            If you are reviewing this and want the passcode,{" "}
            <a
              href="https://www.linkedin.com/in/ajwadrauf"
              className="font-semibold text-accent hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              message me on LinkedIn
            </a>{" "}
            or email{" "}
            <a
              href="mailto:hello@ajwadrauf.com"
              className="font-semibold text-accent hover:underline"
            >
              hello@ajwadrauf.com
            </a>
            .
          </p>
          <div className="mt-8 max-w-sm">
            <Link href="/ai-studio/ads" className="btn-block">
              Start in the Ad Lab <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
