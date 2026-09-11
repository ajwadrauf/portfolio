import { normalizedBoxDimensions, validBoxDimensions, type BoxDimensions } from "./packaging";

export type PreviewGuideOptions = { measurements: boolean; grid: boolean; unit: "mm" | "in" };
export type PreviewGuideInfo = { gridLabel: string; scaleLabel: string };
export type GuidePoint = { x: number; y: number };
type Point3 = readonly [number, number, number];
export type GuideRect = { x: number; y: number; width: number; height: number };
export type DimensionGuide = {
  axis: "width" | "height" | "depth";
  label: string;
  source: [GuidePoint, GuidePoint];
  line: [GuidePoint, GuidePoint];
  normal: GuidePoint;
  labelCenter: GuidePoint;
  labelAngle: number;
  labelRect: GuideRect;
};
export type PreviewGuidePlan = PreviewGuideInfo & {
  hull: GuidePoint[];
  origin: GuidePoint;
  grid: { millimetres: number; pixelsX: number; pixelsY: number };
  scale: { millimetres: number; pixels: number; x: number; y: number; label: string; rect: GuideRect };
  dimensions: DimensionGuide[];
};
type GuideInput = {
  dimensions: BoxDimensions;
  unit: "mm" | "in";
  width: number;
  height: number;
  worldWidth: number;
  worldHeight: number;
  cameraDirection: Point3;
  project: (point: Point3) => GuidePoint;
  /** Actual geometry bounds, in normalized world units. Defaults to the measured external box. */
  bounds?: { min: Point3; max: Point3 };
  measureText?: (label: string) => number;
};

/** Significant digits preserve very small positive dimensions instead of displaying a false zero. */
export function formatGuideMeasurement(valueMm: number, unit: "mm" | "in"): string {
  if (!Number.isFinite(valueMm) || valueMm <= 0) return "—";
  const value = unit === "in" ? valueMm / 25.4 : valueMm;
  return `${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 5 }).format(value)} ${unit}`;
}

/** Grid values use the familiar 1, 2, 5 series in the currently selected physical unit. */
export function niceGuideStep(value: number, rounding: "ceil" | "floor" = "ceil"): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const scaled = value / exponent;
  const series = rounding === "ceil" ? [1, 2, 5, 10] : [10, 5, 2, 1];
  return (series.find((candidate) => rounding === "ceil" ? candidate >= scaled - 1e-10 : candidate <= scaled + 1e-10) ?? 1) * exponent;
}

function cross(a: GuidePoint, b: GuidePoint, c: GuidePoint) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
export function guideHull(points: readonly GuidePoint[]): GuidePoint[] {
  const sorted = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).map((point) => ({ ...point })).sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 2) return sorted;
  const lower: GuidePoint[] = [], upper: GuidePoint[] = [];
  for (const point of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-7) lower.pop(); lower.push(point); }
  for (const point of sorted.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-7) upper.pop(); upper.push(point); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function guideRectsOverlap(a: GuideRect, b: GuideRect, gap = 4): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/** Pure camera/measurement math; it never changes the camera or export geometry. */
