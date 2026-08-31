"use client";

import { useMemo, useState } from "react";
import {
  EMPTY_BRIEF,
  EXAMPLE_BRIEF,
  briefIssues,
  composeBlenderPrompt,
  type BlenderBrief,
} from "@/lib/blender";

const ASPECTS = ["1:1", "16:9", "9:16", "4:5", "21:9"];

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
  const [b, setB] = useState<BlenderBrief>(EMPTY_BRIEF);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof BlenderBrief>(k: K, v: BlenderBrief[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  const prompt = useMemo(() => composeBlenderPrompt(b), [b]);
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

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------- the form ---------- */}
      <div className="space-y-5">
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
                  className="input w-16 shrink-0 text-center font-mono text-xs"
                  value={beat.from}
                  aria-label={`Beat ${i + 1} start`}
                  onChange={(e) =>
                    set("beats", b.beats.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))
                  }
                />
                <span className="pt-2 text-xs text-muted">–</span>
                <input
                  className="input w-16 shrink-0 text-center font-mono text-xs"
                  value={beat.to}
                  aria-label={`Beat ${i + 1} end`}
                  onChange={(e) =>
                    set("beats", b.beats.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))
                  }
                />
                <input
                  className="input flex-1"
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
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label">The prompt</span>
          <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <textarea
          readOnly
          value={prompt}
          aria-label="Assembled Seedance prompt"
          className="input mt-3 min-h-[420px] whitespace-pre font-mono text-[11px] leading-[1.7]"
        />

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
            Nothing flagged. The exclusion block is in, every mapped subject has
            a look reference, and the beats fit the shot.
          </p>
        )}
      </div>
    </div>
  );
}
