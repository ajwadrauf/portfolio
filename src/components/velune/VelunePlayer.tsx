"use client";

import { useRef, useState } from "react";
import { VELUNE_MEDIA, VELUNE_SHOTS } from "./veluneStudy";
import styles from "./Velune.module.css";

export function VelunePlayer() {
  const player = useRef<HTMLVideoElement>(null);
  const [frame, setFrame] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const current = frame === null ? null : VELUNE_SHOTS.find((shot) => frame >= shot.start && frame < shot.end);

  function inspect(start: number) {
    if (!player.current) return;
    player.current.pause();
    player.current.currentTime = start / 24 + 0.001;
    setFrame(start);
  }

  return (
    <div className={styles.player}>
      <div className={styles.playerBar}>
        <span>Blender camera study</span>
        <span>15 seconds · silent preview</span>
      </div>
      <video
        ref={player}
        className={styles.video}
        src={VELUNE_MEDIA.animatic}
        poster={VELUNE_MEDIA.poster}
        controls
        playsInline
        preload="metadata"
        aria-label="VELUNE: fifteen-second silent Blender camera study"
        aria-describedby="velune-video-description"
        onTimeUpdate={(event) => setFrame(Math.min(359, Math.floor(event.currentTarget.currentTime * 24)))}
        onError={() => setFailed(true)}
      >
        Your browser does not support this video. Use the download below.
      </video>
      {failed && <p className={styles.playerError} role="status">The preview could not load. You can try the direct video link below.</p>}
      <div className={styles.playerDetail}>
        <div><span className={styles.eyebrow}>{current ? `${current.id} / ${current.start}–${current.end - 1}` : "12 shots / 360 frames"}</span><h3>{current?.title ?? "Explore the edit."}</h3></div>
        <p>{current?.note ?? "Watch the full camera study, or select a shot to inspect its opening composition and the decision behind it."}</p>
      </div>
      <div className={styles.shotGrid} aria-label="Inspect a shot in the camera study">
        {VELUNE_SHOTS.map((shot) => (
          <button key={shot.id} type="button" className={styles.shot} aria-pressed={current?.id === shot.id} onClick={() => inspect(shot.start)} aria-label={`Inspect ${shot.id}: ${shot.title}, ${(shot.start / 24).toFixed(3)} seconds`}>
            <span>{shot.id}<span>{(shot.start / 24).toFixed(2)}s</span></span>
            <strong>{shot.title}</strong>
          </button>
        ))}
      </div>
      <div className={styles.playerFooter}>
        <p>Select a shot to pause at its first frame. Use the video controls to watch the full sequence.</p>
        <a href={VELUNE_MEDIA.animatic} download>Download camera study <span aria-hidden>↓</span></a>
      </div>
    </div>
  );
}
