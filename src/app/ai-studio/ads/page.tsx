import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { REFERENCE_CLIPS, clipEnvKey, isHostedClip } from "@/lib/referenceClips";
import { AdLab } from "./AdLab";

export const metadata: Metadata = {
  title: "Ad Lab — AI Content Studio",
  description:
    "Preset mini product ad recipes — structured, deconstructed video prompts any SKU can run through. Pick a concept, swap the product, generate.",
};

/**
 * Where each starter clip actually lives, resolved once on the server.
 *
 * Three sources, in order of precedence:
 *
 *  1. An environment override — `REFERENCE_CLIP_VIBRANT_CHURN=https://…`.
 *     This is the one to use in production: the clips live on fal storage or
 *     any CDN, nothing large enters git, and swapping one is an env change
 *     rather than a commit.
 *  2. An `https://` URL written into the manifest.
 *  3. A file committed under `public/references/`.
 *
 * A clip with none of the three is dropped, so it shows as a labelled gap
 * rather than a broken video element. Resolved here rather than in the
 * browser because only the server can read the environment.
 */
function resolvedClips(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of REFERENCE_CLIPS) {
    const override = process.env[clipEnvKey(c.id)]?.trim();
    const src = override || c.file;
    if (isHostedClip(src)) {
      out[c.id] = src;
      continue;
    }
    try {
      if (fs.existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")))) {
        out[c.id] = src;
      }
    } catch {
      /* treated as missing */
    }
  }
  return out;
}

export default function AdsPage() {
  const clips = resolvedClips();
  return <AdLab availableClipIds={Object.keys(clips)} clipSources={clips} />;
}
