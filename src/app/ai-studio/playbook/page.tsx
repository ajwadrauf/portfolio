import type { Metadata } from "next";
import Link from "next/link";
import { SectionNav, type NavSection } from "@/components/SectionNav";

export const metadata: Metadata = {
  title: "Production Playbook — AI Content Studio",
  description:
    "The reusable playbook behind the demo: workflow, prompt system, model routing, quality gates, cost governance, responsible AI and measurement.",
};

const SECTIONS: NavSection[] = [
  { id: "workflow", num: "01", label: "Workflow" },
  { id: "prompts", num: "02", label: "Prompt system" },
  { id: "routing", num: "03", label: "Model routing" },
  { id: "gates", num: "04", label: "Quality gates" },
  { id: "cost", num: "05", label: "Cost governance" },
  { id: "responsible", num: "06", label: "Responsible AI" },
  { id: "teaching", num: "07", label: "Teaching" },
  { id: "measure", num: "08", label: "Measurement" },
];

const PIPELINE = [
  { step: "Intake", detail: "One product photo + minimum context", human: false },
  { step: "Brief", detail: "One structured brief drives every deliverable", human: true },
  { step: "Route", detail: "Each asset to its cheapest sufficient model", human: false },
  { step: "Generate", detail: "Stills, adaptations, motion, audio", human: false },
  { step: "Gate", detail: "Fidelity · text · brand safety", human: true },
  { step: "Deliver", detail: "Named, versioned, ready to ship", human: false },
];

const ROUTING = [
  ["Format adaptations", "Flash-tier stills", "Hero already set the look"],
  ["Text-in-image tiles", "Pro-tier stills", "Only tier that renders type reliably"],
  ["Video drafts", "Veo Fast / Kling", "Iterate at a fraction of the cost"],
  ["Hero finish", "Veo Standard", "Only where the quality ceiling is the point"],
  ["Volume cutdowns", "Kling / Seedance", "5–7× cheaper, consistency holds"],
];

const GATES = [
  {
    n: "01",
    name: "Product fidelity",
    ask: "Is this the actual product — shape, colors, packaging — or a plausible look-alike?",
    how: "Grounding every generation on the real photo makes this passable. The gate makes it guaranteed.",
  },
  {
    n: "02",
    name: "Text integrity",
    ask: "Is every rendered word spelled and accented correctly, in both languages?",
    how: "French is reviewed by a French speaker, never assumed. Generated prices are checked against the source of truth.",
  },
  {
    n: "03",
    name: "Brand & claim safety",
    ask: "Any implied claims, accidental third-party marks, or missing mandated elements?",
    how: "Composition must leave room for price points and legal lines before it leaves the studio.",
  },
];

const RESPONSIBLE = [
  ["Rights & IP", "Generate only from owned product assets. Prefer providers with enterprise indemnity for production work. Keep the generation record — model, prompt, date — per delivered asset."],
  ["Disclosure", "Follow platform and regulatory AI-disclosure rules per channel. Default to disclosure where ambiguous."],
  ["People", "No photoreal likenesses of real people without a consent workflow. Person-generation settings locked at the API layer, not by convention."],
  ["Privacy", "Product photos only. No customer data ever enters a generation prompt."],
];

const METRICS = [
  ["Speed", "Brief-to-delivery time per pack", "Same-day for standard versioning"],
  ["Volume", "Assets delivered per week, and per dollar, by type", "Up and to the right, per dollar flat"],
  ["Quality", "First-pass approval rate through the gates", "Rising; rework rate falling"],
  ["Adoption", "Teams and brand partners actively using the studio", "Repeat intake, not one-off curiosity"],
  ["In-housing", "Share of work absorbed from external vendors", "Where quality and rights make sense"],
  ["Cost", "Cost per finished asset vs. traditional baseline", "Order-of-magnitude, not percentages"],
];

function SectionHead({ num, title, lede }: { num: string; title: string; lede: string }) {
  return (
    <header className="mb-6">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-bold text-accent/40">{num}</span>
        <h2 className="text-[1.75rem] tracking-[-0.03em]">{title}</h2>
      </div>
      <p className="mt-2 pl-9 text-base leading-relaxed text-muted">{lede}</p>
    </header>
  );
}

