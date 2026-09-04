import "server-only";
import { GenerateVideosOperation, GoogleGenAI } from "@google/genai";
import { GEMINI_REASONING_MODEL } from "./models";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export type InlineImage = { mimeType: string; data: string }; // base64, no data: prefix

export function dataUrlToInline(dataUrl: string): InlineImage {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 data URL");
  return { mimeType: match[1], data: match[2] };
}

/**
 * Structured JSON call against the multimodal reasoning model.
 * Passes a responseSchema so the model returns parseable JSON.
 */
export async function reasonJson<T>(opts: {
  prompt: string;
  image?: InlineImage;
  responseSchema: object;
  validate: (raw: unknown) => T;
}): Promise<T> {
  const parts: object[] = [];
  if (opts.image) parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } });
  parts.push({ text: opts.prompt });

  const res = await gemini().models.generateContent({
    model: GEMINI_REASONING_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
      temperature: 0.4,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Empty response from reasoning model");
  return opts.validate(JSON.parse(text));
}

/**
 * Image generation / editing via a Nano Banana model. When a reference image
 * is provided the call becomes an edit/grounded generation, which is how we
 * keep the actual product (not a look-alike) in every deliverable.
 */
export async function generateImage(opts: {
  model: string;
  prompt: string;
  aspectRatio: string;
  /**
   * "1K" | "2K" | "4K", on the models that expose it.
   *
   * Only Gemini 3 Pro Image renders at a chosen tier; Flash Image returns
   * about a megapixel whatever it is told, so this is left unset for it rather
   * than sent and quietly ignored.
   */
  imageSize?: string;
  referenceImages?: InlineImage[];
}): Promise<{ dataUrl: string }> {
  const parts: object[] = [];
  for (const ref of opts.referenceImages ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }
  parts.push({ text: opts.prompt });

  const res = await gemini().models.generateContent({
    model: opts.model,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio: opts.aspectRatio,
        ...(opts.imageSize ? { imageSize: opts.imageSize } : {}),
      },
    },
  });

  for (const cand of res.candidates ?? []) {
    for (const part of cand.content?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data) {
        return { dataUrl: `data:${inline.mimeType ?? "image/png"};base64,${inline.data}` };
      }
    }
  }
  throw new Error("Gemini returned no image data");
}

/** Kick off a Veo generation. Returns the long-running operation name. */
export async function startVeo(opts: {
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: number;
  firstFrame?: InlineImage;
}): Promise<{ operationName: string }> {
  const op = await gemini().models.generateVideos({
    model: opts.model,
    prompt: opts.prompt,
    ...(opts.firstFrame
      ? { image: { imageBytes: opts.firstFrame.data, mimeType: opts.firstFrame.mimeType } }
      : {}),
    config: {
      aspectRatio: opts.aspectRatio,
      durationSeconds: opts.durationSeconds,
      numberOfVideos: 1,
      ...(opts.negativePrompt ? { negativePrompt: opts.negativePrompt } : {}),
    },
  });
  if (!op.name) throw new Error("Veo did not return an operation name");
  return { operationName: op.name };
}

export type VeoPollResult =
  | { status: "pending" }
  | { status: "failed"; error: string }
  | { status: "done"; fileUri: string };

/** Poll a Veo operation by name (stateless across requests). */
export async function pollVeo(operationName: string): Promise<VeoPollResult> {
  const ai = gemini();
  // The SDK calls methods off the operation's prototype, so this must be a
  // real GenerateVideosOperation instance — a plain { name } object fails
  // with "operation._fromAPIResponse is not a function". Only the name is
  // needed to fetch current state, which keeps the status route stateless.
  const handle = new GenerateVideosOperation();
  handle.name = operationName;
  const op = await ai.operations.getVideosOperation({ operation: handle });

  if (!op.done) return { status: "pending" };
  if (op.error) {
    return { status: "failed", error: String(op.error.message ?? JSON.stringify(op.error)) };
  }
  const video = op.response?.generatedVideos?.[0]?.video;
  const uri = video?.uri;
  if (!uri) return { status: "failed", error: "Operation finished without a video URI" };
  return { status: "done", fileUri: uri };
}

/** Server-side fetch of a generated video file (keeps the API key off the client). */
export async function fetchVeoFile(fileUri: string): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return fetch(fileUri, { headers: { "x-goog-api-key": apiKey } });
}
