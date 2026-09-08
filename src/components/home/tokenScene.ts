import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from "three";
import { TOKEN_WORDMARK } from "./tokenWordmark";

/**
 * The hero sculpture: 800 instanced tokens that hold a drifting ribbon and,
 * on request, resolve into the wordmark.
 *
 * Kept out of React entirely. Nothing here is state a component should own —
 * it is a render loop, a WebGL context and four listeners — and putting it
 * behind a plain imperative handle means the page can re-render for its own
 * reasons without ever touching the scene. The component tells it when the
 * button was pressed; it tells the component when it has something on screen.
 *
 * Imported dynamically by TokenSculpture, so three never lands in the bundle
 * that serves the headline.
 */

/** One instanced token's position and orientation, in either arrangement. */
type Placement = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};

export type TokenScene = {
  /** true assembles the wordmark, false returns to the ribbon. */
  setAssembled: (assembled: boolean) => void;
  /** Cancels the frame, drops the listeners and frees the GPU allocations. */
  dispose: () => void;
};

export type TokenSceneOptions = {
  /** Skips the opening drift and snaps the morph, rather than animating it. */
  reducedMotion: boolean;
  /** Fired once the first frame is on screen, so the fallback can be dropped. */
  onReady: () => void;
  /** Fired if the driver takes the context away mid-session. */
  onContextLost: () => void;
};

const TOKEN_COUNT = 800;
/** Roughly a 1.65× cap: past this the fill cost stops buying visible detail. */
const MAX_PIXEL_RATIO = 1.65;
/** How long the sculpture keeps turning on its own before settling, in ms. */
const OPENING_DRIFT_MS = 4500;

/**
 * A small equirectangular painting used only as a reflection source: two bright
 * panels and one dark flag. The tokens are near-mirror metal, so what gives
 * them their shape is entirely what they reflect — a plain colour environment
 * renders 800 flat grey crumbs.
 */
function studioEnvironment(renderer: WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#73736e";
  context.fillRect(0, 0, 512, 256);
  context.fillStyle = "#f7f3ec";
  context.fillRect(40, 22, 85, 200);
  context.fillRect(280, 0, 140, 70);
  context.fillStyle = "#222725";
  context.fillRect(210, 80, 36, 176);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();
  return target;
}

/** The two arrangements every token lerps between, built once at startup. */
function buildPlacements() {
  const ribbon: Placement[] = [];
  const word: Placement[] = [];

  const xs = TOKEN_WORDMARK.map((p) => p[0]);
  const ys = TOKEN_WORDMARK.map((p) => p[1]);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Normalise whatever Blender exported to a fixed 4.2 units across, so a
  // re-export at a different scale still lands in frame.
  const scale = 4.2 / (Math.max(...xs) - Math.min(...xs));

  for (let i = 0; i < TOKEN_COUNT; i++) {
    const ring = Math.floor(i / 32);
    const j = i % 32;
    const a = (j / 32) * Math.PI * 2 + ring * 0.045;
    const t = (ring / 24 - 0.5) * Math.PI * 1.8;
    // A folded, open ribbon rather than a closed torus — a ring reads as a
    // loading spinner, which is the one thing this must not look like.
    const radius = 1.08 + 0.16 * Math.cos(t * 2);
    const x = Math.cos(a) * radius;
    const y = (ring - 12) * 0.069;
    const z = Math.sin(a) * radius;
    ribbon.push({
      x: x * Math.cos(t * 0.32) - y * Math.sin(t * 0.32),
      y: x * Math.sin(t * 0.32) + y * Math.cos(t * 0.32),
      z: z * 0.7,
      rx: t * 0.38,
      ry: -a,
      rz: t * 0.32,
    });

    const p = TOKEN_WORDMARK[i];
    word.push({
      x: (p[0] - centerX) * scale,
      y: (p[1] - centerY) * scale,
      // A hair of depth so the assembled face is not a single flat plane.
      z: ((i % 3) - 1) * 0.008,
      rx: 0,
      ry: 0,
      rz: 0,
    });
  }

  return { ribbon, word };
}

