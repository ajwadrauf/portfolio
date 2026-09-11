"use client";

import { useEffect, useRef, useState } from "react";
import { rehearsalDescription, rehearsalPose, type RehearsalMove } from "@/lib/cameraRehearsal";

type Options = { move: RehearsalMove; lens: number; duration: number; progress: number };

export function CameraRehearsal({ lens: initialLens, duration: initialDuration, move: initialMove, onApply }: { lens: string; duration: string; move: string; onApply: (settings: { move: RehearsalMove; lens: string; seconds: string; rig: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState<RehearsalMove>(["orbit", "push", "crane"].includes(initialMove) ? initialMove as RehearsalMove : "orbit");
  const [lens, setLens] = useState(Math.min(100, Math.max(24, Number(initialLens) || 50)));
  const [duration, setDuration] = useState(Math.min(30, Math.max(4, Number(initialDuration) || 12)));
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [applied, setApplied] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<{ draw: (options: Options) => void } | null>(null);
  const options = useRef<Options>({ move, lens, duration, progress });
  options.current = { move, lens, duration, progress };
  useEffect(() => {
    if (!open || !container.current) return;
    setError("");
    const host = container.current;
    let disposed = false;
    let cleanup = () => {};
    void import("three").then((THREE) => {
      if (disposed) return;
      let gl: InstanceType<typeof THREE.WebGLRenderer>;
      try { gl = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
      catch { setError("3D rehearsal is unavailable in this browser. The brief and all camera settings still work."); return; }
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      // setSize(..., false) keeps CSS sizing under our control. Without these,
      // the high-DPI backing pixels become CSS pixels and crop the path pane.
      gl.domElement.style.width = "100%";
      gl.domElement.style.height = "100%";
      gl.domElement.style.display = "block";
      gl.setClearColor(0x161419); host.appendChild(gl.domElement);
      const lost = (event: Event) => { event.preventDefault(); setReady(false); setPlaying(false); setError("The 3D context was interrupted. Close and reopen the rehearsal to retry; your brief is saved."); };
      gl.domElement.addEventListener("webglcontextlost", lost);
      gl.domElement.setAttribute("aria-label", "Live product camera view on the left, overhead camera path on the right");
      gl.domElement.setAttribute("role", "img");
      const scene = new THREE.Scene();
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: 0x252229, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const packageMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 0.65), new THREE.MeshStandardMaterial({ color: 0xb895ad, roughness: 0.7 }));
      packageMesh.position.y = 0.9; scene.add(packageMesh);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.65), new THREE.MeshBasicMaterial({ color: 0xe9decf }));
      stripe.position.set(0, 1.08, 0.326); scene.add(stripe);
      const grid = new THREE.GridHelper(20, 20, 0x5d5462, 0x302b35); grid.position.y = 0.003; scene.add(grid);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x343039, 2));
      const key = new THREE.DirectionalLight(0xffefd9, 3); key.position.set(-4, 7, 4); scene.add(key);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 40); camera.filmGauge = 36;
      const planCamera = new THREE.OrthographicCamera(-7, 7, 9, -9, 0.1, 40); planCamera.position.set(0, 18, 0); planCamera.up.set(0, 0, -1); planCamera.lookAt(0, 0, 1);
      const path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xecc78d })); scene.add(path);
      const marker = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 3), new THREE.MeshBasicMaterial({ color: 0xf7d89e })); scene.add(marker);
      let lastMove = "";
      const draw = (state: Options) => {
        if (disposed) return;
        const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
        gl.setSize(width, height, false); const left = Math.round(width * 0.68);
        camera.aspect = left / height; camera.setFocalLength(state.lens); camera.updateProjectionMatrix();
        const pose = rehearsalPose(state.move, state.progress); camera.position.set(...pose.position); camera.lookAt(...pose.target);
        marker.position.set(...pose.position); marker.position.y = 0.4; marker.rotation.set(Math.PI / 2, 0, -Math.atan2(pose.position[0], pose.position[2]));
        if (lastMove !== state.move) {
          path.geometry.dispose(); path.geometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, (_, i) => { const p = rehearsalPose(state.move, i / 60).position; return new THREE.Vector3(p[0], 0.08, p[2]); })); lastMove = state.move;
        }
        const planAspect = (width - left) / height; planCamera.left = -7; planCamera.right = 7; planCamera.top = 7 / planAspect; planCamera.bottom = -7 / planAspect; planCamera.updateProjectionMatrix();
        gl.setScissorTest(true); gl.setViewport(0, 0, left, height); gl.setScissor(0, 0, left, height); path.visible = false; marker.visible = false; gl.render(scene, camera);
        gl.setViewport(left, 0, width - left, height); gl.setScissor(left, 0, width - left, height); path.visible = true; marker.visible = true; gl.render(scene, planCamera); gl.setScissorTest(false);
      };
      renderer.current = { draw };
      const observer = new ResizeObserver(() => draw(options.current)); observer.observe(host); draw(options.current); setReady(true);
      cleanup = () => { observer.disconnect(); renderer.current = null; gl.domElement.removeEventListener("webglcontextlost", lost); scene.traverse((item) => { const mesh = item as InstanceType<typeof THREE.Mesh>; mesh.geometry?.dispose(); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose()); }); gl.dispose(); gl.domElement.remove(); };
    }).catch(() => setError("The 3D preview could not load. Your camera choices can still be added to the brief."));
    return () => { disposed = true; cleanup(); setReady(false); };
  }, [open]);
  useEffect(() => { renderer.current?.draw(options.current); }, [move, lens, duration, progress]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0; const started = performance.now() - options.current.progress * duration * 1000;
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / (duration * 1000));
      setProgress(next);
      if (next >= 1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, duration]);
  return <section className="mb-7 overflow-hidden rounded-[8px] border border-accent/25 bg-surface" aria-labelledby="camera-rehearsal-title">
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div><p className="label !text-accent">Try the camera before the render</p><h3 id="camera-rehearsal-title" className="mt-2 text-lg font-semibold">A small stage for a big decision</h3><p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">Explore one camera move around a proxy package. Apply the lens, duration and route to this brief. This is a composition study; existing multi-shot motion is not reconstructed here.</p></div>
      <button className="btn-secondary" aria-expanded={open} onClick={() => { setOpen(!open); setPlaying(false); }}>{open ? "Close rehearsal" : "Open live camera rehearsal"}</button>
    </div>
    {open && <>
      <div className="relative bg-[#161419] text-[#f3ece3]">
        <div ref={container} className="h-[260px] w-full overflow-hidden sm:h-[350px]" />
        <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 font-mono text-[10px]">CAMERA · {lens} MM</span><span className="pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-2 py-1 font-mono text-[10px]">PATH</span>
        {!ready && !error && <p className="absolute inset-0 flex items-center justify-center text-sm" role="status">Opening the local 3D stage…</p>}
        {error && <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm" role="status">{error}</p>}
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-muted">Move<select className="input mt-1" value={move} onChange={(e) => { setMove(e.target.value as RehearsalMove); setApplied(false); }}>{["orbit", "push", "crane"].map((id) => <option key={id} value={id}>{id === "orbit" ? "Orbit 90°" : id === "push" ? "Push in" : "Crane up"}</option>)}</select></label>
          <label className="text-xs text-muted">Lens · {lens} mm<input className="mt-3 block w-full accent-[var(--accent)]" type="range" min={24} max={100} value={lens} onChange={(e) => { setLens(Number(e.target.value)); setApplied(false); }} /></label>
          <label className="text-xs text-muted">Duration · {duration} s<input className="mt-3 block w-full accent-[var(--accent)]" type="range" min={4} max={30} value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setApplied(false); }} /></label></div>
        <div className="flex items-center gap-3"><button className="btn-secondary !px-3" disabled={!ready} onClick={() => { if (progress >= 1) setProgress(0); setPlaying(!playing); }}>{playing ? "Pause" : "Play move"}</button><input aria-label="Camera rehearsal time" type="range" min={0} max={1} step={0.001} value={progress} className="min-w-0 flex-1 accent-[var(--accent)]" onChange={(e) => { setPlaying(false); setProgress(Number(e.target.value)); }} /><output className="font-mono text-xs">{(progress * duration).toFixed(1)}s</output></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-relaxed text-muted">{rehearsalDescription(move)}<br />Local Three.js rehearsal · 36 mm sensor · no API calls.</p><button className="btn-primary" onClick={() => { onApply({ move, lens: String(lens), seconds: String(duration), rig: rehearsalDescription(move) }); setApplied(true); }}>Use camera settings in brief</button></div>
        {applied && <p className="text-xs text-success" role="status">Camera settings applied. Review the beat timing, then render and attach an updated motion clip. The previous clip assignment was cleared because its camera has not changed.</p>}
      </div>
    </>}
  </section>;
}
