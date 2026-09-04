import "server-only";

/**
 * Recraft — a third provider alongside Gemini and fal.
 *
 * Recraft is not on fal, so it does not ride the fal client: it is a REST API
 * of its own at external.api.recraft.ai, Bearer-authenticated, with its own
 * request shape. That is the whole reason this file exists rather than another
 * endpoint slug in the registry.
 *
 * What it is used for here is `imageToImage`, and it is worth being precise
 * about what that endpoint is, because it is NOT the same operation as the
 * other packshot models perform:
 *
 * - Nano Banana, Seedream and GPT Image 2 take a SET of references and
 *   reconstruct the product at a new angle from all of them.
 * - Recraft's imageToImage takes exactly ONE image, plus a prompt and a
 *   `strength` in [0, 1] where 0 is near-identical and 1 is barely related.
 *
 * So it cannot be handed six faces and asked to synthesise a seventh. It is a
 * single-reference restage, and the studio surfaces that as a reference cap of
 * one rather than letting five uploads be silently discarded.
 *
 * Docs: https://www.recraft.ai/docs/api-reference/endpoints
 */

const BASE = process.env.RECRAFT_API_BASE ?? "https://external.api.recraft.ai/v1";

export const hasRecraftKey = () => Boolean(process.env.RECRAFT_API_TOKEN);

function token(): string {
  const t = process.env.RECRAFT_API_TOKEN;
  if (!t) throw new Error("RECRAFT_API_TOKEN is not set");
  return t;
}

/**
 * Turn a Recraft failure into something actionable.
 *
 * Same reasoning as the fal handler: a bare status tells you nothing about
 * which of several very different problems you have, and guessing wrong costs
 * either time or credits.
 */
function describe(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "Recraft rejected the API token. Check RECRAFT_API_TOKEN in .env.local — it is the token from app.recraft.ai/profile/api — then restart the server.";
  }
  if (status === 402 || /credit/i.test(body)) {
    return "Recraft says this account is out of credits. Top up at app.recraft.ai and try again.";
  }
  if (status === 400 || status === 422) {
    return `Recraft rejected the request: ${body.slice(0, 400)}`;
  }
  if (status === 429) {
    return "Recraft is rate-limiting this token. Wait a moment and retry.";
  }
  return `Recraft returned ${status}: ${body.slice(0, 300)}`;
}

/**
 * Image-to-image against a Recraft raster model.
 *
 * `strength` is the parameter that decides whether this is useful at all, and
 * it is a genuine trade rather than a quality dial: low values keep the pack
 * identical and therefore keep the original camera angle, high values will
 * move the camera and take the label with it. There is no setting that
 * rotates a package while holding its artwork exactly — that is what the
 * multi-reference models are for.
 */
export async function recraftImageToImage(opts: {
  model: string;
  prompt: string;
  imageDataUrl: string;
  strength: number;
  /** "WxH" (1024x1024) or "w:h" (1:1). Omitted lets Recraft choose. */
  size?: string;
}): Promise<{ url: string }> {
  const res = await fetch(`${BASE}/images/imageToImage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // The JSON body takes the image by reference; a data URL counts, so the
      // studio's processed reference goes straight across without a separate
      // upload step.
      image_url: opts.imageDataUrl,
      prompt: opts.prompt,
      strength: Math.min(Math.max(opts.strength, 0), 1),
      model: opts.model,
      n: 1,
      ...(opts.size ? { size: opts.size } : {}),
      response_format: "url",
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(describe(res.status, text));

  let data: { data?: { url?: string }[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Recraft returned a non-JSON response: ${text.slice(0, 200)}`);
  }
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("Recraft returned no image URL");
  return { url };
}
