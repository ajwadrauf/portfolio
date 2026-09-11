"use client";

import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from "react";
import { WALL, WALL_BEATS } from "@/lib/theWall";

type Playback = { video: RefObject<HTMLVideoElement | null>; current: number | null; setCurrent: (time: number) => void; seek: (time: number) => void; pending: RefObject<number | null> };
const Context = createContext<Playback | null>(null);
function usePlayback() { const value = useContext(Context); if (!value) throw new Error("Wall playback needs its provider."); return value; }
export function WallPlayback({ children }: { children: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null), pending = useRef<number | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const seek = (time: number) => {
    const node = video.current; if (!node) return;
    node.pause(); pending.current = time;
    if (node.readyState >= 1) { node.currentTime = time; pending.current = null; }
    setCurrent(time);
    node.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    node.focus({ preventScroll: true });
  };
  return <Context.Provider value={{ video, current, setCurrent, seek, pending }}>{children}</Context.Provider>;
}
export function WallVideo() {
  const { video, setCurrent, pending } = usePlayback();
  return <video ref={video} src={WALL.clip} poster={WALL.poster} controls muted loop playsInline preload="metadata" tabIndex={0} className="block w-full" aria-label="The Wall: twelve-second Blender camera study" onLoadedMetadata={(e) => { if (pending.current !== null) { e.currentTarget.currentTime = pending.current; pending.current = null; } }} onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)} />;
}
export function WallBeatCards() {
  const { current, seek } = usePlayback();
  const boundaries = [0, 3, 6, 8.5, 12];
  return <div className="mt-8 space-y-4">
    {WALL_BEATS.map((beat, index) => {
      const selected = current !== null && current >= boundaries[index] && (current < boundaries[index + 1] || index === 3);
      return <button key={beat.range} type="button" aria-pressed={selected} aria-label={`Inspect ${beat.title} at ${boundaries[index]} seconds`} onClick={() => seek(boundaries[index])} className={`grid w-full gap-5 rounded-[6px] border p-4 text-left transition sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:p-5 ${selected ? "border-accent bg-accent/5" : "border-border-soft bg-surface hover:border-accent"}`}>
        <img src={beat.frame} alt="" loading="lazy" className="w-full rounded-[4px] border border-border-soft" />
        <div><p className="label-sm">{beat.range}</p><h3 className="mt-2 text-lg tracking-[-0.02em]">{beat.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{beat.body}</p><span className="mt-4 inline-flex min-h-6 items-center text-sm font-semibold text-accent">Inspect this moment ↑</span></div>
      </button>;
    })}
  </div>;
}
