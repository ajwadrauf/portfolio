import { readCampaignReferences, type CampaignReference } from "./campaignReferences";
import { CampaignBriefSchema, ProductContextSchema, type CampaignBrief, type ClarifyingQuestion, type ProductContext } from "./types";
import { DELIVERABLES } from "./deliverables";
import { VELUNE_REFERENCES } from "./veluneReferences";

export type CampaignStep = "upload" | "clarify" | "brief" | "deliverables" | "generating";
export type CampaignReceipt = { provider: "gemini" | "fal"; modelId: string; operationName?: string; falRequestId?: string };
export type CampaignSnapshot = { id: string; brief: CampaignBrief; imageDataUrl: string | null; referenceImages?: CampaignReference[]; approvedHeroId?: string; exactText: boolean };
export type CampaignJob = {
  id: string; deliverableId: string; modelId: string; snapshotId: string;
  status: "queued" | "running" | "polling" | "done" | "failed" | "mock" | "uncertain" | "recoverable";
  cost: number; startedAt?: number; finishedAt?: number; receipt?: CampaignReceipt;
  imageDataUrl?: string; imageUrl?: string; videoUrl?: string; posterDataUrl?: string;
  prompt?: string; error?: string; textOverlay?: { text: string; position: "top" | "bottom"; color: "ink" | "ivory" };
};
export type CampaignDraft = {
  schema: "campaign-draft-v1"; step: CampaignStep; imageDataUrl: string | null; referenceImages?: CampaignReference[];
  productContext: ProductContext | null; questions: ClarifyingQuestion[]; answers: Record<string, string>;
  brief: CampaignBrief | null; selected: Record<string, boolean>; modelChoice: Record<string, string>;
  jobs: CampaignJob[]; snapshots: Record<string, CampaignSnapshot>; workflow: "batch" | "hero";
  approvedHeroId: string | null; exactText: boolean;
};

export function emptyCampaignDraft(): CampaignDraft {
  return { schema: "campaign-draft-v1", step: "upload", imageDataUrl: null, productContext: null, questions: [], answers: {}, brief: null,
    selected: Object.fromEntries(DELIVERABLES.map((d) => [d.id, true])), modelChoice: Object.fromEntries(DELIVERABLES.map((d) => [d.id, d.defaultModel])),
    jobs: [], snapshots: {}, workflow: "batch", approvedHeroId: null, exactText: false };
}

export function campaignMedia(job: CampaignJob): string | undefined { return job.imageDataUrl ?? job.imageUrl ?? job.videoUrl ?? job.posterDataUrl; }
export function isCompletedCampaignAsset(job: CampaignJob): boolean { return job.status === "done" && Boolean(job.imageDataUrl || job.imageUrl || job.videoUrl); }
export function isRealHero(job: CampaignJob): boolean { return job.deliverableId === "hero_still" && job.status === "done" && Boolean(job.imageDataUrl || job.imageUrl); }
export function campaignRecoveryStatus(job: CampaignJob): CampaignJob["status"] {
  if (job.status === "polling" || job.status === "running") return job.receipt ? "recoverable" : "uncertain";
  if (job.status === "recoverable" && !job.receipt) return "uncertain";
  return job.status;
}

/** Draft imports never submit or poll; paid work only resumes on an explicit click. */
export function readCampaignDraft(value: unknown): CampaignDraft | null {
  if (!value || typeof value !== "object" || (value as CampaignDraft).schema !== "campaign-draft-v1") return null;
  const raw = value as Partial<CampaignDraft>; const out = emptyCampaignDraft();
  try { out.referenceImages = readCampaignReferences(raw.referenceImages); } catch { return null; }
  const safeString = (v: unknown): v is string => typeof v === "string";
  if (safeString(raw.imageDataUrl) && /^(data:image\/(png|jpeg|webp);base64,|\/studio\/)/.test(raw.imageDataUrl)) out.imageDataUrl = raw.imageDataUrl;
  const context = ProductContextSchema.safeParse(raw.productContext); if (context.success) out.productContext = context.data;
  const brief = CampaignBriefSchema.safeParse(raw.brief); if (brief.success) out.brief = brief.data;
  if (Array.isArray(raw.questions)) out.questions = raw.questions.filter((q) => q && safeString(q.id) && safeString(q.question) && safeString(q.defaultAnswer) && Array.isArray(q.options) && q.options.every(safeString)).slice(0, 3);
  if (raw.answers && typeof raw.answers === "object") out.answers = Object.fromEntries(Object.entries(raw.answers).filter(([, v]) => safeString(v)));
  for (const spec of DELIVERABLES) {
    if (typeof raw.selected?.[spec.id] === "boolean") out.selected[spec.id] = raw.selected[spec.id];
    const choice = raw.modelChoice?.[spec.id]; if (choice && spec.modelOptions.includes(choice)) out.modelChoice[spec.id] = choice;
  }
  try { if (raw.snapshots && typeof raw.snapshots === "object") for (const [id, snap] of Object.entries(raw.snapshots)) {
    const parsed = CampaignBriefSchema.safeParse(snap?.brief);
    if (parsed.success && snap.id === id && (snap.imageDataUrl === null || safeString(snap.imageDataUrl))) out.snapshots[id] = { id, brief: parsed.data, imageDataUrl: snap.imageDataUrl, referenceImages: readCampaignReferences(snap.referenceImages), approvedHeroId: safeString(snap.approvedHeroId) ? snap.approvedHeroId : undefined, exactText: Boolean(snap.exactText) };
  }
  } catch { return null; }
  if (Array.isArray(raw.jobs)) out.jobs = raw.jobs.filter((j) => j && safeString(j.id) && safeString(j.snapshotId) && out.snapshots[j.snapshotId] && DELIVERABLES.some((d) => d.id === j.deliverableId && d.modelOptions.includes(j.modelId)) && ["queued", "running", "polling", "done", "failed", "mock", "uncertain", "recoverable", "interrupted"].includes(j.status)).map((job) => {
    const receipt = job.receipt && ["fal", "gemini"].includes(job.receipt.provider) && job.receipt.modelId === job.modelId && (safeString(job.receipt.falRequestId) || safeString(job.receipt.operationName)) ? job.receipt : undefined;
    const clean = { ...job, status: String(job.status) === "interrupted" ? "uncertain" as const : job.status, cost: Number.isFinite(job.cost) && job.cost >= 0 ? job.cost : 0, receipt };
    return { ...clean, status: campaignRecoveryStatus(clean) };
  }).slice(-80);
  out.workflow = raw.workflow === "hero" ? "hero" : "batch"; out.exactText = Boolean(raw.exactText);
  out.approvedHeroId = out.jobs.some((j) => j.id === raw.approvedHeroId && isRealHero(j)) ? raw.approvedHeroId! : null;
  if (raw.step === "generating" && out.jobs.length) out.step = "generating";
  else if (out.brief) out.step = raw.step === "deliverables" ? "deliverables" : "brief";
  else if (out.productContext && out.questions.length) out.step = "clarify";
  return out;
}

