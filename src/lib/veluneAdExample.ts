import { H3_MODEL_ID, videoPromptFor } from "./h3Video";
import { VELUNE_SHOTS } from "@/components/velune/veluneStudy";
import { VELUNE_REFERENCES, veluneShotReferenceIds } from "./veluneReferences";
import { velunePromptDraft } from "./productionBrief";
import { VELUNE_H3_PROMPT, VELUNE_MUSIC_BRIEF, VELUNE_SOUND_PLAN, VELUNE_EFFECT_CUES } from "./veluneAdContent";
import { readyAdReferences, type AdLabSeed } from "./adDraft";
import type { StudioAsset } from "./studioProjects";

/** Explicit tokens keep an older project with missing files from silently shifting images. */
export function veluneAdExample(assets: StudioAsset[]): AdLabSeed {
  const seed = velunePromptDraft();
  const specs = [{ id: "velune-motion", token: "[Video1]", job: "Actual Blender camera study: camera, edit and timing", role: "motion" }, ...VELUNE_REFERENCES.map((ref) => ({ id: ref.id, token: `[Image${ref.index}]`, job: ref.role, role: ref.kind === "casting" ? "character" : ref.kind === "scene" ? "composition" : "product" }))];
  const available = readyAdReferences(assets);
  const references = specs.flatMap((spec) => { const asset = available.find((a) => a.id === spec.id); return asset ? [{ ...asset, token: spec.token, role: spec.role }] : []; });
  return {
    schema: "adlab-draft-v1", source: "velune", prompt: VELUNE_H3_PROMPT, modelId: H3_MODEL_ID, duration: 15, aspect: "16:9", resolution: "768p", lane: "blender", imported: true, audioMode: "silent", references,
    negativePrompt: "", productImage: null, endImage: null,
    recipe: { aesthetics: [], scenes: [], overlay: "", sfx: [] },
    soundPlan: { ...VELUNE_SOUND_PLAN, voice: { ...VELUNE_SOUND_PLAN.voice! }, scenes: VELUNE_SOUND_PLAN.scenes.map((cue) => ({ ...cue })) },
    scoreToPlan: false, voiceTakes: {}, musicStyleId: "premium-cinematic", musicCustomPrompt: VELUNE_MUSIC_BRIEF,
    musicAsTimingRef: false, musicUrl: null, musicSpec: "", musicMock: false, musicVolume: 0.35, musicOn: true,
    effectCues: VELUNE_EFFECT_CUES.map((cue) => ({ ...cue, placements: cue.placements.map((p) => ({ ...p })) })),
    extraEffects: [], sfxSeconds: 0.5, sfxTracks: {}, sfxMocks: {}, customEffect: "", mixTracks: [], ducking: 0.45, completedTake: null,
    referenceManifest: specs.map((spec) => ({ token: spec.token, job: spec.job, assetId: references.some((ref) => ref.id === spec.id) ? spec.id : null })),
    unattachedSlots: specs.filter((spec) => !references.some((ref) => ref.id === spec.id)).map((spec) => `${spec.token}: ${spec.job}`),
    sceneCards: VELUNE_SHOTS.map((shot) => {
      const ids = veluneShotReferenceIds(shot.id);
      // A scene-wide still makes a more useful storyboard thumbnail than its cast portrait.
      ids.sort((a, b) => Number(VELUNE_REFERENCES.find((r) => r.id === b)?.kind === "scene") - Number(VELUNE_REFERENCES.find((r) => r.id === a)?.kind === "scene"));
      const voice = VELUNE_SOUND_PLAN.scenes.filter((cue) => cue.line && cue.voiceStart! >= shot.start / 24 && cue.voiceStart! < shot.end / 24).map((cue) => `Voice at ${cue.voiceStart!.toFixed(3)}s: ${cue.line}`);
      const effects = VELUNE_EFFECT_CUES.flatMap((cue) => cue.placements.filter((p) => p.start >= shot.start / 24 && p.start < shot.end / 24).map((p) => `${cue.name} at ${p.start.toFixed(3)}s`));
      return { id: shot.id, title: shot.title, start: shot.start / 24, end: shot.end / 24, action: videoPromptFor(H3_MODEL_ID, seed.beats.find((_, i) => VELUNE_SHOTS[i].id === shot.id)?.action ?? shot.note), camera: shot.id === "S07" ? "Camera pullback from the actual Blender study" : "Follow the supplied Blender composition and registered motion", sound: [...voice, ...effects, "Separate 80 BPM instrumental score; replace H3 native audio in the final edit."].join(" · "), referenceIds: ["velune-motion", ...ids] };
    }),
  };
}
