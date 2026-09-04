/**
 * Blender as a control layer for Seedance 2.5.
 *
 * The argument this page makes: a generative render is the expensive step and
 * the least repeatable one. Every decision that can be settled in geometry —
 * framing, lens, blocking, timing, camera path, occlusion order — is a
 * decision you are otherwise paying the model to guess, differently, on every
 * take. Blender moves those decisions upstream into something that re-renders
 * for the cost of electricity.
 *
 * Numbers here come from the project's own pricing model (src/lib/videoCost)
 * so the economics on the page cannot drift from the economics in the Ad Lab.
 */

export type Lane = {
  id: string;
  name: string;
  medium: string;
  carries: string[];
  never: string[];
  why: string;
};

/**
 * The single most common way this workflow fails is merging the two lanes —
 * wanting the clay pass to also be the right brand yellow.
 */
export const LANES: Lane[] = [
  {
    id: "clay",
    name: "The clay control pass",
    medium: "Video · one clip per shot",
    carries: [
      "Camera path, lens and framing",
      "Blocking and motion paths",
      "Timing and shot-size transitions",
      "Occlusion order — who passes in front of whom",
      "Ground contact and light direction",
    ],
    never: [
      "Brand colour",
      "Textures and final materials",
      "Typography or logos of any kind",
      "Atmosphere and style",
    ],
    why: "Untextured grey geometry with flat ID colours on the subjects you intend to map. The model reads structure from it and invents nothing about the look.",
  },
  {
    id: "look",
    name: "Look references",
    medium: "Stills · separate files",
    carries: [
      "Brand colour and material character",
      "Finish, sheen, surface behaviour",
      "Lighting mood and atmosphere",
      "Product label detail",
    ],
    never: [
      "Camera movement",
      "Blocking or timing",
      "Anything structural",
    ],
    why: "Photographs, brand assets or Blender renders — never the same file as the clay. The prompt binds each reference to its job explicitly.",
  },
];

/** What the clay pass is actually buying, stated as decisions moved upstream. */
export const MOVED_UPSTREAM = [
  {
    decision: "Camera move",
    prompted: "Described in words, re-rolled every take. Two generations of the same prompt give two different moves.",
    clay: "Keyframed once. Identical on every regeneration, and editable in two lines.",
  },
  {
    decision: "Framing and lens",
    prompted: "Approximated from adjectives. Perspective compression is whatever the model felt like.",
    clay: "A real sensor and a real focal length. The model reads the perspective rather than guessing it.",
  },
  {
    decision: "Blocking and timing",
    prompted: "Three actions in one sentence produces omissions, not precision.",
    clay: "Keyframes. The beat lands on the frame you put it on.",
  },
  {
    decision: "Occlusion order",
    prompted: "Ambiguous overlap resolves randomly, differently each run.",
    clay: "Depth is explicit in the geometry, so it resolves the same way every time.",
  },
  {
    decision: "Light direction",
    prompted: "'Warm morning light' is a mood, not a direction.",
    clay: "One key with a real angle. The model infers its own lighting from the shadow it can see.",
  },
];

/** The build order. Skipping probe, confirm or package is what costs credits. */
export const PHASES = [
  { n: "01", name: "Probe", body: "Small throwaway calls to learn the environment. The Blender API changes between versions and training data is not authoritative about it." },
  { n: "02", name: "Confirm", body: "Delivery aspect, shot structure, proxy-to-subject mapping, lens per shot, and what gets composited after rather than generated." },
  { n: "03", name: "Script", body: "One self-contained .py file. Every MCP call runs in a fresh namespace, so a scene built through chat cannot be rebuilt — and this pass gets re-rendered many times." },
  { n: "04", name: "Verify", body: "Render checkpoint frames and look at them. A script exiting cleanly is not evidence the render is right." },
  { n: "05", name: "Package", body: "One folder per shot, named so upload order matches the @Video 1 / @Image 1 indices the prompt refers to." },
  { n: "06", name: "Generate", body: "Run Seedance, review, and route each failure to the layer that owns it." },
];

/** Run against a real frame, not against the script exiting cleanly. */
export const CLAY_CHECKS = [
  "Aspect ratio matches the delivery aspect exactly",
  "Frame rate is 24",
  "Every mapped subject is its assigned ID colour, and nothing else shares it",
  "Every subject has a visible contact shadow",
  "Silhouettes stay separable at every beat",
  "No text, logos or numbers anywhere in frame",
  "No axes, grids, gizmos, frustums or path curves",
  "Nothing clipped to white, nothing crushed to black",
  "Ground plane extends past frame at every camera angle",
  "One clear light direction, consistent across the shot",
  "Implied speeds are physically sane",
  "Frame 1 is a real composition, not a lead-in",
  "Clip is under 30 seconds — under 10 is better",
];

