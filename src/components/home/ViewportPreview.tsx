"use client";

import { useEffect, useRef } from "react";

const visibleRatio = 0.5;

export function ViewportPreview({ src, poster, label, descriptionId }: {
  src: string;
  poster: string;
  label: string;
  descriptionId: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    let manuallyPaused = false;
    let observerPaused = false;

    function pauseForVisibility() {
      if (!video || video.paused) return;
      observerPaused = true;
      video.pause();
    }

    function updatePlayback() {
      if (!video) return;
      if (!inView || document.hidden) {
        pauseForVisibility();
      } else if (!motion.matches && !manuallyPaused && video.paused) {
        video.muted = true;
        // A browser can decline autoplay. The native controls remain available.
        void video.play().catch(() => {});
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.intersectionRatio >= visibleRatio;
      updatePlayback();
    }, { threshold: visibleRatio });

    function handlePause() {
      if (observerPaused) {
        observerPaused = false;
      } else if (!video?.ended) {
        manuallyPaused = true;
      }
    }

    function handlePlay() {
      manuallyPaused = false;
    }

    function handleMotionChange() {
      if (motion.matches) pauseForVisibility();
      else updatePlayback();
    }

    observer.observe(video);
    video.addEventListener("pause", handlePause);
    video.addEventListener("play", handlePlay);
    document.addEventListener("visibilitychange", updatePlayback);
    motion.addEventListener("change", handleMotionChange);

    return () => {
      observer.disconnect();
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("play", handlePlay);
      document.removeEventListener("visibilitychange", updatePlayback);
      motion.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <video ref={ref} width={1120} height={728} controls muted playsInline preload="none" poster={poster} aria-label={label} aria-describedby={descriptionId}>
      <source src={src} type="video/mp4" />
      <a href={src}>Open {label}</a>
    </video>
  );
}
