import type { Metadata } from "next";
import Link from "next/link";
import { BlenderBriefBuilder } from "./BlenderBriefBuilder";
import {
  CLAY_CHECKS,
  LANES,
  MOVED_UPSTREAM,
  PHASES,
  ROUTING,
  VENDOR_OVERLAP,
} from "@/lib/blender";
import { seedanceCost } from "@/lib/videoCost";
import { WALL, WALL_COST } from "@/lib/theWall";

export const metadata: Metadata = {
  title: "Blender → Seedance — AI Content Studio",
  description:
    "Using Blender through MCP to produce clay control passes for Seedance 2.5: what it costs to guess versus to specify, how to keep the two reference lanes apart, and a builder for the brief that constructs the clay.",
};

/**
 * The economics, computed rather than asserted — and computed honestly.
 *
 * The unit is the shot this studio actually rendered and actually paid for:
 * 12 seconds, 4:3, 480p. An earlier version of this page priced the
 * clay-backed take with the prompt-only formula, which flattered it by 60%.
 * Supplying a video reference discounts generation to 0.6 but bills the clip
 * you hand over at full rate, so a clay-backed take is the *more* expensive
 * take. The argument survives that — it just has to be made correctly: you
 * are not buying a cheaper render, you are buying one instead of four.
 */
const SHOT = { resolution: "480p", aspect: "4:3", durationSeconds: 12 } as const;
/** No clay: the model invents the camera, and you re-roll until it lands. */
const GUESS_TAKE = seedanceCost(SHOT);
/** With clay: one take, plus the 12s blockout billed alongside it. */
const CLAY_TAKE = seedanceCost({ ...SHOT, inputVideoSeconds: 12, hasVideoInputs: true });
const GUESSED_TAKES = 4;
const SAVED = GUESS_TAKE * GUESSED_TAKES - CLAY_TAKE;

const money = (n: number) => `$${n.toFixed(2)}`;

function SectionHead({ n, title, lede }: { n: string; title: string; lede?: string }) {
  return (
    <div className="border-t border-border-soft pt-6">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs text-muted/70">{n}</span>
        <h2 className="text-2xl tracking-[-0.02em] sm:text-[28px]">{title}</h2>
      </div>
      {lede && <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.7] text-muted">{lede}</p>}
    </div>
  );
}

/** Reference material worth keeping, not worth scrolling past. */
function Drawer({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-[6px] border border-border-soft bg-surface">
      <summary className="cursor-pointer list-none p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
          </div>
          <span
            aria-hidden
            className="mt-0.5 shrink-0 font-mono text-xs text-accent transition group-open:rotate-90"
          >
            ▸
          </span>
        </div>
      </summary>
      <div className="border-t border-border-soft p-5">{children}</div>
    </details>
  );
}

