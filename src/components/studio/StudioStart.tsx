"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudioProject } from "./StudioProjectProvider";

const STARTS = [
  { title: "I have packaging artwork", body: "Build the package, map its faces and render the views.", href: "/ai-studio/packshots?mode=artwork", label: "Start with artwork" },
  { title: "I have a product photograph", body: "Create a campaign brief, choose a hero and make adaptations.", href: "/ai-studio/studio", label: "Start a campaign" },
  { title: "I have a motion guide", body: "Connect the camera plan, appearance references and soundtrack.", href: "/ai-studio/ads", label: "Open Ad Lab" },
];
export function StudioStart() {
  const { project, createProject, ready } = useStudioProject();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="mx-auto max-w-6xl px-6 pb-12" aria-labelledby="studio-start">
    <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="studio-start" className="text-2xl tracking-tight">What are you starting with?</h2>{project && <Link href="/ai-studio/projects" className="inline-flex min-h-10 items-center text-sm font-semibold text-accent underline underline-offset-4">Continue {project.name} ↗</Link>}</div>
    <div className="mt-5 grid gap-3 md:grid-cols-3">{STARTS.map((s) => <article key={s.href} className="card flex flex-col p-5"><h3 className="font-semibold">{s.title}</h3><p className="my-3 flex-1 text-sm leading-relaxed text-muted">{s.body}</p><Link href={s.href} className="btn-block">{s.label}<span aria-hidden>↗</span></Link></article>)}</div>
    <div className="mt-5 grid items-center gap-5 rounded-md bg-[#241922] p-6 text-[#faf6ef] md:grid-cols-[1fr_auto]"><div><p className="label-sm !text-[#d9bcca]">Explore a real production</p><h3 className="mt-2 text-xl">VELUNE. One chocolate world, every step of the studio.</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#d7cbd2]">Load the 15-second Blender study, shot plan and concept artwork. Follow it into campaigns, prompts and sound. The finished Seedance film will join this example when supplied.</p></div><button className="rounded border border-[#bc9fb0] px-5 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50" disabled={busy || !ready} onClick={async () => { setBusy(true); setError(""); try { await createProject("VELUNE · guided example", "velune"); router.push("/ai-studio/projects"); } catch (e) { setError(e instanceof Error ? e.message : "The example could not load."); } finally { setBusy(false); } }}>{busy ? "Preparing example…" : "Load & explore VELUNE ↗"}</button></div>
    <p className="mt-2 text-xs text-muted">Editable working copy. No generation starts and no credits are used.</p>{error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </section>;
}
