/**
 * Two authored Blender passes and the actual Seedance output supplied by
 * Ajwad. Provenance stays with each asset when the comparison changes.
 */

export type CreamPane = {
  id: "guide" | "render" | "seedance";
  label: string;
  /** Pixel dimensions, shown beside the label at wider sizes. */
  spec: string;
  /** One line on what this pass is for. */
  note: string;
  src: string;
  poster: string;
  /** Link text for opening the file at full size. */
  openLabel: string;
  provenance: string;
  hasAudio?: boolean;
};

export const CREAM_PANES: readonly CreamPane[] = [
  {
    id: "guide",
    label: "Motion guide",
    spec: "720 × 1280",
    note: "Simple materials. Camera, timing and action.",
    src: "/studio/cream/motion-guide.mp4",
    poster: "/studio/cream/motion-guide-compare.jpg",
    openLabel: "Open motion guide",
    provenance: "Authored in Blender",
  },
  {
    id: "render",
    label: "Shaded Blender render",
    spec: "1080 × 1920",
    note: "Higher fidelity. Lighting, texture and colour.",
    src: "/studio/cream/shaded-render.mp4",
    poster: "/studio/cream/shaded-compare.jpg",
    openLabel: "Open shaded render",
    provenance: "Authored in Blender",
  },
] as const;

export const CREAM_FINAL: CreamPane = {
  id: "seedance",
  label: "Seedance film",
  spec: "480 × 854",
  note: "Generated from the motion guide and five appearance references.",
  src: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/icecream-example/5T8tOp3A7U99ZSKVs9H_y_video.mp4",
  poster: "/studio/cream/seedance-poster.jpg",
  openLabel: "Open finished film",
  provenance: "Generated with Seedance 2.5",
  hasAudio: true,
};

export const CREAM_COMPARISONS = [
  { id: "guide-final", label: "Guide → Film", panes: [CREAM_PANES[0], CREAM_FINAL] },
  { id: "shaded-final", label: "Shaded → Film", panes: [CREAM_PANES[1], CREAM_FINAL] },
  { id: "blender", label: "Blender passes", panes: CREAM_PANES },
] as const;

/** Shared edit length; the generated container reports 18.041667 seconds. */
export const CREAM_DURATION = 18;

export type CreamChapter = {
  from: number;
  to: number;
  name: string;
  action: string;
};

/** Chapters describe the Blender plan; generative timing can differ. */
export const CREAM_CHAPTERS: readonly CreamChapter[] = [
  { from: 0, to: 2, name: "Macro", action: "Grazing macro arc across vanilla ridges" },
  { from: 2, to: 5, name: "Spoon lift", action: "Rising three-quarter dolly and cream release" },
  { from: 5, to: 7.5, name: "Cream spiral", action: "Low-to-high orbit around the scoop" },
  { from: 7.5, to: 10, name: "Flavour burst", action: "Orbit through three scoops and ingredients" },
  { from: 10, to: 12.5, name: "Runway", action: "Lateral product track" },
  { from: 12.5, to: 15, name: "Overhead", action: "Rotating descent over the three tubs" },
  { from: 15, to: 18, name: "Hero landing", action: "Pullback and rise, then final hold" },
] as const;

/**
 * MIME type from the file extension, so a pane can carry any container the
 * browser supports without the type being restated (and going stale) beside
 * every path.
 */
export function videoType(src: string): string {
  const ext = src.split(".").pop()?.toLowerCase();
  if (ext === "webm") return "video/webm";
  if (ext === "ogv" || ext === "ogg") return "video/ogg";
  return "video/mp4";
}
