/**
 * The prompt builder.
 *
 * A reference-to-video prompt is not a sentence you write — it is a structure
 * you fill. Look at any prompt that works on Seedance and the same nine parts
 * are there in the same order: register, subject, what each reference is FOR,
 * how the frame is arranged, the opening beat, the middle beats, the climax,
 * the text, the sound. Take one part out and the model fills the gap with its
 * own idea, which is where drift comes from.
 *
 * This file is that structure, with the reasoning attached to each part. The
 * page is a form; the lesson is the order of the fields.
 */

export type BlockId =
  | "register"
  | "subject"
  | "bindings"
  | "arrangement"
  | "text"
  | "music";

export type BuilderBlock = {
  id: BlockId;
  n: string;
  label: string;
  /** What this part is doing, and what goes wrong without it. */
  why: string;
  placeholder: string;
  /** The worked example, written in the pattern the good prompts follow. */
  example: string;
  /** Reference tokens are woven into this part rather than listed after it. */
  weavesTokens?: boolean;
  optional?: boolean;
};

/** Parts that sit before the timeline. */
export const HEAD_BLOCKS: BuilderBlock[] = [
  {
    id: "register",
    n: "01",
    label: "Register — what kind of film is this",
    why: "The first clause sets the whole grade. \"Bright and colourful commercial style\" and \"moody cinematic short\" produce different lighting, different lenses and different cutting from identical instructions further down. Say it first and say it plainly; a model that has to infer the register infers it late, after it has already committed to a look.",
    placeholder: "Top-down overhead flat-lay on a bright yellow background, static camera…",
    example:
      "Top-down overhead flat-lay on a bright, iconic yellow monochromatic background, static camera, snappy high-contrast stop-motion aesthetic.",
  },
  {
    id: "subject",
    n: "02",
    label: "Subject and variants — what is the star",
    why: "Name the hero and name the set it belongs to. \"Four flavours: strawberry, apple, grape and orange\" tells the model there are exactly four things to arrange, so it stops inventing a fifth. Vagueness here is the single most expensive kind: every later instruction is applied to whatever the model decided the subject was.",
    placeholder: "…a tub of vanilla ice milk, its cone, and the syrup…",
    example:
      "The star is a bright yellow plastic tub of vanilla ice milk, shown alongside a waffle cone, a scoop and chocolate syrup.",
  },
  {
    id: "bindings",
    n: "03",
    label: "Reference bindings — what each reference is FOR",
    why: "This is the part almost everyone skips, and it is the part that stops product drift. Uploading references is not enough: each one needs a stated job, bound inline where it applies. \"The pack references [Image1]\" is an instruction. Attaching six files and hoping is not. And bind by token, never by filename — the model resolves references positionally and has never seen what your file is called.",
    placeholder: "[Image1] is the reference for the exact packaging and label…",
    example:
      "[Image1] is the reference for the exact appearance, packaging, proportions and label of the product. [Video1] is the reference for the camera position and the reverse-action stop-motion pacing. Hold the product in [Image1] pixel-consistent throughout: same packaging, same label text, same proportions, no drift, no re-imagining.",
    weavesTokens: true,
  },
  {
    id: "arrangement",
    n: "04",
    label: "Arrangement — how the frame is organised",
    why: "Composition is a separate decision from subject, and models are good at it when told. \"Everything centred, nothing else in frame\" is a layout rule the model can execute. Leave it out and you get a competent product on an arbitrary table.",
    placeholder: "Everything sits centred in frame, nothing else in shot…",
    example:
      "Every element enters and exits a single centred composition; nothing else is ever in frame.",
  },
];

