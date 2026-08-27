import type { Metadata } from "next";
import { PromptBuilder } from "./PromptBuilder";

export const metadata: Metadata = {
  title: "Prompt builder — AI Content Studio",
  description:
    "The anatomy of a reference-to-video prompt, as a form you fill: register, subject, reference bindings, arrangement, beats, climax, text, sound.",
};

export default function PromptsPage() {
  return <PromptBuilder />;
}
