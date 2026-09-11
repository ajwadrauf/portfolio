"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";
import { CampaignResults } from "@/components/studio/CampaignResults";
import { parseAdDraft } from "@/lib/adDraft";
import { campaignDownloadSource, campaignMedia, emptyCampaignDraft, isRealHero, readCampaignDraft, renderCampaignTextTile, veluneCampaignDraft, type CampaignDraft, type CampaignJob as Job, type CampaignSnapshot, type CampaignReceipt } from "@/lib/campaignWorkspace";
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
  const { project, ready: projectReady, saveDraft, saveAsset } = useStudioProject();
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedProjectAsset, setSelectedProjectAsset] = useState("");
  const routed = useRef<number | null>(null);
  const [workflow, setWorkflow] = useState<"batch" | "hero">("batch");
  const [approvedHeroId, setApprovedHeroId] = useState<string | null>(null);
  const [exactText, setExactText] = useState(false);
  const [snapshots, setSnapshots] = useState<Record<string, CampaignSnapshot>>({});
  const [renderBusy, setRenderBusy] = useState(false);
  const generationLock = useRef(false);
  const projectIdRef = useRef(project?.id);
  projectIdRef.current = project?.id;
  const currentDraft = useRef<CampaignDraft>(emptyCampaignDraft());
  type PendingDraftSave = { projectId: string; draft: CampaignDraft; persist: typeof saveDraft; promise?: Promise<void> };
  const pendingDraftSave = useRef<PendingDraftSave | null>(null);
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
  currentDraft.current = { schema: "campaign-draft-v1", step, imageDataUrl, productContext, questions, answers, brief, selected, modelChoice, jobs, snapshots, workflow, approvedHeroId, exactText };

  function flushDraft(record = pendingDraftSave.current): Promise<void> {
    if (!record) return Promise.resolve();
    if (record.promise) return record.promise;
    record.promise = record.persist("campaign", record.draft).then(() => {
      if (pendingDraftSave.current === record) pendingDraftSave.current = null;
    }).catch((error) => { record.promise = undefined; throw error; });
    return record.promise;
  }

  useEffect(() => {
    if (!projectReady || !project || hydratedId === project.id) return;
    const saved = readCampaignDraft(project.drafts.campaign) ?? (project.example === "velune" ? veluneCampaignDraft() : emptyCampaignDraft());
    currentDraft.current = saved;
    setStep(saved.step); setImageDataUrl(saved.imageDataUrl); setProductContext(saved.productContext); setQuestions(saved.questions); setAnswers(saved.answers); setBrief(saved.brief); setSelected(saved.selected); setModelChoice(saved.modelChoice); setJobs(saved.jobs); setSnapshots(saved.snapshots); setWorkflow(saved.workflow); setApprovedHeroId(saved.approvedHeroId); setExactText(saved.exactText);
    setError(null); setSaveMessage(saved.jobs.some((job) => ["recoverable", "uncertain"].includes(job.status)) ? "Saved work restored. Check any unfinished request; nothing has been resubmitted." : "Project loaded. No generation has started.");
    setHydratedId(project.id);
  }, [projectReady, project, hydratedId]);

  // Flush the last committed edit when this tool unmounts or changes projects.
  // The record owns its original id-bound writer; never substitute the new project.
  useEffect(() => {
    const id = project?.id;
    return () => {
      const record = pendingDraftSave.current;
      if (record?.projectId === id) void flushDraft(record).catch(() => { /* Provider exposes storage errors. */ });
    };
  }, [project?.id]);

  useEffect(() => {
    if (!project || hydratedId !== project.id || renderBusy) return;
    const record: PendingDraftSave = { projectId: project.id, draft: currentDraft.current, persist: saveDraft };
    pendingDraftSave.current = record;
    const timer = setTimeout(() => {
      if (pendingDraftSave.current !== record) return;
      void flushDraft(record).then(() => { if (projectIdRef.current === record.projectId) setSaveMessage("Saved on this device."); }).catch(() => { if (projectIdRef.current === record.projectId) setSaveMessage("Draft could not save. Resolve project storage before generating."); });
    }, 500);
    return () => clearTimeout(timer);
  }, [project?.id, hydratedId, step, imageDataUrl, productContext, questions, answers, brief, selected, modelChoice, jobs, snapshots, workflow, approvedHeroId, exactText, renderBusy, saveDraft]);


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

  useEffect(() => {
    const route = project?.drafts.routing as { kind?: string; modelId?: string; selectedAt?: number; handledAt?: number } | undefined;
    if (!project || hydratedId !== project.id || route?.kind !== "image" || !route.modelId || MODELS[route.modelId]?.kind !== "image" || typeof route.selectedAt !== "number" || route.selectedAt === route.handledAt || route.selectedAt === routed.current) return;
    routed.current = route.selectedAt;
    const chosen = route.modelId;
    setModelChoice((previous) => ({ ...previous, ...Object.fromEntries(DELIVERABLES.filter((d) => d.kind === "still" && d.modelOptions.includes(chosen)).map((d) => [d.id, chosen])) }));
    setSaveMessage(`Model Explorer selected ${MODELS[chosen].label} for compatible campaign deliverables. Review the selected formats before generating.`);
    void saveDraft("routing", { ...route, handledAt: route.selectedAt }).catch((e) => setError(e.message));
  }, [project?.drafts.routing, project?.id, hydratedId, saveDraft]);

  // ---------- Step 1 → 2: analyze ----------
  const handleImage = useCallback(async (src: string | Blob, fromPackshots = false) => {
    if (analyzeLock.current) return;
    analyzeLock.current = true;
    const originProject = projectIdRef.current;
    intakeSequence.current += 1;
    setHandoffLoading(false);
    if (!fromPackshots) clearHandoff();
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await prepareCampaignReference(src);
      if (projectIdRef.current !== originProject) return;
      setImageDataUrl(dataUrl);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      const data = json as AnalyzeResponse;
      if (projectIdRef.current !== originProject) return;
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
      const originProject = projectIdRef.current;
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
        if (projectIdRef.current !== originProject) return;
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
  const approvedHero = jobs.find((job) => job.id === approvedHeroId && isRealHero(job)) ?? null;
  const plannedSpecs = workflow === "hero" && !approvedHero ? DELIVERABLES.filter((item) => item.id === "hero_still") : selectedSpecs.filter((item) => !(workflow === "hero" && approvedHero && item.id === "hero_still"));
  const totalEstimate = plannedSpecs.reduce((sum, item) => sum + (workflow === "hero" && approvedHero && exactText && item.id.startsWith("promo_tile_") ? 0 : estimateCost(modelChoice[item.id], { seconds: item.durationSeconds })), 0);

  // Every run captures its project and request snapshot before any paid submission.
  type RunScope = { projectId: string; draft: CampaignDraft; persist: typeof saveDraft; asset: typeof saveAsset };
  const reflectRun = (scope: RunScope) => {
    if (projectIdRef.current !== scope.projectId) return;
    currentDraft.current = scope.draft; setJobs(scope.draft.jobs); setSnapshots(scope.draft.snapshots); setStep("generating");
  };
  async function updateRun(scope: RunScope, id: string, patch: Partial<Job>) {
    // This durable complete snapshot supersedes any older debounced draft.
    if (pendingDraftSave.current?.projectId === scope.projectId) pendingDraftSave.current = null;
    scope.draft = { ...scope.draft, jobs: scope.draft.jobs.map((job) => job.id === id ? { ...job, ...patch } : job) };
    reflectRun(scope);
    await scope.persist("campaign", scope.draft);
  }
  async function retainAsset(scope: RunScope, job: Job) {
    const media = campaignMedia(job);
    if (job.status !== "done" || !media) return;
    await scope.asset({ id: `campaign-${job.id}`, name: `${DELIVERABLES.find((item) => item.id === job.deliverableId)?.label ?? "Campaign asset"}`, kind: job.videoUrl ? "video" : "image", ...(media.startsWith("data:") ? { dataUrl: media } : { url: media }), role: "campaign-output", source: "generated", status: "ready", metadata: { modelId: job.modelId, jobId: job.id, prompt: job.prompt, approvedHeroId: scope.draft.snapshots[job.snapshotId]?.approvedHeroId, needsHumanReview: true } });
  }
  async function checkJob(scope: RunScope, job: Job, repeat: boolean) {
    if (!job.receipt) return;
    const deadline = Date.now() + POLL_DEADLINE_MS;
    do {
      try {
        const response = await fetch("/api/campaign/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job.receipt) });
        if (response.ok) {
          const result = await response.json();
          if (result.status === "done" && result.videoUrl) {
            const complete = { ...job, status: "done" as const, videoUrl: result.videoUrl, finishedAt: Date.now(), error: undefined };
            await updateRun(scope, job.id, complete); await retainAsset(scope, complete); return;
          }
          if (result.status === "failed") { await updateRun(scope, job.id, { status: "failed", error: result.error ?? "The provider marked this request as failed.", finishedAt: Date.now() }); return; }
        }
      } catch { /* A transport error never becomes permission to submit again. */ }
      if (!repeat) break;
      await sleep(POLL_INTERVAL_MS);
    } while (Date.now() < deadline);
    await updateRun(scope, job.id, { status: "recoverable", error: "The request is still pending or status is unavailable. Check this saved handle again; no new generation is needed." });
  }
  async function submitJob(scope: RunScope, job: Job) {
    const snapshot = scope.draft.snapshots[job.snapshotId]; const spec = DELIVERABLES.find((item) => item.id === job.deliverableId)!;
    let submitted = false;
    try {
      // Durable intent before the POST: a reload now produces a reviewable uncertain attempt.
      await updateRun(scope, job.id, { status: "running", startedAt: Date.now() });
      if (snapshot.exactText && snapshot.approvedHeroId && (spec.id === "promo_tile_en" || spec.id === "promo_tile_fr") && snapshot.imageDataUrl) {
        const textOverlay = { text: spec.id === "promo_tile_en" ? snapshot.brief.headlineEN : snapshot.brief.headlineFR, position: "top" as const, color: "ink" as const };
        const image = await renderCampaignTextTile(snapshot.imageDataUrl, textOverlay);
        const complete = { ...job, imageDataUrl: image, textOverlay, status: "done" as const, cost: 0, finishedAt: Date.now(), prompt: "Local exact-copy layout from the approved hero. No model request." };
        await updateRun(scope, job.id, complete); await retainAsset(scope, complete); return;
      }
      const reference = snapshot.imageDataUrl && !snapshot.imageDataUrl.startsWith("data:") ? await prepareCampaignReference(snapshot.imageDataUrl) : snapshot.imageDataUrl;
      submitted = true;
      const response = await fetch(spec.kind === "video" ? "/api/generate/video" : "/api/generate/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliverableId: spec.id, modelId: job.modelId, brief: snapshot.brief, imageDataUrl: reference, approvedHero: Boolean(snapshot.approvedHeroId) }) });
      const result = await response.json();
      if (!response.ok) {
        await updateRun(scope, job.id, { status: response.status >= 500 ? "uncertain" : "failed", error: result.error ?? "The generation request did not finish." }); return;
      }
      if (result.mock) { await updateRun(scope, job.id, { status: "mock", imageDataUrl: result.imageDataUrl, posterDataUrl: result.posterDataUrl, prompt: result.prompt, finishedAt: Date.now() }); return; }
      if (spec.kind === "video") {
        const receipt: CampaignReceipt = { provider: result.provider, modelId: job.modelId, operationName: result.operationName, falRequestId: result.falRequestId };
        if (!["fal", "gemini"].includes(receipt.provider) || !(receipt.operationName || receipt.falRequestId)) throw new Error("No request handle was returned. Check the provider history before another attempt.");
        const accepted = { ...job, status: "polling" as const, receipt, prompt: result.prompt, cost: result.cost ?? 0 };
        await updateRun(scope, job.id, accepted); addSpend(accepted.cost);
        await checkJob(scope, accepted, true);
      } else {
        if (!(result.imageDataUrl || result.imageUrl)) throw new Error("No image was returned. The provider may still have billed the attempt.");
        const complete = { ...job, status: "done" as const, imageDataUrl: result.imageDataUrl, imageUrl: result.imageUrl, prompt: result.prompt, cost: result.cost ?? 0, finishedAt: Date.now() };
        await updateRun(scope, job.id, complete); addSpend(complete.cost); await retainAsset(scope, complete);
      }
    } catch (error) {
      // Never discard an accepted receipt or completed file when a later save/read fails.
      const latest = scope.draft.jobs.find((item) => item.id === job.id)!;
      if (latest.status === "done" || latest.status === "mock") { if (projectIdRef.current === scope.projectId) setError("The result is visible, but some project data could not save. Download the file before closing this page."); return; }
      const patch = { status: latest.receipt ? "recoverable" as const : submitted ? "uncertain" as const : "failed" as const, error: error instanceof Error ? error.message : "This attempt did not finish." };
      try { await updateRun(scope, job.id, patch); } catch { reflectRun(scope); if (projectIdRef.current === scope.projectId) setError("Project storage failed. Keep this page open and copy any request receipt before leaving."); }
    }
  }
  async function runGeneration(retry?: Job) {
    if (generationLock.current || !project || hydratedId !== project.id || !brief) return;
    generationLock.current = true;
    const origin = project.id;
    try {
      const snapshotId = crypto.randomUUID(); const approved = jobs.find((job) => job.id === approvedHeroId && isRealHero(job));
      const specs = retry ? DELIVERABLES.filter((item) => item.id === retry.deliverableId) : workflow === "hero" && !approved ? DELIVERABLES.filter((item) => item.id === "hero_still") : selectedSpecs.filter((item) => !(workflow === "hero" && approved && item.id === "hero_still"));
      if (!specs.length) { setError("Choose at least one adaptation."); return; }
      const prior = retry ? snapshots[retry.snapshotId] : undefined;
      const snapshot: CampaignSnapshot = prior ? { ...prior, id: snapshotId } : { id: snapshotId, brief: structuredClone(brief), imageDataUrl: approved && workflow === "hero" ? campaignMedia(approved)! : imageDataUrl, approvedHeroId: approved && workflow === "hero" ? approved.id : undefined, exactText };
      const price = specs.reduce((sum, item) => sum + (snapshot.exactText && snapshot.approvedHeroId && item.id.startsWith("promo_tile_") ? 0 : estimateCost(retry?.modelId ?? modelChoice[item.id], { seconds: item.durationSeconds })), 0);
      if (health?.live && !window.confirm(`${retry?.status === "uncertain" ? "The earlier attempt may already have been billed. Check provider history first. " : ""}${retry ? "Create one new attempt" : `Generate ${specs.length} selected assets`} for approximately $${price.toFixed(2)}? Existing files and requests are kept.`)) return;
      if (snapshot.imageDataUrl && !snapshot.imageDataUrl.startsWith("data:")) {
        const source = snapshot.imageDataUrl.startsWith("/studio/") ? snapshot.imageDataUrl : campaignDownloadSource(snapshot.imageDataUrl, "image");
        const response = await fetch(source); if (!response.ok) throw new Error("The approved image is unavailable. Download or choose it again before generating.");
        snapshot.imageDataUrl = await prepareCampaignReference(await response.blob());
      }
      setRenderBusy(true); setError(null);
      await flushDraft();
      const newJobs: Job[] = specs.map((item) => ({ id: crypto.randomUUID(), deliverableId: item.id, modelId: retry?.modelId ?? modelChoice[item.id], snapshotId, status: "queued", cost: 0 }));
      const scope: RunScope = { projectId: origin, persist: saveDraft, asset: saveAsset, draft: { ...currentDraft.current, step: "generating", snapshots: { ...currentDraft.current.snapshots, [snapshotId]: snapshot }, jobs: [...currentDraft.current.jobs, ...newJobs] } };
      await scope.persist("campaign", scope.draft); reflectRun(scope);
      // Two workers cap total concurrency; queued siblings are never automatically resubmitted after reload.
      const queue = [...newJobs];
      async function worker() { for (;;) { const next = queue.shift(); if (!next) return; await submitJob(scope, next); } }
      await Promise.all([worker(), worker()]);
    } catch (error) { if (projectIdRef.current === origin) setError(error instanceof Error ? error.message : "Could not start this campaign."); }
    finally { generationLock.current = false; setRenderBusy(false); }
  }
  async function recoverJob(job: Job) {
    if (!job.receipt || generationLock.current || !project) return;
    generationLock.current = true; setRenderBusy(true); setError(null);
    const scope: RunScope = { projectId: project.id, draft: currentDraft.current, persist: saveDraft, asset: saveAsset };
    try { await checkJob(scope, job, false); } catch (error) { setError(error instanceof Error ? error.message : "Could not check the result."); }
    finally { generationLock.current = false; setRenderBusy(false); }
  }
  async function animateJob(job: Job) {
    if (job.status !== "done" || job.videoUrl || !project) return;
    const source = campaignMedia(job); if (!source) return;
    const response = await fetch(campaignDownloadSource(source, "image")); if (!response.ok) throw new Error("Could not read the selected image.");
    const reference = await prepareCampaignReference(await response.blob());
    const snapshot = snapshots[job.snapshotId];
    await flushDraft();
    const previousAd = parseAdDraft(project.drafts.ad);
    await saveDraft("ad", { ...previousAd, schema: "adlab-draft-v1", source: "campaign", lane: "blender", imported: true, negativePrompt: snapshot.brief.negativePrompt, unattachedSlots: [], prompt: `Use [Image1] as the product and visual direction reference. ${snapshot.brief.videoPrompt}`, modelId: "seedance-2.5-ref", duration: 8, aspect: "16:9", completedTake: null, sceneCards: [], productImage: null, endImage: null, references: [{ id: job.id, name: `${snapshot.brief.productName} · campaign image`, kind: "image", role: "product", token: "[Image1]", dataUrl: reference }], referenceManifest: [{ token: "[Image1]", assetId: job.id, job: "Approved campaign image · preserve product and visual direction" }] });
    window.location.assign("/ai-studio/ads");
  }
  async function editText(job: Job, overlay: NonNullable<Job["textOverlay"]>) {
    const snapshot = snapshots[job.snapshotId]; if (!project || !snapshot?.imageDataUrl) throw new Error("The original layout image is unavailable.");
    const image = await renderCampaignTextTile(snapshot.imageDataUrl, overlay);
    const scope: RunScope = { projectId: project.id, draft: currentDraft.current, persist: saveDraft, asset: saveAsset };
    await updateRun(scope, job.id, { imageDataUrl: image, textOverlay: overlay });
    await retainAsset(scope, { ...job, imageDataUrl: image, textOverlay: overlay });
  }
  function approveHero(job: Job) {
    if (!isRealHero(job)) return;
    setApprovedHeroId(job.id); setWorkflow("hero"); setExactText(true); setSelected((previous) => ({ ...previous, hero_still: false })); setStep("deliverables");
  }

  const reset = useCallback(() => {
    clearHandoff();
    setStep("upload");
    setImageDataUrl(null);
    setProductContext(null);
    setQuestions([]);
    setAnswers({});
    setBrief(null);
    setJobs([]); setSnapshots({}); setApprovedHeroId(null);
    setError(null);
  }, [clearHandoff]);

  // ================================================================ render
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <StatusBar health={health} sessionSpend={sessionSpend} />
      <StepTracker step={step} />
      <p role="status" className="mt-4 text-xs text-muted">{projectReady ? saveMessage : "Opening your project…"}</p>
      {project?.example === "velune" && <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm"><strong>VELUNE · fictional concept study.</strong> The supplied packaging reference is visual direction, not final approved pack artwork. New example copies use the three-carton image; existing briefs keep their chosen source. Review the brief and generate a hero only when ready. The final Seedance film is not yet available.</div>}
      {!project && projectReady && <p role="alert" className="mt-4 text-sm text-warning">Open a project in the project tray to save your work before generating.</p>}

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
          {project && project.assets.some((a) => a.kind === "image" && a.status === "ready") && <section className="card mt-8 p-6" aria-label="Use a project image"><h2 className="text-lg font-semibold">Continue with a project asset</h2><p className="mt-2 text-sm text-muted">Choose a completed packshot or reference already in this project. Selecting it costs nothing; analysis starts only when you press the button.</p><label className="mt-4 block text-sm">Image from this project<select className="input mt-2" value={selectedProjectAsset} disabled={busy} onChange={(e) => setSelectedProjectAsset(e.target.value)}><option value="">Choose an image</option>{project.assets.filter((a) => a.kind === "image" && a.status === "ready").map((a) => <option key={a.id} value={a.id}>{a.name} · {a.source}</option>)}</select></label>{(() => { const asset = project.assets.find((a) => a.id === selectedProjectAsset && a.kind === "image" && a.status === "ready"); return asset ? <div className="mt-4 flex flex-wrap items-center gap-4"><img className="h-32 w-32 object-contain" src={asset.dataUrl || asset.url} alt={asset.name} /><div><p className="mb-3 max-w-lg text-sm text-muted">{asset.role}</p><button type="button" className="btn-primary" disabled={busy} onClick={() => void handleImage(asset.dataUrl || asset.url!)}>Analyze selected asset →</button><p className="mt-2 text-xs text-muted">{health?.live ? "Live vision analysis uses your configured provider." : "Demo analysis · no provider charge"}</p></div></div> : null; })()}</section>}
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
          count={plannedSpecs.length}
          onGenerate={() => void runGeneration()}
          workflow={workflow} onWorkflow={setWorkflow} approvedHero={jobs.find((job) => job.id === approvedHeroId) ?? null}
          exactText={exactText} onExactText={setExactText} canGenerate={Boolean(project && hydratedId === project.id) && !renderBusy}
          heroEstimate={estimateCost(modelChoice.hero_still)}
          onBack={() => setStep("brief")}
        />
      )}

      {step === "generating" && (
        <CampaignResults jobs={jobs} snapshots={snapshots} busy={renderBusy} live={health?.live ?? false} approvedHeroId={approvedHeroId} workflow={workflow} onRecover={(job) => void recoverJob(job)} onRetry={(job) => void runGeneration(job)} onApprove={approveHero} onAnimate={animateJob} onText={editText} onBack={() => setStep("deliverables")} onReset={() => { if (window.confirm("Start another campaign in this project? Download or export the current campaign first. Its saved project assets remain available.")) reset(); }} />
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
  onBack, workflow, onWorkflow, approvedHero, exactText, onExactText, canGenerate, heroEstimate,
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
  workflow: "batch" | "hero"; onWorkflow: (value: "batch" | "hero") => void; approvedHero: Job | null;
  exactText: boolean; onExactText: (value: boolean) => void; canGenerate: boolean; heroEstimate: number;
}) {
  const heroFirst = workflow === "hero" && !approvedHero;
  return (
    <section className="mt-8">
      <h1 className="text-[1.75rem] tracking-[-0.03em]">The content pack</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Each deliverable routes to the model best suited — and priced — for the
        job. Costs are shown before anything runs.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2" role="group" aria-label="Campaign production workflow">
        <button type="button" onClick={() => onWorkflow("batch")} aria-pressed={workflow === "batch"} className={`rounded-xl border p-5 text-left ${workflow === "batch" ? "border-accent bg-accent/5" : "border-border-soft"}`}><span className="block font-semibold">Fast batch</span><span className="mt-2 block text-sm leading-relaxed text-muted">Independent ideas from one product reference. Generate your selected formats together.</span></button>
        <button type="button" onClick={() => onWorkflow("hero")} aria-pressed={workflow === "hero"} className={`rounded-xl border p-5 text-left ${workflow === "hero" ? "border-accent bg-accent/5" : "border-border-soft"}`}><span className="block font-semibold">Approve a hero, then adapt</span><span className="mt-2 block text-sm leading-relaxed text-muted">Review one image first. Its actual pixels guide every adaptation; exact EN/FR copy can be added locally.</span></button>
      </div>
      {heroFirst && <p className="mt-4 rounded-lg bg-surface-2 p-4 text-sm">First step: generate only the hero for {live ? `~$${heroEstimate.toFixed(2)}` : "$0 in demo"}. Review it before spending on the rest of the campaign.</p>}
      {workflow === "hero" && approvedHero && <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-accent/30 p-4"><img src={campaignMedia(approvedHero)} alt="Approved campaign hero" className="h-24 w-24 rounded object-contain" /><div className="flex-1"><p className="font-semibold">Approved hero is the reference.</p><p className="mt-1 text-sm text-muted">Generative adaptations still need a visual check. The bilingual local layouts reuse exactly the same approved image.</p><label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={exactText} onChange={(event) => onExactText(event.target.checked)} className="mt-1" /><span>Exact EN/FR headline layouts · local Canvas export · $0. Edit copy and placement after rendering.</span></label></div></div>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {DELIVERABLES.map((d) => {
          const localText = workflow === "hero" && approvedHero && exactText && d.id.startsWith("promo_tile_");
          const cost = localText ? 0 : estimateCost(modelChoice[d.id], { seconds: d.durationSeconds });
          const on = heroFirst ? d.id === "hero_still" : workflow === "hero" && approvedHero && d.id === "hero_still" ? false : selected[d.id];
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
                    disabled={heroFirst || Boolean(workflow === "hero" && approvedHero && d.id === "hero_still")}
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
                  aria-label={`Model for ${d.label}`}
                  disabled={!on || d.modelOptions.length === 1 || Boolean(localText)}
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
          <button className="btn-primary" onClick={onGenerate} disabled={count === 0 || !canGenerate}>
            {heroFirst ? "Generate hero for review" : workflow === "hero" ? "Create selected adaptations" : "Generate the pack"} →
          </button>
        </div>
      </div>
    </section>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
  );
}
