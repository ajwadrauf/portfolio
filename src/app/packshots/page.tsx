import type { Metadata } from "next";
import { PackshotStudio } from "./PackshotStudio";

export const metadata: Metadata = {
  title: "Packshot Studio — AI Content Studio",
  description:
    "Generate GS1 planogram product-on-white packshots at every angle from the reference photos you already have.",
};

export default function PackshotsPage() {
  return <PackshotStudio />;
}
