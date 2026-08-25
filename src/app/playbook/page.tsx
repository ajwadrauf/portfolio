import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Production Playbook — AI Content Studio",
  description:
    "The reusable playbook behind the demo: workflow, prompt system, quality gates, cost governance, and responsible-AI guardrails.",
};

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border-soft py-10 first:border-t-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{kicker}</p>
      <h2 className="mt-1 text-xl font-bold">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PlaybookPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <p className="chip mb-4">Playbook · How the studio scales beyond one person</p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        The production playbook
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        A studio isn&apos;t a person who&apos;s good with tools — it&apos;s a documented
        system anyone trained can run. This is the playbook the{" "}
        <Link href="/studio" className="text-accent hover:underline">demo pipeline</Link>{" "}
        implements, written to be taught.
      </p>

      <Section kicker="Workflow" title="Intake → brief → route → generate → gate → deliver">
        <p>
          Every job enters through the same intake: one grounding asset (the
          product photo) plus the minimum viable context. The vision model
          extracts everything it can see and interviews for only what it
          can&apos;t — an intake form that fills itself is the difference between a
          pipeline teams adopt and one they route around.
        </p>
        <p>
          One structured brief then drives every deliverable. That&apos;s
          deliberate: consistency across a pack comes from shared upstream
          context, not from post-hoc correction. The brief is always
          human-edited before generation — the judgment gate sits where it&apos;s
          cheapest, before spend, not after.
        </p>
      </Section>

      <Section kicker="Prompt system" title="Prompts are templates, not incantations">
        <p>
          Nothing here relies on a hero prompt someone keeps in their head.
          Each deliverable has a prompt <em>builder</em>: base creative
          direction from the brief + a format-specific composition block + a
          model-specific style suffix. Change the brief, and eight prompts
          update. That&apos;s what makes versioning (EN/FR, seasonal, format)
          a parameter instead of a project.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Subject and action first; camera, light and setting second; style descriptor last.</li>
          <li>Real product attributes (colors, texture, packaging) injected from vision analysis — never invented.</li>
          <li>Video prompts carry an explicit <span className="font-mono text-xs">Audio:</span> cue — native-audio models reward sound design written into the prompt.</li>
          <li>Negative prompts are maintained per style, with artifact patterns added as they&apos;re seen in QA.</li>
          <li>No brand names or logos in generation prompts — brand lockups composite in post, where they&apos;re controlled.</li>
        </ul>
      </Section>

      <Section kicker="Model routing" title="Draft cheap, finish premium">
        <p>
          The routing table (see{" "}
          <Link href="/models" className="text-accent hover:underline">model landscape</Link>)
          assigns each deliverable the cheapest model that clears its quality
          bar: flash-tier stills for adaptations, pro-tier for text-in-image,
          Veo Fast for drafts, Veo Standard only for finishing, Kling for
          volume cutdowns. Routing — not negotiation — is where an AI studio
          finds most of its cost efficiency.
        </p>
      </Section>

      <Section kicker="Quality gates" title="Every asset passes three checks">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-foreground">Product fidelity</span> — is this the actual
            product (shape, colors, packaging), not a plausible look-alike?
            Grounding every generation on the real photo makes this passable;
            the gate makes it guaranteed.
          </li>
          <li>
            <span className="font-semibold text-foreground">Text integrity</span> — every rendered word
            spelled and accented correctly, in both languages. FR is reviewed
            by a French speaker, not assumed.
          </li>
          <li>
            <span className="font-semibold text-foreground">Brand & claim safety</span> — no implied
            claims, no accidental third-party marks, composition leaves room
            for mandated elements (price points, legal lines).
          </li>
        </ul>
        <p>
          Human review sits at two points: the brief (before spend) and the
          gate (before delivery). Everything between is automated.
        </p>
      </Section>

      <Section kicker="Cost governance" title="Nobody spends a credit blind">
        <ul className="list-disc space-y-1 pl-5">
          <li>Pre-flight estimate shown and confirmed before any live generation.</li>
          <li>List prices live in one config file; the estimator reads from it.</li>
          <li>Session spend tracked and always visible.</li>
          <li>Demo mode mocks the full pipeline — UX and training never burn credits.</li>
          <li>Defaults are the cost-efficient tier; premium is an explicit choice.</li>
        </ul>
      </Section>

      <Section kicker="Responsible AI" title="Guardrails that let the studio move fast">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-foreground">Rights & IP</span> — generate only from
            owned product assets; prefer providers with enterprise indemnity
            terms for production work; keep the generation record (model,
            prompt, date) per delivered asset.
          </li>
          <li>
            <span className="font-semibold text-foreground">Disclosure</span> — follow platform and
            regulatory AI-disclosure requirements per channel; default to
            disclosure where ambiguous.
          </li>
          <li>
            <span className="font-semibold text-foreground">People</span> — no photoreal likenesses of
            real people without consent workflows; person-generation settings
            locked at the API layer, not by convention.
          </li>
          <li>
            <span className="font-semibold text-foreground">Privacy</span> — product photos only;
            no customer data ever enters a generation prompt.
          </li>
        </ul>
      </Section>

      <Section kicker="Teaching" title="Built to be taught">
        <p>
          Every generated asset in the demo exposes its prompt (&quot;View
          prompt&quot; on each card) — the pipeline shows its work. That&apos;s the
          teaching model for the studio: every workflow visible, every decision
          documented, every playbook written so the second person — and the
          tenth — can run it. Capability that lives in one person&apos;s head
          isn&apos;t a studio; it&apos;s a bottleneck with a title.
        </p>
      </Section>

      <Section kicker="Measurement" title="What the studio is accountable for">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Speed", "Brief-to-delivery time per pack; same-day for standard versioning."],
            ["Volume", "Assets delivered per week, and per dollar, by type."],
            ["Quality", "First-pass approval rate through the quality gates; rework rate."],
            ["Adoption", "Teams and brand partners actively using the studio; repeat intake rate."],
            ["In-housing", "Share of work absorbed from external vendors, where quality and rights make sense."],
            ["Cost", "Cost per finished asset vs. traditional production baseline."],
          ].map(([k, v]) => (
            <div key={k} className="card p-4">
              <p className="font-semibold text-foreground">{k}</p>
              <p className="mt-1 text-sm text-muted">{v}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
