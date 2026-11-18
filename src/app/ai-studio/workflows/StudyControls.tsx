"use client";

import Image from "next/image";
import { useState } from "react";
import { directions, graphs, media, weaveUrl } from "./study";
import styles from "./workflows.module.css";

type Direction = keyof typeof directions;

export function CartonCompare() {
  const [direction, setDirection] = useState<Direction>("premium");
  const [mode, setMode] = useState<"finish" | "tools">("finish");
  const [detail, setDetail] = useState(false);
  const study = directions[direction];
  const pair = mode === "finish" ? [study[study.selected], study.finished] : [study.comfy, study.weave];

  return (
    <section className={styles.compare} id="carton-review" aria-labelledby="compare-heading">
      <div className={styles.compareHead}>
        <div>
          <p className={styles.kicker}>Carton review</p>
          <h2 id="compare-heading">Look closer at the pack.</h2>
        </div>
        <a href="#workflow-graphs" className={styles.textLink}>Inspect the graphs <span aria-hidden>↓</span></a>
      </div>
      <div className={styles.controls}>
        <div className={styles.segment} role="group" aria-label="Creative direction">
          {(Object.keys(directions) as Direction[]).map((key) => (
            <button key={key} type="button" aria-pressed={direction === key} onClick={() => setDirection(key)}>{directions[key].label}</button>
          ))}
        </div>
        <div className={styles.reviewControls}>
          <div className={styles.segment} role="group" aria-label="Comparison">
            <button type="button" aria-pressed={mode === "finish"} onClick={() => setMode("finish")}>Before / after</button>
            <button type="button" aria-pressed={mode === "tools"} onClick={() => setMode("tools")}>Compare tools</button>
          </div>
          <button className={styles.detailButton} type="button" aria-pressed={detail} onClick={() => setDetail(!detail)}>Packaging detail</button>
        </div>
      </div>
      <div className={styles.pair}>
        {pair.map((plate, index) => (
          <figure key={plate.file} className={styles.plate}>
            <a className={styles.plateMedia} href={`${media}/${plate.file}.webp`} target="_blank" rel="noreferrer" aria-label={`Open full image: ${plate.alt}`}>
              <Image
                src={`${media}/${plate.file}${detail ? "-detail" : ""}.webp`}
                alt={detail ? `Carton front detail: ${plate.alt}` : plate.alt}
                fill
                sizes="(max-width: 680px) 44vw, (max-width: 1200px) 36vw, 416px"
              />
            </a>
            <figcaption>
              <span>{mode === "finish" ? (index === 0 ? "Before · generated plate" : "After · finished plate") : "Raw model output"}</span>
              <strong>{plate.label}</strong>
              <small>{plate.size} source</small>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className={styles.finding} aria-live="polite">
        <p><strong>{study.label}</strong>{study.brief}</p>
        <p>{mode === "finish" ? study.decision : study.comparison}</p>
      </div>
    </section>
  );
}

export function WorkflowInspector() {
  const [provider, setProvider] = useState<keyof typeof graphs>("comfy");
  const [active, setActive] = useState(0);
  const graph = graphs[provider];
  const node = graph.nodes[active];

  return (
    <section className={styles.graphSection} id="workflow-graphs" aria-labelledby="graph-heading">
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.kicker}>Native workflows</p>
          <h2 id="graph-heading">One reference. Two directions.</h2>
        </div>
        <p>Choose a tool, then inspect the steps from source to review. Each canvas shows the recorded runs.</p>
      </div>
      <div className={styles.graphPanel}>
        <div className={styles.graphTop}>
          <div className={styles.segment} role="group" aria-label="Workflow tool">
            {(Object.keys(graphs) as (keyof typeof graphs)[]).map((key) => (
              <button type="button" key={key} aria-pressed={provider === key} onClick={() => { setProvider(key); setActive(0); }}>{graphs[key].label}</button>
            ))}
          </div>
          <p>{graph.run}</p>
        </div>
        <div className={styles.graphBody}>
          <ol className={styles.steps} aria-label={`${graph.label} workflow steps`}>
            {graph.nodes.map((step, index) => (
              <li key={step.label}>
                <button type="button" aria-pressed={active === index} onClick={() => setActive(index)} aria-controls="workflow-step">
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{step.label}
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.nodeDetail} id="workflow-step" aria-live="polite">
            <p className={styles.kicker}>{node.type}</p>
            <h3>{node.label}</h3>
            <p>{node.detail}</p>
          </div>
        </div>
        <figure className={styles.canvas}>
          <a href={`${media}/${graph.image}`} target="_blank" rel="noreferrer" aria-label={`Open full ${graph.label} graph image`}>
            <Image src={`${media}/${graph.image}`} width={1440} height={graph.height} alt={graph.alt} sizes="(max-width: 1200px) 90vw, 1090px" />
          </a>
          <figcaption>Executed {graph.label} canvas<span>Open at full size ↗</span></figcaption>
        </figure>
        <div className={styles.downloads}>
          {provider === "comfy" ? (
            <>
              <a href={`${media}/VELUNE-Kontext-Workflow.json`} download>Editable workflow JSON ↓</a>
              <a href={`${media}/VELUNE-Kontext-API.json`} download>API graph JSON ↓</a>
              <a href={`${media}/velune-raspberry-reference.png`} download>Matching reference PNG ↓</a>
            </>
          ) : (
            <a href={weaveUrl} target="_blank" rel="noreferrer">Open the native Weave canvas · view only ↗</a>
          )}
        </div>
      </div>
    </section>
  );
}
