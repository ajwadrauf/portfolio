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
  if (opts.referenceImageDataUrl) input.image_url = opts.referenceImageDataUrl;

  const result = await f.subscribe(opts.endpoint, { input, logs: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;
  const url: string | undefined =
    data?.images?.[0]?.url ?? data?.image?.url ?? data?.images?.[0];
  if (!url) throw new Error(`fal returned no image URL (endpoint ${opts.endpoint})`);
  return { url };
}

/** Queue a fal video job (Kling image-to-video). Returns the request id for polling. */
export async function falStartVideo(opts: {
  endpoint: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  referenceImageDataUrl?: string;
  negativePrompt?: string;
}): Promise<{ requestId: string }> {
  const f = client();
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    duration: String(opts.durationSeconds), // Kling expects "5" | "10"
    aspect_ratio: opts.aspectRatio,
  };
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
