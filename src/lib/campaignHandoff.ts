import type { PackAngle } from "./packshot";

export type CampaignPackshotMeta = {
  name: string;
  angle: PackAngle;
  source: "generated" | "artwork";
  variant: string;
  model?: string;
  review: "reviewed" | "needs-review";
  reviewedAt?: string;
  note?: string;
};

export type CampaignHandoffRecord = {
  version: 1;
  id: string;
  createdAt: number;
  expiresAt: number;
  blob: Blob;
  meta: CampaignPackshotMeta;
  /** Optional extension: the first view remains compatible with older single-view transfers. */
  additionalViews?: CampaignHandoffView[];
};
export type CampaignHandoffView = { blob: Blob; meta: CampaignPackshotMeta };
export type CampaignHandoffSource = { source: string; meta: CampaignPackshotMeta };
export const CAMPAIGN_HANDOFF_MAX_VIEWS = 7;
export const CAMPAIGN_HANDOFF_MAX_SET_BYTES = 96 * 1024 * 1024;

export function campaignHandoffViews(record: CampaignHandoffRecord): CampaignHandoffView[] {
  return [{ blob: record.blob, meta: record.meta }, ...(record.additionalViews ?? [])];
}

export const CAMPAIGN_HANDOFF_TTL = 24 * 60 * 60 * 1000;
export const CAMPAIGN_HANDOFF_MAX_BYTES = 24 * 1024 * 1024;
export const CAMPAIGN_HANDOFF_MAX_RECORDS = 8;
const DATABASE = "ai-studio-campaign-handoffs-v1";
const STORE = "packshots";
const IO_TIMEOUT = 30_000;
const ANGLES = new Set(["front", "back", "left", "right", "top", "bottom", "hero34"]);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const PROVIDER_HOSTS = ["fal.media", "fal.ai", "recraft.ai", "recraftapi.com", "public.blob.vercel-storage.com"];

export function validCampaignHandoffId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`The packshot ${label} is missing or invalid. Return to Packshots and send the completed view again.`);
  }
  return value.trim();
}

export function readCampaignPackshotMeta(value: unknown): CampaignPackshotMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The packshot details are invalid.");
  const meta = value as Record<string, unknown>;
  if (typeof meta.angle !== "string" || !ANGLES.has(meta.angle) ||
      (meta.source !== "generated" && meta.source !== "artwork") ||
      (meta.review !== "reviewed" && meta.review !== "needs-review")) throw new Error("The packshot source, view or review status is invalid.");
  if (meta.reviewedAt !== undefined && (typeof meta.reviewedAt !== "string" || meta.reviewedAt.length > 40 || !Number.isFinite(Date.parse(meta.reviewedAt)))) {
    throw new Error("The packshot review date is invalid.");
  }
  return {
    name: requiredText(meta.name, "name", 180),
    angle: meta.angle as PackAngle,
    source: meta.source,
    variant: requiredText(meta.variant, "variant", 180),
    review: meta.review,
    ...(meta.model !== undefined ? { model: requiredText(meta.model, "model", 120) } : {}),
    ...(meta.reviewedAt !== undefined ? { reviewedAt: meta.reviewedAt as string } : {}),
    ...(meta.note !== undefined ? { note: requiredText(meta.note, "note", 1200) } : {}),
  };
}

export function isCampaignProviderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
      PROVIDER_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

/** Check bytes as well as MIME before persisting any provider or locally rendered image. */
export async function validateCampaignImage(blob: Blob): Promise<Blob> {
  if (!(blob instanceof Blob) || !blob.size || blob.size > CAMPAIGN_HANDOFF_MAX_BYTES) {
    throw new Error("Use a completed PNG, JPEG or WebP packshot up to 24 MB. Try a smaller render size if needed.");
  }
  const declared = blob.type.split(";")[0].toLowerCase().trim();
  if (!IMAGE_TYPES.has(declared)) throw new Error("This handoff supports PNG, JPEG and WebP images only.");
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 &&
    bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
  const actual = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (actual !== declared) throw new Error("The downloaded packshot is not a valid matching PNG, JPEG or WebP file. Download the view again before retrying.");
  return blob.type === actual ? blob : new Blob([blob], { type: actual });
}

