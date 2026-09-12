import { VELUNE_MEDIA } from "@/components/velune/veluneStudy";
import { VELUNE_REFERENCES } from "./veluneReferences";

export type StudioAsset = {
  id: string;
  name: string;
  kind: "image" | "video" | "audio" | "document";
  url?: string;
  dataUrl?: string;
  role?: string;
  source: "uploaded" | "blender" | "generated" | "example";
  status: "ready" | "pending";
  metadata?: Record<string, unknown>;
};
export type StudioProject = {
  version: 1;
  id: string;
  name: string;
  example?: "velune";
  createdAt: number;
  updatedAt: number;
  drafts: Record<string, unknown>;
  assets: StudioAsset[];
};
export type StudioProjectSummary = Pick<StudioProject, "id" | "name" | "example" | "createdAt" | "updatedAt">;
export function projectSummary(p: StudioProject): StudioProjectSummary {
  return { id: p.id, name: p.name, ...(p.example ? { example: p.example } : {}), createdAt: p.createdAt, updatedAt: p.updatedAt };
}
export const STUDIO_PROJECT_EVENT = "studio-project-updated";
export const STUDIO_ACTIVE_KEY = "studio-active-project-v1";
export const PROJECT_MAX_BYTES = 100 * 1024 * 1024;
const DATABASE = "ai-studio-projects-v1";
const STORE = "projects";
const MAX_PROJECTS = 24;
const TIMEOUT_MS = 15_000;

/** Only change this when an actual, reviewed AI video result has been supplied. */
export const VELUNE_FINAL_VIDEO: string | null = VELUNE_MEDIA.film;
export function veluneVisualAssets(): StudioAsset[] {
  return VELUNE_REFERENCES.map((ref) => ({ id: ref.id, name: `VELUNE · ${String(ref.index).padStart(2, "0")} · ${ref.title}`, kind: "image", url: ref.url, role: ref.role, source: "example", status: "ready", metadata: { fileName: ref.fileName, provenance: "AI-generated reference supplied by Ajwad", referenceToken: `[Image${ref.index}]`, referenceRole: ref.kind === "casting" ? "character" : ref.kind === "scene" ? "composition" : "product", shotIds: [...ref.shotIds], use: "Fictional concept direction; not approved real-product photography", width: ref.width, height: ref.height } }));
}
export function veluneAssets(): StudioAsset[] {
  return [
    { id: "velune-motion", name: "VELUNE · Blender camera study", kind: "video", url: VELUNE_MEDIA.animatic, role: "Camera, composition and timing · 15s / 24fps", source: "blender", status: "ready" },
    ...veluneVisualAssets(),
    { id: "velune-packaging", name: "VELUNE · packaging concept board", kind: "image", url: VELUNE_MEDIA.packaging, role: "Concept artwork only; not an approved product photograph or a clean per-face label", source: "example", status: "ready" },
    { id: "velune-report", name: "The Centre Report · concept", kind: "image", url: VELUNE_MEDIA.report, role: "Provisional report layout; replace with approved artwork for final graphics", source: "example", status: "ready" },
    { id: "velune-report-v2", name: "The Centre Report · v2 finishing master", kind: "document", url: "/studio/velune/finishing/velune_centre_report_v2.svg", role: "Exact report layout for final compositing; not an H3 image reference", source: "example", status: "ready" },
    { id: "velune-contact-sheet", name: "VELUNE · shot contact sheet", kind: "image", url: VELUNE_MEDIA.contactSheet, role: "Planning overview, not a texture reference", source: "blender", status: "ready" },
    { id: "velune-voiceover", name: "VELUNE · supplied ElevenLabs voiceover", kind: "audio", url: VELUNE_MEDIA.voiceover, role: "Play at zero alongside the H3 film; original video audio remains separate", source: "example", status: "ready" },
    { id: "velune-final", name: "VELUNE · final AI film", kind: "video", ...(VELUNE_FINAL_VIDEO ? { url: VELUNE_FINAL_VIDEO } : {}), role: "Finished film supplied by Ajwad", source: "generated", status: VELUNE_FINAL_VIDEO ? "ready" : "pending" },
  ];
}