/**
 * The most expensive mistake in the loop is fixing a Blender problem with
 * prompt edits, or a prompt problem with re-renders.
 */
export const ROUTING = [
  { symptom: "Camera move is wrong", layer: "Blender", fix: "Re-key the camera, re-render the clay" },
  { symptom: "Subject in the wrong place at the wrong time", layer: "Blender", fix: "Re-block, re-render" },
  { symptom: "Motion reads too fast or too slow", layer: "Blender", fix: "Retime against the m/s table" },
  { symptom: "Framing is off", layer: "Blender", fix: "Adjust lens or position — not the prompt" },
  { symptom: "Grey plastic or empty void leaking in", layer: "Prompt", fix: "Strengthen the exclusion block" },
  { symptom: "Proxy read literally — the capsule stays a capsule", layer: "Both", fix: "Add the mapping sentence, and give the proxy real proportions" },
  { symptom: "Wrong colour, material or mood", layer: "Look refs", fix: "Better reference still, tighter style sentence" },
  { symptom: "Identity drifts mid-clip", layer: "Prompt", fix: "More references of that subject, or a shorter clip" },
  { symptom: "Garbled text", layer: "Neither", fix: "Remove it from the generation and composite it after" },
];

/** Documented limits. Verified against the live surface before a paid run. */
export const SPECS = [
  { k: "References per generation", v: "50 total — 30 images, 10 videos, 10 audio" },
  { k: "Reference video duration", v: "30s across all clips" },
  { k: "Clay render size", v: "1280×720 or 1080×1080 — above 720p buys nothing" },
  { k: "Frame rate", v: "24 fps, set in Blender, not fixed afterwards" },
  { k: "Output length", v: "4–30s in one pass" },
  { k: "Native resolution", v: "480p and 720p — anything higher is a provider upscale" },
];

// ---------------------------------------------------------------------------
// The brief builder
// ---------------------------------------------------------------------------

export type SubjectMap = {
  /** The flat ID colour painted on the proxy in the clay pass. */
  color: string;
  /** The proxy geometry, described as it appears in the render. */
  proxy: string;
  /** What it becomes in the finished frame. */
  becomes: string;
  /** Which look reference defines it, if any. */
  ref: string;
};

export type Beat = { from: string; to: string; action: string };

export type BlenderBrief = {
  shotId: string;
  aspect: string;
  seconds: string;
  sensor: string;
  lens: string;
  rig: string;
  startFraming: string;
  endFraming: string;
  keyLight: string;
  lightCharacter: string;
  subjects: SubjectMap[];
  beats: Beat[];
  creative: string;
  composited: string;
  /**
   * The loose material subjects move through, if any — sand, chips, snow,
   * foam, water.
   *
   * Added after a render came back with the hero object sliding across a
   * frozen bed like a sprite. The cause was in the prompt: the composer told
   * the model to inherit the blockout's subject trajectories, so it faithfully
   * reproduced motion that had never been simulated. Naming the medium is what
   * lets the composer write a physics contract instead.
   */
  medium: string;
  /**
   * Whether the blockout's subject motion is a specification or a placeholder.
   *
   * A clay pass is authored to settle camera, staging and timing — the things
   * that are expensive to fix downstream. Granular dynamics are the opposite:
   * miserable to simulate in 3D and something the video model is already good
   * at. So control is a dial, not a switch, and this is the dial.
   */
  physics: "inherit" | "resolve";
};

export const EMPTY_BRIEF: BlenderBrief = {
  shotId: "1A",
  aspect: "1:1",
  seconds: "12",
  sensor: "36mm full frame",
  lens: "50",
  rig: "slow dolly push, 0.4 m/s",
  startFraming: "",
  endFraming: "",
  keyLight: "",
  lightCharacter: "",
  subjects: [{ color: "", proxy: "", becomes: "", ref: "" }],
  beats: [{ from: "0", to: "", action: "" }],
  creative: "",
  composited: "",
  medium: "",
  physics: "resolve",
};

/**
 * A worked example, so the form is never a wall of empty boxes — and this one
 * is the brief behind a shot that actually rendered, not a plausible
 * reconstruction of one.
 *
 * It is chosen for what it teaches. Only the pack carries a look reference:
 * the chips and the cookie are described in words and come back consistent
 * anyway, which is the right way to spend a scarce reference slot. Four
 * proxies share that single reference. And the clay pass is declared a
 * placeholder for physics, because the version of this brief that inherited
 * its subject motion produced a flat cookie skating over a frozen bed.
 */
