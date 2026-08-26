/**
 * Spot effects — the layer between "the video model made a noise" and
 * "the ad has the right noise".
 *
 * Video models with native audio render effects from the picture they are
 * making, which is why those effects land on the correct frame. What they
 * do not do is render a SPECIFIC effect on demand: ask for the pshhht of a
 * can seal and you get a plausible hiss, take after take, never the one the
 * brand is actually selling. A dedicated sound-effect model is the opposite
 * trade — it renders exactly the effect you describe, and knows nothing
 * about where in the cut it belongs.
 *
 * So they are complements, not competitors. The video model gives you the
 * bed of ambience and incidental foley in sync; this gives you the two or
 * three hero hits you place by hand.
 */

export const SFX_MODEL_ID = "eleven-sfx";

/** The model's own limits (ElevenLabs text-to-sound-effects v2). */
export const SFX_LIMITS = {
  minSeconds: 0.5,
  maxSeconds: 30,
  /** Long enough for a transient plus its tail; short enough to place. */
  defaultSeconds: 3,
  /** How literally to follow the text, 0-1. The API's own default. */
  defaultInfluence: 0.3,
} as const;

export const clampSfxSeconds = (n: number) =>
  Math.min(Math.max(Number.isFinite(n) ? n : SFX_LIMITS.defaultSeconds, SFX_LIMITS.minSeconds), SFX_LIMITS.maxSeconds);

/**
 * How the three audio layers actually stack, stated plainly because the
 * answer is not obvious and getting it wrong wastes a render.
 */
export const LAYER_NOTES = [
  "Native audio is baked into the MP4. It cannot be separated out later — if the model rendered a pour, that pour is in the file. Switch native audio off (Silent) when you want the effects track entirely under your control.",
  "Spot effects arrive as separate files, one per effect. Nothing is placed for you: you drop each one on its frame in the edit, which is exactly the point — placement is a decision, not a guess.",
  "Music is a third file, laid under both. On a model that reads audio in, it can also steer the cut — see the timing reference above.",
  "Layered on top of native audio, a spot effect is a sweetener: it thickens the hit the model already made. Over a silent take it is the whole effects track.",
];

/** Prompting guidance for this model, which rewards physical description. */
export const SFX_PROMPT_TIPS = [
  "Describe the physical event, not the feeling: “the metallic snap of a ring-pull, then carbonation hissing out” beats “refreshing can sound”.",
  "Name the material — glass, foil, kraft paper, brushed steel. Material is most of what a listener identifies.",
  "Say how close the mic is. “Close-mic’d, intimate, dry” gives you an ASMR hit; add “in a large room” and you get reverb baked in you cannot remove.",
  "One event per generation. Two effects in one prompt gives you a muddle of both; generate them separately and place them separately.",
];
