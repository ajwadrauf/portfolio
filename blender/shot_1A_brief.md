# Shot 1A — "The Wall" · PC The Decadent · 12s · 4:3

Clay control pass spec + Seedance 2.5 prompt.
Built to the conventions in `CLAUDE.md`.

HERO SKU: The Decadent Chocolate Chip (classic)
DELIVERY: 4:3 · 24fps · 12s · 288 frames · one continuous clip

**Revised against a completed build.** Everything below has been through
`build.py` and out the other side. Where the first draft of this brief specified
something that could not be built, the section says so and gives the resolution
rather than leaving the next person to rediscover it. Those places are marked
**REVISED**.

---

## Creative spine

The 1988 Decadent package is one enlarged hero cookie sitting on a background
made of chocolate chips. Loblaw art director Russ Rudd built it by
photographing hundreds of cookies and picking the best one.

So the film starts *inside* that chip background, pulls out until you realise
it is a landscape, drops the cookie into it, then reveals that the whole thing
was the package all along. One continuous move. The last frame is the pack
shot.

The chocolate leads because the chocolate is the actual product claim. The
original recipe was 39% chocolate chips by weight, roughly double the leading
national brand at the time, using real cocoa butter instead of vegetable oil.
Opening buried in chips is not a stylistic choice, it is the proposition.

The word *landscape* in paragraph two turned out to be load-bearing rather than
decorative. A flat bed cannot deliver this shot — see **Final frame layout** and
**Frame 1 has no horizon**. Relief is a requirement, not styling.

---

## Resolution

Draft at 640x480. Render the final clay upload at 960x720.

Both are 4:3 so composition survives untouched and there is no aspect drift
between the two. `CLAUDE.md` puts the useful ceiling at 720p because native
Seedance output caps there, and 960x720 is the 4:3 equivalent of the 1280x720
the doc recommends for 16:9.

The reason it matters on this specific shot: at f288 the frame is 1240 mm wide.
At 640 px that is 1.94 mm per pixel, so a 9 mm chocolate chip is under 5 px. At
960 px it is 7 px. That is the difference between a bed of readable individual
chips and a noise texture, and the whole opening depends on the model reading
them as discrete objects.

640x480 is legal as an input. It sits exactly on the 480p floor in the spec
table. It is just the weakest version of this particular shot.

**Cost, measured.** 288 frames at 960x720 with 31k chips renders in **1.3
minutes** on an M-series Mac in EEVEE. On a machine with no GPU, where EEVEE
falls back to software rasterisation, the same render is about 80 s *per frame*
— six and a half hours. Check which one you are on before planning around it.

---

## SHOT BRIEF

```
SHOT ID:            1A
DELIVERY:           960x720 final clay, 640x480 draft, 4:3, 24fps, 12s (288f)
SURFACE:            <Dreamina UI / ModelArk API / reseller — confirm>
GENERATION MODE:    Clay Renderer / Omni Reference
CLAY CLIP:          one continuous clip, 288 frames, single camera

CAMERA
  Sensor:           36mm full frame, sensor_fit HORIZONTAL
  Lens:             100mm f1..f144 · 100→85mm f144..f204 · 85→45mm f204..f288
  Rig:              one continuous crane. orbit, then pull back, then arc and rise
  Start framing:    extreme macro, 36mm frame width, 3-4 chips across, no horizon
  End framing:      hero product wide, cookie in near foreground, four packs behind
  Near clip:        2 mm  (REVISED — see below)

  Distance track (camera to AIM POINT) — 4:3, sensor_fit HORIZONTAL:
    f1      0.10 m     100mm     frame   36 x  27 mm
    f72     0.10 m     100mm     frame   36 x  27 mm   (orbit only, no dolly)
    f144    0.45 m     100mm     frame  162 x 121 mm
    f204    0.72 m      85mm     frame  305 x 229 mm
    f288    1.55 m      45mm     frame 1240 x 930 mm

  Elevation track:
    f1      2 deg   (inside the bed, near chip-top level)
    f72     2 deg
    f144    12 deg
    f204    22 deg
    f288    22 deg

  Azimuth:
    f1-f72     orbit right 40 deg around the hero chip
    f72-f144   hold azimuth
    f144-f204  arc right 55 deg
    f204-f288  hold, settle to a locked final frame

SUBJECTS AND MAPPING (ID colour → look reference)
  blue chips           -> semi-sweet chocolate chips, @Image 1
  orange disc          -> hero cookie, classic Decadent, @Image 2
  green standing form  -> pack 1, @Image 3   (The Decadent Chocolate Chip)
  magenta form         -> pack 2, @Image 4   (The Decadent Soft Baked)
  yellow form          -> pack 3, @Image 5   (The Decadent Peanut Butter Chunk)
  cyan form            -> pack 4, @Image 6   (The Reverse Decadent)
  neutral grey ground  -> continues as chip bed, no separate mapping
  emissive grey cyc    -> soft out-of-focus warm backdrop  (REVISED)

LIGHTING
  Key:              area light, 40 deg camera left, 35 deg elevation, warm
  Fill:             area, camera right, 1/4 key
  Character:        warm high-end food commercial, raking key for chip specular
  Constant exposure across all 288 frames
  Both lights FIXED IN WORLD SPACE, anchored to the final camera azimuth
                                                              (REVISED)

TIMELINE (frames at 24fps / seconds)
  1-72    / 0-3.0s    macro orbit inside the chip bed. ends on the hero chip in
                      three-quarter profile, frame still completely filled
  72-144  / 3.0-6.0s  pull back and lift. bed resolves as a landscape. ends on
                      an empty round depression centred in frame
  144-204 / 6.0-8.5s  cookie descends and settles into the depression, pushing a
                      low ring of chips outward. camera arcs right and rises.
                      ends with the cookie resting, chips banked at its rim
  204-288 / 8.5-12s   crane back and up. cookie TRAVELS FORWARD onto the near
                      ridge and tilts up to lean face-on. four packs rise into a
                      shallow row behind. final frame locks and holds still for
                      12 frames                                 (REVISED)

COMPOSITE AFTER GENERATION
  all four pack fronts, PC wordmark, The Decadent logotype, 300 g, legal line,
  superscripts, end card, music

EXCLUSIONS
  no text, no captions, no logos, no printed pack graphics, no music,
  no grey plastic, no void, no hands, no people, no extra cookies
```