/** Parts that sit after the timeline. */
export const TAIL_BLOCKS: BuilderBlock[] = [
  {
    id: "text",
    n: "06",
    label: "On-screen text — exact words, exact position",
    why: "Anything in quotation marks tends to be rendered literally, so put the real copy in quotes and say where it sits and when it arrives. Describing text instead of quoting it produces plausible-looking gibberish, which is the most common reason an otherwise good take is unusable.",
    placeholder: 'Bold stark text snaps on: "BRAND" top-left, "$0.00" bottom-right…',
    example:
      'Bold stark black text snaps on: "no name" top-left, "Simple Scoop, Sweet Value" middle-left, "$3.99" bottom-right.',
    optional: true,
  },
  {
    id: "music",
    n: "07",
    label: "Music bed — or an explicit refusal",
    why: "A video model approximates music rather than composing it, so this is a fork rather than a field. If a real track is coming from a music model afterwards, say no music here or the two layers fight. If the model is carrying everything, brief the bed the way a composer would — genre, tempo, instrumentation.",
    placeholder: "Underscored by a playful indie-pop bed at 128 BPM… — or: no music.",
    example:
      "Underscored by a playful indie-pop advertising bed at 128 BPM: staccato muted electric guitar, bouncy upright bass, glockenspiel accents.",
    optional: true,
  },
];

export const BLOCKS: BuilderBlock[] = [...HEAD_BLOCKS, ...TAIL_BLOCKS];

/**
 * The timeline.
 *
 * Duration is set by the API, not by the prompt — writing "14 seconds" does
 * not make a 14-second video, the duration parameter does. What timestamps in
 * the prompt actually buy you is two things. The model gets explicit ordering
 * and relative weight, which is real. And you are forced to do the
 * arithmetic: five beats in eight seconds is 1.6 seconds each, which is too
 * fast to read, and the only cheap moment to notice that is before you spend.
 *
 * They are a proportional plan, not a frame-accurate cue sheet. Models have
 * no clock.
 */
export type BeatRole = "open" | "build" | "climax" | "resolve";

export const BEAT_ROLES: { id: BeatRole; label: string; guidance: string }[] = [
  {
    id: "open",
    label: "Open",
    guidance:
      "The first beat decides whether anyone sees the rest. Establish the subject and the register immediately — this is not the place for a slow reveal in a cut this short.",
  },
  {
    id: "build",
    label: "Build",
    guidance:
      "Sequenced action the model can follow: this, then this. Where a reference governs the beat, bind it here rather than in the prompt at large.",
  },
  {
    id: "climax",
    label: "Climax",
    guidance:
      "The one moment the ad is selling. Describe it physically — what breaks, what scatters, what the speed does. Size it to its kind rather than by rule: a slow-motion payoff needs room to be read, a snap reveal is ruined by it. What matters is that exactly one beat is marked as this one.",
  },
  {
    id: "resolve",
    label: "Resolve",
    guidance:
      "The product, the price, the lockup. Needs long enough to read — a price card that flashes past in half a second is a wasted beat.",
  },
];

export type Beat = {
  seconds: number;
  role: BeatRole;
  action: string;
  /** An effect that lands inside this beat, timestamped on assembly. */
  audio: string;
};

/** Seedance renders 4-30s; other models cap lower. */
export const DURATION_BOUNDS = { min: 4, max: 30 } as const;
/** Under this, a beat is too short to read as a beat. */
export const MIN_BEAT_SECONDS = 1.5;

