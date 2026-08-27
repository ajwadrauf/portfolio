import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { REFERENCE_CLIPS } from "@/lib/referenceClips";
import { AdLab } from "./AdLab";

export const metadata: Metadata = {
  title: "Ad Lab — AI Content Studio",
  description:
    "Preset mini product ad recipes — structured, deconstructed video prompts any SKU can run through. Pick a concept, swap the product, generate.",
};

/**
 * Which starter clips are actually on disk.
 *
 * Checked here rather than in the browser so a clip that has not been added
 * yet renders as a labelled gap instead of a broken video element.
 */
function availableClipIds(): string[] {
  return REFERENCE_CLIPS.filter((c) => {
    try {
      return fs.existsSync(path.join(process.cwd(), "public", c.file.replace(/^\//, "")));
    } catch {
      return false;
    }
  }).map((c) => c.id);
}

export default function AdsPage() {
  return <AdLab availableClipIds={availableClipIds()} />;
}
