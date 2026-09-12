"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type SetStateAction } from "react";
import {
  EMPTY_BRIEF,
  EXAMPLE_BRIEF,
  briefIssues,
  blenderEditMode,
  compactBeatSeconds,
  CAMERA_MOVES,
  getCameraMove,
  composeBlenderBuildBrief,
  composeBlenderPrompt,
  uploadPlan,
  type BlenderBrief,
} from "@/lib/blender";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";
import { useProductionDraft } from "@/components/studio/useProductionDraft";
import { downloadProductionBundle, isBlenderDraft, normalizeBlenderDraft, referenceAsset, veluneBlenderBrief, veluneBlenderReferenceAssets, type BlenderDraft } from "@/lib/productionBrief";
import { normalizeRefTokens } from "@/lib/promptImport";
import { CameraRehearsal } from "./CameraRehearsal";

const EMPTY_DRAFT: BlenderDraft = { version: 1, brief: EMPTY_BRIEF, referenceAssets: {} };

/**
 * Which artifact this instance writes.
 *
 * One shot description, two readers. `build` goes to whatever is driving
 * Blender and says what to construct and how to animate it; `seedance` goes to
 * the video model and says what the finished frame contains. They are
 * generated from the same brief because a blockout and the prompt that
 * consumes it have to agree on duration, beats and ID colours, and two
 * documents kept in agreement by hand do not stay in agreement.
 */
export type BuilderMode = "build" | "seedance";

/*
 * Shapes the builder offers.
 *
 * 4:3 was missing while the worked example used it, so loading the example put
 * the select into a value it could not display — the shot said 4:3 and the
 * control said 1:1. Everything the Ad Lab accepts belongs here.
 */
const ASPECTS = ["1:1", "4:3", "3:4", "16:9", "9:16", "4:5", "21:9"];

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

