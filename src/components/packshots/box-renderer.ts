import * as THREE from "three";
import type { PackAngle } from "@/lib/packshot";
import {
  artworkPlacement, BOX_MATERIAL_FACES, boxCameraPose, boxFramingHalfExtent,
  faceDimensions, normalizedBoxDimensions, pillowBagPoint,
  type BoxDimensions, type BoxFace, type BoxPanel, type BoxSettings, type PackageShape,
} from "@/lib/packaging";

export type BoxRenderer = {
  update(settings: BoxSettings): Promise<void>;
  setAngle(angle: PackAngle): void;
  orbit(horizontal: number, vertical: number): void;
  renderAngle(angle: PackAngle, size: number): Promise<string>;
  dispose(): void;
};

const noWebGL = "This browser could not start the 3D preview. Enable hardware acceleration or try another browser, then retry.";

/** Also used by offline checks; creating geometry does not require a browser or WebGL. */
export function createPackageGeometry(dimensions: BoxDimensions, shape: PackageShape = "carton"): THREE.BoxGeometry {
  const d = normalizedBoxDimensions(dimensions);
  // Keep the original carton topology, positions, UVs and normals exactly unchanged.
  if (shape !== "pillow-bag") return new THREE.BoxGeometry(d.width, d.height, d.depth);

  const geometry = new THREE.BoxGeometry(d.width, d.height, d.depth, 24, 64, 12);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const point = pillowBagPoint([positions.getX(index), positions.getY(index), positions.getZ(index)], d);
    positions.setXYZ(index, ...point);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  // BoxGeometry duplicates vertices at material boundaries. Smooth those shared body
  // normals without merging vertices: each panel retains its independent, original UVs.
  const normals = geometry.getAttribute("normal");
  const seams = new Map<string, { sum: THREE.Vector3; indices: number[] }>();
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    if (Math.abs(y) >= d.height * 0.499) continue; // Keep the sealing-band end caps crisp.
    const key = `${x.toPrecision(9)},${y.toPrecision(9)},${z.toPrecision(9)}`;
    const entry = seams.get(key) ?? { sum: new THREE.Vector3(), indices: [] };
    entry.sum.add(new THREE.Vector3().fromBufferAttribute(normals, index));
    entry.indices.push(index);
    seams.set(key, entry);
  }
  for (const { sum, indices } of seams.values()) {
    if (indices.length < 2) continue;
    sum.normalize();
    for (const index of indices) normals.setXYZ(index, sum.x, sum.y, sum.z);
  }
  normals.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Loaded only by BoxPreview's browser effect. No browser work happens at module scope. */
