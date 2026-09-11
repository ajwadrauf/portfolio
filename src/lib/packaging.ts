import type { PackAngle } from "./packshot";

export const BOX_FACES = ["front", "back", "left", "right", "top", "bottom"] as const;
export type BoxFace = (typeof BOX_FACES)[number];
export type BoxDimensions = { width: number; height: number; depth: number };
export type BoxFinish = "matte" | "satin";
export type BoxPanel = {
  dataUrl: string;
  name: string;
  rotation: 0 | 90 | 180 | 270;
  fit: "contain" | "cover";
  background: string;
};
export type BoxPanels = Partial<Record<BoxFace, BoxPanel>>;
export type BoxSettings = {
  dimensions: BoxDimensions;
  panels: BoxPanels;
  finish: BoxFinish;
  baseColor: string;
};

export const BOX_FACE_LABELS: Record<BoxFace, string> = {
  front: "Front", back: "Back", left: "Left", right: "Right", top: "Top", bottom: "Bottom",
};

export const DEFAULT_BOX_DIMENSIONS: BoxDimensions = { width: 190, height: 250, depth: 60 };

/** Three BoxGeometry material order: +X, −X, +Y, −Y, +Z, −Z. */
export const BOX_MATERIAL_FACES: readonly BoxFace[] = ["right", "left", "top", "bottom", "front", "back"];

type VectorTuple = readonly [number, number, number];
/** The printed image's right/up vectors when looking at each face from outside. */
export const BOX_FACE_AXES: Record<BoxFace, { normal: VectorTuple; right: VectorTuple; up: VectorTuple }> = {
  front: { normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  back: { normal: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
  left: { normal: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  right: { normal: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  top: { normal: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  bottom: { normal: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1] },
};

export function validBoxDimensions(dimensions: BoxDimensions): boolean {
  return [dimensions.width, dimensions.height, dimensions.depth].every((n) => Number.isFinite(n) && n > 0 && n <= 10_000);
}

export function faceDimensions(dimensions: BoxDimensions, face: BoxFace): { width: number; height: number } {
  if (face === "left" || face === "right") return { width: dimensions.depth, height: dimensions.height };
  if (face === "top" || face === "bottom") return { width: dimensions.width, height: dimensions.depth };
  return { width: dimensions.width, height: dimensions.height };
}

/** One scale factor preserves every measured proportion, irrespective of the unit size. */
export function normalizedBoxDimensions(dimensions: BoxDimensions): BoxDimensions {
  const valid = validBoxDimensions(dimensions) ? dimensions : DEFAULT_BOX_DIMENSIONS;
  const scale = 2 / Math.max(valid.width, valid.height, valid.depth);
  return { width: valid.width * scale, height: valid.height * scale, depth: valid.depth * scale };
}

/** A sphere encloses every corner at every rotation, giving all seven exports the same scale. */
export function boxFramingHalfExtent(dimensions: BoxDimensions): number {
  const d = normalizedBoxDimensions(dimensions);
  return Math.hypot(d.width, d.height, d.depth) * 0.5 * 1.14;
}

export function boxCameraPose(angle: PackAngle): { direction: VectorTuple; up: VectorTuple } {
  if (angle === "hero34") return { direction: [0.52, 0.32, 1], up: [0, 1, 0] };
  return { direction: BOX_FACE_AXES[angle].normal, up: BOX_FACE_AXES[angle].up };
}

export function mappedFaces(panels: BoxPanels): BoxFace[] {
  return BOX_FACES.filter((face) => Boolean(panels[face]?.dataUrl));
}

export function visibleFaces(angle: PackAngle): BoxFace[] {
  return angle === "hero34" ? ["front", "right", "top"] : [angle];
}

export function coverageForAngle(angle: PackAngle, panels: BoxPanels) {
  const visible = visibleFaces(angle);
  const mapped = visible.filter((face) => Boolean(panels[face]?.dataUrl));
  return { visible, mapped, blank: visible.filter((face) => !panels[face]?.dataUrl), complete: mapped.length === visible.length };
}

/** Canvas draw dimensions before rotation; positive rotations are clockwise. */
export function artworkPlacement(
  imageWidth: number, imageHeight: number, faceWidth: number, faceHeight: number,
  rotation: BoxPanel["rotation"], fit: BoxPanel["fit"],
) {
  const swapsAxes = rotation === 90 || rotation === 270;
  const rotatedWidth = swapsAxes ? imageHeight : imageWidth;
  const rotatedHeight = swapsAxes ? imageWidth : imageHeight;
  const ratios = [faceWidth / rotatedWidth, faceHeight / rotatedHeight];
  const scale = fit === "cover" ? Math.max(...ratios) : Math.min(...ratios);
  return { width: imageWidth * scale, height: imageHeight * scale, radians: rotation * Math.PI / 180 };
}

/** The manifest contains provenance/configuration, never large embedded artwork data. */
export function artworkManifest(settings: BoxSettings, angles: PackAngle[], size: number) {
  return {
    schemaVersion: 1,
    renderer: "measured-carton-v1",
    geometry: "rectangular-carton",
    dimensions: { ...settings.dimensions, unit: "mm" },
    finish: settings.finish,
    baseColor: settings.baseColor,
    output: { format: "image/png", width: size, height: size, background: "#ffffff" },
    panels: BOX_FACES.map((face) => {
      const panel = settings.panels[face];
      return panel ? { face, sourceName: panel.name, rotation: panel.rotation, fit: panel.fit, background: panel.background } : { face, sourceName: null, background: settings.baseColor };
    }),
    angles: angles.map((angle) => ({ angle, ...coverageForAngle(angle, settings.panels) })),
  };
}
