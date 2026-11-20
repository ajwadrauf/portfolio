"use client";

import { useEffect, useRef, useState } from "react";
import { campaignMedia } from "@/components/velune/campaign-flow/campaign-data";
import {
  backdrops, defaultHeadline, drawVeluneLayout, flavours, layoutDimensions,
  type Backdrop, type CopyLanguage, type Export, type Flavour, type Template,
} from "./velune-layouts";
import styles from "./home-campaign-graph.module.css";

const outputs = ["storefront", "english", "french"] as const;
const copyLanguages = [
  ["english", "English"],
  ["french", "French"],
] as const;

const stages = {
  carton: { label: "Carton", template: "carton", description: "This carton supplies the packaging for all three outputs." },
  square: { label: "Square layout", template: "storefront", description: "The same carton goes on a white storefront background." },
  social: { label: "Social layout", template: "english", description: "Both social ads share the carton and backdrop." },
  storefront: { label: "Storefront", template: "storefront", description: "1200 × 1200 · white background" },
  english: { label: "English ad", template: "english", description: "1080 × 1350 · English copy" },
  french: { label: "French ad", template: "french", description: "1080 × 1350 · French copy" },
} as const satisfies Record<string, { label: string; template: Template; description: string }>;

type Step = keyof typeof stages;
type HeadlineEdits = Partial<Record<Flavour, Partial<Record<CopyLanguage, string>>>>;
type GraphChange = "carton" | "backdrop" | CopyLanguage;

const affectedOutputs = {
  carton: outputs,
  backdrop: ["english", "french"],
  english: ["english"],
  french: ["french"],
} as const satisfies Record<GraphChange, readonly Export[]>;

const changeAnnouncements = {
  carton: "All three exports updated.",
  backdrop: "English and French ads updated.",
  english: "English ad updated.",
  french: "French ad updated.",
} as const satisfies Record<GraphChange, string>;

function LayoutPreview({
  carton, flavour, backdrop, template, headline, thumbnail = false, label,
}: {
  carton: HTMLImageElement | null;
  flavour: Flavour;
  backdrop: Backdrop;
  template: Template;
  headline?: string;
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
    if (carton) drawVeluneLayout(current, carton, flavour, scene, template, headline);
    else {
      const context = current.getContext("2d");
      context?.resetTransform();
      context?.clearRect(0, 0, current.width, current.height);
    }
  }, [carton, flavour, scene, template, headline]);

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

