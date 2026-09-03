import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { HomeNav } from "@/components/HomeNav";
import { ClayCompare } from "@/components/ClayCompare";
import { ShowcaseStrip } from "@/components/ShowcaseStrip";
import { CLAY_PAIR, SHOWCASE, isHosted, showcaseEnvKey } from "@/lib/showcase";

export const metadata: Metadata = {
  title: "Ajwad Rauf — AI production systems",
  description:
    "Applied AI for content production, mostly in retail marketing. I build the pipelines that close the gap between content demand and what a team can actually make — stills, motion and sound, shipped end to end.",
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
  /**
   * A strip of frames from the work itself.
   *
   * A portfolio for a craft role that is three columns of prose asks the
   * reader to take the work on trust. Omitted where there is nothing honest
   * to show — an NDA project has no public frames, and a placeholder would
   * be worse than a card that does not claim one.
   */
  frames?: {
    /** Preferred local path under /public. Used whenever the file is committed. */
    src: string;
    alt: string;
    /**
     * Where to load it from until the file is committed here.
     *
     * Lets a card show its work immediately while the asset still lives on
     * the product's own site, without the portfolio depending on that site
     * permanently: commit the file and the local copy wins on the next build.
     */
    hosted?: string;
  }[];
  /** What the strip shows, since a row of stills does not explain itself. */
  framesNote?: string;
  /**
   * Two or three named capabilities worth pulling out of the prose.
   *
   * Some products are not explained by what they generate. Persopot's
   * differentiator is what happens after the render, and a reader skimming
   * three paragraphs of stack detail will miss it — so the features that
   * carry the argument get their own row rather than a parenthetical.
   */
  features?: { name: string; what: string }[];
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
    frames: [
      { src: "/the-wall/f001.jpg", alt: "Clay control pass, opening frame" },
      { src: "/the-wall/f072.jpg", alt: "Clay control pass, camera pulling back" },
      { src: "/the-wall/f144.jpg", alt: "Clay control pass, mid move" },
      { src: "/the-wall/f204.jpg", alt: "Clay control pass, product settling" },
      { src: "/the-wall/f288.jpg", alt: "Clay control pass, final frame" },
    ],
    framesNote: "Five frames from one 12s clay pass — 0 credits",
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
    frames: [
      {
        src: "/persopot/garment.jpg",
        hosted: "https://persopot.com/marketing/home/outfit-source.jpg",
        alt: "Source garment — a forest green crew sweater on a hanger",
      },
      {
        src: "/persopot/tryon-1.jpg",
        hosted: "https://persopot.com/marketing/home/outfit-result-1.jpg",
        alt: "The same sweater rendered on a trained identity",
      },
      {
        src: "/persopot/tryon-2.jpg",
        hosted: "https://persopot.com/marketing/home/outfit-result-2.jpg",
        alt: "The same sweater rendered on a second trained identity",
      },
    ],
    framesNote: "One garment reference, two trained identities — from a pin in about 30 seconds",
    body: [
      "Two AI products on one trained identity: studio headshots ($29–$79 one-time) and an outfit try-on subscription that composites any Pinterest pin, retailer page or screenshot onto the user’s trained face ($5/mo, 30 credits).",
      "Generating the image is the easy half. What makes it a product is what happens next, and the whole thing is built around a plain fact about buying clothes: almost nobody decides alone. Five dresses before a wedding, a bachelorette party coordinating outfits in one shared pot, a second read from your partner before you walk out the door — the render is the beginning of that conversation, not the end of it.",
      "Solo build. Two parallel ML pipelines — FLUX.1 for headshots, FLUX.2 for outfits on fal.ai — share a Gemini 2.5-pro validation gate that catches identity drift before a user sees it. Next.js, Supabase, Stripe, Cloudflare R2 and Trigger.dev: about 95 API routes and 16 migrations across payments, generation and the social layer.",
    ],
    features: [
      {
        name: "Pots",
        what: "Shared collections. Group the looks you are deciding between, keep them in one place, and open them to the people deciding with you.",
      },
      {
        name: "Ask a bestie",
        what: "Puts an outfit in front of the person whose opinion was going to settle it anyway — before the purchase, not after the delivery.",
      },
    ],
    tags: ["Consumer AI", "Social product", "Full-stack", "Production ML"],
  },
  {
    n: "03",
    kind: "Internal production tool",
    status: { label: "Internal · Loblaw", tone: "internal" },
    name: "Project Forge",
    lede: "A badge brief in, a reviewed, deployment-ready email badge out.",
    href: "/project-forge",
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
  {
    h: "Built to hand over",
    p: "Capability that lives in one person's head isn't a studio — it's a bottleneck with a title. So every asset exposes the prompt that made it, and every workflow is documented well enough that the tenth person can run it.",
    short: "Every asset exposes its prompt; every workflow is written down.",
  },
];

