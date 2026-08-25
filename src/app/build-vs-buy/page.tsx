import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build vs. Buy — AI Content Studio",
  description:
    "One-pager: when an AI content studio should buy a creative suite, and when it should build on direct model APIs.",
};

export default function BuildVsBuyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <p className="chip mb-4">One-pager · Studio operating decision</p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Build vs. buy: suites, aggregators, or direct APIs
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Every AI studio faces the same stack decision three ways at once. The
        answer isn&apos;t one of them — it&apos;s knowing which layer each kind of work
        belongs on, and keeping the freedom to move as the market shifts
        monthly.
      </p>

      <div className="mt-10 grid gap-4">
        {/* Option rows */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">1 · Creative suites (Higgsfield, Freepik, Krea…)</h2>
            <span className="chip">$15–150/seat/mo</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Subscription UIs that wrap 15+ third-party models (Veo, Kling,
            Seedance, WAN…) with presets and editing tools. Notably, they own
            no frontier models themselves — they are a convenience layer over
            the same APIs anyone can call.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-success">Wins when</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                <li>Creatives explore and iterate hands-on daily</li>
                <li>You want day-one access to every new model</li>
                <li>Team is small and volume is modest</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-danger">Fails when</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                <li>Volume scales — per-seat + credit pricing beats you</li>
                <li>You need workflow integration, QA gates, audit trails</li>
                <li>Rights/data-governance terms need enterprise review</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">2 · API aggregators (fal.ai, Replicate)</h2>
            <span className="chip">usage-priced</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            One API key, ~1,000 curated production endpoints (fal) or 50k+
            community models (Replicate). The pragmatic middle: model diversity
            without one integration per vendor, and pipeline-ready from day
            one.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-success">Wins when</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                <li>Building repeatable pipelines (versioning, adaptation)</li>
                <li>You swap models often as leaders change</li>
                <li>Cost must map linearly to output</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-danger">Fails when</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                <li>You need a first-party enterprise contract & SLA</li>
                <li>A model exists only on the vendor&apos;s own API</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">3 · Direct model APIs (Gemini, BFL, Runway…)</h2>
            <span className="chip">usage-priced</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            First-party access: newest capabilities first, best rate limits,
            enterprise terms (indemnification, data handling) negotiated with
            the actual model owner. The Gemini API is the standout for retail:
            reasoning, vision, stills (Nano Banana) and video (Veo) behind one
            key.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-success">Wins when</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                <li>The workload anchors on one vendor&apos;s ecosystem</li>
                <li>Legal needs first-party rights & indemnity terms</li>
                <li>Scale justifies negotiated pricing</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-danger">Fails when</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                <li>You over-commit and the leaderboard flips (see Sora 2&apos;s API sunset)</li>
                <li>Each extra vendor adds an integration to maintain</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="card mt-8 border-accent/40 bg-accent/5 p-6">
        <h2 className="text-lg font-bold">The recommendation</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Run all three layers deliberately:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            <span className="font-semibold text-foreground">Suites for exploration</span> — a
            few seats so creatives touch every new model the week it ships.
            Treat this as R&D spend, not production infrastructure.
          </li>
          <li>
            <span className="font-semibold text-foreground">Direct APIs + one aggregator for production</span> — Gemini
            direct (reasoning, Nano Banana, Veo) plus fal.ai for everything else
            (Flux, Kling, Seedance). This demo runs exactly this stack.
          </li>
          <li>
            <span className="font-semibold text-foreground">Re-evaluate monthly, keep switching cheap</span> — model
            IDs and prices live in one config file; the pipeline is
            model-agnostic by design. When a leader changes, the switch is a
            config edit, not a rebuild.
          </li>
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The principle underneath: <span className="font-semibold text-foreground">own the workflow, rent the models.</span>{" "}
          Workflows, prompt systems, quality gates and brand knowledge
          compound. Models are commodities that change quarterly.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Decision lens 1", "Rights & governance", "Who indemnifies the output? Where does uploaded product imagery go? Enterprise answers exist only at the suite-contract or first-party-API level."],
          ["Decision lens 2", "Unit economics at volume", "Per-seat suites are flat-cost until volume makes credits the bill. APIs are linear from day one — model routing (draft cheap, finish premium) is where the real savings live."],
          ["Decision lens 3", "Switching cost", "The market leader has changed roughly quarterly since 2024. Any layer you can't leave in a week is a liability."],
        ].map(([kicker, title, body]) => (
          <div key={title} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{kicker}</p>
            <h3 className="mt-1 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
