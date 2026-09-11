"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PREFLIGHT_VERSION, type CompletedPreflightTake, type PreflightFinding, type PreflightReport } from "@/lib/adPreflight";
import { requestLiveUnlock, type Health } from "@/lib/useHealth";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";
import { adDocumentDataUrl } from "@/lib/adDraft";

type Declarations = {
  productKind: "unknown" | "real" | "fictional";
  channel: "unknown" | "portfolio" | "social" | "olv" | "broadcast";
};
type ReferenceImage = { name: string; role: string; dataUrl: string };
type SavedReview = {
  videoUrl: string;
  takeId: string;
  report: PreflightReport;
  declarations: Declarations;
  reviewer: string;
  notes: string;
};
type PendingReview = { videoUrl: string; requestId: string; startedAt: string };
type Props = {
  take: CompletedPreflightTake;
  metadata: { durationSeconds: number; width: number; height: number } | null;
  referenceImages: ReferenceImage[];
  health: Health | null;
  onSpend: (cost: number) => void;
  onSeek: (seconds: number) => void;
};

const REPORTS_KEY = "adlab-preflight-reports-v1";
const PENDING_KEY = "adlab-preflight-pending-v1";
const STATUS = {
  flag: { label: "Flagged", symbol: "!", style: "border-danger/25 bg-danger/[0.06] text-danger" },
  unverified: { label: "Needs review", symbol: "?", style: "border-warning/25 bg-warning/[0.06] text-warning" },
  pass: { label: "AI observation passed", symbol: "✓", style: "border-success/25 bg-success/[0.06] text-success" },
  not_applicable: { label: "Not applicable", symbol: "—", style: "border-border-soft bg-surface-2 text-muted" },
} as const;
const BASIS = { ai: "AI observation", metadata: "File / request metadata", human_required: "Human evidence required" } as const;
const EMPTY_DECLARATIONS: Declarations = { productKind: "unknown", channel: "unknown" };

function readStorage<T>(key: string): T[] {
  try { const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(saved) ? saved.filter((item) => item && typeof item === "object") : []; }
  catch { return []; }
}

function saveReview(review: SavedReview) {
  const records = readStorage<SavedReview>(REPORTS_KEY);
  localStorage.setItem(REPORTS_KEY, JSON.stringify([review, ...records.filter((saved) => saved.videoUrl !== review.videoUrl)].slice(0, 12)));
}

/** A stale or partially written browser record must not break the Ad Lab. */
function validReport(value: unknown, videoUrl: string): value is PreflightReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<PreflightReport>;
  return report.videoUrl === videoUrl && report.checklistVersion === PREFLIGHT_VERSION &&
    typeof report.id === "string" && typeof report.assetKey === "string" &&
    typeof report.model === "string" && typeof report.summary === "string" &&
    typeof report.createdAt === "string" && Number.isFinite(Date.parse(report.createdAt)) &&
    typeof report.estimatedCostUsd === "number" && Number.isFinite(report.estimatedCostUsd) &&
    Boolean(report.coverage && Number.isFinite(report.coverage.durationSeconds) &&
      Number.isFinite(report.coverage.sampleFps) && Array.isArray(report.coverage.limitations) &&
      report.coverage.limitations.every((limit) => typeof limit === "string")) &&
    Array.isArray(report.checks) && report.checks.length > 0 && report.checks.every((check) =>
      check && typeof check.id === "string" && typeof check.group === "string" &&
      typeof check.title === "string" && Object.hasOwn(STATUS, check.status) &&
      Object.hasOwn(BASIS, check.basis) && typeof check.evidence === "string" &&
      typeof check.action === "string" && Array.isArray(check.timestamps));
}

function stamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

