/**
 * Token-based cost for Seedance 2.5.
 *
 * Seedance does not bill by the second — it bills by token, and the token
 * count is driven by pixel area as much as by duration. A flat per-second
 * rate is therefore not a rounded estimate but a category error: it is off
 * by a factor that changes with the resolution you happen to get. Since the
 * app never sent a resolution, the endpoint's default decided the bill.
 *
 * fal's published formula:
 *   tokens ≈ (width × height × durationSeconds × 24) / 1024
 *
 * The rate per 1000 tokens is $0.0214 at 480p and 720p, ~$0.0234 at 1080p.
 *
 * Supplying video references brings a 0.6 multiplier and bills the input
 * clip's duration too. How those two combine is not something the published
 * formula settles, and the reading that produced the closest match to a real
 * bill is in `seedanceCost` below — along with what it was checked against.
 */

export type VideoResolution = "480p" | "720p" | "1080p";

/**
 * The "p" number is the SHORT edge, whatever the shape: 720p landscape is
 * 1280x720, 720p vertical is 720x1280, 720p square is 720x720. Deriving the
 * long edge from the ratio is what lets an unusual shape be priced correctly
 * rather than approximated as 16:9.
 */
const SHORT_EDGE: Record<VideoResolution, number> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
};

/** Dollars per 1000 tokens. 1080p is billed at a higher rate. */
const RATE_PER_1K: Record<VideoResolution, number> = {
  "480p": 0.0214,
  "720p": 0.0214,
  "1080p": 0.0234,
};

/** Supplying video references discounts the token price. */
const VIDEO_INPUT_MULTIPLIER = 0.6;

const FRAME_RATE = 24;

/**
 * Which resolutions an endpoint actually accepts.
 *
 * The reference-to-video endpoint publishes 480p and 720p only — 1080p is a
 * text-to-video and image-to-video option. Offering it here does not produce a
 * bigger render; it produces a 422 after the user has picked their references
 * and read the estimate, which reads as the tool being broken rather than the
 * option being unavailable. So the list is filtered rather than the error
 * explained.
 */
export const resolutionsFor = (modelId: string): VideoResolution[] =>
  modelId === "seedance-2.5-ref" ? ["480p", "720p"] : ["480p", "720p", "1080p"];

export const VIDEO_RESOLUTIONS: {
  id: VideoResolution;
  label: string;
  note: string;
}[] = [
  {
    id: "480p",
    label: "480p — draft",
    note: "Roughly a fifth the cost of 1080p. Right for judging composition, timing and whether the idea works at all.",
  },
  {
    id: "720p",
    label: "720p — social",
    note: "Fine for feed and stories, where the player is a few hundred pixels wide anyway.",
  },
  {
    id: "1080p",
    label: "1080p — final",
    note: "Billed at a higher rate per token as well as having four times the pixels of 480p. Worth it once the take is right.",
  },
];

/** Pixel dimensions for a tier and aspect ratio. */
/** Width ÷ height for a "w:h" string. Falls back to 16:9 if unparseable. */
export function aspectRatioValue(aspect: string): number {
  const [w, h] = aspect.split(":").map(Number);
  return Number.isFinite(w) && Number.isFinite(h) && h > 0 ? w / h : 16 / 9;
}

export function frameSize(
  resolution: VideoResolution,
  aspect: string,
): { width: number; height: number } {
  const short = SHORT_EDGE[resolution];
  const r = aspectRatioValue(aspect);
  return r >= 1
    ? { width: Math.round(short * r), height: short }
    : { width: short, height: Math.round(short / r) };
}

/**
 * Delivery shapes, in the order a retail brief actually asks for them.
 *
 * `models` names which engines accept each one. Veo takes only the two it
 * was built for; Seedance takes the full set, which is most of the reason to
 * reach for it when a campaign needs a square and a vertical from the same
 * concept.
 */
