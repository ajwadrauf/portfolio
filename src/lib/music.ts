/**
 * Music bed styles for mini ads.
 *
 * Why this exists: video models render sound effects, ambience and dialogue
 * convincingly, but none of them compose music — asking a video model for "an
 * upbeat synth track" yields a texture, not a track. The production answer is
 * the same one a real studio uses: generate the SFX with the video, score it
 * separately, and layer the two. These descriptions are written the way a
 * music brief is written — genre, tempo, instrumentation, arc — because
 * that is what music models actually respond to.
 *
 * On a model that takes reference audio (Seedance 2.5 Reference), the bed
 * stops being a layer applied afterwards and becomes an input: hand the
 * finished track back as [Audio1] and the picture is cut to its beats. That
 * is the difference between a bed that has to be nudged into place in the
 * edit and one the render was built around.
 */

export type MusicStyle = {
  id: string;
  label: string;
  /** Full musical brief sent to the music model. */
  prompt: string;
};

/** Explicit "no bed" choice — ASMR/texture concepts are stronger without one. */
export const NO_MUSIC_ID = "none";

export const MUSIC_STYLES: MusicStyle[] = [
  {
    id: NO_MUSIC_ID,
    label: "No music (SFX only)",
    prompt: "",
  },
  {
    id: "playful-indie",
    label: "Playful indie-pop",
    prompt:
      "Playful indie-pop advertising bed at 128 BPM. Staccato muted electric guitar plucks, bouncy upright bass, offbeat hand claps, glockenspiel accents. Bright, quirky and warm. Clean confident ending on the downbeat. Instrumental, no vocals.",
  },
  {
    id: "punchy-electronic",
    label: "Punchy electronic",
    prompt:
      "Punchy percussive electronic advertising bed at 140 BPM. Tight kick, crisp rim clicks, staccato synth stabs on every beat, layered hand claps, short filtered riser into the final hit. Energetic and rhythmic. Hard stop at the end. Instrumental, no vocals.",
  },
  {
    id: "premium-cinematic",
    label: "Premium cinematic",
    prompt:
      "Airy cinematic electronic bed at 90 BPM. Warm analog pad swells, softly arpeggiated synth, subtle sub-bass pulse, glassy bell tones. Weightless, premium and modern. Builds gently and resolves on a clean sustained chord. Instrumental, no vocals.",
  },
  {
    id: "warm-acoustic",
    label: "Warm acoustic",
    prompt:
      "Warm acoustic advertising bed at 100 BPM. Fingerpicked nylon guitar, soft brushed snare, gentle upright bass, light tambourine. Honest, homey and inviting — a farmers-market feeling. Simple resolved ending. Instrumental, no vocals.",
  },
  {
    id: "retro-funk",
    label: "Retro funk",
    prompt:
      "Retro funk advertising bed at 112 BPM. Wah-wah clavinet, tight syncopated bassline, dry funk drum kit, brass stabs on the accents. Confident, fun and a little vintage. Ends on a punchy brass hit. Instrumental, no vocals.",
  },
  {
    id: "minimal-ambient",
    label: "Minimal ambient",
    prompt:
      "Minimal ambient texture at 70 BPM. Soft felt piano, warm analog tape hiss, long reverb tails, no drums. Hypnotic, intimate and calm, sitting far back in the mix. Seamless and unresolved so it loops. Instrumental, no vocals.",
  },
];

export const getMusicStyle = (id: string): MusicStyle => {
  const s = MUSIC_STYLES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown music style: ${id}`);
  return s;
};

export const MUSIC_MODEL_ID = "eleven-music";

/**
 * Beds are generated longer than the cut so the edit has trim handles at both
 * ends. Music models only approximate a requested length, and a track that
 * runs out two frames early is unusable — one that runs long is just trimmed.
 */
export const MUSIC_HANDLE_SECONDS = 2;

export const musicLengthFor = (cutSeconds: number) => cutSeconds + MUSIC_HANDLE_SECONDS;

/**
 * What the layered-audio approach does and does not guarantee. Surfaced in the
 * UI on purpose: a demo that states its own limits is more useful than one
 * that implies the mix is finished.
 */
export const SYNC_CAVEATS = [
  "Sound effects sync; music does not. The video model generates SFX from the picture it is making, so hits land on frame. The music model never sees the video — it composes from text alone.",
  "You get two files, not one. Nothing is muxed: the finished ad exists after you combine the MP4 and the track in an editor.",
  "The preview is an approximation. Two media elements synced on play/pause/seek — enough to judge the vibe, not sample-accurate.",
  `The bed is generated ${MUSIC_HANDLE_SECONDS}s longer than the cut, giving you handles to slide a downbeat onto the money moment.`,
  "No mix is applied — no ducking under SFX, no level matching, no mastering.",
  "Expect variance: 2–4 generations to land one you like.",
];

/**
 * The same list, for the case where the bed is fed back into the render as a
 * timing reference. The first caveat above is the one that changes — and it
 * is the whole reason to do it.
 */
export const TIMING_REF_NOTES = [
  "The cuts are built around the track, not nudged onto it afterwards. Seedance reads the supplied audio as a timing signal in the same pass that makes the picture, so accents land where the beats are.",
  "It is a signal, not a stem. The track is not guaranteed to come back inside the rendered MP4 — you still lay the bed under the cut in the edit, but now it already fits.",
  "Generate the music first. The reference has to exist before the render starts, so the order is: pick a style, compose the bed, then generate the video.",
  "Trim to the cut length. A 30-second track handed to an 8-second render gives the model the first 8 seconds of structure, which may not be the part you liked.",
  "Native sound effects still render alongside it, unless you switch native audio off.",
];