function readableReport(saved: SavedReview, take: CompletedPreflightTake): string {
  const { report } = saved;
  return [
    "# Ad Lab · AI-assisted preflight",
    "",
    "This is an evidence review, not publishing approval. AI findings may miss issues. Rights, consent and final approval require a named human.",
    "",
    `Reviewed: ${report.createdAt}`,
    `Take: ${take.id}`,
    `Video: ${report.videoUrl}`,
    `Reviewer model: ${report.model}`,
    `Checklist version: ${report.checklistVersion}`,
    `Review input fingerprint: ${report.assetKey} (request and reference fingerprint; not a hash of the video file)`,
    `Result: ${report.overall === "issues_found" ? "Issues found" : "Human review required"}`,
    `Scope: final MP4, ${report.coverage.sampleFps} video samples/second, embedded audio only; ${report.coverage.referenceImages} product reference images. Separate music, voice and effects are outside this review.`,
    `User-declared product: ${saved.declarations.productKind}; channel: ${saved.declarations.channel}. These declarations are not independently verified.`,
    "",
    report.summary,
    "",
    ...report.checks.flatMap((check) => [
      `## ${check.group} · ${check.title}`,
      `**${check.status === "pass" && check.basis === "metadata" ? "Metadata check passed" : STATUS[check.status]?.label ?? "Needs review"}** — ${BASIS[check.basis] ?? "Unknown basis"}`,
      check.evidence,
      ...(check.timestamps.length ? [`Review at: ${check.timestamps.map(stamp).join(", ")}`] : []),
      `Next step: ${check.action}`,
      "",
    ]),
    "## Limits of this review",
    ...report.coverage.limitations.map((limit) => `- ${limit}`),
    "",
    "## Original generation context",
    ...(take.context ? [
      `Submitted: ${take.context.submittedAt}`,
      `Model: ${take.context.modelId}; ${take.context.durationSeconds}s; ${take.context.aspect}; ${take.context.resolution ?? "resolution not recorded"}.`,
      `Sound direction mode: ${take.context.audioMode ?? "not recorded"}.`,
      ...take.context.references.map((reference) => `Source reference: ${reference.name} · ${reference.media} · ${reference.role}`),
      "",
      take.context.prompt,
    ] : ["Original brief and settings unavailable. The current form was not used as a substitute."]),
    "",
    "## Human follow-up · separate from the AI findings",
    `Reviewer: ${saved.reviewer || "Not recorded"}`,
    saved.notes || "No human notes recorded. No approval recorded.",
  ].join("\n");
}

/** Small copies of the original submitted images; nothing from the live form. */
async function prepareReferences(images: ReferenceImage[]): Promise<ReferenceImage[]> {
  return Promise.all(images.slice(0, 3).map(async (ref) => {
    const image = new Image();
    image.src = ref.dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the original product references. Reload and recover this take to review without reference images.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.88;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 550_000 && quality > 0.35) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > 550_000) throw new Error("An original product reference is too large for this review. Recover the take after reloading to review without reference images.");
    return { name: ref.name, role: ref.role, dataUrl };
  }));
}

