/**
 * Starter motion references.
 *
 * A clip reference is not decoration and it is not a background — the model
 * reads its camera move, its cutting rhythm and its energy, and applies them
 * to your product. Which means the useful clips are abstract: swirling
 * colour, particles, light sweeps. There is no subject in them to leak into
 * the render, only motion.
 *
 * That is also why the blurbs below are written as reference briefs rather
 * than as stock-library descriptions. "Vibrant spheres merging against a
 * dark blue background" tells you what the clip looks like. "Slow orbital
 * drift with soft collisions — use it when the product should feel weightless
 * rather than driven" tells you what it will do to your ad.
 */

export type ReferenceClip = {
  id: string;
  name: string;
  /** What the model will take from it, in production terms. */
  brief: string;
  /** The reference job this clip is best pointed at. */
  suggestedRole: "motion" | "rhythm" | "style" | "composition";
  /** File under public/references. */
  file: string;
  /** Still frame under public/references, shown before hover. */
  poster: string;
  seconds: number;
};

export const REFERENCE_CLIPS: ReferenceClip[] = [
  {
    id: "orbital-drift",
    name: "Orbital drift",
    brief:
      "Slow orbital motion with soft collisions and long easing. Point a product at this when it should feel weightless and premium — it lengthens every move and removes urgency. The wrong choice for anything cut to a beat.",
    suggestedRole: "motion",
    file: "/references/orbital-drift.mp4",
    poster: "/references/orbital-drift.jpg",
    seconds: 5,
  },
  {
    id: "pulse-grid",
    name: "Pulse grid",
    brief:
      "Hard rhythmic pulses on a regular interval. This is the one to use when the concept cuts to music — it gives the model an explicit tempo to land actions on, which is the difference between a grid that fills on the beat and one that fills whenever.",
    suggestedRole: "rhythm",
    file: "/references/pulse-grid.mp4",
    poster: "/references/pulse-grid.jpg",
    seconds: 5,
  },
  {
    id: "liquid-bloom",
    name: "Liquid bloom",
    brief:
      "Fluid expansion outward from centre, dense and organic. Reads as pour, splash and bloom physics. Use it for food and drink where the payoff is something spreading or bursting rather than something moving.",
    suggestedRole: "motion",
    file: "/references/liquid-bloom.mp4",
    poster: "/references/liquid-bloom.jpg",
    seconds: 5,
  },
  {
    id: "light-sweep",
    name: "Light sweep",
    brief:
      "A raking highlight travelling across a dark field. Borrow this for lighting behaviour rather than movement — it teaches the model how a specular hit should travel over a surface, which is most of what makes packaging look expensive.",
    suggestedRole: "style",
    file: "/references/light-sweep.mp4",
    poster: "/references/light-sweep.jpg",
    seconds: 5,
  },
];

export const getClip = (id: string) => REFERENCE_CLIPS.find((c) => c.id === id);

/**
 * fal fetches a reference URL from its own servers, so a site-relative path
 * has to become something reachable from outside this machine before it is
 * sent. See resolveClipUrl in the start route.
 */
export const isStarterClipPath = (url: string) => url.startsWith("/references/");
