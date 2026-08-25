import Link from "next/link";
import { DELIVERABLES } from "@/lib/deliverables";
import { MODELS } from "@/lib/models";

const PIPELINE = [
  {
    step: "1 · Ingest",
    title: "One product photo",
    body: "Drag in a single product shot — the only asset the pipeline needs.",
  },
  {
    step: "2 · Understand",
    title: "Vision analysis + adaptive interview",
    body: "Gemini reads the image, extracts product context, and asks only the questions it can't answer itself — usually zero to three.",
  },
  {
    step: "3 · Brief",
    title: "One AI-written campaign brief",
    body: "A single structured brief — mood, setting, palette, bilingual headlines, video direction — drives every deliverable. Fully editable before anything generates.",
  },
  {
    step: "4 · Route",
    title: "Model routing with live cost preview",
    body: "Each deliverable runs on the model best suited (and priced) for it: Nano Banana Pro for text-in-image, Flux for photorealism, Veo for hero motion, Kling for volume cutdowns.",
  },
  {
    step: "5 · Deliver",
    title: "A finished multi-format pack",
    body: "Hero still, format adaptations, EN/FR promo tiles, a seasonal variant, and two videos with native audio — from one photo, in minutes.",
  },
];

export default function Home() {
  const stillCount = DELIVERABLES.filter((d) => d.kind === "still").length;
  const videoCount = DELIVERABLES.filter((d) => d.kind === "video").length;

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="py-20 sm:py-28">
        <p className="chip mb-6">Live demo · AI production pipeline</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          One product photo in.
          <br />
          <span className="text-accent">A retail campaign out.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          A working AI Content Studio in miniature: upload a single product
          image and this pipeline analyzes it, writes the campaign brief, and
          produces {stillCount} finished stills and {videoCount} videos across
          formats, languages and seasons — routing each deliverable to the
          right model at the right cost.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/studio" className="btn-primary">
            Open the Studio →
          </Link>
          <Link href="/build-vs-buy" className="btn-secondary">
            Read the build-vs-buy case
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["8", "deliverables from one photo"],
            ["4+", "models routed by fitness & cost"],
            ["EN/FR", "bilingual versioning built in"],
            ["<$3", "estimated cost per full pack*"],
          ].map(([stat, label]) => (
            <div key={label} className="card p-4">
              <p className="text-2xl font-bold text-accent">{stat}</p>
              <p className="mt-1 text-sm text-muted">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted/70">
          *At current list prices with the cost-efficient default routing (Veo
          3.1 Fast + Kling 3.0 + Nano Banana). Full pricing on the{" "}
          <Link href="/models" className="underline hover:text-foreground">
            model landscape
          </Link>{" "}
          page.
        </p>
      </section>

      {/* Why */}
      <section className="border-t border-border-soft py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Why this exists
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="card p-6">
            <h3 className="font-semibold">Content demand outgrew production</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Retail content is a versioning business: every campaign multiplies
              across formats, placements, seasons and — in Canada — two
              languages. Traditional production models can&apos;t scale to that
              volume at that cadence.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold">AI changes the unit economics</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              A format adaptation that took a studio day becomes a routed model
              call costing cents. The craft moves upstream — into the brief,
              the prompt system, and the quality gate — where judgment lives.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold">The pipeline is the portfolio</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Anyone can show AI outputs. This demo shows the production
              system: intake, adaptive briefing, model routing, cost
              governance, and quality thinking — the actual work of standing up
              an AI content studio.
            </p>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-t border-border-soft py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          The pipeline
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-5">
          {PIPELINE.map((p) => (
            <div key={p.step} className="card flex flex-col p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {p.step}
              </p>
              <h3 className="mt-2 font-semibold leading-snug">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packshot case */}
      <section className="border-t border-border-soft py-16">
        <div className="card grid gap-8 p-8 md:grid-cols-[1fr_320px]">
          <div>
            <p className="chip mb-3">Case study · The planogram problem</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Product-on-white, every angle, without the reshoot
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              Every SKU needs GS1 planogram packshots — front, back, left,
              right, top, bottom — shot on white, retouched, named to spec.
              Multiply that by a private-label catalog and it&apos;s one of the
              largest recurring photography line items in retail. The Packshot
              Studio takes the reference photos you already have and generates
              the missing angles, with GS1-style filenames out of the box.
            </p>
            <p className="mt-3 leading-relaxed text-muted">
              And it&apos;s honest about the limits: angles backed by a real
              reference are marked <span className="font-semibold text-success">grounded</span>;
              faces the camera never saw are{" "}
              <span className="font-semibold text-warning">reconstructed</span>{" "}
              and flagged for mandatory label QA — because the model can&apos;t
              know what an unseen panel says. That distinction is the quality
              gate that makes this usable in production.
            </p>
            <a href="/packshots" className="btn-primary mt-6">
              Open the Packshot Studio →
            </a>
          </div>
          <div className="grid grid-cols-2 content-start gap-3 text-sm">
            {[
              ["6+1", "planogram angles per SKU, one generation each"],
              ["~$0.94", "per full 7-angle set on the Pro tier"],
              ["GS1", "naming convention applied automatically"],
              ["QA flag", "on every reconstructed, ungrounded angle"],
            ].map(([stat, label]) => (
              <div key={label} className="rounded-lg border border-border-soft bg-surface-2 p-4">
                <p className="text-xl font-bold text-accent">{stat}</p>
                <p className="mt-1 text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Models strip */}
      <section className="border-t border-border-soft py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            The models under the hood
          </h2>
          <Link href="/models" className="text-sm text-accent hover:underline">
            Full landscape →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(MODELS).map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold leading-snug">{m.label}</h3>
                <span className="chip shrink-0">
                  {m.kind === "image"
                    ? `$${m.unitCost.toFixed(3)}/img`
                    : `$${m.unitCost.toFixed(2)}/s`}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{m.bestFor}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border-soft py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          See it run end to end
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          The Studio works in demo mode with zero API spend, and goes fully
          live the moment keys are configured — with a cost estimate shown
          before any credit is used.
        </p>
        <Link href="/studio" className="btn-primary mt-8">
          Launch the Studio →
        </Link>
      </section>
    </div>
  );
}