export default function PlaybookPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      {/* ---------- Header ---------- */}
      <header className="max-w-3xl">
        <p className="chip mb-4">Playbook · How the studio scales beyond one person</p>
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.04em]">
          The production playbook
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          A studio isn&apos;t a person who&apos;s good with tools — it&apos;s a documented
          system anyone trained can run. This is the playbook the{" "}
          <Link href="/ai-studio/studio" className="font-medium text-accent hover:underline">
            demo pipeline
          </Link>{" "}
          implements, written to be handed over.
        </p>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[200px_1fr]">
        {/* ---------- Sticky nav ---------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <SectionNav sections={SECTIONS} />
          </div>
        </aside>

        {/* ---------- Body ---------- */}
        <div className="min-w-0 space-y-16">
          {/* 01 Workflow */}
          <section id="workflow" className="scroll-mt-28">
            <SectionHead
              num="01"
              title="Workflow"
              lede="Every job enters through the same door and leaves through the same gate."
            />

            {/* Pipeline diagram */}
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PIPELINE.map((p, i) => (
                <li
                  key={p.step}
                  className={`relative rounded-[6px] border bg-surface p-4 ${
                    p.human ? "border-accent/50" : "border-border-soft"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-semibold">{p.step}</span>
                    {p.human && (
                      <span className="ml-auto rounded-full bg-accent/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                        Human
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-snug text-muted">{p.detail}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted/70">
              Two human checkpoints, deliberately placed: at the brief (before
              any spend) and at the gate (before delivery). Everything between
              is automated.
            </p>

            <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
              <p>
                Intake takes one grounding asset — the product photo — plus the
                minimum viable context. The vision model extracts everything it
                can see and interviews only for what it can&apos;t. An intake form
                that fills itself is the difference between a pipeline teams
                adopt and one they route around.
              </p>
              <p>
                One structured brief then drives every deliverable. That&apos;s
                deliberate: consistency across a pack comes from shared upstream
                context, not from post-hoc correction.
              </p>
            </div>
          </section>

          {/* 02 Prompts */}
          <section id="prompts" className="scroll-mt-28">
            <SectionHead
              num="02"
              title="Prompt system"
              lede="Prompts are templates, not incantations. Nothing depends on a hero prompt someone keeps in their head."
            />
            <div className="overflow-x-auto rounded-[6px] border border-border-soft bg-surface-2 p-5">
              <pre className="font-mono text-xs leading-relaxed text-muted">
{`BRIEF          mood · setting · palette · headline EN/FR
     +
FORMAT BLOCK   "Square 1:1 promo tile. Render "{headlineFR}"
                in clean bold type, high contrast…"
     +
STYLE SUFFIX   "commercial retail quality, sharp focus"
     =
  PROMPT  ────────────────▶  nano-banana-pro`}
              </pre>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Each deliverable has a prompt <em>builder</em>, not a prompt.
              Change one field in the brief and eight prompts update. That is
              what makes versioning — EN/FR, seasonal, per-format — a parameter
              instead of a project.
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
              {[
                "Subject and action first; camera, light and setting second; style descriptor last.",
                "Real product attributes injected from vision analysis — never invented.",
                "Video prompts carry an explicit Audio: cue; native-audio models reward sound design written into the prompt.",
                "Negative prompts are maintained per style, with artifact patterns added as QA finds them.",
                "No brand names or logos in generation prompts — lockups composite in post, where they're controlled.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </section>

          {/* 03 Routing */}
          <section id="routing" className="scroll-mt-28">
            <SectionHead
              num="03"
              title="Model routing"
              lede="Draft cheap, finish premium. Routing — not negotiation — is where an AI studio finds most of its cost efficiency."
            />
            <div className="overflow-x-auto rounded-[6px] border border-border-soft">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left text-muted">
                    <th className="px-4 py-3 font-semibold">Job</th>
                    <th className="px-4 py-3 font-semibold">Tier</th>
                    <th className="px-4 py-3 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTING.map(([job, tier, why]) => (
                    <tr key={job} className="border-t border-border-soft">
                      <td className="px-4 py-3 font-medium">{job}</td>
                      <td className="px-4 py-3 text-accent">{tier}</td>
                      <td className="px-4 py-3 text-muted">{why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">
              The live table lives on the{" "}
              <Link href="/ai-studio/models" className="font-medium text-accent hover:underline">
                model landscape
              </Link>{" "}
              page and is re-evaluated monthly.
            </p>
          </section>

          {/* 04 Gates */}
          <section id="gates" className="scroll-mt-28">
            <SectionHead
              num="04"
              title="Quality gates"
              lede="Every asset clears three checks before it leaves the studio."
            />
            <div className="space-y-3">
              {GATES.map((g) => (
                <div
                  key={g.n}
                  className="grid gap-3 rounded-[6px] border border-border-soft bg-surface p-5 md:grid-cols-[auto_1fr]"
                >
                  <span className="font-mono text-2xl font-bold text-accent/25">{g.n}</span>
                  <div>
                    <h3 className="font-semibold">{g.name}</h3>
                    <p className="mt-1 text-sm font-medium leading-snug">{g.ask}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{g.how}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 05 Cost */}
          <section id="cost" className="scroll-mt-28">
            <SectionHead
              num="05"
              title="Cost governance"
              lede="Nobody spends a credit blind."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Pre-flight estimate", "Shown and confirmed before any live generation."],
                ["One price config", "List prices live in one file; the estimator reads from it."],
                ["Visible spend", "Session spend tracked and always on screen."],
                ["Free demo mode", "The full pipeline mocks itself — UX work and training never burn credits."],
                ["Cheap defaults", "Cost-efficient tiers are default; premium is an explicit choice."],
                ["Handles, not reruns", "Assets generated with trim room so a near-miss is an edit, not a regeneration."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-[6px] border border-border-soft bg-surface p-4">
                  <p className="text-sm font-semibold">{t}</p>
                  <p className="mt-1 text-sm leading-snug text-muted">{d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 06 Responsible AI */}
          <section id="responsible" className="scroll-mt-28">
            <SectionHead
              num="06"
              title="Responsible AI"
              lede="Guardrails that let the studio move fast, because the risky questions are already answered."
            />
            <dl className="divide-y divide-border-soft border-y border-border-soft">
              {RESPONSIBLE.map(([term, def]) => (
                <div key={term} className="grid gap-2 py-4 md:grid-cols-[160px_1fr] md:gap-6">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-sm leading-relaxed text-muted">{def}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 07 Teaching */}
          <section id="teaching" className="scroll-mt-28">
            <SectionHead
              num="07"
              title="Teaching"
              lede="Built to be handed over, not held onto."
            />
            <p className="text-sm leading-relaxed text-muted">
              Every generated asset in the demo exposes its prompt — the
              pipeline shows its work. That&apos;s the teaching model: every
              workflow visible, every decision documented, every playbook
              written so the second person, and the tenth, can run it.
            </p>
            <blockquote className="mt-5 border-l-2 border-accent pl-5">
              <p className="text-lg font-semibold leading-snug">
                Capability that lives in one person&apos;s head isn&apos;t a studio.
                It&apos;s a bottleneck with a title.
              </p>
            </blockquote>
          </section>

          {/* 08 Measurement */}
          <section id="measure" className="scroll-mt-28">
            <SectionHead
              num="08"
              title="Measurement"
              lede="What the studio is accountable for, and what good looks like."
            />
            <div className="overflow-x-auto rounded-[6px] border border-border-soft">
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left text-muted">
                    <th className="px-4 py-3 font-semibold">Measure</th>
                    <th className="px-4 py-3 font-semibold">Tracked as</th>
                    <th className="px-4 py-3 font-semibold">Good looks like</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map(([m, t, g]) => (
                    <tr key={m} className="border-t border-border-soft">
                      <td className="px-4 py-3 font-semibold">{m}</td>
                      <td className="px-4 py-3 text-muted">{t}</td>
                      <td className="px-4 py-3 text-muted">{g}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
