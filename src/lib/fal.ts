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
 * Turns a fal error into something a person can act on.
 *
 * The raw errors are bare words — "Forbidden" on its own tells you nothing
 * about which of several very different problems you have, and the cost of
 * guessing wrong is topping up an account that was never short of money.
 */
function describeFalError(e: unknown): string {
  const err = e as { status?: number; message?: string; body?: unknown };
  const status = typeof err?.status === "number" ? err.status : undefined;
  const text = `${err?.message ?? ""} ${JSON.stringify(err?.body ?? "")}`;

  // fal is explicit about an empty balance; it never says just "Forbidden".
  if (status === 402 || /exhausted balance|user is locked|insufficient/i.test(text)) {
    return "fal says this account's balance is exhausted. Top it up at fal.ai/dashboard/billing and try again.";
  }
  if (status === 401) {
    return "fal rejected the API key. Check FAL_KEY in .env.local — it should be the whole key, in the form <id>:<secret> — then restart the server.";
  }
  if (status === 403) {
    return (
      "fal refused the upload (403). Uploads go to a different service than generation — rest.fal.ai rather than fal.run — " +
      "and a key can be allowed to run models while still not being allowed to use storage. This is a key-permission problem, not a billing one: " +
      "an empty balance reports \u201cExhausted balance\u201d instead. Either issue an Admin-scope key at fal.ai/dashboard/keys, " +
      "or skip the upload and paste a public URL for the clip or track instead."
    );
  }
  if (status === 413) {
    return "fal rejected the file as too large. Trim it and try again.";
  }
  return err?.message ?? "Upload failed";
}

/**
 * Uploads a file to fal storage and returns its URL.
 *
 * Video references can't ride along as data URLs — a few seconds of 720p is
 * megabytes of base64, which blows past serverless request limits. Uploading
 * once and passing the URL keeps the generation request small, and the same
 * URL can be reused across takes.
 *
 * Note this talks to rest.fal.ai, not fal.run: storage is a separate service
 * with its own permissions, so a key that generates video fine can still be
 * refused here. Pasting a URL is the way around that.
 */
export async function falUpload(file: Blob): Promise<{ url: string }> {
  const f = client();
  try {
    const url = await f.storage.upload(file);
    return { url };
  } catch (e) {
    throw new Error(describeFalError(e));
  }
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
  /** Video references, already uploaded — passed as URLs, never inlined. */
  referenceVideoUrls?: string[];
  /**
   * Audio references, already uploaded. Seedance 2.5 Reference reads these as
   * timing signals in the same pass that generates the picture, which is how
   * the cuts end up on the beats.
   */
  referenceAudioUrls?: string[];
  /**
   * Whether the model should render its own audio. Only endpoints that expose
   * the switch honour it; the rest are told in the prompt instead.
   */
  generateAudio?: boolean;
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
  const videoRefs = opts.referenceVideoUrls?.filter(Boolean) ?? [];
  if (videoRefs.length > 0) {
    input.video_urls = videoRefs;
    input.reference_video_urls = videoRefs;
  }
  const audioRefs = opts.referenceAudioUrls?.filter(Boolean) ?? [];
  if (audioRefs.length > 0) {
    input.audio_urls = audioRefs;
    input.reference_audio_urls = audioRefs;
  }
  if (opts.generateAudio !== undefined) input.generate_audio = opts.generateAudio;
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
