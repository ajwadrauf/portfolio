import type { Metadata } from "next";
import library from "@/data/prompt-library.json";
import type { PromptLibrary as Library } from "@/lib/promptLibrary";
import { PromptLibrary } from "./PromptLibrary";

export const metadata: Metadata = {
  title: "Prompt datasets — AI Content Studio",
  description:
    "A filtered study set of product-focused prompts from the public Seedance 2 corpus, with the filter shown.",
};

export default function PromptsPage() {
  return <PromptLibrary library={library as Library} />;
}