### REVISED — distance is measured to the aim point, not to bed centre

The first draft said "camera to bed centre". Its own timeline does not support
that: it orbits the **hero chip** for 72 frames and then centres the
**depression** at f144. Those are two different points, 72 mm apart.

Measure to the aim point and every frame-width number in the table above lands
exactly as published. From f144 on the aim *is* bed centre, so the two readings
agree everywhere the final layout depends on them. The camera aims at the hero
chip, then drifts to the depression across the pull-back, which is what turns a
macro portrait of one chip into a centred landscape without a cut.

### REVISED — near clip

Blender's default near clip is 100 mm. The macro opening puts the lens 100 mm
from its subject with chips closer still. The default silently eats the entire
first three seconds. Set it to **2 mm**.

### REVISED — lock the lights in world space

"40 deg camera left" is ambiguous when the camera turns 95 degrees during the
shot. Carried on the camera, the key swings 95 degrees with it, which reads as a
moving light source and fails the "one clear light direction" check in
`CLAUDE.md` §8.

Anchor it 40 degrees camera-left of the **final** camera azimuth and fix it
there. The final frame is the pack shot, so it gets the flattering angle; at
frame 1 that same fixed light sits 55 degrees off-axis on the other side, which
is still a raking side key and still gives the chip specular the opening needs.
Both ends work. Verify by eye that the shadow direction never changes.

---

## Final frame layout

4:3 gives you more horizontal room than 1:1 and less vertical, so the pack row
gets easier and the vertical stack gets tighter. The crane stops shorter than
it would on a square to compensate.

```
                        camera 22 deg up, 45mm, 1.55 m

   [pack 1]   [pack 2]        [pack 3]   [pack 4]      packs at 1.55 m
   classic    soft baked      pb chunk   reverse       165 mm apart, 625 mm row
                     \    /
                      cookie                           cookie at 0.45 m
                   centred, leaning                    ON THE FOREGROUND RIDGE
```

Cookie sits dead centre horizontally, in front of the gap between pack 2 and
pack 3. That is the widest silhouette separation available and it removes the
occlusion ambiguity entirely. Do not put the cookie in front of a pack.

### REVISED — this frame cannot be built with the cookie on the bed

Do the arithmetic before you build:

```
camera height          1.55 · sin 22°   =  581 mm
cookie centre, on bed                   =   26 mm
vertical drop                           =  555 mm   >  450 mm
```

The height difference alone exceeds the whole camera-to-cookie distance, so
**no point on the bed is 0.45 m from that camera**. It is not tight, it is
impossible.

Worse, the nearest bed point actually inside the frame is 929 mm out, where a
55 mm cookie reads **7.4%** of frame width against **10.5%** for each pack. The
cookie comes back *smaller* than the packs, which inverts the entire point of
the shot.

