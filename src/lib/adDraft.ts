import { z } from "zod";
import { AD_VIDEO_MODELS, REFERENCE_ROLES, REF_CEILINGS, referenceCeilingsFor } from "./adPresets";
import type { StudioAsset } from "./studioProjects";
import { voiceSettingsSchema, effectCueSchema } from "./soundPlan";

// Drafts contain references and creative decisions, never live authorization or resumable jobs.
const mediaSource = z.string().max(32_000_000).refine((s) => /^https:\/\/[^\s]+$/.test(s) || /^\/(?!\/)[^\s\\]+$/.test(s) || /^data:(image|video|audio)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]*={0,2}$/i.test(s), "Unsupported media source");
export const voiceTakeSchema = z.object({ url: mediaSource, spec: z.string().max(5000), mock: z.boolean(), label: z.string().max(300).optional(), recovered: z.boolean().optional() });
export type VoiceTake = z.infer<typeof voiceTakeSchema>;
const referenceToken = z.string().regex(/^\[(Image|Video|Audio)[1-9][0-9]?\]$/);
export const referenceBindingSchema = z.object({ token: referenceToken, job: z.string().max(3000), assetId: z.string().max(200).nullable() });
export type AdReferenceBinding = z.infer<typeof referenceBindingSchema>;
export const adReferenceSchema = z.object({ id: z.string().min(1).max(200), name: z.string().max(240), kind: z.enum(["image", "video", "audio"]), role: z.string().max(2000), token: referenceToken.optional(), url: mediaSource.optional(), dataUrl: mediaSource.optional() }).refine((r) => !!(r.url || r.dataUrl), "Reference has no media");
// Keep structurally valid but unfinished timing edits. The board and generation
// validators show their problems; reopening a draft must not discard those edits.
export const sceneCardSchema = z.object({ id: z.string().max(100), title: z.string().max(150), start: z.number().finite(), end: z.number().finite(), action: z.string().max(6000), camera: z.string().max(1500), sound: z.string().max(1500), referenceIds: z.array(z.string().max(200)).max(REF_CEILINGS.total) });
const draftSoundPlanSchema = z.object({ title: z.string().max(120), bpm: z.number().finite(), narration: z.enum(["external", "native", "none"]), voice: voiceSettingsSchema.optional(), scenes: z.array(z.object({ id: z.string().max(80), title: z.string().max(80), seconds: z.number().finite(), line: z.string().max(1200), music: z.string().max(400), voiceStart: z.number().finite().optional(), voiceEnd: z.number().finite().optional() })).min(1).max(10) });
export type AdSceneCard = z.infer<typeof sceneCardSchema>;
export const mixTrackSchema = z.object({ id: z.string().max(300), name: z.string().max(300), url: mediaSource, kind: z.enum(["voice", "music", "effect"]), start: z.number().finite().min(0).max(60), trim: z.number().finite().min(0).max(600), length: z.number().finite().min(0.05).max(60), gain: z.number().finite().min(0).max(2), fadeIn: z.number().finite().min(0).max(30), fadeOut: z.number().finite().min(0).max(30), enabled: z.boolean() });
export type AdMixTrack = z.infer<typeof mixTrackSchema>;
const stringMap = z.record(z.string(), z.string());
export const adDraftSchema = z.object({
  schema: z.literal("adlab-draft-v1"), source: z.enum(["ad", "prompt", "blender", "campaign", "velune"]), prompt: z.string().max(4_194_304),
  modelId: z.string().refine((id) => (AD_VIDEO_MODELS as readonly string[]).includes(id)), duration: z.number().finite().min(4).max(30), aspect: z.string().optional(),
  references: z.array(adReferenceSchema).max(REF_CEILINGS.total), soundPlan: draftSoundPlanSchema.nullable().optional(), unattachedSlots: z.array(z.string().max(1000)).max(30).optional(),
  referenceManifest: z.array(referenceBindingSchema).max(REF_CEILINGS.total).optional(),
  presetId: z.string().optional(), params: stringMap.optional(), productImage: mediaSource.nullable().optional(), endImage: mediaSource.nullable().optional(),
  negativePrompt: z.string().max(4_194_304).optional(), lane: z.enum(["recipe", "blender"]).optional(), imported: z.boolean().optional(), resolution: z.enum(["480p", "720p", "768p", "1080p"]).optional(),
  recipe: z.object({ aesthetics: z.array(z.string()), scenes: z.array(z.object({ title: z.string(), description: z.string() })), overlay: z.string(), sfx: z.array(z.string()) }).optional(),
  audioMode: z.enum(["native", "layered", "silent"]).optional(), scoreToPlan: z.boolean().optional(), voiceTakes: z.record(z.string(), voiceTakeSchema).optional(),
  musicStyleId: z.string().optional(), musicUrl: mediaSource.nullable().optional(), musicSpec: z.string().optional(), musicMock: z.boolean().optional(), musicCustomPrompt: z.string().max(10000).optional(), musicAsTimingRef: z.boolean().optional(), musicVolume: z.number().min(0).max(1).optional(), musicOn: z.boolean().optional(),
  sfxTracks: z.record(z.string(), mediaSource).optional(), sfxMocks: z.record(z.string(), z.boolean()).optional(), extraEffects: z.array(z.string()).optional(), sfxSeconds: z.number().finite().min(0.1).max(30).optional(), customEffect: z.string().optional(),
  effectCues: z.array(effectCueSchema).max(30).optional(),
  sceneCards: z.array(sceneCardSchema).max(30).optional(), mixTracks: z.array(mixTrackSchema).max(60).optional(), ducking: z.number().finite().min(0).max(1).optional(),
  completedTake: z.object({ id: z.string(), videoUrl: mediaSource, context: z.object({ submittedAt: z.string(), prompt: z.string(), negativePrompt: z.string().optional(), modelId: z.string(), durationSeconds: z.number().finite().positive(), aspect: z.string(), resolution: z.string().optional(), audioMode: z.string().optional(), references: z.array(z.object({ name: z.string(), media: z.string(), role: z.string() })) }).nullable(), referenceImages: z.array(z.object({ name: z.string(), role: z.string(), dataUrl: mediaSource })).optional(), sceneCards: z.array(sceneCardSchema).max(30).optional() }).nullable().optional(),
});
export type AdLabSeed = z.infer<typeof adDraftSchema>;
export function adDocumentDataUrl(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2)); let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:application/json;base64,${btoa(binary)}`;
}
export function parseAdDraft(value: unknown): AdLabSeed | null {
  const parsed = adDraftSchema.safeParse(value); return parsed.success ? parsed.data : null;
}
export function referenceRole(kind: "image" | "video" | "audio", role: string) {
  const exact = REFERENCE_ROLES.find((r) => r.id === role && (r.media as readonly string[]).includes(kind));
  return exact?.id ?? (kind === "video" ? "motion" : kind === "audio" ? "ambience" : "product");
}
export function readyAdReferences(assets: StudioAsset[]): AdLabSeed["references"] {
  return assets.filter((a) => a.status === "ready" && a.kind !== "document" && (a.url || a.dataUrl)).map((a) => ({ id: a.id, name: a.name, kind: a.kind as "image" | "video" | "audio", role: referenceRole(a.kind as "image" | "video" | "audio", typeof a.metadata?.referenceRole === "string" ? a.metadata.referenceRole : a.role ?? ""), ...(a.url ? { url: a.url } : {}), ...(a.dataUrl ? { dataUrl: a.dataUrl } : {}) }));
}

/** Positional providers must receive every imported asset in the slot named by its prompt. */
export function referenceBindingProblems(references: AdLabSeed["references"], manifest: AdReferenceBinding[]): string[] {
  const counts = { image: 0, video: 0, audio: 0 }; const names = { image: "Image", video: "Video", audio: "Audio" };
  const tokens = new Map(references.map((r) => [r.id, `[${names[r.kind]}${++counts[r.kind]}]`]));
  return manifest.flatMap((row) => !row.assetId || !tokens.has(row.assetId) ? [`${row.token}: ${row.job} needs an attached file.`] : tokens.get(row.assetId) !== row.token ? [`${row.token}: its assigned file currently occupies ${tokens.get(row.assetId)}. Apply the declared slot order before generating.`] : []);
}

export function adReferenceAdditionProblem(reference: AdLabSeed["references"][number], current: AdLabSeed["references"], extra: Partial<Record<"image" | "video" | "audio", number>> = {}, modelId = "seedance-2.5-ref"): string | null {
  const ceilings = referenceCeilingsFor(modelId);
  const source = reference.dataUrl ?? reference.url;
  if (current.some((r) => r.id === reference.id || (r.dataUrl ?? r.url) === source)) return "This asset is already attached. Assign its existing slot in the imported reference review.";
  const count = current.filter((r) => r.kind === reference.kind).length + (extra[reference.kind] ?? 0);
  if (count >= ceilings[reference.kind]) return `This endpoint supports at most ${ceilings[reference.kind]} ${reference.kind} references. Remove one before adding another.`;
  if (current.length + Object.values(extra).reduce((total, value) => total + (value ?? 0), 0) >= ceilings.total) return `This endpoint supports at most ${ceilings.total} references in total.`;
  return null;
}
