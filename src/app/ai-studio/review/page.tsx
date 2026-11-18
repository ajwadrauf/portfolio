import type { Metadata } from "next";
import Link from "next/link";
import { PLAYBOOK_CHECKLIST } from "@/lib/adPreflight";
import { PreflightChecklist } from "../playbook/PreflightChecklist";

export const metadata: Metadata = {
  title: "Review · The Workroom",
  description: "Review a specific version of a creative asset, record evidence and save a human decision to the project.",
};

export default function ReviewPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10 sm:py-16" aria-labelledby="review-heading">
      <p className="label !text-accent">The Workroom</p>
      <h1 id="review-heading" className="mt-3 text-4xl tracking-tight sm:text-5xl">Review</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">Review a specific asset version, record your evidence and save the decision with your project.</p>
      <div className="mt-5 flex flex-wrap gap-x-5 text-sm font-semibold text-accent underline underline-offset-4">
        <Link className="flex min-h-11 items-center" href="/ai-studio/projects">Open project assets ↗</Link>
        <Link className="flex min-h-11 items-center" href="/ai-studio/playbook#preflight">Read the review guidelines ↗</Link>
      </div>
      <div className="mt-5"><PreflightChecklist groups={PLAYBOOK_CHECKLIST} /></div>
    </section>
  );
}
