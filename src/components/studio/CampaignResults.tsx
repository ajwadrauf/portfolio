"use client";

import { useEffect, useRef, useState } from "react";
import { DELIVERABLES } from "@/lib/deliverables";
import { MODELS, estimateCost } from "@/lib/models";
import { campaignDownloadSource, campaignMedia, isCompletedCampaignAsset, isRealHero, type CampaignJob, type CampaignSnapshot } from "@/lib/campaignWorkspace";

type Props = {
  jobs: CampaignJob[]; snapshots: Record<string, CampaignSnapshot>; busy: boolean; live: boolean;
  approvedHeroId: string | null; workflow: "batch" | "hero";
  onRecover: (job: CampaignJob) => void; onRetry: (job: CampaignJob) => void;
  onApprove: (job: CampaignJob) => void; onAnimate: (job: CampaignJob) => Promise<void>;
  onText: (job: CampaignJob, overlay: NonNullable<CampaignJob["textOverlay"]>) => Promise<void>;
  onBack: () => void; onReset: () => void;
};

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function CampaignResults({ jobs, snapshots, busy, live, approvedHeroId, workflow, onRecover, onRetry, onApprove, onAnimate, onText, onBack, onReset }: Props) {
  const [selection, setSelection] = useState<string[]>([]); const [inspecting, setInspecting] = useState<CampaignJob | null>(null);
  const [packing, setPacking] = useState(false); const [notice, setNotice] = useState("");
  const completed = jobs.filter(isCompletedCampaignAsset); const selected = completed.filter((job) => selection.includes(job.id));
  const done = jobs.filter((job) => job.status === "done" || job.status === "mock").length;
  const spent = jobs.reduce((sum, job) => sum + job.cost, 0);
  async function zipSelected() {
    if (!selected.length || packing) return; setPacking(true); setNotice("");
    try {
      const { zip, strToU8 } = await import("fflate"); const files: Record<string, Uint8Array> = {}; let bytes = 0;
      const manifest = [];
      for (const [index, job] of selected.entries()) {
        const source = campaignMedia(job)!;
        const response = await fetch(campaignDownloadSource(source, job.videoUrl ? "video" : "image"));
        if (!response.ok) throw new Error(`Could not collect ${job.deliverableId}. Open its download individually; its provider link may have expired.`);
        const blob = await response.blob(); bytes += blob.size;
        if (bytes > 160 * 1024 * 1024) throw new Error("This selection exceeds 160 MB. Download fewer assets per ZIP.");
        const type = blob.type.split(";")[0]; const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm" } as Record<string, string>)[type];
        if (!ext) throw new Error("Storage returned an unsupported file. Download the asset individually.");
        const name = `${String(index + 1).padStart(2, "0")}_${job.deliverableId}.${ext}`;
        files[name] = new Uint8Array(await blob.arrayBuffer());
        manifest.push({ file: name, jobId: job.id, model: job.modelId, estimatedCost: job.cost, prompt: job.prompt, textOverlay: job.textOverlay, approvedHeroId: snapshots[job.snapshotId]?.approvedHeroId, status: "Generated output · human review required" });
      }
      files["manifest.json"] = strToU8(JSON.stringify({ exportedAt: new Date().toISOString(), assets: manifest }, null, 2));
      files["README.txt"] = strToU8("Campaign Studio export\nSelected completed assets only. No mock previews, source references or API credentials are included.\nReview packaging, claims, bilingual copy and channel requirements before publishing. Video files contain their original embedded audio.\n");
      const archive = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => zip(files, { level: 0 }, (error, data) => error ? reject(error) : resolve(data as Uint8Array<ArrayBuffer>)));
      downloadBlob(new Blob([archive], { type: "application/zip" }), "campaign-selected-assets.zip"); setNotice(`${selected.length} completed assets exported with their manifest.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not prepare the ZIP."); }
    finally { setPacking(false); }
  }
  return <section className="mt-8" aria-labelledby="campaign-results-heading">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="label">Campaign contact sheet</p><h1 id="campaign-results-heading" className="mt-2 text-[1.75rem] tracking-[-0.03em]">{busy ? "Your campaign is taking shape." : "One direction. Every surface."}</h1><p className="mt-2 text-sm text-muted">{done}/{jobs.length} takes ready{spent > 0 && ` · ~$${spent.toFixed(2)} submitted`}. Drafts, receipts and completed files are saved with this project.</p></div>
      <div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={busy} onClick={onBack}>Edit brief & deliverables</button><button className="btn-secondary" disabled={busy} onClick={onReset}>Start another campaign</button></div>
    </div>
    {workflow === "hero" && !approvedHeroId && <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">Review the hero at full size, then choose <strong>Approve hero & choose adaptations</strong>. Adaptations use that actual image. Demo placeholders cannot be approved as production artwork.</div>}
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border-soft bg-surface-2 p-4">
      <button className="btn-secondary" disabled={!completed.length} onClick={() => setSelection(completed.map((job) => job.id))}>Select all completed</button>
      <button className="btn-secondary" disabled={!selection.length} onClick={() => setSelection([])}>Clear selection</button>
      <button className="btn-primary" disabled={!selected.length || packing} onClick={() => void zipSelected()}>{packing ? "Preparing files…" : `Download ${selected.length ? selected.length : "selected"} as ZIP ↓`}</button>
      <span className="text-xs text-muted">No new generation. Includes a source manifest.</span>
    </div>
    {notice && <p role="status" className="mt-3 text-sm text-muted">{notice}</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => <CampaignResultCard key={job.id} job={job} live={live} busy={busy} approved={approvedHeroId === job.id} selected={selection.includes(job.id)} onSelect={(value) => setSelection((previous) => value ? [...previous, job.id] : previous.filter((id) => id !== job.id))} onInspect={() => setInspecting(job)} onRecover={() => onRecover(job)} onRetry={() => onRetry(job)} onApprove={() => onApprove(job)} onAnimate={async () => { try { await onAnimate(job); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not send this asset."); } }} onText={(overlay) => onText(job, overlay)} />)}
    </div>
    {inspecting && <CampaignInspect job={jobs.find((job) => job.id === inspecting.id) ?? inspecting} onClose={() => setInspecting(null)} />}
  </section>;
}

function CampaignResultCard({ job, live, busy, approved, selected, onSelect, onInspect, onRecover, onRetry, onApprove, onAnimate, onText }: {
  job: CampaignJob; live: boolean; busy: boolean; approved: boolean; selected: boolean; onSelect: (value: boolean) => void;
  onInspect: () => void; onRecover: () => void; onRetry: () => void; onApprove: () => void; onAnimate: () => Promise<void>;
  onText: (overlay: NonNullable<CampaignJob["textOverlay"]>) => Promise<void>;
}) {
  const spec = DELIVERABLES.find((item) => item.id === job.deliverableId)!;
  const [showPrompt, setShowPrompt] = useState(false); const [text, setText] = useState(job.textOverlay?.text ?? "");
  const [position, setPosition] = useState<"top" | "bottom">(job.textOverlay?.position ?? "top");
  const [color, setColor] = useState<"ink" | "ivory">(job.textOverlay?.color ?? "ink");
  const [localBusy, setLocalBusy] = useState(false); const [error, setError] = useState("");
  const complete = isCompletedCampaignAsset(job); const media = campaignMedia(job);
  const readyToRecover = job.receipt && ["recoverable", "polling", "uncertain"].includes(job.status);
  const retryable = ["failed", "queued", "uncertain"].includes(job.status) && !readyToRecover;
  const cost = estimateCost(job.modelId, { seconds: spec.durationSeconds });
  async function applyText() { setLocalBusy(true); setError(""); try { await onText({ text, position, color }); } catch (error) { setError(error instanceof Error ? error.message : "Could not update the layout."); } finally { setLocalBusy(false); } }
  return <article className={`overflow-hidden rounded-xl border bg-surface ${approved ? "border-accent" : "border-border-soft"}`}>
    <div className="relative flex aspect-square items-center justify-center bg-surface-2 p-3">
      {media ? job.videoUrl ? <video src={job.videoUrl} controls playsInline preload="metadata" className="max-h-full w-full object-contain" /> : <button type="button" onClick={onInspect} className="h-full w-full" aria-label={`Inspect ${spec.label}`}><img src={media} alt={spec.label} className="h-full w-full object-contain" /></button> : <div className="px-4 text-center"><p className="text-sm font-semibold">{job.status === "running" ? "Generating…" : job.status === "polling" ? "Provider is rendering…" : job.status === "recoverable" ? "Saved render · ready to check" : job.status === "uncertain" ? "Submission needs checking" : job.status === "queued" ? "Not submitted yet" : "This take did not finish"}</p>{job.error && <p className="mt-2 text-xs leading-relaxed text-muted">{job.error}</p>}</div>}
      {job.status === "mock" && <span className="absolute left-3 top-3 rounded bg-warning px-2 py-1 text-xs font-semibold text-white">DEMO · no generated asset</span>}
      {complete && <label className="absolute left-3 top-3 flex min-h-11 items-center gap-2 rounded bg-surface/95 px-3 text-xs"><input type="checkbox" aria-label={`Select ${spec.label}`} checked={selected} onChange={(event) => onSelect(event.target.checked)} />Select</label>}
    </div>
    <div className="space-y-3 p-4">
      <div><h2 className="font-semibold">{spec.id === "social_cutdown" ? "Social variation (5s, 9:16)" : spec.label}</h2><p className="mt-1 text-xs text-muted">{job.textOverlay ? "Local layout · exact editable copy" : MODELS[job.modelId]?.label} · {job.cost > 0 ? `~$${job.cost.toFixed(2)}` : "$0"}{approved ? " · Approved hero" : ""}</p></div>
      {job.receipt && <details className="text-xs text-muted"><summary className="min-h-6 cursor-pointer">Saved request receipt</summary><p className="mt-2 break-all font-mono">{job.receipt.falRequestId ?? job.receipt.operationName}</p></details>}
      <div className="flex flex-wrap gap-2">
        {media && <button type="button" className="btn-secondary !text-xs" onClick={onInspect}>Inspect</button>}
        {complete && <a className="btn-secondary !text-xs" href={campaignDownloadSource(media!, job.videoUrl ? "video" : "image")} download={`${spec.id}.${job.videoUrl ? "mp4" : "png"}`}>Download ↓</a>}
        {readyToRecover && <button type="button" className="btn-primary !text-xs" disabled={busy} onClick={onRecover}>Check result · no charge</button>}
        {retryable && <button type="button" className="btn-secondary !text-xs" disabled={busy} onClick={onRetry}>{job.status === "queued" ? "Generate this item" : "Create a new attempt"} · {live ? `~$${cost.toFixed(2)}` : "demo"}</button>}
        {isRealHero(job) && !approved && <button type="button" className="btn-primary !text-xs" disabled={busy} onClick={onApprove}>Approve hero & choose adaptations →</button>}
        {complete && !job.videoUrl && <button type="button" className="btn-secondary !text-xs" disabled={busy || localBusy} onClick={() => void onAnimate()}>Animate in Ad Lab ↗</button>}
      </div>
      {job.status === "uncertain" && <p className="text-xs leading-relaxed text-warning">An earlier submission may have been billed. Check your provider history before choosing another paid attempt.</p>}
      {job.textOverlay && <details className="rounded border border-border-soft p-3"><summary className="min-h-6 cursor-pointer text-sm font-semibold">Edit exact headline · no AI charge</summary><label className="mt-3 block"><span className="label">Headline</span><textarea className="input mt-1" aria-label={`Headline for ${spec.label}`} maxLength={160} value={text} onChange={(event) => setText(event.target.value)} /></label><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs">Position<select className="input mt-1" value={position} onChange={(event) => setPosition(event.target.value as "top" | "bottom")}><option value="top">Above image</option><option value="bottom">Below image</option></select></label><label className="text-xs">Palette<select className="input mt-1" value={color} onChange={(event) => setColor(event.target.value as "ink" | "ivory")}><option value="ink">Ink on ivory</option><option value="ivory">Ivory on plum</option></select></label></div><button className="btn-secondary mt-3 !text-xs" disabled={localBusy || !text.trim()} onClick={() => void applyText()}>{localBusy ? "Updating…" : "Update layout · $0"}</button>{error && <p role="alert" className="mt-2 text-xs text-warning">{error}</p>}</details>}
      {job.prompt && <><button className="inline-flex min-h-6 items-center text-xs font-semibold text-muted underline" onClick={() => setShowPrompt((value) => !value)} aria-expanded={showPrompt}>{showPrompt ? "Hide" : "View"} submitted prompt</button>{showPrompt && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-2 p-3 text-xs">{job.prompt}</pre>}</>}
    </div>
  </article>;
}

function CampaignInspect({ job, onClose }: { job: CampaignJob; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const media = campaignMedia(job);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[92vh] w-[min(94vw,1000px)] overflow-auto rounded-xl border border-border-soft bg-surface p-5 text-foreground backdrop:bg-black/70"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">Full asset · {DELIVERABLES.find((item) => item.id === job.deliverableId)?.label}</h2><button autoFocus className="btn-secondary" onClick={onClose}>Close</button></div>{job.videoUrl ? <video src={job.videoUrl} controls playsInline className="mx-auto max-h-[70vh] max-w-full" /> : <img src={media} alt="Full uncropped campaign output" className="mx-auto max-h-[70vh] max-w-full object-contain" />}<p className="mt-3 text-sm text-muted">Inspect packaging, copy and product details before approving or using this asset.</p></dialog>;
}
