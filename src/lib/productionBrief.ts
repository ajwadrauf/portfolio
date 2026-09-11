import { EMPTY_BRIEF, type BlenderBrief } from "./blender";
import { VELUNE_SHOTS } from "@/components/velune/veluneStudy";
import type { Beat, Slot } from "./promptBuilder";

export type ProductionAsset = {
  id: string; name: string; kind: "image" | "video" | "audio" | "document";
  url?: string; dataUrl?: string; role?: string; status: "ready" | "pending";
};
export type BlenderDraft = { version: 1; brief: BlenderBrief; referenceAssets: Record<string, string> };
export type PromptDraft = {
  version: 1; values: Record<string, string>; slots: Slot[]; duration: number;
  beats: Beat[]; throughline: string;
};

export function veluneBlenderBrief(): BlenderBrief {
  return {
    ...EMPTY_BRIEF, editMode: "cuts", shotId: "VELUNE-15s", aspect: "16:9", seconds: "15", lens: "50", move: "",
    rig: "Twelve edited shots at 24 fps, following the existing 360-frame VELUNE camera study. Registered package turns; locked product inserts; a pullback in S07.",
    startFraming: "Chocolate folds frame the host in the existing opening composition.",
    endFraming: "Return to the chocolate world, retaining the composition through frame 359.",
    keyLight: "Soft studio key from camera left; keep contact and object shape visible.",
    lightCharacter: "Rich chocolate, plum and cream palette. Appearance references are still pending approval.",
    subjects: [
      { color: "plum #6B2949", proxy: "three flavour carton proxies", becomes: "VELUNE pistachio, raspberry and caramel cartons; supplied artwork is a flat concept, not approved product photography", ref: "Image 1" },
      { color: "cream #E8D6B9", proxy: "single report surface", becomes: "The Centre Report concept, with the exact artwork composited after generation", ref: "Image 2" },
      { color: "brown #673B27", proxy: "bonbons and chocolate folds", becomes: "rich chocolate forms; appearance references still required", ref: "" },
    ],
    beats: VELUNE_SHOTS.map((shot) => ({ from: String(shot.start / 24), to: String(shot.end / 24), action: `${shot.id} — ${shot.title}. ${shot.note}` })),
    creative: "An independent fictional VELUNE chocolate concept. Recreate the existing 15-second camera study and its twelve cuts. The final Seedance film and approved appearance photography are not yet produced.",
    composited: "Exact packaging type and The Centre Report artwork; preserve the three-second report interval (frames 242–313).",
    medium: "", physics: "resolve",
  };
}

/** Upgrade the first local VELUNE draft without changing any shot boundaries or user edits. */
export function normalizeBlenderDraft(draft: BlenderDraft): BlenderDraft {
  if (draft.brief.shotId !== "VELUNE-15s") return draft;
  const brief = draft.brief;
  return { ...draft, brief: { ...brief, editMode: brief.editMode ?? "cuts", medium: brief.medium === "chocolate folds and the bonbon merge" ? "" : brief.medium } };
}

export function velunePromptDraft(): PromptDraft {
  return {
    version: 1, duration: 15, throughline: "Proposed sound only: delicate chocolate movement and a restrained discovery motif. No existing soundtrack is supplied.",
    values: {
      register: "A premium chocolate concept film in a plum, cream and cocoa studio world.",
      subject: "VELUNE chocolates in pistachio, raspberry and caramel. Independent fictional concept; final appearance still requires approval.",
      bindings: "[Video1] is the actual 15-second Blender camera study: inherit its edit, composition, registered object motion and camera routes. [Image1] is flat packaging concept artwork, used for design direction only. [Image2] is The Centre Report artwork concept; reserve its lettering for exact compositing in post.",
      arrangement: "Keep each composition and visible count from the camera study. Retain twelve chocolates in the question silhouette and one printed report surface.",
      text: "Do not invent new claims or legal copy. Composite exact packaging and report typography after generation.",
      music: "No music baked into this generation; plan and finish the soundtrack separately.",
    },
    slots: [
      { id: "velune-motion", media: "video", job: "Actual Blender camera study — edit and motion" },
      { id: "velune-packaging", media: "image", job: "Flat packaging concept — design direction, not approved photography" },
      { id: "velune-report", media: "image", job: "The Centre Report — concept artwork for post" },
    ],
    beats: VELUNE_SHOTS.map((shot, index) => ({ seconds: (shot.end - shot.start) / 24, role: index === 0 ? "open" : index === 4 ? "climax" : index === 11 ? "resolve" : "build", action: `${shot.id} — ${shot.title}. ${shot.note}`, audio: "" })),
  };
}