export function AdPreflight({ take, metadata, referenceImages, health, onSpend, onSeek }: Props) {
  const { project, saveAsset } = useStudioProject();
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [declarations, setDeclarations] = useState<Declarations>(EMPTY_DECLARATIONS);
  const [reviewedDeclarations, setReviewedDeclarations] = useState<Declarations>(EMPTY_DECLARATIONS);
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"attention" | "all" | "pass">("attention");
  const requestLock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const projectSaved = project?.assets.find((asset) => asset.id === `ad-review-${take.id}`.slice(0, 200))?.metadata?.review as SavedReview | undefined;
    const saved = readStorage<SavedReview>(REPORTS_KEY).find((item) => item.videoUrl === take.videoUrl && item.takeId === take.id) ?? projectSaved;
    if (saved && validReport(saved.report, take.videoUrl)) {
      setReport(saved.report);
      setDeclarations(saved.declarations ?? EMPTY_DECLARATIONS);
      setReviewedDeclarations(saved.declarations ?? EMPTY_DECLARATIONS);
      setReviewer(typeof saved.reviewer === "string" ? saved.reviewer : "");
      setNotes(typeof saved.notes === "string" ? saved.notes : "");
    }
    setPending(readStorage<PendingReview>(PENDING_KEY).find((item) => item.videoUrl === take.videoUrl) ?? null);
    setLoaded(true);
    return () => { mounted.current = false; };
  }, [take.id, take.videoUrl]);

  useEffect(() => {
    if (!loaded || !report) return;
    const review: SavedReview = { takeId: take.id, videoUrl: take.videoUrl, report, declarations: reviewedDeclarations, reviewer, notes };
    try { saveReview(review); }
    catch { setMessage("Browser storage is unavailable. Download the report to keep it."); }
    void saveAsset({ id: `ad-review-${take.id}`.slice(0, 200), name: "Ad Lab · AI-assisted video preflight", kind: "document", dataUrl: adDocumentDataUrl(review), role: "Video evidence review · embedded audio only; human approval remains separate", source: "generated", status: "ready", metadata: { review, takeId: take.id, videoUrl: take.videoUrl, reviewType: "ai_preflight", approval: false } }).catch((e) => setMessage(`Review is available here, but its project save failed: ${e instanceof Error ? e.message : "storage unavailable"}`));
  }, [loaded, report, reviewedDeclarations, reviewer, notes, take.id, take.videoUrl, saveAsset]);

  const counts = useMemo(() => ({
    flag: report?.checks.filter((check) => check.status === "flag").length ?? 0,
    unverified: report?.checks.filter((check) => check.status === "unverified").length ?? 0,
    pass: report?.checks.filter((check) => check.status === "pass").length ?? 0,
    not_applicable: report?.checks.filter((check) => check.status === "not_applicable").length ?? 0,
  }), [report]);
  const groups = useMemo(() => {
    const visible = report?.checks.filter((check) => filter === "all" || (filter === "pass" ? check.status === "pass" : check.status === "flag" || check.status === "unverified")) ?? [];
    return [...new Set(visible.map((check) => check.group))].map((group) => ({ group, checks: visible.filter((check) => check.group === group).sort((a, b) => Number(b.status === "flag") - Number(a.status === "flag")) }));
  }, [report, filter]);
  const canReview = Boolean(health?.live && health.gemini && metadata && Number.isFinite(metadata.durationSeconds) && metadata.durationSeconds > 0 && metadata.durationSeconds <= 60);
  const changedDeclarations = Boolean(report && JSON.stringify(declarations) !== JSON.stringify(reviewedDeclarations));

  async function runReview() {
    if (requestLock.current || !canReview || !metadata) return;
    if ((pending || report) && !window.confirm(pending
      ? "The previous review did not return a saved result. A new review can incur another Gemini analysis charge. Start a new review?"
      : "Run a new AI review of this same take? This incurs another small Gemini analysis charge.")) return;
    requestLock.current = true;
    setBusy(true); setError(""); setMessage("");
    let sent = false;
    try {
      const prepared = await prepareReferences(referenceImages);
      const receipt: PendingReview = { videoUrl: take.videoUrl, requestId: crypto.randomUUID(), startedAt: new Date().toISOString() };
      setPending(receipt);
      try { localStorage.setItem(PENDING_KEY, JSON.stringify([receipt, ...readStorage<PendingReview>(PENDING_KEY).filter((item) => item.videoUrl !== take.videoUrl)].slice(0, 12))); }
      catch {
        setPending(null);
        throw new Error("This browser could not save the review receipt, so no AI review was started. Allow site storage or free some browser storage, then try again. You can still download the video above.");
      }
      sent = true;
      const response = await fetch("/api/ad/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: receipt.requestId, videoUrl: take.videoUrl, context: take.context, metadata, declarations, referenceImages: prepared }),
        signal: AbortSignal.timeout(150_000),
      });
      const result = await response.json() as { report?: PreflightReport; cost?: number; error?: string; code?: string; spendAttempted?: boolean };
      if (!response.ok || !result.report) {
        // An explicit gate/config rejection made no provider request. An
        // ambiguous server/network failure retains its marker and never retries.
        if (result.spendAttempted === false) {
          try { localStorage.setItem(PENDING_KEY, JSON.stringify(readStorage<PendingReview>(PENDING_KEY).filter((item) => item.videoUrl !== take.videoUrl))); } catch { /* Optional storage. */ }
          if (mounted.current) setPending(null);
        }
        throw new Error(result.error ?? "The review did not return a result. It has not been retried automatically.");
      }
      if (!validReport(result.report, take.videoUrl) || result.report.id !== receipt.requestId) throw new Error("The returned review could not be matched to this take. It has not been applied.");
      const saved: SavedReview = { takeId: take.id, videoUrl: take.videoUrl, report: result.report, declarations, reviewer: "", notes: "" };
      try {
        saveReview(saved);
        localStorage.setItem(PENDING_KEY, JSON.stringify(readStorage<PendingReview>(PENDING_KEY).filter((item) => item.videoUrl !== take.videoUrl)));
      } catch { if (mounted.current) setMessage("Review complete. Download it to keep a copy; browser storage is unavailable."); }
      if (mounted.current) {
        setReport(result.report); setReviewedDeclarations(declarations); setPending(null); setReviewer(""); setNotes(""); setFilter("attention");
        onSpend(result.report.estimatedCostUsd);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && cause.name === "TimeoutError"
        ? "The review has not returned. It may still have incurred an analysis charge. No retry was made; you can choose to start a new review."
        : cause instanceof Error ? cause.message : sent ? "Connection interrupted. No review was applied and no automatic retry was made." : "Could not prepare this review.");
    } finally { requestLock.current = false; if (mounted.current) setBusy(false); }
  }

  function savedReport(): SavedReview | null {
    return report ? { takeId: take.id, videoUrl: take.videoUrl, report, declarations: reviewedDeclarations, reviewer, notes } : null;
  }
  async function copyReport() {
    const saved = savedReport(); if (!saved) return;
    try { await navigator.clipboard.writeText(readableReport(saved, take)); setMessage("Full report copied, including unresolved checks and review limits."); }
    catch { setMessage("Clipboard unavailable. Download the report instead."); }
  }
  function downloadReport() {
    const saved = savedReport(); if (!saved) return;
    const url = URL.createObjectURL(new Blob([readableReport(saved, take)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `ad-preflight-${report!.createdAt.slice(0, 10)}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Report downloaded. Keep it with the delivered asset and its source records.");
  }

  return <section id="ad-preflight" aria-labelledby="ad-preflight-title" aria-busy={busy} className="mb-6 overflow-hidden rounded-xl border border-border-soft">
    <div className="relative overflow-hidden bg-foreground px-5 py-6 text-background sm:px-6">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-current/10"><div className="absolute inset-5 rounded-full border border-current/10" /><div className="absolute inset-10 rounded-full border border-current/10" /></div>
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">After the render · Before it ships</p>
        <Link href="/ai-studio/playbook#preflight" className="inline-flex min-h-6 items-center gap-2 text-xs underline underline-offset-4">Read the guardrails <span aria-hidden>↗</span></Link>
      </div>
      <h3 id="ad-preflight-title" className="relative mt-3 text-2xl leading-tight tracking-tight sm:text-3xl">Good-looking is only the first check.</h3>
      <p className="relative mt-2 max-w-xl text-sm leading-relaxed opacity-80">Let AI inspect this take, fill the Playbook checklist and show what still needs a person. An unresolved check is useful evidence.</p>
      <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-wider opacity-70"><span>01 · Inspect</span><span>02 · Show evidence</span><span>03 · Human decision</span></div>
    </div>

    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold">AI-assisted preflight</p><p className="mt-1 text-xs leading-relaxed text-muted">The finished MP4 and its embedded sound. Separate music, voice and effects are outside this review.</p></div>
        <span className="shrink-0 rounded-full border border-border-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide">{report ? "Human sign-off still required" : "Not reviewed yet"}</span>
      </div>

      {!take.context && <p className="rounded-lg border border-warning/30 bg-warning/[0.05] p-3 text-xs leading-relaxed text-warning">This recovered take has no saved original brief or settings. The review will say what it cannot verify; today&apos;s form will not be treated as this take&apos;s brief.</p>}

      <details className="rounded-lg border border-border-soft p-3" open={!report}>
        <summary className="min-h-6 cursor-pointer text-sm font-semibold">Context for the review <span className="font-normal text-muted">· optional</span></summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">Product shown</span><select aria-label="Preflight product context" className="input mt-1 min-h-11" disabled={busy} value={declarations.productKind} onChange={(event) => setDeclarations((value) => ({ ...value, productKind: event.target.value as Declarations["productKind"] }))}><option value="unknown">Not specified</option><option value="real">A real product for sale</option><option value="fictional">A fictional / concept product</option></select></label>
          <label className="block"><span className="label">Intended channel</span><select aria-label="Preflight intended channel" className="input mt-1 min-h-11" disabled={busy} value={declarations.channel} onChange={(event) => setDeclarations((value) => ({ ...value, channel: event.target.value as Declarations["channel"] }))}><option value="unknown">Not specified</option><option value="portfolio">Portfolio / concept study</option><option value="social">Social / digital advertising</option><option value="olv">Online video advertising</option><option value="broadcast">TV / broadcast</option></select></label>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">These are your declarations, not verified facts. They help frame the questions; they cannot clear rights, consent or regulatory approval.</p>
        {changedDeclarations && <p className="mt-2 text-xs text-warning">Context changed. The saved report still reflects the declarations from its review. Run a new review to use these changes.</p>}
      </details>

      {!report && <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{["Product fidelity", "People & voice", "Claims & disclosure", "Rights & approvals"].map((label) => <div key={label} className="rounded-md border border-border-soft px-3 py-3"><span className="mr-2 text-muted" aria-hidden>○</span>{label}</div>)}</div>}

      {busy && <div role="status" className="rounded-lg border border-accent/25 bg-accent/[0.04] p-4"><div className="flex items-center gap-3"><span aria-hidden className="relative flex h-9 w-9 items-center justify-center rounded-full border border-accent/30"><span className="h-3 w-3 rounded-full bg-accent motion-safe:animate-pulse" /></span><span className="text-sm font-semibold">Reading the picture. Listening to the take.</span></div><p className="mt-2 text-xs leading-relaxed text-muted">AI is comparing the available evidence with the checklist. Nothing is marked as passed until the review returns. This may take a minute.</p></div>}
      {error && <p role="alert" className="rounded-lg border border-danger/25 bg-danger/[0.04] p-3 text-sm leading-relaxed text-danger">{error}</p>}
      {pending && !busy && !error && <p className="rounded-lg border border-warning/25 bg-warning/[0.05] p-3 text-xs leading-relaxed text-warning">A review started {new Date(pending.startedAt).toLocaleString()} but no saved result came back. It has not been retried. Starting another review may incur a second analysis charge.</p>}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void runReview()} disabled={busy || !loaded || !canReview} className="btn-primary min-h-11">{busy ? "Reviewing this take…" : report ? "Run another AI review" : pending ? "Start a new AI review" : "Run AI preflight"}<span aria-hidden>{busy ? "" : " →"}</span></button>
          {health && !health.live && (health.gate === "locked" || health.gate === "exhausted") && <button type="button" className="btn-secondary min-h-11" onClick={requestLiveUnlock}>Unlock AI review</button>}
        </div>
        <p className="text-xs leading-relaxed text-muted">Small Gemini analysis charge · approximately $0.04 for a take up to 60 seconds with the default model; actual usage and model settings may vary. Clicking sends this video{take.context ? ", its saved brief" : ""}{referenceImages.length ? ` and ${Math.min(referenceImages.length, 3)} original product reference${referenceImages.length === 1 ? "" : "s"}` : ""} to Gemini. It does not generate another video.</p>
        {health && !health.gemini && <p className="text-xs text-warning">AI review is unavailable until Gemini is configured. No checklist will be fabricated in demo mode.</p>}
        {health?.gemini && !health.live && <p className="text-xs text-warning">Live mode is required for an AI review. Existing saved reports remain available.</p>}
        {!metadata && <p className="text-xs text-muted">Waiting for this video&apos;s duration and dimensions to load.</p>}
        {metadata && metadata.durationSeconds > 60 && <p className="text-xs text-warning">This review supports takes up to 60 seconds. Review a shorter cut.</p>}
      </div>

      {report && <>
        <div className="border-t border-border-soft pt-5">
          <p className={`label ${counts.flag ? "!text-danger" : "!text-warning"}`}>{counts.flag ? "Issues found" : "Human review required"}</p>
          <p className="mt-2 text-base leading-relaxed">{report.summary}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(["flag", "unverified", "pass", "not_applicable"] as const).map((status) => <div key={status} className={`rounded-lg border p-3 ${STATUS[status].style}`}><span className="block font-mono text-2xl">{counts[status]}</span><span className="mt-1 block text-[11px] leading-tight">{status === "pass" ? "Observations passed" : STATUS[status].label}</span></div>)}</div>
          <p className="mt-3 text-xs leading-relaxed text-muted">An AI observation can pass while the ad still needs approval. Unverified is not a pass.</p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter preflight findings">{([['attention', `Needs attention (${counts.flag + counts.unverified})`], ['all', `All checks (${report.checks.length})`], ['pass', `Passed observations (${counts.pass})`]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition ${filter === value ? 'border-accent bg-accent text-white' : 'border-border-soft bg-surface hover:border-accent'}`}>{label}</button>)}</div>
        <div className="space-y-5">
          {groups.length === 0 && <p className="rounded-lg border border-border-soft p-4 text-sm text-muted">No findings in this view. Use All checks to see the full record.</p>}
          {groups.map(({ group, checks }) => <section key={group} aria-label={group}><h4 className="label mb-3 !text-accent">{group}</h4><div className="space-y-2">{checks.map((check) => <Finding key={check.id} check={check} onSeek={onSeek} duration={report.coverage.durationSeconds} />)}</div></section>)}
        </div>

        <details className="rounded-lg border border-border-soft bg-surface-2 p-4"><summary className="min-h-6 cursor-pointer text-sm font-semibold">What this review actually inspected</summary><div className="mt-3 space-y-3 text-xs leading-relaxed text-muted"><p>{report.coverage.durationSeconds.toFixed(1)}s video · {report.coverage.sampleFps} samples per second · embedded audio only · {report.coverage.referenceImages} product reference images.</p><p>Reviewed {new Date(report.createdAt).toLocaleString()} using {report.model}. Estimated analysis cost: ${report.estimatedCostUsd.toFixed(4)}. Report {report.id}.</p><ul className="list-disc space-y-1 pl-4">{report.coverage.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul><p>Product: {reviewedDeclarations.productKind}. Channel: {reviewedDeclarations.channel}. Declared by the user.</p><p>Take <span className="break-all font-mono">{take.id}</span>. Saved for this exact video in this browser. Changing the take starts a separate review.</p>{take.context && <details><summary className="min-h-6 cursor-pointer font-semibold text-foreground">Original generation brief</summary><p className="mt-2">{take.context.modelId} · {take.context.durationSeconds}s · {take.context.aspect} · submitted {new Date(take.context.submittedAt).toLocaleString()}</p><pre className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border-soft bg-surface p-3 font-sans">{take.context.prompt}</pre></details>}</div></details>

        <details className="rounded-lg border border-border-soft p-4"><summary className="min-h-6 cursor-pointer text-sm font-semibold">Human follow-up & evidence notes</summary><p className="mt-2 text-xs leading-relaxed text-muted">Record who is reviewing it and what still needs checking. These notes do not overwrite the AI findings or grant publishing approval. Keep consent, licences and confidential records in your approved system.</p><label className="mt-3 block"><span className="label">Reviewer name · optional</span><input className="input mt-1 min-h-11" aria-label="Preflight reviewer name" maxLength={120} value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Who is taking this forward?" /></label><label className="mt-3 block"><span className="label">Follow-up notes</span><textarea className="input mt-1 min-h-24" aria-label="Preflight human follow-up notes" maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="For example: packaging claim at 0:08 needs checking against the approved source. Rights review assigned to…" /></label></details>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary min-h-11" onClick={() => void copyReport()}>Copy full report</button><button type="button" className="btn-secondary min-h-11" onClick={downloadReport}>Download report ↓</button></div>
      </>}
      <p role="status" aria-live="polite" className="text-xs leading-relaxed text-muted">{message}</p>
    </div>
  </section>;
}

function Finding({ check, onSeek, duration }: { check: PreflightFinding; onSeek: (seconds: number) => void; duration: number }) {
  const status = STATUS[check.status] ?? STATUS.unverified;
  const times = check.timestamps.filter((time) => Number.isFinite(time) && time >= 0 && time < duration);
  return <details className="group rounded-lg border border-border-soft bg-surface" open={check.status === "flag"}>
    <summary className="flex min-h-14 cursor-pointer list-none items-start gap-3 p-3 sm:p-4"><span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${status.style}`}>{status.symbol}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-relaxed">{check.title}</span><span className="mt-1 block text-xs text-muted">{check.status === "pass" && check.basis === "metadata" ? "Metadata check passed" : status.label} · {BASIS[check.basis]}</span></span><span aria-hidden className="mt-1 shrink-0 text-muted transition group-open:rotate-45">+</span></summary>
    <div className="space-y-3 border-t border-border-soft p-3 sm:p-4"><p className="text-sm leading-relaxed">{check.evidence}</p>{times.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted">See in the take:</span>{times.map((time, index) => <button type="button" key={`${time}:${index}`} onClick={() => onSeek(time)} aria-label={`Seek video to ${stamp(time)} for ${check.title}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-soft px-3 py-2 font-mono text-xs text-accent hover:border-accent"><span aria-hidden>▶</span>{stamp(time)}</button>)}</div>}<p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-muted"><strong className="text-foreground">Next step:</strong> {check.action}</p></div>
  </details>;
}
