"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { campaignMedia } from "./campaign-data";
import styles from "./workbench.module.css";

const views = {
  whole: { label: "Whole · three-quarter", base: [[0.06, 0.73], [0.59, 0.99], [0.98, 0.60]] },
  front: { label: "Cut · front", base: [[0.04, 0.97], [0.53, 0.98], [0.98, 0.97]] },
  angled: { label: "Cut · angled", base: [[0.02, 0.80], [0.85, 0.98], [0.99, 0.86]] },
} as const;

type View = keyof typeof views;
type Piece = { id: number; view: View };
type Layers = Record<View, HTMLImageElement>;

const maxPieces = 4;
const initialPieces: Piece[] = [
  { id: 0, view: "whole" },
  { id: 1, view: "front" },
  { id: 2, view: "angled" },
];

// Each position is a floor contact point and a width in the 1080px layout.
// Layouts are ordered back to front to keep overlaps and scale believable.
const positions = [
  [],
  [[821, 1115, 148]],
  [[864, 1048, 126], [804, 1142, 147]],
  [[856, 1031, 119], [757, 1124, 131], [925, 1156, 143]],
  [[811, 1014, 102], [930, 1083, 116], [748, 1133, 125], [903, 1191, 144]],
] as const;

function paintPiece(ctx: CanvasRenderingContext2D, asset: HTMLImageElement, view: View, centreX: number, bottom: number, width: number) {
  const height = width * asset.naturalHeight / asset.naturalWidth;
  const left = centreX - width / 2;
  const top = bottom - height;
  ctx.save();
  ctx.translate(centreX + width * 0.10, bottom - height * 0.05);
  ctx.scale(1, 0.25);
  const radius = width * 0.72;
  const shadow = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
  shadow.addColorStop(0, "#230a14a8");
  shadow.addColorStop(1, "#230a1400");
  ctx.fillStyle = shadow;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  const [[startX, startY], [middleX, middleY], [endX, endY]] = views[view].base;
  ctx.moveTo(left + width * startX, top + height * startY + 1);
  ctx.lineTo(left + width * middleX, top + height * middleY + 1);
  ctx.lineTo(left + width * endX, top + height * endY + 1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = "#1c070c78";
  ctx.shadowColor = "#1c070c87";
  ctx.shadowBlur = 7 * ctx.getTransform().a;
  ctx.stroke();
  ctx.restore();
  ctx.drawImage(asset, left, top, width, height);
}

async function loadLayer(filename: string) {
  const image = new window.Image();
  image.src = `${campaignMedia}/chocolates/${filename}.webp`;
  await image.decode();
  return image;
}

export function ChocolateArrangement() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const nextId = useRef(initialPieces.length);
  const [pieces, setPieces] = useState<Piece[]>(initialPieces);
  const [layers, setLayers] = useState<Layers | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadLayer("whole"),
      loadLayer("front"),
      loadLayer("angled"),
    ]).then(([whole, front, angled]) => {
      if (!cancelled) setLayers({ whole, front, angled });
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
    // Limit insertion to the available floor positions.
    pieces.forEach((piece, index) => {
      const pose = positions[pieces.length][index];
      paintPiece(ctx, layers[piece.view], piece.view, pose[0], pose[1], pose[2]);
    });
  }, [layers, pieces]);

  return (
    <section className={styles.arrangement} aria-labelledby="chocolate-arrangement-heading">
      <div className={styles.controls}>
        <div className={styles.arrangementHead}>
          <h4 id="chocolate-arrangement-heading">Arrange the chocolates</h4>
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
        </div>
        <ol className={styles.pieces}>
          {pieces.map((piece, index) => (
            <li key={piece.id}>
              <label htmlFor={`chocolate-view-${piece.id}`}>Piece {index + 1}</label>
              <select id={`chocolate-view-${piece.id}`} value={piece.view} onChange={(event) => {
                const view = event.target.value as View;
                setPieces((current) => current.map((item) => item.id === piece.id ? { ...item, view } : item));
              }}>
                {Object.entries(views).map(([key, view]) => <option key={key} value={key}>{view.label}</option>)}
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
        aria-label={`Raspberry Ganache carton with ${pieces.length} chocolate pieces${pieces.length ? ": " + pieces.map((piece) => views[piece.view].label).join(", ") : ""}`}
      >
        <Image src={`${campaignMedia}/chocolates/arrangement-plate.webp`} alt="" width={1080} height={1350} sizes="(max-width: 640px) 90vw, 460px" />
        <canvas ref={canvas} width={540} height={675} aria-hidden="true" />
      </div>
    </section>
  );
}