function abortError(): Error { return new Error("The handoff was cancelled. Send the current completed view again."); }
function assertNotAborted(signal?: AbortSignal) { if (signal?.aborted) throw abortError(); }

export async function sourceImage(source: string, signal?: AbortSignal): Promise<Blob> {
  assertNotAborted(signal);
  if (source.startsWith("data:")) {
    // The bound is checked before decoding, avoiding a large base64 allocation.
    if (source.length > Math.ceil(CAMPAIGN_HANDOFF_MAX_BYTES / 3) * 4 + 64) throw new Error("This packshot exceeds 24 MB. Render a smaller view and try again.");
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(source);
    if (!match || !match[2] || match[2].length % 4 !== 0) throw new Error("The completed packshot image is invalid. Render this view again.");
    let decoded: string;
    try { decoded = atob(match[2]); } catch { throw new Error("The completed packshot image could not be decoded."); }
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    return validateCampaignImage(new Blob([bytes], { type: match[1] }));
  }
  if (!isCampaignProviderUrl(source)) throw new Error("This packshot is not from a supported image provider. Download it and upload the image in Campaign Studio instead.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, IO_TIMEOUT);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(`/api/packshot-file?${new URLSearchParams({ url: source, name: "campaign-packshot" })}`, { signal: controller.signal, cache: "no-store" });
    if (!response.ok || !response.body) throw new Error(`The completed packshot could not be downloaded (${response.status}). Your render is still in Packshots; try again.`);
    const type = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase().trim();
    if (!IMAGE_TYPES.has(type)) throw new Error("The provider returned a file that is not PNG, JPEG or WebP.");
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > CAMPAIGN_HANDOFF_MAX_BYTES) throw new Error("This packshot exceeds 24 MB. Download it or use a smaller render.");
    reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > CAMPAIGN_HANDOFF_MAX_BYTES) throw new Error("This packshot exceeds 24 MB. Download it or use a smaller render.");
      chunks.push(new Uint8Array(value));
    }
    return await validateCampaignImage(new Blob(chunks, { type }));
  } catch (error) {
    if (controller.signal.aborted) throw signal?.aborted ? abortError() : new Error("The image download timed out. Your render is still in Packshots; try again.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    await reader?.cancel().catch(() => {});
  }
}

function storageError(error: unknown): Error {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "QuotaExceededError") return new Error("This browser has no room for the packshot handoff. Download the image and upload it in Campaign Studio, or free browser storage and retry.");
  return new Error("This browser could not save or read the packshot handoff. Allow site storage, or download the image and upload it in Campaign Studio.");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("This browser does not support local packshot handoffs. Download the image and upload it in Campaign Studio.")); return; }
    let request: IDBOpenDBRequest;
    let settled = false;
    const timer = setTimeout(() => fail(new Error("Site storage took too long to open. Close older Campaign Studio tabs and try again.")), IO_TIMEOUT);
    const fail = (error: Error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
    try { request = indexedDB.open(DATABASE, 1); } catch (error) { fail(storageError(error)); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }); };
    request.onerror = () => fail(storageError(request.error));
    request.onblocked = () => fail(new Error("Another tab is blocking packshot storage. Close older Campaign Studio tabs and retry."));
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function putRecord(record: CampaignHandoffRecord): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const timer = setTimeout(() => transaction.abort(), IO_TIMEOUT);
      transaction.oncomplete = () => { clearTimeout(timer); resolve(); };
      transaction.onabort = () => { clearTimeout(timer); reject(storageError(transaction.error)); };
      transaction.onerror = () => {}; // onabort owns the rejection and preserves transaction atomicity.
      const request = store.getAll();
      request.onsuccess = () => {
        const retained = (request.result as CampaignHandoffRecord[]).filter((item) => {
          if (!item || !validCampaignHandoffId(item.id) || !Number.isFinite(item.expiresAt) || item.expiresAt <= record.createdAt) {
            if (item?.id) store.delete(item.id);
            return false;
          }
          return true;
        }).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
        while (retained.length >= CAMPAIGN_HANDOFF_MAX_RECORDS) store.delete(retained.shift()!.id);
        store.put(record);
      };
    });
  } finally { db.close(); }
}

