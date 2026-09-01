/**
 * "The Wall" — a worked clay control pass, Shot 1A.
 *
 * The Blender page argues the case in the abstract. This is the same argument
 * with a real shot behind it: twelve seconds of untextured geometry nobody
 * will ever see, whose entire job is to settle every camera decision before a
 * generation credit is spent.
 *
 * The reason it earns a page rather than a gallery slot is the part in the
 * middle — the brief's final frame turned out to be arithmetically impossible,
 * and finding that took a calculation rather than a render. That is the
 * difference between owning a pipeline and operating one.
 */

export const WALL = {
  title: "The Wall",
  strap: "Clay control pass · Shot 1A · 4:3 · 24 fps · 288 frames",
  lede:
    "Twelve seconds of untextured geometry that will never be seen by anyone. Its whole job is to settle every camera decision before a single generation credit is spent — then hand Seedance 2.5 a structure it cannot re-roll.",
  /** Hosted on the same Blob store as the studio's starter clips. */
  clip: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/01_clay_1A.mp4",
  poster: "/the-wall/f288.jpg",
  context:
    "Shot 1A of a spec campaign for President's Choice The Decadent. The clay pass is Lane A only — camera, blocking, timing, occlusion and light direction, and deliberately no brand colour, no material and no type. Packaging artwork and all typography are composited over the generated plate afterwards, from the identical camera.",
};

/** Headline numbers. The last one is the argument in a single row. */
export const WALL_COST = [
  { v: "1.3", unit: "min", k: "288 frames at 960×720, EEVEE on an M-series GPU" },
  { v: "31,430", unit: "", k: "chips scattered, snapped to one terrain function" },
  { v: "0.26", unit: "%", k: "peak clipped pixels — measured, not eyeballed" },
  { v: "0", unit: "", k: "generation credits spent settling the camera" },
];

export const WALL_BEATS = [
  {
    frame: "/the-wall/f001.jpg",
    range: "f1–72 · 0.0–3.0s",
    title: "Buried in the chips",
    body: "The lens sits 8 mm off the ground, orbiting one hero chip through 40 degrees. Four chips span a 36 mm frame. No horizon — which a flat bed cannot deliver at any framing, so the bed got mounds, a berm behind the hero, and a shallow trench for the lens to run in.",
  },
  {
    frame: "/the-wall/f072.jpg",
    range: "f72–144 · 3.0–6.0s",
    title: "The wall resolves into a landscape",
    body: "The camera pulls back to 450 mm and lifts to 12 degrees, coming to rest on an empty 84 mm depression, dead centre, chips banked around its rim.",
  },
  {
    frame: "/the-wall/f144.jpg",
    range: "f144–204 · 6.0–8.5s",
    title: "The cookie lands",
    body: "Descending at 0.22 m/s — deliberately slower than gravity, which is correct for food and is stated in the prompt so the model is not left inventing a reason. A low ring of chips is shoved outward on impact, easing out rather than in.",
  },
  {
    frame: "/the-wall/f204.jpg",
    range: "f204–288 · 8.5–12.0s",
    title: "The pack shot assembles",
    body: "The crane pulls to 1.55 m while the cookie climbs the foreground ridge and tilts up to lean face-on. Four bags rise out of the chips behind it. The last 12 frames hold perfectly still, because the final frame is the one that has to survive.",
  },
];

/**
 * The find. Worth its own section because it is the whole case for doing this
 * work upstream: the fault was in the brief, and only arithmetic exposed it.
 */
export const WALL_IMPOSSIBLE = {
  claim: "The brief's final frame could not be built.",
  lede:
    "Not “was difficult”. The specification was internally impossible, and it took arithmetic rather than rendering to see it.",
  maths: [
    { l: "camera height 1.55 m · sin 22°", r: "581 mm" },
    { l: "cookie centre, resting on the bed", r: "26 mm" },
    { l: "vertical drop between them", r: "555 mm" },
    { l: "…but the whole camera-to-cookie distance is only", r: "450 mm" },
  ],
  why:
    "The height difference alone exceeds the straight-line distance, so no point on the bed is 0.45 m from that camera. And the nearest bed point actually inside the frame is 929 mm out, where a 55 mm cookie reads 7.4% of frame width against 10.5% for each pack — coming back smaller than the packs, which inverts the entire point of the shot.",
  fix:
    "Keep every camera number exactly as briefed, and give the bed a foreground ridge for the cookie to climb — with the crest height solved backwards from the brief's own 450 mm rather than typed in. On-theme rather than a patch: the creative spine is “pull out until you realise it is a landscape”, and a landscape has relief.",
};

/** Verified against the rendered pixels, not against the solver's own maths. */
export const WALL_MEASURED = {
  lede:
    "The build ends by classifying the final frame by ID colour and reading each subject's extent back out of it. A render that looks plausible and is wrong is the expensive failure — you only find it after paying for generations.",
  rows: [
    { subject: "Cookie", bw: "15%", mw: "15.3%", bh: "20%", mh: "21.2%", note: "on the nose" },
    { subject: "Pack, each", bw: "10%", mw: "12.2%", bh: "21%", mh: "23.1%", note: "wider — see below" },
    { subject: "Pack row", bw: "50%", mw: "53.5%", bh: "—", mh: "—", note: "on the nose" },
  ],
  note:
    "The packs run about two points over in both axes, and both gaps are the proxy being right rather than the layout being off. 130 mm is the bag's flat width; a gusset with a belly bulge is ~12% wider. And a 65 mm-deep bag's silhouette runs from its near-bottom edge to its far-top edge — 1.3° to 9.3° off the camera axis, which projects to 23.5%, not 21%. Flatten either and the packs stop reading as bags and start reading as cereal cartons.",
};

/** What the build itself got right, stated as decisions rather than features. */
export const WALL_BUILD = [
  {
    file: "config.py",
    title: "One terrain function, called by everything",
    body: "The chip scatter, the continuation plane, the pack row and the cookie's path all read this. An earlier version kept a separate vectorised copy for the plane — two places to edit, and one silent divergence away from 31,000 chips floating over their own floor.",
  },
  {
    file: "config.py",
    title: "The ridge height is solved, never typed",
    body: "The brief fixes the cookie at 450 mm from the lens. That number drives its apparent size, so the crest it rests on is bisected out of it rather than hard-coded. Change anything else about the terrain and the published framing still holds.",
  },
  {
    file: "build.py",
    title: "Measure the finished frame, don't trust the solver",
    body: "This is what caught the cookie rotating about the wrong axis — rolling sideways like a falling coin. The render looked entirely plausible and measured 12.2% of frame width against a predicted 15.3%.",
  },
];

/** Composition decisions that only a built scene can make. */
export const WALL_BLOCKING = [
  {
    title: "Forced perspective is doing the work",
    body: "A 55 mm cookie is a quarter the height of a 200 mm bag and still reads as the largest object in frame, because it sits three times closer to the lens. Built that way on purpose.",
  },
  {
    title: "The cookie sits in the gap",
    body: "Dead centre horizontally, in front of the space between packs 2 and 3 — the widest silhouette separation available, which removes the occlusion ambiguity entirely rather than hoping the model resolves it the same way twice.",
  },
  {
    title: "The top-down view earns its two minutes",
    body: "Rolled so the final view axis runs straight down the frame. It is the only view that reads row spacing and the forced-perspective offset unambiguously — and the one that exposed a sinusoidal terrain lattice that looked like gentle relief from every hero angle.",
  },
];