**Resolution: give the bed a foreground ridge and let the cookie climb it.**

Keep every camera number exactly as briefed — the pack row's figures all verify
against it, and the elevation track was computed for 1.333. Then solve the crest
height backwards from the brief's own 0.45 m rather than typing a number:

```
RIDGE_X      1.055 m from bed centre, toward the final camera
RIDGE_H      solved, ≈ 318 mm     <- do NOT hard-code this
RIDGE_SIGMA  0.30 m               broad swell, not a spike
```

Solving it matters. Any later change to the terrain — and there will be changes,
because the terrain also has to kill the horizon at f1 — silently moves the
cookie's apparent size off the published table if the crest is a typed constant.

This is on-theme rather than a patch. The creative spine is "pull out until you
realise it is a landscape", and a landscape has relief. It also keeps the cookie
in continuous ground contact, which a levitating hero cookie would not.

Check the crane clears it. The camera passes over the crest around f233 with
**89 mm** of clearance. Assert that in the build; do not eyeball it.

### REVISED — the cookie has to travel, and the brief never said so

The timeline says "cookie tilts up to lean face-on" and stops there. But the
camera ends 1.55 m from bed centre and the cookie ends 0.45 m from the camera,
so the cookie must cover **1.10 m** toward the lens during the final beat. That
is not optional, it is forced by two numbers the brief already fixed.

State it in the timeline and state it in the prompt, or the model is left
inventing a reason for a cookie that grows.

### Apparent sizes at f288 — measured off the render, not predicted

| Object | Distance | % frame width | % frame height |
| --- | --- | --- | --- |
| Cookie (leaning, 55 mm) | 0.45 m | 15.3% | 21.2% |
| Each pack (130 x 200 mm) | 1.55 m | 12.2% | 23.1% |
| Pack row (625 mm) | 1.55 m | 53.5% | — |

The pack figures run about two points over the flat-card prediction of 10% and
21%, and both gaps are the proxy being *right*:

- **Width.** 130 mm is the flat width. A gusseted bag with a belly bulge is
  ~12% wider than flat.
- **Height.** A 65 mm-deep bag's silhouette runs from its **near-bottom** edge to
  its **far-top** edge — 1.3° to 9.3° off the camera axis, which projects to
  23.5%, not 21%.

Flatten either and the packs stop reading as bags. Predict from the solid, not
from a rectangle.

Forced perspective is doing the work. A 55 mm cookie is a quarter the height of
a 200 mm bag, and it still reads as the largest object in frame because it sits
three times closer to the lens. Build it this way on purpose.

---

## ID colour map

Linear base-colour values, assigned straight to Principled Base Color, same
convention as the `ID_COLORS` block in `CLAUDE.md`. Not sRGB hex.

```python
CLAY_NEUTRAL = (0.18, 0.18, 0.18, 1.0)   # bed continuation, cyc, everything unmapped

ID_COLORS = {
    "chips":      (0.05, 0.20, 0.80, 1.0),   # blue    MAPPED -> chocolate chips
    "cookie":     (0.90, 0.35, 0.02, 1.0),   # orange  MAPPED -> hero cookie
    "pack_chip":  (0.10, 0.60, 0.15, 1.0),   # green   MAPPED -> @Image 3
    "pack_soft":  (0.75, 0.05, 0.55, 1.0),   # magenta MAPPED -> @Image 4
    "pack_pb":    (0.95, 0.80, 0.05, 1.0),   # yellow  MAPPED -> @Image 5
    "pack_rev":   (0.05, 0.70, 0.75, 1.0),   # cyan    MAPPED -> @Image 6
}
```

Four separate pack colours rather than one shared colour. Positional wording
alone ("left to right") gets ignored often enough to be worth the extra hues.
The prompt states both, colour and position, so they reinforce each other.

Roughness 0.55 on every clay material. Metallic 0. No bump, no texture, no
transparency.

**The hues survive rendering, but only just.** Cookie orange sits at 22° and
pack yellow at 50° — 28° apart. Under a warm key, blue chips at 228° drift far
enough toward cyan at 184° to be mistaken for the cyan pack. If you classify
subjects out of a rendered frame, assign each pixel to its **nearest** ID hue
with the chips as a competing class, never to independent per-colour windows.
Independent windows let the cyan pack's mask swallow half the bed.

---

## Real-world scale

1 Blender unit = 1 metre. Metric, `scale_length = 1.0`.

