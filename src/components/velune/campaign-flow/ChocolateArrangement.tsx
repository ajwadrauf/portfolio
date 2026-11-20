"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { campaignMedia } from "./campaign-data";
import styles from "./workbench.module.css";

import { chocolateAssets, chocolateViews, paintChocolateCluster, readChocolateLayer, type ChocolateLayer, type ChocolateView } from "./chocolate-staging";

type Piece = { id: number; view: ChocolateView };
type Layers = Record<ChocolateView, ChocolateLayer>;

const maxPieces = 4;
const initialPieces: Piece[] = [
  { id: 0, view: "whole" },
  { id: 1, view: "front" },
  { id: 2, view: "angled" },
];

async function loadLayer(filename: string) {
  const image = new window.Image();
  image.src = `${campaignMedia}/chocolates/${filename}.webp`;
  await image.decode();
  return readChocolateLayer(image);
}

export function ChocolateArrangement() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const nextId = useRef(initialPieces.length);
  const [pieces, setPieces] = useState<Piece[]>(initialPieces);
  const [layers, setLayers] = useState<Layers | null>(null);
  const [failed, setFailed] = useState(false);
  const [rearranged, setRearranged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(chocolateAssets.map(async (name) => [name, await loadLayer(name)] as const)).then((entries) => {
      if (!cancelled) setLayers(Object.fromEntries(entries) as Layers);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !layers) return;
    ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, 1080, 1350);
    paintChocolateCluster(ctx, pieces.map((piece) => piece.view), layers, rearranged);
  }, [layers, pieces, rearranged]);

  return (
    <section className={styles.arrangement} aria-labelledby="chocolate-arrangement-heading">
      <div className={styles.controls}>
        <div className={styles.arrangementHead}>
          <h4 id="chocolate-arrangement-heading">Arrange the chocolates</h4>
          <div className={styles.arrangementActions}>
            <button
              className="btn-secondary"
              type="button"
              disabled={pieces.length >= maxPieces}
              onClick={() => {
                const id = nextId.current++;
                setPieces((current) => current.length >= maxPieces ? current : [...current, { id, view: "whole" }]);
              }}
            >
              Add chocolate
            </button>
            <button className={styles.rearrange} type="button" disabled={pieces.length === 0} onClick={() => setRearranged((current) => !current)}>
              Rearrange
            </button>
          </div>
        </div>
        <ol className={styles.pieces}>
          {pieces.map((piece, index) => (
            <li key={piece.id}>
              <label htmlFor={`chocolate-view-${piece.id}`}>Piece {index + 1}</label>
              <select id={`chocolate-view-${piece.id}`} value={piece.view} onChange={(event) => {
                const view = event.target.value as ChocolateView;
                setPieces((current) => current.map((item) => item.id === piece.id ? { ...item, view } : item));
              }}>
                {Object.entries(chocolateViews).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button
                type="button"
                aria-label={`Remove piece ${index + 1}`}
                onClick={() => setPieces((current) => current.filter((item) => item.id !== piece.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
        <p role="status" className={styles.status}>
          {failed ? "The chocolate layers couldn’t load." : layers ? `${pieces.length} of ${maxPieces} pieces` : "Loading chocolate layers…"}
        </p>
      </div>
      <div
        className={styles.arrangementPreview}
        role="img"
        aria-label={`Raspberry Ganache carton with ${pieces.length} chocolate pieces${pieces.length ? ": " + pieces.map((piece) => chocolateViews[piece.view]).join(", ") : ""}`}
      >
        <Image src={`${campaignMedia}/chocolates/arrangement-plate.webp`} alt="" width={1080} height={1350} sizes="(max-width: 640px) 90vw, 460px" />
        <canvas ref={canvas} width={540} height={675} aria-hidden="true" />
      </div>
    </section>
  );
}