export const EXAMPLE_BRIEF: BlenderBrief = {
  shotId: "1A",
  aspect: "4:3",
  seconds: "12",
  sensor: "36mm full frame",
  lens: "45",
  rig: "macro-to-wide dolly and crane, continuous, no cuts",
  startFraming: "Macro, buried in the chip bed, three or four chips filling frame",
  endFraming: "Wide, cookie face-on in the foreground, four packs in a row behind",
  keyLight: "Single raking key from camera left, low elevation",
  lightCharacter: "Warm, high-end food commercial",
  subjects: [
    { color: "blue", proxy: "small conical chips forming the bed", becomes: "semi-sweet chocolate chips, deep brown with a soft sheen", ref: "" },
    { color: "orange", proxy: "disc", becomes: "a thick golden peanut butter chocolate chip cookie", ref: "" },
    { color: "green", proxy: "form, leftmost", becomes: "the product pack", ref: "Image 1" },
    { color: "magenta", proxy: "form, second left", becomes: "the product pack", ref: "Image 1" },
    { color: "yellow", proxy: "form, third left", becomes: "the product pack", ref: "Image 1" },
    { color: "cyan", proxy: "form, rightmost", becomes: "the product pack", ref: "Image 1" },
  ],
  beats: [
    { from: "0", to: "3", action: "Macro orbit around one chip inside a dense bed. The bed is at rest; only parallax moves." },
    { from: "3", to: "6", action: "The camera pulls back and lifts. The wall of chips resolves into a landscape ending at a central depression." },
    { from: "6", to: "8.5", action: "One cookie descends slower than gravity, tumbling gently, and settles into the depression — chips displaced outward, a scatter flicked up, the rim cascading inward behind it." },
    { from: "8.5", to: "12", action: "The camera cranes back and up. The cookie ploughs forward to the near ridge and tilts face-on. Four packs heave up through the bed behind it and settle seated in the chips." },
  ],
  creative:
    "A continuous macro-to-wide move through a landscape of chocolate chips. A hero cookie settles into the chips and a row of four kraft packs rises behind it. Warm, high-end food commercial lighting from one direction, raking across the surfaces.",
  composited: "wordmark, flavour name, legal line",
  medium: "chocolate chips",
  physics: "resolve",
};

const clean = (s: string) => s.trim();

/**
 * A swatch for an ID colour written in words.
 *
 * The mapping is by colour, so the one error worth making impossible is
 * believing two subjects are distinct when they are not. Showing the colours
 * beside the slot numbers turns that from something you reason about into
 * something you see.
 */
const SWATCHES: Record<string, string> = {
  red: "#d92b2b", orange: "#e07a10", amber: "#e0a010", yellow: "#e5d016",
  lime: "#8bc722", green: "#1f9d3f", teal: "#12a99a", cyan: "#18b6d8",
  blue: "#2456d6", indigo: "#4437c4", violet: "#7b2fc9", purple: "#8e3a7c",
  magenta: "#cf2b8e", pink: "#e0629e", brown: "#8a5a2b", white: "#f2f2f2",
  black: "#1a1a1a", grey: "#8a8a8a", gray: "#8a8a8a",
};

/** Best-effort swatch: the last recognised colour word wins ("neutral grey"). */
export function swatchFor(name: string): string | null {
  const words = clean(name).toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    if (SWATCHES[words[i]]) return SWATCHES[words[i]];
  }
  return null;
}

/**
 * The upload manifest: what goes into the surface, in what order.
 *
 * Most surfaces index references by upload order, so the numbers in the prompt
 * are only correct if the files go in the same sequence. This is the list to
 * check against before uploading anything.
 */
export function uploadPlan(b: BlenderBrief) {
  const mapped = b.subjects.filter((s) => has(s.color) && has(s.becomes));
  return [
    {
      slot: "@Video 1",
      order: 1,
      color: null as string | null,
      colorName: "",
      what: "The clay control pass",
      role: "Camera, blocking, timing, occlusion, light direction",
    },
    // Only referenced subjects occupy an upload slot. A subject described in
    // words takes no file, so listing one here would ask for an upload that
    // does not exist and push every real slot number down by one.
    ...uniqueRefs(mapped).map((r, i) => ({
      slot: `@${r.ref}`,
      order: i + 2,
      color: swatchFor(r.colors[0]),
      colorName: r.colors.join(", "),
      what: r.becomes,
      role:
        r.proxies.length > 1
          ? `Replaces ${r.proxies.length} proxies: ${r.proxies.join("; ")}`
          : (r.proxies[0] ?? "Look and finish"),
    })),
  ];
}

