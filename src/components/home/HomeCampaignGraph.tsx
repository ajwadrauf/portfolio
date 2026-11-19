"use client";

import Image from "next/image";
import { useState } from "react";
import { campaignMedia, campaignPreviews, campaignSteps } from "@/components/velune/campaign-flow/campaign-data";
import styles from "./home-campaign-graph.module.css";

const outputs = [
  ["storefront", "Storefront"],
  ["english", "English ad"],
  ["french", "French ad"],
] as const;

type HomeStep = "carton" | "square" | "social" | (typeof outputs)[number][0];

export function HomeCampaignGraph() {
  const [active, setActive] = useState<HomeStep>("english");
  const step = campaignSteps[active];
  const preview = campaignPreviews[step.preview];

  function node(key: HomeStep, label: string, showImage = false) {
    const asset = campaignSteps[key].preview;
    return (
      <button
        key={key}
        type="button"
        className={styles.node}
        aria-pressed={active === key}
        aria-controls="homepage-campaign-preview"
        onClick={() => setActive(key)}
      >
        {showImage && (
          <Image
            className={styles.thumbnail}
            src={`${campaignMedia}/${asset}.webp`}
            width={108}
            height={135}
            sizes="(max-width: 560px) 30vw, 135px"
            alt=""
          />
        )}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.layout}>
        <div className={styles.graph} role="group" aria-label="VELUNE campaign graph">
          <div className={styles.source}>{node("carton", "Original carton")}</div>
          <div className={styles.branches} role="group" aria-label="Layouts from the original carton">
            {node("square", "Square layout")}
            {node("social", "Social layout")}
          </div>
          <div className={styles.outputs} role="group" aria-label="Three exports">
            {outputs.map(([key, label]) => node(key, label, true))}
          </div>
        </div>
        <figure className={styles.preview} id="homepage-campaign-preview">
          <div className={styles.previewImage}>
            <Image
              src={`${campaignMedia}/${step.preview}.webp`}
              width={preview.width}
              height={preview.height}
              sizes="(max-width: 560px) 65vw, 225px"
              alt={preview.alt}
            />
          </div>
          <figcaption aria-live="polite">
            <strong>{preview.caption}</strong>
            <span>{step.process}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