/**
 * The marquee list. Duplicated in the markup so the track can travel exactly
 * -50% and rejoin itself without a seam.
 */
const SKILLS = [
  "Built & shipped",
  "Stills",
  "Motion",
  "Generative media",
  "Sound design",
  "Bilingual EN/FR versioning",
  "Prompt systems",
  "Model routing",
  "Quality gates",
  "Retail content",
];

/**
 * Judgment, stated as things that cost something to find out. The full
 * versions live in the studio; these are the compressed forms, here because a
 * Director is hired for knowing what is ready and what is not, and that is
 * only credible when it is specific.
 */
const LEARNED = [
  {
    h: "The leaderboard flips quarterly",
    p: "Sora 2's API sunset stranded pipelines built on it. Model IDs and prices sit in one config file with environment overrides, so switching vendor is an edit, not a rebuild.",
  },
  {
    h: "Video models don't write music",
    p: "They render effects, ambience and dialogue convincingly, then approximate a score. So the layers split: the video model does sound design, a music model composes, the mix stays a finishing step.",
  },
  {
    h: "Text-in-image is a routing decision",
    p: "Most image models still mangle type. That one constraint is why bilingual tiles route to the pro tier while format adaptations run four times cheaper on flash.",
  },
  {
    h: "AI can't know what it never saw",
    p: "A generated packshot of a panel no camera captured is a plausible reconstruction, not a record. It gets labelled that way every time — a wrong ingredient list is a recall, not a retouch.",
  },
];

const LINKS = [{ label: "LinkedIn", href: "https://www.linkedin.com/in/ajwadrauf" }];

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

const onDisk = (p: string) => {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", p.replace(/^\//, "")));
  } catch {
    return false;
  }
};

/** A source is usable if it is a URL, or a file that is actually there. */
const resolve = (src: string | undefined) =>
  src && (isHosted(src) || onDisk(src)) ? src : undefined;

/**
 * Only work that actually exists, from an env override, a URL in the manifest,
 * or a committed file — in that order. An empty showcase removes the section
 * rather than rendering broken frames at the top of the page.
 */
/*
 * Local file first, then whatever the card named as a stand-in, then nothing.
 * A frame with neither is dropped rather than rendered broken, and a strip
 * left with no frames disappears rather than leaving a gap.
 */
const projects: Project[] = PROJECTS.map((p) => {
  const frames = p.frames
    ?.map((f) => ({ ...f, src: onDisk(f.src) ? f.src : (f.hosted ?? "") }))
    .filter((f) => f.src !== "");
  return { ...p, frames: frames?.length ? frames : undefined };
});