/**
 * Groups subjects by the reference that defines them.
 *
 * One file can define several proxies — four bags that are all the same pack —
 * and it is uploaded once. Listing it per subject would over-count the slots
 * and mis-number everything after it.
 */
function uniqueRefs(mapped: SubjectMap[]) {
  const byRef = new Map<
    string,
    { ref: string; becomes: string; colors: string[]; proxies: string[] }
  >();
  for (const s of mapped) {
    if (!has(s.ref)) continue;
    const key = clean(s.ref);
    const entry = byRef.get(key) ?? {
      ref: key,
      becomes: clean(s.becomes),
      colors: [],
      proxies: [],
    };
    entry.colors.push(clean(s.color));
    if (has(s.proxy)) entry.proxies.push(`the ${clean(s.color)} ${clean(s.proxy)}`);
    byRef.set(key, entry);
  }
  return [...byRef.values()];
}

/** "a rectangular box" → "rectangular box", so "The orange a box" cannot happen. */
const dropArticle = (s: string) => clean(s).replace(/^(a|an|the)\s+/i, "");
const has = (s: string) => clean(s).length > 0;

/**
 * The brief that goes to an LLM driving Blender, not to the video model.
 *
 * Same shot data, different reader. Seedance is told what the finished frame
 * contains; Blender is told what to build, in what units, and — the part the
 * first version of this workflow left out entirely — how to animate it and
 * what to declare as a placeholder when it does not.
 *
 * The two outputs are generated from one brief on purpose. A blockout and the
 * prompt that consumes it have to agree on duration, beat boundaries, ID
 * colours and shot progression, and the cheapest way to keep two documents in
 * agreement is to stop maintaining two documents.
 */
