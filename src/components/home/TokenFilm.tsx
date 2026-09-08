"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * TOKEN, the 12-second Blender film, with controls of its own.
 *
 * Deliberately not autoplaying and not decorative. It is a piece of work
 * someone is being asked to watch, so it waits to be started, keeps its own
 * play, scrub and fullscreen controls in the section's type rather than the
 * browser's chrome, and stops the moment it scrolls away or the tab is hidden.
 *
 * preload="none" means the 9 MB file is not fetched until someone asks for it;
 * until then the poster carries the frame.
 */

/** Falls back to the known length until the file reports its own. */
const NOMINAL_DURATION = 12;

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
};

/** iOS Safari has no element fullscreen; it exposes the video's own instead. */
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export function TokenFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(NOMINAL_DURATION);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.ended) video.currentTime = 0;
    try {
      await video.play();
    } catch {
      // Autoplay policy, a codec problem, anything: hand the visitor the
      // browser's own controls rather than a dead button.
      video.controls = true;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const pause = () => video.pause();
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);

    /*
     * Scrolled away is the same as paused.
     *
     * A film playing to nobody is decoding a 1080p stream off screen for as
     * long as the page is open, which on a phone is felt rather than seen.
     */
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (!entries[0].isIntersecting) pause();
            },
            { threshold: 0.08 },
          );
    observer?.observe(video);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, []);

  const label = ended ? "Replay" : playing ? "Pause" : "Play";

  return (
    <>
      <div className="ar-film-stage">
        <video
          ref={videoRef}
          poster="/homepage/token-poster.jpg"
          playsInline
          // The film carries no audio track, so muted costs nothing and keeps
          // it clear of every autoplay-with-sound restriction.
          muted
          preload="none"
          aria-label="TOKEN: Ajwad Rauf’s 12-second Blender portfolio film"
          onClick={play}
          onPlay={() => {
            setPlaying(true);
            setEnded(false);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setEnded(true);
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const seconds = e.currentTarget.duration;
            if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds);
          }}
        >
          <source src="/homepage/token-film.mp4" type="video/mp4" />
        </video>
        <button
          className="ar-big-play"
          type="button"
          hidden={playing}
          aria-label="Play the TOKEN film"
          onClick={play}
        >
          <span aria-hidden>▷</span>
          <span>Play film</span>
        </button>
      </div>

      <div className="ar-film-controls">
        <button type="button" aria-label={`${label} film`} onClick={play}>
          {label} <span aria-hidden>{ended ? "↻" : playing ? "Ⅱ" : "▷"}</span>
        </button>
        <span className="ar-micro">TOKEN / 2026</span>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={Math.min(current, duration)}
          aria-label="Film playback position in seconds"
          onChange={(e) => {
            const video = videoRef.current;
            const to = Number(e.target.value);
            setCurrent(to);
            if (video) video.currentTime = to;
          }}
        />
        <span className="ar-micro">
          {clock(current)} / {clock(duration)}
        </span>
        <button
          type="button"
          aria-label="Play the film full screen"
          onClick={async () => {
            const video = videoRef.current as IosVideo | null;
            if (!video) return;
            try {
              if (video.requestFullscreen) await video.requestFullscreen();
              else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
              else video.controls = true;
            } catch {
              video.controls = true;
            }
          }}
        >
          <span className="ar-fullscreen-label">Full screen </span>
          <span className="ar-fullscreen-glyph" aria-hidden>
            ↗
          </span>
        </button>
      </div>
    </>
  );
}
