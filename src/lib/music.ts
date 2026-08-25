/**
 * Music bed styles for mini ads.
 *
 * Why this exists: video models render sound effects, ambience and dialogue
 * convincingly, but they do not compose music — asking Veo for "an upbeat
 * synth track" yields a texture, not a track. The production answer is the
 * same one a real studio uses: generate the SFX with the video, score it
 * separately, and layer the two. These descriptions are written the way a
 * music brief is written — genre, tempo, instrumentation, arc — because
 * that is what music models actually respond to.
 */

export type MusicStyle = {
  id: string;
  label: string;
  /** Full musical brief sent to the music model. */
  prompt: string;
};

export const MUSIC_STYLES: MusicStyle[] = [
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
