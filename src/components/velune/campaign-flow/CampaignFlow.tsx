"use client";

import Image from "next/image";
import { useState } from "react";
import run from "./run-evidence.json";
import styles from "./campaign-flow.module.css";

const media = "/studio/velune/campaign-flow";

const steps = {
  carton: {
    name: "Original carton",
    nodes: [1, 2],
    input: "The Raspberry Ganache carton and its transparency mask.",
    process: "Read the original artwork and route the same silhouette to both branches.",
    output: "One product source for the rest of the graph.",
    preview: "carton",
  },
  square: {
    name: "Build the square",
    nodes: [3, 4, 5, 6, 7],
    input: "The carton, a white canvas and a separate shadow.",
    process: "Place the carton at native size and composite the shadow beneath it.",
    output: "The inspected front panel matches the source pixel for pixel.",
    preview: "storefront",
  },
  social: {
    name: "Build the social layout",
    nodes: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    input: "The same carton, a generated raspberry still life and a separate contact shadow.",
    process: "Reframe to 4:5, place the carton alongside the bonbon and reserve a headline area.",
    output: "One shared layout for both languages.",
    preview: "social-art",
  },
  storefront: {
    name: "Storefront",
    nodes: [8],
    input: "The finished square composition.",
    process: "Save the product-detail image with embedded workflow data.",
    output: "1200 × 1200 PNG.",
    preview: "storefront",
  },
  english: {
    name: "English social",
    nodes: [23, 24, 25],
    input: "The social layout and editable English copy.",
    process: "Typeset the headline and composite it into the reserved area.",
    output: "1080 × 1350 PNG. Identical after the French edit.",
    preview: "social-en",
  },
  french: {
    name: "French social",
    nodes: [26, 27, 28],
    input: "The same social layout and editable French copy.",
    process: "Typeset and export the French ad independently.",
    output: "1080 × 1350 PNG. This branch reran after the headline edit.",
    preview: "social-fr",
  },
} as const;

type Step = keyof typeof steps;
const cached = new Set(run.cachedNodeIds.map(Number));

const previews = {
  carton: { width: 592, height: 788, alt: "Original VELUNE Raspberry Ganache carton cutout", caption: "Shared product input" },
  storefront: { width: 1200, height: 1200, alt: "VELUNE carton with a soft contact shadow on white", caption: "Storefront · 1:1" },
  "social-art": { width: 1080, height: 1350, alt: "A cut raspberry ganache bonbon and fresh berries on a burgundy set", caption: "Generated still-life input" },
  "social-en": { width: 1080, height: 1350, alt: "VELUNE social ad with English headline Curiosity tastes like this", caption: "Social · English" },
  "social-fr": { width: 1080, height: 1350, alt: "VELUNE social ad with French headline Le chocolat. Puis la framboise.", caption: "Social · French, revised" },
  "social-fr-before": { width: 1080, height: 1350, alt: "VELUNE social ad with French headline Le chocolat. Des framboises.", caption: "Social · French, first pass" },
} as const;

export function CampaignFlow() {
  const [selected, setSelected] = useState<Step>("french");
  const [revised, setRevised] = useState(false);
  const step = steps[selected];
  const previewKey = selected === "french" && !revised ? "social-fr-before" : step.preview;
  const preview = previews[previewKey];
  const reran = run.reranNodes.length;

  function node(key: Step) {
    const item = steps[key];
    const reused = item.nodes.every((id) => cached.has(id));
    return (
      <button type="button" className={styles.node} aria-pressed={selected === key} aria-controls="campaign-step-details" onClick={() => setSelected(key)}>
        {item.name}
        {revised && <span className={styles.nodeState}>{reused ? "Reused" : "Reran"}</span>}
      </button>
    );
  }

  return (
    <>
      <section className="border-y border-border-soft py-5" aria-label="Recorded ComfyUI run">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h3 className={styles.graphTitle}>Inspect the production graph</h3>
          <a href={`${media}/VELUNE-workflow-and-inputs.zip`} download className="text-sm text-accent underline underline-offset-4">Download workflow and inputs</a>
        </div>
        <div className={styles.graph} role="group" aria-label="Workflow stages. The original carton feeds the square and social layouts.">
          <div className={styles.source}>{node("carton")}</div>
          <div className={styles.branches}>
            <div className={styles.branch}>
              {node("square")}
              <span aria-hidden="true">→</span>
              <div>{node("storefront")}</div>
            </div>
            <div className={styles.branch}>
              {node("social")}
              <span aria-hidden="true">→</span>
              <div className={styles.languages}>{node("english")}{node("french")}</div>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.inspection} aria-label="Selected stage details">
        <div id="campaign-step-details">
          <h3>{step.name}</h3>
          <dl className={styles.detail}>
            <div><dt>Input</dt><dd>{step.input}</dd></div>
            <div><dt>What it does</dt><dd>{step.process}</dd></div>
            <div><dt>Output</dt><dd>{step.output}</dd></div>
          </dl>
          <div className={styles.revision}>
            <h4 className="font-semibold">Change one line of copy</h4>
            <p className="mt-1 text-sm text-muted">Replay the recorded edit to the French ad. The storefront and English exports stayed identical, and the carton and shadow stayed in place.</p>
            <button className="btn-secondary mt-3" type="button" onClick={() => { setRevised(!revised); setSelected("french"); }}>
              {revised ? "Show first French export" : "Replay French revision"}
            </button>
            <p role="status" className="mt-3 text-sm text-muted">
              {revised ? `${reran} of ${run.nodeCount} nodes reran. ${run.cachedNodeIds.length} reused their first results.` : "First run · all three exports produced."}
            </p>
            {revised && (
              <ol className={styles.rerunSteps} aria-label="Nodes that reran">
                {run.reranNodes.map(({ id, title }) => <li key={id}>{title}</li>)}
              </ol>
            )}
          </div>
        </div>
        <figure className={styles.preview}>
          <Image src={`${media}/${previewKey}.webp`} width={preview.width} height={preview.height} sizes="(max-width: 768px) 90vw, 430px" alt={preview.alt} />
          <figcaption>{preview.caption}</figcaption>
        </figure>
      </section>
      <p className="border-t border-border-soft pt-4 text-sm text-muted">Recorded in {run.engine} on a local CPU. The social still life was generated separately. The node graph assembles the original packaging, artwork, shadows and type.</p>
    </>
  );
}
