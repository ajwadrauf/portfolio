import "server-only";
import { fal } from "@fal-ai/client";

let configured = false;

function client() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  if (!configured) {
    fal.config({ credentials: key });
    configured = true;
  }
  return fal;
}

/**
 * Synchronous-ish image generation on fal (Flux). fal's `subscribe` holds the
 * connection while the model runs — image models return in seconds, well
 * within the route's maxDuration.
 */
export async function falGenerateImage(opts: {
  endpoint: string;
  prompt: string;
  aspectRatio: string;
  /** data URL of the product photo; fal auto-uploads data URIs. */
  referenceImageDataUrl?: string;
  /** multiple reference data URLs, for multi-image edit endpoints (Kontext multi, Seedream edit). */
  referenceImageDataUrls?: string[];
}): Promise<{ url: string }> {
  const f = client();
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio,
    num_images: 1,
    // Belt-and-braces: some endpoints use image_size instead of aspect_ratio;
    // unknown fields are ignored by fal input validation on most endpoints.
    output_format: "jpeg",
  };
  const refs = opts.referenceImageDataUrls?.length
    ? opts.referenceImageDataUrls
    : opts.referenceImageDataUrl
      ? [opts.referenceImageDataUrl]
      : [];
  if (refs.length > 0) {
    // Single-image endpoints read image_url; multi-image edit endpoints read
    // image_urls. Send both — fal ignores fields an endpoint doesn't define.
    input.image_url = refs[0];
    if (refs.length > 1 || opts.referenceImageDataUrls) input.image_urls = refs;
  }

  const result = await f.subscribe(opts.endpoint, { input, logs: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;
  const url: string | undefined =
    data?.images?.[0]?.url ?? data?.image?.url ?? data?.images?.[0];
  if (!url) throw new Error(`fal returned no image URL (endpoint ${opts.endpoint})`);
  return { url };
}

/**
 * Music generation (ElevenLabs Music). Tracks this short return in seconds,
 * so a blocking subscribe is fine — no queue/poll needed.
 */
export async function falGenerateMusic(opts: {
  endpoint: string;
  prompt: string;
  durationSeconds: number;
}): Promise<{ url: string }> {
  const f = client();
  const result = await f.subscribe(opts.endpoint, {
    input: {
      prompt: opts.prompt,
      // API accepts 3_000 – 600_000 ms.
      music_length_ms: Math.min(Math.max(Math.round(opts.durationSeconds * 1000), 3000), 600000),
    },
    logs: false,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;
  const url: string | undefined = data?.audio?.url ?? data?.audio_url ?? data?.audio_file?.url;
  if (!url) throw new Error(`Music model returned no audio URL (endpoint ${opts.endpoint})`);
  return { url };
}

/** Queue a fal video job. Returns the request id for polling. */
export async function falStartVideo(opts: {
  endpoint: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  referenceImageDataUrl?: string;
  /**
   * Multiple positional references for reference-to-video endpoints
   * (Seedance 2.5). The prompt addresses them as [Image1], [Image2]… in
   * order, which is what holds product identity while the camera moves.
   */
  referenceImageDataUrls?: string[];
  negativePrompt?: string;
}): Promise<{ requestId: string }> {
  const f = client();
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    duration: String(opts.durationSeconds), // Kling expects "5" | "10"
    aspect_ratio: opts.aspectRatio,
  };
  const refs = opts.referenceImageDataUrls?.filter(Boolean) ?? [];
  if (refs.length > 0) {
    // Reference endpoints read image_urls; single-image endpoints read
    // image_url. Send what applies — fal ignores undefined fields.
    input.image_urls = refs;
    input.reference_image_urls = refs;
  }
  if (opts.referenceImageDataUrl) input.image_url = opts.referenceImageDataUrl;
  if (opts.negativePrompt) input.negative_prompt = opts.negativePrompt;

  const { request_id } = await f.queue.submit(opts.endpoint, { input });
  return { requestId: request_id };
}

export type FalPollResult =
  | { status: "pending" }
  | { status: "failed"; error: string }
  | { status: "done"; videoUrl: string };

export async function falPollVideo(opts: {
  endpoint: string;
  requestId: string;
}): Promise<FalPollResult> {
  const f = client();
  try {
    const status = await f.queue.status(opts.endpoint, {
      requestId: opts.requestId,
      logs: false,
    });
    if (status.status !== "COMPLETED") return { status: "pending" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }

  const result = await f.queue.result(opts.endpoint, { requestId: opts.requestId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;
  const url: string | undefined = data?.video?.url ?? data?.videos?.[0]?.url;
  if (!url) return { status: "failed", error: "fal job completed without a video URL" };
  return { status: "done", videoUrl: url };
}
