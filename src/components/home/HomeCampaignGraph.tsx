"use client";

import { useEffect, useRef, useState } from "react";
import { campaignMedia } from "@/components/velune/campaign-flow/campaign-data";
import { backdrops, drawVeluneLayout, flavours, layoutDimensions, type Backdrop, type Export, type Flavour, type Template } from "./velune-layouts";
import styles from "./home-campaign-graph.module.css";

const outputs = ["storefront", "english", "french"] as const;

const stages = {
  carton: { label: "Carton", template: "carton", description: "This carton supplies the packaging for all three outputs." },
  square: { label: "Square layout", template: "storefront", description: "The same carton goes on a white storefront background." },
  social: { label: "Social layout", template: "english", description: "Both social ads share the carton and backdrop." },
  storefront: { label: "Storefront", template: "storefront", description: "1200 × 1200 · white background" },
  english: { label: "English ad", template: "english", description: "1080 × 1350 · English copy" },
  french: { label: "French ad", template: "french", description: "1080 × 1350 · French copy" },
} as const satisfies Record<string, { label: string; template: Template; description: string }>;

type Step = keyof typeof stages;

function LayoutPreview({
  carton, flavour, backdrop, template, thumbnail = false, label,
}: {
  carton: HTMLImageElement | null;
  flavour: Flavour;
  backdrop: Backdrop;
  template: Template;
  thumbnail?: boolean;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = layoutDimensions(template);
  const previewWidth = thumbnail ? 240 : 540;
  const scene = template === "english" || template === "french" ? backdrop : "mulberry";

  useEffect(() => {
    const current = canvas.current;
    if (!current) return;
    if (carton) drawVeluneLayout(current, carton, flavour, scene, template);
    else {
      const context = current.getContext("2d");
      context?.resetTransform();
      context?.clearRect(0, 0, current.width, current.height);
    }
  }, [carton, flavour, scene, template]);

  return (
    <canvas
      ref={canvas}
      className={thumbnail ? styles.thumbnail : undefined}
      width={previewWidth}
      height={Math.round(previewWidth * height / width)}
      role={thumbnail ? undefined : "img"}
      aria-hidden={thumbnail || undefined}
      aria-label={label}
    />
  );
}

function downloadLayout(carton: HTMLImageElement, flavour: Flavour, backdrop: Backdrop, template: Export) {
  const canvas = document.createElement("canvas");
  const { width, height } = layoutDimensions(template);
  canvas.width = width;
  canvas.height = height;
  drawVeluneLayout(canvas, carton, flavour, backdrop, template);
  canvas.toBlob((file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `velune-${flavour}-${template}${template === "storefront" ? "" : `-${backdrop}`}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

export function HomeCampaignGraph() {
  const [active, setActive] = useState<Step>("english");
  const [flavour, setFlavour] = useState<Flavour>("raspberry");
  const [backdrop, setBackdrop] = useState<Backdrop>("mulberry");
  const [loaded, setLoaded] = useState<{ flavour: Flavour; image: HTMLImageElement } | null>(null);
  const [failed, setFailed] = useState<Flavour | null>(null);
  const carton = loaded?.flavour === flavour ? loaded.image : null;
  const stage = stages[active];
  const { template } = stage;
  const preview = { carton, flavour, backdrop };

  useEffect(() => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => setLoaded({ flavour, image });
    image.onerror = () => setFailed(flavour);
    image.src = `${campaignMedia}/cartons/${flavour}.webp`;
    return () => { image.onload = null; image.onerror = null; };
  }, [flavour]);

  function node(key: Step, thumbnail = false) {
    const item = stages[key];
    return (
      <button
        key={key}
        type="button"
        className={styles.node}
        aria-pressed={active === key}
        aria-controls="homepage-campaign-preview"
        onClick={() => setActive(key)}
      >
        {thumbnail && <LayoutPreview {...preview} template={item.template} thumbnail />}
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.layout}>
        <div className={styles.graph} role="group" aria-label="VELUNE campaign graph">
          <div className={styles.source}>
            <div className={styles.controlNode}>
              {node("carton")}
              <select aria-label="Packaging flavour" value={flavour} onChange={(event) => {
                setFailed(null);
                setFlavour(event.target.value as Flavour);
              }}>
                {Object.entries(flavours).map(([key, option]) => <option key={key} value={key}>{option.name}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.branches} role="group" aria-label="Layouts from the original carton">
            <div className={styles.branchCell}>{node("square")}</div>
            <div className={styles.branchCell}>
              <div className={styles.controlNode}>
                {node("social")}
                <fieldset className={styles.backdropSelector}>
                  <legend>Backdrop · {backdrops[backdrop].name}</legend>
                  <div>
                    {Object.entries(backdrops).map(([key, option]) => (
                      <button
                        type="button"
                        key={key}
                        aria-label={`${option.name} backdrop`}
                        aria-pressed={backdrop === key}
                        onClick={() => {
                          setBackdrop(key as Backdrop);
                          if (active !== "english" && active !== "french" && active !== "social") setActive("english");
                        }}
                      >
                        <span style={{ backgroundColor: option.swatch }} />
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          </div>
          <div className={styles.outputs} role="group" aria-label="Three exports">
            {outputs.map((key) => node(key, true))}
          </div>
        </div>
        <figure className={styles.preview} id="homepage-campaign-preview" aria-busy={!carton && failed !== flavour}>
          <div className={styles.previewImage}>
            <LayoutPreview {...preview} template={template} label={`${flavours[flavour].name} · ${stage.label}${template === "english" || template === "french" ? ` · ${backdrops[backdrop].name} backdrop` : ""}`} />
          </div>
          <figcaption aria-live="polite">
            <strong>{stage.label}</strong>
            <span>{carton ? stage.description : failed === flavour ? "The carton couldn’t load. Choose another flavour and try again." : "Loading carton artwork…"}</span>
          </figcaption>
          {template !== "carton" && (
            <button className={styles.download} type="button" disabled={!carton} onClick={() => {
              if (carton) downloadLayout(carton, flavour, backdrop, template);
            }}>
              Download PNG
            </button>
          )}
        </figure>
      </div>
    </div>
  );
}
