import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Project Forge — Case study · Ajwad Rauf",
  description:
    "An internal production platform for an enterprise retail CRM email program: a badge brief in, a reviewed, deployment-ready email asset out.",
};

const META = [
  { k: "Role", v: "Design & build — solo" },
  { k: "Timeline", v: "2025–2026" },
  { k: "Client", v: "Loblaw Companies — internal" },
  { k: "Type", v: "Internal web app, in production" },
  { k: "Access", v: "No public URL — internal tool" },
];

const TAGS = ["Internal tooling", "Workflow automation", "Next.js + Firebase"];

const FACTS = [
  { k: "Discipline", v: "Product design + full-stack build" },
  { k: "Users", v: "Marketers, producers, approvers" },
  { k: "Access tiers", v: "Admin · Agency · Marketer" },
  { k: "Languages", v: "Bilingual EN / FR" },
];

const PHASES = [
  {
    label: "Phase 1 — Intake",
    nodes: [
      { n: "01", t: "Brief", d: "Request captured with campaign, dates and targeting." },
      { n: "02", t: "Badge Build", d: "Creative and links assembled against the brief." },
    ],
  },
  {
    label: "Phase 2 — Production & release",
    nodes: [
      { n: "03", t: "Review", d: "Agency review with structured feedback." },
      { n: "04", t: "QA", d: "Copy, links and compliance checks." },
      { n: "05", t: "Approval", d: "Sign-off gated by role." },
      { n: "06", t: "Deploy", d: "Released to the email production pipeline." },
    ],
  },
];

/** `strong` marks the phrase the row turns on, rendered at full contrast. */
const CAPABILITIES: { term: string; desc: string; strong: string }[] = [
  {
    term: "Enterprise SSO",
    desc: "Single sign-on through {s} (OIDC), with three role tiers governing what each user can see and do.",
    strong: "Microsoft Entra ID",
  },
  {
    term: "Two-phase intake",
    desc: "A {s} split so a request can be logged early and completed later, without losing the thread.",
    strong: "Brief → Badge Build",
  },
  {
    term: "Bilingual by default",
    desc: "Every badge carries paired {s} fields, kept together through review and deployment.",
    strong: "EN / FR",
  },
  {
    term: "AI copy checks",
    desc: "Subject-line validation and spell-check via {s} (Genkit), run before anything is sent.",
    strong: "Gemini 2.5 Flash",
  },
  {
    term: "Auto-generated briefs",
    desc: "Structured {s} produced from the record, so the paperwork writes itself.",
    strong: "PDF briefs",
  },
  {
    term: "UTM link builder",
    desc: "Consistent, validated tracking links generated in place rather than hand-assembled.",
    strong: "",
  },
  {
    term: "Transactional email",
    desc: "Stage-by-stage notifications (brief, review, QA, approval, follow-up) so hand-offs never sit silent.",
    strong: "",
  },
  {
    term: "Scheduled automation",
    desc: "Cron jobs send a {s} plus link-plan and UTM reminders and rejection follow-ups — and skip weekends.",
    strong: "daily digest",
  },
];

const STACK = [
  { name: "Next.js App Router", role: "framework" },
  { name: "TypeScript", role: "" },
  { name: "Firebase App Hosting", role: "Cloud Run" },
  { name: "Firestore", role: "data" },
  { name: "Firebase Storage", role: "assets" },
  { name: "Microsoft Entra ID", role: "SSO" },
  { name: "Genkit + Gemini 2.5 Flash", role: "AI" },
  { name: "Transactional email", role: "SendGrid" },
  { name: "Scheduled jobs", role: "cron" },
];

const HIGHLIGHTS = [
  {
    h: "Role-based access, enforced twice",
    p: "Server-side route gating plus client route guards, backed by least-privilege database and storage rules. Access is decided by role, and the admin-only tooling stays admin-only.",
  },
  {
    h: "An AI gate before send",
    p: "Subject lines and copy pass an AI validation step before a badge can move forward, catching typos and weak lines while they are still cheap to fix.",
  },
  {
    h: "Notifications as a system, not an afterthought",
    p: "Each stage transition fires its own templated email, and scheduled jobs chase the work that would otherwise stall — reminders, digests and follow-ups on a weekday cadence.",
  },
  {
    h: "One record, many outputs",
    p: "A single badge record generates its brief PDF, its tracking links and its bilingual fields, so the same source of truth drives every downstream artifact.",
  },
];

const OUTCOMES = [
  "Replaced an ad-hoc, multi-tool request process with one auditable pipeline and a clear status for every badge.",
  "Standardized bilingual output and the compliance and QA pass, so quality no longer depends on who picked up the request.",
  "Automated the reminders, digests and follow-ups that used to be chased by hand.",
];

