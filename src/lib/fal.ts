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
/**
 * fal's own size enum, for endpoints that take `image_size` rather than an
 * aspect string. Only the shapes this app actually asks for are mapped; an
 * unmapped one falls back to square, which is what every packshot is.
 */
const IMAGE_SIZE_ENUM: Record<string, string> = {
  "1:1": "square_hd",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
};

export async function falGenerateImage(opts: {
  endpoint: string;
  prompt: string;
  aspectRatio: string;
  /**
   * Which field this endpoint uses to size its output. Defaults to
   * `aspect_ratio`, which is what Flux, Kontext and Seedream take. GPT Image 2
   * takes `image_size` instead — and fal rejects an undefined field with a 422
   * rather than ignoring it, so this is named per endpoint rather than sprayed.
   */
  sizeField?: "aspect_ratio" | "image_size";
  /**
   * What to render, for endpoints that take a size at all.
   *
   * A tier id (Seedream's `auto_2K`) goes on the wire verbatim; explicit
   * pixels go as `{width, height}`, which fal accepts wherever it accepts the
   * enum. Endpoints that only take an aspect ratio ignore this — the picker
   * says so rather than offering a control that does nothing.
   */
  sizePreset?: string;
  sizePixels?: { width: number; height: number };
  /** data URL of the product photo; fal auto-uploads data URIs. */
  referenceImageDataUrl?: string;
  /** multiple reference data URLs, for multi-image edit endpoints (Kontext multi, Seedream edit). */
  referenceImageDataUrls?: string[];
}): Promise<{ url: string }> {
  const f = client();
  const usesImageSize = opts.sizeField === "image_size";
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    num_images: 1,
  };
  if (usesImageSize) {
    input.image_size = opts.sizePixels
      ? { width: opts.sizePixels.width, height: opts.sizePixels.height }
      : (opts.sizePreset ?? IMAGE_SIZE_ENUM[opts.aspectRatio] ?? "square_hd");
  } else {
    input.aspect_ratio = opts.aspectRatio;
    // Not part of every schema — only sent on the endpoints known to take it,
    // which are the ones that have been taking it all along.
    input.output_format = "jpeg";
  }
  const refs = opts.referenceImageDataUrls?.length
    ? opts.referenceImageDataUrls
    : opts.referenceImageDataUrl
      ? [opts.referenceImageDataUrl]
      : [];
  if (refs.length > 0) {
    /*
     * Single-image endpoints read image_url; multi-image edit endpoints read
     * image_urls.
     *
     * The legacy path sends both, on the theory that fal ignores a field an
     * endpoint does not define. That is not true in general — fal validates
     * strictly and answers 422 — it is merely true of the three endpoints that
     * have been running this way. So it stays as it is for them, and anything
     * new gets only the field its schema publishes: GPT Image 2's edit
     * endpoint takes image_urls, and image_url alongside it is a rejection.
     */
    if (usesImageSize) {
      input.image_urls = refs;
    } else {
      input.image_url = refs[0];
      if (refs.length > 1 || opts.referenceImageDataUrls) input.image_urls = refs;
    }
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
export function describeFalError(e: unknown): string {
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
  /*
   * 422 is a schema rejection, and fal says exactly what it rejected — in the
   * response body, not the message. Left unread, every one of these surfaces
   * as the bare string "Unprocessable Entity", which says only that something
   * about the request was wrong and gives no way to find out what. The body
   * carries a `detail` array of {loc, msg}, where `loc` is the path to the
   * offending field. Reading it turns an unsolvable error into a named one.
   */
  if (status === 422) {
    /*
     * fal publishes a typed error taxonomy, and `type` is the machine-readable
     * field — `msg` is explicitly documented as something client code should
     * not parse. Reading `type` matters here because the types are disjoint:
     * a file that could not be downloaded is `file_download_error`, wrong
     * dimensions are `image_too_small`/`image_too_large`, too many references
     * are `sequence_too_long`, a bad format is `unsupported_image_format`.
     *
     * That has a consequence worth stating plainly, because this code used to
     * assume the opposite: `content_policy_violation` is NOT a catch-all that
     * a fetch failure hides inside. When it comes back, the files were
     * downloaded, decoded and looked at, and a safety or IP filter refused
     * them. Telling someone to re-check their URLs at that point sends them
     * to fix something that already worked.
     *
     * https://docs.fal.ai/errors
     */
    const detail = (err?.body as { detail?: unknown })?.detail;
    const items = Array.isArray(detail)
      ? (detail as {
          loc?: unknown[];
          msg?: string;
          type?: string;
          ctx?: Record<string, unknown>;
        }[])
      : [];

    const policy = items.find((d) => d.type === "content_policy_violation");
    if (policy) {
      const field = Array.isArray(policy.loc)
        ? policy.loc.filter((x) => x !== "body").join(".")
        : "";
      return (
        `The generation provider's content filter refused ${field === "prompt" ? "the prompt" : `the files in ${field || "the request"}`}. ` +
        "This is a filter decision, not a technical one: fal reports an unreachable file as file_download_error, a mis-sized one as image_too_small or image_too_large, and a bad format as unsupported_image_format \u2014 so the files were fetched, decoded and looked at. " +
        "The wording about likenesses is generic; fal's own list for this error also covers imagery judged to infringe third-party intellectual property, which is what branded commercial packaging and product photography tend to trip. " +
        "Retrying, re-hosting or re-exporting the same picture will not change the answer. Substitute the reference, or verify the boundary with a plain unbranded image."
      );
    }

    // Every other typed 422 names both the field and the limit it broke.
    const lines = items
      .map((d) => {
        const where = Array.isArray(d.loc)
          ? d.loc.filter((x) => x !== "body").join(".")
          : "";
        const ctx = d.ctx
          ? Object.entries(d.ctx)
              .filter(([k]) => k !== "extra_info")
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(", ")
          : "";
        return [where, d.msg ?? d.type, ctx && `(${ctx})`].filter(Boolean).join(": ");
      })
      .filter(Boolean);

    return lines.length
      ? `The generation provider rejected the request (422): ${lines.join("; ")}.`
      : `The generation provider rejected the request (422) without saying which field. Raw body: ${JSON.stringify(err?.body ?? null).slice(0, 500)}`;
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

/**
 * Sound-effect generation (ElevenLabs text-to-sound-effects).
 *
 * Effects are seconds long and return fast, so a blocking subscribe is fine.
 * `duration_seconds` is optional at the API — omitting it lets the model
 * pick a length from the description, which is usually right for a transient
 * and usually wrong for anything that needs to fill a known gap.
 */
export async function falGenerateSoundEffect(opts: {
  endpoint: string;
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  loop?: boolean;
}): Promise<{ url: string }> {
  const f = client();
  const input: Record<string, unknown> = { text: opts.text };
  if (opts.durationSeconds !== undefined) input.duration_seconds = opts.durationSeconds;
  if (opts.promptInfluence !== undefined) input.prompt_influence = opts.promptInfluence;
  if (opts.loop) input.loop = true;

  try {
    const result = await f.subscribe(opts.endpoint, { input, logs: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any;
    const url: string | undefined =
      data?.audio?.url ?? data?.audio_url ?? data?.audio_file?.url;
    if (!url) throw new Error(`Sound-effect model returned no audio URL (endpoint ${opts.endpoint})`);
    return { url };
  } catch (e) {
    throw new Error(describeFalError(e));
  }
}

/** Queue a fal video job. Returns the request id for polling. */
export async function falStartVideo(opts: {
  endpoint: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  referenceImageDataUrl?: string;
  /**
   * The frame to land on, for endpoints that interpolate between two stills.
   *
   * This is the capability that makes the non-reference endpoint worth
   * choosing rather than merely cheaper: given a first and a last frame it
   * solves the move between them, so both ends of the shot are decided before
   * a credit is spent instead of one end being decided and the other hoped
   * for.
   */
  endImageDataUrl?: string;
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
  /** "480p" | "720p" | "1080p". Left unset, the endpoint picks — and on a
   *  token-billed model that choice is most of the bill. */
  resolution?: string;
  negativePrompt?: string;
}): Promise<{ requestId: string }> {
  const f = client();
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    duration: String(opts.durationSeconds), // Kling expects "5" | "10"
    aspect_ratio: opts.aspectRatio,
  };
  /*
   * Only documented field names go on the wire.
   *
   * This used to send each reference list twice — `image_urls` AND
   * `reference_image_urls`, and the same for video and audio — on the theory
   * that an endpoint would read whichever name it knew and ignore the other.
   * It does not. fal validates its input schema strictly and rejects unknown
   * fields with a 422, so the alias intended as a safety net was itself a
   * guaranteed rejection on every endpoint that defines the documented name.
   * The Seedance reference endpoint reads `image_urls`, `video_urls` and
   * `audio_urls`; nothing here should send a name that is not in a published
   * schema.
   */
  const refs = opts.referenceImageDataUrls?.filter(Boolean) ?? [];
  if (refs.length > 0) input.image_urls = refs;
  const videoRefs = opts.referenceVideoUrls?.filter(Boolean) ?? [];
  if (videoRefs.length > 0) input.video_urls = videoRefs;
  const audioRefs = opts.referenceAudioUrls?.filter(Boolean) ?? [];
  if (audioRefs.length > 0) input.audio_urls = audioRefs;

  if (opts.generateAudio !== undefined) input.generate_audio = opts.generateAudio;
  if (opts.resolution) input.resolution = opts.resolution;
  // Single-image endpoints take one grounding frame under `image_url`. Only
  // ever set for those: the reference endpoint does not define it.
  if (opts.referenceImageDataUrl) input.image_url = opts.referenceImageDataUrl;
  if (opts.endImageDataUrl) input.end_image_url = opts.endImageDataUrl;
  if (opts.negativePrompt) input.negative_prompt = opts.negativePrompt;

  try {
    const { request_id } = await f.queue.submit(opts.endpoint, { input });
    return { requestId: request_id };
  } catch (e) {
    // Without this the caller reports fal's bare status text — "Unprocessable
    // Entity" — and throws away the body that names the field at fault.
    throw new Error(describeFalError(e));
  }
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

/**
 * Recent video requests on this account, newest first.
 *
 * The queue API can only answer "is request X done?" — you have to already
 * know X. When the id was lost (a timeout, a closed tab, a render started
 * before the app remembered handles), the platform API is the only way back
 * to it: it lists what this key actually submitted, so a finished render can
 * be found without knowing anything about it beforehand.
 *
 * Deliberately tolerant about the response shape. This is a recovery path —
 * returning three of five fields is far better than throwing because fal
 * renamed a key.
 */
export type FalRecentRequest = {
  requestId: string;
  endpoint: string;
  status: string;
  /** ISO timestamp, when fal reports one. */
  endedAt?: string;
  /** Present when the request finished and produced a video. */
  videoUrl?: string;
};

export async function falRecentVideoRequests(
  endpoints: string[],
): Promise<FalRecentRequest[]> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");

  const url = new URL("https://api.fal.ai/v1/models/requests/by-endpoint");
  for (const e of endpoints) url.searchParams.append("endpoint_id", e);
  url.searchParams.set("expand", "payloads");
  url.searchParams.set("limit", "20");

  const res = await fetch(url, {
    headers: { Authorization: `Key ${key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `fal request history returned ${res.status}. ${
        res.status === 401 || res.status === 403
          ? "This key may not carry platform-API permission — the dashboard's Requests tab shows the same list."
          : await res.text().catch(() => "")
      }`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  const rows: unknown[] = json?.data ?? json?.requests ?? json?.items ?? [];
  return rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => {
      const out = r?.json_output ?? r?.output ?? r?.payload?.output;
      return {
        requestId: r?.request_id ?? r?.requestId ?? "",
        endpoint: r?.endpoint_id ?? r?.endpoint ?? "",
        status: String(r?.status ?? r?.status_code ?? "unknown"),
        endedAt: r?.ended_at ?? r?.endedAt ?? r?.sent_at,
        videoUrl: out?.video?.url ?? out?.videos?.[0]?.url,
      };
    })
    .filter((r) => r.requestId);
}
