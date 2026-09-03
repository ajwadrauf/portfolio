"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type ComparePane = {
  src: string;
  poster?: string;
  label: string;
  cost: string;
  note: string;
};

/**
 * The clay pass and the finished render, played together.
 *
 * Separately these are two nice clips. Side by side and frame-locked they are
 * the argument the whole site makes: the grey one cost nothing and settled
 * every camera decision; the finished one only had to solve surfaces. Nobody
 * reads that claim in prose as fast as they see it in twelve seconds.
 *
 * Both start on one control and are re-synced whenever they drift, because
 * two videos left to their own devices will not stay together — decode
 * scheduling differs per element, and a comparison that slides out of
 * alignment makes the opposite point to the one intended.
 */
/**
 * One side of the comparison.
 *
 * Declared at module scope, not inside ClayCompare: a component defined in a
 * render body is a new type every render, so React unmounts and remounts the
 * <video> beneath it — losing playback position and the ref. Toggling mute
 * restarted both clips before this moved out here.
 */
function Pane({
  pane,
  innerRef,
  silent,
  muted,
  playing,
  onToggle,
}: {
  pane: ComparePane;
  innerRef: React.RefObject<HTMLVideoElement | null>;
  silent: boolean;
  muted: boolean;
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <figure className="m-0 min-w-0">
      {/*
        The frame is the control. People click video, not a button underneath
        it — and the glyph also gives the pane something to be before playback
        starts, which matters most for the finished render: it carries no
        poster, so without this it is an empty box until the first frame paints.
      */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause both clips" : "Play both clips"}
        className="group relative block w-full overflow-hidden rounded-[6px] border border-border-soft bg-surface-2 text-left"
      >
        <video
          ref={innerRef}
          src={pane.src}
          poster={pane.poster}
          muted={silent || muted}
          loop
          playsInline
          preload="metadata"
          className="block aspect-[4/3] w-full object-cover"
        />
        <span className="absolute left-2 top-2 rounded bg-foreground/75 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-background">
          {pane.cost}
        </span>
        {!playing && (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-foreground/10 transition group-hover:bg-foreground/20"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/85 pl-1 text-lg text-foreground shadow-sm">
              ▶
            </span>
          </span>
        )}
      </button>
      <figcaption className="mt-2.5">
        <p className="text-sm font-semibold leading-snug">{pane.label}</p>
        <p className="mt-1 text-xs leading-[1.55] text-muted">{pane.note}</p>
      </figcaption>
    </figure>
  );
}

export function ClayCompare({
  left,
  right,
  href,
  hrefLabel,
}: {
  left: ComparePane;
  right: ComparePane;
  href?: string;
  hrefLabel?: string;
}) {
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  /** Anything past a couple of frames apart is visible in a comparison. */
  const DRIFT = 0.08;

  const toggle = useCallback(() => {
    const [x, y] = [a.current, b.current];
    if (!x || !y) return;
    if (playing) {
      x.pause();
      y.pause();
      return;
    }
    // Start from the same place, not from wherever each happened to stop.
    y.currentTime = x.currentTime;
    // No optimistic state: play() rejects on a blocked autoplay policy or an
    // unreachable file, and a button reading "Pause both" while nothing moves
    // is worse than one that simply did not change.
    void Promise.all([x.play(), y.play()]).catch(() => {});
  }, [playing]);

  const restart = useCallback(() => {
    const [x, y] = [a.current, b.current];
    if (!x || !y) return;
    x.currentTime = 0;
    y.currentTime = 0;
    void Promise.all([x.play(), y.play()]).catch(() => {});
  }, []);

  /*
   * The clay pass drives: the finished render follows its clock, and its own
   * play/pause events are what the button reads. Deriving the label from the
   * element rather than from an intent means a playback the browser refused
   * cannot leave the control claiming otherwise.
   */
  useEffect(() => {
    const [x, y] = [a.current, b.current];
    if (!x || !y) return;
    const sync = () => {
      if (!y.paused && Math.abs(y.currentTime - x.currentTime) > DRIFT) {
        y.currentTime = x.currentTime;
      }
    };
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    x.addEventListener("timeupdate", sync);
    x.addEventListener("play", on);
    x.addEventListener("pause", off);
    x.addEventListener("ended", off);
    return () => {
      x.removeEventListener("timeupdate", sync);
      x.removeEventListener("play", on);
      x.removeEventListener("pause", off);
      x.removeEventListener("ended", off);
    };
  }, []);

  /* Only one carries sound, so muting is a single decision for the pair. */
  useEffect(() => {
    if (b.current) b.current.muted = muted;
  }, [muted]);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Pane pane={left} innerRef={a} silent muted={muted} playing={playing} onToggle={toggle} />
        <Pane pane={right} innerRef={b} silent={false} muted={muted} playing={playing} onToggle={toggle} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button className="btn-primary" onClick={toggle}>
          {playing ? "Pause both" : "Play both →"}
        </button>
        {playing && (
          <button
            className="text-xs font-semibold text-muted hover:text-foreground"
            onClick={restart}
          >
            Restart
          </button>
        )}
        <button
          className="text-xs font-semibold text-muted hover:text-foreground"
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? "Unmute the render" : "Mute"}
        </button>
        {href && (
          <Link href={href} className="text-xs font-semibold text-accent hover:underline">
            {hrefLabel ?? "Read the shot →"}
          </Link>
        )}
      </div>

      {reduced && (
        <p className="mt-2 text-xs text-muted">
          Your system asks for reduced motion, so nothing plays until you press
          it.
        </p>
      )}
    </div>
  );
}