export function composeBlenderBuildBrief(b: BlenderBrief): string {
  const mapped = b.subjects.filter((s) => has(s.color) && has(s.becomes));
  const beats = b.beats.filter((x) => has(x.action));
  const out: string[] = [];
  const dur = has(b.seconds) ? clean(b.seconds) : "12";
  const frames = Math.round(Number(dur || 12) * 24);

  out.push(
    `# Clay control pass — shot ${has(b.shotId) ? clean(b.shotId) : "1A"}`,
    "",
    "Build this in Blender and export a clay blockout. It is a control pass for a",
    "video model, not a finished render: its job is to settle camera, staging,",
    "timing and occlusion so those decisions are made where changing them is free.",
    "",
    "Read CLAUDE.md in this folder first — especially §6 (render settings) and §7",
    "(animating the pass). Probe the API before writing, as §4 describes; do not",
    "guess enum identifiers for this build.",
    "",
    "## Scene",
    "",
    `- Duration ${dur}s at 24 fps — frames 1 to ${frames}.`,
    `- Aspect ${b.aspect}, rendered at 720p on the short edge.`,
    "- Real-world scale. Set unit scale before modelling, not after.",
    "- Flat, unlit ID colours. No textures, no reflections, no depth of field —",
    "  all three obscure the geometry the model is meant to read.",
    "- Render sharp: no motion blur in the clay. Blur is asked for in the video",
    "  prompt, where it belongs.",
    "",
    "## Camera",
    "",
  );
  if (has(b.lens)) {
    out.push(
      `- Real camera: ${clean(b.lens)}mm${has(b.sensor) ? ` on a ${clean(b.sensor)} sensor` : ""}.`,
    );
  }
  if (has(b.rig)) out.push(`- Move: ${clean(b.rig)}.`);
  if (has(b.startFraming)) out.push(`- Opens on: ${clean(b.startFraming)}.`);
  if (has(b.endFraming)) out.push(`- Ends on: ${clean(b.endFraming)}.`);
  out.push(
    "- One continuous take. Any cut here becomes a cut in the generation.",
    "",
    "## Lighting",
    "",
  );
  out.push(
    has(b.keyLight)
      ? `- Key: ${clean(b.keyLight)}.`
      : "- One key light. Direction matters; character does not — the video model",
  );
  out.push(
    "- Direction is inherited by the generation, so fix it here and keep it",
    "  constant for the whole take.",
    "",
    "## Proxy geometry and ID colours",
    "",
    "One flat colour per subject, all distinct. The colour is the mapping, so two",
    "subjects sharing one are indistinguishable downstream.",
    "",
  );
  for (const s of mapped) {
    out.push(
      `- **${clean(s.color)}** — ${has(s.proxy) ? clean(s.proxy) : "proxy"}, becomes ${clean(s.becomes)} in the finished frame.`,
    );
  }
  out.push(
    "",
    "Give every hero object real thickness and a real profile. A flat proxy reads",
    "as a sprite in the generation because it was one in the blockout.",
  );
  if (has(b.composited)) {
    out.push(
      "",
      `Do not model or letter the following: ${clean(b.composited)}. Leave those`,
      "surfaces blank. They are composited after generation, so geometry for them",
      "here only gives the model something to garble.",
    );
  }
  out.push(
    "",
    "## Animation",
    "",
  );
  if (beats.length) {
    for (const beat of beats) {
      const range = has(beat.to) ? `${clean(beat.from)}–${clean(beat.to)}s` : `${clean(beat.from)}s`;
      out.push(`- **${range}** — ${clean(beat.action)}`);
    }
    out.push("");
  }
  out.push(
    "- Keyframe the beats as real ranges on the timeline. The video prompt tells",
    "  the model to match this clip's duration and route, so the two timelines",
    "  must agree to the frame.",
    "- Ease every move in and out. Constant-velocity translation is the clearest",
    "  tell of unedited keyframes, and the model copies the curve it is shown.",
    "- Rotate travelling objects in all three axes, not just around Z.",
    "- Seat contacts honestly. Half-buried means buried — do not float an object",
    "  above a surface and rely on the camera angle to hide the gap.",
  );
  if (b.physics === "resolve" && has(b.medium)) {
    const m = dropArticle(b.medium);
    out.push(
      "",
      `### The ${m} is a placeholder — say so`,
      "",
      `This shot has subjects moving through ${m}. Simulating that fully is slow`,
      "and painful to art-direct, so either simulate a few hundred bodies in the",
      "contact region only and leave the rest static, or leave the bed static",
      "entirely.",
      "",
      "Either way the deal has a second half, and it is not optional: whatever you",
      "did not simulate must be declared a placeholder in the video prompt, which",
      "must not ask the model to inherit subject trajectories. See §7 and §11 of",
      "CLAUDE.md. The prompt builder writes that contract automatically.",
    );
  }
  out.push(
    "",
    "## Before exporting, watch it once",
    "",
    "- Does anything move at constant velocity? Fix the easing.",
    "- Does anything slide across a surface without disturbing it? Simulate it",
    "  locally, or write it into the video prompt as a placeholder to override.",
    "- Does anything finish floating, intersecting, or resting on a suspiciously",
    "  level line? Seat it — the generation amplifies it.",
    "",
    "## Export",
    "",
    `- MP4 / H.264, ${dur}s, 24 fps, ${b.aspect}, 720p short edge.`,
    `- Name it by shot: \`${has(b.shotId) ? clean(b.shotId) : "1A"}_clay.mp4\`.`,
    "- One folder per shot, ordered so upload order matches the reference indices",
    "  the video prompt addresses.",
  );
  return out.join("\n");
}

/**
 * Assembles the four-layer Seedance prompt from the brief.
 *
 * Order is deliberate and matches the documented structure: material roles
 * first so nothing is inferred, then the creative summary, then the timeline,
 * then the global rules and the exclusion block — which is the part people
 * skip and then wonder why the result has grey plastic people in a void.
 */
