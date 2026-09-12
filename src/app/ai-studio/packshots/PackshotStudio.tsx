"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { LiveGate } from "@/components/LiveGate";
import { Why } from "@/components/Why";
import { SpendChip } from "@/components/SpendChip";
import { PackshotActions as CampaignHandoffButton } from "@/components/packshots/PackshotActions";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";
import { FINISH_OPS, type FinishOp } from "@/lib/recraft.client";
import { useHealth } from "@/lib/useHealth";
import { MODELS, estimateCost } from "@/lib/models";
import {
  EMPTY_BRIEF,
  PACKSHOT_MODELS,
  PACK_ANGLES,
  PACK_VARIABLES,
  briefCompleteness,
  gs1FileName,
  isGrounded,
  getCoverage,
  sizeRequestForModel,
  MAX_PACKSHOT_BODY_BYTES,
  resolveSize,
  suggestModel,
  type PackAngle,
  type PackBrief,
} from "@/lib/packshot";
import { VELUNE_PACKAGE_PANELS } from "@/lib/velunePackaging";
import styles from "./PackshotStudio.module.css";

const ArtworkStudio = dynamic(() => import("@/components/packshots/ArtworkStudio").then((m) => m.ArtworkStudio), { loading: () => <p className="p-6 text-muted" role="status">Opening the artwork workspace…</p> });
type Reference = { id: string; name: string; angle: PackAngle; dataUrl: string };
type RunInput = { references: Reference[]; brief: PackBrief; requestedPx?: number; sku: string; lang: string };

/**
 * Marks a field the studio will happily run without.
 *
 * Worth stating on every one of them rather than assuming it reads as
 * implied: the pack brief is six inputs deep and a form that long looks
 * mandatory. Only two things actually gate a run — one reference photo and one
 * target angle — and both carry the opposite tag.
 */
const Optional = () => (
  <span className="font-normal normal-case tracking-normal text-muted/60">optional</span>
);

const Required = () => (
  <span className="font-normal normal-case tracking-normal text-warning/80">required</span>
);


type Job = {
  id: string;
  input: RunInput;
  angle: PackAngle;
  modelId: string;
  role: "primary" | "challenger";
  status: "queued" | "running" | "done" | "failed" | "mock";
  imageDataUrl?: string;
  imageUrl?: string;
  prompt?: string;
  grounded?: boolean;
  error?: string;
  cost: number;
  renderedPx?: number;
  sizeNote?: string;
  reviewedAt?: string;
  /**
   * The result of a finishing pass, kept beside the original rather than
   * replacing it — a cutout you cannot compare against the render it came
   * from is hard to judge, and the original is still the file some workflows
   * want.
   */
  finished?: { op: FinishOp; url: string };
  finishing?: FinishOp;
  finishError?: string;
};

const SPEND_KEY = "studio-session-spend";
const LANGS = ["enfr", "en", "fr"] as const;

/**
 * Per-reference byte ceiling.
 *
 * References ride the route's JSON body, and a serverless request body is
 * capped at 4.5MB. Each image has its own ceiling and the staged set also
 * shares a 4MiB wire budget, including base64 expansion and JSON overhead.
 */
const MAX_REF_BYTES = 600 * 1024;

/** Tried in order, largest first, until one fits the budget. */
const REF_TIERS: { maxSide: number; quality: number }[] = [
  { maxSide: 2048, quality: 0.92 },
  { maxSide: 2048, quality: 0.82 },
  { maxSide: 1536, quality: 0.86 },
  { maxSide: 1536, quality: 0.74 },
  { maxSide: 1024, quality: 0.86 },
  { maxSide: 1024, quality: 0.7 },
];

const dataUrlBytes = (u: string) => Math.ceil((u.length - (u.indexOf(",") + 1)) * 0.75);

/**
 * Downscale a reference as little as the payload budget allows.
 *
 * This used to be a flat 1024px at quality 0.92, which is a poor trade for
 * this particular job: the whole promise of the tool is that label text stays
 * legible through an angle change, and the model can only preserve type it
 * could read in the first place. An ingredient list on a 2kg pouch is a few
 * hundred pixels tall in the original and unreadable once the long edge is
 * 1024. Starting at 2048 and stepping down only when the file is genuinely too
 * big keeps the detail on the packs that need it, without risking a body the
 * route cannot accept.
 */
