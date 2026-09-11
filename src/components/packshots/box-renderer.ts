import * as THREE from "three";
import type { PackAngle } from "@/lib/packshot";
import {
  artworkPlacement, BOX_MATERIAL_FACES, boxCameraPose, boxFramingHalfExtent,
  faceDimensions, normalizedBoxDimensions, pillowBagPoint,
  type BoxDimensions, type BoxFace, type BoxPanel, type BoxSettings, type PackageShape,
} from "@/lib/packaging";
import {
  createPreviewGuidePlan, type GuidePoint, type PreviewGuideInfo, type PreviewGuideOptions,
} from "@/lib/previewGuides";

export type BoxRenderer = {
  update(settings: BoxSettings): Promise<void>;
  setAngle(angle: PackAngle): void;
  setGuides(options: PreviewGuideOptions): void;
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
export function createBoxRenderer(container: HTMLElement, onError: (message: string) => void, onGuideInfo?: (info: PreviewGuideInfo) => void): BoxRenderer {
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
  // A separate canvas keeps rulers and grid completely outside the WebGL export path.
  const guideCanvas = document.createElement("canvas");
  guideCanvas.setAttribute("aria-hidden", "true");
  guideCanvas.setAttribute("data-preview-guides", "true");
  Object.assign(guideCanvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
  container.appendChild(guideCanvas);
  const guideContext = guideCanvas.getContext("2d");

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
  let guides: PreviewGuideOptions = { measurements: false, grid: false, unit: "mm" };
  let exporting = false;
  let guideInfoKey = "";
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
    if (!exporting) drawGuides();
  }

  function reportGuideInfo(info: PreviewGuideInfo) {
    const key = `${info.gridLabel}\n${info.scaleLabel}`;
    if (key !== guideInfoKey) { guideInfoKey = key; onGuideInfo?.(info); }
  }

  function drawGuides() {
    if (!guideContext || disposed || exporting) return;
    const context = guideContext;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(viewWidth * ratio)), pixelHeight = Math.max(1, Math.round(viewHeight * ratio));
    if (guideCanvas.width !== pixelWidth || guideCanvas.height !== pixelHeight) { guideCanvas.width = pixelWidth; guideCanvas.height = pixelHeight; }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, viewWidth, viewHeight);
    if ((!guides.measurements && !guides.grid) || !mesh || !currentSettings || contextLost) { reportGuideInfo({ gridLabel: "", scaleLabel: "" }); return; }
    camera.updateMatrixWorld();
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox!;
    context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    const plan = createPreviewGuidePlan({
      dimensions: currentSettings.dimensions, unit: guides.unit, width: viewWidth, height: viewHeight,
      worldWidth: camera.right - camera.left, worldHeight: camera.top - camera.bottom,
      cameraDirection: camera.position.toArray() as [number, number, number],
      bounds: { min: bounds.min.toArray() as [number, number, number], max: bounds.max.toArray() as [number, number, number] },
      measureText: (label) => context.measureText(label).width,
      project: (point) => {
        const projected = new THREE.Vector3(...point).project(camera);
        return { x: (projected.x + 1) * viewWidth / 2, y: (1 - projected.y) * viewHeight / 2 };
      },
    });
    if (!plan) { reportGuideInfo({ gridLabel: "", scaleLabel: "" }); return; }
    reportGuideInfo(plan);
    const line = (a: GuidePoint, b: GuidePoint) => { context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); };
    if (guides.grid) {
      context.save();
      // Clip to the area outside the package's projected bounding hull. The grid cannot tint artwork.
      context.beginPath();
      context.rect(0, 0, viewWidth, viewHeight);
      context.moveTo(plan.hull[0].x, plan.hull[0].y);
      plan.hull.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.closePath();
      context.clip("evenodd");
      context.lineWidth = 1;
      context.strokeStyle = "rgba(116, 98, 111, .13)";
      context.beginPath();
      const xStart = plan.origin.x - Math.ceil(plan.origin.x / plan.grid.pixelsX) * plan.grid.pixelsX;
      const yStart = plan.origin.y - Math.ceil(plan.origin.y / plan.grid.pixelsY) * plan.grid.pixelsY;
      for (let x = xStart; x <= viewWidth; x += plan.grid.pixelsX) line({ x, y: 0 }, { x, y: viewHeight });
      for (let y = yStart; y <= viewHeight; y += plan.grid.pixelsY) line({ x: 0, y }, { x: viewWidth, y });
      context.stroke();
      context.strokeStyle = "rgba(116, 98, 111, .22)";
      context.setLineDash([3, 4]);
      context.beginPath();
      line({ x: plan.origin.x, y: 0 }, { x: plan.origin.x, y: viewHeight });
      line({ x: 0, y: plan.origin.y }, { x: viewWidth, y: plan.origin.y });
      context.stroke();
      context.restore();
    }
    if (guides.measurements) for (const guide of plan.dimensions) {
      context.save();
      context.lineWidth = 1;
      context.strokeStyle = "rgba(119, 78, 101, .65)";
      context.setLineDash([2, 3]);
      context.beginPath();
      guide.source.forEach((point, index) => line({ x: point.x + guide.normal.x * 3, y: point.y + guide.normal.y * 3 }, {
        x: guide.line[index].x + guide.normal.x * 4, y: guide.line[index].y + guide.normal.y * 4,
      }));
      context.stroke();
      context.setLineDash([]);
      context.strokeStyle = "#825069";
      context.beginPath();
      line(guide.line[0], guide.line[1]);
      guide.line.forEach((point) => line({ x: point.x - guide.normal.x * 3.5, y: point.y - guide.normal.y * 3.5 }, { x: point.x + guide.normal.x * 3.5, y: point.y + guide.normal.y * 3.5 }));
      context.stroke();
      context.translate(guide.labelCenter.x, guide.labelCenter.y);
      context.rotate(guide.labelAngle);
      const textWidth = context.measureText(guide.label).width;
      context.fillStyle = "rgba(255, 255, 255, .95)";
      context.fillRect(-textWidth / 2 - 4, -9, textWidth + 8, 18);
      context.fillStyle = "#704059";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(guide.label, 0, 0);
      context.restore();
    }
    // The scale is calibrated to camera-plane millimetres, not a claim of life-size screen display.
    const scale = plan.scale;
    context.fillStyle = "rgba(255, 255, 255, .94)";
    context.fillRect(scale.rect.x, scale.rect.y, scale.rect.width, scale.rect.height);
    context.fillStyle = "#75616e";
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText(scale.label, scale.x, scale.rect.y + 3);
    context.strokeStyle = "#825069";
    context.lineWidth = 1.3;
    context.beginPath();
    line({ x: scale.x, y: scale.y }, { x: scale.x + scale.pixels, y: scale.y });
    for (const x of [scale.x, scale.x + scale.pixels / 2, scale.x + scale.pixels]) line({ x, y: scale.y - 3 }, { x, y: scale.y + 3 });
    context.stroke();
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
    drawGuides();
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
    setGuides(options) {
      if (disposed) return;
      guides = { measurements: Boolean(options.measurements), grid: Boolean(options.grid), unit: options.unit === "in" ? "in" : "mm" };
      drawGuides();
    },
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
        exporting = true;
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
        exporting = false;
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
      guideCanvas.remove();
      guideCanvas.width = 1;
      guideCanvas.height = 1;
    },
  };
}
