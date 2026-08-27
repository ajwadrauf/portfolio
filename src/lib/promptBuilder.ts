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
  | "opening"
  | "middle"
  | "climax"
  | "text"
  | "audio";

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

export const BLOCKS: BuilderBlock[] = [
  {
    id: "register",
    n: "01",
    label: "Register — what kind of film is this",
    why: "The first clause sets the whole grade. \"Bright and colourful commercial style\" and \"moody cinematic short\" produce different lighting, different lenses and different cutting from identical instructions further down. Say it first and say it plainly; a model that has to infer the register infers it late, after it has already committed to a look.",
    placeholder: "Bright and colourful commercial style…",
    example: "Bright and colourful commercial style, clean and premium, rhythmically driven.",
  },
  {
    id: "subject",
    n: "02",
    label: "Subject and variants — what is the star",
    why: "Name the hero and name the set it belongs to. \"Four flavours: strawberry, apple, grape and orange\" tells the model there are exactly four things to arrange, so it stops inventing a fifth. Vagueness here is the single most expensive kind: every later instruction is applied to whatever the model decided the subject was.",
    placeholder: "…fruit-flavoured biscuits as the star, in four flavours: …",
    example:
      "Fruit-flavoured biscuits are the star, in four flavours — strawberry, apple, grape and orange — each paired with its own fruit.",
  },
  {
    id: "bindings",
    n: "03",
    label: "Reference bindings — what each reference is FOR",
    why: "This is the part almost everyone skips, and it is the part that stops product drift. Uploading references is not enough: each one needs a stated job, bound inline where it applies. \"Strawberry references [Image1]\" is an instruction. Attaching six images and hoping is not. A reference with no job gets averaged into the general vibe.",
    placeholder: "Strawberry flavour references [Image1]. …",
    example:
      "The strawberry pack references [Image1] and must stay pixel-consistent throughout — same packaging, same label text, same proportions. The opening composition references [Video1]. The cutting rhythm and camera movement reference [Video2].",
    weavesTokens: true,
  },
  {
    id: "arrangement",
    n: "04",
    label: "Arrangement — how the frame is organised",
    why: "Composition is a separate decision from subject, and models are good at it when told. \"Arranged in highly ordered geometric arrays\" is a layout rule the model can actually execute. Leave it out and you get a competent product on an arbitrary table.",
    placeholder: "…arranged in highly ordered geometric arrays, top-down…",
    example:
      "Biscuits and their fruits are arranged in highly ordered geometric arrays, shot top-down on a saturated single-colour background.",
  },
  {
    id: "opening",
    n: "05",
    label: "Opening beat — the first two seconds",
    why: "Short-form is won or lost in the first beat, so specify it separately rather than letting it fall out of the description. Naming what establishes focus, and what the sound is doing at that moment, is what makes an opening feel deliberate instead of like the start of a longer clip.",
    placeholder: "The opening establishes visual focus on…",
    example:
      "The opening establishes visual focus tight on the fruit, with the music dropping on the downbeat.",
  },
  {
    id: "middle",
    n: "06",
    label: "Middle beats — what happens, in order",
    why: "Numbered or sequenced action is the difference between a video and a moving photograph. Models follow ordered clauses well: this, then this, then this. Where a reference governs one of those beats, bind it to that beat rather than to the prompt in general.",
    placeholder: "The variants then line up in neat formations, cutting to…",
    example:
      "The flavours then line up in neat formations, cutting to a close-up on each in turn, matching the cut timing of [Video2].",
    weavesTokens: true,
  },
  {
    id: "climax",
    n: "07",
    label: "Climax — the payoff shot",
    why: "Every ad has one moment it is actually selling: the snap, the pour, the seal breaking. Describe it physically — what breaks, what scatters, what the speed does — because this is the shot people screenshot, and it is the one a model will under-deliver if you leave it as \"a satisfying moment\".",
    placeholder: "At the climax, … — instantly entering slow motion as…",
    example:
      "At the climax a biscuit is snapped in half and the shot instantly enters slow motion: the fruit filling bursts open, crumbs scatter, every grain readable.",
  },
  {
    id: "text",
    n: "08",
    label: "On-screen text — exact words, exact position",
    why: "Anything in quotation marks tends to be rendered literally, so put the real copy in quotes and say where it sits and when it arrives. Describing text instead of quoting it produces plausible-looking gibberish, which is the most common reason an otherwise good take is unusable.",
    placeholder: '"BRAND" top-left, "Tagline" middle-left, "$0.00" bottom-right…',
    example:
      'Bold stark text snaps on at the end: "NO NAME" top-left, "Simple. Done right." middle-left, "$3.99" bottom-right.',
    optional: true,
  },
  {
    id: "audio",
    n: "09",
    label: "Sound — what the model should render",
    why: "On a model that generates audio with the picture, the sound cue is free quality: effects described here land on the right frame because they are made from the same latent space as the image. Be specific about effects and explicit about music — a video model approximates music rather than composing it, so if a real track is coming later, say no music here.",
    placeholder: "Audio: crisp granular sounds of… Sound effects only, no music.",
    example:
      "Audio: crisp granular sounds of the biscuits settling, a tight snap at the break, a deep slow-motion whoosh at the climax. Sound effects and ambience only — no music, no score.",
  },
];

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

export const assemble = (values: Record<string, string>) =>
  BLOCKS.map((b) => (values[b.id] ?? "").trim())
    .filter(Boolean)
    .join(" ");

export const exampleValues = (): Record<string, string> =>
  Object.fromEntries(BLOCKS.map((b) => [b.id, b.example]));

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