export function isBlenderDraft(value: unknown): value is BlenderDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as BlenderDraft;
  const b = draft.brief;
  return draft.version === 1 && !!b && (b.editMode === undefined || b.editMode === "continuous" || b.editMode === "cuts") && Object.keys(EMPTY_BRIEF).filter((key) => key !== "subjects" && key !== "beats").every((key) => typeof b[key as keyof BlenderBrief] === "string") &&
    Array.isArray(b.subjects) && b.subjects.every((s) => s && [s.color, s.proxy, s.becomes, s.ref].every((x) => typeof x === "string")) &&
    Array.isArray(b.beats) && b.beats.every((beat) => beat && [beat.from, beat.to, beat.action].every((x) => typeof x === "string")) &&
    (b.physics === "inherit" || b.physics === "resolve") && !!draft.referenceAssets && typeof draft.referenceAssets === "object" && Object.values(draft.referenceAssets).every((id) => typeof id === "string");
}

export function isPromptDraft(value: unknown): value is PromptDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as PromptDraft;
  return d.version === 1 && Number.isFinite(d.duration) && d.duration >= 4 && d.duration <= 30 && typeof d.throughline === "string" &&
    !!d.values && Object.values(d.values).every((v) => typeof v === "string") && Array.isArray(d.slots) &&
    d.slots.every((s) => s && ["image", "video", "audio"].includes(s.media) && typeof s.job === "string" && (s.id === undefined || typeof s.id === "string") && (s.assetId === undefined || typeof s.assetId === "string")) && Array.isArray(d.beats) &&
    d.beats.every((b) => b && Number.isFinite(b.seconds) && typeof b.action === "string" && typeof b.audio === "string" && ["open", "build", "climax", "resolve"].includes(b.role));
}

export function referenceAsset(asset: ProductionAsset) {
  return { id: asset.id, name: asset.name, kind: asset.kind as "image" | "video" | "audio", role: asset.role ?? "reference", ...(asset.url ? { url: asset.url } : {}), ...(asset.dataUrl ? { dataUrl: asset.dataUrl } : {}) };
}

/** Local production package. Remote media stays a link; local project uploads and bundled examples travel with the brief. */
export async function downloadProductionBundle(input: {
  name: string; prompt: string; buildBrief?: string; draft: unknown; cues: unknown;
  references: { token: string; job: string; asset?: ProductionAsset }[];
}) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {
    "01_seedance_prompt.txt": strToU8(input.prompt),
    "03_shot_source.json": strToU8(JSON.stringify(input.draft, null, 2)),
    "04_cue_sheet.json": strToU8(JSON.stringify(input.cues, null, 2)),
  };
  if (input.buildBrief) files["02_blender_build_brief.md"] = strToU8(input.buildBrief);
  const manifest: Record<string, unknown>[] = [];
  let total = 0;
  for (const reference of input.references) {
    const asset = reference.asset;
    const row: Record<string, unknown> = { token: reference.token, job: reference.job, status: asset?.status ?? "missing" };
    const source = asset?.dataUrl ?? asset?.url;
    if (asset?.status === "ready" && source) {
      row.name = asset.name;
      row.source = asset.url ?? "project upload";
      if (source.startsWith("data:") || (source.startsWith("/") && !source.startsWith("//"))) {
        const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Could not package ${asset.name}. Your draft is saved; retry the download.`);
        const blob = await response.blob();
        total += blob.size;
        if (total > 64 * 1024 * 1024) throw new Error("The attached files exceed the 64 MB bundle limit. Keep large clips as project links and retry.");
        const extension = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/wav": ".wav" } as Record<string, string>)[blob.type] ?? ".bin";
        const safeName = `${manifest.length + 1}_${asset.name.replace(/[^a-zA-Z0-9._-]/g, "_")}${/\.(?:jpe?g|png|webp|mp4|webm|mp3|wav)$/i.test(asset.name) ? "" : extension}`;
        files[`references/${safeName}`] = new Uint8Array(await blob.arrayBuffer());
        row.file = `references/${safeName}`;
      } else row.status = "external link — download separately";
    }
    manifest.push(row);
  }
  files["05_reference_manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  if (input.buildBrief) {
    const guide = await fetch("/blender/CLAUDE.md", { signal: AbortSignal.timeout(10000) });
    if (!guide.ok) throw new Error("The Blender working guide could not be included. Retry the bundle download.");
    files["CLAUDE.md"] = strToU8(await guide.text());
  }
  files["README.txt"] = strToU8("Production planning bundle. No generation was purchased.\nUse the reference manifest to match tokens with files. Missing references still need to be supplied; concept artwork is not approved product photography.\nThe JSON source preserves editable decisions. Keep exact lettering for compositing and review the output before publication.\n");
  const bytes = zipSync(files, { level: 1 });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/zip" }));
  const link = document.createElement("a"); link.href = url; link.download = `${input.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "production"}_production.zip`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
