import type { Metadata } from "next";
import Link from "next/link";
import { BlenderBriefBuilder } from "../blender/BlenderBriefBuilder";
import { PromptBuilder } from "./PromptBuilder";

export const metadata: Metadata = {
  title: "Prompt builder — AI Content Studio",
  description:
    "The anatomy of a reference-to-video prompt, as a form you fill: register, subject, reference bindings, arrangement, beats, climax, text, sound. Plus the clay-pass composer, for shots blocked out in 3D first.",
};

export default function PromptsPage() {
  return (
    <>
      <PromptBuilder />

      {/*
        The clay-pass composer lives here, next to the general one, because
        both write the same artifact: a prompt for the video model. What the
        Blender page writes is a different artifact entirely — instructions for
        building the blockout — and having the two on one page was the reason
        it was never obvious which was which.
      */}
      <section
        id="clay"
        className="mx-auto max-w-6xl scroll-mt-28 border-t border-border-soft px-6 py-14"
      >
        <span className="label !text-accent">For a shot blocked out in 3D</span>
        <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] tracking-[-0.03em]">
          Write the prompt that goes with the clay
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
          When the clip already exists, the prompt has a different job: say what
          each upload is for, what must <em>not</em> be inherited from it, and —
          for anything the blockout only stood in for — what should happen
          instead. Fill in the shot and it assembles the four-layer prompt,
          including the exclusion block and the physics contract, which are the
          two parts people skip and then pay to rediscover.{" "}
          <Link href="/ai-studio/blender" className="font-semibold text-accent hover:underline">
            The brief that builds the clay is on the Blender page →
          </Link>
        </p>
        <BlenderBriefBuilder mode="seedance" />
      </section>
    </>
  );
}