const SHELL = "mx-auto max-w-[1440px] px-6 sm:px-12 lg:px-24";

function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="label !text-accent">{n}</span>
      <h2 className="text-[clamp(1.55rem,3.4vw,2.15rem)] leading-[1.1]">{title}</h2>
    </div>
  );
}

/** Splits a `{s}` placeholder so the key phrase renders at full contrast. */
function Emphasised({ text, strong }: { text: string; strong: string }) {
  if (!strong || !text.includes("{s}")) return <>{text}</>;
  const [before, after] = text.split("{s}");
  return (
    <>
      {before}
      <span className="font-semibold text-foreground">{strong}</span>
      {after}
    </>
  );
}

export default function ProjectForgePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="brand-strip" />

      <header
        className={`${SHELL} flex items-center justify-between gap-6 border-b border-border-soft py-6`}
      >
        <Link href="/" className="label !text-foreground">
          Ajwad Rauf
        </Link>
        <Link href="/#work" className="label transition hover:text-foreground">
          ← All work
        </Link>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className={`${SHELL} pb-14 pt-16 lg:pb-20 lg:pt-24`}>
        <span className="label !text-accent">Case study</span>
        <h1 className="mt-6 text-[clamp(3rem,8vw,5.5rem)] leading-[0.98] tracking-[-0.03em]">
          Project Forge
        </h1>
        <p className="mt-5 max-w-[24ch] text-[clamp(1.3rem,3.2vw,1.9rem)] leading-[1.28] tracking-[-0.01em]">
          A badge brief in, a reviewed, deployment-ready email asset out.
        </p>
        <div className="brand-strip mt-8 max-w-[340px] rounded-full" />
        <p className="mt-8 max-w-[58ch] text-[15px] leading-[1.7] text-muted sm:text-[17px]">
          An internal production platform for an enterprise retail CRM email
          program. It moves every promotional badge from first request to final
          deployment through one auditable workflow, with the reviews, bilingual
          copy and compliance checks built in. I designed and built it end to
          end.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
          {META.map((m) => (
            <div key={m.k}>
              <div className="label-sm">{m.k}</div>
              <div className="mt-1.5 text-[15px] font-medium">{m.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-wrap gap-2.5">
          {TAGS.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>

        <p className="mt-8 inline-flex items-start gap-2.5 rounded-[6px] border border-warning/25 bg-warning/[0.06] px-4 py-3 text-sm leading-[1.6] text-warning">
          <span
            aria-hidden
            className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-warning"
          />
          <span>
            <span className="font-semibold">
              No public URL — this is an internal Loblaw tool.
            </span>{" "}
            &ldquo;Project Forge&rdquo; is a stand-in name, and the product
            name, interface screenshots, campaign data and internal metrics are
            purposely omitted under NDA. What is here is the architecture and
            the reasoning behind it, which is the part that is mine to show. A
            walkthrough can be arranged through the appropriate channel.
          </span>
        </p>
      </section>

      {/* ---------------- 01 What it is ---------------- */}
      <section className={`${SHELL} border-t border-border-soft py-14 lg:py-18`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
          <div>
            <SectionHead n="01" title="What it is" />
            <p className="mt-7 max-w-[64ch] text-[15px] leading-[1.75] sm:text-[17px]">
              Project Forge is the system a retail marketing team uses to brief,
              build, review and ship the promotional badges that run in their
              CRM emails — the offer tiles that carry a campaign&apos;s price
              points, dates and calls to action.
            </p>
            <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.75] text-muted sm:text-[17px]">
              Before a single system, that work lived across briefs, threads and
              spreadsheets. Badges stalled between hand-offs, versions drifted,
              and no one could see where a given badge was in the process.
              Project Forge makes it one place with one source of truth, from
              intake to release.
            </p>
          </div>
          <div className="card grid grid-cols-1 overflow-hidden sm:grid-cols-2">
            {FACTS.map((f, i) => (
              <div
                key={f.k}
                className={`p-6 ${i % 2 === 0 ? "sm:border-r" : ""} border-border-soft ${
                  i < FACTS.length - 1 ? "border-b" : ""
                } ${i === FACTS.length - 2 ? "sm:border-b-0" : ""}`}
              >
                <div className="label-sm">{f.k}</div>
                <div className="mt-1.5 text-[15px] font-medium leading-[1.5]">
                  {f.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 02 Workflow ---------------- */}
      <section className={`${SHELL} border-t border-border-soft py-14 lg:py-18`}>
        <SectionHead n="02" title="The workflow I designed" />
        <p className="mt-6 max-w-[64ch] text-[15px] leading-[1.75] text-muted sm:text-[17px]">
          Two phases, one thread. Every badge follows the same path, and each
          stage is tracked, notified and time-stamped.
        </p>

        <div className="mt-9 space-y-8">
          {PHASES.map((phase) => (
            <div key={phase.label}>
              <p className="label !text-accent">{phase.label}</p>
              <ol className="mt-4 flex flex-wrap items-stretch gap-3">
                {phase.nodes.map((node, i) => (
                  <li
                    key={node.n}
                    className="flex flex-1 basis-full items-stretch gap-3 sm:basis-[180px]"
                  >
                    {i > 0 && (
                      <span
                        aria-hidden
                        className="hidden items-center font-mono text-muted/50 sm:flex"
                      >
                        →
                      </span>
                    )}
                    <div className="card w-full p-5">
                      <div className="font-mono text-[11px] tracking-[0.1em] text-accent">
                        {node.n}
                      </div>
                      <div className="mt-1.5 font-semibold">{node.t}</div>
                      <p className="mt-1 text-sm leading-[1.55] text-muted">
                        {node.d}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 03 Capabilities ---------------- */}
      <section className={`${SHELL} border-t border-border-soft py-14 lg:py-18`}>
        <SectionHead n="03" title="What I built into it" />
        <dl className="mt-8 border-t border-border-soft">
          {CAPABILITIES.map((c) => (
            <div
              key={c.term}
              className="grid gap-2 border-b border-border-soft py-5 sm:grid-cols-[minmax(180px,260px)_1fr] sm:gap-7"
            >
              <dt className="font-semibold tracking-[-0.01em]">{c.term}</dt>
              <dd className="text-[15px] leading-[1.7] text-muted sm:text-base">
                <Emphasised text={c.desc} strong={c.strong} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------- 04 Under the hood ---------------- */}
      <section className={`${SHELL} border-t border-border-soft py-14 lg:py-18`}>
        <SectionHead n="04" title="Under the hood" />
        <p className="mt-6 max-w-[64ch] text-[15px] leading-[1.75] text-muted sm:text-[17px]">
          A single Next.js application, server-rendered on managed
          infrastructure, with the data, auth, storage and AI wired through one
          Google Cloud project.
        </p>

        <ul className="mt-7 flex flex-wrap gap-2.5">
          {STACK.map((s) => (
            <li
              key={s.name}
              className="rounded-[6px] border border-border-soft bg-surface px-3.5 py-2 text-sm"
            >
              {s.name}
              {s.role && <span className="text-muted"> · {s.role}</span>}
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <div key={h.h} className="card p-6 sm:p-7">
              <h3 className="text-[1.12rem] tracking-[-0.01em]">{h.h}</h3>
              <p className="mt-2.5 text-[15px] leading-[1.65] text-muted">
                {h.p}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 05 Outcome ---------------- */}
      <section className={`${SHELL} border-t border-border-soft py-14 lg:py-18`}>
        <SectionHead n="05" title="Outcome" />
        <ul className="mt-7 max-w-[64ch]">
          {OUTCOMES.map((o) => (
            <li
              key={o}
              className="relative border-b border-border-soft py-3.5 pl-7 text-[15px] leading-[1.7] sm:text-[17px]"
            >
              <span
                aria-hidden
                className="absolute left-0 top-[21px] h-[9px] w-[9px] rounded-full bg-success"
              />
              {o}
            </li>
          ))}
          <li className="relative border-b border-border-soft py-3.5 pl-7 text-[15px] italic leading-[1.7] text-muted sm:text-[17px]">
            <span
              aria-hidden
              className="absolute left-0 top-[21px] h-[9px] w-[9px] rounded-full border border-border-strong"
            />
            Quantified impact — turnaround time, volume, error rate — available
            on request rather than published.
          </li>
        </ul>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-border-soft bg-surface">
        <div
          className={`${SHELL} flex flex-col justify-between gap-8 py-12 lg:flex-row lg:items-end lg:pb-18 lg:pt-16`}
        >
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
            <p className="mt-5 max-w-[60ch] text-sm leading-[1.65] text-muted">
              This case study describes internal work delivered at Loblaw.
              Proprietary process detail and internal metrics are withheld; a
              deeper walkthrough is available on request.
            </p>
          </div>
          <Link
            href="/#work"
            className="label !tracking-[0.12em] text-accent transition hover:text-accent-soft lg:pb-2.5"
          >
            ← All work
          </Link>
        </div>
        <div className={`${SHELL} pb-8`}>
          <p className="label-sm !text-[10px] !tracking-[0.12em]">
            Ajwad Rauf · Toronto · 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