async function toProcessedDataUrl(file: File, wireBudget = Math.floor(MAX_REF_BYTES * 4 / 3)): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP. Use From artwork for PDF proofs.");
  if (file.size > 30 * 1024 * 1024) throw new Error("Choose an image smaller than 30 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    let last = "";
    for (const tier of REF_TIERS) {
      // Never upscale: a 700px photo stays 700px rather than being blown up
      // into detail it does not have.
      const scale = Math.min(1, tier.maxSide / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale) || tier.maxSide;
      canvas.height = Math.round(img.height * scale) || tier.maxSide;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      last = canvas.toDataURL("image/jpeg", tier.quality);
      if (dataUrlBytes(last) <= MAX_REF_BYTES && last.length <= wireBudget) return last;
    }
    throw new Error("This reference cannot fit without losing too much detail. Remove another image or upload a tighter product crop.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PackshotStudio() {
  const workspace = useStudioProject();
  if (!workspace.ready) return <p className="p-8" role="status">Opening packshots…</p>;
  return <PackshotSession key={workspace.project?.id ?? "session"} />;
}
function PackshotSession() {
  const { project, saveDraft } = useStudioProject();
  const routingHandled = useRef<number | null>(null);
  const [mode, setMode] = useState<"photos" | "artwork">("photos");
  const [artworkOpened, setArtworkOpened] = useState(false);
  const [running, setRunning] = useState(false);
  const runLock = useRef(false);
  const activeJobs = useRef(new Set<string>());
  const uploadLock = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [zoomReference, setZoomReference] = useState<{ name: string; dataUrl: string } | null>(null);
  const zoomDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (zoomReference) zoomDialog.current?.showModal();
  }, [zoomReference]);
  /**
   * Shared with the gate control. This used to derive `live` from keys alone,
   * which reported live on a gated deployment where generation was in fact
   * still returning mocks.
   */
  const { health } = useHealth();
  const [sku, setSku] = useState("");
  const [lang, setLang] = useState<(typeof LANGS)[number]>("enfr");
  const [brief, setBrief] = useState<PackBrief>(EMPTY_BRIEF);
  const [sizePresetId, setSizePresetId] = useState<string | null>(null);
  const [customPx, setCustomPx] = useState<string>("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [uploadAngle, setUploadAngle] = useState<PackAngle>("front");
  const [targets, setTargets] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PACK_ANGLES.map((a) => [a.id, a.id !== "front"])),
  );
  const [modelId, setModelId] = useState<string>("nano-banana-pro");
  const [challengerId, setChallengerId] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sessionSpend, setSessionSpend] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setSessionSpend(Number(localStorage.getItem(SPEND_KEY) ?? 0));
    } catch {}
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "artwork") { setArtworkOpened(true); setMode("artwork"); }
  }, []);
  useEffect(() => {
    const routing = project?.drafts.routing as { kind?: string; modelId?: string; selectedAt?: number; handledAt?: number; scenario?: { imageTier?: number } } | undefined;
    if (routing?.kind !== "image" || !routing.modelId || !PACKSHOT_MODELS.some((m) => m === routing.modelId) || typeof routing.selectedAt !== "number" || routing.handledAt === routing.selectedAt || routingHandled.current === routing.selectedAt) return;
    routingHandled.current = routing.selectedAt;
    setModelId(routing.modelId); setMode("photos");
    const sizes = MODELS[routing.modelId].outputSizes?.presets;
    const tier = Number.isInteger(routing.scenario?.imageTier) ? Math.max(0, routing.scenario!.imageTier!) : 0;
    setSizePresetId(sizes?.[Math.min(tier, sizes.length - 1)]?.id ?? null);
    void saveDraft("routing", { ...routing, handledAt: routing.selectedAt }).catch((e) => setError(e.message));
  }, [project?.drafts.routing, saveDraft]);

  const addSpend = useCallback((amount: number) => {
    setSessionSpend((prev) => {
      const next = Number((prev + amount).toFixed(4));
      try {
        localStorage.setItem(SPEND_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const providedAngles = useMemo(() => references.map((r) => r.angle), [references]);
  const selectedAngles = useMemo(
    () => PACK_ANGLES.filter((a) => targets[a.id]).map((a) => a.id),
    [targets],
  );
  /*
   * Priced against the references actually staged, not against a bare output
   * image. GPT Image 2's edit endpoint bills every reference as high-fidelity
   * input, so a six-reference run costs meaningfully more than its per-image
   * rate — and an estimate that ignores that reads low by exactly the amount
   * the user did not agree to.
   */
  /*
   * Every model in the picker has a different reference ceiling and a
   * different idea of what "resolution" means, so both are derived from the
   * selected model rather than fixed. Where a challenger is set, the binding
   * limit is the stricter of the two — a run that fits the primary and
   * overflows the challenger fails halfway through, having already spent.
   */
  const primary = MODELS[modelId];
  const challenger = challengerId ? MODELS[challengerId] : undefined;
  const sizeSupport = primary.outputSizes;
  const refCap = Math.min(
    primary.maxReferenceImages ?? 16,
    challenger?.maxReferenceImages ?? 16,
  );
  const overCap = references.length > refCap;
  const cappedBy =
    challenger && (challenger.maxReferenceImages ?? 16) < (primary.maxReferenceImages ?? 16)
      ? challenger
      : primary;

  // Reset a preset the newly-chosen model does not publish, rather than
  // sending an id it will not recognise.
  const activePresetId =
    sizeSupport?.presets.some((p) => p.id === sizePresetId)
      ? sizePresetId
      : (sizeSupport?.presets[Math.min(1, sizeSupport.presets.length - 1)]?.id ?? null);
  const customValue = Number(customPx);
  /*
   * Aspect-only models are asked for nothing.
   *
   * `activePresetId` always resolves to something so the control has a
   * selected state, but passing it to a model that takes no size made
   * resolveSize report an adjustment on page load — a warning about a request
   * nobody made. Warn only when the author actually chose.
   */
  const requestedSize =
    sizeSupport?.mode === "aspect" && sizePresetId === null
      ? {}
      : {
          presetId: sizePresetId === "custom" ? undefined : (activePresetId ?? undefined),
          px:
            sizePresetId === "custom" && Number.isFinite(customValue)
              ? customValue
              : undefined,
        };
  const resolved = resolveSize(sizeSupport, requestedSize);

  const { filled, total } = briefCompleteness(brief);
  /*
   * Size is part of the price on two of these models, so it is part of the
   * estimate. Nano Banana Pro steps 1.5x at 2K and 2x at 4K; GPT Image 2 bills
   * by pixel area, which makes a 2048² render four times a 1024² one. Quoting
   * one flat rate per model understated both — the same failure as the video
   * estimate that read $1.57 against a $3.05 invoice.
   */
  const costOpts = {
    referenceImages: references.length,
    sizePresetId: sizePresetId === "custom" ? undefined : (activePresetId ?? undefined),
    sizePx: sizePresetId === "custom" ? resolved.px : undefined,
  };
  const perAngleCost =
    estimateCost(modelId, costOpts) +
    (challengerId ? estimateCost(challengerId, { referenceImages: references.length, ...sizeRequestForModel(challenger?.outputSizes, resolved.px) }) : 0);
  const totalEstimate = selectedAngles.length * perAngleCost;
  const groundedCount = selectedAngles.filter((a) => isGrounded(a, providedAngles)).length;

  const addReference = useCallback(async (files: File[]) => {
    if (uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setError(null);
    const staged = [...references];
    try {
      for (const file of files) {
        if (staged.length >= 16) throw new Error("A reference set can contain up to 16 images. Remove an image before adding another.");
        const remaining = MAX_PACKSHOT_BODY_BYTES - JSON.stringify(staged).length - 24_000;
        const dataUrl = await toProcessedDataUrl(file, Math.min(Math.floor(MAX_REF_BYTES * 4 / 3), remaining));
        staged.push({ id: crypto.randomUUID(), name: file.name, angle: uploadAngle, dataUrl });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image");
    } finally {
      setReferences(staged);
      uploadLock.current = false;
      setUploading(false);
    }
  }, [references, uploadAngle]);

  const useBoxReferences = useCallback(async (images: { angle: PackAngle; dataUrl: string }[]) => {
    if (runLock.current || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    try {
      const staged: Reference[] = [];
      for (const image of images) {
        const blob = await (await fetch(image.dataUrl)).blob();
        const dataUrl = await toProcessedDataUrl(new File([blob], `box-${image.angle}.png`, { type: blob.type }),
          Math.floor((MAX_PACKSHOT_BODY_BYTES - 24_000) / images.length));
        staged.push({ id: crypto.randomUUID(), name: `Box render · ${image.angle}`, angle: image.angle, dataUrl });
      }
      setReferences(staged);
      setMode("photos");
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not prepare the box references."); }
    finally { uploadLock.current = false; setUploading(false); }
  }, []);

  /**
   * Pulls the example in and puts it through the same processing a dropped
   * file gets — resized, flattened, re-encoded — so the example behaves
   * exactly like something you uploaded rather than like a special case that
   * works better than real input.
   */
  const [exampleBusy, setExampleBusy] = useState(false);
  const loadExample = useCallback(async () => {
    if (uploadLock.current || runLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setError(null);
    setExampleBusy(true);
    try {
      const missing = VELUNE_PACKAGE_PANELS.filter((panel) => !references.some((ref) => ref.id === `velune-example-${panel.face}`));
      if (references.length + missing.length > 16) throw new Error(`Make room for ${missing.length} VELUNE references before loading the example.`);
      const added: Reference[] = [];
      for (const panel of missing) {
        const res = await fetch(panel.url);
        if (!res.ok) throw new Error(`The ${panel.face} image could not be opened (${res.status}).`);
        const blob = await res.blob();
        const dataUrl = await toProcessedDataUrl(
          new File([blob], panel.url.split("/").pop()!, { type: blob.type || "image/png" }),
          Math.min(Math.floor(MAX_REF_BYTES * 4 / 3), MAX_PACKSHOT_BODY_BYTES - JSON.stringify([...references, ...added]).length - 24_000),
        );
        added.push({ id: `velune-example-${panel.face}`, name: `VELUNE · ${panel.label}`, angle: panel.face as PackAngle, dataUrl });
      }
      setReferences((prev) => [...prev, ...added.filter((ref) => !prev.some((existing) => existing.id === ref.id))]);
      setUploadAngle("front");
    } catch (e) {
      setError(`Could not load the VELUNE reference set (${e instanceof Error ? e.message : "unknown"}). No partial set was added; your existing references are unchanged.`);
    } finally {
      setExampleBusy(false);
      uploadLock.current = false;
      setUploading(false);
    }
  }, [references]);

  const updateJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch } : j));
  }, []);

  // Every job carries the input snapshot it was priced and submitted with.
  // A late result cannot update a different run with the same angle/model.
  const runOne = useCallback(async (job: Job) => {
    if (activeJobs.current.has(job.id)) return;
    activeJobs.current.add(job.id);
    updateJob(job.id, { status: "running", error: undefined, reviewedAt: undefined });
    try {
      const body = JSON.stringify({
        targetAngle: job.angle, modelId: job.modelId,
        references: job.input.references, brief: job.input.brief,
        ...sizeRequestForModel(MODELS[job.modelId].outputSizes, job.input.requestedPx),
      });
      if (new TextEncoder().encode(body).byteLength > MAX_PACKSHOT_BODY_BYTES) {
        throw new Error("These references exceed the request limit. Remove an image or use a smaller crop before starting a new run.");
      }
      const res = await fetch("/api/packshot", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      if (!json.mock) addSpend(json.cost ?? 0);
      updateJob(job.id, {
        status: json.mock ? "mock" : "done", imageDataUrl: json.imageDataUrl,
        imageUrl: json.imageUrl, prompt: json.prompt, grounded: json.grounded,
        cost: json.mock ? 0 : (json.cost ?? 0), renderedPx: json.renderedPx, sizeNote: json.sizeNote,
      });
    } catch (e) {
      updateJob(job.id, { status: "failed", error: e instanceof Error ? e.message : "Generation failed" });
    } finally { activeJobs.current.delete(job.id); }
  }, [addSpend, updateJob]);

  const runBatch = useCallback(async (queue: Job[]) => {
    const pending = [...queue];
    const worker = async () => {
      for (;;) { const job = pending.shift(); if (!job) return; await runOne(job); }
    };
    try { await Promise.all([worker(), worker()]); }
    finally { runLock.current = false; setRunning(false); }
  }, [runOne]);

  /*
   * Advice about the current setup, not about models in general. It only
   * appears when the pick is actually a poor fit for the angles selected, so
   * it stays worth reading.
   */
  const suggestion = suggestModel({
    modelId,
    targets: selectedAngles,
    provided: providedAngles,
    maxReferenceImages: primary.maxReferenceImages ?? 16,
  });

  /**
   * Run a Recraft finishing pass over a result that already exists.
   *
   * Kept out of the model picker on purpose: these are not another way to
   * generate a packshot, they are what turns one into a usable asset, and they
   * cost a fraction of a render.
   */
  const finish = useCallback(
    async (job: Job, op: FinishOp) => {
      if (job.status === "mock") return;
      const source = job.finished?.url ?? job.imageUrl ?? job.imageDataUrl;
      if (!source) return;
      if (activeJobs.current.has(job.id)) return;
      activeJobs.current.add(job.id);
      updateJob(job.id, { finishing: op, finishError: undefined, reviewedAt: undefined });
      try {
        const res = await fetch("/api/packshot/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op, imageUrl: source }),
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Finishing failed");
        addSpend(json.cost ?? 0);
        updateJob(job.id, {
          finishing: undefined,
          finished: { op, url: json.url },
        });
      } catch (e) {
        updateJob(job.id, {
          finishing: undefined,
          finishError: e instanceof Error ? e.message : "Finishing failed",
        });
      } finally { activeJobs.current.delete(job.id); }
    },
    [addSpend, updateJob],
  );

  const done = jobs.filter((j) => j.imageDataUrl || j.imageUrl);
  const failed = jobs.filter((j) => j.status === "failed");
  const needsQA = done.filter((j) => !j.reviewedAt);

  const retryFailed = useCallback(async (only?: Job) => {
    if (runLock.current || activeJobs.current.size) return;
    const queue = only ? [only] : failed;
    if (!queue.length) return;
    if (health?.live && !window.confirm("Retry submits a new paid generation using the original inputs. If a previous request timed out, check its provider log before paying again. Continue?")) return;
    runLock.current = true;
    setRunning(true);
    await runBatch(queue);
  }, [failed, health?.live, runBatch]);

  /**
   * Save the whole set.
   *
   * A planogram delivery is a set, not seven separate files, and clicking
   * seven links is where the GS1 naming stops being worth having. Sequential
   * with a gap because browsers throttle rapid programmatic downloads and
   * silently drop the ones that arrive too fast.
   */
  const downloadAll = useCallback(async () => {
    for (const j of done) {
      const gs1 = gs1FileName(j.input.sku, j.input.lang, j.angle);
      const name =
        j.role === "challenger" ? gs1.replace(/\.jpg$/, `__${j.modelId}.jpg`) : gs1;
      const a = document.createElement("a");
      a.href = downloadHref(j, name);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 350));
    }
  }, [done, lang, sku]);

  const generate = useCallback(async () => {
    if (runLock.current || uploadLock.current || activeJobs.current.size || uploading || !references.length || !selectedAngles.length || overCap) return;
    const input: RunInput = { references: references.map((r) => ({ ...r })), brief: { ...brief }, requestedPx: resolved.px, sku, lang };
    const runId = crypto.randomUUID();
    const models = [...new Set([modelId, ...(challengerId ? [challengerId] : [])])];
    const runs: Job[] = selectedAngles.flatMap((angle) => models.map((id, index) => ({
      id: `${runId}:${angle}:${id}`, input, angle, modelId: id,
      role: index === 0 ? "primary" as const : "challenger" as const,
      status: "queued" as const, cost: 0,
    })));
    // Validate every body before any member of a paid batch can be submitted.
    if (runs.some((job) => new TextEncoder().encode(JSON.stringify({ targetAngle: job.angle, modelId: job.modelId,
      references: input.references, brief: input.brief,
      ...sizeRequestForModel(MODELS[job.modelId].outputSizes, input.requestedPx) })).byteLength > MAX_PACKSHOT_BODY_BYTES)) {
      setError("This reference set is too large to send. Remove an image or use a tighter crop."); return;
    }
    if (health?.live && !window.confirm(`This will run ${runs.length} live packshot generations at an estimated cost of $${totalEstimate.toFixed(2)}. Proceed?`)) return;
    runLock.current = true;
    setRunning(true);
    setError(null);
    setJobs(runs);
    await runBatch(runs);
  }, [brief, challengerId, health?.live, lang, modelId, overCap, references, resolved.px, runBatch, selectedAngles, sku, totalEstimate, uploading]);

  return (
    <div className={styles.workspace}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>AI Content Studio · Product imagery</p>
        <h1>Packshot Studio</h1>
        <p>Start with the artwork. Or the photograph. Bring the whole package into view.</p>
      </header>
      <div className={styles.utilities}>
        <div className={styles.utilityLeft}><LiveGate />
          <details className={styles.connections}>
            <summary>Connections</summary>
            <div>{[["Gemini", health?.gemini], ["fal.ai", health?.fal], ["Recraft", health?.recraft]].map(([name, connected]) =>
              <span className="chip" key={String(name)}>{name} · {connected ? "key configured" : "not configured"}</span>)}</div>
          </details>
        </div>
        <SpendChip amount={sessionSpend} />
      </div>
      {project?.example === "velune" && <div className="card my-5 p-5"><strong>VELUNE · packaging from the film study</strong><p className="my-2 text-sm text-muted">Load the newer pistachio cover with back, top, bottom, left and right panel references. The live carton uses all six faces. Dimensions remain the proposed concept size.</p><button className="btn-secondary" onClick={() => { setArtworkOpened(true); setMode("artwork"); }}>Explore VELUNE artwork ↗</button></div>}
      <div className={styles.modeGrid} role="group" aria-label="Choose your starting point">
        <button type="button" className={mode === "photos" ? styles.selectedMode : styles.mode} aria-pressed={mode === "photos"} onClick={() => setMode("photos")}>
          <span className={styles.modeEyebrow}>The familiar workflow</span><strong>From product photos</strong>
          <span>Use the photos you have. Create the angles you need.</span><b aria-hidden="true">↗</b>
        </button>
        <button type="button" className={mode === "artwork" ? styles.selectedMode : styles.mode} aria-pressed={mode === "artwork"} onClick={() => { setArtworkOpened(true); setMode("artwork"); }}>
          <span className={styles.modeEyebrow}>New · No generation cost</span><strong>From artwork / dielines</strong>
          <span>Choose a package preset. Place your artwork and preview every face.</span><b aria-hidden="true">↗</b>
        </button>
      </div>
      {error && (
        <div role="alert" className="card mb-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      )}
      {artworkOpened && <div hidden={mode !== "artwork"} className={styles.artwork}><ArtworkStudio onUseAsReferences={useBoxReferences} /></div>}
      <div hidden={mode !== "photos"}>

      {/*
        Intake runs the full width rather than down a 380px rail.
        
        The brief is six fields plus a reference grid plus two model pickers
        and a size control; in a narrow column all of that stacked into a long
        scroll, and the pack variables in particular read as a wall of inputs
        rather than as six related facts about one object. Across the page they
        sit two and three abreast, and the whole intake is visible at once —
        which is what makes it obvious that most of it is blank.
      */}
      <div className={styles.photoGrid}>
        <fieldset className="contents" disabled={running || uploading}>
          <div className={styles.stage}>
            <div className={styles.stageHeading}>
              <h2 className="font-semibold">1 · Bring your references</h2>
              <span className="label"><Required /></span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Add photos of the same product. Label each view so the coverage stays clear.
            </p>

            {/*
              Model-specific, and next to the upload control rather than beside
              the model picker.
              
              This is where the decision gets made — how many photos to go and
              find, and which ones. The ceilings differ by an order of
              magnitude across this list and so does the right way to spend
              them, so a single generic "add every face you have" was good
              advice for two of the six models and wrong for the rest.
            */}
            <details open={overCap || undefined}
              className={`mt-3 rounded-[6px] border p-3 ${
                overCap
                  ? "border-danger/40 bg-danger/10"
                  : "border-accent/30 bg-accent/[0.04]"
              }`}
            >
              <summary className="cursor-pointer text-sm"><strong>{references.length} / {refCap} references</strong><span className="ml-2 text-muted">{cappedBy.label.split(" (")[0]} · input guidance</span></summary>
              {overCap ? (
                <p className="mt-1.5 text-xs leading-relaxed">
                  <span className="font-bold text-danger">Too many references.</span>{" "}
                  {cappedBy.label} accepts {refCap}. Remove{" "}
                  {references.length - refCap} before running, or pick a model
                  with a higher ceiling — the run is refused rather than
                  silently dropping the extras, because a dropped face turns a
                  grounded angle into a reconstruction without saying so.
                </p>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">
                    Supports {refCap} reference{refCap === 1 ? "" : "s"}.
                  </span>{" "}
                  {cappedBy.referenceGuidance}
                </p>
              )}
              {challenger &&
                (challenger.maxReferenceImages ?? 16) !==
                  (primary.maxReferenceImages ?? 16) && (
                  <p className="mt-2 border-t border-border-soft pt-2 text-[11px] leading-relaxed text-muted">
                    The A/B is held to the stricter of the two —{" "}
                    {primary.label.split(" (")[0]} takes{" "}
                    {primary.maxReferenceImages}, {challenger.label.split(" (")[0]}{" "}
                    takes {challenger.maxReferenceImages}.
                  </p>
                )}
            </details>

            {/*
              The dropdown selects which angle the photo you are about to add
              shows. Unlabelled it read as a filter on what is already there,
              which is close to the opposite.
            */}
            <label htmlFor="packshot-upload-angle" className="label-sm mt-4 block">
              Angle this photo shows
            </label>
            <div className="mt-1.5 flex gap-2">
              <select
                id="packshot-upload-angle"
                className="input flex-1"
                value={uploadAngle}
                onChange={(e) => setUploadAngle(e.target.value as PackAngle)}
              >
                {PACK_ANGLES.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
              <button className="btn-secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? "Adding…" : "Add photos"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) void addReference(files);
                  e.target.value = "";
                }}
              />
            </div>

            {/*
              Sits under the upload row rather than beside it: adding your own
              photo is the primary action, and the example is the way in for
              someone who arrived without one.
            */}
            <button
              className="mt-2.5 text-xs font-semibold text-accent hover:underline disabled:opacity-50"
              onClick={() => void loadExample()}
              disabled={exampleBusy}
            >
              {exampleBusy ? "Loading the example…" : "or load the VELUNE pack · 6 views →"}
            </button>

            {references.length > 0 && <div className={styles.referenceGrid}>
              {references.map((r) => <div key={r.id} className={styles.reference}>
                <button className={styles.referenceImage} onClick={() => setZoomReference(r)} aria-label={`Enlarge ${r.name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}<img src={r.dataUrl} alt={r.name} />
                  <span>View larger ↗</span>
                </button>
                <p title={r.name}>{r.name}</p>
                <select className="input" aria-label={`View shown by ${r.name}`} value={r.angle} onChange={(e) => setReferences((prev) => prev.map((x) => x.id === r.id ? { ...x, angle: e.target.value as PackAngle } : x))}>
                  {PACK_ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <button className={styles.remove} aria-label={`Remove ${r.name}`} onClick={() => setReferences((prev) => prev.filter((x) => x.id !== r.id))}>Remove</button>
              </div>)}
            </div>}
          </div>

          <details className={styles.optionalPanel}>
            <summary>Product details <span>SKU and language · optional</span></summary>
            <label className="mt-3 block">
              <span className="mb-1 flex items-baseline justify-between gap-2 label">
                <span>SKU / GTIN</span>
                <Optional />
              </span>
              <input
                className="input"
                placeholder="6565170002"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
              <span className="mt-1 block text-[11px] leading-[1.5] text-muted/80">
                Names downloads by SKU, language and angle. Left blank they are
                named SKU_… and can be renamed later.
              </span>
            </label>
            <label className="mt-3 block">
              <span className="mb-1 flex items-baseline justify-between gap-2 label">
                <span>Language code</span>
                <Optional />
              </span>
              <select
                className="input"
                value={lang}
                onChange={(e) => setLang(e.target.value as (typeof LANGS)[number])}
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </details>

          <details className={styles.optionalPanel}>
            <summary>Package details <span>{filled}/{total} provided · optional</span></summary>
            <p className="mt-3 text-sm text-muted">Add the shape, material and dimensions when your photos do not show the whole package.</p>

            {/*
              Three abreast on a wide screen. The reason each field exists is
              worth reading once and then never again, so it shows under an
              empty field and gets out of the way as soon as it is answered.
            */}
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {PACK_VARIABLES.map((v) => (
                <label key={v.id} className="block" title={v.why}>
                  <span className="mb-1 flex items-baseline justify-between gap-2 label">
                    <span>{v.label}</span>
                    <Optional />
                  </span>
                  <input
                    className="input"
                    list={v.options ? `pack-${v.id}` : undefined}
                    placeholder={v.placeholder}
                    value={brief[v.id]}
                    onChange={(e) => setBrief((b) => ({ ...b, [v.id]: e.target.value }))}
                  />
                  {v.options && (
                    <datalist id={`pack-${v.id}`}>
                      {v.options.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  )}
                  <span className="mt-1 block text-xs text-muted"><Why title={v.label}>{v.why}</Why></span>
                </label>
              ))}

              <label className="block sm:col-span-2 xl:col-span-3">
                <span className="mb-1 flex items-baseline justify-between gap-2 label">
                  <span>Anything else</span>
                  <Optional />
                </span>
                <input
                  className="input"
                  placeholder="e.g. the window panel is on the front only, or the cap is a different plastic"
                  value={brief.notes}
                  onChange={(e) => setBrief((b) => ({ ...b, notes: e.target.value }))}
                />
              </label>
            </div>

          </details>

          <div className={styles.stage}>
            <div className={styles.stageHeading}><h2>2 · Choose your finish</h2><span>Model and output size</span></div>
            <label className="mt-3 block">
              <span className="mb-1 block label">
                Primary
              </span>
              <select
                className="input"
                value={modelId}
                onChange={(e) => {
                setModelId(e.target.value);
                if (challengerId === e.target.value) setChallengerId("");
                // A size chosen for one model means nothing on the next.
                setSizePresetId(null);
                setCustomPx("");
              }}
              >
                {PACKSHOT_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODELS[m].label} —{" "}
                    {(MODELS[m].outputSizes?.presets ?? []).some(
                      (x) => (x.costMultiplier ?? 1) !== 1,
                    )
                      ? `from $${MODELS[m].unitCost}/img`
                      : `$${MODELS[m].unitCost}/img`}
                    {MODELS[m].refImageCost
                      ? ` + $${MODELS[m].refImageCost} per reference`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <details className={styles.comparison}><summary>Compare a second model <span>optional</span></summary>
            <label className="mt-3 block">
              <span className="mb-1 block label">
                Challenger (A/B, optional)
              </span>
              <select
                className="input"
                value={challengerId}
                onChange={(e) => setChallengerId(e.target.value)}
              >
                <option value="">Off — primary only</option>
                {PACKSHOT_MODELS.filter((m) => m !== modelId).map((m) => (
                  <option key={m} value={m}>
                    {MODELS[m].label} —{" "}
                    {(MODELS[m].outputSizes?.presets ?? []).some(
                      (x) => (x.costMultiplier ?? 1) !== 1,
                    )
                      ? `from $${MODELS[m].unitCost}/img`
                      : `$${MODELS[m].unitCost}/img`}
                    {MODELS[m].refImageCost
                      ? ` + $${MODELS[m].refImageCost} per reference`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            </details>
            {suggestion && (
              <div
                className={`mt-3 rounded-[6px] border p-3 ${
                  suggestion.severity === "warn"
                    ? "border-warning/40 bg-warning/10"
                    : "border-accent/30 bg-accent/[0.04]"
                }`}
              >
                <p className="text-xs leading-relaxed">
                  <span
                    className={`font-bold ${suggestion.severity === "warn" ? "text-warning" : "text-accent"}`}
                  >
                    {suggestion.severity === "warn"
                      ? "Wrong tool for this run."
                      : "Cheaper route available."}
                  </span>{" "}
                  {suggestion.text}
                </p>
                {suggestion.suggest && PACKSHOT_MODELS.includes(suggestion.suggest) && (
                  <button
                    className="mt-2 text-xs font-semibold text-accent hover:underline"
                    onClick={() => {
                      setModelId(suggestion.suggest!);
                      if (challengerId === suggestion.suggest) setChallengerId("");
                      setSizePresetId(null);
                      setCustomPx("");
                    }}
                  >
                    Switch to {MODELS[suggestion.suggest].label.split(" (")[0]} →
                  </button>
                )}
              </div>
            )}

            <details className={styles.modelHelp}><summary>Which model should I use?</summary>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              <span className="font-semibold text-foreground">Picking one:</span>{" "}
              Nano Banana Pro holds label text best and reads the most
              references, so it is the default for angles you have to
              reconstruct. GPT Image 2 follows a written brief most literally.
              Seedream is the value benchmark and the only one where 4K is free.
              Recraft&apos;s two tiers restage a single photo rather than
              synthesising an angle — draft on Utility, finish on Utility Pro.
              With a challenger set, every angle runs on both models side by
              side: the bake-off that should decide your default.
            </p>


            </details>

            {/* Output size, per model. */}
            {sizeSupport && (
              <div className="mt-4 border-t border-border-soft pt-4">
                <span className="label">Output size</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizeSupport.presets.map((preset) => {
                    const active =
                      sizePresetId !== "custom" && activePresetId === preset.id;
                    // Priced per tier, on the button, because on two of these
                    // models the tier is most of the decision.
                    const each = estimateCost(modelId, {
                      referenceImages: references.length,
                      sizePresetId: preset.id,
                    });
                    return (
                      <button
                        key={preset.id}
                        title={preset.note}
                        onClick={() => setSizePresetId(preset.id)}
                        className={`rounded-[6px] border px-3 py-1.5 text-left text-xs font-semibold transition ${
                          active
                            ? "border-accent bg-accent/[0.05] text-accent"
                            : "border-border-soft bg-surface hover:border-accent/40"
                        }`}
                      >
                        {preset.label}
                        <span
                          className={`ml-2 font-mono font-normal ${active ? "text-accent/80" : "text-muted"}`}
                        >
                          ${each.toFixed(3)}
                        </span>
                      </button>
                    );
                  })}
                  {sizeSupport.custom && (
                    <button
                      onClick={() => setSizePresetId("custom")}
                      className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                        sizePresetId === "custom"
                          ? "border-accent bg-accent/[0.05] text-accent"
                          : "border-border-soft bg-surface hover:border-accent/40"
                      }`}
                    >
                      Custom
                    </button>
                  )}
                </div>

                {sizePresetId === "custom" && sizeSupport.custom && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="input !w-28"
                      inputMode="numeric"
                      aria-label="Custom size in pixels"
                      placeholder={String(sizeSupport.custom.min)}
                      value={customPx}
                      onChange={(e) => setCustomPx(e.target.value)}
                    />
                    <span className="text-xs text-muted">
                      px square · {sizeSupport.custom.min}–{sizeSupport.custom.max},
                      in steps of {sizeSupport.custom.multipleOf}
                      {resolved.px && (
                        <>
                          {" · "}
                          <span className="font-mono text-foreground">
                            ${estimateCost(modelId, costOpts).toFixed(3)}
                          </span>{" "}
                          per angle
                        </>
                      )}
                    </span>
                  </div>
                )}

                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {sizeSupport.note}
                </p>
                {sizeSupport.presets.length > 1 &&
                  sizeSupport.presets.every((x) => (x.costMultiplier ?? 1) === 1) && (
                    <p className="mt-1.5 text-xs leading-relaxed text-success">
                      Size does not change the price on this model — take the
                      largest tier that renders.
                    </p>
                  )}
                {resolved.note && (
                  <p className="mt-2 rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed">
                    <span className="font-bold text-warning">Adjusted.</span>{" "}
                    {resolved.note}
                  </p>
                )}
                {challenger?.outputSizes &&
                  challenger.outputSizes.mode !== sizeSupport.mode && (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-foreground">
                        The challenger sizes differently.
                      </span>{" "}
                      {challenger.label}: {challenger.outputSizes.note} A/B
                      results will not be pixel-matched.
                    </p>
                  )}
              </div>
            )}
          </div>
        </fieldset>

        {/* targets + results, full width beneath the intake */}
        <div className="lg:col-span-12">
          <div className={styles.stage}>
            <div className={styles.stageHeading}>
              <h2 className="font-semibold">3 · Choose your angles</h2>
              <span className="label"><Required /></span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PACK_ANGLES.map((a) => {
                const coverage = getCoverage(a.id, providedAngles);
                const grounded = coverage.status === "full";
                return (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-[6px] border border-border-soft bg-surface px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={targets[a.id]}
                        onChange={(e) =>
                          setTargets((prev) => ({ ...prev, [a.id]: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span className="text-sm font-medium">{a.label}</span>
                    </span>
                    <span
                      className={`chip ${grounded ? "border-success/40 text-success" : "border-warning/40 text-warning"}`}
                    >
                      {grounded ? "Faces supplied" : coverage.status === "partial" ? "Partly supplied" : "Inferred"}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">Coverage describes your inputs. Review every generated label before delivery, including views with supplied references.</p>
            <div className={styles.receipt}>
              <div className="text-sm text-muted">
                {selectedAngles.length} angle{selectedAngles.length === 1 ? "" : "s"} ·{" "}
                {groundedCount} with all visible faces supplied ·{" "}
                <span className="font-bold text-accent">~${totalEstimate.toFixed(2)}</span>
                {health && !health.live && (
                  <span className="ml-2 text-xs text-warning">(demo mode — $0)</span>
                )}
              </div>
              <button
                className="btn-primary"
                disabled={running || uploading || jobs.some((j) => !!j.finishing) || references.length === 0 || selectedAngles.length === 0 || overCap}
                onClick={() => void generate()}
              >
                {running ? "Generating packshots…" : "Generate packshots →"}
              </button>
            </div>
            {references.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                Add at least one reference photo to enable generation.
              </p>
            )}
          </div>

          {jobs.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-5">
              <div className="text-sm">
                <span className="label">Results</span>
                <span className="ml-3 text-muted">
                  {done.length} of {jobs.length} done
                  {failed.length > 0 && (
                    <span className="text-danger"> · {failed.length} failed</span>
                  )}
                  {needsQA.length > 0 && (
                    <span className="text-warning">
                      {" "}
                      · {needsQA.length} needing label QA
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {failed.length > 0 && (
                  <button
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    disabled={running}
                    onClick={() => void retryFailed()}
                  >
                    Retry {failed.length} failed
                  </button>
                )}
                {done.length > 1 && (
                  <button
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => void downloadAll()}
                  >
                    Download all {done.length}
                  </button>
                )}
              </div>
            </div>
          )}

          {jobs.length > 0 && (
            <div
              /*
                Wider now that results are not sharing the row with a rail.
                With a challenger set the column count stays even, so each
                angle's two renders land side by side rather than wrapping
                apart — comparing them is the entire point of the A/B.
              */
              className={`mt-6 grid gap-4 ${
                jobs.some((j) => j.role === "challenger")
                  ? "sm:grid-cols-2 xl:grid-cols-4"
                  : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              }`}
            >
              {jobs.map((j) => (
                <PackshotCard
                  key={j.id}
                  job={j}
                  sku={j.input.sku}
                  lang={j.input.lang}
                  onRetry={running ? undefined : () => void retryFailed(j)}
                  onReview={(reviewed) => updateJob(j.id, { reviewedAt: reviewed ? new Date().toISOString() : undefined })}
                  onInspect={(name, dataUrl) => setZoomReference({ name, dataUrl })}
                  onFinish={(op) => void finish(j, op)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
      {zoomReference && <dialog ref={zoomDialog} className={styles.zoomDialog} aria-labelledby="reference-zoom-title" onCancel={() => setZoomReference(null)} onClose={() => setZoomReference(null)}>
        <div><h2 id="reference-zoom-title">{zoomReference.name}</h2><button autoFocus className="btn-secondary" onClick={() => setZoomReference(null)}>Close</button></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={zoomReference.dataUrl} alt={zoomReference.name} />
      </dialog>}
    </div>
  );
}

/**
 * Where the Download link points.
 *
 * A data URL saves directly. A hosted one goes through our own origin, because
 * the `download` attribute is ignored cross-origin — without the proxy the
 * browser navigates to the image and the GS1 filename is lost, which on a
 * planogram asset is the part that matters.
 */
function downloadHref(job: Job, fileName: string): string {
  if (job.imageDataUrl) return job.imageDataUrl;
  return `/api/packshot-file?url=${encodeURIComponent(job.imageUrl ?? "")}&name=${encodeURIComponent(fileName)}`;
}

function PackshotCard({
  job,
  sku,
  lang,
  onRetry,
  onFinish,
  onReview,
  onInspect,
}: {
  job: Job;
  sku: string;
  lang: string;
  onRetry?: () => void;
  onFinish?: (op: FinishOp) => void;
  onReview?: (reviewed: boolean) => void;
  onInspect: (name: string, dataUrl: string) => void;
}) {
  const spec = PACK_ANGLES.find((a) => a.id === job.angle)!;
  const model = MODELS[job.modelId];
  const [showPrompt, setShowPrompt] = useState(false);
  const [campaignVariant, setCampaignVariant] = useState<"original" | "finished" | null>(null);
  const gs1 = gs1FileName(sku, lang, job.angle);
  const fileName =
    job.role === "challenger" ? gs1.replace(/\.jpg$/, `__${job.modelId}.jpg`) : gs1;
  const media = job.imageDataUrl ?? job.imageUrl;
  const useFinished = !!job.finished && campaignVariant !== "original";
  const campaignImage = useFinished ? job.finished!.url : media;
  const variantLabel = useFinished
    ? (job.finished!.op === "cutout" ? "Background removed" : "Crisp upscale")
    : "Original generated image";

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-square w-full bg-surface-2">
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          /*
            Contain, not cover.
            
            Not every model returns a square: Flash Image picks its own pixel
            count, and cover silently crops the product out of
            the preview. On a planogram asset that is the worst kind of
            wrong — the thumbnail looks fine, so the crop is only discovered
            after the file is in someone's hands.
          */
          <img
            src={media}
            alt={spec.label}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
            {job.status === "failed" ? (
              <p className="max-w-[80%] text-center text-danger">{job.error}</p>
            ) : (
              <>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
                <p>{job.status === "queued" ? "Queued" : "Generating…"}</p>
              </>
            )}
          </div>
        )}
        {job.status === "mock" && (
          <span className="absolute left-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
            DEMO
          </span>
        )}
        {media && !job.reviewedAt && (
          <span className="absolute right-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
            LABEL REVIEW
          </span>
        )}
      </div>
      {job.finished && (
        /*
          Transparency is invisible against any solid colour, so the cutout
          sits on a checkerboard. Without it a successful background removal
          and a failed one look identical on a white card.
        */
        <div className="border-t border-border-soft bg-[length:16px_16px] bg-[linear-gradient(45deg,rgba(128,128,128,0.18)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.18)_75%),linear-gradient(45deg,rgba(128,128,128,0.18)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.18)_75%)] bg-[position:0_0,8px_8px]">
          <div className="relative aspect-square w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.finished.url}
              alt={`${spec.label}, ${FINISH_OPS[job.finished.op].label.toLowerCase()}`}
              className="absolute inset-0 h-full w-full object-contain"
            />
            <span className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-background">
              {FINISH_OPS[job.finished.op].label.toUpperCase()}
            </span>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{spec.label}</p>
          <span className="flex items-center gap-1">
            {job.role === "challenger" && (
              <span className="chip border-accent/40 text-accent">challenger</span>
            )}
            {job.cost > 0 && <span className="chip">${job.cost.toFixed(2)}</span>}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{model.label}{job.renderedPx ? ` · ${job.renderedPx}px` : ""}</p>
        {job.sizeNote && <p className="mt-1 text-xs text-warning">{job.sizeNote}</p>}
        {media && <details className="mt-3 rounded border border-border-soft p-2">
          <summary className="cursor-pointer text-xs font-semibold text-accent">Compare with source images</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">{job.input.references.map((ref) => <button key={ref.id} type="button" onClick={() => onInspect(ref.name, ref.dataUrl)} aria-label={`Open source ${ref.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}<img className="aspect-square w-full object-contain bg-white" src={ref.dataUrl} alt={ref.name} />
            <span className="block truncate text-[11px]">{ref.name}</span>
          </button>)}</div>
          <button className="mt-2 block min-h-8 text-xs font-semibold text-accent" onClick={() => onInspect(`${spec.label} · ${model.label}`, media)}>Open result at full size ↗</button>
          <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={!!job.reviewedAt} disabled={job.status === "mock" || !!job.finishing} onChange={(e) => onReview?.(e.target.checked)} />I reviewed the label, geometry and visible faces against the sources.</label>
          {job.status === "mock" && <p className="mt-1 text-xs text-muted">Demo placeholders cannot be marked reviewed.</p>}
        </details>}
        <p className="mt-1 break-all font-mono text-[11px] text-muted">{fileName}</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {media && (
            <a
              href={downloadHref(job, fileName)}
              download={fileName}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Download{job.finished ? " original" : ""}
            </a>
          )}
          {job.finished && (
            <a
              href={`/api/packshot-file?url=${encodeURIComponent(job.finished.url)}&name=${encodeURIComponent(fileName.replace(/\.jpg$/, `_${job.finished.op}`))}`}
              download
              className="text-xs font-semibold text-accent hover:underline"
            >
              Download {FINISH_OPS[job.finished.op].label.toLowerCase()}
            </a>
          )}
          {job.status === "failed" && onRetry && (
            <button
              className="text-xs font-semibold text-accent hover:underline"
              onClick={onRetry}
            >
              Retry this angle
            </button>
          )}
          {job.prompt && (
            <button
              className="text-xs font-semibold text-muted hover:text-foreground"
              onClick={() => setShowPrompt((v) => !v)}
            >
              {showPrompt ? "Hide prompt" : "View prompt"}
            </button>
          )}
        </div>

        {job.status === "done" && campaignImage && !job.finishing && (
          <div className="mt-4 border-t border-border-soft pt-4">
            {job.finished && <label className="mb-3 block text-xs font-semibold">Campaign image
              <select className="mt-1 block w-full rounded border border-border-soft bg-background px-3 py-2 text-sm font-normal" value={useFinished ? "finished" : "original"} onChange={(event) => setCampaignVariant(event.target.value as "original" | "finished")}>
                <option value="finished">{job.finished.op === "cutout" ? "Background removed" : "Crisp upscale"}</option>
                <option value="original">Original generated image</option>
              </select>
            </label>}
            <CampaignHandoffButton source={campaignImage} meta={{
              name: `${sku || "Packshot"} · ${spec.label}`,
              angle: job.angle,
              source: "generated",
              variant: variantLabel,
              model: model.label,
              review: job.reviewedAt ? "reviewed" : "needs-review",
              ...(job.reviewedAt ? { reviewedAt: job.reviewedAt } : {}),
            }} />
          </div>
        )}

        {/*
          Finishing.
          
          Only offered once there is something to finish, and each action
          carries the case for itself — these are the two steps most likely to
          be skipped precisely because nobody explains why they matter.
        */}
        {media && onFinish && job.status !== "mock" && (
          <div className="mt-3 border-t border-border-soft pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {(Object.values(FINISH_OPS) as (typeof FINISH_OPS)[FinishOp][]).map((op) => {
                const isCurrent = job.finished?.op === op.id;
                const busy = job.finishing === op.id;
                return (
                  <span key={op.id} className="inline-flex items-center gap-1.5">
                    <button
                      disabled={!!job.finishing || isCurrent}
                      onClick={() => onFinish(op.id)}
                      className="text-xs font-semibold text-accent hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
                    >
                      {busy
                        ? `${op.label}…`
                        : isCurrent
                          ? `${op.label} ✓`
                          : `${op.label} · $${op.cost}`}
                    </button>
                    <Why title={op.label} align="right">
                      {op.why}
                    </Why>
                  </span>
                );
              })}
            </div>
            {job.finishError && (
              <p className="mt-2 text-[11px] leading-relaxed text-danger">
                {job.finishError}
              </p>
            )}
          </div>
        )}
        {showPrompt && job.prompt && (
          <p className="mt-2 rounded-[6px] bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted">
            {job.prompt}
          </p>
        )}
      </div>
    </div>
  );
}