| Object | Size |
| --- | --- |
| Chocolate chip | 9 mm base diameter, 7 mm tall, scaled 0.80–1.26 per instance |
| Hero cookie, classic Decadent | 55 mm diameter, 8 mm thick |
| Pack (300 g gusseted bag) | 200 mm tall, 130 mm wide, 65 mm deep |
| Depression | 84 mm across, 9 mm deep, 16 mm banked rim  (REVISED) |
| Foreground ridge | crest 1.055 m out, ≈318 mm high, 0.30 m sigma  (NEW) |
| Chip bed, real instances | 2.5 m square |
| Chip bed continuation | displaced plane out to **11 m square**  (REVISED) |

Note the cookie thickness. 8 mm, not 12 mm. The classic Decadent is a thin
crisp cookie, not a thick soft-baked one, and a soft-baked profile in the clay
will fight the look reference all the way through generation.

### REVISED — the continuation plane needs 11 m, not 8

At f288 the top of frame lands **6.26 m** from a camera sitting 1.44 m out from
bed centre. The bed therefore has to reach 4.83 m *past* centre, plus 2.5 m of
lateral spread. An 8 m square is 0.9 m short of the top frame edge and the void
shows. 11 m clears it with margin.

---

## Proxy build notes

These are the things that come back wrong if you skip them.

**Chips are not cones.** `primitive_cone_add` gives a spike, and the model
resolves a spike as a spike. Lathe a profile with a flat base, a slight belly
and a rounded apex. Instance that.

**REVISED — and chips are not eggs either.** The first lathe tapered smoothly
from the belly to the tip and came back as a bed of pale blue eggs. The wall has
to stay *steep* through the lower half and turn late. Keep the profile above
0.9× base radius until 45% height, and give the tip a small rounded cap rather
than a hemisphere. Add per-instance scale variation of 0.8–1.26: a bed of
identical chips reads as a texture no matter how good one chip is.

**REVISED — every chip touches something, but skip the rigid-body settle.** The
first draft said to scatter, snap Z, then run a short rigid-body sim and bake it.
Do not. A 2.5 m bed of touching 9 mm chips is roughly 70,000 bodies, which is not
a sim you want, and it buys nothing: snapping each chip to a single analytic
terrain function and sinking its base ~1 mm guarantees contact *exactly*, where a
sim only approximates it. Jitter on a hex lattice gives the jumble. Floating
chips still produce floating subjects — the requirement was right, the method
was not.

**REVISED — one terrain function, called by everything.** The chip scatter, the
continuation plane, the pack row and the cookie's path must all read the same
`bed_height(x, y)`. Keeping a separate vectorised copy for the plane is two
places to edit and one silent divergence away from chips floating over their own
floor. Write it once, vectorised, and let the scalar case fall out of it.

**REVISED — density follows the LENS, not the bed centre.** Zoning scatter by
radius from bed centre puts the ridge crest — the closest thing to the lens at
f288 — in the outermost, sparsest zone. The near foreground came back as
scattered chips on a smooth floor. Give the ridge its own dense patch. Overall
~31k chips is enough at this framing; 70k is not needed and costs render time.

**The cookie is thin, flat and irregular.** A perfect disc comes back as a coin
or a poker chip. 55 mm across, 8 mm thick, wavy rim from low-frequency noise on
the boundary, a very slight dome, and ten to fourteen small chips sitting proud
of the top surface. The classic is densely studded with many small chips, not
a few large chunks. That chip count on the proxy is a real signal, so do not
skimp on it.

Build the cookie's centre as a **single vertex**, not as N coincident ones at
radius zero. A ring of degenerate faces at the centre shades as a dark smudge in
the middle of the hero product.

**REVISED — tilt the cookie about the right axis.** It must rotate about the
horizontal axis *perpendicular to the final view direction*, so the face ends up
square to the lens. Composing an Euler and then rotating it about Z rolls the
cookie sideways like a falling coin. That looks entirely plausible in a render
and quietly foreshortens the width the 15% figure depends on — it measured 12.2%
against a predicted 15.3%. Rodrigues about `(-ay, ax, 0)` sends the face normal
exactly at the camera.

**Packs are not boxes.** A hard rectangular prism comes back as a cereal
carton. Build a gusseted stand-up bag: soft rounded verticals, a slight bulge
at the belly, a pinched fin seal across the top, a flat base.

Three things do the work, and the first attempt had none of them strongly
enough: a superellipse exponent near **2.45** (3.4 is still a rounded box), a
real shoulder taper above the belly, and a fin that collapses to a flat blade and
flares slightly *wider* than the bag. The overhanging fin is the silhouette cue
that says bag rather than carton.

