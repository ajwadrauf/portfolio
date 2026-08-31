import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Build vs. Buy — AI Content Studio",
  description:
    "The stack decision an AI content studio has to make: creative suites, API aggregators, or direct model APIs — compared, with a recommendation.",
};

/** The three layers, top (most abstracted) to bottom (closest to the model). */
const LAYERS = [
  {
    n: "01",
    name: "Creative suites",
    examples: "Higgsfield · Freepik · Krea",
    price: "$15–150 / seat / mo",
    role: "Exploration",
    body: "Subscription UIs wrapping 15+ third-party models. They still own no frontier models, but calling them a convenience layer is now only half right: the leaders ship into the tools a team already uses — Higgsfield has a Blender add-on that prompts an editable blockout and animates a camera rig, an MCP bridge so an agent can build in the open scene, plus Premiere, After Effects and Figma plugins and a REST API of its own. What you are buying is the integration, not the model.",
    wins: [
      "Creatives explore and iterate hands-on, daily",
      "Day-one access to every new model",
      "The tool plugs into an existing craft app and saves real hours there",
      "Small team, modest volume",
    ],
    fails: [
      "Volume scales — per-seat plus credits beats you",
      "You need workflow integration, QA gates, audit trails",
      "The headline unlimited plan does not extend to the API or MCP, so an automated pipeline is back on credits",
      "Rights and data-governance terms need enterprise review",
    ],
  },
  {
    n: "02",
    name: "API aggregators",
    examples: "fal.ai · Replicate",
    price: "Usage-priced",
    role: "Production",
    body: "One key, ~1,000 curated production endpoints (fal) or 50k+ community models (Replicate). The pragmatic middle: model diversity without one integration per vendor.",
    wins: [
      "Repeatable pipelines — versioning, adaptation, batch",
      "You swap models often as leaders change",
      "Cost maps linearly to output",
    ],
    fails: [
      "You need a first-party enterprise contract and SLA",
      "A model exists only on its vendor's own API",
    ],
  },
  {
    n: "03",
    name: "Direct model APIs",
    examples: "Gemini · Black Forest Labs · Runway",
    price: "Usage-priced, negotiable",
    role: "Anchor",
    body: "First-party access: newest capabilities first, best rate limits, enterprise terms negotiated with the model owner. Gemini is the standout for retail — reasoning, vision, stills and video behind one key.",
    wins: [
      "The workload anchors on one vendor's ecosystem",
      "Legal needs first-party rights and indemnity",
      "Scale justifies negotiated pricing",
    ],
    fails: [
      "You over-commit and the leaderboard flips (see Sora 2's API sunset)",
      "Every extra vendor is another integration to maintain",
    ],
  },
];

type Row = { criterion: string; suites: string; agg: string; direct: string; best: 0 | 1 | 2 };

const MATRIX: Row[] = [
  { criterion: "Pricing model", suites: "Per seat + credits", agg: "Per generation", direct: "Per generation, negotiable at scale", best: 1 },
  { criterion: "Access to new models", suites: "Day one, across vendors", agg: "Days to weeks", direct: "Day one, that vendor only", best: 0 },
  { criterion: "Workflow integration", suites: "None — UI only", agg: "Full API", direct: "Full API", best: 1 },
  { criterion: "Rights & indemnity", suites: "Vendor terms, varies", agg: "Passed through from the model owner", direct: "First-party, negotiable", best: 2 },
  { criterion: "Cost at high volume", suites: "Breaks down", agg: "Linear and predictable", direct: "Linear, improves with commitment", best: 2 },
  { criterion: "Switching cost", suites: "Low — cancel seats", agg: "Low — change one endpoint string", direct: "Medium — per-vendor integration", best: 1 },
  { criterion: "Where it breaks", suites: "Volume scales", agg: "You need a first-party SLA", direct: "The leaderboard flips", best: 1 },
];

const LENSES = [
  {
    q: "Who indemnifies the output?",
    a: "Rights and data-governance answers only exist at the suite-contract or first-party-API level. If a brand ships it, someone has to stand behind it.",
  },
  {
    q: "What does this cost at 500 assets a week?",
    a: "Per-seat suites are flat until volume turns credits into the real bill. APIs are linear from day one — and model routing (draft cheap, finish premium) is where the savings actually live.",
  },
  {
    q: "Could we leave in a week?",
    a: "The market leader has changed roughly quarterly since 2024. Any layer you can't exit in a week is a liability, not a partnership.",
  },
];