export function composeBlenderPrompt(b: BlenderBrief): string {
  const mapped = b.subjects.filter((s) => has(s.color) && has(s.becomes));
  const beats = b.beats.filter((x) => has(x.action));
  const out: string[] = [];

  const referenced = mapped.filter((s) => has(s.ref));
  const materials: string[] = [];
  for (const s of referenced) {
    const slot = `@${clean(s.ref)}`;
    // One reference can define several proxies — four bags that are all the
    // same pack — and it belongs in MATERIALS once, not once per subject.
    if (!materials.some((m) => m.startsWith(`${slot} `))) {
      materials.push(`${slot} ${dropArticle(s.becomes)}`);
    }
  }
  out.push(
    `MODE: Clay Renderer / Omni Reference${b.physics === "resolve" ? " — camera locked, physics free" : ""}`,
    `MATERIALS: @Video 1 clay blockout${materials.length ? ` · ${materials.join(" · ")}` : ""}`,
    // The stated length is not redundant with "match @Video 1": it is what
    // lets the lab set its own slider on import. A 12s timeline rendered at 8s
    // does not compress, it loses its last beat.
    `SETTINGS: Match @Video 1 duration and camera route${has(b.seconds) ? ` · ${clean(b.seconds)}s` : ""} · ${b.aspect} · 720p`,
    "",
    "[Reference roles]",
    /*
     * Two contracts, and the difference is expensive.
     *
     * The inherit form asks for the blockout's subject trajectories as well as
     * its camera, which is right when the motion was actually animated. When
     * it was not — when the clay pass slides a proxy along a path as a
     * stand-in — the model reproduces that faithfully, and the result is a
     * flat object skating across a frozen surface. Saying so explicitly is
     * what stops it: naming the placeholder beats describing the goal.
     */
    b.physics === "resolve"
      ? "@Video 1 is a clay blockout. It is a camera and staging reference, not a physics reference. Inherit exactly: the camera's path, speed and shot-size progression; the duration and order of the beats; which object occludes which; the direction of the key light; and where each element sits in the final frame. Do not inherit its physics — its subject motion is a placeholder standing in for dynamics that were never simulated. Keep only the start point, end point and duration of each move and re-solve everything between them as real physical motion."
      : "@Video 1 is a clay blockout. Inherit only camera movement, shot-size transitions, subject trajectories, blocking, timing, occlusion order, and the direction of the light.",
  );

  for (const s of mapped) {
    const proxy = has(s.proxy)
      ? `The ${clean(s.color)} ${dropArticle(s.proxy)}`
      : `The ${clean(s.color)} element`;
    out.push(
      `${proxy} becomes ${clean(s.becomes)}${has(s.ref) ? `, defined by @${clean(s.ref)}` : ""}.`,
    );
  }

  /*
   * The physics contract, written only when there is loose material for
   * something to move through.
   *
   * Every clause here came from a specific failure in a paid render: a hero
   * object that read as a flat sprite, a bed that stayed frozen while
   * something crossed it, a travelling object that displaced material on
   * impact but left no wake, and packs that finished the shot hovering in
   * clean air above the surface. Describing what went wrong turns out to be
   * more reliable than describing what good looks like.
   */
  if (b.physics === "resolve" && has(b.medium)) {
    const m = dropArticle(b.medium);
    out.push(
      "",
      "[Physics and secondary motion]",
      `Every solid subject is a three-dimensional object with real thickness and a visible edge — never a flat disc, never a cutout, never a sprite. While travelling it rotates in all three axes, with rotation that eases rather than running at constant speed or snapping to an angle.`,
      `The ${m} is a granular material, not a surface texture: thousands of small loose bodies that roll, tumble and knock into each other individually rather than sliding together as a sheet.`,
      `On contact, material is displaced outward in a low ring, a few pieces flicked up to bounce once and settle, and the rim of the resulting depression cascades inward and keeps settling a beat after the object has stopped.`,
      `Travelling through it displaces material continuously, not only at the moment of contact. Anything crossing the ${m} is partly submerged in it: a bow wave builds and spills at the leading edge, material shears outward into low banks along both flanks, and a furrow opens behind — a furrow made of individual pieces catching the light, never a smooth dark void and never a clean carved groove. Its walls cannot hold a steep face, so they slump inward and partly refill the trench a beat behind. The trail is a transient disturbance, not a permanent channel.`,
      `Rising out of the ${m} works the same way in reverse and happens in stages: the surface domes upward first, then parts; material sheets off the emerging object continuously, running down its faces and catching in any recess; and a collar of loose material avalanches inward against the base as the bed slumps to fill the space. Anything emerging finishes seated in the ${m} rather than standing on it or floating above it — partly buried, with an uneven bank piled against its base and no gap of any kind between object and bed.`,
      `Everything eases in and out. Natural motion blur consistent with a 180-degree shutter. Nothing moves through the ${m} without the ${m} reacting to it, and the bed is never static while anything is moving in it.`,
    );
  }

  out.push("", "[Creative direction]");
  out.push(has(b.creative) ? clean(b.creative) : "—");

  if (beats.length) {
    out.push("", "[Timeline]");
    for (const beat of beats) {
      const range = has(beat.to) ? `${clean(beat.from)}-${clean(beat.to)}s` : `${clean(beat.from)}s`;
      out.push(`${range}:  ${clean(beat.action)}`);
    }
  }

  const globals: string[] = [];
  if (has(b.lens)) {
    globals.push(
      `Photoreal, shot on a ${clean(b.lens)}mm lens${has(b.sensor) ? ` (${clean(b.sensor)})` : ""}, shallow but not extreme depth of field.`,
    );
  }
  if (has(b.rig)) globals.push(`Camera rig: ${clean(b.rig)}.`);
  if (has(b.lightCharacter)) globals.push(`Lighting character: ${clean(b.lightCharacter)}.`);
  if (mapped.length) {
    globals.push(
      `Exactly ${mapped.length} mapped subject${mapped.length === 1 ? "" : "s"} throughout — no duplicates, nothing added.`,
    );
  }
  globals.push(`Continuous lighting. No cuts other than those in @Video 1.`);
  out.push("", "[Global]", globals.join(" "));

  const inheritScope =
    b.physics === "resolve"
      ? "use it only for camera movement, staging, timing, occlusion order and light direction"
      : "use it only for camera movement, blocking, motion paths, timing, occlusion order and light direction";
  out.push(
    "",
    "[Exclusions]",
    `No text, no captions, no subtitles, no on-screen type, no logos, no watermarks, no background music. Do not inherit primitive geometry, flat grey materials, placeholder shapes, axes, guide lines, path curves, camera frustums, or the empty set from @Video 1 — ${inheritScope}.`,
  );
  if (b.physics === "resolve" && has(b.medium)) {
    const m = dropArticle(b.medium);
    out.push(
      `Do not reproduce the blockout's flat, sliding, sprite-like subject motion or its frozen bed — those are placeholders, not direction. Nothing slides across the top of the ${m} without sinking into it and moving it, and nothing travels through it leaving it undisturbed behind. No smooth dark voids, holes or shadow shapes standing in for a disturbed area. No trench that stays open and clean once the object has passed. Nothing hovers, floats or hangs in clean air above the ${m}, and no visible gap or level waterline separates an object from the material it is standing in.`,
    );
  }

  if (has(b.composited)) {
    out.push(
      "",
      `[Composited after generation — do not render these]`,
      clean(b.composited),
    );
  }

  return out.join("\n");
}