**REVISED — bury the packs deeper than you think.** They start their rise fully
hidden below the bed. `1.05 × PACK_H` leaves the fin seal only 10 mm under a
surface that undulates ±4 mm, and both inner packs broke through the chips at
f204. Use **1.4 ×**.

**REVISED — stand the pack row on one shelf.** Letting each pack follow the
terrain staggered them by up to 26 mm, which reads as sloppy set dressing
against the brief's "shallow row". Take the highest of the four positions as a
common ground height: none floats, and the lower ones simply stand a little
deeper in the chips, which is what a bag on a loose bed does anyway.

**REVISED — the depression is wide and shallow.** What makes the hollow read at
f144 is its **diameter** against a 162 mm frame, not its depth. Depth costs
dearly at f164, where the camera is only ~14 degrees up: a 15 mm hollow with a
13 mm banked rim hid the just-landed cookie behind its own near edge almost
entirely. **84 mm across, 9 mm deep, rim at 0.6× depth.**

**Void control.** At f288 with a 45mm lens at 1.55 m the frame is 1.24 m wide
and the camera is 22 degrees up. The instanced bed edge will be visible unless
you extend it. Real chip instances out to 2.5 m, a displaced continuation plane
in the same blue out to 11 m, then a grey cyc. Verify at f288 before you commit
to a render.

**REVISED — the cyc must be closed, and it must be emissive.** An open bowl
whose rim sits below eye level lets a macro camera 8 mm off the ground look
straight past it into the world background: the top quarter of frame 1 came back
pure black, and a void edge reads as a scene boundary the model builds a wall
at. Close the dome over the top and start it below the horizon.

Light it with an **emission shader**, not Principled. A cyc 16 m away receives
almost nothing from a key sized for a 9 mm chip, so a lit backdrop renders
near-black however grey its base colour is. Emission puts it at a dependable
~16% grey.

**REVISED — displacement has to be sampled, and it must not be sinusoidal.**
Two separate failures here. First, chip-scale relief on an 11 m plane at 520
divisions landed exactly on the grid's Nyquist limit, aliased away entirely, and
left a smooth floor with a visible ring where the real chips stopped — use ~1100
divisions. Second, summed `sin(x)·cos(y)` octaves stay visibly axis-aligned and
read as **woven fabric** across the far field. Value noise instead. The
top-down blocking still is what exposes this; from the hero angles a sine
lattice passes as gentle relief.

**Visibility does not inherit.** The four packs are hidden until f204. Key
`hide_render` and `hide_viewport` on every object individually, CONSTANT
interpolation, using the four-key pattern in section 7. Parenting them to an
empty and hiding the empty will leave all four fully visible.

Be aware of the side effect when you measure: a hidden object leaves the
depsgraph, so its `matrix_world` goes stale and the frame it reappears on reads
as a huge phantom jump. Skip hidden frames in `report_speeds()` or you will
chase a 7.9 m/s spike that nothing on screen makes.

**Occlusion at the end.** The centre-gap placement above solves this. Check it
anyway at f204, f246 and f288, because the packs are rising into position
across that range and the transient positions matter as much as the final one.

**Frame 1 is load-bearing.** It anchors composition and in several modes locks
output aspect. Compose it: hero chip on a third, two chips crossing the near
foreground, no dead centre.

### REVISED — frame 1 has no horizon, and that takes terrain

"No horizon, frame completely filled" cannot be delivered by framing alone. A
camera at chip-top level on a flat bed **always** sees sky at the top of frame,
and tilting the lens down far enough to hide it turns the macro opening into a
top-down shot of chip lids — which loses the briefed three-quarter profile.

Three things together, in order of how much they contribute:

1. **Mid-scale relief.** Shallow mounds a few centimetres high, 120–200 mm
   apart, put chips in the background instead of sky. Mask them out inside
   ~300 mm of bed centre so they cannot tilt the pack row or fill the hollow.
2. **A berm behind the hero chip.** Mounds masked near centre cannot help at
   f36 and f72, because that is exactly the radius the orbit lives in — the
   camera swings to an azimuth whose background happens to be flat and a band of
   grey cyc opens along the top. One deliberate rise, ~52 mm high at 260 mm,
   placed behind the hero across the whole 40-degree sweep.
3. **A slight lens tilt**, ~3 degrees down, easing to zero by f144. The camera
   *position* still follows the briefed 2-degree elevation track exactly; only
   the look target drops.

### REVISED — the macro lens needs clear space, and deleting chips is the wrong way to get it

A 9 mm chip 20 mm from the lens covers the entire frame on its own, so "3-4
chips across" is unachievable with chips at point-blank range.