export function createBoxRenderer(container: HTMLElement, onError: (message: string) => void): BoxRenderer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch {
    throw new Error(noWebGL);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0xffffff, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 40);
  const studio = new THREE.Group();
  const ambient = new THREE.AmbientLight(0xffffff, 1.9);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 5, 5);
  const fill = new THREE.DirectionalLight(0xffffff, 0.65);
  fill.position.set(4, 1, 3);
  studio.add(key, fill);
  scene.add(ambient, studio);

  let mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial[]> | null = null;
  let disposed = false;
  let contextLost = false;
  let revision = 0;
  let halfExtent = 1.6;
  let currentSettings: BoxSettings | null = null;
  let pendingUpdate: Promise<void> = Promise.resolve();
  let yaw = Math.atan2(0.52, 1);
  let pitch = Math.atan2(0.32, Math.hypot(0.52, 1));
  let viewWidth = 1;
  let viewHeight = 1;
  const pendingImages = new Set<() => void>();

  function assertAvailable() {
    if (disposed) throw new Error("The preview has closed. Open the artwork preview and try again.");
    if (contextLost) throw new Error("The browser lost its graphics context. Retry the 3D preview before exporting.");
  }

  function frame(width: number, height: number) {
    const aspect = width / height;
    camera.left = -halfExtent * Math.max(aspect, 1);
    camera.right = -camera.left;
    camera.top = halfExtent / Math.min(aspect, 1);
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
  }

  function draw() {
    if (disposed || contextLost) return;
    // Keep the studio in the same relation to each export camera. The artwork remains fixed.
    studio.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
  }

  function setAngle(angle: PackAngle) {
    if (disposed) return;
    const pose = boxCameraPose(angle);
    camera.position.fromArray(pose.direction).normalize().multiplyScalar(8);
    camera.up.fromArray(pose.up);
    camera.lookAt(0, 0, 0);
    yaw = Math.atan2(camera.position.x, camera.position.z);
    pitch = Math.asin(camera.position.y / 8);
    draw();
  }

  function resize() {
    if (disposed) return;
    viewWidth = Math.max(1, Math.round(container.clientWidth));
    viewHeight = Math.max(1, Math.round(container.clientHeight));
    renderer.setSize(viewWidth, viewHeight, false);
    frame(viewWidth, viewHeight);
    draw();
  }

  function disposeMesh(target: typeof mesh) {
    if (!target) return;
    target.geometry.dispose();
    target.material.forEach((material) => { material.map?.dispose(); material.dispose(); });
  }

  function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    // Face images are prepared locally by the crop editor; external URLs could taint exports.
    if (!/^data:image\/(?:png|jpe?g|webp|avif);base64,/i.test(dataUrl)) {
      return Promise.reject(new Error("Artwork must be a prepared PNG, JPEG, WebP or AVIF image."));
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      const cancel = () => { image.onload = null; image.onerror = null; image.src = ""; reject(new Error("Artwork loading was cancelled.")); };
      pendingImages.add(cancel);
      image.onload = () => { pendingImages.delete(cancel); resolve(image); };
      image.onerror = () => { pendingImages.delete(cancel); reject(new Error("One artwork panel could not be decoded. Reassign that panel and retry.")); };
      image.src = dataUrl;
    });
  }

  async function panelTexture(panel: BoxPanel, face: BoxFace, settings: BoxSettings) {
    const image = await loadImage(panel.dataUrl);
    assertAvailable();
    const faceSize = faceDimensions(normalizedBoxDimensions(settings.dimensions), face);
    const longestEdge = Math.min(4096, renderer.capabilities.maxTextureSize);
    const pixelScale = longestEdge / Math.max(faceSize.width, faceSize.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(faceSize.width * pixelScale));
    canvas.height = Math.max(1, Math.round(faceSize.height * pixelScale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the artwork canvas.");
    context.fillStyle = panel.background || settings.baseColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const placement = artworkPlacement(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, panel.rotation, panel.fit);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(placement.radians);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, -placement.width / 2, -placement.height / 2, placement.width, placement.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // CanvasTexture's standard flipY pairs with BoxGeometry UVs: no mirrored text.
    return texture;
  }

  function update(settings: BoxSettings): Promise<void> {
    const updateRevision = ++revision;
    pendingUpdate = (async () => {
      assertAvailable();
      const materials = await Promise.allSettled(BOX_MATERIAL_FACES.map(async (face) => {
        const panel = settings.panels[face];
        const texture = panel ? await panelTexture(panel, face, settings) : null;
        return new THREE.MeshStandardMaterial({
          color: texture ? 0xffffff : settings.baseColor,
          map: texture,
          roughness: settings.finish === "matte" ? 1 : 0.48,
          metalness: 0,
        });
      }));
      const ready = materials.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const failure = materials.find((result) => result.status === "rejected");
      if (disposed || updateRevision !== revision || failure) {
        ready.forEach((material) => { material.map?.dispose(); material.dispose(); });
        if (failure?.status === "rejected") throw failure.reason;
        return;
      }
      const replacement = new THREE.Mesh(createPackageGeometry(settings.dimensions, settings.shape), ready);
      if (mesh) scene.remove(mesh);
      disposeMesh(mesh);
      mesh = replacement;
      scene.add(mesh);
      currentSettings = settings;
      halfExtent = boxFramingHalfExtent(settings.dimensions);
      frame(viewWidth, viewHeight);
      draw();
    })();
    return pendingUpdate;
  }

  const lost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    onError("The browser lost its graphics context. Retry the 3D preview to continue.");
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  setAngle("hero34");
  resize();

  return {
    update,
    setAngle,
    orbit(horizontal, vertical) {
      if (disposed || contextLost) return;
      yaw += horizontal;
      pitch = Math.max(-Math.PI / 2 + 0.015, Math.min(Math.PI / 2 - 0.015, pitch + vertical));
      camera.position.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(8);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      draw();
    },
    async renderAngle(angle, size) {
      // If an input update supersedes another while decoding, wait for the latest complete one.
      let awaited: Promise<void>;
      do { awaited = pendingUpdate; await awaited; } while (awaited !== pendingUpdate);
      assertAvailable();
      if (!mesh || !currentSettings) throw new Error("The artwork preview is still preparing. Try again in a moment.");
      const gl = renderer.getContext();
      const limit = Math.min(renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
      if (![1024, 2048, 4096].includes(size) || size > limit) throw new Error(`This browser cannot export ${size}px. Select a smaller output size.`);
      const oldPosition = camera.position.clone();
      const oldUp = camera.up.clone();
      const oldYaw = yaw;
      const oldPitch = pitch;
      const pixelRatio = renderer.getPixelRatio();
      try {
        renderer.setPixelRatio(1);
        renderer.setSize(size, size, false);
        frame(size, size);
        setAngle(angle);
        const dataUrl = renderer.domElement.toDataURL("image/png");
        if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("The browser could not encode this export. Try a smaller output size.");
        return dataUrl;
      } finally {
        camera.position.copy(oldPosition);
        camera.up.copy(oldUp);
        camera.lookAt(0, 0, 0);
        yaw = oldYaw;
        pitch = oldPitch;
        renderer.setPixelRatio(pixelRatio);
        resize();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      revision += 1;
      observer.disconnect();
      pendingImages.forEach((cancel) => cancel());
      pendingImages.clear();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposeMesh(mesh);
      mesh = null;
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