export function newStudioProject(name: string, example?: "velune"): StudioProject {
  const now = Date.now();
  return { version: 1, id: crypto.randomUUID(), name: name.trim().slice(0, 100) || "Untitled project", ...(example ? { example } : {}), createdAt: now, updatedAt: now, drafts: {}, assets: example ? veluneAssets() : [] };
}

export function safeStudioMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  if (/^\/(?!\/)[^\\\u0000-\u0020]*$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
      ["ajwadrauf.com", "fal.media", "fal.ai", "recraft.ai", "recraftapi.com", "public.blob.vercel-storage.com"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export function validateStudioAsset(value: unknown): StudioAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid project asset.");
  const a = value as StudioAsset;
  if (typeof a.id !== "string" || !a.id || a.id.length > 200 || typeof a.name !== "string" || !a.name || a.name.length > 240 ||
      !["image", "video", "audio", "document"].includes(a.kind) || !["uploaded", "blender", "generated", "example"].includes(a.source) ||
      !["ready", "pending"].includes(a.status) || (a.url !== undefined && !safeStudioMediaUrl(a.url)) ||
      (a.dataUrl !== undefined && (typeof a.dataUrl !== "string" || !/^data:(?:image\/(?:png|jpeg|webp)|video\/(?:mp4|webm)|audio\/(?:wav|mpeg|mp3|ogg|webm)|application\/(?:json|pdf));base64,[A-Za-z0-9+/]*={0,2}$/.test(a.dataUrl)))) {
    throw new Error("The project contains an unsupported asset or media location.");
  }
  if (a.status === "ready" && !a.url && !a.dataUrl) throw new Error("A ready asset must have a file. Leave unfinished assets pending.");
  return { ...a, name: a.name.trim(), role: typeof a.role === "string" ? a.role.slice(0, 2000) : undefined };
}

export function validateStudioProject(value: unknown): StudioProject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This is not a studio project file.");
  const p = value as StudioProject;
  if (p.version !== 1 || typeof p.id !== "string" || !/^[0-9a-f-]{36}$/i.test(p.id) || typeof p.name !== "string" || !p.name.trim() || p.name.length > 100 ||
      !Number.isFinite(p.createdAt) || !Number.isFinite(p.updatedAt) || !p.drafts || typeof p.drafts !== "object" || Array.isArray(p.drafts) ||
      !Array.isArray(p.assets) || p.assets.length > 100 || (p.example !== undefined && p.example !== "velune")) throw new Error("This project file has invalid or unsupported fields.");
  const assets = p.assets.map(validateStudioAsset);
  if (new Set(assets.map((a) => a.id)).size !== assets.length) throw new Error("Project asset identifiers must be unique.");
  if (new Blob([JSON.stringify(p)]).size > PROJECT_MAX_BYTES) throw new Error("This project exceeds the 100 MB local project limit. Keep large films as supported media links.");
  return { version: 1, id: p.id, name: p.name.trim(), ...(p.example ? { example: p.example } : {}), createdAt: p.createdAt, updatedAt: p.updatedAt, drafts: p.drafts, assets };
}

/** Portable project copies never resume someone else's paid request or authentication. */
export function portableProject(project: StudioProject): StudioProject {
  const omit = new Set(["falRequestId", "operationName", "requestId", "request_id", "pendingJob", "auth", "apiKey", "FAL_KEY", "accessToken"]);
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (omit.has(key) || ["__proto__", "constructor", "prototype"].includes(key)) continue;
      out[key] = key === "status" && ["running", "polling", "queued", "submitting"].includes(String(v)) ? "interrupted" : clean(v);
    }
    return out;
  };
  return clean(project) as StudioProject;
}

