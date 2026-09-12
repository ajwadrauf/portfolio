import type { Metadata } from "next";
import Link from "next/link";
import { CreamMakingOf } from "@/components/studio/CreamMakingOf";

export const metadata: Metadata = { title: "Cream in motion — Ice-cream case study", description: "An 18-second ice-cream portfolio film: Blender motion guide, five image references and the generated result." };

export default function CreamCaseStudyPage() {
  return <>
    <header className="mx-auto max-w-6xl px-6 py-8"><Link href="/ai-studio/ads" className="text-sm text-accent underline">← Back to Ad Lab</Link><h1 className="mt-4 text-3xl tracking-tight">Cream in motion</h1><p className="mt-2 text-sm text-muted">Ice-cream portfolio case study · 18 seconds</p></header>
    <CreamMakingOf />
  </>;
}
