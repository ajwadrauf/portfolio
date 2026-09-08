/**
 * "Cream in motion" — the two Blender passes shown side by side on the studio
 * overview, and the shot map they share.
 *
 * Both panes are authored Blender output. Neither is a generative result: the
 * guide's flat colours identify geometry rather than flavour, the tubs carry
 * placeholder packaging, and the cream is art-directed motion rather than a
 * baked fluid sim. Saying so in the data file as well as the page is the point
 * — the labels are the one part of this that must not drift into "AI final".
 */

export type CreamPane = {
  /** Left is the guide, right is the shaded render. Order is meaningful. */
  id: "guide" | "render";
  label: string;
  /** Pixel dimensions, shown beside the label at wider sizes. */
  spec: string;
  /** One line on what this pass is for. */
  note: string;
  src: string;
  poster: string;
  /** Link text for opening the file at full size. */
  openLabel: string;
};

export const CREAM_PANES: readonly CreamPane[] = [
  {
    id: "guide",
    label: "Motion guide",
    spec: "720 × 1280",
    note: "Simple materials. Camera, timing and action.",
    src: "/studio/cream/motion-guide.mp4",
    poster: "/studio/cream/motion-guide-poster.jpg",
    openLabel: "Open motion guide",
  },
  {
    id: "render",
    label: "Shaded Blender render",
    spec: "1080 × 1920",
    note: "Higher fidelity. Lighting, texture and colour.",
    src: "/studio/cream/shaded-render.mp4",
    poster: "/studio/cream/shaded-render-poster.jpg",
    openLabel: "Open shaded render",
  },
] as const;

/** Both files are exactly this long; metadata overrides it once loaded. */
export const CREAM_DURATION = 18;

export type CreamChapter = {
  from: number;
  to: number;
  name: string;
  action: string;
};

/** Seven shots, one camera plan — the same map applies to both passes. */
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
