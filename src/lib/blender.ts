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
};

/** A worked example, so the form is never a wall of empty boxes. */
export const EXAMPLE_BRIEF: BlenderBrief = {
  shotId: "1A",
  aspect: "1:1",
  seconds: "12",
  sensor: "36mm full frame",
  lens: "50",
  rig: "slow dolly push, 0.4 m/s",
  startFraming: "Medium, product centre frame, eye level",
  endFraming: "Close, product fills 60% of frame height",
  keyLight: "Sun, 45° off camera left, 30° elevation, soft fill camera right at quarter key",
  lightCharacter: "Warm morning window light",
  subjects: [
    { color: "orange", proxy: "box on the counter", becomes: "the product package", ref: "Image 1" },
    { color: "blue", proxy: "jointed arm entering from the right", becomes: "a hand and forearm", ref: "Image 2" },
    { color: "neutral grey", proxy: "counter and back wall", becomes: "a kitchen counter at morning", ref: "Image 3" },
  ],
  beats: [
    { from: "0", to: "4", action: "The hand sets the package down centre frame and withdraws. The package holds still, label to camera." },
    { from: "4", to: "9", action: "The camera pushes in slowly. Light shifts warmer across the surface as it travels." },
    { from: "9", to: "12", action: "The push settles. The final frame holds on the package, filling most of the height." },
  ],
  creative:
    "A single product placed on a morning kitchen counter, shot on a slow dolly push in warm window light, photoreal and unhurried.",
  composited: "wordmark, legal line, price",
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
    ...mapped.map((s, i) => ({
      slot: `@${has(s.ref) ? clean(s.ref) : `Image ${i + 1}`}`,
      order: i + 2,
      color: swatchFor(s.color),
      colorName: clean(s.color),
      what: clean(s.becomes),
      role: has(s.proxy) ? `Replaces the ${clean(s.color)} ${clean(s.proxy)}` : "Look and finish",
    })),
  ];
}

/** "a rectangular box" → "rectangular box", so "The orange a box" cannot happen. */
const dropArticle = (s: string) => clean(s).replace(/^(a|an|the)\s+/i, "");
const has = (s: string) => clean(s).length > 0;

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

  const refs = mapped.map((s, i) => (has(s.ref) ? clean(s.ref) : `Image ${i + 1}`));
  const materials = mapped.map(
    (s, i) => `@${refs[i]} ${clean(s.becomes).replace(/^(a|an|the)\s+/i, "")}`,
  );
  out.push(
    `MODE: Clay Renderer / Omni Reference`,
    `MATERIALS: @Video 1 clay blockout${materials.length ? ` · ${materials.join(" · ")}` : ""}`,
    `SETTINGS: Match @Video 1 duration and camera route · ${b.aspect} · 720p`,
    "",
    "[Reference roles]",
    "@Video 1 is a clay blockout. Inherit only camera movement, shot-size transitions, subject trajectories, blocking, timing, occlusion order, and the direction of the light.",
  );

  for (const s of mapped) {
    const proxy = has(s.proxy)
      ? `The ${clean(s.color)} ${dropArticle(s.proxy)}`
      : `The ${clean(s.color)} element`;
    out.push(
      `${proxy} becomes ${clean(s.becomes)}${has(s.ref) ? `, defined by @${clean(s.ref)}` : ""}.`,
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

  out.push(
    "",
    "[Exclusions]",
    "No text, no captions, no subtitles, no on-screen type, no logos, no watermarks, no background music. Do not inherit primitive geometry, flat grey materials, placeholder shapes, axes, guide lines, path curves, camera frustums, or the empty set from @Video 1 — use it only for camera movement, blocking, motion paths, timing, occlusion order and light direction.",
  );

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
export function briefIssues(b: BlenderBrief): { text: string; why: string }[] {
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

  for (const s of mapped) {
    if (!has(s.ref)) {
      issues.push({
        text: `"${clean(s.becomes)}" has no look reference.`,
        why: "Without one the model invents its appearance, and invents it differently on every generation. That is the most common source of drift between takes.",
      });
    }
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
