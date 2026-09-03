"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  EMPTY_BRIEF,
  EXAMPLE_BRIEF,
  briefIssues,
  composeBlenderPrompt,
  uploadPlan,
  type BlenderBrief,
} from "@/lib/blender";

const ASPECTS = ["1:1", "16:9", "9:16", "4:5", "21:9"];

const clean = (s: string) => s.trim();

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block label !text-accent">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

/**
 * Writes the Seedance prompt that goes with a clay pass.
 *
 * The point is not to save typing. It is that the four-layer structure has a
 * required part people leave out — the exclusion block — and leaving it out is
 * why a generation comes back with grey plastic subjects standing in a void.
 * Composing from a form makes that part unskippable, and lets the same source
 * catch the mistakes that only show up after credits are spent: a beat sheet
 * that overruns the shot, two subjects sharing an ID colour, a mapped subject
 * with no look reference to hold it steady between takes.
 */
export function BlenderBriefBuilder() {
  const router = useRouter();
  const [b, setB] = useState<BlenderBrief>(EMPTY_BRIEF);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof BlenderBrief>(k: K, v: BlenderBrief[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  const prompt = useMemo(() => composeBlenderPrompt(b), [b]);
  const plan = useMemo(() => uploadPlan(b), [b]);
  const issues = useMemo(() => briefIssues(b), [b]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the textarea is selectable */
    }
  };

  /**
   * A prompt is worth keeping next to the .blend file it belongs to. Saving it
   * as text also means it can come back into the lab later without being
   * retyped — the lab reads .txt and .md.
   */
  const download = () => {
    const name = `seedance-${clean(b.shotId) || "shot"}.txt`;
    const url = URL.createObjectURL(new Blob([prompt], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Straight into the lab, with the length it was written for. The lab does
   * the sigil conversion on the way in — @Image 1 here, [Image1] there — so
   * the tokens actually resolve against the uploaded files.
   */
  const openInLab = () => {
    try {
      sessionStorage.setItem("adlab-imported-prompt", prompt);
      sessionStorage.setItem("adlab-lane", "blender");
      if (clean(b.seconds)) sessionStorage.setItem("adlab-imported-duration", clean(b.seconds));
    } catch {}
    router.push("/ai-studio/ads");
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------- the form ---------- */}
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label">The shot</span>
          <div className="flex gap-2">
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setB(EXAMPLE_BRIEF)}>
              Load a worked example
            </button>
            <button
              className="text-xs font-semibold text-muted hover:text-foreground"
              onClick={() => setB(EMPTY_BRIEF)}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Shot ID">
            <input className="input" value={b.shotId} onChange={(e) => set("shotId", e.target.value)} />
          </Field>
          <Field label="Aspect">
            <select className="input" value={b.aspect} onChange={(e) => set("aspect", e.target.value)}>
              {ASPECTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Seconds">
            <input
              className="input"
              inputMode="numeric"
              value={b.seconds}
              onChange={(e) => set("seconds", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sensor">
            <input className="input" value={b.sensor} onChange={(e) => set("sensor", e.target.value)} />
          </Field>
          <Field label="Lens (mm)" hint="A real focal length. The model reads perspective from it.">
            <input
              className="input"
              aria-label="Lens in millimetres"
              value={b.lens}
              onChange={(e) => set("lens", e.target.value)}
            />
          </Field>
          <Field label="Rig">
            <input className="input" value={b.rig} onChange={(e) => set("rig", e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key light" hint="Direction and elevation, not a mood.">
            <input className="input" value={b.keyLight} onChange={(e) => set("keyLight", e.target.value)} />
          </Field>
          <Field label="Light character">
            <input
              className="input"
              value={b.lightCharacter}
              onChange={(e) => set("lightCharacter", e.target.value)}
            />
          </Field>
        </div>

        {/* Proxy → subject mapping. This is the part that makes clay work. */}
        <div>
          <div className="flex items-center justify-between">
            <span className="label !text-accent">Proxy mapping</span>
            <button
              className="text-xs font-semibold text-accent hover:underline"
              onClick={() => set("subjects", [...b.subjects, { color: "", proxy: "", becomes: "", ref: "" }])}
            >
              + Add subject
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            One flat ID colour per subject you intend to name in the prompt.
            Everything else stays neutral grey.
          </p>
          <div className="mt-3 space-y-3">
            {b.subjects.map((s, i) => (
              <div key={i} className="rounded-[6px] border border-border-soft bg-surface p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="input"
                    placeholder="ID colour — e.g. orange"
                    value={s.color}
                    onChange={(e) =>
                      set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Proxy — e.g. box on the counter"
                    value={s.proxy}
                    onChange={(e) =>
                      set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, proxy: e.target.value } : x)))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Becomes — e.g. the product package"
                    value={s.becomes}
                    onChange={(e) =>
                      set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, becomes: e.target.value } : x)))
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder="Look ref — e.g. Image 1"
                      value={s.ref}
                      onChange={(e) =>
                        set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)))
                      }
                    />
                    {b.subjects.length > 1 && (
                      <button
                        aria-label="Remove subject"
                        className="shrink-0 px-2 text-sm text-danger hover:opacity-70"
                        onClick={() => set("subjects", b.subjects.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between">
            <span className="label !text-accent">Timeline</span>
            <button
              className="text-xs font-semibold text-accent hover:underline"
              onClick={() =>
                set("beats", [
                  ...b.beats,
                  { from: b.beats[b.beats.length - 1]?.to ?? "0", to: "", action: "" },
                ])
              }
            >
              + Add beat
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Consecutive, non-overlapping. One state change per range, with a
            visible end state.
          </p>
          <div className="mt-3 space-y-2">
            {b.beats.map((beat, i) => (
              <div key={i} className="flex items-start gap-2">
                <input
                  className="input !w-16 shrink-0 text-center font-mono text-xs"
                  value={beat.from}
                  aria-label={`Beat ${i + 1} start`}
                  onChange={(e) =>
                    set("beats", b.beats.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))
                  }
                />
                <span className="pt-2 text-xs text-muted">–</span>
                <input
                  className="input !w-16 shrink-0 text-center font-mono text-xs"
                  value={beat.to}
                  aria-label={`Beat ${i + 1} end`}
                  onChange={(e) =>
                    set("beats", b.beats.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))
                  }
                />
                <input
                  // A flex item keeps min-width:auto, and an input's intrinsic
                  // minimum is wide enough to push the whole page sideways on a
                  // phone. min-w-0 lets it shrink to the row it is in.
                  className="input min-w-0 flex-1"
                  placeholder="What changes, and what the frame looks like when it has"
                  value={beat.action}
                  onChange={(e) =>
                    set("beats", b.beats.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))
                  }
                />
                {b.beats.length > 1 && (
                  <button
                    aria-label={`Remove beat ${i + 1}`}
                    className="shrink-0 px-1 pt-1.5 text-sm text-danger hover:opacity-70"
                    onClick={() => set("beats", b.beats.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <Field label="Creative direction" hint="One sentence: subject, setting, event, style, governing camera idea.">
          <textarea
            className="input min-h-[72px]"
            value={b.creative}
            onChange={(e) => set("creative", e.target.value)}
          />
        </Field>

        {/*
          The physics contract. A clay pass is authored to settle camera,
          staging and timing — the things that are expensive to fix later.
          Granular dynamics are the reverse: painful to simulate in 3D and
          something the video model is already good at. So this is the dial
          that decides which half of the blockout is a specification and which
          half is a placeholder.
        */}
        <Field
          label="The blockout's subject motion"
          hint="Whether the clay pass animates real dynamics, or slides proxies along a path as a stand-in. Getting this wrong is what produces a flat object skating across a frozen surface."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: "resolve" as const,
                  title: "A placeholder — re-solve it",
                  body: "Camera, staging and timing are inherited exactly. The model re-solves how things actually move.",
                },
                {
                  id: "inherit" as const,
                  title: "Animated — inherit it",
                  body: "Subject trajectories come across with the camera. Right when the motion was genuinely animated.",
                },
              ]
            ).map((o) => (
              <button
                key={o.id}
                onClick={() => set("physics", o.id)}
                aria-pressed={b.physics === o.id}
                className={`rounded-[6px] border p-3 text-left transition ${
                  b.physics === o.id
                    ? "border-accent bg-accent/[0.05] ring-1 ring-accent"
                    : "border-border-soft hover:border-accent/50"
                }`}
              >
                <span className="block text-xs font-semibold">{o.title}</span>
                <span className="mt-1 block text-[11px] leading-snug text-muted">{o.body}</span>
              </button>
            ))}
          </div>
        </Field>

        {b.physics === "resolve" && (
          <Field
            label="Loose material in the shot"
            hint="Anything granular or fluid a subject moves through, lands in or rises out of. Naming it writes the physics block — bow wave, furrow, slump-back, and the rule that nothing floats above it."
          >
            <input
              className="input"
              placeholder="chocolate chips, dry sand, fresh snow, coffee beans…"
              value={b.medium}
              onChange={(e) => set("medium", e.target.value)}
            />
          </Field>
        )}

        <Field
          label="Composited after generation"
          hint="Anything with readable type. Generative video garbles it, differently on every frame."
        >
          <input
            className="input"
            placeholder="wordmark, legal line, price"
            value={b.composited}
            onChange={(e) => set("composited", e.target.value)}
          />
        </Field>
      </div>

      {/* ---------- the output ---------- */}
      <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label">The prompt</span>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={download}>
              Save .txt
            </button>
            <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={openInLab}>
              Open in Ad Lab →
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          The lab opens in its Blender lane: no concept, no recipe, just the
          references and the render. It rewrites <code className="font-mono">@Image 1</code>{" "}
          to <code className="font-mono">[Image1]</code> on the way in, which is
          the form the API resolves.
        </p>
        <textarea
          readOnly
          value={prompt}
          aria-label="Assembled Seedance prompt"
          className="input mt-3 min-h-[420px] whitespace-pre font-mono text-[11px] leading-[1.7]"
        />

        {/*
          The upload manifest. Slot numbers in the prompt are only correct if
          the files go in this order, and a colour you can see beats a colour
          you have to remember.
        */}
        {plan.length > 1 && (
          <div className="mt-4 rounded-[6px] border border-border-soft bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="label !text-accent">Upload in this order</span>
              <span className="text-[11px] text-muted">
                Most surfaces number references by upload order
              </span>
            </div>
            <ol className="mt-3 space-y-2">
              {plan.map((r) => (
                <li key={r.slot} className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[11px] text-muted">
                    {r.order}
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-border-strong"
                    style={{
                      background: r.color ?? "transparent",
                      backgroundImage: r.color
                        ? undefined
                        : "repeating-linear-gradient(45deg,var(--border-strong) 0 2px,transparent 2px 4px)",
                    }}
                  />
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-accent">
                      {r.slot}
                    </span>{" "}
                    <span className="text-xs font-semibold">{r.what}</span>
                    {r.colorName && (
                      <span className="text-xs text-muted"> · {r.colorName}</span>
                    )}
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                      {r.role}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {issues.length > 0 ? (
          <div className="mt-4 rounded-[6px] border border-warning/40 bg-warning/10 p-4">
            <p className="label !text-warning">
              {issues.length} thing{issues.length === 1 ? "" : "s"} to fix before you spend credits
            </p>
            <ul className="mt-3 space-y-3">
              {issues.map((it, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  <span className="font-semibold text-foreground">{it.text}</span>{" "}
                  <span className="text-muted">{it.why}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 rounded-[6px] border border-success/40 bg-success/10 p-3 text-xs leading-relaxed text-success">
            Nothing flagged. The exclusion block is in, the ID colours are
            distinct, something is referenced, and the beats fit the shot.
          </p>
        )}
      </div>
    </div>
  );
}
