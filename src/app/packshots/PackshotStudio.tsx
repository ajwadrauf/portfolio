"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODELS, estimateCost } from "@/lib/models";
import {
  PACK_ANGLES,
  gs1FileName,
  isGrounded,
  type PackAngle,
} from "@/lib/packshot";

type Reference = { angle: PackAngle; dataUrl: string };

type Job = {
  angle: PackAngle;
  status: "queued" | "running" | "done" | "failed" | "mock";
  imageDataUrl?: string;
  prompt?: string;
  grounded?: boolean;
  error?: string;
  cost: number;
};

const SPEND_KEY = "studio-session-spend";
const MODEL_OPTIONS = ["nano-banana-pro", "nano-banana-flash"] as const;
const LANGS = ["enfr", "en", "fr"] as const;

async function toProcessedDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale) || maxSide;
    canvas.height = Math.round(img.height * scale) || maxSide;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PackshotStudio() {
  const [health, setHealth] = useState<{ gemini: boolean; live: boolean } | null>(null);
  const [sku, setSku] = useState("");
  const [lang, setLang] = useState<(typeof LANGS)[number]>("enfr");
  const [notes, setNotes] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [uploadAngle, setUploadAngle] = useState<PackAngle>("front");
  const [targets, setTargets] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PACK_ANGLES.map((a) => [a.id, a.id !== "front"])),
  );
  const [modelId, setModelId] = useState<string>("nano-banana-pro");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sessionSpend, setSessionSpend] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setHealth({ gemini: h.gemini, live: h.gemini && !h.dryRun }))
      .catch(() => setHealth({ gemini: false, live: false }));
    try {
      setSessionSpend(Number(localStorage.getItem(SPEND_KEY) ?? 0));
    } catch {}
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

  const providedAngles = useMemo(() => references.map((r) => r.angle), [references]);
  const selectedAngles = useMemo(
    () => PACK_ANGLES.filter((a) => targets[a.id]).map((a) => a.id),
    [targets],
  );
  const totalEstimate = selectedAngles.length * estimateCost(modelId);
  const groundedCount = selectedAngles.filter((a) => isGrounded(a, providedAngles)).length;

  const addReference = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const dataUrl = await toProcessedDataUrl(file);
        setReferences((prev) => [
          ...prev.filter((r) => r.angle !== uploadAngle),
          { angle: uploadAngle, dataUrl },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read that image");
      }
    },
    [uploadAngle],
  );

  const updateJob = useCallback((angle: PackAngle, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.angle === angle ? { ...j, ...patch } : j)));
  }, []);

  const generate = useCallback(async () => {
    if (references.length === 0 || selectedAngles.length === 0) return;
    setError(null);
    if (health?.live) {
      const ok = window.confirm(
        `This will run ${selectedAngles.length} live packshot generation${selectedAngles.length === 1 ? "" : "s"} at an estimated cost of $${totalEstimate.toFixed(2)}. Proceed?`,
      );
      if (!ok) return;
    }
    setJobs(selectedAngles.map((angle) => ({ angle, status: "queued", cost: 0 })));

    const queue = [...selectedAngles];
    const worker = async () => {
      for (;;) {
        const angle = queue.shift();
        if (!angle) return;
        updateJob(angle, { status: "running" });
        try {
          const res = await fetch("/api/packshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetAngle: angle,
              modelId,
              references,
              productNotes: notes || undefined,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Generation failed");
          if (!json.mock) addSpend(json.cost ?? 0);
          updateJob(angle, {
            status: json.mock ? "mock" : "done",
            imageDataUrl: json.imageDataUrl,
            prompt: json.prompt,
            grounded: json.grounded,
            cost: json.mock ? 0 : (json.cost ?? 0),
          });
        } catch (e) {
          updateJob(angle, {
            status: "failed",
            error: e instanceof Error ? e.message : "Generation failed",
          });
        }
      }
    };
    await Promise.all([worker(), worker()]);
  }, [addSpend, health, modelId, notes, references, selectedAngles, totalEstimate, updateJob]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.gemini ? "bg-success" : "bg-muted/50"}`} />
            Gemini API {health?.gemini ? "connected" : "not configured"}
          </span>
          {health && !health.live && (
            <span className="chip border-warning/40 text-warning">
              Demo mode — zero-cost mocks; add GEMINI_API_KEY to go live
            </span>
          )}
        </div>
        <span className="chip">Session spend: ${sessionSpend.toFixed(2)}</span>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">Packshot Studio</h1>
      <p className="mt-2 max-w-3xl text-muted">
        The planogram case: every SKU needs product-on-white at up to 7 angles.
        Upload the reference photos you already have, and generate the missing
        GS1 angles instead of re-shooting them. Angles backed by a real
        reference are marked <span className="font-semibold text-success">grounded</span>;
        angles the camera never saw are{" "}
        <span className="font-semibold text-warning">reconstructed</span> and
        flagged for mandatory label QA — the model can&apos;t know what an unseen
        face of the package says.
      </p>

      {error && (
        <div className="card mt-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
        {/* left column — inputs */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">1 · Product</h2>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                SKU / GTIN
              </span>
              <input
                className="input"
                placeholder="6565170002"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                Language code
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
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                Product notes (optional)
              </span>
              <input
                className="input"
                placeholder="e.g. stand-up pouch, 2 kg, matte kraft finish"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold">2 · Reference photos</h2>
            <p className="mt-1 text-xs text-muted">
              Add every face you have — each one turns a reconstruction into a
              grounded angle.
            </p>
            <div className="mt-3 flex gap-2">
              <select
                className="input flex-1"
                value={uploadAngle}
                onChange={(e) => setUploadAngle(e.target.value as PackAngle)}
              >
                {PACK_ANGLES.filter((a) => a.id !== "hero34").map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
              <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
                Add photo
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void addReference(f);
                  e.target.value = "";
                }}
              />
            </div>
            {references.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {references.map((r) => (
                  <div key={r.angle} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.dataUrl}
                      alt={r.angle}
                      className="aspect-square w-full rounded-lg border border-border-soft object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background">
                      {r.angle}
                    </span>
                    <button
                      className="absolute right-1 top-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white"
                      onClick={() =>
                        setReferences((prev) => prev.filter((x) => x.angle !== r.angle))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-semibold">3 · Model</h2>
            <select
              className="input mt-3"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {MODELS[m].label} — ${MODELS[m].unitCost}/img
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted">
              Pro holds label text and brand detail best — use it for final
              assets; Flash is fine for layout drafts.
            </p>
          </div>
        </div>

        {/* right column — targets + results */}
        <div>
          <div className="card p-5">
            <h2 className="font-semibold">4 · Target angles</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PACK_ANGLES.map((a) => {
                const grounded = isGrounded(a.id, providedAngles);
                return (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border-soft bg-surface px-3 py-2"
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
                      {grounded ? "grounded" : "reconstructed"}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-4">
              <div className="text-sm text-muted">
                {selectedAngles.length} angle{selectedAngles.length === 1 ? "" : "s"} ·{" "}
                {groundedCount} grounded ·{" "}
                <span className="font-bold text-accent">~${totalEstimate.toFixed(2)}</span>
                {health && !health.live && (
                  <span className="ml-2 text-xs text-warning">(demo mode — $0)</span>
                )}
              </div>
              <button
                className="btn-primary"
                disabled={references.length === 0 || selectedAngles.length === 0}
                onClick={() => void generate()}
              >
                Generate packshots →
              </button>
            </div>
            {references.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                Add at least one reference photo to enable generation.
              </p>
            )}
          </div>

          {jobs.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((j) => (
                <PackshotCard key={j.angle} job={j} sku={sku} lang={lang} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PackshotCard({ job, sku, lang }: { job: Job; sku: string; lang: string }) {
  const spec = PACK_ANGLES.find((a) => a.id === job.angle)!;
  const [showPrompt, setShowPrompt] = useState(false);
  const fileName = gs1FileName(sku, lang, job.angle);

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-square w-full bg-surface-2">
        {job.imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.imageDataUrl}
            alt={spec.label}
            className="absolute inset-0 h-full w-full object-cover"
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
        {job.grounded === false && (
          <span className="absolute right-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
            LABEL QA REQUIRED
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{spec.label}</p>
          {job.cost > 0 && <span className="chip">${job.cost.toFixed(2)}</span>}
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-muted">{fileName}</p>
        <div className="mt-3 flex gap-2">
          {job.imageDataUrl && (
            <a
              href={job.imageDataUrl}
              download={fileName}
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
          <p className="mt-2 rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted">
            {job.prompt}
          </p>
        )}
      </div>
    </div>
  );
}
