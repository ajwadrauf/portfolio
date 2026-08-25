import type { Metadata } from "next";
import { StudioWizard } from "./StudioWizard";

export const metadata: Metadata = {
  title: "Studio — AI Content Studio",
  description:
    "Upload one product photo and generate a multi-format retail campaign pack across Gemini, Flux, Veo and Kling.",
};

export default function StudioPage() {
  return <StudioWizard />;
}
