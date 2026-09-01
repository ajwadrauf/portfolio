import type { Metadata } from "next";
import Link from "next/link";
import {
  WALL,
  WALL_BEATS,
  WALL_BLOCKING,
  WALL_BUILD,
  WALL_COST,
  WALL_IMPOSSIBLE,
  WALL_MEASURED,
} from "@/lib/theWall";

export const metadata: Metadata = {
  title: "The Wall — a clay control pass · AI Content Studio",
  description:
    "A worked Blender clay pass for Seedance 2.5: twelve seconds of untextured geometry that settles every camera decision before a credit is spent — including the moment the brief's final frame turned out to be arithmetically impossible.",
};

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

export default function TheWallPage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* ---------- Hero ---------- */}
      <section className="py-14 sm:py-18">
        <Link
          href="/ai-studio/blender"
          className="label transition hover:text-accent"
        >
          ← Blender → Seedance
        </Link>

        <p className="chip mt-6">{WALL.strap}</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          {WALL.title}
        </h1>
        <p className="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">{WALL.lede}</p>

        <div className="mt-8 overflow-hidden rounded-[6px] border border-border-soft bg-surface-2">
          <video
            src={WALL.clip}
            poster={WALL.poster}
            controls
            muted
            loop
            playsInline
            preload="metadata"
            className="block w-full"
          />
        </div>
        <p className="mt-3 max-w-[68ch] text-xs leading-relaxed text-muted">
          The clay pass itself. Neutral bed, one flat ID colour per mapped
          subject, one light direction, no text anywhere in frame — everything
          the model is meant to read, and nothing it is meant to invent.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WALL_COST.map((c) => (
            <div key={c.k} className="card p-5">
              <p className="text-2xl font-semibold text-accent">
                {c.v}
                {c.unit && <span className="ml-1 text-sm font-medium text-muted">{c.unit}</span>}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{c.k}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 01 The shot ---------- */}
      <section className="py-12">
        <SectionHead
          n="01"
          title="One continuous move, four state changes"
          lede="Each beat ends on a visible state the prompt can name. Consecutive, non-overlapping, one primary change apiece — three actions in a single range produces omissions, not precision."
        />
        <div className="mt-8 space-y-4">
          {WALL_BEATS.map((b) => (
            <div
              key={b.range}
              className="grid gap-5 rounded-[6px] border border-border-soft bg-surface p-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:p-5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.frame}
                alt={b.title}
                loading="lazy"
                className="w-full rounded-[4px] border border-border-soft"
              />
              <div>
                <p className="label-sm">{b.range}</p>
                <h3 className="mt-2 text-lg tracking-[-0.02em]">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 02 The impossible frame ---------- */}
      <section className="py-12">
        <SectionHead n="02" title="What building it found" />
        <div className="mt-8 rounded-[6px] border border-warning/40 bg-warning/[0.06] p-6">
          <h3 className="text-xl tracking-[-0.02em]">{WALL_IMPOSSIBLE.claim}</h3>
          <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-muted">
            {WALL_IMPOSSIBLE.lede}
          </p>

          <dl className="mt-6 max-w-[52ch] space-y-1.5 font-mono text-xs">
            {WALL_IMPOSSIBLE.maths.map((m) => (
              <div
                key={m.l}
                className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border-soft pb-1.5"
              >
                <dt className="text-muted">{m.l}</dt>
                <dd className="font-semibold text-foreground">{m.r}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 max-w-[68ch] text-sm leading-relaxed">{WALL_IMPOSSIBLE.why}</p>
          <p className="mt-4 max-w-[68ch] text-sm leading-relaxed">
            <span className="font-semibold">Resolution.</span> {WALL_IMPOSSIBLE.fix}
          </p>
        </div>
        <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted">
          Worth being plain about why this matters more than the render: the
          fault was in the brief, not the software, and no amount of generating
          would have surfaced it — only a calculation did. Found before the
          build, it costs an afternoon of arithmetic. Found after, it costs
          every take shot against a frame that could never exist.
        </p>
      </section>

      {/* ---------- 03 Verification ---------- */}
      <section className="py-12">
        <SectionHead
          n="03"
          title="Measured off pixels, not off the solver"
          lede={WALL_MEASURED.lede}
        />
        <div className="mt-8 overflow-x-auto rounded-[6px] border border-border-soft">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="p-4 label-sm">Subject</th>
                <th className="p-4 label-sm">Brief, width</th>
                <th className="p-4 label-sm !text-accent">Measured</th>
                <th className="p-4 label-sm">Brief, height</th>
                <th className="p-4 label-sm !text-accent">Measured</th>
                <th className="p-4 label-sm">Read</th>
              </tr>
            </thead>
            <tbody>
              {WALL_MEASURED.rows.map((r) => (
                <tr key={r.subject} className="border-t border-border-soft">
                  <td className="p-4 font-semibold whitespace-nowrap">{r.subject}</td>
                  <td className="p-4 font-mono text-xs text-muted">{r.bw}</td>
                  <td className="p-4 font-mono text-xs font-semibold">{r.mw}</td>
                  <td className="p-4 font-mono text-xs text-muted">{r.bh}</td>
                  <td className="p-4 font-mono text-xs font-semibold">{r.mh}</td>
                  <td className="p-4 text-xs text-muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted">
          {WALL_MEASURED.note}
        </p>
      </section>

      {/* ---------- 04 Blocking ---------- */}
      <section className="py-12">
        <SectionHead
          n="04"
          title="Composition decisions only a built scene can make"
          lede="Each of these is a thing a prompt can ask for and not get twice running."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {WALL_BLOCKING.map((b) => (
            <div key={b.title} className="card p-6">
              <h3 className="text-base font-semibold leading-snug">{b.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 05 The build ---------- */}
      <section className="py-12">
        <SectionHead
          n="05"
          title="The build"
          lede="Roughly 1,500 lines across two files. config.py holds every number and imports nothing from Blender, so the whole shot geometry prints and diffs without launching it."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {WALL_BUILD.map((b) => (
            <div key={b.title} className="rounded-[6px] border border-border-soft bg-surface p-5">
              <span className="chip">{b.file}</span>
              <h3 className="mt-3 text-base font-semibold leading-snug">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Context + CTA ---------- */}
      <section className="border-t border-border-soft py-14">
        <p className="mx-auto max-w-[72ch] text-sm leading-relaxed text-muted">
          {WALL.context}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/ai-studio/blender#builder" className="btn-primary">
            Write a prompt against a clay pass →
          </Link>
          <Link href="/ai-studio/blender" className="btn-secondary">
            The method behind it
          </Link>
        </div>
      </section>
    </div>
  );
}
