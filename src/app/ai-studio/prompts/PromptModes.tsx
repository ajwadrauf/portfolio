"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BlenderBriefBuilder } from "../blender/BlenderBriefBuilder";
import { PromptBuilder } from "./PromptBuilder";
import { SPECS } from "@/lib/blender";

export function PromptModes() {
  const [mode, setMode] = useState<"general" | "clay">("general");
  useEffect(() => {
    const sync = () => setMode(window.location.hash === "#clay" ? "clay" : "general");
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return <>
    <div className="mx-auto max-w-6xl px-6 pt-8">
      <p className="label !text-accent">Choose your starting point</p>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Prompt workflow">
        <a href="#general" onClick={() => setMode("general")} aria-current={mode === "general" ? "page" : undefined} className={mode === "general" ? "btn-primary" : "btn-secondary"}>General prompt</a>
        <a href="#clay" onClick={() => setMode("clay")} aria-current={mode === "clay" ? "page" : undefined} className={mode === "clay" ? "btn-primary" : "btn-secondary"}>From a Blender clip</a>
      </div>
      <p className="mt-3 text-sm text-muted">Both drafts stay with your current project. Switch whenever you need to.</p>
    </div>
    {mode === "general" ? <div id="general" className="scroll-mt-28"><PromptBuilder /></div> :
      <section id="clay" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-10">
        <h1 className="text-[clamp(1.6rem,3.4vw,2.4rem)] tracking-[-0.03em]">From the clay to the finished film</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">Your saved Blender shot is here: camera, timing and subject mapping. Add appearance references and describe what the model should finish. <Link className="font-semibold text-accent underline" href="/ai-studio/blender#builder">Return to the Blender brief →</Link></p>
        <BlenderBriefBuilder mode="seedance" />
      </section>}
    <details className="mx-auto mb-14 max-w-5xl rounded-[6px] border border-border-soft bg-surface p-5">
      <summary className="cursor-pointer font-semibold">Generation limits and reference notes</summary>
      <p className="mt-3 text-xs text-muted">Documented as of August 2026. Check the selected model in Ad Lab before a paid run.</p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SPECS.map((sp) => <div key={sp.k}><dt className="label-sm">{sp.k}</dt><dd className="mt-1 text-xs leading-relaxed">{sp.v}</dd></div>)}</dl>
    </details>
  </>;
}
