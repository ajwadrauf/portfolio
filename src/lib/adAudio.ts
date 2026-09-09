import type { AudioMode } from "./adPresets";

/** Only audio instructions are added; imported visual direction stays intact. */
export function soundDirection(mode: AudioMode, musicBrief: string, audioSlot?: number, preserveMotion = false) {
  const direction = mode === "silent"
    ? "Deliver silent picture: no music, dialogue, ambience or sound effects."
    : mode === "layered"
      ? "Generate natural sound effects and ambience that fit the visible action. No music, score or singing: an instrumental music bed will be mixed separately. Preserve explicitly requested dialogue or voiceover from the brief; do not invent speech."
      : `Generate sound effects and ambience that fit the visible action. Preserve explicitly requested dialogue or voiceover from the brief; do not invent speech or singing. ${musicBrief ? `Musical direction: ${musicBrief}` : "No music; keep the product sounds clear."}`;
  const timing = audioSlot ? ` Use [Audio${audioSlot}] as a rhythm and mood reference. ${preserveMotion ? "Preserve the Blender camera route, shot order, cut times and final hold; let musical accents support this existing edit." : "Let the action respond to musical accents where compatible with the visual brief."} Do not add a second competing score. Exact beat alignment will be checked in the edit.` : "";
  return `[Ad Lab sound direction]\nThese instructions take precedence over earlier sound or music instructions only. Preserve all visual direction. ${direction}${timing}`;
}

export const ICE_CREAM_MUSIC_BRIEF = "Premium instrumental food-commercial score for vanilla, chocolate and strawberry ice cream. Warm felt piano, airy analog pads, delicate glassy notes and restrained brushed percussion at about 90 BPM. Leave space for close-up spoon scrapes and soft cream movement. Gently lift through the scoop reveal and cream spiral, open into a playful three-flavour moment, then resolve softly into the final product hold. No vocals, lyrics or speech. Support the existing edit without demanding new cuts.";

export function audioReferenceProblem(durations: (number | undefined)[], visualCount: number): string | null {
  if (!durations.length) return null;
  if (visualCount < 1) return "Seedance needs at least one image or video alongside reference audio.";
  if (durations.length > 10) return "Seedance accepts up to 10 audio references.";
  if (durations.some((n) => n === undefined || !Number.isFinite(n))) return "Audio duration could not be verified yet. Wait for metadata, or use a readable MP3/WAV file before generating.";
  if (durations.some((n) => n! < 1.8 || n! > 30.2)) return "Each Seedance audio reference must be 1.8–30.2 seconds. Trim the track before attaching it.";
  if (durations.reduce<number>((sum, n) => sum + n!, 0) > 30.2) return "Seedance accepts at most 30.2 seconds of reference audio in total. Remove or trim a track.";
  return null;
}