/** Focused text is editable; a compact display never replaces the exact stored boundary. */
function BeatTimeInput({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  return <input className="input !w-20 shrink-0 text-center font-mono text-xs" aria-label={label} inputMode="decimal"
    value={editing ? text : compactBeatSeconds(value)}
    onFocus={() => { setText(compactBeatSeconds(value)); setEditing(true); }}
    onChange={(event) => { setText(event.target.value); onChange(event.target.value); }}
    onBlur={() => setEditing(false)} />;
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
export function BlenderBriefBuilder({ mode = "seedance" }: { mode?: BuilderMode }) {
  const router = useRouter();
  const build = mode === "build";
  const { project, saveDraft } = useStudioProject();
  const { value: draft, setValue: setDraft, loaded, error: saveError, flush } = useProductionDraft("blender", EMPTY_DRAFT, isBlenderDraft, () => ({ version: 1 as const, brief: veluneBlenderBrief(), referenceAssets: veluneBlenderReferenceAssets() }), normalizeBlenderDraft);
  const b = draft.brief;
  const setB = (next: SetStateAction<BlenderBrief>) => setDraft((prev) => ({ ...prev, brief: typeof next === "function" ? next(prev.brief) : next }));
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof BlenderBrief>(k: K, v: BlenderBrief[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  const prompt = useMemo(
    () => (build ? composeBlenderBuildBrief(b) : composeBlenderPrompt(b)),
    [b, build],
  );
  const plan = useMemo(() => uploadPlan(b), [b]);
  const issues = useMemo(() => briefIssues(b, mode), [b, mode]);

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
    const name = build
      ? `blender-brief-${clean(b.shotId) || "shot"}.md`
      : `seedance-${clean(b.shotId) || "shot"}.txt`;
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
  const assets = project?.assets.filter((asset) => asset.status === "ready" && asset.kind !== "document") ?? [];
  const manifest = plan.map((row) => ({ token: normalizeRefTokens(row.slot).text, job: `${row.what}: ${row.role}`, asset: assets.find((asset) => asset.id === draft.referenceAssets[row.slot] && asset.kind === (row.slot.startsWith("@Video") ? "video" : "image")) }));
  const openInLab = async () => {
    if (busy) return;
    setBusy(true); setActionError("");
    try {
      await flush();
      const { parseAdDraft } = await import("@/lib/adDraft");
      const previous = parseAdDraft(project?.drafts.ad);
      const handoff = parseAdDraft({ ...previous, completedTake: null, productImage: null, endImage: null, imported: true, lane: "blender", schema: "adlab-draft-v1", source: "blender", prompt: composeBlenderPrompt(b), modelId: "seedance-2.5-ref", duration: Number(b.seconds), aspect: b.aspect, references: manifest.filter((row) => row.asset).map((row) => ({ ...referenceAsset(row.asset!), token: row.token, role: row.job })), referenceManifest: manifest.map((row) => ({ token: row.token, job: row.job, assetId: row.asset?.id ?? null })), sceneCards: b.beats.filter((beat) => beat.action.trim()).map((beat, index) => ({ id: `blender-scene-${index + 1}`, title: `Scene ${index + 1}`, start: Number(beat.from), end: Number(beat.to), action: beat.action, camera: `${getCameraMove(b.move)?.label ?? "Custom move"}: ${b.rig}`, sound: "Plan sound in Ad Lab", referenceIds: manifest.filter((row) => row.asset).map((row) => row.asset!.id) })) });
      if (!handoff) throw new Error("Review the prompt length, reference count and scene times before sending. Ad Lab needs valid scenes and at most 20 attached references.");
      await saveDraft("ad", handoff);
      router.push("/ai-studio/ads");
    } catch (error) { setActionError(error instanceof Error ? error.message : "The handoff could not be saved. Your shot remains here; retry or export the production ZIP."); }
    finally { setBusy(false); }
  };
  const downloadBundle = async () => {
    setBusy(true); setActionError("");
    try { await flush(); await downloadProductionBundle({ name: b.shotId, prompt: composeBlenderPrompt(b), buildBrief: composeBlenderBuildBrief(b), draft, cues: b.beats.map((beat) => ({ startSeconds: Number(beat.from), endSeconds: Number(beat.to), startFrame: Math.round(Number(beat.from) * 24), endFrameExclusive: Math.round(Number(beat.to) * 24), action: beat.action })), references: manifest }); }
    catch (error) { setActionError(error instanceof Error ? error.message : "The production ZIP could not be downloaded."); }
    finally { setBusy(false); }
  };
  const continueToPrompt = async () => {
    try { await flush(); router.push("/ai-studio/prompts#clay"); }
    catch { setActionError("The draft could not be saved. Export it or retry before continuing."); }
  };
  if (!loaded) return <p className="py-8 text-muted" role="status">Opening your project’s Blender shot…</p>;

  return (
    <div className="mt-8">
      <p className="mb-4 text-xs text-muted">Saved with {project?.name}. The Blender brief and Seedance prompt share this shot’s camera, mapping and timing.</p>
      {saveError && <p role="alert" className="mb-4 text-sm text-danger">{saveError}</p>}
      {build && <CameraRehearsal key={project?.id} lens={b.lens} duration={b.seconds} move={b.move} onApply={(settings) => setDraft((prev) => ({ ...prev, brief: { ...prev.brief, ...settings, sensor: "36mm full frame" }, referenceAssets: { ...prev.referenceAssets, "@Video 1": "" } }))} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------- the form ---------- */}
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label">The shot</span>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setDraft({ version: 1, brief: EXAMPLE_BRIEF, referenceAssets: {} })}>
              Load a worked example
            </button>
            <label className="btn-secondary !px-3 !py-1.5 text-xs">Import source JSON<input type="file" accept=".json,application/json" className="sr-only" onChange={async (event) => {
              const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
              try { if (file.size > 1024 * 1024) throw new Error("Use a shot source JSON smaller than 1 MB."); const source: unknown = JSON.parse(await file.text()); if (!isBlenderDraft(source)) throw new Error("This is not a Blender shot source. Choose 03_shot_source.json from a Blender production ZIP."); setDraft(normalizeBlenderDraft(source)); setActionError(""); }
              catch (error) { setActionError(error instanceof Error ? error.message : "This source could not be read."); }
            }} /></label>
            <button
              className="text-xs font-semibold text-muted hover:text-foreground"
              onClick={() => setDraft({ version: 1, brief: EMPTY_BRIEF, referenceAssets: {} })}
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
              id="blender-duration"
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
              id="blender-lens"
              aria-label="Lens in millimetres"
              value={b.lens}
              onChange={(e) => set("lens", e.target.value)}
            />
          </Field>
          <Field
            label="Camera move"
            hint={getCameraMove(b.move)?.use}
          >
            <select
              className="input"
              value={b.move}
              onChange={(e) => set("move", e.target.value)}
            >
              {CAMERA_MOVES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <option value="">Something else (describe it below)</option>
            </select>
          </Field>
        </div>

        {/*
          A named move plus a line of detail, rather than one free-text field.
          
          The rig used to be a sentence each brief invented for a move that has
          had a name for eighty years. Naming it means the operator builds a
          known thing, and the video prompt downstream inherits the same words —
          so the blockout and the prompt cannot end up describing two different
          camera moves.
        */}
        <Field
          label={getCameraMove(b.move) ? "Move detail" : "Describe the move"}
          hint={
            getCameraMove(b.move)
              ? `${getCameraMove(b.move)!.rig} Add speed, distance or anything specific to this shot.`
              : "Speed, path and what the camera is doing across the take."
          }
        >
          <input className="input" value={b.rig} onChange={(e) => set("rig", e.target.value)} />
        </Field>

        {/*
          Where the shot opens and where it lands. Only the build brief consumes
          these — it is the camera instruction, and the clay pass exists to
          settle it. In the prompt they would be describing a clip that already
          exists, which is the model's job to read, not the author's to restate.
        */}
        {build && (
          <div id="blender-framing" className="grid scroll-mt-28 gap-4 sm:grid-cols-2">
            <Field label="Opens on" hint="The first frame, as a shot size. It has to be a real composition, not a lead-in.">
              <input
                className="input"
                placeholder="Macro, buried in the bed, three chips filling frame"
                value={b.startFraming}
                onChange={(e) => set("startFraming", e.target.value)}
              />
            </Field>
            <Field label="Ends on" hint="The frame that has to survive. Hold it still for the last half-second.">
              <input
                className="input"
                placeholder="Wide, hero face-on, packs in a row behind"
                value={b.endFraming}
                onChange={(e) => set("endFraming", e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key light" hint="Direction and elevation, not a mood.">
            <input id="blender-light" className="input" value={b.keyLight} onChange={(e) => set("keyLight", e.target.value)} />
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
        <div id="blender-subjects" className="scroll-mt-28">
          <div className="flex items-center justify-between">
            <span className="label !text-accent">Proxy mapping</span>
            <button
              className="-my-2 inline-flex items-center py-2 text-xs font-semibold text-accent hover:underline"
              onClick={() => set("subjects", [...b.subjects, { color: "", proxy: "", becomes: "", ref: "" }])}
            >
              + Add subject
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {build
              ? "One flat ID colour per subject, shaded enough to show its form and contact shadow. Everything else in the scene stays neutral grey. The colour is the mapping, so a second grey erases it."
              : "One flat ID colour per subject you intend to name in the prompt. Everything else stays neutral grey."}
          </p>
          <div className="mt-3 space-y-3">
            {b.subjects.map((s, i) => (
              <div key={i} className="rounded-[6px] border border-border-soft bg-surface p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="input"
                    aria-label={`Subject ${i + 1} ID colour`}
                    placeholder="ID colour + hex, e.g. orange #D94F0A"
                    value={s.color}
                    onChange={(e) =>
                      set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))
                    }
                  />
                  <input
                    className="input"
                    aria-label={`Subject ${i + 1} proxy object`}
                    placeholder="Proxy, e.g. box on the counter"
                    value={s.proxy}
                    onChange={(e) =>
                      set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, proxy: e.target.value } : x)))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="input min-w-0 flex-1"
                      aria-label={`Subject ${i + 1} becomes`}
                      placeholder={
                        build
                          ? "Becomes: what to size and shape it like"
                          : "Becomes, e.g. the product package"
                      }
                      value={s.becomes}
                      onChange={(e) =>
                        set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, becomes: e.target.value } : x)))
                      }
                    />
                    {build && b.subjects.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove subject ${i + 1}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-sm text-danger transition hover:bg-danger/10"
                        onClick={() => set("subjects", b.subjects.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {/*
                    Look references are a generation-time input: they hold a
                    surface steady between takes. Nothing in the clay pass is
                    textured, so asking for one here would be an input the build
                    brief cannot consume — the kind of dead field that teaches
                    people the form is decorative.
                  */}
                  {!build && (
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="input min-w-0 flex-1"
                        aria-label={`Subject ${i + 1} look reference`}
                        placeholder="Look ref, e.g. Image 1"
                        value={s.ref}
                        onChange={(e) =>
                          set("subjects", b.subjects.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)))
                        }
                      />
                      {b.subjects.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove subject ${i + 1}`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-sm text-danger transition hover:bg-danger/10"
                          onClick={() => set("subjects", b.subjects.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div id="blender-timeline" className="scroll-mt-28">
          <div className="flex items-center justify-between">
            <span className="label !text-accent">Timeline</span>
            <button
              className="-my-2 inline-flex items-center py-2 text-xs font-semibold text-accent hover:underline"
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
          <label className="mt-3 block text-xs text-muted">Edit structure
            <select className="input mt-1" aria-label="Edit structure" value={blenderEditMode(b)} onChange={(event) => set("editMode", event.target.value as "continuous" | "cuts")}>
              <option value="continuous">One continuous take</option>
              <option value="cuts">Edited shots with hard cuts</option>
            </select>
          </label>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {blenderEditMode(b) === "cuts" ? "Each row is one shot. Hard cuts land at its boundaries." : "Consecutive, non-overlapping beats in a continuous take."} Seconds are abbreviated for readability; the exact boundaries remain stored. Frame labels use a zero-based 24 fps timeline, with the end frame excluded.
          </p>
          <div className="mt-3 space-y-2">
            {b.beats.map((beat, i) => (
              <div id={`blender-beat-${i}`} key={`${project?.id}-${i}`} className="scroll-mt-28 rounded-[6px] border border-border-soft p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <BeatTimeInput value={beat.from} label={`Beat ${i + 1} start`} onChange={(value) => set("beats", b.beats.map((x, j) => j === i ? { ...x, from: value } : x))} />
                  <span className="text-xs text-muted">–</span>
                  <BeatTimeInput value={beat.to} label={`Beat ${i + 1} end`} onChange={(value) => set("beats", b.beats.map((x, j) => j === i ? { ...x, to: value } : x))} />
                  <span className="text-xs text-muted">s</span>
                  {b.beats.length > 1 && <button type="button" aria-label={`Remove beat ${i + 1}`} className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-sm text-danger transition hover:bg-danger/10" onClick={() => set("beats", b.beats.filter((_, j) => j !== i))}>✕</button>}
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted">{beat.from.trim() && beat.to.trim() && Number.isFinite(Number(beat.from)) && Number.isFinite(Number(beat.to)) ? `f${Math.round(Number(beat.from) * 24)} → f${Math.round(Number(beat.to) * 24)} · ${Math.round(Number(beat.to) * 24) - Math.round(Number(beat.from) * 24)} frames` : "Set both boundaries to see the frame interval"}</p>
                <textarea className="input mt-2 min-h-16 text-sm" aria-label={`Beat ${i + 1} action`} placeholder="What changes, and what the frame looks like when it has" value={beat.action} onChange={(event) => set("beats", b.beats.map((x, j) => j === i ? { ...x, action: event.target.value } : x))} />
              </div>
            ))}
          </div>
        </div>

        <Field
          label={build ? "What the shot is" : "Creative direction"}
          hint={
            build
              ? "One sentence, so whoever builds the scene knows what they are staging. Look and style live in the prompt."
              : "One sentence: subject, setting, event, style, governing camera idea."
          }
        >
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
          label={build ? "Dynamics: simulate or stand in?" : "The blockout's subject motion"}
          hint={
            build
              ? "Decides how much of this shot is worth simulating in 3D, and what the build brief has to declare as a placeholder so the video prompt can override it."
              : "Whether the clay pass animates real dynamics, or slides proxies along a path as a stand-in. Getting this wrong is what produces a flat object skating across a frozen surface."
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: "resolve" as const,
                  title: build ? "Use a stand-in" : "Re-solve the placeholder",
                  body: build
                    ? "Slide proxies along a path to hold the timing. Cheap to build, and the brief flags it so the video prompt re-solves it."
                    : "Camera, staging and timing are inherited exactly. The model re-solves how things actually move.",
                },
                {
                  id: "inherit" as const,
                  title: build ? "Simulate it properly" : "Inherit the animation",
                  body: build
                    ? "Real dynamics in Blender. Slow to build and to art-direct, but the generation can then be told to follow it."
                    : "Subject trajectories come across with the camera. Right when the motion was genuinely animated.",
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
            hint={
              build
                ? "Anything granular or fluid a subject moves through. Naming it tells the build how much to simulate locally, and puts the placeholder declaration in the brief."
                : "Anything granular or fluid a subject moves through, lands in or rises out of. Naming it writes the physics block: bow wave, furrow, slump-back, and the rule that nothing floats above it."
            }
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
          label={build ? "Leave blank for post-production" : "Composited after generation"}
          hint={
            build
              ? "Anything with readable type. Do not model or letter it: it is composited later, and geometry for it here only gives the model something to garble."
              : "Anything with readable type. Generative video garbles it, differently on every frame."
          }
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
          {/*
            Which of the two outputs this builder is producing, and who reads
            it. The same form appears on two pages in two modes, so "The
            prompt" alone left it to the reader to work out which one they had
            in front of them.
          */}
          <span className="chip !border-accent/30 !text-accent">
            {build
              ? "Output: Blender build brief for Claude Code, Cowork or MCP"
              : "Output: Seedance prompt for the Ad Lab"}
          </span>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={download}>
              {build ? "Save .md" : "Save .txt"}
            </button>
            <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => void downloadBundle()}>Production ZIP</button>
            {build && <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => void continueToPrompt()}>Continue this shot →</button>}
            {!build && (
              <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy || !Number.isFinite(Number(b.seconds)) || Number(b.seconds) < 4 || Number(b.seconds) > 30} onClick={() => void openInLab()}>
                Open in Ad Lab →
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {build ? (
            <>
              Hand this to whatever is driving Blender: Claude Code, Cowork or an
              MCP session. It says what to build, how to animate it, and what to
              declare as a placeholder. Pair it with the guide below, which it
              cites by section.
            </>
          ) : (
            <>
              The lab opens in its Blender lane: no concept, no recipe, just the
              references and the render. It rewrites{" "}
              <code className="font-mono">@Image 1</code> to{" "}
              <code className="font-mono">[Image1]</code> on the way in, which is
              the form the API resolves.
            </>
          )}
        </p>
        <textarea
          readOnly
          value={prompt}
          aria-label={build ? "Assembled Blender build brief" : "Assembled Seedance prompt"}
          className="input mt-3 min-h-[420px] whitespace-pre font-mono text-[11px] leading-[1.7]"
        />

        {actionError && <p className="mt-3 text-sm text-danger" role="alert">{actionError}</p>}
        {/*
          The upload manifest. Slot numbers in the prompt are only correct if
          the files go in this order, and a colour you can see beats a colour
          you have to remember.
        */}
        {plan.length > 0 && (
          <div className="mt-4 rounded-[6px] border border-border-soft bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="label !text-accent">Reference board</span>
              <span className="text-[11px] text-muted">
                Ready assets travel with this shot
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
                  <span className="min-w-0 flex-1">
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
                    <select aria-label={`Project asset for ${r.slot}`} value={draft.referenceAssets[r.slot] ?? ""} className="input mt-2 text-xs" onChange={(e) => setDraft((prev) => ({ ...prev, referenceAssets: { ...prev.referenceAssets, [r.slot]: e.target.value } }))}>
                      <option value="">Not attached yet</option>
                      {assets.filter((asset) => asset.kind === (r.slot.startsWith("@Video") ? "video" : "image")).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                    </select>
                    {(() => { const asset = assets.find((item) => item.id === draft.referenceAssets[r.slot]); return asset?.kind === "image" ? <img src={asset.dataUrl ?? asset.url} alt={asset.name} className="mt-2 max-h-28 w-full rounded bg-surface-2 object-contain" /> : asset?.kind === "video" ? <video src={asset.dataUrl ?? asset.url} controls muted playsInline preload="metadata" className="mt-2 max-h-36 w-full rounded bg-surface-2" /> : null; })()}
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
                  {it.field && <a href={`#${it.field}`} className="ml-2 inline-flex min-h-6 items-center font-semibold text-accent underline" onClick={() => { const target = document.getElementById(it.field!); (target?.matches("input,textarea,select") ? target : target?.querySelector<HTMLElement>("input,textarea,select"))?.focus(); }}>Review field →</a>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 rounded-[6px] border border-success/40 bg-success/10 p-3 text-xs leading-relaxed text-success">
            No planning issues flagged. Review the actual clip and attached references before generating; these checks do not verify the finished render.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
