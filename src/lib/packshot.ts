/**
 * Multi-angle packshot generation — the "product on white" planogram case.
 *
 * Retailers shoot every SKU at up to 6 GS1 planogram angles (front, back,
 * left, right, top, bottom) plus a 3/4 hero. Most of that is re-staging the
 * same object under the same light. With a grounded reference photo, an
 * editing-capable image model can synthesize the remaining angles — turning
 * a studio day per SKU into minutes.
 *
 * The honest constraint (and the governance layer in the UI): a generated
 * angle is only trustworthy where a real reference shows that face of the
 * package. Faces never captured are plausible reconstructions and MUST pass
 * label-accuracy QA before use — or be grounded by uploading that face.
 */

import type { OutputSizeSupport } from "./models";

/** Models eligible for packshot work (all support multi-image reference input). */
export const PACKSHOT_MODELS = [
  "nano-banana-pro",
  "nano-banana-flash",
  "flux-kontext",
  "seedream-4",
  "gpt-image-2-edit",
  "recraft-v4.1-utility-pro",
];

export type PackAngle =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "hero34";

export type AngleSpec = {
  id: PackAngle;
  label: string;
  /** GS1-style facing token used in the output filename. */
  fileToken: string;
  /** Which reference angles fully ground this target (visible face shown). */
  groundedBy: PackAngle[];
  prompt: string;
};

const BASE =
  "Professional e-commerce packshot on a pure white background (#FFFFFF), seamless with no visible floor line. Soft even studio lighting, faint natural contact shadow directly beneath the product only. The product must remain EXACTLY identical to the reference photos: same packaging, same proportions, same colors, same label text rendered accurately and legibly. Sharp focus, catalog quality, product fills the frame with a small even margin. No props, no reflections, no added text or graphics.";

export const PACK_ANGLES: AngleSpec[] = [
  {
    id: "front",
    label: "Front",
    fileToken: "front",
    groundedBy: ["front"],
    prompt: `${BASE} Camera: straight-on front view at product mid-height, facing the primary display panel squarely.`,
  },
  {
    id: "back",
    label: "Back",
    fileToken: "back",
    groundedBy: ["back"],
    prompt: `${BASE} Camera: straight-on back view at product mid-height, showing the back panel squarely.`,
  },
  {
    id: "left",
    label: "Left side",
    fileToken: "left",
    groundedBy: ["left"],
    prompt: `${BASE} Camera: straight-on view of the product's left side panel at mid-height.`,
  },
  {
    id: "right",
    label: "Right side",
    fileToken: "right",
    groundedBy: ["right"],
    prompt: `${BASE} Camera: straight-on view of the product's right side panel at mid-height.`,
  },
  {
    id: "top",
    label: "Top",
    fileToken: "top",
    groundedBy: ["top"],
    prompt: `${BASE} Camera: directly overhead, looking straight down at the top of the product.`,
  },
  {
    id: "bottom",
    label: "Bottom",
    fileToken: "bottom",
    groundedBy: ["bottom"],
    prompt: `${BASE} Camera: view of the underside of the product, as if the product were tilted to show its base squarely.`,
  },
  {
    id: "hero34",
    label: "3/4 Hero",
    fileToken: "hero",
    groundedBy: ["front", "left", "right"],
    prompt: `${BASE} Camera: three-quarter hero angle, rotated roughly 30 degrees from front toward the right side and slightly above mid-height, giving gentle dimensionality while the front panel stays dominant and fully legible.`,
  },
];

