"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";
import { downloadStudioFile } from "@/lib/studioProjects";
import { PREFLIGHT_GROUPS, PREFLIGHT_VERSION } from "@/lib/adPreflight";
import { manualReviewProblems, readableManualReview, readManualReview, type ManualReview, type ManualCheck } from "@/lib/manualReview";

export function PreflightChecklist({ groups }: { groups: { group: string; items: string[] }[] }) {
  const { project, saveDraft } = useStudioProject();
  const [assetId, setAssetId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [version, setVersion] = useState("v1");
  const [review, setReview] = useState<ManualReview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const loadKey = useRef("");
  const readyAssets = project?.assets.filter((a) => a.status === "ready" && a.kind !== "document") ?? [];
  const asset = readyAssets.find((a) => a.id === assetId);
  const rows = groups.flatMap((g) => g.items.map((title) => ({ key: PREFLIGHT_GROUPS.flatMap((group) => [...group.items]).find((item) => item.title === title)?.id ?? `${g.group}:${title}`, title })));
  const source = asset?.url ?? asset?.dataUrl ?? `External record: ${externalName}`;
  useEffect(() => { setAssetId(""); setExternalName(""); setVersion("v1"); setReview(null); loadKey.current = ""; setMessage(""); }, [project?.id]);
  useEffect(() => {
    if (!project || (!asset && !externalName.trim())) { setReview(null); return; }
    let cancelled = false;
    setReview(null);
    void (async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
      const identity = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const key = `${project.id}:${asset?.id ?? externalName}:${version}:${identity}`;
      if (cancelled || loadKey.current === key) return;
      loadKey.current = key;
      const saved = project.drafts.manualReviews as Record<string, ManualReview> | undefined;
      const stored = readManualReview(saved?.[key]);
      setReview(stored && stored.sourceIdentity === identity && stored.assetVersion === version && stored.checklistVersion === PREFLIGHT_VERSION ? stored : { assetId: asset?.id ?? `external:${externalName.trim()}`, assetName: asset?.name ?? externalName.trim(), assetVersion: version, sourceIdentity: identity, reviewer: "", decision: "draft", checks: {}, notes: "", checklistVersion: PREFLIGHT_VERSION });
      setMessage("");
    })().catch(() => setMessage("The asset identity could not be established. Use a secure connection and retry."));
    return () => { cancelled = true; };
  }, [project?.id, asset?.id, externalName, version, source]);
  function update(patch: Partial<ManualReview>) { setReview((r) => r ? { ...r, ...patch, decision: patch.decision ?? "draft", decidedAt: undefined } : null); }
  async function save() {
    if (!project || !review) return;
    const problems = manualReviewProblems(review, rows.map((r) => r.key));
    if (problems.length) { setMessage(problems.join(" ")); return; }
    const originalKey = loadKey.current;
    setBusy(true);
    try {
      const recorded = { ...review, decidedAt: review.decision === "draft" ? undefined : new Date().toISOString() };
      await saveDraft("manualReviews", { ...(project.drafts.manualReviews as Record<string, ManualReview> ?? {}), [originalKey]: recorded });
      if (loadKey.current === originalKey) { setReview(recorded); setMessage("Review saved for this asset version. No AI request was made."); }
    } catch (e) { setMessage(e instanceof Error ? e.message : "The review could not be saved."); }
    finally { setBusy(false); }
  }
  const resolved = rows.filter((row) => review?.checks[row.key] && review.checks[row.key].status !== "pending").length;
  return <div className="rounded-md border border-border-soft p-5">
    <p className="label !text-accent">Human review record</p><h3 className="mt-2 text-xl">Tie the decision to the actual asset.</h3><p className="mt-3 text-sm leading-relaxed text-muted">AI observations stay with the take in Ad Lab. Record evidence and the accountable human decision here. A new asset version starts a separate review.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Project asset<select className="input mt-1" value={assetId} onChange={(e) => { setAssetId(e.target.value); setExternalName(""); }}><option value="">External asset / choose below</option>{readyAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="text-sm">Asset version<input className="input mt-1" maxLength={80} value={version} onChange={(e) => setVersion(e.target.value)} /></label>{!asset && <label className="text-sm sm:col-span-2">External asset name or DAM identifier<input className="input mt-1" placeholder="Campaign / asset ID / filename" value={externalName} maxLength={180} onChange={(e) => setExternalName(e.target.value)} /></label>}</div>
    {!review ? <p className="mt-5 rounded bg-surface-2 p-4 text-sm text-muted">Select a completed asset or name an external asset to begin. VELUNE’s pending film cannot be approved before it exists. <Link href="/ai-studio/projects" className="text-accent underline">Open project assets ↗</Link></p> : <>
      <p className="my-5 text-sm" aria-live="polite">{resolved} of {rows.length} checks addressed · {review.decision === "approved" && review.decidedAt ? "Human approval recorded" : "Review in progress"}</p>
      <div className="space-y-3">{groups.map((group, index) => <details key={group.group} className="rounded border border-border-soft p-4" open={index === 0}><summary className="cursor-pointer font-semibold">{group.group}</summary><div className="mt-4 space-y-5">{group.items.map((title) => {
        const row = rows.find((r) => r.title === title)!; const check = review.checks[row.key] ?? { status: "pending", evidence: "" };
        const change = (patch: Partial<ManualCheck>) => update({ checks: { ...review.checks, [row.key]: { ...check, ...patch } } });
        return <div key={row.key} className="border-t border-border-soft pt-4"><label className="text-sm font-medium" htmlFor={`review-${row.key}`}>{title}</label><select id={`review-${row.key}`} className="input mt-2" value={check.status} onChange={(e) => change({ status: e.target.value as ManualCheck["status"] })}><option value="pending">Unverified / not reviewed</option><option value="pass">Human confirmed</option><option value="flag">Needs changes</option><option value="not_applicable">Not applicable — explain below</option></select><textarea className="input mt-2" rows={2} aria-label={`Evidence for ${title}`} placeholder="Source record, evidence link, timecode, or why this does not apply" maxLength={2000} value={check.evidence} onChange={(e) => change({ evidence: e.target.value })} /></div>;
      })}</div></details>)}</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm">Human reviewer<input className="input mt-1" value={review.reviewer} maxLength={120} onChange={(e) => update({ reviewer: e.target.value })} /></label><label className="text-sm">Decision<select className="input mt-1" value={review.decision} onChange={(e) => update({ decision: e.target.value as ManualReview["decision"] })}><option value="draft">Save as draft</option><option value="changes_required">Changes required</option><option value="approved">Approve this asset version</option></select></label><label className="text-sm sm:col-span-2">Reviewer notes<textarea className="input mt-1" rows={3} maxLength={4000} value={review.notes} onChange={(e) => update({ notes: e.target.value })} /></label></div>
      <div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save review record"}</button><button className="btn-secondary" onClick={() => { const valid = manualReviewProblems(review, rows.map((r) => r.key)); const exportReview = review.decidedAt && !valid.length ? review : { ...review, decision: "draft" as const, decidedAt: undefined }; downloadStudioFile("human-review.md", readableManualReview(exportReview, rows), "text/markdown"); }}>Export review</button></div><p className="mt-3 text-xs text-muted">Source identity hashes the selected file data or source URL. A URL identifier does not prove remote file integrity. Evidence and approvals are user-declared, not legal certification.</p>
    </>}{message && <p role="status" className="mt-4 text-sm text-accent">{message}</p>}
  </div>;
}
