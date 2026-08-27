import type { Metadata } from "next";
import Link from "next/link";
import { SectionNav, type NavSection } from "@/components/SectionNav";
import { PreflightChecklist } from "./PreflightChecklist";

export const metadata: Metadata = {
  title: "Production Playbook — AI Content Studio",
  description:
    "The reusable playbook behind the demo: workflow, prompt system, model routing, quality gates, cost governance, the generative-AI guardrails this work is held to, a pre-flight checklist, and measurement.",
};

const SECTIONS: NavSection[] = [
  { id: "workflow", num: "01", label: "Workflow" },
  { id: "prompts", num: "02", label: "Prompt system" },
  { id: "routing", num: "03", label: "Model routing" },
  { id: "gates", num: "04", label: "Quality gates" },
  { id: "cost", num: "05", label: "Cost governance" },
  { id: "guardrails", num: "06", label: "Guardrails" },
  { id: "preflight", num: "07", label: "Pre-flight" },
  { id: "teaching", num: "08", label: "Teaching" },
  { id: "measure", num: "09", label: "Measurement" },
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

/**
 * The governance layer.
 *
 * This is not aspiration — it is the set of guidelines this work is actually
 * held to, restated as decisions rather than as clauses. The ordering is
 * deliberate: the principle that grants permission, then the three lines that
 * cannot move, then the one subject where the rules are most specific
 * (product truth), then people, then the paperwork, then the two questions
 * that settle everything not covered.
 */
const STANDING_PERMISSION =
  "AI may be used as a creative and production tool wherever the result is original, properly authorised, non-impersonative, accurate, and not misleading to a consumer. Everything already required — Legal, Regulatory, Privacy, Procurement, InfoSec, Brand, advertising approval — still applies. AI is a new way to make the asset, not a new route around the approvals.";

const HARD_STOPS = [
  {
    h: "Nobody real, unless they said yes",
    p: "No cloning, imitating or deliberately evoking the voice, likeness or recognisable characteristics of an actual person without documented rights. Celebrities, influencers, performers, customers, employees, executives — the same line for all of them, and for third-party characters and branded voices. Original synthetic creation is the preferred route; replication is not a shortcut, it is the thing being prohibited.",
  },
  {
    h: "The overall impression is the test",
    p: "Nothing may materially misrepresent the product, its appearance, quantity, function or performance; a person's identity or relationship to the brand; a customer experience, testimonial or endorsement; or a relationship with another company. Judged the way a reasonable consumer would take the finished ad as a whole — not by whether each component survives inspection on its own. An ad can be assembled entirely from true parts and still fail this.",
  },
  {
    h: "The product is not the part you may invent",
    p: "Where an ad shows a specific item that is for sale, that item must originate from authentic capture of the real thing. AI may work on everything around it. It may not quietly become the thing itself.",
  },
];

/** The clearest rule in the set, so it earns the most explicit treatment. */
const PRODUCT_TRUTH = {
  may: [
    "Cleanup and retouching",
    "Background replacement or extension",
    "Removing production artefacts",
    "Reframing and outpainting",
    "Lighting and colour correction that stays faithful",
    "Environment and set dressing",
  ],
  mustNot: [
    "Replacing the captured product with a synthetic one",
    "Adding toppings, fillings or inclusions that were not there",
    "Materially increasing apparent quantity or portion",
    "Improving texture, colour, doneness or quality",
    "Fabricating preparation results or functionality",
    "Materially altering packaging or product attributes",
  ],
};

const PEOPLE = [
  {
    h: "Synthetic people, by surface",
    p: "Fully synthetic talent is available for stills — lifestyle, social, digital, print, display — provided it is an original creation and not a copy of an identifiable person. For OLV, television and broadcast, the conservative default holds: not without specific review and approval. That is a position about consumer acceptance and talent agreements rather than about capability, and it is expected to move.",
  },
  {
    h: "Hands are not talent",
    p: "An AI-generated hand entering frame to press a button is an incidental element, not a performer. It stays incidental while nobody is identifiable, it is not built from a real person's likeness, it is not acting as a spokesperson, and the action it performs is an honest representation of using the product.",
  },
  {
    h: "Voices",
    p: "Original synthetic voice is fine for radio and digital audio. It must not clone a real individual, imitate an identifiable person, impersonate a recognisable character or protected brand voice, or leave a listener wrong about who is speaking — and the commercial-use rights have to be real.",
  },
  {
    h: "Manufactured authority",
    p: "No synthesised customer reviews, celebrity endorsements, employee statements, expert opinions, regulated-professional recommendations or before-and-after stories. The failure here is not the pixels; it is inventing a person whose credibility is doing the selling. Openly fictional scenarios are a normal Legal question, not this one.",
  },
];

const PAPER_TRAIL = [
  ["Approved tools only", "Platforms cleared under the applicable technology, security, procurement and privacy requirements. That is a list someone maintains, not a judgement call at 6pm."],
  ["What never gets uploaded", "Confidential information, personal information, biometric source material, talent recordings, licensed content, or third-party assets whose AI-processing rights have not been confirmed — unless that specific system is authorised for it."],
  ["Retain the real source", "Where AI materially assists final product imagery, the authentic source frame stays in the asset-management system and stays traceable to the delivered creative. If you cannot produce the original, you cannot defend the final."],
  ["The record", "Platform or vendor, what the AI component actually was, the approved source asset, confirmation of commercial-use rights, talent consent where relevant, and any specific exception granted. Meaningful provenance — not a log of every routine retouch."],
  ["Accountability does not transfer", "Marketing, agency and production partners own the finished asset whether or not AI touched it. There is no version of this where the model is responsible."],
];

const TESTS = [
  {
    label: "Product fidelity",
    q: "If someone bought this because of this ad, would what arrives reasonably match what they were shown?",
    then: "Uncertain is a no. Escalate to Legal or Regulatory.",
  },
  {
    label: "The catch-all",
    q: "Could a reasonable consumer be materially misled about who or what they are seeing or hearing, what they are buying, what it does, or whether a real person took part or endorsed it?",
    then: "Yes or unsure — stop and escalate before publication.",
  },
];

/** Policy is only real where a mechanism enforces it. */
const ENFORCED_HERE = [
  ["Prices are never invented", "Vision autofill returns an empty field rather than a guess when no price is legible on the pack, and the UI flags it as needing a human. A wrong price is a compliance failure, not a typo."],
  ["Reconstructed angles are labelled", "Packshot views the model extrapolated rather than grounded in a supplied reference are marked for label QA, so nobody mistakes a plausible back-of-pack for a photographed one."],
  ["The prompt ships with the asset", "Every generated output exposes the prompt that made it, which is the provenance record the guidelines ask for, produced as a by-product rather than as homework."],
  ["Product identity is pinned, not hoped for", "Reference-to-video binds the pack to a supplied still and instructs against drift, because a product that morphs mid-shot fails the fidelity test even when nobody intended it to."],
  ["The demo states its own limits", "Where the pipeline cannot guarantee something — music that is not frame-synced, a take that needs an alignment pass — it says so in the interface rather than in a footnote."],
];

const CHECKLIST: { group: string; items: string[] }[] = [
  {
    group: "Before you generate",
    items: [
      "The platform is on the approved list for this kind of work",
      "Nothing confidential, personal, biometric or third-party-licensed is going into the prompt or the references",
      "Source assets are ours, or the rights to process them are confirmed in writing",
      "If a real person appears, consent and usage rights exist and are documented",
    ],
  },
  {
    group: "If a real product is shown",
    items: [
      "The product in frame originates from authentic capture of the actual item",
      "AI work is confined to the surroundings — no synthetic substitution of the product",
      "Nothing has been added, enlarged, improved or made more appetising than the real thing",
      "The authentic source file is filed and traceable to this final asset",
    ],
  },
  {
    group: "If a person appears",
    items: [
      "Synthetic talent is original and not a recognisable individual",
      "Not presented as a customer, employee, expert or regulated professional unless true and documented",
      "No manufactured testimonial, endorsement or before-and-after",
      "Broadcast or OLV on-camera synthetic talent has specific approval",
      "Any voice is original synthetic, non-impersonative, and rights-cleared",
    ],
  },
  {
    group: "Before it ships",
    items: [
      "Both tests answered — fidelity, and the catch-all",
      "Child-directed and food-advertising requirements checked, unchanged by AI being involved",
      "Material AI use is disclosed internally in the approval workflow",
      "External disclosure decided against channel, platform and regulatory requirements",
      "The provenance record is complete: platform, component, source, rights, consent, exceptions",
      "A named human has approved it",
    ],
  },
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
                "For product motion, references beat a first frame: reference-to-video models hold identity across the take, addressed positionally as [Image1], [Video1] with a stated job each.",
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

          {/* 06 Guardrails */}
          <section id="guardrails" className="scroll-mt-28">
            <SectionHead
              num="06"
              title="Guardrails"
              lede="The generative-AI guidelines this work is held to, restated as decisions rather than clauses. They exist so the studio can move fast — the risky questions are answered before anyone is mid-render."
            />

            {/* The permission, before the restrictions. */}
            <div className="rounded-[6px] border border-accent/30 bg-accent/[0.04] p-5">
              <p className="label !text-accent">The standing permission</p>
              <p className="mt-2.5 text-base leading-relaxed">{STANDING_PERMISSION}</p>
            </div>

            <h3 className="mt-10 text-xl tracking-[-0.02em]">Three lines that do not move</h3>
            <div className="mt-4 space-y-4">
              {HARD_STOPS.map((r) => (
                <div key={r.h} className="border-l-2 border-danger/50 pl-5">
                  <h4 className="font-semibold">{r.h}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.p}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-10 text-xl tracking-[-0.02em]">
              On a real product, where the line actually falls
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              This is the most specific rule in the set, so it gets the most
              specific treatment. Everything on the left is production craft.
              Everything on the right changes what the customer thinks they are
              buying.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-[6px] border border-success/30 bg-success/[0.05] p-5">
                <p className="label !text-success">AI may</p>
                <ul className="mt-3 space-y-1.5">
                  {PRODUCT_TRUTH.may.map((x) => (
                    <li key={x} className="text-sm leading-relaxed">{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[6px] border border-danger/30 bg-danger/[0.05] p-5">
                <p className="label !text-danger">AI may not</p>
                <ul className="mt-3 space-y-1.5">
                  {PRODUCT_TRUTH.mustNot.map((x) => (
                    <li key={x} className="text-sm leading-relaxed">{x}</li>
                  ))}
                </ul>
              </div>
            </div>

            <h3 className="mt-10 text-xl tracking-[-0.02em]">Depicting people</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {PEOPLE.map((r) => (
                <div key={r.h}>
                  <h4 className="font-semibold">{r.h}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.p}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-10 text-xl tracking-[-0.02em]">What has to survive an audit</h3>
            <dl className="mt-4 divide-y divide-border-soft border-y border-border-soft">
              {PAPER_TRAIL.map(([term, def]) => (
                <div key={term} className="grid gap-2 py-4 md:grid-cols-[200px_1fr] md:gap-6">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-sm leading-relaxed text-muted">{def}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-10 text-xl tracking-[-0.02em]">
              Two questions that settle most of it
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {TESTS.map((t) => (
                <blockquote
                  key={t.label}
                  className="rounded-[6px] border border-border-soft bg-surface-2 p-5"
                >
                  <p className="label !text-accent">{t.label}</p>
                  <p className="mt-2.5 text-base font-semibold leading-snug">{t.q}</p>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{t.then}</p>
                </blockquote>
              ))}
            </div>

            <h3 className="mt-10 text-xl tracking-[-0.02em]">
              Where this is enforced rather than promised
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              A guideline nothing implements is a hope. These are the places
              the studio in this demo makes the rule structural — so following
              it is the default path, not the disciplined one.
            </p>
            <dl className="mt-4 divide-y divide-border-soft border-y border-border-soft">
              {ENFORCED_HERE.map(([term, def]) => (
                <div key={term} className="grid gap-2 py-4 md:grid-cols-[240px_1fr] md:gap-6">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-sm leading-relaxed text-muted">{def}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-10 text-xl tracking-[-0.02em]">
              Two things that are not exceptions
            </h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="font-semibold">Food, and anything aimed at children</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Every existing food-advertising, regulatory and
                  child-directed requirement applies exactly as before. Extra
                  care where creative is child-directed, where children are
                  synthesised, where child-oriented characters appear, or where
                  the media buy is aimed at children. AI does not create an
                  exemption from rules that already exist.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Saying so</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Material AI use is disclosed internally, in the approval
                  workflow, always. External disclosure is decided by context —
                  channel, platform, contract, regulation. The one hard case:
                  where staying quiet about AI would itself make the ad
                  misleading, it goes to Legal before it goes out.
                </p>
              </div>
            </div>

            <p className="mt-8 rounded-[6px] border border-warning/40 bg-warning/[0.07] p-4 text-sm leading-relaxed text-warning">
              <span className="font-bold">This page expires.</span> These
              guidelines get reviewed against regulation, platform and
              broadcaster requirements, talent agreements, campaign learnings
              and the quality of synthetic media itself. The clause most likely
              to move first is the broadcast one — synthetic on-camera talent
              is a conservative default about consumer and legal acceptance,
              not a permanent technical judgement.
            </p>
          </section>

          {/* 07 Pre-flight */}
          <section id="preflight" className="scroll-mt-28">
            <SectionHead
              num="07"
              title="Pre-flight"
              lede="The guardrails above, as something you run against an actual asset. Tick it before the asset ships, not after someone asks."
            />
            <PreflightChecklist groups={CHECKLIST} />
          </section>

          {/* 08 Teaching */}
          <section id="teaching" className="scroll-mt-28">
            <SectionHead
              num="08"
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

          {/* 09 Measurement */}
          <section id="measure" className="scroll-mt-28">
            <SectionHead
              num="09"
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