function storageError(error?: unknown): Error {
  return new Error(error && typeof error === "object" && "name" in error && error.name === "QuotaExceededError"
    ? "Browser storage is full. Export a project and remove an older copy before saving again."
    : "Project storage is unavailable. Allow site storage and retry; keep this tab open until your work is saved.");
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(storageError()); return; }
    let request: IDBOpenDBRequest;
    let settled = false;
    const fail = (error: Error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
    const timer = setTimeout(() => fail(storageError()), TIMEOUT_MS);
    try { request = indexedDB.open(DATABASE, 1); } catch (error) { fail(storageError(error)); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }); };
    request.onblocked = () => fail(new Error("Close older studio tabs to finish opening project storage."));
    request.onerror = () => fail(storageError(request.error));
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true; clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, done: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result: T;
      let failure: unknown;
      const timer = setTimeout(() => { failure = storageError(); tx.abort(); }, TIMEOUT_MS);
      tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
      tx.onabort = () => { clearTimeout(timer); reject(failure instanceof Error ? failure : storageError(tx.error)); };
      tx.onerror = () => {};
      try { work(tx.objectStore(STORE), (value) => { result = value; }, (error) => { failure = error; tx.abort(); }); }
      catch (error) { failure = error; tx.abort(); }
    });
  } finally { db.close(); }
}
export async function listStudioProjects(): Promise<StudioProjectSummary[]> {
  return transaction("readonly", (store, done) => {
    const summaries: StudioProjectSummary[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { done(summaries.sort((a, b) => b.updatedAt - a.updatedAt)); return; }
      summaries.push(projectSummary(cursor.value as StudioProject));
      cursor.continue();
    };
  });
}
export async function loadStudioProject(id: string): Promise<StudioProject | null> {
  return transaction("readonly", (store, done) => { const req = store.get(id); req.onsuccess = () => done(req.result ?? null); });
}
export async function createStudioProject(project: StudioProject): Promise<StudioProject> {
  const safe = validateStudioProject(project);
  return transaction("readwrite", (store, done, fail) => {
    const req = store.count();
    req.onsuccess = () => {
      if (req.result >= MAX_PROJECTS) { fail(new Error("This browser holds 24 projects. Export and remove an older copy before creating another.")); return; }
      store.add(safe); done(safe);
    };
  });
}
/** Read/merge/write in one transaction prevents another tool's draft from being overwritten. */
export async function patchStudioProject(id: string, patch: { name?: string; tool?: string; draft?: unknown; asset?: StudioAsset; removeAssetId?: string }): Promise<StudioProject> {
  if (patch.asset) validateStudioAsset(patch.asset);
  if (patch.tool && (!/^[a-z][a-zA-Z0-9_-]{0,60}$/.test(patch.tool) || ["constructor", "prototype"].includes(patch.tool))) throw new Error("Invalid tool draft name.");
  return transaction("readwrite", (store, done, fail) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const current = req.result as StudioProject | undefined;
      if (!current) { fail(new Error("This project no longer exists on this device. Open or create another project.")); return; }
      const next = { ...current, updatedAt: Date.now(), drafts: { ...current.drafts }, assets: [...current.assets] };
      if (patch.name !== undefined) next.name = patch.name.trim().slice(0, 100) || current.name;
      if (patch.tool) next.drafts[patch.tool] = patch.draft;
      if (patch.asset) next.assets = [...next.assets.filter((a) => a.id !== patch.asset!.id), patch.asset];
      if (patch.removeAssetId) next.assets = next.assets.filter((a) => a.id !== patch.removeAssetId);
      try { validateStudioProject(next); } catch (error) { fail(error instanceof Error ? error : storageError()); return; }
      store.put(next); done(next);
    };
  });
}
export async function deleteStudioProject(id: string): Promise<void> {
  return transaction("readwrite", (store, done) => { store.delete(id); done(undefined); });
}

export function downloadStudioFile(name: string, content: Blob | string, type = "application/json") {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
