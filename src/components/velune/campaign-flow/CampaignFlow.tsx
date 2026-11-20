"use client";

import Image from "next/image";
import { useState } from "react";
import { ChocolateArrangement } from "./ChocolateArrangement";
import { campaignMedia as media, campaignSteps as steps, campaignPreviews as previews } from "./campaign-data";
import run from "./run-evidence.json";
import nativeApi from "./campaign-api.json";
import styles from "./campaign-flow.module.css";

type Step = keyof typeof steps;
const frenchPath = ["frenchHeadline", "frenchCompose", "frenchExport"] as const;
const cached = new Set(run.cachedNodeIds.map(Number));
const rerunIds = new Set(run.reranNodes.map(({ id }) => id));

export function CampaignFlow() {
  const [selected, setSelected] = useState<Step>("french");
  const [revised, setRevised] = useState(false);
  const [arranged, setArranged] = useState(false);
  const step = steps[selected];
  const isFrench = step.preview === "social-fr";
  const comparing = revised && isFrench;
  const selectedNodes = Object.fromEntries(step.nodes.map((id) => [
    id, nativeApi[String(id) as keyof typeof nativeApi],
  ]));
  const previewKeys: (keyof typeof previews)[] = comparing
    ? ["social-fr-before", "social-fr"]
    : [isFrench ? "social-fr-before" : step.preview];

  function node(key: Step) {
    const item = steps[key];
    const reused = revised && item.nodes.every((id) => cached.has(id));
    const reran = revised && item.nodes.length === 1 && rerunIds.has(item.nodes[0]);
    return (
      <button
        type="button"
        className={styles.node}
        data-rerun={reran || undefined}
        aria-pressed={selected === key}
        aria-controls="campaign-step-details"
        onClick={() => {
          setSelected(key);
          if (key === "chocolate") setArranged(true);
        }}
      >
        {item.name}
        {reused && <span className={styles.nodeState}>Reused</span>}
        {reran && <span className={styles.nodeState}>Reran</span>}
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
            <div className={`${styles.branch} ${styles.socialBranch}`}>
              <div className={styles.socialInputs}>
                {node("chocolate")}
                {node("social")}
              </div>
              <span aria-hidden="true">→</span>
              <div className={styles.languages}>
                {node("english")}
                <div>
                  {node("french")}
                  <ol className={styles.frenchPath} aria-label="French social nodes">
                    {frenchPath.map((key) => <li key={key}>{node(key)}</li>)}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.inspection} data-comparing={comparing || undefined} aria-label="Selected stage details">
        <div id="campaign-step-details">
          <h3>{step.name}</h3>
          <dl className={styles.detail}>
            <div><dt>Input</dt><dd>{step.input}</dd></div>
            <div><dt>What it does</dt><dd>{step.process}</dd></div>
            <div><dt>Output</dt><dd>{step.output}</dd></div>
          </dl>
          {selected === "chocolate" && (
            <p className="mb-4 text-sm text-muted">
              The live preview stages separate chocolates beside the carton. Choose a view for each piece or rearrange the group. <a className="text-accent underline underline-offset-4" href={`${media}/chocolate-art.webp`} target="_blank" rel="noreferrer">See the cutout used in the recorded run</a>.
            </p>
          )}
          <div className={styles.revision}>
            <h4 className="font-semibold">Change one line of copy</h4>
            <p className="mt-1 text-sm text-muted">Replay the recorded edit to the French ad. The storefront and English exports stayed identical, and the carton and shadow stayed in place.</p>
            <button className="btn-secondary mt-3" type="button" aria-controls="campaign-flow-preview" onClick={() => { setRevised(!revised); setSelected("french"); }}>
              {revised ? "Reset replay" : "Replay French revision"}
            </button>
            <p role="status" className="mt-3 text-sm text-muted">
              {revised ? `${rerunIds.size} of ${run.nodeCount} nodes reran. ${run.cachedNodeIds.length} reused their first results.` : "First run · all three exports produced."}
            </p>
          </div>
        </div>
        <div id="campaign-flow-preview">
          {arranged && <div hidden={selected !== "chocolate"}><ChocolateArrangement /></div>}
          {selected !== "chocolate" && (
            <div className={comparing ? styles.comparison : undefined} role={comparing ? "group" : undefined} aria-label={comparing ? "French ad before and after" : undefined}>
              {previewKeys.map((key) => {
                const preview = previews[key];
                const before = key === "social-fr-before";
                const changedLine = (before ? run.revisedHeadline.before : run.revisedHeadline.after).split("\n").at(-1);
                return (
                  <figure className={styles.preview} key={key}>
                    <Image
                      src={`${media}/${key}.webp`}
                      width={preview.width}
                      height={preview.height}
                      sizes={comparing ? "(max-width: 640px) 45vw, 350px" : "(max-width: 640px) 90vw, 430px"}
                      alt={preview.alt}
                    />
                    <figcaption>
                      {comparing ? <><strong>{before ? "Before" : "After"}</strong><span lang="fr">{changedLine}</span></> : preview.caption}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <details className={styles.backend}>
        <summary>Show ComfyUI backend</summary>
        <p>{run.engine} · {run.runtime} · {run.nodeCount} nodes · {run.edgeCount} connections</p>
        <dl className={styles.receipts}>
          <div><dt>First run</dt><dd>{run.baselineRunId}</dd></div>
          <div><dt>French revision</dt><dd>{run.revisionRunId}</dd></div>
          <div><dt>Execution</dt><dd>{rerunIds.size} nodes reran · {run.cachedNodeIds.length} reused</dd></div>
        </dl>
        <p>The carton and both chocolates come from the same reference artwork. Each is a separate image layer with its own scale and placement.</p>
        <h4>API nodes for {step.name}</h4>
        <pre tabIndex={0} aria-label={`ComfyUI API nodes for ${step.name}`}>{JSON.stringify(selectedNodes, null, 2)}</pre>
        <a className="text-sm text-accent underline underline-offset-4" href={`${media}/VELUNE-campaign-API.json`} download>Download the full API graph</a>
      </details>
    </>
  );
}
