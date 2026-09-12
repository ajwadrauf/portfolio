import { EMPTY_BRIEF, type BlenderBrief } from "./blender";
import { VELUNE_GENERATION_SHOTS as VELUNE_SHOTS } from "./veluneDirection";
import { VELUNE_REFERENCES, veluneShotReferenceIds } from "./veluneReferences";
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

const VELUNE_COLOURS = ["green #A9BB82", "plum #6B2949", "gold #BB752A", "brown #673B27", "green #488144", "red #A53D54", "green #718044", "cream #E8D6B9", "cyan #258C98", "magenta #B44592", "amber #BB752A"];
const VELUNE_SUBJECTS = Object.fromEntries(VELUNE_REFERENCES.map((r, i) => [r.id, { color: VELUNE_COLOURS[i], proxy: r.title, becomes: r.role }]));

/** New example drafts use this exact upload order. Existing draft assignments are never replaced. */
export function veluneBlenderReferenceAssets(): Record<string, string> {
  return { "@Video 1": "velune-motion", ...Object.fromEntries(VELUNE_REFERENCES.map((reference) => [`@Image ${reference.index}`, reference.id])) };
}

function veluneShotAction(shot: (typeof VELUNE_SHOTS)[number]): string {
  const referenceIds = new Set(veluneShotReferenceIds(shot.id));
  const references = VELUNE_REFERENCES.filter((reference) => referenceIds.has(reference.id));
  const appearance = references.length ? ` Appearance references: ${references.map((reference) => `[Image${reference.index}] — ${reference.role}`).join("; ")}.` : "";
  return `${shot.id} — ${shot.title}. ${shot.note}${appearance}`;
}

export function veluneBlenderBrief(): BlenderBrief {
  return {
    ...EMPTY_BRIEF, editMode: "cuts", shotId: "VELUNE-15s", aspect: "16:9", seconds: "15", lens: "50", move: "",
    rig: "Twelve edited shots at 24 fps, following the existing 360-frame VELUNE camera study. Registered package turns; locked product inserts; a pullback in S07.",
    startFraming: "Original guide retained; final picture uses Image 10 for a tight empty chocolate opening.",
    endFraming: "Final picture uses Image 11 for a wider three-centre dish reveal, held through frame 359.",
    keyLight: "Soft studio key from camera left; keep contact and object shape visible.",
    lightCharacter: "Rich chocolate, plum and cream palette. The eleven supplied AI-generated images guide appearance for this fictional concept; they are not approved real-product photographs.",
    subjects: [
      ...VELUNE_REFERENCES.map((reference) => ({ ...VELUNE_SUBJECTS[reference.id], ref: `Image ${reference.index}` })),
      { color: "cream #E8D6B9", proxy: "single report surface", becomes: "The Centre Report artifact, with its exact artwork composited after generation; do not invent an additional reference image", ref: "" },
    ],
    beats: VELUNE_SHOTS.map((shot) => ({ from: String(shot.start / 24), to: String(shot.end / 24), action: veluneShotAction(shot) })),
    creative: "An independent fictional VELUNE chocolate concept. Recreate the existing 15-second camera study and its twelve shots. Revision 2 uses eleven images for final appearance and explicit shot overrides. The existing Blender study stays unchanged; retain its cut schedule and main motion beats. Opening, ending, working gestures and serving count follow the revised directions. This is planning for the next take, not evidence of a finished film.",
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
      subject: "VELUNE chocolates in pistachio, raspberry and caramel. Use the whole bonbon's V-groove and shell consistently across the pistachio and contained-caramel halves. The eleven supplied AI-generated references belong to an independent fictional concept. Nine new images and two retained chocolate studies guide the revised take; they are not approved real-product photographs.",
      bindings: [
        "[Video1] is the actual 15-second, 360-frame Blender camera study at 24 fps. Keep its timing, twelve-shot edit and main motion beats; the explicit revised shot directions override proxy materials, cast, opening/ending framing and serving count.",
        ...VELUNE_REFERENCES.map((reference) => `[Image${reference.index}] is the supplied generated ${reference.title}: ${reference.role}.`),
        "Image 10 controls the tight empty opening; Image 11 controls the wide final product reveal. Image 9 supplies TWO BACK-FACING workers in ivory jackets and plum aprons, heads outside the crop, making the specified small working gestures.",
        "Images 6 and 7 control the raspberry and pistachio INGREDIENTS in S08 and S09. Image 8 controls the three filled chocolate halves on the serving dish, including raspberry ganache. Keep those roles distinct.",
      ].join(" "),
      arrangement: "Retain twelve chocolates in the question silhouette, two back-facing discovery-studio workers with stacks of three left and two right, and one printed report surface. Override the serving with three cut halves, and replace the opening and ending compositions as directed. Keep caramel contained.",
      text: "Do not invent new claims or legal copy. Composite exact packaging type and The Centre Report artifact after generation. The report is held at S11 for frames 242–313 and is not an additional image upload or an invented twelfth image.",
      music: "No music baked into this generation; plan and finish the soundtrack separately.",
    },
    slots: [
      { id: "velune-motion", assetId: "velune-motion", media: "video", job: "Actual Blender camera study — camera, edit, motion and timing" },
      ...VELUNE_REFERENCES.map((reference) => ({ id: reference.id, assetId: reference.id, media: "image" as const, job: reference.role })),
    ],
    beats: VELUNE_SHOTS.map((shot, index) => ({ seconds: (shot.end - shot.start) / 24, role: index === 0 ? "open" : index === 4 ? "climax" : index === 11 ? "resolve" : "build", action: veluneShotAction(shot), audio: "" })),
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