function downloadLayout(carton: HTMLImageElement, flavour: Flavour, backdrop: Backdrop, template: Export, headline?: string) {
  const canvas = document.createElement("canvas");
  const { width, height } = layoutDimensions(template);
  canvas.width = width;
  canvas.height = height;
  drawVeluneLayout(canvas, carton, flavour, backdrop, template, headline);
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
  const [lastChange, setLastChange] = useState<GraphChange | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyLanguage, setCopyLanguage] = useState<CopyLanguage>("english");
  const [headlines, setHeadlines] = useState<HeadlineEdits>({});
  const [loaded, setLoaded] = useState<{ flavour: Flavour; image: HTMLImageElement } | null>(null);
  const [failed, setFailed] = useState<Flavour | null>(null);
  const carton = loaded?.flavour === flavour ? loaded.image : null;
  const stage = stages[active];
  const { template } = stage;
  const preview = { carton, flavour, backdrop };
  const headline = headlineFor(template);
  const selectedHeadline = headlineFor(copyLanguage) ?? "";

  function headlineFor(mode: Template) {
    if (mode === "english" || mode === "french") {
      return headlines[flavour]?.[mode] ?? defaultHeadline(flavour, mode);
    }
  }

  function selectLanguage(language: CopyLanguage) {
    setCopyLanguage(language);
    setActive(language);
  }

  function updateHeadline(value: string | undefined) {
    setHeadlines((current) => ({
      ...current,
      [flavour]: { ...current[flavour], [copyLanguage]: value },
    }));
    setActive(copyLanguage);
    if ((value ?? defaultHeadline(flavour, copyLanguage)) !== selectedHeadline) setLastChange(copyLanguage);
  }

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
        data-wire-active={(thumbnail && lastChange !== null && affectedOutputs[lastChange].some((output) => output === key)) || undefined}
        aria-controls="homepage-campaign-preview"
        onClick={() => {
          if (key === "english" || key === "french") selectLanguage(key);
          else setActive(key);
        }}
      >
        {thumbnail && <LayoutPreview {...preview} template={item.template} headline={headlineFor(item.template)} thumbnail />}
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.layout}>
        <div className={styles.graphPanel}>
          <div className={styles.graph} data-change={lastChange ?? undefined} role="group" aria-label="VELUNE campaign graph">
            <div className={styles.source}>
              <div className={styles.controlNode}>
                {node("carton")}
                <select aria-label="Packaging flavour" value={flavour} onChange={(event) => {
                  setFailed(null);
                  setFlavour(event.target.value as Flavour);
                  setLastChange("carton");
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
                            if (key === backdrop) return;
                            setBackdrop(key as Backdrop);
                            setLastChange("backdrop");
                            if (active !== "english" && active !== "french" && active !== "social") setActive("english");
                          }}
                        >
                          <span style={{ backgroundColor: option.swatch }} />
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <button
                  type="button"
                  className={`${styles.node} ${styles.copyTrigger}`}
                  aria-expanded={copyOpen}
                  aria-controls="homepage-campaign-copy"
                  onClick={() => {
                    if (!copyOpen) setActive(copyLanguage);
                    setCopyOpen(!copyOpen);
                  }}
                >
                  <span>Headline copy <span aria-hidden="true">{copyOpen ? "−" : "+"}</span></span>
                </button>
              </div>
            </div>
            <div className={styles.outputs} role="group" aria-label="Three exports">
              {outputs.map((key) => node(key, true))}
            </div>
          </div>
          <p className="sr-only" role="status">{lastChange && changeAnnouncements[lastChange]}</p>
          <div className={styles.copyEditor} id="homepage-campaign-copy" hidden={!copyOpen}>
            <div className={styles.copyToolbar}>
              <div className={styles.copyLanguages} role="group" aria-label="Headline language">
                {copyLanguages.map(([language, label]) => (
                  <button
                    key={language}
                    type="button"
                    aria-pressed={copyLanguage === language}
                    onClick={() => selectLanguage(language)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.resetCopy}
                disabled={headlines[flavour]?.[copyLanguage] === undefined}
                onClick={() => updateHeadline(undefined)}
              >
                Reset headline
              </button>
            </div>
            <label htmlFor="homepage-headline">{copyLanguage === "french" ? "French headline" : "English headline"}</label>
            <textarea
              id="homepage-headline"
              lang={copyLanguage === "french" ? "fr" : "en"}
              rows={2}
              maxLength={72}
              value={selectedHeadline}
              onChange={(event) => updateHeadline(event.target.value)}
            />
          </div>
        </div>
        <figure className={styles.preview} id="homepage-campaign-preview" aria-busy={!carton && failed !== flavour}>
          <div className={styles.previewImage}>
            <LayoutPreview
              {...preview}
              template={template}
              headline={headline}
              label={`${flavours[flavour].name} · ${stage.label}${template === "english" || template === "french" ? ` · ${backdrops[backdrop].name} backdrop. ${headline?.replace(/\n/g, " ")}` : ""}`}
            />
          </div>
          <figcaption aria-live="polite">
            <strong>{stage.label}</strong>
            <span>{carton ? stage.description : failed === flavour ? "The carton couldn’t load. Choose another flavour and try again." : "Loading carton artwork…"}</span>
          </figcaption>
          {template !== "carton" && (
            <button className={styles.download} type="button" disabled={!carton} onClick={() => {
              if (carton) downloadLayout(carton, flavour, backdrop, template, headline);
            }}>
              Download PNG
            </button>
          )}
        </figure>
      </div>
    </div>
  );
}
