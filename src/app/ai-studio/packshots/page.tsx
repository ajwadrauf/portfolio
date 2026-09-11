import type { Metadata } from "next";
import { PackshotStudio } from "./PackshotStudio";

export const metadata: Metadata = {
  title: "Packshot Studio — AI Content Studio",
  description:
    "Create packshots from reference photos, or choose a package preset, map your artwork onto a box or bag, and export seven views locally.",
};

export default function PackshotsPage() {
  return <PackshotStudio />;
}
