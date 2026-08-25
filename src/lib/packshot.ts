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

/** Models eligible for packshot work (all support multi-image reference input). */
export const PACKSHOT_MODELS = [
  "nano-banana-pro",
  "nano-banana-flash",
  "flux-kontext",
  "seedream-4",
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

export function buildPackshotPrompt(
  target: PackAngle,
  provided: PackAngle[],
  productNotes?: string,
): string {
  const spec = getAngle(target);
  const refList =
    provided.length > 0
      ? `Reference photos provided show these faces of the product: ${provided.join(", ")}.`
      : "";
  const grounded = isGrounded(target, provided)
    ? ""
    : " The requested face is not shown in any reference photo: reconstruct it conservatively and consistently with the visible packaging design, keeping brand elements coherent — this output will be flagged for label review.";
  const notes = productNotes ? ` Product notes: ${productNotes}.` : "";
  return `${refList} ${spec.prompt}${grounded}${notes}`.trim();
}
