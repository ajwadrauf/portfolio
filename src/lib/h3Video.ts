/** fal H3 Max Reference-to-Video contract, checked 2026-09-11.
 * https://fal.ai/models/minimax/h3-max/reference-to-video/api
 * Pricing: https://fal.ai/models/minimax/h3-max/reference-to-video
 */
export const H3_MODEL_ID = "h3-max-ref";
export const H3_REFERENCE_LIMIT = 12;
export const H3_RESOLUTIONS = ["480p", "768p", "1080p"] as const;
export type H3Resolution = typeof H3_RESOLUTIONS[number];

/** Keep stored binding IDs stable; translate the actual prompt at the model boundary. */
export function videoPromptFor(modelId: string, prompt: string): string {
  if (modelId === H3_MODEL_ID) return prompt.replace(/\[\s*(Image|Video|Audio)\s*(\d+)\s*\]|@\s*(Image|Video|Audio)\s*(\d+)/gi, (_, bracketKind: string, bracketNumber: string, atKind: string, atNumber: string) => { const kind = bracketKind ?? atKind; return `${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()} ${Number(bracketNumber ?? atNumber)}`; });
  if (modelId.startsWith("seedance")) return prompt.replace(/\b(Image|Video|Audio)\s+(\d+)\b/gi, (_, kind: string, n: string) => `[${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()}${Number(n)}]`);
  return prompt;
}

export function h3DurationProblem(kind: "video" | "audio", durations: readonly (number | undefined)[]): string | null {
  if (durations.some((n) => typeof n !== "number" || !Number.isFinite(n))) return `H3 Max ${kind} duration is not verified. Wait for metadata, or replace the unreadable file.`;
  if (durations.some((n) => n! < 2 || n! > 15)) return `Each H3 Max ${kind} reference must be 2–15 seconds. Trim the file before generating.`;
  if (durations.reduce<number>((total, n) => total + n!, 0) > 15) return `H3 Max accepts at most 15 seconds of ${kind} references combined. Trim or remove a file.`;
  return null;
}

export function h3ReferenceProblem(imageCount: number, videos: readonly (number | undefined)[], audios: readonly (number | undefined)[]): string | null {
  if (imageCount + videos.length + audios.length > H3_REFERENCE_LIMIT) return "H3 Max accepts at most 12 references in total, including images, video and audio. No files will be discarded.";
  if (imageCount + videos.length === 0) return "H3 Max Reference needs at least one image or video reference.";
  return h3DurationProblem("video", videos) ?? h3DurationProblem("audio", audios);
}

export function h3Cost(opts: { seconds: number; resolution: string; imagePixels?: number; videoSeconds?: number; audioSeconds?: number }) {
  const resolution = H3_RESOLUTIONS.includes(opts.resolution as H3Resolution) ? opts.resolution as H3Resolution : "768p";
  const output = opts.seconds * ({ "480p": 0.05, "768p": 0.08, "1080p": 0.16 }[resolution]);
  // fal publishes reference-video rates for 480P and 768P. 1080P refines
  // a 768P source: using that input rate is an estimate, explicitly labeled
  // in the UI, not a verified 1080P reference-input quote.
  const videoRate = resolution === "480p" ? 2886 : 111888 / 15;
  const tokens = (opts.imagePixels ?? 0) / 1024 + (opts.videoSeconds ?? 0) * videoRate + (opts.audioSeconds ?? 0) * 80;
  const references = Math.max(0, tokens - 4096) * 0.02 / 1000;
  return { output, references, tokens, total: output + references };
}
