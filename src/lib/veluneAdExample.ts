import { VELUNE_SHOTS } from "@/components/velune/veluneStudy";
import { VELUNE_REFERENCES, veluneShotReferenceIds } from "./veluneReferences";
import { velunePromptDraft } from "./productionBrief";
import { assemble } from "./promptBuilder";
import { readyAdReferences, type AdLabSeed } from "./adDraft";
import type { StudioAsset } from "./studioProjects";

/** Explicit tokens keep an older project with missing files from silently shifting images. */
export function veluneAdExample(assets: StudioAsset[]): AdLabSeed {
  const seed = velunePromptDraft();
  const specs = [{ id: "velune-motion", token: "[Video1]", job: "Actual Blender camera study: camera, edit and timing", role: "motion" }, ...VELUNE_REFERENCES.map((ref) => ({ id: ref.id, token: `[Image${ref.index}]`, job: ref.role, role: ref.kind === "casting" ? "character" : ref.kind === "scene" ? "composition" : "product" }))];
  const available = readyAdReferences(assets);
  const references = specs.flatMap((spec) => { const asset = available.find((a) => a.id === spec.id); return asset ? [{ ...asset, token: spec.token, role: spec.role }] : []; });
  return {
    schema: "adlab-draft-v1", source: "velune", prompt: assemble(seed.values, seed.beats, seed.duration, seed.throughline), modelId: "seedance-2.5-ref", duration: 15, aspect: "16:9", lane: "blender", imported: true, audioMode: "silent", references,
    referenceManifest: specs.map((spec) => ({ token: spec.token, job: spec.job, assetId: references.some((ref) => ref.id === spec.id) ? spec.id : null })),
    unattachedSlots: specs.filter((spec) => !references.some((ref) => ref.id === spec.id)).map((spec) => `${spec.token}: ${spec.job}`),
    sceneCards: VELUNE_SHOTS.map((shot) => {
      const ids = veluneShotReferenceIds(shot.id);
      // A scene-wide still makes a more useful storyboard thumbnail than its cast portrait.
      ids.sort((a, b) => Number(VELUNE_REFERENCES.find((r) => r.id === b)?.kind === "scene") - Number(VELUNE_REFERENCES.find((r) => r.id === a)?.kind === "scene"));
      return { id: shot.id, title: shot.title, start: shot.start / 24, end: shot.end / 24, action: seed.beats.find((_, i) => VELUNE_SHOTS[i].id === shot.id)?.action ?? shot.note, camera: shot.id === "S07" ? "Camera pullback from the actual Blender study" : "Follow the supplied Blender composition and registered motion", sound: "Soundtrack not supplied — plan and audition separately", referenceIds: ["velune-motion", ...ids] };
    }),
  };
}
