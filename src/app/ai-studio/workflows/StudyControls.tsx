"use client";

import Image from "next/image";
import { useState } from "react";
import { directions, graphs, media, weaveUrl } from "./study";
import styles from "./workflows.module.css";

type Direction = keyof typeof directions;
type Provider = keyof typeof graphs;

export function CartonCompare() {
  const [direction, setDirection] = useState<Direction>("premium");
  const [mode, setMode] = useState<"finish" | "tools">("finish");
  const [detail, setDetail] = useState(false);
  const study = directions[direction];
  const pair = mode === "finish" ? [study[study.selected], study.finished] : [study.comfy, study.weave];

  return (
    <section className={styles.compare} id="carton-review" aria-label="Carton comparison">
      <div className={styles.controls}>
        <div className={styles.tabs} role="group" aria-label="Creative direction">
          {(Object.keys(directions) as Direction[]).map((key) => (
            <button key={key} type="button" aria-pressed={direction === key} onClick={() => setDirection(key)}>{directions[key].label}</button>
          ))}
        </div>
        <div className={styles.reviewControls}>
          <div className={styles.tabs} role="group" aria-label="Comparison">
            <button type="button" aria-pressed={mode === "finish"} onClick={() => setMode("finish")}>Before / after</button>
            <button type="button" aria-pressed={mode === "tools"} onClick={() => setMode("tools")}>Compare tools</button>
          </div>
          <button className={styles.detailButton} type="button" aria-pressed={detail} onClick={() => setDetail(!detail)}>
            <span aria-hidden>{detail ? "−" : "+"}</span> Packaging detail
          </button>
        </div>
      </div>

      <div className={styles.compareBody}>
        <div className={styles.pair}>
          {pair.map((plate, index) => (
            <figure key={plate.file} className={styles.plate}>
              <figcaption>
                <span>{mode === "finish" ? (index === 0 ? "Before · generated" : "After · restored") : "Original render"}</span>
                <strong>{mode === "finish" && index === 1 ? "Finished study" : plate.label}</strong>
              </figcaption>
              <a className={styles.plateMedia} href={`${media}/${plate.file}.webp`} target="_blank" rel="noreferrer" aria-label={`Open full image: ${plate.alt}`}>
                <Image
                  src={`${media}/${plate.file}${detail ? "-detail" : ""}.webp`}
                  alt={detail ? `Carton front detail: ${plate.alt}` : plate.alt}
                  fill
                  loading="eager"
                  sizes="(max-width: 900px) 45vw, (max-width: 1280px) 34vw, 430px"
                />
                <span className={styles.openImage} aria-hidden>↗</span>
              </a>
              <p className={styles.dimensions}>{plate.size}{detail ? " original" : ""}</p>
            </figure>
          ))}
        </div>
        <aside className={styles.finding} aria-label="Comparison notes">
          <div aria-live="polite">
            <p className={styles.kicker}>Review notes</p>
            <h2>{study.label}</h2>
            <p>{study.brief}</p>
            <p>{mode === "finish" ? study.decision : study.comparison}</p>
          </div>
          <a href="#workflow-graphs" className={styles.textLink}>Inspect the graphs <span aria-hidden>↓</span></a>
        </aside>
      </div>
    </section>
  );
}

export function WorkflowInspector() {
  const [provider, setProvider] = useState<Provider>("comfy");
  const [active, setActive] = useState(0);
  const graph = graphs[provider];
  const node = graph.nodes[active];

  return (
    <section className={styles.graphSection} id="workflow-graphs" aria-labelledby="graph-heading">
      <div className={styles.sectionHead}>
        <h2 id="graph-heading">Inside the workflows</h2>
        <p>Both graphs used the same reference with separate premium and social branches.</p>
      </div>
      <div className={styles.graphTop}>
        <div className={styles.tabs} role="group" aria-label="Workflow tool">
          {(Object.keys(graphs) as Provider[]).map((key) => (
            <button type="button" key={key} aria-pressed={provider === key} onClick={() => { setProvider(key); setActive(0); }}>{graphs[key].label}</button>
          ))}
        </div>
        <p>{graph.run}</p>
      </div>

      <div className={styles.graphBody}>
        <figure className={styles.canvas}>
          <a href={`${media}/${graph.image}`} target="_blank" rel="noreferrer" aria-label={`Open full ${graph.label} graph image`}>
            <Image src={`${media}/${graph.image}`} width={1440} height={graph.height} alt={graph.alt} sizes="(max-width: 900px) 95vw, (max-width: 1280px) 64vw, 845px" />
            <span className={styles.openImage} aria-hidden>↗</span>
          </a>
          <figcaption>Recorded {graph.label} run</figcaption>
        </figure>
        <div className={styles.inspector}>
          <p className={styles.kicker}>Inspect a step</p>
          <ol className={styles.steps} aria-label={`${graph.label} workflow steps`}>
            {graph.nodes.map((step, index) => (
              <li key={step.label}>
                <button type="button" aria-pressed={active === index} onClick={() => setActive(index)} aria-controls="workflow-step">
                  {step.label}<span aria-hidden>{active === index ? "↓" : "↗"}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.nodeDetail} id="workflow-step" aria-live="polite" aria-atomic="true">
            <p>{node.detail}</p>
            <code>{node.type}</code>
          </div>
        </div>
      </div>

      <div className={styles.downloads}>
        {provider === "comfy" ? (
          <>
            <a href={`${media}/VELUNE-Kontext-Workflow.json`} download>Editable workflow JSON ↓</a>
            <a href={`${media}/VELUNE-Kontext-API.json`} download>API graph JSON ↓</a>
            <a href={`${media}/velune-raspberry-reference.png`} download>Matching reference PNG ↓</a>
          </>
        ) : (
          <a href={weaveUrl} target="_blank" rel="noreferrer">Open the native Weave canvas <span aria-hidden>↗</span><small>View only</small></a>
        )}
      </div>
    </section>
  );
}
