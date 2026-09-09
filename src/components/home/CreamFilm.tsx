"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CREAM_FINAL } from "@/components/studio/creamStudy";
import styles from "./CreamFilm.module.css";

/** A real film first; native controls keep audio, seek and fullscreen usable. */
export function CreamFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const pause = () => video.pause();
    const onVisibility = () => { if (document.hidden) pause(); };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) pause();
    });
    observer.observe(video);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const play = async () => {
    setStarted(true);
    try { await videoRef.current?.play(); }
    catch { /* Native controls and a direct file link remain available. */ }
  };

  return (
    <div className={styles.film}>
      <div className={styles.heading}>
        <span>Cream in motion</span>
        <span>18 seconds / Seedance 2.5</span>
      </div>
      <div className={styles.stage}>
        <span className={styles.sideNote} aria-hidden>FROM GEOMETRY</span>
        <video
          ref={videoRef}
          src={CREAM_FINAL.src}
          poster={CREAM_FINAL.poster}
          width={480}
          height={854}
          preload="none"
          controls={started}
          playsInline
          aria-label="Cream in motion: 18-second Seedance ice-cream film, directed using Blender"
          onError={() => setFailed(true)}
        />
        <span className={`${styles.sideNote} ${styles.sideRight}`} aria-hidden>TO SOMETHING YOU CAN TASTE</span>
        {!started && (
          <button type="button" className={styles.play} onClick={() => void play()}>
            <span className={styles.playCircle} aria-hidden>▶</span>
            Watch the film
          </button>
        )}
      </div>
      {failed && <p className={styles.error} role="status">The film couldn’t load here. <a href={CREAM_FINAL.src} target="_blank" rel="noreferrer">Open the video directly ↗</a></p>}
      <div className={styles.caption}>
        <span>Blender direction. Five references. One finished film.</span>
        <Link href="/ai-studio#motion-study">Compare with Blender <span aria-hidden>↗</span></Link>
      </div>
    </div>
  );
}
