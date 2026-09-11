import type { AdMixTrack } from "./adDraft";
import type { EffectCue } from "./soundPlan";

/** Reuse one generated effect at each intended cut; no extra generation. */
export function effectMixTracks(prompt: string, url: string, index: number, cues: EffectCue[], fallbackLength: number): AdMixTrack[] {
  const cue = cues.find((item) => item.prompt === prompt);
  const base = { url, kind: "effect" as const, trim: 0, gain: 0.8, fadeIn: 0.05, fadeOut: 0.1, enabled: true };
  return cue ? cue.placements.map((p, i) => ({ ...base, fadeIn: 0.005, fadeOut: 0.03, id: `effect-${cue.id}-${i}`, name: `${cue.name} · ${p.start.toFixed(3)}s`, start: p.start, length: p.end - p.start }))
    : [{ ...base, id: `effect-${index}`, name: prompt.slice(0, 300), start: 0, length: fallbackLength }];
}