export default function BlenderPage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* ---------- Hero ---------- */}
      <section className="py-16 sm:py-20">
        <p className="chip mb-6">Blender · MCP · Seedance 2.5</p>
        <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Stop paying a model to guess
          <span className="block text-accent">what you could have built.</span>
        </h1>
        <p className="mt-6 max-w-[68ch] text-lg leading-relaxed text-muted">
          A generative render is the expensive step and the least repeatable
          one. Describe a camera move in words and you get a different move
          every take. Build it in Blender as untextured grey geometry — a{" "}
          <span className="font-semibold text-foreground">clay pass</span> — and
          Seedance reads the structure instead of inventing it. The finished
          pixels are still the model&apos;s. The decisions are yours.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="label-sm">Landing it by trial and error</p>
            <p className="mt-1.5 text-2xl font-semibold">
              {money(GUESS_TAKE * GUESSED_TAKES)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {GUESSED_TAKES} takes at {money(GUESS_TAKE)} — a modest estimate
              for arriving at a specific camera move through wording alone.
            </p>
          </div>
          <div className="card p-5">
            <p className="label-sm">One clay-backed take</p>
            <p className="mt-1.5 text-2xl font-semibold">{money(CLAY_TAKE)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Dearer per take, not cheaper: the 0.6 discount applies to what is
              generated, while the clip you supply is billed in full.
            </p>
          </div>
          <div className="card border-accent/40 p-5">
            <p className="label-sm !text-accent">Difference</p>
            <p className="mt-1.5 text-2xl font-semibold text-accent">{money(SAVED)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Per shot. The clay itself re-renders for the cost of electricity,
              so iteration moves to the free layer and the paid one runs once.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Priced with the Ad Lab&apos;s token model on the shot below — 12s, 4:3,
          480p. That configuration was measured against a real invoice at $3.05;
          the model puts it at {money(CLAY_TAKE)}.
        </p>

        <p className="mt-5 max-w-[68ch] text-sm leading-relaxed text-muted">
          The saving is the smaller half of the argument. The larger half is
          that the clay pass makes the shot{" "}
          <span className="font-semibold text-foreground">repeatable</span> — the
          same camera move, the same blocking, the same beat timing on every
          regeneration — which is what lets a concept survive review notes
          instead of being re-rolled.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#builder" className="btn-primary">
            Write the brief that builds the clay →
          </a>
          <a href="/blender/CLAUDE.md" download className="btn-secondary">
            Download the working guide (.md)
          </a>
        </div>
      </section>

      {/* ---------- Worked example ---------- */}
      <section className="pb-12">
        <Link
          href="/ai-studio/blender/the-wall"
          className="group block overflow-hidden rounded-[6px] border border-accent/30 bg-accent/[0.04] transition hover:border-accent"
        >
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WALL.poster}
              alt="Final frame of the clay control pass — four ID-coloured packs behind a cookie"
              className="h-full w-full object-cover"
            />
            <div className="p-6 sm:p-8">
              <p className="label !text-accent">Worked example</p>
              <h2 className="mt-3 text-2xl tracking-[-0.02em] sm:text-[28px]">
                {WALL.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{WALL.lede}</p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
                {WALL_COST.map((c) => (
                  <div key={c.k}>
                    <p className="text-lg font-semibold text-accent">
                      {c.v}
                      {c.unit && <span className="ml-0.5 text-xs text-muted">{c.unit}</span>}
                    </p>
                    <p className="text-[11px] leading-snug text-muted">
                      {c.k.split(" — ")[0].split(",")[0]}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold text-accent">
                Read the shot, including the frame that could not be built →
              </p>
            </div>
          </div>
        </Link>
      </section>

      {/* ---------- 01 What moves upstream ---------- */}
      <section className="py-12">
        <SectionHead
          n="01"
          title="What moves upstream"
          lede="Every row is a decision you are otherwise paying the model to make, differently, on every take."
        />
        <div className="mt-8 overflow-x-auto rounded-[6px] border border-border-soft">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="p-4 label-sm">Decision</th>
                <th className="p-4 label-sm">Left to the prompt</th>
                <th className="p-4 label-sm !text-accent">Settled in clay</th>
              </tr>
            </thead>
            <tbody>
              {MOVED_UPSTREAM.map((r) => (
                <tr key={r.decision} className="border-t border-border-soft align-top">
                  <td className="p-4 font-semibold whitespace-nowrap">{r.decision}</td>
                  <td className="p-4 leading-relaxed text-muted">{r.prompted}</td>
                  <td className="p-4 leading-relaxed">{r.clay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- 02 Two lanes ---------- */}
      <section className="py-12">
        <SectionHead
          n="02"
          title="Two lanes, never mixed"
          lede="Confusing these is the single most common way the workflow fails. If you find yourself wanting the clay pass to be the right brand yellow, you have merged them."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {LANES.map((lane) => (
            <div key={lane.id} className="card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg tracking-[-0.02em]">{lane.name}</h3>
                <span className="chip shrink-0">{lane.medium}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{lane.why}</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="label-sm !text-success">Carries</p>
                  <ul className="mt-2 space-y-1.5">
                    {lane.carries.map((c) => (
                      <li key={c} className="text-xs leading-relaxed">{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="label-sm !text-danger">Never</p>
                  <ul className="mt-2 space-y-1.5">
                    {lane.never.map((c) => (
                      <li key={c} className="text-xs leading-relaxed text-muted">{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 03 The build ---------- */}
      <section className="py-12">
        <SectionHead
          n="03"
          title="How the build runs"
          lede="Six phases through the Blender MCP connection. Every call runs in a fresh Python namespace, so the scene lives in a script file rather than in a conversation — which matters because the clay pass gets re-rendered many times."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((p) => (
            <div key={p.n} className="rounded-[6px] border border-border-soft bg-surface p-5">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-xs text-accent">{p.n}</span>
                <h3 className="text-base font-semibold">{p.name}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>

        {/*
          Reference, not argument. All three of these earned their place and
          none of them belongs in the scroll path between the phases and the
          builder — the checklist is consulted at render time, the routing
          table when something has already gone wrong, and the vendor note once.
        */}
        <div className="mt-6 space-y-3">
          <Drawer
            title="Clay pass checklist"
            hint="Thirteen things to check against a real frame before you export. A script exiting cleanly is not evidence the render is right."
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {CLAY_CHECKS.map((c) => (
                <li key={c} className="flex gap-2.5 text-xs leading-relaxed">
                  <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50" />
                  {c}
                </li>
              ))}
            </ul>
          </Drawer>

          <Drawer
            title="When a take comes back wrong, route it to the layer that owns it"
            hint="The expensive mistake is fixing a Blender problem with prompt edits, or a prompt problem with re-renders. Change one variable at a time."
          >
            <div className="overflow-x-auto rounded-[6px] border border-border-soft">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="p-3 label-sm">What you see</th>
                    <th className="p-3 label-sm">Layer</th>
                    <th className="p-3 label-sm">Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTING.map((r) => (
                    <tr key={r.symptom} className="border-t border-border-soft align-top">
                      <td className="p-3 text-xs leading-relaxed">{r.symptom}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="chip">{r.layer}</span>
                      </td>
                      <td className="p-3 text-xs leading-relaxed text-muted">{r.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Drawer>

          <Drawer
            title={`${VENDOR_OVERLAP.name} — what a vendor now does for you`}
            hint="A page arguing that knowing the landscape is the job should say that this is partly automated now — and be equally clear that it automates the geometry, not the judgment."
          >
            <p className="max-w-[70ch] text-sm leading-relaxed text-muted">
              {VENDOR_OVERLAP.what}
            </p>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="label-sm !text-success">Where it genuinely helps</p>
                <dl className="mt-3 space-y-3">
                  {VENDOR_OVERLAP.helps.map((h) => (
                    <div key={h.k}>
                      <dt className="text-xs font-semibold">{h.k}</dt>
                      <dd className="mt-1 text-xs leading-relaxed text-muted">{h.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="label-sm !text-warning">What it does not change</p>
                <dl className="mt-3 space-y-3">
                  {VENDOR_OVERLAP.doesNotChange.map((h) => (
                    <div key={h.k}>
                      <dt className="text-xs font-semibold">{h.k}</dt>
                      <dd className="mt-1 text-xs leading-relaxed text-muted">{h.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <p className="mt-5 rounded-[6px] border border-warning/40 bg-warning/10 p-4 text-xs leading-relaxed">
              <span className="font-bold text-warning">The cost catch.</span>{" "}
              <span className="text-foreground">{VENDOR_OVERLAP.costCatch}</span>
            </p>
            <div className="mt-4 border-t border-border-soft pt-4">
              <p className="label-sm !text-accent">Verdict</p>
              <p className="mt-2 max-w-[70ch] text-sm leading-relaxed">
                {VENDOR_OVERLAP.verdict}
              </p>
              <p className="mt-2 max-w-[70ch] text-xs leading-relaxed text-muted">
                {VENDOR_OVERLAP.caveat}
              </p>
            </div>
          </Drawer>
        </div>
      </section>

      {/* ---------- 04 The builder ---------- */}
      <section id="builder" className="scroll-mt-28 py-12">
        <SectionHead
          n="04"
          title="Write the brief that builds the clay"
          lede="This is the brief you hand to whatever is driving Blender — scene, camera, ID colours, the beat sheet as keyframes, and how to animate it. It also names what you are not simulating, because a placeholder the video prompt does not know about is what produces a flat object skating across a frozen surface."
        />
        <BlenderBriefBuilder mode="build" />

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
          <span className="font-semibold text-foreground">Then write the prompt.</span>{" "}
          The clip this brief produces becomes{" "}
          <code className="font-mono text-xs">[Video1]</code> in a Seedance
          prompt — a separate document, built from the same shot so the two
          cannot drift apart.{" "}
          <Link href="/ai-studio/prompts" className="font-semibold text-accent hover:underline">
            Open the prompt builder →
          </Link>
        </p>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="border-t border-border-soft py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          The clay is half of it. The recipe is the other half.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/ai-studio/prompts" className="btn-primary">
            Prompt builder →
          </Link>
          <Link href="/ai-studio/ads" className="btn-secondary">
            Open the Ad Lab
          </Link>
        </div>
      </section>
    </div>
  );
}