/** Persist actual image bytes locally, so the destination never depends on an expiring provider URL. */
export async function saveCampaignHandoff(source: string, meta: CampaignPackshotMeta, options: { signal?: AbortSignal } = {}): Promise<CampaignHandoffRecord> {
  return saveCampaignHandoffSet([{ source, meta }], options);
}

/** A set occupies one storage record and is committed only after every view is valid. */
export async function saveCampaignHandoffSet(sources: CampaignHandoffSource[], options: { signal?: AbortSignal } = {}): Promise<CampaignHandoffRecord> {
  if (!Array.isArray(sources) || !sources.length || sources.length > CAMPAIGN_HANDOFF_MAX_VIEWS) throw new Error("Choose between one and seven completed views.");
  const views: CampaignHandoffView[] = [];
  let bytes = 0;
  for (const item of sources) {
    const meta = readCampaignPackshotMeta(item.meta);
    const blob = await sourceImage(item.source, options.signal);
    bytes += blob.size;
    if (bytes > CAMPAIGN_HANDOFF_MAX_SET_BYTES) throw new Error("This set exceeds 96 MB. Render at a smaller size and send the views again.");
    views.push({ blob, meta });
  }
  assertNotAborted(options.signal);
  if (!globalThis.crypto?.randomUUID) throw new Error("Use a secure browser connection to transfer this packshot.");
  const createdAt = Date.now();
  const record: CampaignHandoffRecord = { version: 1, id: crypto.randomUUID(), createdAt, expiresAt: createdAt + CAMPAIGN_HANDOFF_TTL, ...views[0], ...(views.length > 1 ? { additionalViews: views.slice(1) } : {}) };
  await putRecord(record);
  assertNotAborted(options.signal);
  return record;
}

export async function loadCampaignHandoff(id: string): Promise<CampaignHandoffRecord | null> {
  if (!validCampaignHandoffId(id)) return null;
  const db = await openDatabase();
  let value: CampaignHandoffRecord | undefined;
  try {
    value = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const request = transaction.objectStore(STORE).get(id);
      const timer = setTimeout(() => transaction.abort(), IO_TIMEOUT);
      request.onsuccess = () => {
        const record = request.result as CampaignHandoffRecord | undefined;
        if (record && (!Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now())) {
          transaction.objectStore(STORE).delete(id);
          value = undefined;
        } else value = record;
      };
      transaction.oncomplete = () => { clearTimeout(timer); resolve(value); };
      transaction.onabort = () => { clearTimeout(timer); reject(storageError(transaction.error)); };
      transaction.onerror = () => {};
    });
  } finally { db.close(); }
  if (!value) return null;
  if (value.version !== 1 || value.id !== id || !Number.isFinite(value.createdAt) || !Number.isFinite(value.expiresAt) ||
      value.createdAt > Date.now() + 60_000 || value.expiresAt - value.createdAt !== CAMPAIGN_HANDOFF_TTL) {
    throw new Error("The stored packshot handoff is invalid. Return to Packshots and send this view again.");
  }
  if (value.additionalViews !== undefined && (!Array.isArray(value.additionalViews) || value.additionalViews.length >= CAMPAIGN_HANDOFF_MAX_VIEWS)) throw new Error("The stored view set is invalid. Send it again from Packshots.");
  const views: CampaignHandoffView[] = [];
  let bytes = 0;
  for (const item of campaignHandoffViews(value)) {
    if (!item) throw new Error("A view is missing from this set. Send it again from Packshots.");
    const blob = await validateCampaignImage(item.blob);
    bytes += blob.size;
    if (bytes > CAMPAIGN_HANDOFF_MAX_SET_BYTES) throw new Error("This stored view set exceeds 96 MB.");
    views.push({ blob, meta: readCampaignPackshotMeta(item.meta) });
  }
  return { ...value, ...views[0], ...(value.additionalViews ? { additionalViews: views.slice(1) } : {}) };
}

/** Lossless conversion only; callers should separately bound and encode any paid analysis input. */
export async function blobToCampaignDataUrl(blob: Blob): Promise<string> {
  const image = await validateCampaignImage(blob);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The packshot could not be read."));
    reader.onerror = () => reject(new Error("The packshot could not be read."));
    reader.readAsDataURL(image);
  });
}
