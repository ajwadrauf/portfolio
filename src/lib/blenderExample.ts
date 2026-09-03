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
   * Three things in this brief were learned the expensive way, and each is
   * load-bearing rather than decorative.
   *
   * The pack is unbranded. Branded packaging is refused by the provider's
   * content filter — reported as a policy violation about the imagery, with no
   * mention of branding — so the wordmark is composited afterwards rather than
   * generated.
   *
   * There is exactly one still. The chips and the cookie are described in
   * words instead of referenced, and they render fine that way. The reference
   * slot is spent on the one thing that has to be itself.
   *
   * The clay pass is declared a camera reference and explicitly not a physics
   * reference. The earlier version of this brief asked the model to inherit
   * "subject trajectories", so it faithfully reproduced motion the blockout
   * had never simulated: a flat cookie skating over a frozen bed. The physics
   * block that replaced it is long because each clause answers a specific
   * failure — a sprite-like hero, a wake that never formed, packs finishing
   * the shot hovering in clean air.
   */
  prompt: `MODE: Clay Renderer / Omni Reference — camera locked, physics free

MATERIALS: [Video1] clay blockout · [Image1] product pack

SETTINGS: Match [Video1] duration and camera route · 4:3 · 720p · 24fps · 12s

[Reference roles]

[Video1] is a clay blockout. It is a camera and staging reference, not a physics reference.

Inherit exactly: the camera's path, speed and shot-size progression; the duration and order of the beats; which object occludes which; the direction of the key light; and where each element sits in the final frame.

Do not inherit its physics. The blockout slides the cookie as a flat disc across a fixed plane and leaves the surrounding chips frozen. That is placeholder motion standing in for dynamics that were never simulated. Keep only the start point, end point and duration of each move, and re-solve everything between them as real physical motion, as specified below.

[Image1] is the product pack. Copy it exactly as shown — this is a reproduction, not an interpretation. Match the flat-bottom kraft paper bag in every respect: natural tan paper, gusseted sides, squared body, folded and ribbed top seal, and the black band across the base. Reproduce every printed element in its existing position and at its existing size: the cookie photograph with its scattered chocolate chips, peanuts and peanut butter swirl, the nutrition panel, the ingredient block, the distributor lines and the barcode. Same layout, same proportions, same paper texture, same colour. Hold it pixel-consistent for the whole take: no drift, no re-imagining, no substitution of any panel.

Blue chips: Semi-sweet chocolate chips — deep brown, rounded conical drops with a soft sheen.

Orange disc: A thick, golden peanut butter chocolate chip cookie — craggy surface, studded with chocolate chips and peanut butter chips, matching the cookie pictured on [Image1].

Green form (leftmost): The pack from [Image1].

Magenta form (second left): The pack from [Image1].

Yellow form (third left): The pack from [Image1].

Cyan form (rightmost): The pack from [Image1].

All four bags are the same pack, standing upright and turned to camera at the same three-quarter angle as [Image1], so the printed panel is visible.

[Physics and secondary motion]

The cookie is a solid three-dimensional object with real thickness — roughly 12mm at the rim, domed slightly on top, with a visible crumb edge. It is never a flat disc, never a cutout, never a sprite. Its edge and underside are visible whenever it is tilted away from the lens.

While it travels it rotates in all three axes: a slow, weighted tumble that decays as it descends and settles to face-on at rest. Rotation eases; it never spins at constant speed and never snaps to an angle.

The chocolate chips are a granular material, not a surface texture. The bed behaves as thousands of small, hard, loose objects:

Where the cookie makes contact, chips are displaced outward in a low ring — individual chips rolling, tumbling and knocking into each other, not sliding together as a sheet.

Chips on the rim of the depression cascade inward behind the cookie and re-settle a beat after it comes to rest.

Chips the cookie brushes on the way past are nudged, roll a short distance, and stop. A few are flicked up, bounce once, and settle.

The bed is never static while anything is moving through it. Motion propagates outward from every contact and dies away naturally.

Travelling through the bed displaces chips continuously, not only at the moment of contact. Anything moving across or through the chips is partly submerged in them, and for every frame that it moves:

A bow wave of chips builds and spills at its leading edge — chips riding up the front face, tumbling over the top of it and rolling down the sides.

Chips shear outward along both flanks, pushed aside and left standing in low banks either side of the path.

A furrow opens behind it, and that furrow is made of chips: its floor and walls are individual chips catching the light, never a smooth dark void, never a clean carved groove.

The furrow immediately begins closing. Its walls are loose material and cannot hold a steep face — they slump inward, chips rolling down from both banks and partly refilling the trench a beat behind the object. The trail is a transient disturbance that keeps settling, not a permanent channel.

The deeper it sits in the bed, the more material it moves. A shallow pass leaves a scuff; a submerged one leaves a full trench with banks.

Rising out of the bed works the same way in reverse, and it happens in stages rather than all at once:

First the surface heaves. Before anything breaks through, the bed above the buried pack domes upward in a low mound, chips on that mound tilting and beginning to slide off its flanks.

Then the surface parts. The mound splits, chips pouring off the emerging top seal and down both sides as the pack's shoulders push through.

Through the whole rise, chips sheet off the pack continuously — running down the flat front panel, catching in the gusset folds and spilling out of them, tumbling off the shoulders in irregular runs rather than one clean sheet. Individual chips are visible rolling down the paper, not a sliding mass.

Around the base, an annular collar of loose chips forms where material has been pushed aside. That collar keeps avalanching inward against the pack as the bed around it slumps to fill the space, so the level right at the base is always moving while the pack is moving.

The pack stops with roughly the bottom eighth of its height still buried — chips banked up against the base at about the top of the black base band, uneven around the perimeter, higher on one side than the other. It is seated in the bed, not standing on it.

After it comes to rest, material keeps settling for a beat: a few last chips run down the paper, a small slump closes on one side of the base, and one or two chips roll clear and stop.

The four packs break the surface within a few frames of each other rather than in perfect unison, and each finishes at a slightly different depth and a slightly different bank height.

Everything eases in and eases out. Natural motion blur consistent with a 180-degree shutter at 24fps. No stepped motion, no snapping, no constant-velocity slides, no object moving through the chips without the chips reacting to it.

[Creative direction]

A continuous macro-to-wide move through a landscape of chocolate chips. A hero cookie settles into the chips, and a row of four kraft packs rises behind it. Warm, high-end food commercial lighting from one direction, raking across the surfaces.

[Timeline]

0–3.0s: Macro shot orbiting a single chip inside a dense chip bed. The bed is at rest; only parallax moves as the camera travels. Shallow chip-scale detail — highlights sliding across the glossy conical surfaces.

3.0–6.0s: Camera pulls back and lifts to reveal a wide chip landscape ending at a central depression. Chips in the near field roll past the lens as it rises.

6.0–8.5s: One cookie descends into the depression slower than gravity, tumbling gently and levelling as it falls. On contact it sinks into the bed and the chips answer: a low ring displaced outward, individual chips rolling clear, a scatter flicked up and falling back, and a slow inward cascade off the rim of the depression that keeps settling after the cookie is still.

8.5–12s: The camera cranes back and up. The cookie ploughs forward through the bed to the near ridge — half-buried, shouldering chips up and aside as it goes, a bow wave breaking over its leading edge and a furrow opening and slumping closed behind it — then tilts up to face the lens, chips spilling off its upper surface and rolling down its face as it rises. Behind it, four low mounds heave up in the chip bed, split, and four kraft packs push up through the surface — chips pouring off the emerging top seals, sheeting down the front panels, spilling out of the gusset folds and avalanching inward against each base as the bed slumps to fill the space around them. They rise until roughly seven-eighths of each pack stands clear, the bottom eighth still buried with chips banked against it at about the top of the black base band, uneven around the perimeter. Everything settles together, chips still running down the paper and closing against the bases for a beat after the movement stops. The final frame locks and holds.

[Global]

Exactly 1 cookie and 4 packs throughout — no more, no fewer, and all four packs are the same product.

Continuous lighting from one direction for the entire clip. Photoreal, warm, appetising, high-end food commercial finish. Include background music and Foley sound effects — the shifting, rolling and settling of chocolate chips, and the drier rattle of chips running down kraft paper as the packs rise. Deep focus.

The cookie is the largest object in the final frame — it is far closer to the lens than the packs.

In the final frame every pack is seated in the chips, not resting on them and not floating above them: the bottom eighth of each is buried, with an uneven bank of chips piled against the base. There is no gap of any kind between a pack and the bed.

Weight and continuity matter more than exactness here: where the blockout's motion and believable physics disagree, follow the physics, as long as the camera, the timing and the final composition still match [Video1].

[Exclusions]

No captions, no subtitles, no watermarks, and no on-screen type beyond the printing that is already on the pack in [Image1]. Add no wordmark, brand name, flavour name, badge or claim that is not there. No hands, no people, no extra cookies.

Do not render grey blockout shapes, guide lines, placeholder geometry or 3D viewport artifacts from [Video1]. Do not reproduce its flat, sliding, sprite-like subject motion or its frozen chip bed — those are placeholders, not direction.

Nothing slides across the top of the chips without sinking into them and moving them. No object travels through the bed leaving it undisturbed behind. No smooth dark voids, holes or shadow shapes standing in for a disturbed area — every depression is made of visible individual chips. No trench that stays open and clean once the object has passed.

No pack hovers, floats, or hangs in the air above the pile. No visible gap or shadow separating a pack from the chips it is standing in. No pack sitting flat on top of an undisturbed surface as though placed there. No clean, level waterline where a pack meets the bed — the contact line is always an uneven bank of individual chips. Nothing rises out of the bed without the bed reacting to it.
`,
};
