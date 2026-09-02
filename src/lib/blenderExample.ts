/**
 * A Blender-lane brief that is known to render.
 *
 * Every value here was taken from a request that came back with a video, not
 * from a plausible reconstruction of one: the prompt, the two reference URLs,
 * the length, the shape and the resolution are the ones that were actually
 * submitted. That matters because most of the ways this configuration can be
 * wrong fail silently or expensively — a reference the provider will not
 * accept, a token that resolves to nothing, a length that truncates the last
 * beat — and a worked example whose settings drifted from the run that
 * produced it teaches the wrong thing to whoever presses the button.
 *
 * It is also the shortest honest answer to "does this actually work?" for
 * someone reading the site: load it, look at what is attached, press generate.
 */

export type ExampleRef = {
  url: string;
  media: "image" | "video";
  /** Matches REFERENCE_ROLES ids in adPresets. */
  role: "product" | "motion";
  name: string;
  /** What this file is doing, for the panel that lists them. */
  note: string;
  /** Known duration of a clip, so the estimate is right before metadata loads. */
  seconds?: number;
};

/** The clay control pass. Public, and already fetched successfully by fal. */
const CLAY_CLIP =
  "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/01_clay_1A.mp4";

/** The pack. Unbranded on purpose — see the note in BLENDER_EXAMPLE. */
const PACK_STILL =
  "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/CookieExample/examplebag.png";

export const BLENDER_EXAMPLE = {
  label: "Cookie pack, shot 1A",
  /** Settings the successful request used. */
  seconds: 12,
  aspect: "4:3",
  resolution: "480p" as const,
  modelId: "seedance-2.5-ref",
  generateAudio: true,
  refs: [
    {
      url: CLAY_CLIP,
      media: "video",
      role: "motion",
      name: "01_clay_1A.mp4",
      seconds: 12,
      note: "The clay control pass — 12s of untextured geometry that fixes camera, blocking, timing and occlusion before a credit is spent.",
    },
    {
      url: PACK_STILL,
      media: "image",
      role: "product",
      name: "examplebag.png",
      note: "The pack. One still, held pixel-consistent — the only asset in the shot that cannot be allowed to drift.",
    },
  ] satisfies ExampleRef[],

  /**
   * Two things in this brief are worth reading rather than skimming, because
   * both were learned the expensive way.
   *
   * The pack is unbranded. Branded packaging is refused by the provider's
   * content filter — reported as a policy violation about the imagery, with no
   * mention of branding — so the wordmark is composited afterwards rather than
   * generated.
   *
   * There is exactly one still. The chips and the cookie are described in
   * words instead of referenced, and they render fine that way. The reference
   * slot is spent on the one thing that has to be itself.
   */
  prompt: `MODE: Clay Renderer / Omni Reference

MATERIALS: [Video1] clay blockout · [Image1] product pack

SETTINGS: Match [Video1] duration and camera route · 4:3 · 720p · 24fps · 12s

[Reference roles]

[Video1] is a clay blockout. Inherit only camera movement, subject trajectories, blocking, timing, occlusion, and light direction.

[Image1] is the product pack. Copy it exactly as shown — this is a reproduction, not an interpretation. Match the flat-bottom kraft paper bag in every respect: natural tan paper, gusseted sides, squared body, folded and ribbed top seal, and the black band across the base. Reproduce every printed element in its existing position and at its existing size: the cookie photograph with its scattered chocolate chips, peanuts and peanut butter swirl, the nutrition panel, the ingredient block, the distributor lines and the barcode. Same layout, same proportions, same paper texture, same colour. Hold it pixel-consistent for the whole take: no drift, no re-imagining, no substitution of any panel.

Blue chips: Semi-sweet chocolate chips — deep brown, rounded conical drops with a soft sheen.

Orange disc: A thick, golden peanut butter chocolate chip cookie — craggy surface, studded with chocolate chips and peanut butter chips, matching the cookie pictured on [Image1].

Green form (leftmost): The pack from [Image1].

Magenta form (second left): The pack from [Image1].

Yellow form (third left): The pack from [Image1].

Cyan form (rightmost): The pack from [Image1].

All four bags are the same pack, standing upright and turned to camera at the same three-quarter angle as [Image1], so the printed panel is visible.

[Creative direction]

A continuous macro-to-wide move through a landscape of chocolate chips. A hero cookie settles into the chips, and a row of four kraft packs rises behind it. Warm, high-end food commercial lighting from one direction, raking across the surfaces.

[Timeline]

0–3.0s: Macro shot orbiting a single chip inside a dense chip bed.

3.0–6.0s: Camera pulls back to reveal a wide chip landscape ending at a central depression.

6.0–8.5s: One cookie settles slowly into the depression, scattering nearby chips.

8.5–12s: Camera cranes back and up as the cookie tilts face-on and four packs rise in a row behind it, fronts square to the lens.

[Global]

Exactly 1 cookie and 4 packs throughout — no more, no fewer, and all four packs are the same product.

Continuous lighting from one direction for the entire clip. Photoreal, warm, appetising, high-end food commercial finish. Include background music and Foley sound effects — the shifting and settling of chocolate chips. Deep focus.

The cookie is the largest object in the final frame — it is far closer to the lens than the packs.

[Exclusions]

No captions, no subtitles, no watermarks, and no on-screen type beyond the printing that is already on the pack in [Image1]. Add no wordmark, brand name, flavour name, badge or claim that is not there. No hands, no people, no extra cookies. Do not render grey blockout shapes, guide lines, or 3D viewport artifacts from [Video1].
`,
};