export function createTokenScene(
  canvas: HTMLCanvasElement,
  { reducedMotion, onReady, onContextLost }: TokenSceneOptions,
): TokenScene | null {
  const stage = canvas.parentElement;
  if (!stage) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 0, 6.6);
  const group = new Group();
  scene.add(group);

  scene.add(new HemisphereLight(0xfff8ec, 0x40463f, 3.1));
  const keyLights: [number, number, [number, number, number]][] = [
    [0xfff3e5, 5, [3, 4, 5]],
    [0xffffff, 4, [-4, 2, 1]],
    [0xbda9c7, 3, [2, -1, -3]],
  ];
  for (const [color, power, position] of keyLights) {
    const light = new DirectionalLight(color, power);
    light.position.set(...position);
    scene.add(light);
  }

  const environment = studioEnvironment(renderer);
  if (environment) scene.environment = environment.texture;

  const geometry = new BoxGeometry(0.105, 0.052, 0.074);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.82,
    roughness: 0.24,
  });
  const tokens = new InstancedMesh(geometry, material, TOKEN_COUNT);
  tokens.instanceMatrix.setUsage(DynamicDrawUsage);
  // Every token moves every frame, so a bounding sphere computed once is a
  // lie; culling the whole mesh against it drops the sculpture at some angles.
  tokens.frustumCulled = false;
  group.add(tokens);

  const { ribbon, word } = buildPlacements();
  // Mostly olive, a scattering of gold, a few in the accent plum — enough that
  // the mass has some life in it without turning into confetti.
  const tint = new Color();
  for (let i = 0; i < TOKEN_COUNT; i++) {
    tokens.setColorAt(i, tint.setHex(i % 97 < 8 ? 0x754364 : i % 41 < 4 ? 0xa0814f : 0x596352));
  }
  if (tokens.instanceColor) tokens.instanceColor.needsUpdate = true;

  const dummy = new Object3D();
  const { lerp, clamp } = MathUtils;

  let progress = 0;
  let targetProgress = 0;
  let assembled = false;
  let visible = true;
  let alive = true;
  let ready = false;
  let frame = 0;
  let previousTime = 0;
  let driftStart = performance.now();

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let rx = -0.38;
  let ry = -0.46;
  let wantRx = -0.38;
  let wantRy = -0.46;

  function draw(now: number) {
    frame = 0;
    if (!alive) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - previousTime) / 1000));
    previousTime = now;

    progress = reducedMotion ? targetProgress : lerp(progress, targetProgress, 1 - Math.exp(-dt * 5));
    if (Math.abs(progress - targetProgress) < 0.0005) progress = targetProgress;
    // Smoothstep, so the morph starts and lands softly instead of snapping.
    const ease = progress * progress * (3 - 2 * progress);

    rx = lerp(rx, wantRx, 1 - Math.exp(-dt * 8));
    ry = lerp(ry, wantRy, 1 - Math.exp(-dt * 8));
    const drifting = !reducedMotion && !assembled && now - driftStart < OPENING_DRIFT_MS;
    // The whole group untilts as it assembles: the wordmark has to be read
    // straight on, so its rotation is driven to zero by the same ease.
    group.rotation.set(rx * (1 - ease), ry * (1 - ease), -0.27 * (1 - ease));
    if (drifting && !dragging) {
      group.rotation.y += Math.sin(((now - driftStart) / OPENING_DRIFT_MS) * Math.PI) * 0.12;
    }

    for (let i = 0; i < TOKEN_COUNT; i++) {
      const a = ribbon[i];
      const b = word[i];
      dummy.position.set(
        lerp(a.x, b.x, ease),
        lerp(a.y, b.y, ease),
        lerp(a.z, b.z, ease),
      );
      dummy.rotation.set(a.rx * (1 - ease), a.ry * (1 - ease), a.rz * (1 - ease));
      dummy.scale.setScalar(lerp(1, 0.36, ease));
      dummy.updateMatrix();
      tokens.setMatrixAt(i, dummy.matrix);
    }
    tokens.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      onReady();
    }

    /*
     * Idle means stopped, not a slow loop.
     *
     * Nothing on this page animates on its own after the opening settles, so
     * holding a requestAnimationFrame open would spend a phone's battery
     * re-rendering an identical image. The loop re-arms itself only while
     * something is actually in motion; every other path back in goes through
     * requestDraw.
     */
    const moving =
      progress !== targetProgress ||
      Math.abs(rx - wantRx) > 0.0001 ||
      Math.abs(ry - wantRy) > 0.0001 ||
      drifting;
    if (moving) requestDraw();
  }

  function requestDraw() {
    if (frame || !alive || !visible || document.hidden) return;
    frame = requestAnimationFrame(draw);
  }

  const resize = () => {
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
    requestDraw();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (assembled) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    // A deliberate touch ends the opening drift — two things moving the
    // sculpture at once feels like a fight with it.
    driftStart = -Infinity;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    wantRy += (e.clientX - lastX) * 0.009;
    wantRx = clamp(wantRx + (e.clientY - lastY) * 0.008, -1.5, 1.5);
    lastX = e.clientX;
    lastY = e.clientY;
    requestDraw();
  };
  const endDrag = () => {
    dragging = false;
  };
  const onVisibility = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else {
      requestDraw();
    }
  };
  const onLost = (e: Event) => {
    // Preventing the default is what makes a restore possible at all.
    e.preventDefault();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    onContextLost();
  };
  const onRestored = () => {
    previousTime = performance.now();
    requestDraw();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  document.addEventListener("visibilitychange", onVisibility);

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  resizeObserver?.observe(stage);
  if (!resizeObserver) window.addEventListener("resize", resize);

  const intersectionObserver =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          (entries) => {
            visible = entries[0].isIntersecting;
            if (visible) {
              previousTime = performance.now();
              requestDraw();
            } else if (frame) {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          },
          { threshold: 0 },
        );
  intersectionObserver?.observe(canvas);

  previousTime = performance.now();
  resize();
  requestDraw();

  return {
    setAssembled(next: boolean) {
      assembled = next;
      targetProgress = next ? 1 : 0;
      driftStart = -Infinity;
      requestDraw();
    },
    dispose() {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("lostpointercapture", endDrag);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      intersectionObserver?.disconnect();
      geometry.dispose();
      material.dispose();
      tokens.dispose();
      environment?.dispose();
      scene.environment = null;
      // Frees the GL context rather than waiting for the tab to reclaim it —
      // browsers cap live contexts, and a few client navigations back and
      // forth would otherwise exhaust them.
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
