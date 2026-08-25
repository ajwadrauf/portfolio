import type { Metadata } from "next";
import { AdLab } from "./AdLab";

export const metadata: Metadata = {
  title: "Ad Lab — AI Content Studio",
  description:
    "Preset mini product ad recipes — structured, deconstructed video prompts any SKU can run through. Pick a concept, swap the product, generate.",
};

export default function AdsPage() {
  return <AdLab />;
}
