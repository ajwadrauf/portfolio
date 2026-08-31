import type { Metadata } from "next";
import Link from "next/link";
import { BlenderBriefBuilder } from "./BlenderBriefBuilder";
import {
  CLAY_CHECKS,
  LANES,
  MOVED_UPSTREAM,
  PHASES,
  ROUTING,
  SPECS,
  VENDOR_OVERLAP,
} from "@/lib/blender";
import { seedanceCost } from "@/lib/videoCost";

export const metadata: Metadata = {
  title: "Blender → Seedance — AI Content Studio",
  description:
    "Using Blender through MCP to produce clay control passes for Seedance 2.5: what it costs to guess versus to specify, how to keep the two reference lanes apart, where a vendor add-on helps and where it does not, and a builder for the prompt that goes with the clay.",
};

/**
 * The economics, computed rather than asserted.
 *
 * A 12-second 720p take is the unit of comparison. The claim on this page is
 * about how many takes it costs to arrive at a camera move, not about the
 * price of one — so the interesting number is the difference between landing
 * it on the first render and landing it on the fourth.
 */
const TAKE = seedanceCost({ resolution: "720p", aspect: "1:1", durationSeconds: 12 });
const GUESSED_TAKES = 4;
const SAVED = TAKE * (GUESSED_TAKES - 1);

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
            <p className="label-sm">One 12s take at 720p</p>
            <p className="mt-1.5 text-2xl font-semibold text-accent">{money(TAKE)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Priced with the same token model as the Ad Lab.
            </p>
          </div>
          <div className="card p-5">
            <p className="label-sm">Landing it by trial and error</p>
            <p className="mt-1.5 text-2xl font-semibold">
              {money(TAKE * GUESSED_TAKES)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Four takes is a modest estimate for arriving at a specific camera
              move through prompt wording alone.
            </p>
          </div>
          <div className="card border-accent/40 p-5">
            <p className="label-sm !text-accent">Difference</p>
            <p className="mt-1.5 text-2xl font-semibold text-accent">{money(SAVED)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Per shot. A clay re-render costs electricity, so the iteration
              moves to the free layer and the paid one runs once.
            </p>
          </div>
        </div>

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
            Write a Blender-backed prompt →
          </a>
          <a href="/blender/CLAUDE.md" download className="btn-secondary">
            Download the working guide (.md)
          </a>
        </div>
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

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="card p-6">
            <p className="label !text-accent">Clay pass checklist</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Run against a real frame. A script exiting cleanly is not evidence
              the render is right — the classic failure returns{" "}
              <code className="font-mono">status: ok</code> while the bowl is a
              sealed disc and the lid floats detached in space.
            </p>
            <ul className="mt-4 space-y-2">
              {CLAY_CHECKS.map((c) => (
                <li key={c} className="flex gap-2.5 text-xs leading-relaxed">
                  <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <p className="label !text-accent">Limits worth knowing before you build</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Documented as of August 2026. Verify against the live surface
              before a paid run — the consumer app, the API and resellers expose
              different subsets.
            </p>
            <dl className="mt-4 space-y-3">
              {SPECS.map((s) => (
                <div key={s.k}>
                  <dt className="label-sm">{s.k}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---------- 04 Routing failures ---------- */}
      <section className="py-12">
        <SectionHead
          n="04"
          title="Route the failure to the layer that owns it"
          lede="The most expensive mistake in the loop is fixing a Blender problem with prompt edits, or a prompt problem with re-renders. Change one variable at a time: hold the clay still while iterating the prompt, then hold the prompt still while iterating the clay."
        />
        <div className="mt-8 overflow-x-auto rounded-[6px] border border-border-soft">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="p-4 label-sm">What you see</th>
                <th className="p-4 label-sm">Layer</th>
                <th className="p-4 label-sm">Fix</th>
              </tr>
            </thead>
            <tbody>
              {ROUTING.map((r) => (
                <tr key={r.symptom} className="border-t border-border-soft align-top">
                  <td className="p-4 leading-relaxed">{r.symptom}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="chip">{r.layer}</span>
                  </td>
                  <td className="p-4 leading-relaxed text-muted">{r.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- 05 Vendor tooling ---------- */}
      <section className="py-12">
        <SectionHead
          n="05"
          title="What a vendor now does for you, and what it does not"
          lede="Higgsfield shipped a Blender add-on that automates part of this. A page arguing that knowing the landscape is the job should say so — and should be equally clear that it automates the geometry, not the judgment."
        />

        <div className="mt-8 rounded-[6px] border border-border-soft bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-lg tracking-[-0.02em]">{VENDOR_OVERLAP.name}</h3>
            <span className="chip shrink-0">{VENDOR_OVERLAP.dated}</span>
          </div>
          <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted">
            {VENDOR_OVERLAP.what}
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="label-sm !text-success">Where it genuinely helps</p>
              <dl className="mt-3 space-y-3.5">
                {VENDOR_OVERLAP.helps.map((h) => (
                  <div key={h.k}>
                    <dt className="text-sm font-semibold">{h.k}</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-muted">{h.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <p className="label-sm !text-warning">What it does not change</p>
              <dl className="mt-3 space-y-3.5">
                {VENDOR_OVERLAP.doesNotChange.map((h) => (
                  <div key={h.k}>
                    <dt className="text-sm font-semibold">{h.k}</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-muted">{h.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className="mt-6 rounded-[6px] border border-warning/40 bg-warning/10 p-4 text-xs leading-relaxed">
            <span className="font-bold text-warning">The cost catch.</span>{" "}
            <span className="text-foreground">{VENDOR_OVERLAP.costCatch}</span>
          </p>

          <div className="mt-5 border-t border-border-soft pt-5">
            <p className="label-sm !text-accent">Verdict</p>
            <p className="mt-2 max-w-[70ch] text-sm leading-relaxed">
              {VENDOR_OVERLAP.verdict}
            </p>
            <p className="mt-3 max-w-[70ch] text-xs leading-relaxed text-muted">
              {VENDOR_OVERLAP.caveat}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 06 The builder ---------- */}
      <section id="builder" className="scroll-mt-28 py-12">
        <SectionHead
          n="06"
          title="Write the prompt that goes with the clay"
          lede="The clay carries structure; the prompt has to say what each upload is for and what must not be inherited from it. Fill in the shot and it assembles the four-layer prompt — including the exclusion block, which is the part people skip and then wonder why the result is grey plastic people in an empty void."
        />
        <BlenderBriefBuilder />
      </section>

      {/* ---------- CTA ---------- */}
      <section className="border-t border-border-soft py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          The clay is half of it. The recipe is the other half.
        </h2>
        <p className="mx-auto mt-3 max-w-[62ch] leading-relaxed text-muted">
          Once the structure is settled, the concept still has to be written —
          look, beats, overlay and sound. That is what the prompt builder and
          the Ad Lab are for.
        </p>
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
