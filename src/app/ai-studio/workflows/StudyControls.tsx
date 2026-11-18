"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { graphEvidence, type GraphNode } from "./graphEvidence";
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
  const [active, setActive] = useState(graphEvidence.comfy.nodes[0].id);
  const [zoomed, setZoomed] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const graph = graphs[provider];
  const { nodes, edges } = graphEvidence[provider];
  const node = nodes.find((item) => item.id === active) ?? nodes[0];

  function moveNodeFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + nodes.length) % nodes.length;
    setActive(nodes[next].id);
    event.currentTarget.parentElement?.querySelectorAll("button")[next]?.focus();
  }

  return (
    <section className={styles.graphSection} id="workflow-graphs" aria-labelledby="graph-heading">
      <div className={styles.sectionHead}>
        <h2 id="graph-heading">Inside the workflows</h2>
        <p>Click a node on either recorded canvas to see its input, what it did, and what it passed on.</p>
      </div>
      <div className={styles.graphTop}>
        <div className={styles.tabs} role="group" aria-label="Workflow tool">
          {(Object.keys(graphs) as Provider[]).map((key) => (
            <button type="button" key={key} aria-pressed={provider === key} onClick={() => {
              setProvider(key);
              setActive(graphEvidence[key].nodes[0].id);
              setZoomed(false);
            }}>{graphs[key].label}</button>
          ))}
        </div>
        <p>{graph.run}</p>
      </div>

      <div className={styles.graphBody}>
        <figure className={styles.canvas}>
          <div className={styles.canvasControls}>
            <div>
              <label htmlFor="workflow-node-select">Find a node</label>
              <select id="workflow-node-select" value={node.id} onChange={(event) => setActive(event.target.value)}>
                {nodes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <button className={styles.zoomButton} type="button" aria-controls="workflow-plot" onClick={() => setZoomed(!zoomed)}>
              {zoomed ? "Fit canvas" : "Zoom in"}
            </button>
          </div>
          <div className={styles.viewport} id="workflow-plot" data-zoomed={zoomed}>
            <div className={styles.surface} role="group" aria-label={`${graph.label} nodes. Use the arrow keys to move between nodes.`}>
              <Image src={`${media}/${graph.image}`} width={1440} height={graph.height} alt={graph.alt} sizes={zoomed ? "1440px" : "(max-width: 900px) 95vw, (max-width: 1280px) 64vw, 910px"} />
              {nodes.map((item, index) => {
                const [x, y, width, height] = item.bounds;
                return (
                  <button
                    className={styles.nodeHit}
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-controls="workflow-step"
                    aria-pressed={item.id === node.id}
                    title={item.label}
                    tabIndex={item.id === node.id ? 0 : -1}
                    style={{ left: `${x / 14.4}%`, top: `${y * 100 / graph.height}%`, width: `${width / 14.4}%`, height: `${height * 100 / graph.height}%` }}
                    onClick={() => setActive(item.id)}
                    onKeyDown={(event) => moveNodeFocus(event, index)}
                  />
                );
              })}
            </div>
          </div>
          <figcaption>
            <span>Recorded {graph.label} run</span>
            <a href={`${media}/${graph.image}`} target="_blank" rel="noreferrer">Open original canvas <span aria-hidden>↗</span></a>
          </figcaption>
        </figure>
        <aside className={styles.inspector} aria-label="Node inspector">
          <div className={styles.nodeDetail} id="workflow-step" ref={detailRef} tabIndex={-1} aria-live="polite">
            <code>{node.type}</code>
            <h3>{node.label}</h3>
            <dl>
              <div><dt>Input</dt><dd>{node.input}</dd></div>
              <div><dt>What it does</dt><dd>{node.role}</dd></div>
              <div><dt>Output</dt><dd>{node.output}</dd></div>
            </dl>
          </div>
          <div className={styles.nodeExtras} key={`${provider}-${node.id}`}>
            {node.prompt && <details><summary>Read the full prompt</summary><p>{node.prompt}</p></details>}
            {node.previews && (
              <div className={styles.nodePreviews}>
                {node.previews.map((image) => (
                  <a href={image.src} key={image.src} target="_blank" rel="noreferrer" aria-label={`Open ${image.label} image`}>
                    <Image src={image.src} alt={image.alt} width={68} height={84} />
                    <span>{image.label} <span aria-hidden>↗</span></span>
                  </a>
                ))}
              </div>
            )}
            <NodeConnections
              from={nodes.filter((item) => edges.some(([source, target]) => source === item.id && target === node.id))}
              to={nodes.filter((item) => edges.some(([source, target]) => source === node.id && target === item.id))}
              onSelect={(id) => { setActive(id); detailRef.current?.focus({ preventScroll: true }); }}
            />
          </div>
        </aside>
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

function NodeConnections({ from, to, onSelect }: {
  from: readonly GraphNode[];
  to: readonly GraphNode[];
  onSelect: (id: string) => void;
}) {
  if (!from.length && !to.length) return null;
  return (
    <details>
      <summary>Connected nodes</summary>
      {[{ label: "From", nodes: from }, { label: "To", nodes: to }].filter((group) => group.nodes.length > 0).map((group) => (
        <div className={styles.connections} key={group.label}>
          <strong>{group.label}</strong>
          {group.nodes.map((node) => (
            <button type="button" key={node.id} onClick={() => onSelect(node.id)}>{node.label}</button>
          ))}
        </div>
      ))}
    </details>
  );
}