export function createPreviewGuidePlan(input: GuideInput): PreviewGuidePlan | null {
  const { dimensions, unit, width, height, worldWidth, worldHeight, cameraDirection, project } = input;
  if (!validBoxDimensions(dimensions) || ![width, height, worldWidth, worldHeight].every((value) => Number.isFinite(value) && value > 0) ||
      !cameraDirection.every(Number.isFinite) || width < 120 || height < 120) return null;
  const d = normalizedBoxDimensions(dimensions);
  const bounds = input.bounds ?? { min: [-d.width / 2, -d.height / 2, -d.depth / 2], max: [d.width / 2, d.height / 2, d.depth / 2] };
  if (![...bounds.min, ...bounds.max].every(Number.isFinite) || bounds.min.some((value, axis) => value >= bounds.max[axis])) return null;
  const corners: Point3[] = Array.from({ length: 8 }, (_, index) => [
    index & 1 ? bounds.max[0] : bounds.min[0], index & 2 ? bounds.max[1] : bounds.min[1], index & 4 ? bounds.max[2] : bounds.min[2],
  ]);
  const points = corners.map(project);
  if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
  const hull = guideHull(points);
  if (hull.length < 3) return null;
  const origin = project([0, 0, 0]);
  const worldPerMm = 2 / Math.max(dimensions.width, dimensions.height, dimensions.depth);
  const pixelsPerMmX = worldPerMm * width / worldWidth;
  const pixelsPerMmY = worldPerMm * height / worldHeight;
  const mmPerUnit = unit === "in" ? 25.4 : 1;
  const gridMm = niceGuideStep(44 / Math.min(pixelsPerMmX, pixelsPerMmY) / mmPerUnit) * mmPerUnit;
  const scaleMm = niceGuideStep(Math.min(96, width * .25) / pixelsPerMmX / mmPerUnit, "floor") * mmPerUnit;
  if (![gridMm, scaleMm].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scalePixels = scaleMm * pixelsPerMmX;
  const scaleLabel = formatGuideMeasurement(scaleMm, unit);
  const textWidth = input.measureText ?? ((label: string) => label.length * 6.1);
  const scaleWidth = Math.max(scalePixels, textWidth(scaleLabel)) + 14;
  const scaleRect = { x: width - scaleWidth - 10, y: 10, width: scaleWidth, height: 37 };
  const scale = { millimetres: scaleMm, pixels: scalePixels, x: scaleRect.x + 7, y: scaleRect.y + 25, label: scaleLabel, rect: scaleRect };
  const candidates: (DimensionGuide & { score: number })[] = [];
  const names = ["width", "height", "depth"] as const;
  const prefixes = ["W", "H", "D"];
  const desired = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: .7, y: -.7 }];
  for (let axis = 0; axis < 3; axis++) {
    const bit = 1 << axis;
    const otherAxes = [0, 1, 2].filter((index) => index !== axis);
    const label = `${prefixes[axis]} ${formatGuideMeasurement(dimensions[names[axis]], unit)}`;
    const labelWidth = textWidth(label) + 10, labelHeight = 18;
    for (let index = 0; index < 8; index++) {
      if (index & bit) continue;
      // At least one adjacent face must face the camera; hidden back edges never gain a leader.
      if (!otherAxes.some((faceAxis) => cameraDirection[faceAxis] * (index & (1 << faceAxis) ? 1 : -1) > 1e-6)) continue;
      const a = points[index], b = points[index | bit];
      const vx = b.x - a.x, vy = b.y - a.y, length = Math.hypot(vx, vy);
      if (length < 28) continue; // Edge-on depth/width/height stays available in the text readout.
      let normal = { x: -vy / length, y: vx / length };
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (normal.x * (midpoint.x - origin.x) + normal.y * (midpoint.y - origin.y) < 0) normal = { x: -normal.x, y: -normal.y };
      // Only silhouette edges qualify: every other corner must lie toward the package interior.
      if (points.some((point) => normal.x * (point.x - a.x) + normal.y * (point.y - a.y) > .6)) continue;
      const offset = 12;
      const shift = (point: GuidePoint, distance: number) => ({ x: point.x + normal.x * distance, y: point.y + normal.y * distance });
      const labelCenter = shift(midpoint, offset + labelHeight / 2 + 3);
      let labelAngle = Math.atan2(vy, vx);
      if (labelAngle > Math.PI / 2) labelAngle -= Math.PI;
      if (labelAngle < -Math.PI / 2) labelAngle += Math.PI;
      const rotatedWidth = Math.abs(Math.cos(labelAngle)) * labelWidth + Math.abs(Math.sin(labelAngle)) * labelHeight;
      const rotatedHeight = Math.abs(Math.sin(labelAngle)) * labelWidth + Math.abs(Math.cos(labelAngle)) * labelHeight;
      const labelRect = { x: labelCenter.x - rotatedWidth / 2, y: labelCenter.y - rotatedHeight / 2, width: rotatedWidth, height: rotatedHeight };
      if (labelRect.x < 7 || labelRect.y < 7 || labelRect.x + labelRect.width > width - 7 || labelRect.y + labelRect.height > height - 7 || guideRectsOverlap(labelRect, scaleRect, 6)) continue;
      candidates.push({ axis: names[axis], label, source: [a, b], line: [shift(a, offset), shift(b, offset)], normal, labelCenter, labelAngle, labelRect,
        score: normal.x * desired[axis].x + normal.y * desired[axis].y + Math.min(length / 1000, .3) });
    }
  }
  const selected: DimensionGuide[] = [];
  for (const axis of names) {
    const candidate = candidates.filter((item) => item.axis === axis).sort((a, b) => b.score - a.score).find((item) => !selected.some((other) => guideRectsOverlap(item.labelRect, other.labelRect, 8)));
    if (candidate) selected.push(candidate);
  }
  return { hull, origin, grid: { millimetres: gridMm, pixelsX: gridMm * pixelsPerMmX, pixelsY: gridMm * pixelsPerMmY }, scale, dimensions: selected,
    gridLabel: `${formatGuideMeasurement(gridMm, unit)} per square`, scaleLabel: `${scaleLabel} scale bar` };
}
