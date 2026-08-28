import type { Metadata } from "next";
import Link from "next/link";
import { MODELS } from "@/lib/models";

export const metadata: Metadata = {
  title: "AI Content Studio — Ajwad Rauf",
  description:
    "A working AI content studio, not a case study: upload a product photo and it produces finished stills, GS1 packshots and scored video ads live in the browser, with the model routing, quality gates and guardrails written down.",
};

/** The role's four mandates, and what in this portfolio answers each. */
const MANDATES = [
  {
    n: "01",
    mandate: "Produce the work yourself",
    jd: "“Ability to produce finished creative content independently across stills, motion, video — not just direct others to do so.”",
    answer:
      "Everything here is a working tool, not a case-study screenshot. Upload a product photo and it produces finished stills, bilingual promo tiles, GS1 packshots and scored video ads — live, in the browser, in minutes.",
    proof: [{ label: "Open the Studio", href: "/ai-studio/studio" }],
  },
  {
    n: "02",
    mandate: "Stand up the studio's workflows and standards",
    jd: "“Stand up the AI Content Studio's tools, workflows, standards, intake processes, and quality gates.”",
    answer:
      "The pipeline is the point: self-filling intake, one brief driving every deliverable, model routing by job and price, and named quality gates. The playbook documents all of it so it scales past one person.",
    proof: [{ label: "Read the playbook", href: "/ai-studio/playbook" }],
  },
  {
    n: "03",
    mandate: "Evaluate tools and build-vs-buy",
    jd: "“Evaluate AI tools, platforms, vendor relationships, and build-vs-buy decisions as the production model evolves.”",
    answer:
      "Thirteen models from six labs are wired in behind two APIs, swappable from one config file, with a written point of view on what's ready, what's emerging and what isn't viable — plus a one-pager on suites vs. aggregators vs. direct APIs.",
    proof: [
      { label: "Model landscape", href: "/ai-studio/models" },
      { label: "Build vs. buy", href: "/ai-studio/build-vs-buy" },
    ],
  },
  {
    n: "04",
    mandate: "Teach it, and govern it",
    jd: "“Build reusable playbooks, prompt approaches… support responsible AI use, including rights/IP, brand safety, disclosure and approval.”",
    answer:
      "The generative-AI guidelines this work is held to are written up as decisions rather than clauses, with a pre-flight checklist you tick against an actual asset. Then they are enforced rather than promised: every asset exposes the prompt that made it, reconstructed packshot angles are flagged for label QA, prices are never invented, and the demo states its own limits — because knowing what AI can't do yet is the job.",
    proof: [{ label: "See the packshot QA flags", href: "/ai-studio/packshots" }],
  },
];

const TOOLS = [
  {
    href: "/ai-studio/studio",
    name: "Campaign Studio",
    line: "One photo → a full multi-format pack",
    body: "Vision analysis, an AI-written editable brief, then six stills and two videos across formats, languages and seasons — each routed to the right model at the right price.",
    tags: ["Stills", "Motion", "EN/FR versioning"],
  },
  {
    href: "/ai-studio/packshots",
    name: "Packshot Studio",
    line: "GS1 planogram angles without the reshoot",
    body: "Upload the reference angles a SKU already has, generate the missing product-on-white views with GS1 filenames — grounded angles marked, reconstructed ones flagged for label QA.",
    tags: ["Product on white", "A/B bake-offs", "Governance"],
  },
  {
    href: "/ai-studio/ads",
    name: "Ad Lab",
    line: "Preset ad recipes any SKU can run through",
    body: "Deconstructed concepts — aesthetics, beat-by-beat action, overlay spec, sound design — every part of it editable, with the product swapped in from a photo and held still by reference-to-video. Sound is built in layers: effects from the model, spot effects generated one at a time, music scored separately.",
    tags: ["Short-form video", "Prompt systems", "Sound design"],
  },
  {
    href: "/ai-studio/prompts",
    name: "Prompt Builder",
    line: "The anatomy of a reference prompt, as a form",
    body: "Register, subject, what each reference is FOR, then a timeline that makes you spend the seconds on purpose. Every part says what goes wrong without it, and it catches the mistakes that fail silently — a beat sheet that overruns the render, a reference bound by filename instead of token.",
    tags: ["Teaching", "Prompt structure", "Timing"],
  },
];