The obvious fix is to delete chips near the camera path. It is wrong: it leaves
a bald crescent that is invisible at f1 and glaring at f144, once the camera has
pulled back far enough to see the whole area.

Dip the **bed** along the orbit instead — a shallow trench, ~16 mm deep with a
50 mm sigma, that the camera runs in. The chips follow the surface as usual, so
the channel stays chip-covered from every later angle, and the ones on its inner
lip still cross the near foreground exactly as the brief asks. Keep it narrow;
at 75 mm sigma it competes with the depression at f144.

### Speed sanity at macro

The table in `CLAUDE.md` is human-scale. At this scale everything should be
slower. Targets here, with measured results from a passing build:

| Move | Frames | Budget | Measured mean | Peak |
| --- | --- | --- | --- | --- |
| Macro orbit | 1-72 | 0.028 m/s | 0.024 | 0.035 |
| Pull back | 72-144 | 0.12 m/s | 0.101 | 0.151 |
| Arc and rise | 144-204 | 0.25 m/s | 0.244 | 0.371 |
| Crane out | 204-288 | 0.24 m/s | 0.237 | 0.415 |
| Cookie descent | 144-164 | 0.22 m/s | 0.220 | 0.329 |
| **Cookie ridge glide** | 204-276 | **0.40 m/s** | 0.378 | 0.568 |

The cookie descent is slow on purpose and will read as slow motion. That is
correct for food, and the prompt says so explicitly so the model is not left
inventing an explanation.

**REVISED — the ridge glide is new, and it is the one move above the brief's
original table.** It is not a choice: the cookie has to cover 1.10 m during the
final beat to satisfy the 0.45 m / 1.55 m forced-perspective spec. Budget it
explicitly rather than leaving it unmeasured.

**REVISED — distribute that climb by arc length.** Advancing uniformly along the
ground makes the cookie sprint through the steep middle of the ridge, where it
gains height as fast as it moves forward: 0.909 m/s peak against a 0.378 mean.
Resample the path by cumulative length and leave the easing to the ends. Peak
drops to 0.568.

Chips shoved by the landing should ease **out**, not in-out. The default has
them creep away from a cookie that already landed, which is the one thing in the
beat the prompt cannot explain.

Run `report_speeds()` and print peak per-second displacement for the camera and
every animated object — including the ~117 chips the landing pushes. Report
those as one worst-case line rather than 117 rows.

---

## Render settings

```python
scene.render.engine = "BLENDER_EEVEE"    # confirmed on 5.0 and 5.2
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = 960          # 640 for draft
scene.render.resolution_y = 720          # 480 for draft
scene.render.fps = 24
scene.render.fps_base = 1.0
scene.render.film_transparent = False
scene.render.use_motion_blur = False
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
cam.data.dof.use_dof = False
cam.data.clip_start = 0.002              # REVISED — the default eats the opening
```

Watch exposure. A raking key on thousands of 9 mm chips clips easily, and
clipped highlights erase the geometry the model is supposed to read.

**Measure it rather than eyeballing it.** Report the fraction of pixels at or
above 0.985 and at or below 0.02 on every checkpoint. A passing build here runs
under 0.3% clipped and 0.00% crushed. The first attempt at this lighting blew
the chips to near-white at 260 W; the working key is **62 W** with a 15 W fill.

`CHECKPOINTS = [1, 36, 72, 108, 144, 164, 204, 246, 288]`

Plus one top-down blocking still. It costs two minutes and it is the only way
to check the pack row spacing and the forced-perspective offset unambiguously.
**Roll it so the final view axis runs straight down the frame** — packs across
the top, cookie below — and centre it on the midpoint of the composition rather
than on bed centre, or the cookie sits in a corner and the diagram gives you
nothing. It is also the view that exposes a sinusoidal displacement lattice.

### REVISED — verify the final frame against pixels, not against your solver

Measure each subject's extent in the rendered last frame and compare it to the
published apparent-size table. This is what caught the cookie rotating about the
wrong axis: the render looked entirely plausible and measured 12.2% against a
predicted 15.3%.

Bound each subject by the largest **contiguous run** of rows and columns that
carry it, not by outermost pixel — a handful of misclassified pixels at opposite
corners otherwise reports a subject as 100% of frame width.

### REVISED — Blender API notes, 5.0 through 5.2

Probed, not remembered. Each of these fails silently or late.

- **`Action.fcurves` no longer exists.** Layered actions mean curves are reached
  through `action.layers[…].strips[…].channelbag(slot).fcurves`.
  `fcurve_ensure_for_datablock` exists on the *instance* even though `hasattr`
  on `bpy.types.Action` returns `False`. Read the live object, never the type.
