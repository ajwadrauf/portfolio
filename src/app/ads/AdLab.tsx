"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AD_PRESETS, AD_VIDEO_MODELS, getAdPreset } from "@/lib/adPresets";
import { MODELS, estimateCost } from "@/lib/models";

type Phase = "idle" | "composing" | "ready" | "starting" | "polling" | "done" | "failed" | "mock";

const SPEND_KEY = "studio-session-spend";
const POLL_INTERVAL_MS = 12_000;
const POLL_DEADLINE_MS = 10 * 60 * 1000;
const ASPECT_CLASS: Record<string, string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-[16/9]",
};

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
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AdLab() {
  const [health, setHealth] = useState<{ gemini: boolean; fal: boolean; live: boolean } | null>(null);
  const [presetId, setPresetId] = useState<string>(AD_PRESETS[0].id);
  const [params, setParams] = useState<Record<string, string>>({});
  const [productImage, setProductImage] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>("veo-3.1-fast");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionSpend, setSessionSpend] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const preset = getAdPreset(presetId);
  const cost = estimateCost(modelId, { seconds: preset.durationSeconds });

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setHealth({ gemini: h.gemini, fal: h.fal, live: h.live }))
      .catch(() => setHealth({ gemini: false, fal: false, live: false }));
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

  const selectPreset = useCallback((id: string) => {
    setPresetId(id);
    setParams({});
    setFinalPrompt("");
    setNegativePrompt("");
    setPhase("idle");
    setVideoUrl(null);
    setPosterDataUrl(null);
    setError(null);
  }, []);

  const loadExample = useCallback(() => {
    setParams(Object.fromEntries(preset.fields.map((f) => [f.key, f.example])));
  }, [preset]);

  const compose = useCallback(async () => {
    setError(null);
    setPhase("composing");
    try {
      const res = await fetch("/api/ad/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId, params }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Compose failed");
      setFinalPrompt(json.finalPrompt);
      setNegativePrompt(json.negativePrompt);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compose failed");
      setPhase("idle");
    }
  }, [params, presetId]);

  const generate = useCallback(async () => {
    setError(null);
    if (health?.live) {
      const ok = window.confirm(
        `This will run one live ${preset.durationSeconds}s video generation at an estimated cost of $${cost.toFixed(2)}. Proceed?`,
      );
      if (!ok) return;
    }
    setPhase("starting");
    setVideoUrl(null);
    setPosterDataUrl(null);
    try {
      const res = await fetch("/api/ad/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          negativePrompt,
          modelId,
          aspect: preset.aspect,
          durationSeconds: preset.durationSeconds,
          imageDataUrl: productImage ?? undefined,
          presetName: preset.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to start");
      if (json.mock) {
        setPosterDataUrl(json.posterDataUrl);
        setPhase("mock");
        return;
      }
      addSpend(json.cost ?? 0);
      setPhase("polling");
      const deadline = Date.now() + POLL_DEADLINE_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        try {
          const sres = await fetch("/api/generate/video/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: json.provider,
              operationName: json.operationName,
              falRequestId: json.falRequestId,
              modelId,
            }),
          });
          const sjson = await sres.json();
          if (sjson.status === "done") {
            setVideoUrl(sjson.videoUrl);
            setPhase("done");
            return;
          }
          if (sjson.status === "failed") throw new Error(sjson.error ?? "Generation failed");
        } catch (e) {
          if (e instanceof Error && e.message !== "Failed to fetch") throw e;
        }
      }
      throw new Error("Timed out after 10 minutes — the job may still finish on the provider side.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setPhase("failed");
    }
  }, [addSpend, cost, finalPrompt, health, modelId, negativePrompt, preset, productImage]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.gemini ? "bg-success" : "bg-muted/50"}`} />
            Gemini API {health?.gemini ? "connected" : "not configured"}
          </span>
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.fal ? "bg-success" : "bg-muted/50"}`} />
            fal.ai {health?.fal ? "connected" : "not configured"}
          </span>
          {health && !health.live && (
            <span className="chip border-warning/40 text-warning">
              Demo mode — zero-cost mocks; add API keys to go live
            </span>
          )}
        </div>
        <span className="chip">Session spend: ${sessionSpend.toFixed(2)}</span>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">Ad Lab</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Mini product ads as <span className="font-semibold text-foreground">preset recipes</span>:
        each concept is a structured, deconstructed prompt — aesthetics, beat-by-beat
        action, text overlay spec, audio design — with the product swappable per
        SKU. Design the concept once; run any product through it.
      </p>

      {/* preset gallery */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AD_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => selectPreset(p.id)}
            className={`card p-5 text-left transition ${
              p.id === presetId ? "border-accent ring-1 ring-accent" : "hover:border-accent/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{p.name}</h2>
              <span className="chip shrink-0">{p.durationSeconds}s · {p.aspect}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.hook}</p>
          </button>
        ))}
      </div>

      {error && (
        <div className="card mt-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* left — recipe + product form + prompt */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">The recipe — {preset.name}</h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Core aesthetics
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                  {preset.aesthetics.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">
                  Audio design
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                  {preset.audio.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Action sequence
                </p>
                <ol className="mt-2 space-y-2">
                  {preset.scenes.map((s, i) => (
                    <li key={s.title} className="text-sm">
                      <span className="font-semibold">
                        {i + 1} · {s.title}:
                      </span>{" "}
                      <span className="text-muted">{s.description}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">
                  Text overlay
                </p>
                <p className="mt-2 text-sm text-muted">{preset.overlay}</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Swap in your product</h2>
              <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={loadExample}>
                Load example
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {preset.fields.map((f) => (
                <label key={f.key}>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                    {f.label}
                  </span>
                  <input
                    className="input"
                    placeholder={f.placeholder}
                    value={params[f.key] ?? ""}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
                {productImage ? "Replace product photo" : "Add product photo (optional)"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      setProductImage(await toProcessedDataUrl(f));
                    } catch {
                      setError("Could not read that image");
                    }
                  }
                  e.target.value = "";
                }}
              />
              {productImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productImage}
                  alt="Product"
                  className="h-14 w-14 rounded-lg border border-border-soft object-cover"
                />
              )}
              <p className="text-xs text-muted">
                With a photo, the real product grounds the ad (image-to-video first frame).
              </p>
            </div>
            <button
              className="btn-primary mt-5"
              onClick={() => void compose()}
              disabled={phase === "composing"}
            >
              {phase === "composing" ? "Composing…" : "Compose the prompt →"}
            </button>
          </div>

          {(finalPrompt || phase === "composing") && (
            <div className="card p-5">
              <h2 className="font-semibold">The composed prompt — edit before you spend</h2>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Video prompt
                </span>
                <textarea
                  className="input min-h-40 font-mono text-xs leading-relaxed"
                  value={finalPrompt}
                  onChange={(e) => setFinalPrompt(e.target.value)}
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Negative prompt
                </span>
                <input
                  className="input font-mono text-xs"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        {/* right — model, generate, result */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">Generate</h2>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                Video model
              </span>
              <select
                className="input"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              >
                {AD_VIDEO_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODELS[m].label} — ${MODELS[m].unitCost}/s
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-muted">
              Veo renders the synced audio design natively — it&apos;s the right
              tool for these; Kling is the silent-but-cheap draft option.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-border-soft pt-4">
              <div className="text-sm text-muted">
                {preset.durationSeconds}s · {preset.aspect} ·{" "}
                <span className="font-bold text-accent">~${cost.toFixed(2)}</span>
                {health && !health.live && (
                  <span className="ml-1 text-xs text-warning">(demo — $0)</span>
                )}
              </div>
              <button
                className="btn-primary"
                disabled={!finalPrompt || phase === "starting" || phase === "polling"}
                onClick={() => void generate()}
              >
                Generate ad →
              </button>
            </div>
            {!finalPrompt && (
              <p className="mt-2 text-xs text-muted">Compose the prompt first.</p>
            )}
          </div>

          {(phase === "starting" || phase === "polling" || phase === "done" || phase === "mock" || phase === "failed") && (
            <div className="card overflow-hidden">
              <div className={`relative w-full bg-surface-2 ${ASPECT_CLASS[preset.aspect]}`}>
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : posterDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterDataUrl}
                    alt={preset.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
                    {phase === "failed" ? (
                      <p className="max-w-[80%] text-center text-danger">{error}</p>
                    ) : (
                      <>
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
                        <p>{phase === "starting" ? "Starting…" : "Rendering the ad — a few minutes…"}</p>
                      </>
                    )}
                  </div>
                )}
                {phase === "mock" && (
                  <span className="absolute left-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
                    DEMO
                  </span>
                )}
              </div>
              {videoUrl && (
                <div className="p-4">
                  <a
                    href={videoUrl}
                    download={`${preset.id}-ad.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Download MP4
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
