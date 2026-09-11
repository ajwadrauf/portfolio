"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveGate } from "@/components/LiveGate";
import { SpendChip } from "@/components/SpendChip";
import { useHealth, type Health } from "@/lib/useHealth";
import { DELIVERABLES, type DeliverableSpec } from "@/lib/deliverables";
import { MODELS, estimateCost } from "@/lib/models";
import { loadCampaignHandoff, validCampaignHandoffId, type CampaignHandoffRecord } from "@/lib/campaignHandoff";
import { prepareCampaignReference } from "@/lib/campaignReferenceImage";
import { getAngle } from "@/lib/packshot";
import type {
  AnalyzeResponse,
  Answer,
  CampaignBrief,
  ClarifyingQuestion,
  DeliverableId,
  ProductContext,
} from "@/lib/types";

type Step = "upload" | "clarify" | "brief" | "deliverables" | "generating";

type Job = {
  deliverableId: DeliverableId;
  modelId: string;
  status: "queued" | "running" | "polling" | "done" | "failed" | "mock";
  imageDataUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  posterDataUrl?: string;
  prompt?: string;
  error?: string;
  cost: number;
  startedAt?: number;
  finishedAt?: number;
};

const SPEND_KEY = "studio-session-spend";
const POLL_INTERVAL_MS = 12_000;
const POLL_DEADLINE_MS = 10 * 60 * 1000;

const ASPECT_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-[16/9]",
};

const SAMPLES = [
  { label: "Sparkling water can", file: "/samples/can.svg" },
  { label: "Skincare jar", file: "/samples/jar.svg" },
  { label: "Coffee bag", file: "/samples/coffee.svg" },
];

type ImportedPackshot = CampaignHandoffRecord & { previewUrl: string };

function removeHandoffFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("packshot")) return;
  url.searchParams.delete("packshot");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function StudioWizard() {
  const [step, setStep] = useState<Step>("upload");
  /** Shared with the gate control so unlocking takes effect without a reload. */
  const { health } = useHealth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importedPackshot, setImportedPackshot] = useState<ImportedPackshot | null>(null);
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const analyzeLock = useRef(false);
  const briefLock = useRef(false);
  const intakeSequence = useRef(0);
  const intakeMounted = useRef(false);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [productContext, setProductContext] = useState<ProductContext | null>(null);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [brief, setBrief] = useState<CampaignBrief | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DELIVERABLES.map((d) => [d.id, true])),
  );
  const [modelChoice, setModelChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(DELIVERABLES.map((d) => [d.id, d.defaultModel])),
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sessionSpend, setSessionSpend] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setSessionSpend(Number(localStorage.getItem(SPEND_KEY) ?? 0));
    } catch {}
  }, []);

  const readHandoff = useCallback(async (id: string) => {
    const sequence = ++intakeSequence.current;
    setHandoffId(id);
    setHandoffError(null);
    if (!validCampaignHandoffId(id)) {
      setHandoffLoading(false);
      setHandoffError("This packshot link is incomplete or invalid. Send the completed view again from Packshots, or choose a product photo below.");
      return;
    }
    setHandoffLoading(true);
    try {
      const record = await loadCampaignHandoff(id);
      // A manual image choice, dismissal or newer intake always wins over a slow read.
      if (!intakeMounted.current || sequence !== intakeSequence.current) return;
      if (!record) throw new Error("This packshot is no longer available in this browser. Transfers last 24 hours and stay in the browser where you sent them. Send the view again from Packshots, or upload its downloaded PNG.");
      setImportedPackshot({ ...record, previewUrl: URL.createObjectURL(record.blob) });
    } catch (e) {
      if (!intakeMounted.current || sequence !== intakeSequence.current) return;
      setHandoffError(e instanceof Error ? e.message : "This browser could not open the packshot. Try again, or upload the downloaded image below.");
    } finally {
      if (intakeMounted.current && sequence === intakeSequence.current) setHandoffLoading(false);
    }
  }, []);

  useEffect(() => {
    intakeMounted.current = true;
    const id = new URL(window.location.href).searchParams.get("packshot");
    if (id !== null) void readHandoff(id);
    return () => {
      intakeMounted.current = false;
      intakeSequence.current += 1;
    };
  }, [readHandoff]);

  useEffect(() => {
    if (!importedPackshot) return;
    return () => URL.revokeObjectURL(importedPackshot.previewUrl);
  }, [importedPackshot]);

  const clearHandoff = useCallback(() => {
    intakeSequence.current += 1;
    setImportedPackshot(null);
    setHandoffId(null);
    setHandoffError(null);
    setHandoffLoading(false);
    removeHandoffFromUrl();
  }, []);

  const addSpend = useCallback((amount: number) => {
    setSessionSpend((prev) => {
      const next = Number((prev + amount).toFixed(4));
      try {
        localStorage.setItem(SPEND_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const updateJob = useCallback((id: DeliverableId, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.deliverableId === id ? { ...j, ...patch } : j)));
  }, []);

  // ---------- Step 1 → 2: analyze ----------
  const handleImage = useCallback(async (src: string | Blob, fromPackshots = false) => {
    if (analyzeLock.current) return;
    analyzeLock.current = true;
    intakeSequence.current += 1;
    setHandoffLoading(false);
    if (!fromPackshots) clearHandoff();
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await prepareCampaignReference(src);
      setImageDataUrl(dataUrl);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      const data = json as AnalyzeResponse;
      setProductContext(data.productContext);
      setQuestions(data.questions);
      setAnswers(Object.fromEntries(data.questions.map((q) => [q.id, q.defaultAnswer])));
      setStep(data.questions.length > 0 ? "clarify" : "brief");
      if (data.questions.length === 0) await generateBrief(dataUrl, data.productContext, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      analyzeLock.current = false;
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Step 2 → 3: brief ----------
  const generateBrief = useCallback(
    async (img: string, ctx: ProductContext, answerList: Answer[]) => {
      if (briefLock.current) return;
      briefLock.current = true;
      setError(null);
      setBusy(true);
      try {
        const res = await fetch("/api/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: img, productContext: ctx, answers: answerList }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Brief generation failed");
        setBrief(json.brief as CampaignBrief);
        setStep("brief");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        briefLock.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const submitAnswers = useCallback(() => {
    if (!imageDataUrl || !productContext) return;
    const answerList: Answer[] = questions.map((q) => ({
      questionId: q.id,
      question: q.question,
      answer: answers[q.id] ?? q.defaultAnswer,
    }));
    void generateBrief(imageDataUrl, productContext, answerList);
  }, [answers, generateBrief, imageDataUrl, productContext, questions]);

  // ---------- Cost preview ----------
  const selectedSpecs = useMemo(
    () => DELIVERABLES.filter((d) => selected[d.id]),
    [selected],
  );
  const totalEstimate = useMemo(
    () =>
      selectedSpecs.reduce(
        (sum, d) =>
          sum + estimateCost(modelChoice[d.id], { seconds: d.durationSeconds }),
        0,
      ),
    [selectedSpecs, modelChoice],
  );

  // ---------- Step 4: generate ----------
  const pollVideo = useCallback(
    async (spec: DeliverableSpec, body: Record<string, unknown>) => {
      const deadline = Date.now() + POLL_DEADLINE_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        try {
          const res = await fetch("/api/generate/video/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (json.status === "done") {
            updateJob(spec.id, { status: "done", videoUrl: json.videoUrl, finishedAt: Date.now() });
            return;
          }
          if (json.status === "failed") {
            updateJob(spec.id, { status: "failed", error: json.error, finishedAt: Date.now() });
            return;
          }
        } catch {
          // transient network error — keep polling
        }
      }
      updateJob(spec.id, {
        status: "failed",
        error: "Timed out after 10 minutes — the job may still finish on the provider side.",
      });
    },
    [updateJob],
  );

  const runGeneration = useCallback(async () => {
    if (!brief) return;
    const live = health?.live ?? false;
    if (live) {
      const ok = window.confirm(
        `This will run ${selectedSpecs.length} live generation${selectedSpecs.length === 1 ? "" : "s"} at an estimated cost of $${totalEstimate.toFixed(2)} (list prices). Proceed?`,
      );
      if (!ok) return;
    }

    const initialJobs: Job[] = selectedSpecs.map((d) => ({
      deliverableId: d.id,
      modelId: modelChoice[d.id],
      status: "queued",
      cost: 0,
    }));
    setJobs(initialJobs);
    setStep("generating");

    const stills = selectedSpecs.filter((d) => d.kind === "still");
    const videos = selectedSpecs.filter((d) => d.kind === "video");

    // Start videos first — they take minutes; stills fill in around them.
    const videoTasks = videos.map(async (spec) => {
      updateJob(spec.id, { status: "running", startedAt: Date.now() });
      try {
        const res = await fetch("/api/generate/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliverableId: spec.id,
            modelId: modelChoice[spec.id],
            brief,
            imageDataUrl,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to start video");
        if (json.mock) {
          updateJob(spec.id, {
            status: "mock",
            posterDataUrl: json.posterDataUrl,
            prompt: json.prompt,
            finishedAt: Date.now(),
          });
          return;
        }
        addSpend(json.cost ?? 0);
        updateJob(spec.id, { status: "polling", prompt: json.prompt, cost: json.cost ?? 0 });
        await pollVideo(spec, {
          provider: json.provider,
          operationName: json.operationName,
          falRequestId: json.falRequestId,
          modelId: modelChoice[spec.id],
        });
      } catch (e) {
        updateJob(spec.id, {
          status: "failed",
          error: e instanceof Error ? e.message : "Video generation failed",
        });
      }
    });

    // Stills with limited concurrency (2) to stay under provider rate limits.
    const queue = [...stills];
    const stillWorker = async () => {
      for (;;) {
        const spec = queue.shift();
        if (!spec) return;
        updateJob(spec.id, { status: "running", startedAt: Date.now() });
        try {
          const res = await fetch("/api/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deliverableId: spec.id,
              modelId: modelChoice[spec.id],
              brief,
              imageDataUrl,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Image generation failed");
          if (!json.mock) addSpend(json.cost ?? 0);
          updateJob(spec.id, {
            status: json.mock ? "mock" : "done",
            imageDataUrl: json.imageDataUrl,
            imageUrl: json.imageUrl,
            prompt: json.prompt,
            cost: json.mock ? 0 : (json.cost ?? 0),
            finishedAt: Date.now(),
          });
        } catch (e) {
          updateJob(spec.id, {
            status: "failed",
            error: e instanceof Error ? e.message : "Image generation failed",
          });
        }
      }
    };
    await Promise.all([...videoTasks, stillWorker(), stillWorker()]);
  }, [addSpend, brief, health, imageDataUrl, modelChoice, pollVideo, selectedSpecs, totalEstimate, updateJob]);

  const reset = useCallback(() => {
    clearHandoff();
    setStep("upload");
    setImageDataUrl(null);
    setProductContext(null);
    setQuestions([]);
    setAnswers({});
    setBrief(null);
    setJobs([]);
    setError(null);
  }, [clearHandoff]);

  const allSettled =
    jobs.length > 0 && jobs.every((j) => ["done", "failed", "mock"].includes(j.status));

  // ================================================================ render
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <StatusBar health={health} sessionSpend={sessionSpend} />
      <StepTracker step={step} />

      {error && (
        <div role="alert" className="card mt-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {step === "upload" && (
        <>
          {handoffLoading && (
            <div role="status" className="card mt-8 flex items-center gap-3 p-6 text-muted">
              <Spinner /> Opening your completed packshot…
            </div>
          )}
          {handoffError && (
            <section aria-label="Packshot transfer" className="card mt-8 border-warning/40 p-6">
              <h2 className="text-lg font-semibold">Let’s reconnect your packshot</h2>
              <p role="alert" className="mt-2 max-w-2xl text-muted">{handoffError}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {handoffId && validCampaignHandoffId(handoffId) && <button type="button" className="btn-primary" disabled={busy || handoffLoading} onClick={() => void readHandoff(handoffId)}>Try opening again</button>}
                <a className="btn-secondary" href="/ai-studio/packshots">Back to Packshots</a>
                <button type="button" className="btn-secondary" disabled={busy} onClick={clearHandoff}>Dismiss transfer</button>
              </div>
              <p className="mt-3 text-sm text-muted">Opening a transfer does not run analysis or generate anything.</p>
            </section>
          )}
          {importedPackshot && <ImportedPackshotCard packshot={importedPackshot} busy={busy} onAnalyze={() => void handleImage(importedPackshot.blob, true)} onDismiss={() => { clearHandoff(); setError(null); setImageDataUrl(null); }} />}
          <UploadStep
            busy={busy}
            hasImportedPackshot={Boolean(importedPackshot)}
            fileInput={fileInput}
            onFile={(f) => void handleImage(f)}
            onSample={(src) => void handleImage(src)}
          />
        </>
      )}

      {step !== "upload" && importedPackshot && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <p className="min-w-0 break-words"><span className="font-semibold">From Packshots:</span> {importedPackshot.meta.name} · {getAngle(importedPackshot.meta.angle).label} · {importedPackshot.meta.variant}</p>
          <span className={importedPackshot.meta.review === "reviewed" ? "text-muted" : "text-warning"}>{importedPackshot.meta.review === "reviewed" ? "Review marked in Packshots" : "Human review still needed"}</span>
        </div>
      )}

      {step === "clarify" && productContext && (
        <ClarifyStep
          productContext={productContext}
          imageDataUrl={imageDataUrl}
          questions={questions}
          answers={answers}
          setAnswers={setAnswers}
          busy={busy}
          onSubmit={submitAnswers}
        />
      )}

      {step === "brief" && (
        <BriefStep
          brief={brief}
          setBrief={setBrief}
          busy={busy}
          error={error}
          onRetry={submitAnswers}
          onNext={() => setStep("deliverables")}
        />
      )}

      {step === "deliverables" && brief && (
        <DeliverablesStep
          selected={selected}
          setSelected={setSelected}
          modelChoice={modelChoice}
          setModelChoice={setModelChoice}
          totalEstimate={totalEstimate}
          live={health?.live ?? false}
          count={selectedSpecs.length}
          onGenerate={() => void runGeneration()}
          onBack={() => setStep("brief")}
        />
      )}

      {step === "generating" && (
        <ResultsStep jobs={jobs} allSettled={allSettled} onReset={reset} live={health?.live ?? false} />
      )}
    </div>
  );
}

// ================================================================ pieces

function ImportedPackshotCard({
  packshot,
  busy,
  onAnalyze,
  onDismiss,
}: {
  packshot: ImportedPackshot;
  busy: boolean;
  onAnalyze: () => void;
  onDismiss: () => void;
}) {
  const meta = packshot.meta;
  return (
    <section aria-labelledby="imported-packshot-heading" className="card mt-8 overflow-hidden border-accent/35">
      <div className="grid md:grid-cols-[minmax(220px,0.7fr)_1fr]">
        <div className="flex min-h-64 items-center justify-center border-b border-border-soft p-6 md:border-r md:border-b-0" style={{ backgroundColor: "#eeeae3", backgroundImage: "conic-gradient(#ffffff80 25%, transparent 0 50%, #ffffff80 0 75%, transparent 0)", backgroundSize: "20px 20px" }}>
          {/* Preserve the actual source and its alpha here; analysis gets a separate white-backed copy. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={packshot.previewUrl} alt={`${meta.name}, ${getAngle(meta.angle).label} view from Packshots`} className="max-h-80 w-full object-contain" />
        </div>
        <div className="min-w-0 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Packshots → Campaign Studio</p>
          <h1 id="imported-packshot-heading" className="mt-3 text-[1.75rem] leading-tight tracking-[-0.03em]">One finished view. A new campaign.</h1>
          <p className="mt-3 break-words text-lg font-semibold">{meta.name}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
            <dt className="text-muted">Source</dt><dd>{meta.source === "artwork" ? "Artwork render" : "Generated packshot"}</dd>
            <dt className="text-muted">View</dt><dd className="break-words">{getAngle(meta.angle).label}</dd>
            <dt className="text-muted">Version</dt><dd className="break-words">{meta.variant}</dd>
            <dt className="text-muted">Review</dt><dd>{meta.review === "reviewed" ? "Marked reviewed in Packshots" : "Needs human review"}</dd>
          </dl>
          <p className="mt-4 text-sm text-muted">Check the artwork, copy and proportions before using this view in a campaign. A completed render is not a product approval.</p>
          {meta.note && <p className="mt-3 break-words border-l-2 border-accent/30 pl-3 text-sm text-muted">{meta.note}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" disabled={busy} onClick={onAnalyze}>{busy ? <><Spinner /> Analyzing the packshot…</> : "Analyze this packshot →"}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={onDismiss}>Use a different image</button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">Opening this view is free. Analyze starts the campaign flow and uses paid APIs in live mode. Transparent areas are placed on white for analysis; this source stays intact.</p>
        </div>
      </div>
    </section>
  );
}

function StatusBar({
  health,
  sessionSpend,
}: {
  health: Health | null;
  sessionSpend: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">
          <Dot ok={health?.gemini ?? false} /> Gemini API {health?.gemini ? "connected" : "not configured"}
        </span>
        <span className="chip">
          <Dot ok={health?.fal ?? false} /> fal.ai {health?.fal ? "connected" : "not configured"}
        </span>
        {/* Live-mode state sits with the other connection chips, not in the nav. */}
        <LiveGate />
        {health && !health.live && !health.gemini && !health.fal && (
          <span className="chip border-warning/40 text-warning">
            Demo mode — zero-cost mocks; add API keys to go live
          </span>
        )}
      </div>
      <SpendChip amount={sessionSpend} />
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-muted/50"}`}
    />
  );
}

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "clarify", label: "Clarify" },
  { key: "brief", label: "Brief" },
  { key: "deliverables", label: "Deliverables" },
  { key: "generating", label: "Generate" },
];

function StepTracker({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              i < idx
                ? "bg-success/20 text-success"
                : i === idx
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-muted"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === idx ? "font-semibold" : "text-muted"}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 text-muted/40">—</span>}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({
  busy,
  hasImportedPackshot,
  fileInput,
  onFile,
  onSample,
}: {
  busy: boolean;
  hasImportedPackshot: boolean;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onSample: (src: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <section className="mt-8">
      {hasImportedPackshot ? <h2 className="text-xl tracking-[-0.02em]">Or start with a different product photo</h2> : <h1 className="text-[1.75rem] tracking-[-0.03em]">Start with one product photo</h1>}
      <p className="mt-2 max-w-2xl text-muted">
        The pipeline analyzes the image, interviews you only where it needs to,
        writes the campaign brief, and produces the full multi-format pack.
      </p>
      <div
        className={`card mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-accent bg-accent/5" : "border-border-soft"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (busy) return;
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) onFile(f);
        }}
      >
        {busy ? (
          <>
            <Spinner />
            <p className="text-sm text-muted">Analyzing the product image…</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">Drop a product photo here</p>
            <p className="text-sm text-muted">JPEG, PNG or WebP · resized client-side before upload</p>
            {/*
              A real button, not a span in a clickable div.
              
              The drop zone stays clickable for the mouse, but it is a div with
              no role — so this was the only way in for a keyboard, and it was
              not focusable. stopPropagation keeps the zone's own handler from
              firing behind it and opening the picker twice.
            */}
            <button
              type="button"
              className="btn-secondary mt-2"
              onClick={(e) => {
                e.stopPropagation();
                fileInput.current?.click();
              }}
            >
              Browse files
            </button>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-6">
        <p className="text-sm font-semibold text-muted">…or try a sample product</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              className="btn-secondary"
              disabled={busy}
              onClick={() => onSample(s.file)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClarifyStep({
  productContext,
  imageDataUrl,
  questions,
  answers,
  setAnswers,
  busy,
  onSubmit,
}: {
  productContext: ProductContext;
  imageDataUrl: string | null;
  questions: ClarifyingQuestion[];
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
      <div>
        {imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageDataUrl} alt="Product" className="card w-full object-cover" />
        )}
        <div className="card mt-4 p-4 text-sm">
          <p className="font-semibold">What the vision model sees</p>
          <dl className="mt-2 space-y-1 text-muted">
            <Row k="Product" v={productContext.name} />
            <Row k="Category" v={productContext.category} />
            <Row k="Colors" v={productContext.colors.join(", ")} />
            <Row k="Texture" v={productContext.texture} />
            <Row k="Packaging" v={productContext.packagingType} />
          </dl>
        </div>
      </div>
      <div>
        <h1 className="text-[1.75rem] tracking-[-0.03em]">A couple of questions</h1>
        <p className="mt-2 text-muted">
          The model only asks what it can&apos;t see — smart defaults are preselected.
        </p>
        <div className="mt-6 space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="card p-5">
              <p className="font-semibold">{q.question}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className={`rounded-[6px] border px-4 py-2 text-sm transition ${
                      answers[q.id] === opt
                        ? "border-accent bg-accent/15 font-semibold text-foreground"
                        : "border-border-soft bg-surface-2 text-muted hover:border-accent/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-6" onClick={onSubmit} disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Writing the campaign brief…
            </>
          ) : (
            "Write the campaign brief →"
          )}
        </button>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className="text-right text-foreground">{v}</dd>
    </div>
  );
}

const BRIEF_FIELDS: { key: keyof CampaignBrief; label: string; long?: boolean }[] = [
  { key: "productName", label: "Product" },
  { key: "targetAudience", label: "Target audience" },
  { key: "mood", label: "Mood" },
  { key: "setting", label: "Setting" },
  { key: "palette", label: "Palette" },
  { key: "seasonalTheme", label: "Seasonal theme" },
  { key: "headlineEN", label: "Headline (EN)" },
  { key: "headlineFR", label: "Headline (FR)" },
  { key: "stillPrompt", label: "Hero still prompt", long: true },
  { key: "videoPrompt", label: "Video prompt (Veo-optimized, with Audio: cue)", long: true },
  { key: "negativePrompt", label: "Negative prompt", long: true },
];

function BriefStep({
  brief,
  setBrief,
  busy,
  error,
  onRetry,
  onNext,
}: {
  brief: CampaignBrief | null;
  setBrief: React.Dispatch<React.SetStateAction<CampaignBrief | null>>;
  busy: boolean;
  error: string | null;
  onRetry: () => void;
  onNext: () => void;
}) {
  if (!brief && !busy && error) {
    return (
      <section className="card mt-8 p-6">
        <h1 className="text-xl">The campaign brief didn’t finish</h1>
        <p className="mt-2 max-w-2xl text-muted">Your product image and analysis are still here. You can retry the brief without analyzing the packshot again.</p>
        <button type="button" className="btn-primary mt-5" onClick={onRetry}>Retry campaign brief</button>
      </section>
    );
  }
  if (busy || !brief) {
    return (
      <section className="card mt-8 flex min-h-64 flex-col items-center justify-center gap-3 p-10">
        <Spinner />
        <p className="text-sm text-muted">Writing the campaign brief…</p>
      </section>
    );
  }
  return (
    <section className="mt-8">
      <h1 className="text-[1.75rem] tracking-[-0.03em]">The campaign brief</h1>
      <p className="mt-2 max-w-2xl text-muted">
        One brief drives all eight deliverables. Every field is editable —
        this is the human judgment gate before anything generates.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {BRIEF_FIELDS.map((f) => (
          <label key={f.key} className={f.long ? "md:col-span-2" : ""}>
            <span className="mb-1 block label">
              {f.label}
            </span>
            {f.long ? (
              <textarea
                className="input min-h-24"
                value={brief[f.key]}
                onChange={(e) => setBrief({ ...brief, [f.key]: e.target.value })}
              />
            ) : (
              <input
                className="input"
                value={brief[f.key]}
                onChange={(e) => setBrief({ ...brief, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <button className="btn-primary mt-6" onClick={onNext}>
        Choose deliverables →
      </button>
    </section>
  );
}

function DeliverablesStep({
  selected,
  setSelected,
  modelChoice,
  setModelChoice,
  totalEstimate,
  live,
  count,
  onGenerate,
  onBack,
}: {
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  modelChoice: Record<string, string>;
  setModelChoice: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  totalEstimate: number;
  live: boolean;
  count: number;
  onGenerate: () => void;
  onBack: () => void;
}) {
  return (
    <section className="mt-8">
      <h1 className="text-[1.75rem] tracking-[-0.03em]">The content pack</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Each deliverable routes to the model best suited — and priced — for the
        job. Costs are shown before anything runs.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {DELIVERABLES.map((d) => {
          const cost = estimateCost(modelChoice[d.id], { seconds: d.durationSeconds });
          const on = selected[d.id];
          return (
            <div
              key={d.id}
              className={`card p-5 transition ${on ? "" : "opacity-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [d.id]: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="font-semibold">{d.label}</span>
                    <span className="chip ml-2">{d.kind === "video" ? `video · ${d.aspect}` : d.aspect}</span>
                    <span className="mt-1 block text-sm text-muted">{d.description}</span>
                  </span>
                </label>
                <span className="chip shrink-0 border-accent/40 text-accent">
                  ~${cost.toFixed(2)}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted/80">{d.rationale}</p>
              <div className="mt-3">
                <select
                  className="input"
                  value={modelChoice[d.id]}
                  disabled={!on || d.modelOptions.length === 1}
                  onChange={(e) =>
                    setModelChoice((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                >
                  {d.modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {MODELS[m].label} — {MODELS[m].unit === "second" ? `$${MODELS[m].unitCost}/s` : `$${MODELS[m].unitCost}/img`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-4 border-accent/30 bg-surface-2/95 p-5 backdrop-blur">
        <div>
          <p className="text-sm text-muted">
            {count} deliverable{count === 1 ? "" : "s"} selected · estimated total
          </p>
          <p className="text-2xl font-bold text-accent">${totalEstimate.toFixed(2)}</p>
          {!live && (
            <p className="text-xs text-warning">
              Demo mode: nothing will be charged — mocks render instead.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={onBack}>
            ← Edit brief
          </button>
          <button className="btn-primary" onClick={onGenerate} disabled={count === 0}>
            Generate the pack →
          </button>
        </div>
      </div>
    </section>
  );
}

function ResultsStep({
  jobs,
  allSettled,
  onReset,
  live,
}: {
  jobs: Job[];
  allSettled: boolean;
  onReset: () => void;
  live: boolean;
}) {
  const spent = jobs.reduce((s, j) => s + j.cost, 0);
  const done = jobs.filter((j) => ["done", "mock"].includes(j.status)).length;
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] tracking-[-0.03em]">
            {allSettled ? "The content pack" : "Generating the pack…"}
          </h1>
          <p className="mt-2 text-muted">
            {done}/{jobs.length} deliverables finished
            {live && spent > 0 && <> · estimated spend ${spent.toFixed(2)}</>}
            {!allSettled && " · videos take a few minutes — stills land first"}
          </p>
        </div>
        {allSettled && (
          <button className="btn-secondary" onClick={onReset}>
            Start a new campaign
          </button>
        )}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((j) => (
          <JobCard key={j.deliverableId} job={j} />
        ))}
      </div>
    </section>
  );
}

function JobCard({ job }: { job: Job }) {
  const spec = DELIVERABLES.find((d) => d.id === job.deliverableId)!;
  const model = MODELS[job.modelId];
  const [showPrompt, setShowPrompt] = useState(false);
  const media = job.imageDataUrl ?? job.imageUrl ?? job.posterDataUrl;
  const seconds =
    job.startedAt && job.finishedAt
      ? Math.round((job.finishedAt - job.startedAt) / 1000)
      : null;

  return (
    <div className="card overflow-hidden">
      <div className={`relative w-full bg-surface-2 ${ASPECT_CLASS[spec.aspect] ?? "aspect-square"}`}>
        {job.videoUrl ? (
          <video
            src={job.videoUrl}
            controls
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media} alt={spec.label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
            {job.status === "failed" ? (
              <p className="max-w-[80%] text-center text-danger">{job.error}</p>
            ) : (
              <>
                <Spinner />
                <p>
                  {job.status === "queued" && "Queued"}
                  {job.status === "running" && "Generating…"}
                  {job.status === "polling" && "Rendering video…"}
                </p>
              </>
            )}
          </div>
        )}
        {job.status === "mock" && (
          <span className="absolute left-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
            DEMO
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{spec.label}</p>
          {job.cost > 0 && <span className="chip">${job.cost.toFixed(2)}</span>}
        </div>
        <p className="mt-1 text-xs text-muted">
          {model.label}
          {seconds !== null && ` · ${seconds}s`}
        </p>
        <div className="mt-3 flex gap-2">
          {(job.imageDataUrl ?? job.imageUrl ?? job.videoUrl) && (
            <a
              href={job.videoUrl ?? job.imageDataUrl ?? job.imageUrl}
              download={`${spec.id}.${job.videoUrl ? "mp4" : "jpg"}`}
              target={job.imageUrl || job.videoUrl ? "_blank" : undefined}
              rel="noreferrer"
              className="text-xs font-semibold text-accent hover:underline"
            >
              Download
            </a>
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
        {showPrompt && job.prompt && (
          <p className="mt-2 rounded-[6px] bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted">
            {job.prompt}
          </p>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
  );
}