- **`SequenceEditor.sequences` is now `.strips`.** Test with `hasattr`. Do not
  write `getattr(se, "strips", None) or se.sequences` — a fresh editor's
  collection is *empty*, an empty collection is falsy, and the `or` falls
  through to the 4.x name every single time.
- **`use_nodes` is deprecated for removal in 6.0**, and on 5.x the node tree
  already exists the moment `.new()` returns. Only touch it if `node_tree` is
  `None`.
- **The class-level enum is not the instance's enum**, in both directions. The
  view transform introspects as `["NONE"]` while `"Standard"` assigns fine.
  `ImageFormatSettings.bl_rna` lists `FFMPEG` on builds that cannot write it.
  **Assign and catch `TypeError`** — its message enumerates what the build
  really supports.
- **Nothing here can write video.** Neither the pip `bpy` wheel nor Blender
  **5.2.1 LTS on macOS arm64**, whose format list is `AVIF, JPEG, OPEN_EXR, PNG,
  WEBP, BMP, CINEON, DPX, IRIS, JPEG2000, HDR, TARGA, TARGA_RAW, TIFF` — no
  video format at all. Install `ffmpeg` **before** you render 288 frames, not
  after. When you do encode from a frame range, pass `-start_number`: the image2
  demuxer looks for index 0 and gives up after a few misses.
- **Do not trust the view-transform enum, and do not chase `OCIO`.** With it
  unset the enum introspects as `["NONE"]`, which looks like broken colour
  management. It is not: `"Standard"` assigns, reads back, and renders
  byte-identical pixels either way. The genuine hazard runs the other direction
  — `OCIO` inherited from Nuke, Resolve or Houdini, all of which set it globally,
  grading your clay through a config meant for something else. Leave an inherited
  value alone, log that it was inherited, and **assert on the resulting view
  transform** rather than on the mechanism.

### REVISED — render once, encode once

Do not render a PNG sequence and then re-render with the format switched to
FFMPEG to produce the clip. That renders all 288 frames twice for pixels already
on disk. Encode straight to H.264 in one pass where the build can, and stitch
the existing stills where it cannot. Keep an encode-only path: discovering there
is no encoder *after* a long render should never mean re-rendering.

Read the finished clip back and check it against the uploader's limits — even
dimensions, 300–6000 px, aspect 0.4–2.5, under 200 MB, 24 fps. A clip that fails
those is worth knowing about before it costs a generation.

### REVISED — keep generated files out of git

`prompt.txt`, `metadata.json` and `README.txt` are outputs. They are rewritten on
every run and stamped with the local Blender version, so tracking them means any
run leaves the tree dirty and the next pull aborts. The script and its config are
the source of truth; the package regenerates in seconds.

---

## Export package

```
shot_1A/
├── 01_clay_1A.mp4              960x720, H.264, 24fps, 288 frames   @Video 1
├── 02_look_chips.png           macro chocolate chips               @Image 1
├── 03_look_cookie.png          classic Decadent hero cookie        @Image 2
├── 04_look_pack_chip.png       The Decadent Chocolate Chip         @Image 3
├── 05_look_pack_soft.png       The Decadent Soft Baked             @Image 4
├── 06_look_pack_pb.png         The Decadent Peanut Butter Chunk    @Image 5
├── 07_look_pack_reverse.png    The Reverse Decadent                @Image 6
├── 08_look_lighting.png        mood and contrast reference         @Image 7
├── stills/
│   ├── first_frame.png
│   ├── last_frame.png
│   ├── beat_0144.png
│   ├── beat_0204.png
│   └── topdown_blocking.png
├── prompt.txt
├── metadata.json
└── README.txt
```

Upload order must match the `@Image n` indices. Most surfaces index by upload
order, not by filename.

**REVISED — the filename numbers and the reference indices are off by one.** The
clip is file `01` and is `@Video 1`, which makes `08_look_lighting.png`
**`@Image 7`**, not `@Image 8`. Getting this wrong silently rebinds every
reference role. Derive the indices from the file list in code rather than typing
them, and never write an `@Image n` by hand into the prompt.

### Sourcing @Image 2, the hero cookie

The cookie photo currently in the folder is a thick American soft-baked style
with large melted chips. That is the Soft Baked SKU, not the classic, and it is
now the wrong reference.

The best available source is the classic pack front itself. The hero cookie
printed on it is the Russ Rudd enlargement, which is the definitive photograph
of this exact product. Crop the cookie out of the 800 px pack front and use
that crop as `03_look_cookie.png`.