export const ASPECTS: {
  id: string;
  label: string;
  use: string;
  models: "all" | "seedance";
}[] = [
  { id: "9:16", label: "9:16 vertical", use: "Reels, TikTok, Stories", models: "all" },
  { id: "1:1", label: "1:1 square", use: "Feed, retail media tiles", models: "seedance" },
  { id: "4:3", label: "4:3 classic", use: "In-store screens, older displays", models: "seedance" },
  { id: "3:4", label: "3:4 portrait", use: "Feed portrait, print-adjacent crops", models: "seedance" },
  { id: "16:9", label: "16:9 landscape", use: "YouTube, CTV, site hero", models: "all" },
  { id: "21:9", label: "21:9 cinematic", use: "Banners, wide brand films", models: "seedance" },
];

/** Which shapes this model will actually accept. */
export const aspectsFor = (modelId: string) =>
  ASPECTS.filter(
    (a) => a.models === "all" || modelId.startsWith("seedance-2.5"),
  );

export function videoTokens(opts: {
  resolution: VideoResolution;
  aspect: string;
  durationSeconds: number;
  /** Total duration of any supplied video references, which is also billed. */
  inputVideoSeconds?: number;
}): number {
  const { width, height } = frameSize(opts.resolution, opts.aspect);
  const billedSeconds = opts.durationSeconds + (opts.inputVideoSeconds ?? 0);
  return (width * height * billedSeconds * FRAME_RATE) / 1024;
}

/**
 * Estimated dollars for one Seedance render.
 *
 * Output and input are priced separately, which the earlier version of this
 * did not do: it summed the two durations and applied the 0.6 multiplier to
 * the whole thing. Checked against a real bill, that reads far too low — the
 * discount applies to what the model generates, not to the footage you hand
 * it, which is billed at the standard rate.
 *
 * Calibration, and its limits. One measured render — 12s output, a 12s clay
 * clip in, 4:3 at 480p — was billed $3.05. The old model predicted $1.57 (it
 * also assumed a 5s input clip); summing durations under the multiplier gives
 * $2.22; dropping the multiplier entirely gives $3.70. Pricing them
 * separately gives $2.96, which is 3% under and much the closest of the four.
 *
 * That is a model fitted to a single observation, so treat it as a good
 * estimate rather than a derivation. If real bills start diverging, this
 * function and the note above are the place to correct — and the honest thing
 * is to update both together rather than quietly nudging a constant.
 */
export function seedanceCost(opts: {
  resolution: VideoResolution;
  aspect: string;
  durationSeconds: number;
  inputVideoSeconds?: number;
  hasVideoInputs?: boolean;
}): number {
  const rate = RATE_PER_1K[opts.resolution];
  const perSecond = (sec: number) =>
    (videoTokens({ ...opts, durationSeconds: sec, inputVideoSeconds: 0 }) / 1000) * rate;

  const generated = perSecond(opts.durationSeconds);
  const supplied = perSecond(opts.inputVideoSeconds ?? 0);

  // The multiplier is a discount on generation, and only applies when there
  // is video input at all.
  return opts.hasVideoInputs ? generated * VIDEO_INPUT_MULTIPLIER + supplied : generated;
}

/**
 * Why feeding a finished take back in is not the cheap way to change it.
 *
 * The 0.6 multiplier looks like a discount until you notice the input clip is
 * billed too, and billed at the full rate. Re-running an 8-second take as
 * video-to-video costs 8s of generation at 0.6 plus 8s of input at 1.0 —
 * 1.6x simply generating it again, for a result that is still a fresh render
 * rather than an edit. There is no cheap "change one thing" mode.
 */
export function videoToVideoRatio(inputSeconds: number, outputSeconds: number): number {
  if (outputSeconds <= 0) return 1;
  // Same split as seedanceCost: the discount is on generation, the supplied
  // clip is billed in full. Re-running an 8s take against itself is 1.6x a
  // fresh render, not 1.2x — the point the surrounding copy makes only gets
  // stronger.
  return (outputSeconds * VIDEO_INPUT_MULTIPLIER + inputSeconds) / outputSeconds;
}
