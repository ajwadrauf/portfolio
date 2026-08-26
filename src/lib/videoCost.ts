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
 * with the input clip's duration added to durationSeconds when video
 * references are supplied, and the whole price then multiplied by 0.6.
 *
 * The rate per 1000 tokens is $0.0214 at 480p and 720p, ~$0.0234 at 1080p.
 */

export type VideoResolution = "480p" | "720p" | "1080p";

/** Long edge per tier; the short edge follows the aspect ratio. */
const LONG_EDGE: Record<VideoResolution, number> = {
  "480p": 854,
  "720p": 1280,
  "1080p": 1920,
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
export function frameSize(
  resolution: VideoResolution,
  aspect: string,
): { width: number; height: number } {
  const long = LONG_EDGE[resolution];
  const short = Math.round((long * 9) / 16);
  return aspect === "9:16"
    ? { width: short, height: long }
    : { width: long, height: short };
}

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

/** Estimated dollars for one Seedance render. */
export function seedanceCost(opts: {
  resolution: VideoResolution;
  aspect: string;
  durationSeconds: number;
  inputVideoSeconds?: number;
  hasVideoInputs?: boolean;
}): number {
  const tokens = videoTokens(opts);
  const gross = (tokens / 1000) * RATE_PER_1K[opts.resolution];
  return opts.hasVideoInputs ? gross * VIDEO_INPUT_MULTIPLIER : gross;
}

/**
 * Why feeding a finished take back in is not the cheap way to change it.
 *
 * The 0.6 multiplier looks like a discount until you notice the input clip's
 * duration is added to the billed duration. Re-running an 8-second take as
 * video-to-video bills 16 seconds at 0.6 — which is 1.2x the cost of simply
 * generating it again, for a result that is still a fresh render rather than
 * an edit. There is no cheap "change one thing" mode.
 */
export function videoToVideoRatio(inputSeconds: number, outputSeconds: number): number {
  if (outputSeconds <= 0) return 1;
  return ((inputSeconds + outputSeconds) * VIDEO_INPUT_MULTIPLIER) / outputSeconds;
}