export function veluneCampaignDraft(): CampaignDraft {
  const draft = emptyCampaignDraft();
  draft.step = "brief"; draft.workflow = "hero"; draft.exactText = true;
  draft.imageDataUrl = VELUNE_REFERENCES[0].url;
  draft.productContext = { name: "VELUNE chocolate", category: "fictional chocolate concept", colors: ["pistachio green", "raspberry plum", "caramel gold", "chocolate"], texture: "matte carton, glossy chocolate", packagingType: "AI-generated solo pistachio-carton appearance reference, not flat label artwork" };
  draft.brief = {
    productName: "VELUNE · concept study", mood: "Cinematic, tactile, curious", setting: "Sculptural chocolate forms against a deep plum studio", palette: "Deep plum, warm ivory, cocoa brown and restrained caramel highlights",
    targetAudience: "Portfolio viewers exploring a fictional premium chocolate campaign", headlineEN: "Discover the centre", headlineFR: "Découvrez le cœur",
    stillPrompt: "Create one premium VELUNE chocolate campaign hero from the supplied pistachio-carton reference. Preserve the pistachio-green Pistachio Praline design, its proportions and printed whole-and-cut V-groove chocolate imagery. Show only this supplied flavour and leave clear negative space for separately typeset campaign copy. Treat the supplied AI image as a fictional concept appearance reference; review any regenerated lettering against the original artwork.",
    videoPrompt: "A cinematic fictional VELUNE chocolate study: glide past a glossy bonbon, reveal its layered centre, then settle on a restrained plum-and-ivory product composition. Preserve the approved hero's product proportions and visual identity. Audio: quiet chocolate snap, subtle room tone, restrained instrumental pulse. No spoken claims.",
    negativePrompt: "No invented nutrition claims, no presentation-board headings, no warped packaging, no extra products or illegible decorative text.", seasonalTheme: "Warm gifting season with understated ivory ribbon; preserve product identity",
  };
  return draft;
}

/** Exact copy belongs in a local layout layer, never a spelling request to a model. */
export async function renderCampaignTextTile(source: string, overlay: NonNullable<CampaignJob["textOverlay"]>): Promise<string> {
  if (!overlay.text.trim() || overlay.text.length > 160) throw new Error("Use 1–160 characters of approved headline copy.");
  const response = await fetch(campaignDownloadSource(source, "image"));
  if (!response.ok) throw new Error("Could not read the image for the text layout. Download it and use a local copy.");
  const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1200;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas is unavailable.");
    const dark = overlay.color === "ivory"; ctx.fillStyle = dark ? "#2c1729" : "#f7f3e8"; ctx.fillRect(0, 0, 1200, 1200);
    const imageY = overlay.position === "top" ? 260 : 40; const ratio = Math.min(1120 / image.naturalWidth, 860 / image.naturalHeight);
    const width = image.naturalWidth * ratio; const height = image.naturalHeight * ratio;
    ctx.drawImage(image, (1200 - width) / 2, imageY + (860 - height) / 2, width, height);
    let size = 64; let lines: string[] = [];
    for (; size >= 24; size -= 2) {
      ctx.font = `600 ${size}px Arial, sans-serif`; lines = [""];
      for (const word of overlay.text.trim().split(/\s+/)) {
        const last = lines.length - 1; const candidate = lines[last] ? `${lines[last]} ${word}` : word;
        if (ctx.measureText(candidate).width <= 1060) lines[last] = candidate;
        else if (!lines[last]) lines[last] = word;
        else lines.push(word);
      }
      if (lines.length * size * 1.2 <= 180 && lines.every((line) => ctx.measureText(line).width <= 1060)) break;
    }
    if (size < 24) throw new Error("Shorten the headline to fit this layout.");
    ctx.fillStyle = dark ? "#fff8e9" : "#231c18"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const centre = overlay.position === "top" ? 145 : 1045;
    lines.forEach((line, index) => ctx.fillText(line, 600, centre + (index - (lines.length - 1) / 2) * size * 1.2));
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function campaignDownloadSource(source: string, kind: "image" | "video"): string {
  if (source.startsWith("data:image/") || source.startsWith("/api/video-file?") || source.startsWith("/studio/")) return source;
  return `/api/campaign/file?url=${encodeURIComponent(source)}&kind=${kind}`;
}