export const mmss = (t: number) => {
  const m = Math.floor(t / 60);
  const sec = Math.round(t % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/** Running start/end times for each beat. */
export function beatTimes(beats: Beat[]): { start: number; end: number }[] {
  let t = 0;
  return beats.map((b) => {
    const start = t;
    t += b.seconds;
    return { start, end: t };
  });
}

export const beatsTotal = (beats: Beat[]) =>
  beats.reduce((sum, b) => sum + (Number.isFinite(b.seconds) ? b.seconds : 0), 0);

/**
 * Everything worth warning about before a render is paid for.
 *
 * Each of these is a mistake that produces a plausible-looking failure rather
 * than an error, which is the expensive kind.
 */
export function timelineIssues(
  beats: Beat[],
  duration: number,
  prompt: string,
  slots: Slot[],
): { level: "error" | "warn"; text: string }[] {
  const out: { level: "error" | "warn"; text: string }[] = [];
  const total = beatsTotal(beats);

  if (beats.length && Math.abs(total - duration) > 0.01) {
    out.push({
      level: "error",
      text:
        total > duration
          ? `The beats add up to ${total}s but the render is ${duration}s. The model will compress everything to fit, so the beat you cared about gets the same squeeze as the rest. Cut ${(total - duration).toFixed(1)}s, or raise the duration.`
          : `The beats add up to ${total}s but the render is ${duration}s. The model pads the remainder, usually by holding the last frame. Add ${(duration - total).toFixed(1)}s of action, or lower the duration.`,
    });
  }

  const short = beats.filter((b) => b.seconds > 0 && b.seconds < MIN_BEAT_SECONDS);
  if (short.length) {
    out.push({
      level: "warn",
      text: `${short.length} beat${short.length === 1 ? " is" : "s are"} under ${MIN_BEAT_SECONDS}s. At that length an action registers as a flicker rather than a beat — either give it room or fold it into its neighbour.`,
    });
  }

  if (beats.length && !beats.some((b) => b.role === "climax")) {
    out.push({
      level: "warn",
      text: "No beat is marked as the climax. Every ad has one moment it is actually selling; if the timeline does not say which, the model distributes emphasis evenly and none of it lands.",
    });
  }

  // Referring to a reference by filename is the classic silent failure.
  const filename = prompt.match(/[\w-]+\.(?:mp4|mov|webm|jpe?g|png|webp|mp3|wav)/i);
  if (filename) {
    out.push({
      level: "error",
      text: `"${filename[0]}" is a filename. The model resolves references positionally as [Image1], [Video1] and so on — it has never seen what your file is called, so a filename is read as literal text and the reference is silently ignored. Bind by token instead.`,
    });
  }

  const defined = new Set(slots.map((_, i) => tokenFor(slots, i)));
  const used = new Set(prompt.match(/\[(?:Image|Video|Audio)\d+\]/g) ?? []);
  const dangling = [...used].filter((t) => !defined.has(t));
  if (dangling.length) {
    out.push({
      level: "error",
      text: `${dangling.join(", ")} ${dangling.length === 1 ? "is" : "are"} referenced but not declared above. A token pointing at nothing fails quietly — you get a plausible take built on the wrong reference.`,
    });
  }

  return out;
}

export type SlotMedia = "image" | "video" | "audio";

export type Slot = {
  media: SlotMedia;
  /** What this reference is for, in the user's own words. */
  job: string;
};

/** The worked example's reference set, matching the example copy above. */
export const EXAMPLE_SLOTS: Slot[] = [
  { media: "image", job: "the strawberry pack — product identity" },
  { media: "video", job: "the opening composition" },
  { media: "video", job: "cut rhythm and camera movement" },
];

/** Tokens are numbered per media type, exactly as the model resolves them. */
export function tokenFor(slots: Slot[], index: number): string {
  const media = slots[index].media;
  const n = slots.slice(0, index + 1).filter((s) => s.media === media).length;
  const label = media === "image" ? "Image" : media === "video" ? "Video" : "Audio";
  return `[${label}${n}]`;
}

/**
 * Assembles the whole prompt.
 *
 * Head blocks, then the timeline as a timestamped list, then the text and the
 * audio. The audio line is built rather than typed: each beat's effect is
 * emitted with the timestamp of the beat it belongs to, so "a ding at 0:12"
 * comes from the ding having been written into the beat where the price
 * lands, not from someone counting.
 */
export function assemble(
  values: Record<string, string>,
  beats: Beat[],
  duration: number,
  throughline: string,
): string {
  const head = HEAD_BLOCKS.map((b) => (values[b.id] ?? "").trim()).filter(Boolean);
  const parts = [...head];

  const written = beats.filter((b) => b.action.trim());
  if (written.length) {
    const times = beatTimes(beats);
    const lines = beats
      .map((b, i) =>
        b.action.trim()
          ? `${mmss(times[i].start)}–${mmss(times[i].end)}: ${b.action.trim()}`
          : "",
      )
      .filter(Boolean);
    parts.push(
      `The sequence plays across ${duration} seconds. ${lines.join(" ")}`,
    );
  }

  const text = (values.text ?? "").trim();
  if (text) parts.push(text);

  // Audio: the throughline, then each beat's effect at its own timestamp,
  // then the music decision.
  const times = beatTimes(beats);
  const cues = beats
    .map((b, i) =>
      b.audio.trim() ? `${b.audio.trim().replace(/\.$/, "")} at ${mmss(times[i].start)}` : "",
    )
    .filter(Boolean);
  const music = (values.music ?? "").trim();
  const audioBits = [throughline.trim(), ...cues].filter(Boolean);
  if (audioBits.length || music) {
    parts.push(
      `Audio: ${audioBits.join(", ")}${audioBits.length ? "." : ""}${music ? ` ${music}` : ""}`.trim(),
    );
  }

  return parts.join(" ");
}

export const exampleValues = (): Record<string, string> =>
  Object.fromEntries(BLOCKS.map((b) => [b.id, b.example]));

export const EXAMPLE_DURATION = 14;

export const EXAMPLE_THROUGHLINE =
  "rewind reverse-playback whoosh throughout, backwards food movement";

/** The worked example's timeline — the arithmetic adds up to 14s on purpose. */
export const EXAMPLE_BEATS: Beat[] = [
  {
    seconds: 3,
    role: "open",
    action:
      "Open on a waffle cone holding a perfect scoop of vanilla ice milk drizzled with chocolate syrup, centred in frame. A hand enters and slides the cone slightly.",
    audio: "a soft scrape as the cone slides",
  },
  {
    seconds: 3,
    role: "build",
    action:
      "A silver spoon enters and pulls the chocolate syrup upward and off-screen in a fluid reverse-gravity motion.",
    audio: "",
  },
  {
    seconds: 3,
    role: "build",
    action:
      "An ice cream scoop enters, lifting the bare vanilla scoop upward out of the cone and out of frame.",
    audio: "",
  },
  {
    seconds: 2,
    role: "climax",
    action:
      "The empty cone is snatched away by a hand. Instantly the yellow plastic tub slides into the centre and its matching lid snaps on backward.",
    audio: "a sharp plastic snap for the lid",
  },
  {
    seconds: 3,
    role: "resolve",
    action:
      "A hand places the fully packaged product flat on the background and holds.",
    audio: "a crisp cash-register ding as the price appears",
  },
];

/**
 * The rules that are not obvious from the form itself.
 *
 * Every one of these is something that cost a take to learn rather than
 * something read in documentation.
 */
export const RULES = [
  {
    h: "Bind references inline, not in a list at the end",
    p: "A reference mentioned where it applies governs that clause. The same reference listed in a block at the bottom governs everything and therefore nothing — the model averages it into the general look instead of applying it to the shot you meant.",
  },
  {
    h: "Tokens are numbered per media type, not overall",
    p: "The first still is [Image1] and the first clip is [Video1] even if three images were uploaded before it. Get this wrong and the prompt points at a file that is not there, which fails silently — you get a plausible video built on the wrong reference.",
  },
  {
    h: "Quote the words you want rendered",
    p: 'Text inside quotation marks is treated as literal on-screen copy. "Describe the tagline" gets you invented letterforms; \'the tagline reads "Simple. Done right."\' gets you the tagline.',
  },
  {
    h: "Physics beats adjectives",
    p: "\"Crumbs scatter and the filling bursts open\" is executable. \"Looks delicious\" is not. Describe what moves, what breaks and what the speed does, and the model has something to simulate.",
  },
  {
    h: "State the register first and the sound last",
    p: "The opening clause sets the grade for everything after it; the audio cue reads best as a closing instruction because it applies across the whole take rather than to any one beat.",
  },
  {
    h: "One take, one climax",
    p: "Two payoff moments in a 15-second cut means neither lands. If a second idea is worth having, it is worth its own render — which at 480p costs about a fifth of a finished one.",
  },
];

/**
 * The same prompt is addressed differently depending on where it is run,
 * which is a five-minute mistake that looks like a model problem.
 */
export const SYNTAX_NOTE = {
  playground: "@Image1",
  api: "[Image1]",
  detail:
    "The Dreamina playground writes references as @Image1 because it resolves them from an attachment picker as you type. Through the API — which is what this studio uses — they are square-bracketed, [Image1]. The structure is identical; only the sigil changes. Paste a playground prompt straight into an API call with the @ intact and the tokens are read as literal text.",
};