/** Problems worth catching before a paid generation, not after. */
export function briefIssues(
  b: BlenderBrief,
  mode: "build" | "seedance" = "seedance",
): { text: string; why: string }[] {
  const issues: { text: string; why: string }[] = [];
  const beats = b.beats.filter((x) => has(x.action));
  const mapped = b.subjects.filter((s) => has(s.color) && has(s.becomes));

  const total = Number(b.seconds);
  if (Number.isFinite(total)) {
    if (total > 30) {
      issues.push({
        text: `${total}s is past the single-pass ceiling.`,
        why: "Seedance renders 4–30 seconds in one pass. Beyond that it is Long Video mode or several generations cut together.",
      });
    }
    const last = beats.length ? Number(beats[beats.length - 1].to) : NaN;
    if (Number.isFinite(last) && last > total) {
      issues.push({
        text: `The timeline runs to ${last}s but the shot is ${total}s.`,
        why: "The beats past the end are simply not rendered, and the ones before them get compressed to fit.",
      });
    }
  }

  // Grey is legitimate for exactly one entry — the environment, which is what
  // every unmapped surface already wears. A second grey is what breaks it, and
  // the duplicate check below catches that without flagging the documented
  // pattern.
  const colors = mapped.map((s) => clean(s.color).toLowerCase());
  const dupe = colors.find((c, i) => colors.indexOf(c) !== i);
  if (dupe) {
    issues.push({
      text: `Two subjects share the ID colour "${dupe}".`,
      why: "The mapping is by colour, so a shared colour makes the two subjects indistinguishable and the model resolves them arbitrarily.",
    });
  }

  /*
   * Only flagged when nothing at all is referenced.
   *
   * This used to fire once per unreferenced subject, which made it fire twice
   * on a brief that had already produced a finished render — the chips and the
   * cookie were described in words on purpose and came back consistent anyway.
   * A check that flags a known-good brief is not a check, it is noise that
   * teaches people to ignore the panel.
   *
   * Where the author has referenced something and not something else, that is
   * an allocation decision, and reference slots are scarce enough to be worth
   * spending on identity rather than on generic matter. Referencing nothing at
   * all is the case that is nearly always a mistake.
   */
  if (mode === "seedance" && mapped.length > 0 && !mapped.some((s) => has(s.ref))) {
    issues.push({
      text: "No subject has a look reference.",
      why: "With nothing to hold appearance steady the model invents every surface, and invents them differently on every generation — the most common source of drift between takes. Generic matter renders fine from description, but anything that has to be itself needs a reference.",
    });
  }

  /*
   * Build-mode only. Where the shot opens and where it ends is the single
   * decision the clay pass exists to settle — it is the shot-size progression
   * the generation inherits verbatim. A brief without it produces a blockout
   * whose camera the operator invents, which puts the choice back in exactly
   * the place this workflow moved it out of.
   */
  if (mode === "build" && !has(b.startFraming) && !has(b.endFraming)) {
    issues.push({
      text: "No opening or closing framing.",
      why: "The shot-size progression is what the generation copies most literally. Left unstated, whoever builds the scene picks it, and it changes between rebuilds.",
    });
  }

  if (!has(b.lens)) {
    issues.push({
      text: "No focal length set.",
      why: "The model reads perspective from the clay. A lens picked to fix framing rather than to be real produces a fake-looking result.",
    });
  }

  if (!has(b.keyLight)) {
    issues.push({
      text: "No key light direction.",
      why: "Shadow direction and length are how the model builds its own lighting. Flat ambient gives it nothing to work from.",
    });
  }

  for (const beat of beats) {
    const from = Number(beat.from);
    const to = Number(beat.to);
    if (Number.isFinite(from) && Number.isFinite(to) && to - from < 1) {
      issues.push({
        text: `The beat at ${beat.from}–${beat.to}s is under a second.`,
        why: "Asking for a state change inside one second produces omissions, not precision. Give each change room to be visible.",
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Vendor tooling that overlaps this workflow
// ---------------------------------------------------------------------------

/**
 * Higgsfield shipped a Blender add-on in late August 2026 that automates part
 * of what this page describes. Saying nothing about it would be the wrong call
 * for a page arguing that knowing the landscape is the job — but so would
 * pretending it settles the question. It automates the geometry; it does not
 * supply the judgment about what the model reads.
 *
 * Everything here is from vendor material and secondary coverage rather than
 * hands-on use, which the page states rather than hides.
 */
export const VENDOR_OVERLAP = {
  name: "Higgsfield for Blender",
  dated: "Late August 2026",
  what: "An add-on that prompts an editable blockout into your open .blend, animates a camera from a description as real bones and keyframes, and can trigger Seedance renders — with an MCP bridge so an agent works in the scene directly. Seven tabs, Blender 4.2–5.1, on the same credits as their other plugins.",
  helps: [
    {
      k: "First blockout, faster",
      v: "Getting to a rough scene is the slowest manual part of this workflow. A prompted blockout that arrives as editable geometry is a real saving.",
    },
    {
      k: "Camera as a rig, not a description",
      v: "It animates to standard bones and actions, so the curves are tweakable rather than regenerated — the same property that makes a clay pass worth building.",
    },
    {
      k: "Reblocking",
      v: "Layout changes late are the expensive kind. Re-prompting a previz blockout is cheaper than re-keying one by hand.",
    },
  ],
  doesNotChange: [
    {
      k: "A blockout is not automatically a control pass",
      v: "Neutral grey, one flat ID colour per mapped subject, one unambiguous light direction, contact shadows, 24 fps, no text or gizmos. Geometry arriving faster does not make it legible to the model — the checklist above still decides that.",
    },
    {
      k: "The prompt still has to bind the references",
      v: "Material roles and the exclusion block are what stop grey plastic and empty void leaking into the result. No plugin writes those for you.",
    },
    {
      k: "Diagnosis is still the scarce skill",
      v: "Deciding whether a bad take is a clay problem, a prompt problem or a look-reference problem is where the credits are saved or wasted, and that judgment does not ship in an add-on.",
    },
    {
      k: "Their own docs scope it to previz",
      v: "Blockout is not a production asset — clean topology, UVs and instancing are still modelling work, and reblocking mid-production with cached simulations is explicitly not the easy case.",
    },
  ],
  /** The detail that decides whether it is cheap, and the easiest one to miss. */
  costCatch:
    "The unlimited Seedance plans that make Higgsfield look inexpensive are, by their own terms, available only through higgsfield.ai directly — not through MCP, CLI, Canvas or Supercomputer. Drive it from an agent or the API and you are back on per-generation credits.",
  verdict:
    "Worth using as a front end to the clay pass. Not a reason to move a production pipeline onto it — this studio generates through fal, where the routing, cost model and quality gates already live, and a vendor suite would trade those for an integration it does not need.",
  caveat:
    "Assembled from vendor material and secondary coverage, not hands-on use. Two things worth confirming against the live docs before committing: whether the API exposes Seedance 2.5 reference-to-video with video references, and whether the add-on's blockout is neutral clay or merely untextured geometry.",
};
