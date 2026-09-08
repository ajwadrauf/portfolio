"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TokenScene } from "./tokenScene";

/**
 * The hero's right-hand panel: 800 tokens that drift as a ribbon and assemble
 * into the wordmark on request.
 *
 * Everything expensive is deferred. three and the coordinate table arrive
 * through a dynamic import inside the effect, so the server-rendered headline
 * on the other side of the hero is never waiting on a 3D bundle, and a visitor
 * who never reaches this panel never pays for it.
 *
 * Every failure path lands somewhere readable rather than on an empty box: no
 * JavaScript, a failed import, a refused WebGL context and a lost context all
 * leave the drawn AJWAD RAUF fallback in place with a line of copy that says
 * what happened.
 */

/** Kept out of the component so the two live states read as one decision. */
const LIVE_STATUS = {
  explore: "Drag to explore · real-time 3D",
  assembled: "800 tokens · one signature",
} as const;

/** Shown whenever the scene is not running, including before it starts. */
const STATIC_STATUS = "800 tokens · TOKEN motion study";

export function TokenSculpture() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TokenScene | null>(null);
  const [ready, setReady] = useState(false);
  const [assembled, setAssembled] = useState(false);
  const [status, setStatus] = useState<string>(STATIC_STATUS);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Survives StrictMode's double effect and a fast unmount: if the import
    // resolves after teardown, the scene it built is disposed immediately
    // rather than left holding a GL context nothing points at.
    let cancelled = false;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      let createTokenScene: typeof import("./tokenScene").createTokenScene;
      try {
        ({ createTokenScene } = await import("./tokenScene"));
      } catch {
        // The page is still complete without it; say so and stop.
        return;
      }
      if (cancelled) return;

      const scene = createTokenScene(canvas, {
        reducedMotion,
        onReady: () => {
          if (cancelled) return;
          setReady(true);
          setStatus(LIVE_STATUS.explore);
        },
        onContextLost: () => {
          if (cancelled) return;
          setStatus("3D paused · watch the film below");
        },
      });
      if (!scene) return;
      if (cancelled) {
        scene.dispose();
        return;
      }
      sceneRef.current = scene;
    })();

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    setAssembled((was) => {
      const next = !was;
      scene.setAssembled(next);
      setStatus(next ? LIVE_STATUS.assembled : LIVE_STATUS.explore);
      return next;
    });
  }, []);

  return (
    <div className={`ar-sculpture${ready ? " is-ready" : ""}`}>
      <div className="ar-sculpture-top">
        <span className="ar-eyebrow">An idea, taking shape</span>
        <span className="ar-coordinate">800 tokens</span>
      </div>
      <div className="ar-canvas-wrap">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="A sculpture of 800 three-dimensional tokens. Drag to rotate, or use the Assemble button to form Ajwad Rauf’s name."
        />
        <div className="ar-sculpture-fallback" aria-hidden>
          <span>
            AJWAD
            <br />
            RAUF
          </span>
        </div>
      </div>
      <div className="ar-sculpture-bottom">
        <span className="ar-micro" aria-live="polite">
          {status}
        </span>
        {/*
          Only rendered once a frame is actually on screen. A button that
          promises to assemble a sculpture that never loaded is worse than no
          button, and the server HTML has no way to know which it will be.
        */}
        {ready && (
          <button className="ar-assemble" type="button" aria-pressed={assembled} onClick={toggle}>
            {assembled ? "Explore again" : "Assemble"}{" "}
            <span aria-hidden>{assembled ? "↻" : "↗"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
