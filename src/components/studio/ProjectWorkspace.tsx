"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStudioProject } from "./StudioProjectProvider";
import { VeluneExampleButton } from "./ProjectDock";
import { downloadStudioFile, portableProject, veluneVisualAssets, type StudioAsset } from "@/lib/studioProjects";
import { VELUNE_SHOTS } from "@/components/velune/veluneStudy";

const DESTINATIONS = [
  { name: "Packshots", href: "/ai-studio/packshots", task: "Prepare the product" },
  { name: "Campaign Studio", href: "/ai-studio/studio", task: "Choose a hero & adapt" },
  { name: "Blender", href: "/ai-studio/blender#builder", task: "Rehearse the camera" },
  { name: "Prompt Builder", href: "/ai-studio/prompts", task: "Bind the references" },
  { name: "Ad Lab", href: "/ai-studio/ads", task: "Picture, sound & AI review" },
  { name: "Playbook", href: "/ai-studio/playbook#preflight", task: "Record the decision" },
];
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const assetSource = (a: StudioAsset) => a.dataUrl || a.url || "";

export function ProjectWorkspace() {
  const { project, ready, saveAsset, removeAsset, removeProject } = useStudioProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef<HTMLVideoElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [includePrompt, setIncludePrompt] = useState(false);
  const [includeReviews, setIncludeReviews] = useState(false);
  const [guideId, setGuideId] = useState("");
  const [resultId, setResultId] = useState("");
  useEffect(() => { setSelected([]); setIncludePrompt(false); setIncludeReviews(false); setGuideId(""); setResultId(""); setMessage(""); }, [project?.id]);
  if (!ready) return <p className="p-8" role="status">Opening your project…</p>;
  if (!project) return <p className="p-8">Project storage is unavailable. Use the storage message above to restore access.</p>;
  const videos = project.assets.filter((a) => a.kind === "video" && a.status === "ready");
  const guide = videos.find((a) => a.id === guideId) ?? videos.find((a) => a.source === "blender");
  const result = videos.find((a) => a.id === resultId) ?? videos.find((a) => a.source === "generated" || a.source === "uploaded");
  const completed = project.assets.filter((a) => a.status === "ready");
  const ad = project.drafts.ad as Record<string, unknown> | undefined;
  const prompt = typeof ad?.prompt === "string" ? ad.prompt : "No creative direction saved in this project yet.";

  const humanReviews = project.drafts.manualReviews ?? {};
  const missingVeluneReferences = project.example === "velune" ? veluneVisualAssets().filter((asset) => !project.assets.some((existing) => existing.id === asset.id)) : [];

  async function addVisualReferences() {
    setBusy(true); setMessage("");
    try {
      for (const asset of missingVeluneReferences) await saveAsset(asset);
      setMessage("Visual references added. Your existing drafts and assigned files were preserved; choose the new assets in each tool when ready.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Some references could not be added. Retry to add the remaining files."); }
    finally { setBusy(false); }
  }

  async function attach(file: File) {
    if (!project) return;
    setBusy(true); setMessage("");
    try {
      if (!file.size || file.size > 64 * 1024 * 1024) throw new Error("Choose a media file up to 64 MB. For larger films, use the original host link in your production handoff.");
      const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document";
      if (target === "velune-final" && kind !== "video") throw new Error("Attach the actual finished MP4 or WebM film to this slot.");
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("The file could not be read.")); reader.readAsDataURL(file); });
      await saveAsset({ id: target ?? crypto.randomUUID(), name: target === "velune-final" ? "VELUNE · supplied Seedance film" : file.name, kind, dataUrl, source: "uploaded", status: "ready", role: target === "velune-final" ? "Finished film supplied by Ajwad; review before publication" : "Assign this asset a role in the destination tool", metadata: { fileName: file.name, addedAt: new Date().toISOString() } });
      setMessage("Saved to this project. This upload stays on this device; it does not publish or generate anything.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "The file could not be saved."); }
    finally { setBusy(false); setTarget(null); }
  }
  function exportCaseStudy() {
    if (!project) return;
    const assets = completed.filter((a) => selected.includes(a.id));
    const media = assets.map((a) => {
      const src = assetSource(a);
      const absolute = src.startsWith("/") ? new URL(src, window.location.origin).href : src;
      const visual = a.kind === "image" ? `<img src="${escapeHtml(absolute)}" alt="${escapeHtml(a.name)}" loading="lazy">` : a.kind === "video" ? `<video controls preload="metadata" src="${escapeHtml(absolute)}"></video>` : a.kind === "audio" ? `<audio controls src="${escapeHtml(absolute)}"></audio>` : `<a download href="${escapeHtml(absolute)}">Open document</a>`;
      return `<article><h2>${escapeHtml(a.name)}</h2><p>${escapeHtml(a.source)} · ${escapeHtml(a.role ?? "")}</p>${visual}${a.metadata ? `<details><summary>Saved source / generation record</summary><pre>${escapeHtml(JSON.stringify(a.metadata, null, 2))}</pre></details>` : ""}</article>`;
    }).join("");
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.name)} — Making of</title><style>body{background:#f6f3ec;color:#252320;font:17px/1.6 system-ui;margin:0 auto;padding:6vw;max-width:1100px}h1{font-size:clamp(36px,7vw,72px);line-height:1.05}article{border-top:1px solid #d4cec5;padding:28px 0}img,video{max-width:100%;max-height:70vh;display:block;background:#111}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:24px;background:#eee8df}small{color:#666}</style><p>AI CONTENT STUDIO · MAKING OF</p><h1>${escapeHtml(project.name)}</h1><p>Selected production assets. Each pass is labelled by how it was made. This page is a presentation, not an approval record.</p>${media}${includePrompt ? `<article><h2>Direction saved with this project</h2><p>Creative direction may differ from a submitted API request. Consult the take's generation record for exact settings.</p><pre>${escapeHtml(prompt)}</pre></article>` : ""}${includeReviews ? `<article><h2>Human review records</h2><p>User-declared decisions for the named asset versions.</p><pre>${escapeHtml(JSON.stringify(humanReviews, null, 2))}</pre></article>` : ""}<small>Exported ${new Date().toISOString().slice(0, 10)} · Ajwad Rauf · Remote media requires its host to remain available.</small></html>`;
    downloadStudioFile("making-of.html", html, "text/html");
    setMessage("Making-of page exported with only the assets you selected. Nothing was published.");
  }

  return <div className="mx-auto max-w-6xl px-6 py-12">
    <p className="chip">One project · Every stage</p><h1 className="mt-5 text-[clamp(2.2rem,5vw,4rem)] leading-tight tracking-tight">{project.name}</h1>
    <p className="mt-4 max-w-2xl text-lg text-muted">Keep the source, the decisions and the finished work together. Continue in any tool with this project selected.</p>
    <div className="mt-7 flex flex-wrap gap-3"><VeluneExampleButton /><button className="btn-secondary" onClick={() => downloadStudioFile("project.studio.json", JSON.stringify(portableProject(project), null, 2))}>Export editable project</button><button className="btn-secondary" disabled={busy} onClick={() => { setTarget(null); fileRef.current?.click(); }}>Add an asset</button></div>
    <input ref={fileRef} className="sr-only" type="file" aria-label="Add project media" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/wav,audio/mpeg,audio/ogg,application/pdf,application/json" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void attach(file); }} />
    {message && <p role="status" className="mt-4 text-sm text-accent">{message}</p>}
    {project.example === "velune" && <div className="mt-5 rounded-md border border-border-soft bg-surface p-5"><p className="font-semibold">Eight images. Eight specific jobs.</p><p className="mt-2 text-sm text-muted">The supplied AI references define the packaging, bonbon, fillings, cast and scene design. The Blender guide remains the motion plan. New example copies include all eight; existing drafts keep their current assignments.</p><div className="mt-3 flex flex-wrap gap-3">{missingVeluneReferences.length > 0 && <button className="btn-secondary" disabled={busy} onClick={() => void addVisualReferences()}>{busy ? "Adding references…" : `Add ${missingVeluneReferences.length} visual references to this project`}</button>}<Link href="/velune#visual-references" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">See what each reference directs ↗</Link></div></div>}
    <nav aria-label="Continue this project" className="my-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{DESTINATIONS.map((d, i) => <Link key={d.href} href={d.href} className="card p-5 transition hover:border-accent"><span className="label-sm">0{i + 1} · {d.task}</span><strong className="mt-2 flex justify-between text-lg">{d.name}<span aria-hidden>↗</span></strong></Link>)}</nav>

    <section aria-labelledby="project-assets"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="project-assets" className="text-2xl">The project assets</h2><span className="label-sm">{completed.length} ready · {project.assets.length - completed.length} pending</span></div>
      <p className="mt-3 text-sm text-muted">Choose assets below to include in your making-of export. Sources start unselected. Concept artwork and unfinished files keep their labels.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{project.assets.map((asset) => <article key={asset.id} className="card overflow-hidden">
        <div className="flex aspect-video items-center justify-center overflow-hidden bg-surface-2">{asset.status === "pending" ? <p className="p-6 text-center text-muted">Awaiting the finished Seedance film</p> : asset.kind === "image" ? <img src={assetSource(asset)} alt={asset.name} className="h-full w-full object-contain" loading="lazy" /> : asset.kind === "video" ? <video src={assetSource(asset)} controls playsInline preload="none" className="h-full w-full bg-black object-contain" /> : asset.kind === "audio" ? <audio controls preload="none" src={assetSource(asset)} className="max-w-full" /> : <a className="btn-secondary" href={assetSource(asset)} download={asset.name}>Download document ↗</a>}</div>
        <div className="p-4"><p className="label-sm">{asset.source} · {asset.status === "pending" ? "Pending" : "Available"}</p><h3 className="mt-2 font-semibold">{asset.name}</h3><p className="mt-2 text-sm text-muted">{asset.role}</p>
          {asset.status === "ready" ? <label className="mt-4 flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(asset.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, asset.id] : ids.filter((id) => id !== asset.id))} />Include in making-of export</label> : <button className="btn-secondary mt-4" disabled={busy} onClick={() => { setTarget(asset.id); fileRef.current?.click(); }}>Attach finished film</button>}
          {asset.metadata && <details className="mt-3"><summary className="cursor-pointer text-sm underline">Source & generation record</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(asset.metadata, null, 2)}</pre></details>}
          {asset.source === "uploaded" && <button className="mt-2 min-h-9 text-sm text-muted underline" onClick={() => void removeAsset(asset.id).catch((e) => setMessage(e.message))}>Remove from project</button>}
        </div></article>)}</div>
      {!project.assets.length && <p className="mt-5 rounded border border-dashed border-border-soft p-8 text-muted">Add a source asset, send a completed packshot, or load VELUNE to explore the workflow.</p>}
    </section>

    <section className="mt-14 border-t border-border-soft pt-10" aria-labelledby="project-making"><p className="label !text-accent">Show how it was made</p><h2 id="project-making" className="mt-2 text-3xl">From the plan to the finished film.</h2>
      <p className="mt-3 max-w-3xl text-muted">Inspect the motion guide beside a completed result. Shot cues describe the plan; a generated film can interpret its timing differently.</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2"><div><label>Motion guide<select className="input my-2" value={guide?.id ?? ""} onChange={(e) => setGuideId(e.target.value)}><option value="">Choose a guide</option>{videos.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>{guide ? <video ref={guideRef} controls playsInline preload="none" src={assetSource(guide)} className="aspect-video w-full bg-black" /> : <div className="aspect-video bg-surface-2 p-8">Add a Blender motion guide.</div>}</div><div><label>Finished result<select className="input my-2" value={result?.id ?? ""} onChange={(e) => setResultId(e.target.value)}><option value="">Choose a finished film</option>{videos.filter((v) => v.source !== "blender").map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>{result ? <video ref={resultRef} controls playsInline preload="none" src={assetSource(result)} className="aspect-video w-full bg-black" /> : <div className="flex aspect-video items-center justify-center border border-dashed border-border-strong bg-surface-2 p-8 text-center text-muted">{project.example === "velune" ? "Your VELUNE Seedance film will appear here when you attach it." : "Add a finished film to compare with the guide."}</div>}</div></div>
      <div className="mt-4 flex flex-wrap gap-3"><button className="btn-secondary" disabled={!guide || !result} onClick={() => { for (const v of [guideRef.current, resultRef.current]) if (v) { v.currentTime = 0; v.muted = v === guideRef.current; void v.play().catch(() => setMessage("Press play on each video to allow playback in this browser.")); } }}>Play both from start</button><button className="btn-secondary" onClick={() => { guideRef.current?.pause(); resultRef.current?.pause(); }}>Pause both</button></div>
      {project.example === "velune" && <div className="mt-5 flex flex-wrap gap-2" aria-label="VELUNE planned shots">{VELUNE_SHOTS.map((shot) => <button key={shot.id} className="btn-secondary !px-3 text-xs" onClick={() => { for (const v of [guideRef.current, resultRef.current]) if (v) { v.pause(); v.currentTime = Math.min(shot.start / 24, Number.isFinite(v.duration) ? v.duration : shot.start / 24); } }}>{shot.id} · {shot.title} · {(shot.start / 24).toFixed(2)}s</button>)}</div>}
      <details className="mt-7 rounded border border-border-soft p-5"><summary className="cursor-pointer font-semibold">Direction & project record</summary><pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{prompt}</pre><p className="mt-3 text-sm text-muted">Exact submitted requests and review evidence stay with their take in Ad Lab. This saved direction can continue evolving after a render.</p></details>
      <details className="mt-4 rounded border border-border-soft p-5"><summary className="cursor-pointer font-semibold">Human review records</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(humanReviews, null, 2)}</pre><Link href="/ai-studio/playbook#preflight" className="mt-3 inline-flex min-h-9 items-center text-sm text-accent underline">Record an asset review ↗</Link></details>
      <div className="mt-6 flex flex-wrap items-center gap-4"><label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={includeReviews} onChange={(e) => setIncludeReviews(e.target.checked)} />Include human review records</label><label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={includePrompt} onChange={(e) => setIncludePrompt(e.target.checked)} />Include saved creative direction</label><button className="btn-primary" disabled={!selected.length} onClick={exportCaseStudy}>Export making-of page · {selected.length} assets</button></div><p className="mt-3 text-xs text-muted">Exports an HTML page on your device. Review the selected sources before sharing; this action does not publish them.</p>
    </section>
    <details className="mt-12 border-t border-border-soft pt-5"><summary className="cursor-pointer text-sm text-muted">Project storage</summary><p className="my-3 text-sm">Delete only removes this local project copy. Export it first if you need to keep its drafts and media.</p><button className="btn-secondary" onClick={() => { if (window.confirm(`Delete the local project “${project.name}”? Its saved drafts and media will be removed from this browser.`)) void removeProject(project.id).catch((e) => setMessage(e.message)); }}>Delete local project</button></details>
  </div>;
}
