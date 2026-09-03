"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BEAT_ROLES,
  DURATION_BOUNDS,
  EXAMPLE_BEATS,
  EXAMPLE_DURATION,
  EXAMPLE_SLOTS,
  EXAMPLE_THROUGHLINE,
  HEAD_BLOCKS,
  RULES,
  SYNTAX_NOTE,
  TAIL_BLOCKS,
  assemble,
  beatTimes,
  beatsTotal,
  exampleValues,
  mmss,
  timelineIssues,
  tokenFor,
  type Beat,
  type BeatRole,
  type BlockId,
  type BuilderBlock,
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
  /** Which reasoning panel is open — a block id, or the timeline. */
  const [openWhy, setOpenWhy] = useState<string | null>("register");
  const [duration, setDuration] = useState(14);
  const [beats, setBeats] = useState<Beat[]>([]);
  /** The sound that runs under the whole take, not tied to one beat. */
  const [throughline, setThroughline] = useState("");
  /** The last textarea touched, so a token chip knows where to insert. */
  const focused = useRef<
    { kind: "block"; id: BlockId; el: HTMLTextAreaElement }
    | { kind: "beat"; index: number; el: HTMLTextAreaElement }
    | null
  >(null);

  const prompt = useMemo(
    () => assemble(values, beats, duration, throughline),
    [values, beats, duration, throughline],
  );
  const times = useMemo(() => beatTimes(beats), [beats]);
  const total = beatsTotal(beats);
  const written = [...HEAD_BLOCKS, ...TAIL_BLOCKS].filter((b) =>
    (values[b.id] ?? "").trim(),
  ).length;
  const issues = useMemo(
    () => timelineIssues(beats, duration, prompt, slots),
    [beats, duration, prompt, slots],
  );

  const set = (id: BlockId, v: string) => setValues((p) => ({ ...p, [id]: v }));

  /** Inserts a token at the caret of the last focused field. */
  const insertToken = (token: string) => {
    const f = focused.current;
    if (!f) return;
    const el = f.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
    if (f.kind === "beat") setBeat(f.index, { action: next });
    else set(f.id, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const loadExample = () => {
    setValues(exampleValues());
    setSlots(EXAMPLE_SLOTS.map((s) => ({ ...s })));
    setBeats(EXAMPLE_BEATS.map((b) => ({ ...b })));
    setDuration(EXAMPLE_DURATION);
    setThroughline(EXAMPLE_THROUGHLINE);
  };

  const setBeat = (i: number, patch: Partial<Beat>) =>
    setBeats((p) => p.map((b, j) => (j === i ? { ...b, ...patch } : b)));

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
      // The timeline only means anything if the render is the length it was
      // written for, so the duration travels with the prompt.
      sessionStorage.setItem("adlab-imported-duration", String(duration));
    } catch {}
    router.push("/ai-studio/ads");
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-[1.75rem] tracking-[-0.03em]">Prompt builder</h1>
      <p className="mt-2 max-w-3xl text-muted">
        A reference-to-video prompt is not a sentence you write, it is a
        structure you fill. Set the frame, say what each reference is for,
        then spend the seconds deliberately — the two parts people skip are
        the one that stops the product drifting and the one that decides how
        long the payoff gets. Fill it in, or load the worked example and take
        it apart.
      </p>

      {/*
        The escape hatch for the case this page cannot solve. A prompt can
        describe a camera move; it cannot make the same one twice. When that
        is what the shot needs, the answer is upstream in geometry, not in
        better wording here.
      */}
      <Link
        href="/ai-studio/blender"
        className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[6px] border border-accent/30 bg-accent/[0.05] px-4 py-3 text-sm transition hover:border-accent"
      >
        <span className="font-semibold text-accent">
          Need the clay pass first?
        </span>
        <span className="text-muted">
          When the camera move has to be exact and repeatable, block it out in
          3D — the Blender page writes the brief that builds it, and the clip it
          produces becomes [Video1] below.
        </span>
        <span aria-hidden className="font-semibold text-accent">
          →
        </span>
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={loadExample}>
          Load the worked example
        </button>
        {(written > 0 || beats.length > 0) && (
          <button
            className="text-xs font-semibold text-muted hover:text-foreground"
            onClick={() => {
              setValues({});
              setSlots([]);
              setBeats([]);
              setThroughline("");
            }}
          >
            Clear
          </button>
        )}
        <span className="label-sm ml-auto">
          {written} of {HEAD_BLOCKS.length + TAIL_BLOCKS.length} parts ·{" "}
          {beats.length} beat{beats.length === 1 ? "" : "s"}
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

      {/* The parts before the timeline */}
      <div className="mt-6 space-y-4">
        {HEAD_BLOCKS.map((b) => {
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
                  focused.current = { kind: "block", id: b.id, el: e.currentTarget };
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

      {/* ---------------- 05 The timeline ---------------- */}
      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-baseline gap-3 font-semibold">
            <span className="font-mono text-[11px] text-accent">05</span>
            Timeline — how the seconds are spent
          </h2>
          <button
            className="text-xs font-semibold text-accent hover:underline"
            onClick={() => setOpenWhy(openWhy === "timeline" ? null : "timeline")}
          >
            {openWhy === "timeline" ? "Hide why" : "Why this part"}
          </button>
        </div>

        {openWhy === "timeline" && (
          <p className="mt-3 max-w-3xl rounded-[6px] border border-accent/25 bg-accent/[0.04] p-3 text-xs leading-relaxed text-muted">
            <span className="font-bold text-foreground">
              The prompt does not set the duration — the API does.
            </span>{" "}
            Writing &ldquo;14 seconds&rdquo; into a prompt does not make a
            14-second video; the duration parameter does, and if the two
            disagree the model compresses or pads to fill the real length.
            Timestamps are a proportional plan, not a frame-accurate cue sheet:
            models have no clock. What they genuinely buy you is explicit
            ordering and relative weight — and, more usefully, they force the
            arithmetic into the open. Five beats in eight seconds is 1.6
            seconds each, which is too fast to read, and this is the only
            moment noticing that is free.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-3">
            <span className="label">Render length</span>
            <input
              type="range"
              min={DURATION_BOUNDS.min}
              max={DURATION_BOUNDS.max}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-40 accent-[var(--accent)]"
            />
            <span className="font-mono text-xs text-foreground">{duration}s</span>
          </label>
          <span
            className={`label-sm ${
              beats.length && Math.abs(total - duration) > 0.01
                ? "!text-danger"
                : beats.length
                  ? "!text-success"
                  : ""
            }`}
          >
            beats total {total}s
          </span>
        </div>

        {/* Proportional bar — the allocation, seen rather than computed. */}
        {beats.length > 0 && (
          <div className="mt-3 flex h-7 w-full overflow-hidden rounded-[4px] border border-border-soft">
            {beats.map((b, i) => (
              <div
                key={i}
                className={`flex items-center justify-center border-r border-border-soft text-[10px] font-semibold last:border-r-0 ${
                  b.role === "climax"
                    ? "bg-accent/25 text-accent"
                    : "bg-surface-2 text-muted"
                }`}
                style={{ width: `${(b.seconds / Math.max(total, 1)) * 100}%` }}
                title={`${b.role} · ${b.seconds}s`}
              >
                {b.seconds >= 2 ? `${b.seconds}s` : ""}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {beats.map((b, i) => (
            <div key={i} className="rounded-[6px] border border-border-soft bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 shrink-0 font-mono text-[11px] text-accent">
                  {mmss(times[i].start)}–{mmss(times[i].end)}
                </span>
                <select
                  className="input !w-auto !py-1 text-xs"
                  value={b.role}
                  onChange={(e) => setBeat(i, { role: e.target.value as BeatRole })}
                  title={BEAT_ROLES.find((r) => r.id === b.role)?.guidance}
                >
                  {BEAT_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    className="input !w-20 !py-1 text-xs"
                    value={b.seconds}
                    onChange={(e) => setBeat(i, { seconds: Number(e.target.value) })}
                  />
                  <span className="label-sm">sec</span>
                </label>
                <button
                  className="ml-auto font-mono text-xs text-danger"
                  aria-label={`Remove beat ${i + 1}`}
                  onClick={() => setBeats((p) => p.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>

              <textarea
                className="input mt-2 min-h-16 text-sm leading-relaxed"
                placeholder={BEAT_ROLES.find((r) => r.id === b.role)?.guidance}
                value={b.action}
                onFocus={(e) => {
                  focused.current = { kind: "beat", index: i, el: e.currentTarget };
                }}
                onChange={(e) => setBeat(i, { action: e.target.value })}
              />

              <input
                className="input mt-2 !py-1 text-xs"
                placeholder="Effect landing in this beat — timestamped automatically, e.g. a plastic snap for the lid"
                value={b.audio}
                onChange={(e) => setBeat(i, { audio: e.target.value })}
              />

              {slots.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="label-sm">Insert:</span>
                  {slots.map((sl, si) => (
                    <button
                      key={si}
                      className="rounded border border-border-soft bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-accent transition hover:border-accent"
                      title={sl.job || "no job set"}
                      onClick={() => insertToken(tokenFor(slots, si))}
                    >
                      {tokenFor(slots, si)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          className="btn-secondary mt-3 !px-3 !py-1.5 text-xs"
          onClick={() =>
            setBeats((p) => [
              ...p,
              {
                seconds: 3,
                role: p.length === 0 ? "open" : "build",
                action: "",
                audio: "",
              },
            ])
          }
        >
          + Add a beat
        </button>

        <label className="mt-4 block max-w-2xl">
          <span className="mb-1 block label">Sound running under the whole take</span>
          <input
            className="input text-sm"
            placeholder="e.g. rewind reverse-playback whoosh throughout, backwards food movement"
            value={throughline}
            onChange={(e) => setThroughline(e.target.value)}
          />
          <span className="mt-1 block text-xs text-muted">
            Effects tied to a moment go on the beat above and get their
            timestamp automatically. This is the bed of ambience that is
            present the whole time.
          </span>
        </label>
      </section>

      {/* The parts after the timeline */}
      <div className="mt-4 space-y-4">
        {TAIL_BLOCKS.map((b) => {
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
                  focused.current = { kind: "block", id: b.id, el: e.currentTarget };
                }}
                onChange={(e) => set(b.id, e.target.value)}
              />
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

        {/* Everything worth catching before the render is paid for. */}
        {issues.length > 0 && (
          <ul className="mt-3 space-y-2">
            {issues.map((iss, i) => (
              <li
                key={i}
                className={`rounded-[6px] border p-3 text-xs leading-relaxed ${
                  iss.level === "error"
                    ? "border-danger/50 bg-danger/10 text-danger"
                    : "border-warning/50 bg-warning/10 text-warning"
                }`}
              >
                {iss.text}
              </li>
            ))}
          </ul>
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
