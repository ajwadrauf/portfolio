import type { Metadata } from "next";
import { PackshotStudio } from "./PackshotStudio";

export const metadata: Metadata = {
  title: "Packshot Studio — AI Content Studio",
  description:
    "Create product-on-white packshots from reference photos, or map packaging artwork onto a measured box and export seven views locally.",
};

export default function PackshotsPage() {
  return <PackshotStudio />;
}