const KNOWLEDGE = [
  {
    h: "Video models don't compose music",
    p: "They render SFX, ambience and dialogue convincingly, then approximate music. So the Ad Lab splits the layers: the video model does sound design, a music model scores, and the mix stays a finishing step in the edit.",
  },
  {
    h: "Text-in-image is a routing decision",
    p: "Most image models still mangle type. That single constraint is why bilingual promo tiles route to the pro tier while format adaptations run four times cheaper on flash.",
  },
  {
    h: "AI can't know what it never saw",
    p: "A generated packshot of a panel no camera captured is a plausible reconstruction, not a record. It gets labelled that way, every time, because a wrong ingredient list is a recall, not a retouch.",
  },
  {
    h: "The leaderboard flips quarterly",
    p: "Sora 2's API sunset stranded pipelines built on it. Model IDs and prices live in one config file with env overrides, so switching a vendor is an edit — not a rebuild.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* ---------- Hero ---------- */}
      <section className="py-20 sm:py-28">
        <p className="chip mb-6">
          Portfolio · Director, AI Content Studio — Loblaw Agency
        </p>
        <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          The role asks for someone who still
          <br />
          makes the work.
          <span className="block text-accent">So this portfolio is the work.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Not a gallery of outputs — a functioning AI content studio in
          miniature. Production tools you can run right now, built on thirteen
          models from six labs, with the routing, cost governance and quality
          gates that make AI production survivable at retail volume.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/ai-studio/studio" className="btn-primary">
            Run the pipeline →
          </Link>
          <Link href="/ai-studio/playbook" className="btn-secondary">
            Read the playbook
          </Link>
        </div>
      </section>

      {/* ---------- Mandate mapping ---------- */}
      <section className="border-t border-border-soft py-16">
        <div className="max-w-3xl">
          <p className="label !text-accent">
            What the role asks for
          </p>
          <h2 className="mt-2 text-[clamp(1.6rem,3vw,2rem)] tracking-[-0.03em]">
            Four mandates, four answers
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            The posting is unusually specific about wanting a hands-on
            producer, not an oversight-only leader. Each mandate below is
            answered by something in this portfolio you can open and use.
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {MANDATES.map((m) => (
            <article key={m.n} className="grid gap-5 md:grid-cols-[1fr_1.35fr] md:gap-10">
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-bold text-accent/30">{m.n}</span>
                  <h3 className="text-xl leading-snug tracking-tight">
                    {m.mandate}
                  </h3>
                </div>
                <blockquote className="mt-3 border-l-2 border-border-soft pl-4 text-sm italic leading-relaxed text-muted">
                  {m.jd}
                </blockquote>
              </div>
              <div>
                <p className="leading-relaxed text-muted">{m.answer}</p>
                <div className="mt-3 flex flex-wrap gap-4">
                  {m.proof.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      className="text-sm font-semibold text-accent hover:underline"
                    >
                      {p.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- The tools ---------- */}
      <section className="border-t border-border-soft py-16">
        <div className="max-w-3xl">
          <p className="label !text-accent">
            The tools
          </p>
          <h2 className="mt-2 text-[clamp(1.6rem,3vw,2rem)] tracking-[-0.03em]">
            Four surfaces, one production system
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            Each covers a different slice of what a retail agency actually
            ships — and they share the same intake, routing, cost and
            governance layer.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="card group flex flex-col p-6 transition hover:border-accent"
            >
              <h3 className="text-lg tracking-[-0.02em]">{t.name}</h3>
              <p className="mt-1 text-sm font-medium text-accent">{t.line}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{t.body}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.tags.map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>
              <span className="mt-4 text-sm font-semibold text-accent">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Why it matters (retail context) ---------- */}
      <section className="border-t border-border-soft py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="label !text-accent">
              The problem this is built for
            </p>
            <h2 className="mt-2 text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
              Retail content is a versioning business
            </h2>
          </div>
          <div className="space-y-4 leading-relaxed text-muted">
            <p>
              A single campaign multiplies across formats, placements, seasons,
              store banners and — in Canada — two official languages. One idea
              becomes forty assets before it reaches a shopper. Traditional
              production can make the one beautifully; it cannot make the forty
              at that cadence.
            </p>
            <p>
              That&apos;s the gap AI closes, and it changes where craft lives. An
              adaptation that took a studio day becomes a routed call costing
              cents, so judgment moves upstream — into the brief, the prompt
              system and the quality gate. The skill isn&apos;t operating the
              tools. It&apos;s deciding what good is, and building a system that
              produces it repeatedly.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Knowledge / POV ---------- */}
      <section className="border-t border-border-soft py-16">
        <div className="max-w-3xl">
          <p className="label !text-accent">
            What working with these tools actually teaches you
          </p>
          <h2 className="mt-2 text-[clamp(1.6rem,3vw,2rem)] tracking-[-0.03em]">
            Four things you only learn by shipping
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            The role asks for an internal authority on what&apos;s ready, what&apos;s
            emerging and what isn&apos;t viable. That judgment comes from hitting
            the limits, not reading about them.
          </p>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-[6px] border border-border-soft bg-border-soft sm:grid-cols-2">
          {KNOWLEDGE.map((k) => (
            <div key={k.h} className="bg-surface p-6">
              <h3 className="font-semibold leading-snug">{k.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{k.p}</p>
            </div>
          ))}
        </div>
        <Link
          href="/ai-studio/models"
          className="mt-6 inline-block text-sm font-semibold text-accent hover:underline"
        >
          The full ready / emerging / not-viable read →
        </Link>
      </section>

      {/* ---------- Stack ---------- */}
      <section className="border-t border-border-soft py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label !text-accent">
              Under the hood
            </p>
            <h2 className="mt-2 text-[clamp(1.6rem,3vw,2rem)] tracking-[-0.03em]">
              Thirteen models, one routing table
            </h2>
          </div>
          <Link href="/ai-studio/models" className="text-sm font-semibold text-accent hover:underline">
            Full landscape →
          </Link>
        </div>
        <div className="mt-8 overflow-x-auto rounded-[6px] border border-border-soft">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <tbody>
              {Object.values(MODELS).map((m) => (
                <tr key={m.id} className="border-b border-border-soft/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{m.label}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {m.unit === "image"
                      ? `$${m.unitCost}/image`
                      : `$${m.unitCost}/second`}
                  </td>
                  <td className="px-4 py-3 text-muted">{m.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted/70">
          Every ID and price sits in one config file with environment
          overrides — swapping a model is an edit, not a rebuild.
        </p>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="border-t border-border-soft py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          It runs right now, for free
        </h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
          Demo mode exercises the entire pipeline with zero API spend. Add
          keys and it goes fully live — with a cost estimate and confirmation
          before a single credit is used.
        </p>
        <Link href="/ai-studio/studio" className="btn-primary mt-8">
          Run the pipeline →
        </Link>
      </section>
    </div>
  );
}
