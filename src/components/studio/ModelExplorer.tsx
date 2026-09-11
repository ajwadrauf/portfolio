"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_MODEL_SCENARIO, modelsForKind, modelSource, scenarioForModel, type ModelScenario } from "@/lib/studioDecisions";
import { PACKSHOT_MODELS } from "@/lib/packshot";
import { audioCapability } from "@/lib/adPresets";
import { type ModelInfo } from "@/lib/models";
import { useStudioProject } from "./StudioProjectProvider";

export function ModelExplorer() {
  const { project, saveDraft } = useStudioProject();
  const router = useRouter();
  const [kind, setKind] = useState<ModelInfo["kind"]>("video");
  const [scenario, setScenario] = useState(DEFAULT_MODEL_SCENARIO);
  const [onlyCompatible, setOnlyCompatible] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (project?.example === "velune") setScenario({ ...DEFAULT_MODEL_SCENARIO, seconds: 15, aspect: "16:9", inputVideoSeconds: 15 }); }, [project?.id, project?.example]);
  const set = <K extends keyof ModelScenario>(key: K, value: ModelScenario[K]) => setScenario((s) => ({ ...s, [key]: value }));
  return <section className="my-10 rounded-md border border-border-soft bg-surface p-5 sm:p-7" aria-labelledby="model-explorer">
    <p className="label !text-accent">Choose for this job</p><h2 id="model-explorer" className="mt-2 text-2xl">Compare the scenario, not the sticker price.</h2><p className="mt-3 text-sm leading-relaxed text-muted">These estimates use the same configured pricing logic as the studio. They are not live vendor quotes. Input-video billing, image tiers and started-minute audio billing are included where implemented.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm">Output<select className="input mt-1" value={kind} onChange={(e) => setKind(e.target.value as ModelInfo["kind"])}><option value="video">Video</option><option value="image">Image</option><option value="music">Music</option><option value="voice">Voice</option><option value="sfx">Sound effect</option></select></label>
      {kind !== "image" && kind !== "voice" && <label className="text-sm">Output duration (seconds)<input className="input mt-1" type="number" min={.5} max={600} step={.5} value={scenario.seconds} onChange={(e) => set("seconds", Number(e.target.value))} /></label>}
      {kind === "voice" && <label className="text-sm">Spoken characters<input className="input mt-1" type="number" min={1} max={1200} value={scenario.characters} onChange={(e) => set("characters", Number(e.target.value))} /></label>}
      {(kind === "image" || kind === "video") && <label className="text-sm">Appearance references<input className="input mt-1" type="number" min={0} max={30} value={scenario.referenceImages} onChange={(e) => set("referenceImages", Number(e.target.value))} /></label>}
      {kind === "image" && <label className="text-sm">Output tier<select className="input mt-1" value={scenario.imageTier} onChange={(e) => set("imageTier", Number(e.target.value))}><option value={0}>Smallest configured tier</option><option value={1}>Next configured tier</option><option value={2}>Largest configured tier</option></select></label>}
      {kind === "video" && <><label className="text-sm">Aspect<select className="input mt-1" value={scenario.aspect} onChange={(e) => set("aspect", e.target.value)}>{["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"].map((a) => <option key={a}>{a}</option>)}</select></label><label className="text-sm">Video resolution<select className="input mt-1" value={scenario.resolution} onChange={(e) => set("resolution", e.target.value as ModelScenario["resolution"])}>{["480p", "720p", "768p", "1080p"].map((r) => <option key={r}>{r}</option>)}</select></label><label className="text-sm">Total motion-guide seconds<input className="input mt-1" type="number" min={0} max={30} step={.5} value={scenario.inputVideoSeconds} onChange={(e) => set("inputVideoSeconds", Number(e.target.value))} /></label></>}
    </div>
    <div className="my-5 flex flex-wrap gap-5 text-sm"><label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={onlyCompatible} onChange={(e) => setOnlyCompatible(e.target.checked)} />Compatible routes only</label>{kind === "video" && <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={scenario.requireAudio} onChange={(e) => set("requireAudio", e.target.checked)} />Require native audio</label>}<button className="min-h-9 text-accent underline" onClick={() => { setKind("video"); setScenario({ ...DEFAULT_MODEL_SCENARIO, seconds: 15, aspect: "16:9", inputVideoSeconds: 15 }); }}>Try VELUNE’s 15s motion scenario</button></div>
    <div className="grid gap-4 md:grid-cols-2">{modelsForKind(kind).map((model) => {
      const estimate = scenarioForModel(model, scenario);
      if (onlyCompatible && !estimate.compatible) return null;
      return <article key={model.id} className="rounded-md border border-border-soft p-5"><p className="label-sm">{model.provider} · {estimate.compatible ? "Supported by this app" : "Adjust this scenario"}</p><h3 className="mt-2 font-semibold">{model.label}</h3><p className="mt-3 font-mono text-2xl">{estimate.compatible ? `~$${estimate.cost.toFixed(3)}` : "—"}</p><p className="mt-1 text-xs text-muted">{estimate.basis}</p>{estimate.reasons.length > 0 && <ul className="mt-3 list-disc pl-4 text-sm text-warning">{estimate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}<p className="mt-3 text-sm text-muted">{model.bestFor}</p>{kind === "video" && <p className="mt-2 text-xs text-muted">{audioCapability(model.id).native ? "Native audio" : "Silent output"} · {audioCapability(model.id).refAudio ? "Audio references accepted" : "No audio-reference input"}</p>}<p className="mt-3 text-xs text-muted">Configuration review: 10 Sep 2026. Verify current vendor terms and rates.</p><div className="mt-4 flex flex-wrap gap-3"><a href={modelSource(model)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center text-sm text-accent underline">Provider source ↗</a><button className="btn-secondary" disabled={!estimate.compatible || !project} onClick={async () => { try { await saveDraft("routing", { modelId: model.id, kind, scenario, selectedAt: Date.now() }); router.push(kind === "image" ? (PACKSHOT_MODELS.includes(model.id) ? "/ai-studio/packshots" : "/ai-studio/studio") : kind === "video" ? "/ai-studio/ads" : "/ai-studio/ads#ad-sound"); } catch (e) { setMessage(e instanceof Error ? e.message : "The route could not be saved."); } }}>Use this route ↗</button></div></article>;
    })}</div>{message && <p role="alert" className="mt-4 text-sm text-danger">{message}</p>}<p className="mt-5 text-xs text-muted">The destination shows its own supported options and final estimate before any generation. Model access is verified by the provider only when a request is made.</p><Link className="mt-3 inline-flex min-h-9 items-center text-sm text-accent underline" href="/ai-studio/projects">Inspect the project’s actual inputs and results ↗</Link>
  </section>;
}
