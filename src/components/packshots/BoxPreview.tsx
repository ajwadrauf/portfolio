"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { PackAngle } from "@/lib/packshot";
import type { BoxSettings } from "@/lib/packaging";
import type { BoxRenderer } from "./box-renderer";
import styles from "./BoxPreview.module.css";

export type BoxPreviewHandle = { renderAngle(angle: PackAngle, size: number): Promise<string> };
export type BoxPreviewProps = BoxSettings;

const views: { angle: PackAngle; label: string }[] = [
  { angle: "hero34", label: "3/4" }, { angle: "front", label: "Front" },
  { angle: "back", label: "Back" }, { angle: "left", label: "Left" },
  { angle: "right", label: "Right" }, { angle: "top", label: "Top" }, { angle: "bottom", label: "Bottom" },
];

export const BoxPreview = forwardRef<BoxPreviewHandle, BoxPreviewProps>(function BoxPreview(settings, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BoxRenderer | null>(null);
  const bootRef = useRef<Promise<BoxRenderer | null> | null>(null);
  const settingsRef = useRef(settings);
  const revision = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<PackAngle | "custom">("hero34");

  useImperativeHandle(ref, () => ({
    async renderAngle(angle, size) {
      const engine = engineRef.current ?? await bootRef.current;
      if (!engine) throw new Error("The 3D preview is unavailable. Retry the preview before exporting.");
      return engine.renderAngle(angle, size);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    let localEngine: BoxRenderer | null = null;
    const container = containerRef.current;
    if (!container) return;
    setStatus("loading");
    setError("");
    setView("hero34");
    bootRef.current = import("./box-renderer").then(async ({ createBoxRenderer }) => {
      if (cancelled) return null;
      const engine = createBoxRenderer(container, (message) => {
        if (!cancelled) { setError(message); setStatus("error"); }
      });
      localEngine = engine;
      engineRef.current = engine;
      const updateRevision = ++revision.current;
      await engine.update(settingsRef.current);
      if (!cancelled && updateRevision === revision.current) setStatus("ready");
      return engine;
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "The 3D preview could not load. Please retry.");
        setStatus("error");
      }
      return null;
    });
    return () => {
      cancelled = true;
      revision.current += 1;
      localEngine?.dispose();
      if (engineRef.current === localEngine) engineRef.current = null;
    };
  }, [retry]);

  useEffect(() => {
    settingsRef.current = settings;
    const engine = engineRef.current;
    if (!engine) return;
    const updateRevision = ++revision.current;
    setStatus("loading");
    setError("");
    engine.update(settings).then(() => {
      if (updateRevision === revision.current) setStatus("ready");
    }).catch((reason: unknown) => {
      if (updateRevision !== revision.current) return;
      setError(reason instanceof Error ? reason.message : "An artwork panel could not load.");
      setStatus("error");
    });
  }, [settings.dimensions, settings.panels, settings.finish, settings.baseColor]);

  function orbit(horizontal: number, vertical: number) {
    if (status !== "ready") return;
    engineRef.current?.orbit(horizontal, vertical);
    setView("custom");
  }

  function selectView(angle: PackAngle) {
    engineRef.current?.setAngle(angle);
    setView(angle);
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || status !== "ready") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = drag.current;
    if (!previous || previous.id !== event.pointerId) return;
    orbit(-(event.clientX - previous.x) * 0.008, (event.clientY - previous.y) * 0.008);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  return (
    <div className={styles.preview}>
      <div className={styles.viewport}>
        <div
          ref={containerRef}
          className={styles.canvas}
          role="group"
          aria-label="Interactive measured carton preview. Use arrow keys to rotate."
          tabIndex={status === "ready" ? 0 : -1}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={(event) => {
            const movement: Record<string, [number, number]> = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] };
            if (movement[event.key]) { event.preventDefault(); orbit(...movement[event.key]); }
            if (event.key === "Home") { event.preventDefault(); selectView("hero34"); }
          }}
        />
        {status !== "ready" && <div className={styles.overlay} role={status === "error" ? "alert" : "status"}>
          {status === "loading" ? "Preparing artwork preview…" : <><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry 3D preview</button></>}
        </div>}
        <span className={styles.badge}>Measured carton · artwork mapped directly</span>
      </div>
      <div className={styles.views} aria-label="Preview angle">
        {views.map(({ angle, label }) => <button key={angle} type="button" aria-pressed={view === angle} disabled={status !== "ready"} onClick={() => selectView(angle)}>{label}</button>)}
      </div>
      <div className={styles.controls}>
        <span>Drag to rotate</span>
        <div>
          <button type="button" aria-label="Rotate left" disabled={status !== "ready"} onClick={() => orbit(-0.2, 0)}>←</button>
          <button type="button" aria-label="Rotate right" disabled={status !== "ready"} onClick={() => orbit(0.2, 0)}>→</button>
          <button type="button" aria-label="Tilt up" disabled={status !== "ready"} onClick={() => orbit(0, 0.15)}>↑</button>
          <button type="button" aria-label="Tilt down" disabled={status !== "ready"} onClick={() => orbit(0, -0.15)}>↓</button>
          <button type="button" disabled={status !== "ready"} onClick={() => selectView("hero34")}>Reset</button>
        </div>
      </div>
    </div>
  );
});

export default BoxPreview;