const showcase = SHOWCASE.map((i) => {
  const file = resolve(process.env[showcaseEnvKey(i.id)]?.trim() || i.file);
  const poster = resolve(process.env[showcaseEnvKey(i.id, true)]?.trim() || i.poster);
  return file ? { ...i, file, poster } : null;
}).filter((i): i is NonNullable<typeof i> => i !== null);

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Work menu is built from the projects below, so it cannot go stale. */}
      <HomeNav work={projects.map((p) => ({ name: p.name, href: p.href }))} />

      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto grid max-w-[1440px] items-end gap-10 px-6 pb-16 pt-12 sm:px-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-[88px] lg:px-24 lg:pb-28 lg:pt-24">
        <div>
          <h1 className="text-[clamp(2.875rem,8.5vw,6.5rem)] leading-[0.94] tracking-[-0.045em]">
            I build working
            <br className="hidden sm:block" /> AI production
            <br className="hidden sm:block" /> systems.
          </h1>
          {/*
            Second half of the headline's sentence, not a separate thought —
            so it sits close enough to read as one. At lg it had drifted far
            enough below the last line to look like an orphaned caption.
          */}
          <p className="mt-4 max-w-[20ch] text-xl leading-[1.45] tracking-[-0.01em] text-muted sm:text-2xl lg:mt-5">
            Not decks about them.
          </p>
        </div>
        <div className="lg:pb-3.5">
          <p className="text-[15px] leading-[1.7] text-muted sm:text-[17px]">
            Applied AI for content production, mostly in retail marketing.
            Content demand has outrun what any team can hand-make; I build the
            pipelines that close that gap — stills, motion and sound — and take
            them end to end, through security review, into people&apos;s hands.
            Built by hand, not bought off a shelf. Three of those systems are
            below.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <span className="chip">Toronto</span>
            <span className="chip">AI · Content production</span>
            <span className="chip">Solo builds, shipped</span>
          </div>
        </div>
      </section>

      {/* ---------------- Output, before the argument ---------------- */}
      {/*
        Craft first, argument second — and the pair says it faster than the
        strip did. The strip stays below for everything else, and removes
        itself when there is nothing in it.
      */}
      <section
        aria-label="Selected output"
        className="mx-auto max-w-[1440px] px-6 pb-4 sm:px-12 lg:px-24"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <span className="label !tracking-[0.16em]">Made with the studio</span>
          <span className="text-xs text-muted/80">
            One shot, twice — press play and watch them together.
          </span>
        </div>
        <div className="mt-6">
          <ClayCompare
            left={CLAY_PAIR.left}
            right={CLAY_PAIR.right}
            href={CLAY_PAIR.href}
            hrefLabel={CLAY_PAIR.hrefLabel}
          />
        </div>
      </section>

      <ShowcaseStrip items={showcase} />

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
        {projects.map((p) => (
          <article
            key={p.n}
            className="card grid gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:px-14 lg:py-13"
          >
            <div className="min-w-0">
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

              {/*
                Frames from the work, under the claim they belong to. A row
                rather than a hero image: five stills from one continuous move
                say "this is a shot" in a way one still cannot, and they stay
                small enough not to outrank the writing beside them.
              */}
              {p.frames && (
                <div className="mt-8">
                  {/*
                    Five across fits a desktop column but renders 50px wide on
                    a phone, which is too small to read as anything. Below sm
                    it scrolls instead, so each frame stays legible and the
                    sequence survives — the scroll lives on this container, not
                    the page.
                  */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {p.frames.map((f) => (
                      <div
                        key={f.src}
                        className="relative aspect-[4/3] min-w-[92px] flex-1 shrink-0 overflow-hidden rounded-[3px] border border-border-soft bg-surface-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.src}
                          alt={f.alt}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  {p.framesNote && <p className="label-sm mt-2.5">{p.framesNote}</p>}
                </div>
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
              {p.features && (
                <dl className="mt-7 grid gap-4 border-t border-border-soft pt-5 sm:grid-cols-2">
                  {p.features.map((f) => (
                    <div key={f.name}>
                      <dt className="text-sm font-semibold text-accent">{f.name}</dt>
                      <dd className="mt-1 ml-0 text-[13px] leading-[1.6] text-muted">
                        {f.what}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

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
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:mt-11 lg:grid-cols-4 lg:gap-10">
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

      {/* ---------------- Judgment ---------------- */}
      <section className="mx-auto max-w-[1440px] border-t border-border-soft px-6 py-14 sm:px-12 lg:px-24 lg:pb-24 lg:pt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <span className="label !tracking-[0.16em]">What shipping taught me</span>
          <Link
            href="/ai-studio/models"
            className="text-sm font-semibold text-accent hover:underline"
          >
            The full model landscape →
          </Link>
        </div>
        <p className="mt-6 max-w-[62ch] text-[15px] leading-[1.7] text-muted sm:text-[17px]">
          This field turns over every quarter, so the useful thing is not a
          list of tools — it is knowing what is ready, what is emerging and
          what is not viable yet. I know where those lines sit because I hit
          them myself, on work that had to ship.
        </p>
        <div className="mt-9 grid gap-8 sm:grid-cols-2 lg:gap-x-14 lg:gap-y-10">
          {LEARNED.map((l) => (
            <div key={l.h} className="border-t border-border-soft pt-5">
              <h3 className="text-lg leading-[1.25] tracking-[-0.02em] sm:text-xl">
                {l.h}
              </h3>
              <p className="mt-2.5 text-sm leading-[1.7] text-muted">{l.p}</p>
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
                href="mailto:hello@ajwadrauf.com"
                className="border-b border-accent/40 pb-1 transition hover:border-accent"
              >
                hello@ajwadrauf.com
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