Two constraints on that crop:

- Use the 800 px pack asset, not the 400 px one. A cookie crop off the 400 px
  version lands around 250 px, below the 300 px reference floor.
- Crop to the cookie only. No pack edge, no type, no chip background. Anything
  else in the frame becomes part of what the model thinks the cookie looks like.

Pull the 800 px version of the classic pack front anyway. Right now it is the
weakest asset in a set of four and it is the hero SKU.

---

## Post plan

Nothing with readable type goes through the generator. Generative video garbles
text reliably and inconsistently between frames, and it is a registered mark.

The advantage you have here that most people do not: you own the camera. Render
a second Blender pass from the identical camera with the four pack fronts at
exact brand colour, emission shaders, sRGB converted to linear, and comp that
layer over the generated plate. Perfect track, no roto, no Mocha corner-pin.
That is the clean way to get the real packaging onto an AI-generated plate.

Composite after generation:

- four pack fronts (exact artwork)
- PC wordmark and The Decadent logotype
- 300 g, legal line, superscripts
- end card
- music and any sound design

---

## Failure routing

| What you see | Layer | Fix |
| --- | --- | --- |
| Chips read as cones or pyramids | Blender | Relathe the chip profile |
| Chips read as smooth eggs or pillows | Blender | Steepen the wall, turn later, add scale variation |
| Chips read as texture, not objects | Resolution | Re-render clay at 960x720 |
| Bed reads as one repeating unit | Blender | Per-instance scale variation, more lattice jitter |
| Cookie reads as a coin or a poker chip | Blender | Wavy rim, thin profile, proud chips |
| Dark smudge in the cookie's centre | Blender | Single centre vertex, not N coincident |
| Cookie comes back thick and soft-baked | Blender + Lane B | 8 mm proxy, correct @Image 2 |
| Cookie reads smaller than a pack | Blender | Ridge; re-solve RIDGE_H from 0.45 m |
| Cookie leans sideways like a falling coin | Blender | Tilt about the axis perpendicular to the view |
| Cookie hidden in the hollow at f164 | Blender | Wider, shallower depression; lower the rim bank |
| Packs read as cereal boxes | Blender | Soften verticals, exponent ~2.45, overhanging fin |
| Pack fin pokes through the bed at f204 | Blender | Bury at 1.4 × PACK_H |
| Pack row looks staggered | Blender | One common shelf height for all four |
| Chips float or the cookie hovers | Blender | Snap to the terrain function, check contact shadows |
| Bed edge or void visible at f288 | Blender | Continuation plane to 11 m |
| Black band at the top of frame 1 | Blender | Close the cyc dome, make it emissive |
| Horizon visible during the macro orbit | Blender | Mid-scale relief + berm + slight lens tilt |
| Bald patch in the chips at f144 | Blender | Trench the bed, do not delete chips |
| Far field reads as woven fabric | Blender | Value noise, not summed sines; check the top-down |
| Smooth floor where relief should be | Blender | Grid too coarse — displacement aliased away |
| Phantom 8 m/s spike in report_speeds | Blender | Skip frames where the object is hidden |
| Blue plastic cones survive into the render | Prompt | Strengthen the exclusion block |
| Five packs, or two cookies | Prompt | Tighten the count constraint |
| Move too fast | Blender | Retime, rerun report_speeds |
| Cookie whips forward mid-crane | Blender | Reparameterise the climb by arc length |
| Wrong chocolate colour or sheen | Lane B | Better @Image 1 |
| Wrong subject picked up by a colour mask | Analysis | Nearest-hue with chips as a competing class |
| Any garbled type | Neither | It should not be in the generation at all |

Change one variable at a time. Hold the clay constant while you iterate the
prompt, then hold the prompt constant while you iterate the clay.

---

## One flag on 4:3

If the finished commercial ships anywhere other than 4:3, this framing has to
be rebuilt rather than resized. Section 7 of `CLAUDE.md` is blunt about it:
composition does not survive an aspect change, and the locked aspect propagates
into the generation, so you cannot fix it after the fact either.

Everything in this brief is aspect-dependent. The crane distance, the pack row
spacing, the forced-perspective cookie offset and the elevation track were all
computed for 1.333. Going to 1:1 or 9:16 later means recomputing all four and
re-rendering, which is cheap, and re-generating, which is not.

The ridge makes this sharper, not looser. Its crest height is solved from the
cookie's 0.45 m target, which is itself derived from the 45 mm lens at 1.55 m.
Change the aspect and all three move together. Keep the solve; never freeze the
crest as a constant.

Worth a minute of thought now on where this actually runs before you build.
