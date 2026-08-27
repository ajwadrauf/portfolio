"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BLOCKS,
  EXAMPLE_SLOTS,
  RULES,
  SYNTAX_NOTE,
  assemble,
  exampleValues,
  tokenFor,
  type BlockId,
  type Slot,
  type SlotMedia,
} from "@/lib/promptBuilder";

const HANDOFF_KEY = "adlab-imported-prompt";
const MEDIA: { id: SlotMedia; label: string }[] = [
  { id: "image", label: "Still" },
  { id: "video", label: "Clip" },
  { id: "audio", label: "Track" },
];

/** Highlights [Image1]-style tokens so the bindings are visible at a glance. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[(?:Image|Video|Audio)\d+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[(?:Image|Video|Audio)\d+\]$/.test(p) ? (
          <span key={i} className="rounded bg-accent/15 px-1 font-semibold text-accent">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function PromptBuilder() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [copied, setCopied] = useState(false);
  const [openWhy, setOpenWhy] = useState<BlockId | null>("register");
  /** The last textarea touched, so a token chip knows where to insert. */
  const focused = useRef<{ id: BlockId; el: HTMLTextAreaElement } | null>(null);

  const prompt = useMemo(() => assemble(values), [values]);
  const filled = BLOCKS.filter((b) => (values[b.id] ?? "").trim()).length;
  /** Tokens the prompt uses but no slot defines — a silent failure otherwise. */
  const dangling = useMemo(() => {
    const defined = new Set(slots.map((_, i) => tokenFor(slots, i)));
    const used = new Set(prompt.match(/\[(?:Image|Video|Audio)\d+\]/g) ?? []);
    return [...used].filter((t) => !defined.has(t));
  }, [prompt, slots]);

  const set = (id: BlockId, v: string) => setValues((p) => ({ ...p, [id]: v }));

  /** Inserts a token at the caret of the last focused field. */
  const insertToken = (token: string) => {
    const f = focused.current;
    if (!f) return;
    const el = f.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
    set(f.id, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const loadExample = () => {
    setValues(exampleValues());
    setSlots(EXAMPLE_SLOTS.map((s) => ({ ...s })));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const sendToAdLab = () => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, prompt);
    } catch {}
    router.push("/ai-studio/ads");
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-[1.75rem] tracking-[-0.03em]">Prompt builder</h1>
      <p className="mt-2 max-w-3xl text-muted">
        A reference-to-video prompt is not a sentence you write, it is a
        structure you fill. Every prompt that works on these models has the
        same nine parts in the same order — and the part almost everyone skips
        is the one that stops the product drifting. Fill it in, or load the
        worked example and take it apart.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={loadExample}>
          Load the worked example
        </button>
        {filled > 0 && (
          <button
            className="text-xs font-semibold text-muted hover:text-foreground"
            onClick={() => {
              setValues({});
              setSlots([]);
            }}
          >
            Clear
          </button>
        )}
        <span className="label-sm ml-auto">
          {filled} of {BLOCKS.length} parts
        </span>
      </div>

      {/* Reference slots — declared first, because the tokens depend on them. */}
      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Your references</h2>
          <span className="label-sm">Numbered per media type</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Declare what you are attaching before you write, because the prompt
          addresses them by number and the numbering runs separately for each
          type. The first clip is{" "}
          <span className="font-mono text-accent">[Video1]</span> even if three
          stills came before it.
        </p>

        <div className="mt-4 space-y-2">
          {slots.map((s, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-[6px] border border-border-soft bg-surface p-2"
            >
              <span className="w-20 shrink-0 font-mono text-xs text-accent">
                {tokenFor(slots, i)}
              </span>
              <select
                className="input !w-auto !py-1 text-xs"
                value={s.media}
                onChange={(e) =>
                  setSlots((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, media: e.target.value as SlotMedia } : x,
                    ),
                  )
                }
              >
                {MEDIA.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                className="input min-w-0 flex-1 basis-48 !py-1 text-xs"
                placeholder="What is this reference for? e.g. product identity, cut rhythm"
                value={s.job}
                onChange={(e) =>
                  setSlots((p) =>
                    p.map((x, j) => (j === i ? { ...x, job: e.target.value } : x)),
                  )
                }
              />
              <button
                className="font-mono text-xs text-danger"
                aria-label={`Remove ${tokenFor(slots, i)}`}
                onClick={() => setSlots((p) => p.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {MEDIA.map((m) => (
            <button
              key={m.id}
              className="btn-secondary !px-3 !py-1.5 text-xs"
              onClick={() => setSlots((p) => [...p, { media: m.id, job: "" }])}
            >
              + Add {m.label.toLowerCase()}
            </button>
          ))}
        </div>

        {slots.length === 0 && (
          <p className="mt-3 text-xs text-muted">
            No references yet. A prompt with none is still valid — it just has
            nothing holding the product still.
          </p>
        )}
      </section>

      {/* The nine parts */}
      <div className="mt-6 space-y-4">
        {BLOCKS.map((b) => {
          const open = openWhy === b.id;
          return (
            <section key={b.id} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-baseline gap-3 font-semibold">
                  <span className="font-mono text-[11px] text-accent">{b.n}</span>
                  {b.label}
                  {b.optional && (
                    <span className="label-sm !normal-case">optional</span>
                  )}
                </h2>
                <button
                  className="text-xs font-semibold text-accent hover:underline"
                  onClick={() => setOpenWhy(open ? null : b.id)}
                >
                  {open ? "Hide why" : "Why this part"}
                </button>
              </div>

              {open && (
                <p className="mt-3 max-w-3xl rounded-[6px] border border-accent/25 bg-accent/[0.04] p-3 text-xs leading-relaxed text-muted">
                  {b.why}
                </p>
              )}

              <textarea
                className="input mt-3 min-h-20 text-sm leading-relaxed"
                placeholder={b.placeholder}
                value={values[b.id] ?? ""}
                onFocus={(e) => {
                  focused.current = { id: b.id, el: e.currentTarget };
                }}
                onChange={(e) => set(b.id, e.target.value)}
              />

              {b.weavesTokens && slots.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="label-sm">Insert:</span>
                  {slots.map((s, i) => (
                    <button
                      key={i}
                      className="rounded border border-border-soft bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-accent transition hover:border-accent"
                      title={s.job || "no job set"}
                      onClick={() => insertToken(tokenFor(slots, i))}
                    >
                      {tokenFor(slots, i)}
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Assembled */}
      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">The prompt</h2>
          <span className="label-sm">
            {prompt.length} characters · {slots.length} references
          </span>
        </div>

        {dangling.length > 0 && (
          <p className="mt-3 rounded-[6px] border border-warning/50 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
            <span className="font-bold">
              {dangling.join(", ")} {dangling.length === 1 ? "is" : "are"} referenced
              but not declared.
            </span>{" "}
            The model resolves tokens positionally against the files you
            actually attach, so a token pointing at nothing fails quietly —
            you get a plausible take built on the wrong reference. Add the
            slot above, or renumber.
          </p>
        )}

        <div className="mt-3 min-h-24 rounded-[6px] border border-border-soft bg-surface-2 p-4 text-sm leading-relaxed">
          {prompt ? (
            <Highlighted text={prompt} />
          ) : (
            <span className="text-muted">
              Fill a part above, or load the worked example.
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={!prompt} onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={!prompt} onClick={sendToAdLab}>
            Send to Ad Lab →
          </button>
        </div>
      </section>

      {/* The rules that are not obvious from the form */}
      <section className="card mt-6 p-5">
        <h2 className="font-semibold">What the form doesn&apos;t tell you</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {RULES.map((r) => (
            <div key={r.h}>
              <h3 className="text-sm font-semibold">{r.h}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{r.p}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[6px] border border-border-soft bg-surface-2 p-4">
          <h3 className="text-sm font-semibold">
            <span className="font-mono text-accent">{SYNTAX_NOTE.playground}</span>{" "}
            in the playground,{" "}
            <span className="font-mono text-accent">{SYNTAX_NOTE.api}</span> through
            the API
          </h3>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
            {SYNTAX_NOTE.detail}
          </p>
        </div>
      </section>
    </div>
  );
}