export default function BuildVsBuyPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      {/* ---------- Header ---------- */}
      <header className="max-w-3xl">
        <p className="chip mb-4">One-pager · Studio operating decision</p>
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.04em]">
          Build vs. buy
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Every AI studio faces this stack decision three ways at once. The
          answer isn&apos;t one of them — it&apos;s knowing which layer each kind of
          work belongs on, and keeping the freedom to move as the market shifts
          monthly.
        </p>
      </header>

      {/* ---------- The call, up front ---------- */}
      <section className="mt-12">
        <div className="flex items-baseline gap-3">
          <h2 className="label !text-accent">
            The call
          </h2>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
        <div className="mt-5 grid gap-px overflow-hidden rounded-[6px] border border-border-soft bg-border-soft sm:grid-cols-3">
          {[
            ["Buy", "Suites for exploration", "A few seats so creatives touch every new model the week it ships. R&D spend, not production infrastructure."],
            ["Build", "APIs for production", "Gemini direct plus one aggregator. Every repeatable pipeline lives here. This demo runs exactly this stack."],
            ["Neither, forever", "Re-evaluate monthly", "Model IDs and prices in one config file. When a leader changes, it's an edit — not a rebuild."],
          ].map(([verdict, title, body]) => (
            <div key={title} className="bg-surface p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                {verdict}
              </p>
              <h3 className="mt-2 font-semibold leading-snug">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Stack diagram ---------- */}
      <section className="mt-14">
        <div className="flex items-baseline gap-3">
          <h2 className="label !text-accent">
            The stack
          </h2>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
        <div className="mt-5 space-y-2">
          {LAYERS.map((l, i) => (
            <div
              key={l.name}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[6px] border border-border-soft bg-surface px-5 py-4 ${
                ["", "sm:ml-6", "sm:ml-12"][i]
              }`}
            >
              <span className="font-mono text-xs text-muted/60">{l.n}</span>
              <span className="font-semibold">{l.name}</span>
              <span className="text-sm text-muted">{l.examples}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="chip">{l.price}</span>
                <span className="rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-bold text-accent">
                  {l.role}
                </span>
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted/70">
            Each layer sits closer to the model than the one above it — and
            gives up convenience for control as you descend.
          </p>
        </div>
      </section>

      {/* ---------- Comparison matrix ---------- */}
      <section className="mt-14">
        <div className="flex items-baseline gap-3">
          <h2 className="label !text-accent">
            Head to head
          </h2>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
        <div className="mt-5 overflow-x-auto rounded-[6px] border border-border-soft">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2">
                <th className="w-44 px-4 py-3 text-left font-semibold text-muted">
                  Criterion
                </th>
                {["Creative suites", "API aggregators", "Direct APIs"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => {
                const cells = [row.suites, row.agg, row.direct];
                return (
                  <tr key={row.criterion} className="border-t border-border-soft">
                    <th scope="row" className="px-4 py-3 text-left align-top font-medium text-muted">
                      {row.criterion}
                    </th>
                    {cells.map((cell, i) => {
                      const isBest = row.best === i;
                      return (
                        <td
                          key={i}
                          className={`px-4 py-3 align-top ${
                            isBest
                              ? "bg-accent/[0.07] font-medium text-foreground"
                              : "text-muted"
                          }`}
                        >
                          {cell}
                          {isBest && (
                            <span className="ml-1.5 align-middle font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                              ✦ edge
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted/70">
          &ldquo;Edge&rdquo; marks the layer that wins that row outright — no layer
          wins enough of them to win the page, which is the point.
        </p>
      </section>

      {/* ---------- Deep dives ---------- */}
      <section className="mt-14">
        <div className="flex items-baseline gap-3">
          <h2 className="label !text-accent">
            The layers in detail
          </h2>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
        <div className="mt-6 space-y-10">
          {LAYERS.map((l) => (
            <article key={l.name} className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-bold text-accent/30">{l.n}</span>
                  <h3 className="text-xl tracking-[-0.025em]">{l.name}</h3>
                </div>
                <p className="mt-1 pl-11 text-sm text-muted">{l.examples}</p>
                <p className="mt-3 pl-11 text-sm leading-relaxed text-muted">{l.body}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[6px] border-l-2 border-success bg-surface p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-success">
                    Wins when
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm leading-snug text-muted">
                    {l.wins.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[6px] border-l-2 border-danger bg-surface p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
                    Fails when
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm leading-snug text-muted">
                    {l.fails.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Principle ---------- */}
      <section className="mt-16 border-y border-border-soft py-12 text-center">
        <p className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
          Own the workflow.
          <br />
          <span className="text-accent">Rent the models.</span>
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
          Workflows, prompt systems, quality gates and brand knowledge compound.
          Models are commodities that change quarterly. Build the first, rent
          the second, and never let the second dictate the first.
        </p>
      </section>

      {/* ---------- Lenses ---------- */}
      <section className="mt-14">
        <div className="flex items-baseline gap-3">
          <h2 className="label !text-accent">
            Three questions that settle it
          </h2>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
        <dl className="mt-6 space-y-6">
          {LENSES.map((l) => (
            <div key={l.q} className="grid gap-2 md:grid-cols-[1fr_1.6fr] md:gap-8">
              <dt className="font-semibold leading-snug">{l.q}</dt>
              <dd className="text-sm leading-relaxed text-muted">{l.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- Concrete footer ---------- */}
      <section className="mt-14 rounded-[6px] border border-accent/30 bg-accent/[0.05] p-6">
        <h2 className="font-semibold">What this demo actually runs on</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Gemini direct for reasoning, vision, Nano Banana stills and Veo video;
          fal.ai for Flux, Kling, Seedance, Runway and ElevenLabs Music. Every
          model ID and price lives in one config file with environment
          overrides — the switching cost this page argues for, made real.
        </p>
        <Link href="/ai-studio/models" className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
          See the routing table →
        </Link>
      </section>
    </div>
  );
}