export const getAngle = (id: PackAngle): AngleSpec => {
  const a = PACK_ANGLES.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown angle: ${id}`);
  return a;
};

/** GS1-style planogram filename, e.g. 6565170002_enfr_left_GS1_Planogram.jpg */
export function gs1FileName(sku: string, lang: string, angle: PackAngle): string {
  const token = getAngle(angle).fileToken;
  const safeSku = (sku || "SKU").replace(/[^A-Za-z0-9-]/g, "");
  return `${safeSku}_${lang}_${token}_GS1_Planogram.jpg`;
}

/**
 * A target angle is "grounded" when at least one uploaded reference shows
 * that face. Ungrounded targets are reconstructions → mandatory label QA.
 */
export function isGrounded(target: PackAngle, provided: PackAngle[]): boolean {
  return getAngle(target).groundedBy.some((g) => provided.includes(g));
}

/**
 * The intake variables, and why each one exists.
 *
 * Uploading a front photo tells the model two things: what the label looks
 * like, and roughly what the silhouette is. It tells it nothing about what the
 * object *is* — and every one of the remaining angles is a guess about volume,
 * material and how the pack holds its shape. That is where reconstructions go
 * wrong, and they go wrong in ways that read as cheap rather than as wrong:
 * a stand-up pouch rendered with the rigidity of a carton, a matte kraft bag
 * with the specular highlight of gloss laminate, a 2kg sack in the proportions
 * of a 200g one.
 *
 * None of these can be inferred from a flat photo of the front. All of them
 * are one line to type. Each field below is a variable the prompt interpolates
 * into a physical description of the object, so the model is reconstructing a
 * thing rather than extruding a picture.
 */
export type PackVariable = {
  id: keyof PackBrief;
  label: string;
  placeholder: string;
  /** What goes wrong when it is left blank. */
  why: string;
  options?: string[];
};

export type PackBrief = {
  format: string;
  material: string;
  dimensions: string;
  fill: string;
  closure: string;
  labelCoverage: string;
  notes: string;
};

export const EMPTY_BRIEF: PackBrief = {
  format: "",
  material: "",
  dimensions: "",
  fill: "",
  closure: "",
  labelCoverage: "",
  notes: "",
};

export const PACK_VARIABLES: PackVariable[] = [
  {
    id: "format",
    label: "Pack format",
    placeholder: "stand-up pouch",
    why: "Decides the silhouette from every angle you did not photograph. A pouch, a carton and a tub photograph almost identically head-on and share nothing in profile.",
    options: [
      "stand-up pouch",
      "pillow bag",
      "folding carton",
      "rigid box",
      "bottle",
      "jar",
      "can",
      "tub",
      "tray with film lid",
      "shrink multipack",
    ],
  },
  {
    id: "material",
    label: "Material and finish",
    placeholder: "matte kraft laminate",
    why: "Decides how light behaves. Matte, gloss, foil and clear plastic differ mostly in their highlights, and a wrong highlight is the single clearest tell that a packshot was generated.",
    options: [
      "matte kraft laminate",
      "gloss laminate",
      "metallised foil",
      "clear PET",
      "frosted plastic",
      "uncoated board",
      "aluminium",
      "glass",
    ],
  },
  {
    id: "dimensions",
    label: "Dimensions (H × W × D)",
    placeholder: "280 × 190 × 80 mm",
    why: "Decides proportion, which is the most common reconstruction failure and the hardest to spot in isolation — the pack looks right until it sits on a planogram beside a real one.",
  },
  {
    id: "fill",
    label: "Fill and structure",
    placeholder: "full, taut, stands unaided",
    why: "Decides whether a flexible pack reads as flexible. A part-filled pouch slumps and creases; the same pouch described as full stands square. Left blank, the model usually renders it rigid.",
    options: [
      "full, taut, stands unaided",
      "part-filled, slumping at the top",
      "loosely filled, soft and creased",
      "rigid — holds its shape regardless",
    ],
  },
  {
    id: "closure",
    label: "Closure and features",
    placeholder: "zip track under a tear notch, bottom gusset",
    why: "These are the details a side or top view is mostly made of, and they are invisible in a front photo. Unstated, the model invents a plain seam.",
  },
  {
    id: "labelCoverage",
    label: "Label coverage",
    placeholder: "front panel only, rest plain kraft",
    why: "Decides what the unseen faces carry. Without it a full-wrap design gets repeated onto a plain back, or a plain back gets invented for a full-wrap pack.",
    options: [
      "front panel only, rest plain",
      "front and back panels printed",
      "full wrap, printed on every face",
      "sleeve around a plain container",
    ],
  },
];

/** Everything the author actually filled in, as a physical description. */
export function describePack(b: PackBrief): string {
  const bits: string[] = [];
  const t = (v: string) => v.trim();
  if (t(b.format)) bits.push(`The product is a ${t(b.format)}`);
  if (t(b.dimensions)) bits.push(`measuring ${t(b.dimensions)}`);
  if (t(b.material)) bits.push(`made of ${t(b.material)}`);
  const head = bits.length ? `${bits.join(", ")}.` : "";
  const rest: string[] = [];
  if (t(b.fill)) rest.push(`It is ${t(b.fill)}.`);
  if (t(b.closure)) rest.push(`Structural features: ${t(b.closure)}.`);
  if (t(b.labelCoverage)) rest.push(`Printed artwork coverage: ${t(b.labelCoverage)}.`);
  if (t(b.notes)) rest.push(`${t(b.notes)}.`);
  return [head, ...rest].filter(Boolean).join(" ");
}

/**
 * How many of the six variables are set.
 *
 * Surfaced in the UI because the failure this guards against is silent: a
 * brief with none of them filled still generates, still looks plausible, and
 * is wrong in exactly the ways nobody checks for.
 */
export function briefCompleteness(b: PackBrief): { filled: number; total: number } {
  const filled = PACK_VARIABLES.filter((v) => b[v.id].trim()).length;
  return { filled, total: PACK_VARIABLES.length };
}

/**
 * Resolve a requested size against what the model will actually render.
 *
 * Returns what to put on the wire plus, when the request could not be honoured
 * exactly, a line saying so. Silently rendering 1K for a 4K request is the
 * failure this exists to prevent: the file arrives, it looks fine on screen,
 * and it is a quarter of the pixels the planogram spec asked for.
 */
export function resolveSize(
  support: OutputSizeSupport | undefined,
  requested: { presetId?: string; px?: number },
): { presetId?: string; px?: number; note?: string } {
  if (!support) return {};
  if (support.mode === "aspect") {
    return {
      px: support.presets[0]?.px,
      note: requested.presetId || requested.px
        ? "This model does not take an output size — it renders at its own resolution and only the shape is yours to choose."
        : undefined,
    };
  }
  if (requested.px && support.custom) {
    const { min, max, multipleOf } = support.custom;
    const clamped = Math.min(Math.max(requested.px, min), max);
    const snapped = Math.round(clamped / multipleOf) * multipleOf;
    return {
      px: snapped,
      note:
        snapped !== requested.px
          ? `${requested.px}px is not renderable here — using ${snapped}px, the nearest size within ${min}–${max} that divides by ${multipleOf}.`
          : undefined,
    };
  }
  // Tier models, and pixel models asked for a named preset.
  const exact = support.presets.find((p) => p.id === requested.presetId);
  if (exact) return { presetId: exact.id, px: exact.px };
  if (requested.px) {
    const nearest = support.presets.reduce((best, p) =>
      Math.abs(p.px - requested.px!) < Math.abs(best.px - requested.px!) ? p : best,
    );
    return {
      presetId: nearest.id,
      px: nearest.px,
      note:
        nearest.px !== requested.px
          ? `This model renders at named tiers only — ${requested.px}px was rounded to ${nearest.label}.`
          : undefined,
    };
  }
  const fallback = support.presets[Math.min(1, support.presets.length - 1)];
  return { presetId: fallback.id, px: fallback.px };
}

export function buildPackshotPrompt(
  target: PackAngle,
  provided: PackAngle[],
  brief?: Partial<PackBrief> | string,
): string {
  const spec = getAngle(target);
  const refList =
    provided.length > 0
      ? `Reference photos provided show these faces of the product: ${provided.join(", ")}.`
      : "";
  const grounded = isGrounded(target, provided)
    ? ""
    : " The requested face is not shown in any reference photo: reconstruct it conservatively and consistently with the visible packaging design, keeping brand elements coherent — this output will be flagged for label review.";
  /*
   * The physical description leads, before the camera instruction.
   *
   * It is describing the object the camera is being pointed at, and an
   * instruction to shoot the left side means something different once the
   * model knows the thing has a gusset. A string is still accepted so the
   * older shape of this call keeps working.
   */
  const described =
    typeof brief === "string"
      ? brief.trim()
      : brief
        ? describePack({ ...EMPTY_BRIEF, ...brief })
        : "";
  const physical = described ? ` ${described}` : "";
  return `${refList}${physical} ${spec.prompt}${grounded}`.trim();
}
