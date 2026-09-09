/** Musical briefs for a separate ElevenLabs track. Native video audio remains
 * a useful first pass; a dedicated score adds independent musical control.
 * Reference audio can guide Seedance, but does not guarantee exact beat sync.
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

export const musicLengthFor = (cutSeconds: number, timingReference = false) =>
  timingReference ? Math.min(cutSeconds, 30) : cutSeconds + MUSIC_HANDLE_SECONDS;

/**
 * What the layered-audio approach does and does not guarantee. Surfaced in the
 * UI on purpose: a demo that states its own limits is more useful than one
 * that implies the mix is finished.
 */
export const SYNC_CAVEATS = [
  "Native audio is generated with the picture; check the result for convincing timing. A separately composed track does not see the video.",
  "The video and music remain separate downloads. Combine them in an editor to deliver one finished MP4.",
  "Preview playback follows play, pause, seek and playback speed. This is a listening preview, not sample-accurate editing or mastering.",
  `For a track added in the edit, ${MUSIC_HANDLE_SECONDS}s of extra duration gives you room to trim. Audio references use the cut length instead.`,
  "Adjust the preview music level to leave room for product sounds. Final level matching and mastering happen in the edit.",
];

export const TIMING_REF_NOTES = [
  "Seedance accepts audio as a guide. Exact beat-aligned cuts or an unchanged music stem are not guaranteed.",
  "With Blender guidance, keep its camera route and edit timing in charge. Use the track for mood and accents without asking it to recut the film.",
  "Generate and audition the music first. A timing reference must exist before the video request starts.",
  "Seedance accepts MP3/WAV audio, 1.8–30.2 seconds per file and 30.2 seconds combined, with at least one image or video.",
  "Keep the original track for the final mix. Listen to the generated MP4 first so you do not layer the same music twice.",
];
