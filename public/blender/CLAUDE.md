# Blender → Seedance 2.5: working notes for Claude

Instructions for Claude when driving Blender through the MCP connection, for
the specific job of producing **clay control passes** that Seedance 2.5
consumes as structural references.

Drop this in a project folder as `CLAUDE.md` and it loads every session.

---

## 0. The job

Blender does not produce the finished commercial. It produces a **clay
render** — untextured grey geometry with flat ID colours — that Seedance 2.5
reads for spatial structure, subject poses, motion paths, camera angles,
occlusion order and light direction. The model produces the finished pixels.

Everything downstream of that changes:

| Old priority | New priority |
| --- | --- |
| Photoreal Cycles renders | Fast, legible clay renders |
| Exact brand hex in the render | Neutral grey plus flat ID colours on mappable proxies |
| Typography rendered in Blender | Typography composited after generation |
| Render time is the bottleneck | Generation credits and review cycles are the bottleneck |
| Render looks correct | Render is unambiguous |

**The fidelity target is unambiguous, not beautiful.** Every hour spent making
the clay pass prettier is wasted. Every minute spent making it clearer is not.

### Why this saves money

A Seedance regeneration costs credits every time. A clay re-render costs
electricity. Moving every decision that *can* be decided in Blender — framing,
lens, blocking, timing, camera path, occlusion — out of the prompt and into
geometry means the expensive step runs once with the answer already known,
instead of five times while you guess.

It also makes the result repeatable. A prompt describing a camera move gives a
different move every run. A clay pass gives the same one.

---

## 1. Hard specs — do not guess these

Documented limits as of August 2026. Verify against the live uploader or API
contract for the channel you are on: the consumer product (Dreamina / Jimeng /
Doubao), the BytePlus ModelArk API, and third-party resellers expose different
subsets.

**Reference inputs, per generation**

- 50 references total: up to 30 images, 10 videos, 10 audio clips
- Reference video total duration: 30 seconds across all clips
- Video: MP4 or MOV, 480p–4K, 300–6000 px, aspect 0.4–2.5, 24–60 fps, under 200 MB
- Images: JPEG, PNG, WebP, BMP, TIFF, GIF, HEIC, HEIF. 300–6000 px, aspect 0.4–2.5, under 30 MB
- Request body ceiling around 64 MB

**Generation output**

- 4–30 seconds in a single pass at 24 fps
- Native resolution is 480p and 720p. Anything higher on a reseller is a
  provider-side upscale, not native model output.
- Long Video mode runs 30–180 seconds
- Extend adds up to 30 seconds to a source under 30 seconds

**Practical, not limits**

- 1–8 distinct image references; more makes role assignment harder
- 5–10 seconds per reference clip
- One clay clip per shot beats one long clip covering everything

**What this means in Blender**

- `scene.render.fps = 24`. Do not render 30 and hope.
- Render clay at 1280×720 for 16:9, or 1080×1080 square. Above 720p buys
  nothing because native output caps there.
- Blender's aspect must equal the delivery aspect. In several modes the source
  video or first image **locks** output aspect and it cannot be overridden at
  generation time.
- Keep the clay clip under 30 seconds. Under 10 is better.

**Cost note.** Reference-video jobs bill differently from text-only jobs on most
providers — commonly input duration **plus** output duration, sometimes with a
floor. A 25-second clay pass makes every regeneration meaningfully more
expensive. Trim the clay to the shot.

---

## 2. Two output lanes — never mix them

Blender produces two categorically different things. Confusing them is the
single most common way this workflow fails.

### Lane A — the clay control pass (video)

Carries: camera path, lens, framing, blocking, motion paths, timing, occlusion
order, ground contact, light direction.

Must NOT carry: brand colour, textures, typography, logos, final materials,
atmosphere, style.

- Neutral grey environment, roughly 18% grey. No pure white, no pure black.
- Flat, saturated, mutually distinct ID colours **only** on subjects you plan
  to map in the prompt. One colour per mappable subject, so the prompt can say
  "the tall blue capsule becomes the chef in @Image 1."
- No text of any kind in frame.
- No overlays, gizmos, axes, grids, frustums, path curves, bounding boxes, rig
  controllers, timecode or watermarks.
- Motion blur off. Depth of field off. Both destroy structural signal, and the
  model adds its own optical behaviour anyway.
- Opaque background: `film_transparent = False`.

### Lane B — look and style references (stills)

Carries: brand colour, material character, finish, lighting mood, typography
style as an aesthetic target, product label detail.

Separate PNG or JPEG files. Blender renders, photographs, brand assets, or a
mix. **Never the same file as the clay.**

The prompt binds them separately: "Reference @Video 1 for camera movement,
pacing, shot-size transitions, subject trajectory and blocking. Reference
@Image 2 for character design, scene, materials, lighting, colour and
atmosphere."

If you catch yourself wanting the clay pass to be the right yellow, you have
merged the lanes. Stop and split them.

---

## 3. The workflow

```
1. PROBE     small throwaway calls to learn the environment
2. CONFIRM   ask the sizing/format/scope questions, restate the plan
3. SCRIPT    write one self-contained .py file, run it as a file
4. VERIFY    render checkpoint stills, LOOK at them, fix, re-run
5. PACKAGE   export the clay clip, stills, prompt and metadata
6. GENERATE  run Seedance, review, route each failure to the right layer
```

Do not skip 1, 2 or 5.

### Why a script file, not incremental live calls

Every `execute_blender_code` call runs in a **fresh Python namespace**. Helper
functions defined in one call do not exist in the next, so building
incrementally means no abstractions and no reusable structure.

More importantly, a scene built through chat exists only in that chat. Clear
the scene and the work is gone. A script file is yours, runs without Claude,
and can be edited and versioned.

This matters more here than in ordinary Blender work, because the clay pass
gets re-rendered many times. Review notes come back as "move the camera 300mm
left and slow the push" — a two-line edit and a 40-second re-render if there is
a script, or a full rebuild if the scene only lived in a conversation.

**Small live calls for probing and one-line tweaks. A script file for anything
past ~50 lines. Fold live patches back into the script immediately.**

### Running it

```python
import traceback
path = "/path/to/project/build.py"
ns = {"__name__": "__main__", "__file__": path}
try:
    exec(compile(open(path).read(), path, "exec"), ns)
    ok, err = True, None
except Exception:
    ok, err = False, traceback.format_exc()
result = {"ok": ok, "error": err}
```

Always wrap in try/except and return the traceback — a failure inside a large
script is otherwise opaque.

For batch work, prefer headless:

```bash
blender --background scene.blend --python build.py -- --shot 1A --draft
```

---

## 4. Phase 1 — probe before you write

Do not trust training data about the Blender API. It changes between versions.

```python
import bpy, sys
result = {"blender": bpy.app.version_string, "python": sys.version}

# Valid render engine identifiers for THIS build
result = {"engines": [e.identifier for e in
          bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]}

# Eevee properties change a lot between versions
result = {"props": sorted([p.identifier for p in bpy.context.scene.eevee.bl_rna.properties
                           if not p.is_readonly])}

# Does material override exist, and does it apply in this engine?
vl = bpy.context.view_layer
result = {"has_override": hasattr(vl, "material_override"),
          "current": getattr(vl, "material_override", None)}

# Unit scale — real-world scale matters for this workflow
u = bpy.context.scene.unit_settings
result = {"system": u.system, "scale_length": u.scale_length}

# Is FFmpeg available in this build?
result = {"formats": [e.identifier for e in
          bpy.types.ImageFormatSettings.bl_rna.properties['file_format'].enum_items]}

# Unknown API shape: read the docstring off a live instance
result = {"doc": some_object.some_method.__doc__}
```

Probing is cheap. A wrong assumption inside a 400-line script is not.

---

## 5. Phase 2 — questions to ask before building

Ask them together, as choices rather than open questions.

**Delivery target**
- Which Seedance surface: Dreamina UI, Doubao, ModelArk API, or a reseller?
  Limits and modes differ by channel; the live selector is the final authority.
- Final aspect ratio, and where the finished video runs.
- Total finished duration, and whether it is one generation or several cut together.

**Shot structure**
- One continuous clay clip, or one per shot? Default to one per shot.
  Multi-shot generations re-roll every shot on every regeneration; per-shot
  clips let you fix one without touching the others, and let you re-cut in post.
- Frame range per shot, in both frames and seconds at 24 fps.

**Proxy mapping**
- Every subject that will be mapped in the prompt, and its ID colour. Confirm
  the list before building.
- For each mapped subject, is there a look reference? If not the model invents
  it, and invents it differently every generation.

**Camera**
- Sensor size and focal length in millimetres per shot. Not a vibe — the model
  reads perspective from the clay, and a fake lens produces a fake-looking result.
- Rig character: locked off, dolly, handheld, crane, drone.

**Existing scene**
- Clear or preserve? **If clearing, save first** with
  `bpy.ops.wm.save_as_mainfile` or get explicit confirmation. Work has been
  permanently lost to this.

**Post plan**
- What gets composited after generation rather than generated: logo, wordmark,
  legal line, pack copy, price, URL, superscripts. Anything with readable text
  belongs on this list.

---

## 6. Clay pass render settings

### Engine

**Eevee is the default.** You want real shadows, because the model infers light
direction and ground contact from them. Workbench is faster but its shadowing is
crude and gives a weaker lighting signal — use it only for blocking checks you
will not upload.

```python
scene.render.engine = "BLENDER_EEVEE"   # probe the exact identifier first
scene.eevee.taa_render_samples = 16     # 16 is plenty for clay
scene.render.fps = 24
scene.render.fps_base = 1.0
scene.render.film_transparent = False
scene.render.use_motion_blur = False

for cam in [o for o in bpy.data.objects if o.type == "CAMERA"]:
    cam.data.dof.use_dof = False
```

### View transform

Standard, not AgX. AgX crushes value separation and desaturates the ID colours
you rely on for subject mapping.

```python
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
```

Check a test frame for clipping. Blown highlights erase geometry, and erased
geometry is erased control signal.

### Clay material

Assign directly to every mesh. More portable than `view_layer.material_override`,
which is Cycles-first historically and whose Eevee behaviour varies by build.

```python
def make_clay(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgb
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Metallic"].default_value = 0.0
    return m

CLAY_NEUTRAL = make_clay("clay_neutral", (0.18, 0.18, 0.18, 1.0))

ID_COLORS = {
    "subject_a": (0.05, 0.20, 0.80, 1.0),   # blue
    "subject_b": (0.85, 0.30, 0.02, 1.0),   # orange
    "subject_c": (0.10, 0.55, 0.15, 1.0),   # green
}
```

Roughness 0.5–0.6 gives readable form without glare. Zero metallic. No bump, no
textures, no transparency.

Record the ID colour map as a constant at the top of the script. The prompt
generator reads from it, so render and prompt cannot drift apart.

### Lighting

One clear key with an unambiguous direction, plus a soft fill. That is it.

The model reads shadow direction and length to build its own lighting. Flat
ambient gives it nothing; a complicated three-point setup gives it contradictory
cues.

- Sun strength 1–3 for tabletop or product scale
- Area lights in single digits to low tens at that scale
- Never blow the subject to white. Wattage sized for a room destroys a 15 cm
  product and takes the depth information with it.
- Keep exposure constant across every shot in the same location. Varying it
  reads as an intentional lighting change.

### Real-world scale

```python
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
```

1 Blender unit = 1 metre. A human proxy is 1.75 m. A pasta box is 0.20 m. The
model infers scale from apparent size against the lens, so a scene built at 10×
reads as a miniature or a giant.

### Camera as a real camera

```python
cam.data.sensor_width = 36.0        # full frame
cam.data.sensor_fit = "HORIZONTAL"
cam.data.lens = 35.0                # actual focal length in mm
```

Pick lenses the way a DP would: 35 mm on full frame for a wide, 85 mm for a
product close-up. Do not solve a framing problem by moving to 200 mm and pulling
back 40 metres — the perspective compression is part of what the model reads.

### Speed sanity

The model renders what the clay implies, so a proxy sliding at 6 m/s comes back
as a sprint.

| Motion | Approx speed |
| --- | --- |
| Slow walk | 1.1 m/s |
| Normal walk | 1.4 m/s |
| Brisk walk | 1.8 m/s |
| Jog | 3.0 m/s |
| Run | 5–6 m/s |
| Handheld drift | under 0.5 m/s |
| Dolly push | 0.3–1.0 m/s |

Add an assertion that prints peak per-second displacement for every animated
object and camera. It catches retiming mistakes instantly.

---

## 7. Animating the pass — and being honest about what you did not simulate

The render settings above decide how the clay *looks*. This section decides how
it *moves*, and it is the part that was missing when the first shots came back
wrong. A pass can be perfectly lit, correctly scaled and shot on a real camera,
and still produce a bad generation because the motion in it was a stand-in that
the prompt then described as gospel.

### The rule that governs everything here

**The clay pass is authoritative about the camera and provisional about
everything else — and the prompt has to say which is which.**

Camera path, shot-size progression, beat timing, occlusion order and light
direction are expensive to fix downstream, so settle them in 3D. Granular
dynamics, cloth, fluid and secondary motion are miserable to simulate and are
things the video model is already good at. Control is a dial, not a switch.

What goes wrong is not choosing one or the other. It is animating a placeholder
and then writing a prompt that says *inherit the subject trajectories*. The
model obeys, faithfully, and you get a flat disc skating across a frozen
surface at a cost of several dollars a take.

### Subjects must be solids, not stand-ins

Every hero object gets real thickness and a real profile, even in clay:

- Give it depth. A cookie is a domed cylinder with a visible rim, not a plane
  with a circle on it. A flat proxy reads as a sprite in the generation because
  it *was* a sprite in the blockout.
- Rotate it in three axes while it travels. A body that only rotates around Z
  reads as a cutout being dragged.
- Ease every move in and out. Constant-velocity translation is the single
  clearest tell of unedited keyframes; the model copies the easing curve it is
  shown.
- Keep the object's contact point consistent with its geometry. If it is
  half-buried, bury it — do not float it a few millimetres above the surface
  and rely on the camera angle to hide the gap.

### Granular beds: simulate locally, or declare the placeholder

A bed of loose material — chips, beans, sand, snow, pellets — is where most of
the realism lives and most of the bake time goes. Three viable strategies:

1. **Full rigid-body sim.** Correct, and usually unnecessary. Baking thousands
   of instanced bodies is slow and painful to art-direct.
2. **Local sim.** Simulate a few hundred bodies in the contact region only and
   leave the rest as static instanced geometry. This is the sweet spot: the
   displacement reads, the bake finishes, and the camera never sees the edge of
   the simulated region.
3. **Static bed, declared as a placeholder.** Perfectly legitimate — as long as
   the prompt says so. This is the cheapest option and it works, *provided*
   you take the second half of the deal.

The second half of the deal is not optional. If you did not simulate it, the
Seedance prompt must contain the physics contract in §11 and must not ask the
model to inherit subject trajectories.

### If you do simulate: what a moving body actually does to a bed

Worth knowing even when you are leaving it to the model, because it is what you
are describing to it:

- **On impact:** material displaced outward in a low ring; individual pieces
  rolling and knocking rather than sliding as a sheet; a few flicked up to
  bounce once; the rim of the depression cascading inward and settling a beat
  after the object has stopped.
- **While travelling:** a bow wave building and spilling at the leading edge;
  material shearing outward into low banks along both flanks; a furrow opening
  behind, made of individual pieces catching light — never a smooth dark void;
  the furrow's walls slumping inward and partly refilling it a beat behind,
  because loose material cannot hold a steep face.
- **While rising out:** the surface doming first, then parting; material
  sheeting off continuously and catching in every recess; a collar avalanching
  inward against the base as the bed slumps to fill the space; the object
  finishing *seated* in the bed with an uneven bank against it, not standing on
  a level waterline and not hovering above one.

### Timing and the beat sheet

- Author beats as real keyframe ranges on the timeline, not as a description
  you hope the render matches. The Seedance prompt's timeline and the blockout's
  timeline have to agree to the frame, because the prompt tells the model to
  match the clip's duration and route.
- One state change per beat, with a visible end state. Three simultaneous
  actions in one range produce omissions, not density.
- Let a settle have follow-through past its beat boundary. Motion that stops
  dead on a round number reads as keyframed.
- 24 fps, and check the scene frame rate before you keyframe anything —
  authoring at 30 and exporting at 24 silently retimes every beat.

### Motion blur: off in the clay, on in the render

Render the clay pass **sharp**. Motion blur in the control pass smears the very
geometry the model is meant to read for trajectory and occlusion. Ask for
natural blur in the Seedance prompt instead, where it belongs.

### Before you export, watch it once

Play the blockout back at speed and ask three questions:

1. Does anything move at constant velocity? Fix the easing.
2. Does anything slide across a surface without disturbing it? Either simulate
   it locally or write it into the prompt as a placeholder to override.
3. Does anything end the shot floating, intersecting, or resting on a
   suspiciously level line? Seat it properly — the generation will amplify it.

A pass that fails any of these is not broken. It just means the prompt now has
work to do, and §11 is where that work is written down.

## 8. Gotchas that produce silently wrong output

Most are silent: the render succeeds and the generation just comes back wrong.

### Reference-specific

**Overlays leak into viewport renders.** If you use `bpy.ops.render.opengl` for
speed, overlays are on by default and axes, grids and outlines burn into the
frame. The model treats them as scene content.

```python
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        sp = area.spaces.active
        sp.overlay.show_overlays = False
        sp.show_gizmo = False
```

Safer: use `bpy.ops.render.render` and skip the problem.

**Floating proxies produce floating subjects.** If a proxy does not visibly
touch the ground with a contact shadow, the model has no reason to ground it.
Check every subject at every keyframe.

**Occlusion order matters more than form.** The model reads who passes in front
of whom. Ambiguous silhouette overlap at a key moment resolves randomly, and
differently every run. Separate in depth or reframe.

**Ambiguous proxies get resolved arbitrarily.** A capsule reads as "some
vertical thing". If a subject is a person, give it human proportions — head,
torso, two legs, 1.75 m. Ten extra minutes of proxy work removes a whole class
of regeneration.

**Nothing you cannot describe.** If the clay does something the prompt does not
explain, the model invents an explanation. Every motion should have a matching
sentence.

**The first frame is load-bearing.** It anchors composition, and in several
modes determines output aspect. Make frame 1 a real composition, not a lead-in.

**Camera shake gets amplified.** Do not bake handheld noise into the clay unless
you want a lot of it. Describe the rig in the prompt instead.

**Void beyond the ground plane.** A plane sized for a top-down camera shows its
edge as empty space when an angled camera looks across it. Size it at 10× the
subject or add a backdrop — void edges read as scene boundaries and the model
builds walls there.

**Aspect drift between draft and final.** Composition does not survive an aspect
change; all framing needs rebalancing. Worse here than in ordinary work, because
the locked aspect propagates into the generation.

### General Blender

**Visibility does not inherit.** `hide_render` and `hide_viewport` do not
propagate parent to child. Hiding a parent empty leaves every child fully
visible. A stray visible proxy corrupts the control signal, so key visibility on
every object individually, with `CONSTANT` interpolation for a hard cut.

```python
for o in [obj] + obj.children_recursive:
    for prop in ("hide_render", "hide_viewport"):
        setattr(o, prop, True);  o.keyframe_insert(prop, frame=start - 1)
        setattr(o, prop, False); o.keyframe_insert(prop, frame=start)
        o.keyframe_insert(prop, frame=end)
        setattr(o, prop, True);  o.keyframe_insert(prop, frame=end + 1)
```

**Primitives have caps.** `primitive_cone_add` and `primitive_cylinder_add`
create closed solids. A bowl or pot built from one renders as a sealed disc and
hides everything inside. Looks like "the contents failed to generate"; the
geometry is fine and simply occluded.

```python
import bmesh
mesh = obj.data
bm = bmesh.new()
bm.from_mesh(mesh)
top = max(bm.faces, key=lambda f: f.calc_center_median().z)
bmesh.ops.delete(bm, geom=[top], context="FACES")
bm.to_mesh(mesh)
bm.free()
```

**Blender 4.4+ / 5.x layered actions.** `action.fcurves` no longer exists.

```python
fc = obj.animation_data.action.fcurve_ensure_for_datablock(
    obj, "rotation_euler", index=2)
for kp in fc.keyframe_points:
    kp.interpolation = "BEZIER"
    kp.easing = "EASE_IN_OUT"
```

**Eevee property names.** The identifier is `'BLENDER_EEVEE'`, not
`'BLENDER_EEVEE_NEXT'`. The old `use_gtao` and `use_ssr` toggles are gone;
`use_raytracing` replaces them. Probe rather than guess.

**Multi-camera scenes.** Do not keyframe `scene.camera`. Bind cameras to
timeline markers so one render pass covers all shots.

```python
marker = scene.timeline_markers.new("cam_1a", frame=1)
marker.camera = cam_1a
```

If you are exporting one clip per shot, set `scene.camera` per export pass
instead.

**Z-fighting and buried geometry.** Decals or labels parented onto an object
render buried inside it if their z does not clear the surface. Check actual
bounds, including any lid or panel on top.

### Only when you are rendering finals in Blender

The clay lane does not want exact colour. If you are rendering Lane B look
references, or finishing a graphic piece in Blender rather than in Seedance,
these still apply.

**AgX destroys brand colour.** Saturated brand colours desaturate badly and pure
black lifts to grey. Use `Standard`.

**Use emission, not Principled, for exact hex** on flat elements — backgrounds
and typography. Emission ignores lighting so the colour lands as authored.

**Convert hex to linear before assigning.** Blender stores colour linearly, so
assigning sRGB directly gives the wrong colour.

```python
def hex_to_linear(hex_str, alpha=1.0):
    hex_str = hex_str.lstrip("#")
    r, g, b = (int(hex_str[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    def to_lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (to_lin(r), to_lin(g), to_lin(b), alpha)
```

**Check the font exists before referencing it.**

```python
import glob
result = {"fonts": glob.glob("/System/Library/Fonts/**/*.tt*", recursive=True)}
```

---

## 9. Phase 4 — verify visually, always

You cannot judge a render you have not looked at.

```python
for f in CHECKPOINTS:            # named constants at the top of the script
    scene.frame_set(f)
    scene.render.filepath = f"{OUT}/checks/chk_{f:04d}"
    bpy.ops.render.render(write_still=True)
```

**Clay pass checklist.** Run every item against a real frame, not against the
script exiting cleanly.

- [ ] Aspect ratio matches delivery aspect exactly
- [ ] fps is 24
- [ ] Every mapped subject is its assigned ID colour, and no other object shares it
- [ ] Every subject has a visible contact shadow
- [ ] Silhouettes separable at every beat, no ambiguous overlaps
- [ ] No text, logos or numbers anywhere in frame
- [ ] No axes, grids, gizmos, frustums, path curves or bounding boxes
- [ ] Nothing clipped to pure white, nothing crushed to pure black
- [ ] Ground plane extends past frame at every camera angle
- [ ] One clear light direction, consistent across the shot
- [ ] Implied speeds physically sane
- [ ] Frame 1 is a real composition
- [ ] Clip under 30 seconds, ideally under 10

Do not report success because the script exited cleanly. The classic failure was
a render returning `status: ok` while the brand yellow was cream, the type was
grey, the bowl was a sealed white disc and the lid floated detached in space.
The Seedance version of that failure is subtler and you only see it after you
have spent credits.

---

## 10. Phase 5 — the export package

One self-contained folder per shot. Name files so upload order matches the
`@Video 1` / `@Image 1` indices the prompt refers to, because most surfaces
index by upload order.

```
shot_1A/
├── 01_clay_1A.mp4          # the clay control pass, H.264, 24fps
├── 02_look_product.png     # Lane B style reference
├── 03_look_environment.png # Lane B style reference
├── stills/
│   ├── first_frame.png
│   ├── last_frame.png
│   ├── beat_0060.png
│   └── topdown_blocking.png
├── prompt.txt
├── metadata.json           # lens, sensor, fps, frame range, ID colours, speeds
└── README.txt
```

The top-down blocking still is worth two minutes. It gives an unambiguous read
of spatial relationships that one camera angle cannot. It may carry labels and
arrows, because it is a diagram — exclude it from the visual style in the prompt.

### Encoding

Probe first; some builds ship without FFmpeg, so `file_format = 'FFMPEG'` raises
an enum error. Fallback is a PNG sequence encoded separately:

```bash
ffmpeg -y -framerate 24 -i frames/f_%04d.png \
       -c:v libx264 -pix_fmt yuv420p -crf 18 \
       -movflags +faststart out/01_clay_1A.mp4
```

Verify before uploading:

```bash
ffprobe -v error -show_entries \
  stream=width,height,r_frame_rate,duration,codec_name \
  -of default=noprint_wrappers=1 out/01_clay_1A.mp4
du -h out/01_clay_1A.mp4
```

Check: even dimensions (yuv420p requires them), 24 fps, under 200 MB, aspect
0.4–2.5, dimensions 300–6000 px.

### Rendering and cancelling

Render asynchronously and poll — a blocking call will time out.

```python
bpy.ops.render.render('INVOKE_DEFAULT', animation=True)
bpy.app.is_job_running('RENDER')
```

There is no clean cancel API. Setting `frame_end` does not stop it. Raising
inside a `render_pre` handler does not stop it. Closing the temporary window
works:

```python
for w in bpy.context.window_manager.windows:
    if w.screen and w.screen.name == "temp":
        with bpy.context.temp_override(window=w):
            bpy.ops.wm.window_close()
```

**Large images over the MCP bridge.** Returning image bytes inline can fail on
large payloads. Render to a file path and read the file.

---

## 11. Writing the Seedance prompt from the scene

The script already knows frame ranges, lens, subject list and ID colours. Have
it emit `prompt.txt` so the prompt and the render cannot drift apart.

### Four-layer structure

1. **Material roles.** What each upload controls, stated explicitly. Never let
   the model infer what a reference means.
2. **Creative summary.** One sentence: subject, location, event, style, and the
   governing camera idea.
3. **Visible plot with timing.** Consecutive, non-overlapping ranges. One
   primary state change per range, with a visible end state.
4. **Global requirements and exclusions.** Rules holding across the whole
   result, plus everything that must not appear.

### The exclusion block is mandatory

This is the part people skip, then wonder why their video has grey plastic
people standing in an empty void.

```
Do not inherit primitive geometry, flat grey materials, placeholder shapes,
axes, guide lines, path curves, camera frustums, or the empty set from
@Video 1. Use it only for camera movement, staging, timing, occlusion order,
and light direction.
```

Note what is deliberately absent from that list: motion paths. An earlier
version of this guide licensed inheriting them, which is correct only when the
blockout's motion was genuinely simulated. When it was a placeholder — which is
the common case, see §7 — it hands the model a sprite and asks it to be
faithful. Pair the block above with the physics contract below.

### Template

```
MODE: Clay Renderer / Omni Reference
MATERIALS: @Video 1 clay blockout · @Image 1 product · @Image 2 environment
SETTINGS: Match @Video 1 duration and camera route · 1:1 · 720p

[Reference roles]
@Video 1 is a clay blockout. It is a camera and staging reference, not a
physics reference. Inherit exactly: the camera's path, speed and shot-size
progression; the duration and order of the beats; which object occludes which;
the direction of the key light; and where each element sits in the final frame.
Do not inherit its physics — its subject motion is a placeholder standing in
for dynamics that were never simulated. Keep only the start point, end point
and duration of each move, and re-solve everything between them as real
physical motion.
The orange box becomes the product defined by @Image 1.
The grey room becomes the environment defined by @Image 2.
@Image 1 defines exact package shape, proportions, and finish.
@Image 2 defines materials, colour, lighting quality, and atmosphere.

[Creative direction]
One sentence. Subject, setting, event, style, governing camera idea.

[Timeline]
0-4s:  <one state change, with a visible end state>
4-9s:  <continue from that state, one more change>
9-14s: <resolution, and what holds on the final frame>

[Physics and secondary motion]
Every solid subject has real thickness and a visible edge — never a flat disc,
never a cutout, never a sprite. It rotates in all three axes while travelling,
with easing rather than constant speed.
<Loose material> is a granular material, not a surface texture: thousands of
small loose bodies that roll and knock into each other individually.
On contact, material is displaced outward in a low ring, a few pieces flicked
up to bounce once, and the rim of the depression cascades inward and keeps
settling a beat after the object has stopped.
Travelling through it displaces material continuously: a bow wave building and
spilling at the leading edge, banks shearing outward along both flanks, and a
furrow opening behind made of individual pieces catching light — never a smooth
dark void — whose walls slump inward and partly refill it a beat behind.
Rising out of it happens in stages: the surface domes, then parts; material
sheets off continuously and catches in every recess; a collar avalanches inward
against the base. Anything emerging finishes seated in the material with an
uneven bank against it, never standing on a level waterline and never floating
above one.
Everything eases in and out. Natural motion blur at a 180-degree shutter.
Nothing moves through the material without the material reacting to it.

[Global]
Exactly one product and one hand throughout. Continuous lighting. No cuts other
than those in @Video 1. Photoreal, shot on 35mm, shallow but not extreme depth
of field.

[Exclusions]
No text, no captions, no subtitles, no on-screen type, no logos, no watermarks,
no background music. Do not inherit primitive geometry, flat grey materials,
placeholder shapes, axes, guide lines, or the empty set from @Video 1.
Do not reproduce the blockout's flat, sliding, sprite-like subject motion or its
frozen bed — those are placeholders, not direction. Nothing slides across the
material without sinking into it and moving it. No smooth dark voids standing
in for a disturbed area. Nothing hovers or hangs in clean air above the
material, and no level waterline separates an object from what it stands in.
```

### The physics contract — required whenever you did not simulate

If §7 left anything as a placeholder — a static bed, a proxy dragged along a
path, an object with no thickness — the prompt has to say so and supply the
dynamics instead. Two failures make this non-negotiable, and both cost real
money to discover:

- Asking the model to inherit *subject trajectories* from a blockout whose
  subject motion was never simulated. It obeys. You get a flat object skating
  across a frozen surface, and it looks exactly like a model failure rather
  than a prompt failure.
- Describing only what happens at the moment of contact. Displacement is
  continuous — an object travelling through a bed leaves a wake, and one rising
  out of it moves material the whole way up. A prompt that covers only the
  impact produces an object that lands convincingly and then slides like a
  decal.

Name the failure mode as well as the goal. In practice "never a flat disc,
never a cutout, never a sprite" does more work than any amount of describing
what good looks like, because it tells the model which reading of the blockout
to reject.

### Timing conventions

- Ranges for stage budgets; an exact second only for a critical handoff
- Consecutive and non-overlapping
- Do not micro-schedule. Three actions in one second produces omissions, not
  precision.
- Convert frames to seconds at 24 fps in the generator, and print both so you
  can cross-check against the timeline

### Audio and text punctuation

| Element | Syntax | Example |
| --- | --- | --- |
| Music | parentheses | `(soft pizzicato strings begin)` |
| Sound effect | angle brackets | `<lid clicks once>` |
| Spoken dialogue | curly braces | `{Dinner is ready.}` |
| On-screen subtitle | full-width brackets | `【Open until midnight】` |

For brand work you almost always want the opposite of the last one. State
globally: no subtitles, no captions, no on-screen text.

### Keep type out of the generation

Do not ask the model to render the wordmark, logotype, legal line, price, URL or
pack copy. Generative video garbles type reliably and inconsistently across
frames. Generate the plate, composite the type after.

This also protects brand integrity — the model is not reproducing an
approximation of a registered mark.

---

## 12. Review loop — route each failure to the right layer

The most expensive mistake is fixing a Blender problem with prompt edits, or a
prompt problem with re-renders. Diagnose the layer first.

| What you see | Layer | Fix |
| --- | --- | --- |
| Camera move is wrong | Blender | Re-key the camera, re-render clay |
| Subject in the wrong place at the wrong time | Blender | Re-block, re-render clay |
| Motion reads too fast or too slow | Blender | Retime, check the m/s table |
| Framing is off | Blender | Adjust lens or position, not the prompt |
| Grey plastic or void leaking in | Prompt | Strengthen the exclusion block |
| Proxy read literally — capsule stays a capsule | Prompt + Blender | Add the mapping sentence, give the proxy real proportions |
| Wrong colour, material or mood | Lane B | Better look reference, tighter style sentence |
| Too many subjects, duplicated objects | Prompt | Add an explicit count constraint |
| Identity drifts mid-clip | Prompt + length | More reference images of that subject, or a shorter clip |
| Garbled text | Neither | Remove it from generation, composite in post |
| Product label approximate | Prompt or post | Region edit against a product reference, or comp the pack shot |
| Result soft or blurry | Check the export first | Compare the original generation to the uploaded version before revising the brief |

Change one variable at a time. Hold the clay constant while iterating the
prompt, then hold the prompt constant while iterating the clay. Changing both
tells you nothing about which edit worked.

---

## 13. Script architecture

```python
"""Project, concept, shot map, ID colour map, proxy notes."""

# --- CONFIG ---
# resolution, aspect, FPS=24, per-shot frame ranges, lens per shot,
# ID_COLORS dict, output paths

# --- UTILITIES ---
def clear_scene(...)              # save first if the scene has work in it
def key(obj, path, frames_values, interpolation, easing)
def set_visibility_window(obj, start, end)
def report_speeds()               # peak m/s per animated object, printed

# --- MATERIALS ---
def make_clay(name, rgb)
def setup_clay_materials()        # returns dict, single source of truth

# --- SCENE SETUP ---
def setup_render_settings()       # 24fps, Standard transform, no MB, no DOF
def setup_lighting()              # one key, one fill, scale-appropriate
def setup_cameras()               # real sensor + real focal length per shot

# --- GEOMETRY BUILDERS ---       one function per proxy object

# --- PER-SHOT BUILD/ANIMATE ---
def build_shot_1a() ... def build_shot_n()

# --- EXPORT ---
def render_checkpoints()
def render_clay(shot)             # PNG sequence
def encode_clay(shot)             # ffmpeg to H.264
def export_stills(shot)           # first, last, beats, top-down
def write_prompt(shot)            # emits prompt.txt from CONFIG
def write_metadata(shot)          # emits metadata.json

def main():
    clear_scene(); setup_render_settings(); setup_clay_materials()
    setup_lighting(); setup_cameras()
    build_shot_1a(); ...
    report_speeds()

main()
```

Rules:

- Frame numbers live in named constants at the top. Never inline.
- Comment every proxy needing a real asset, consistently: `# PROXY:`
- Comment every object mapped in the prompt: `# MAPPED: orange -> product`
- Bezier easing for physical motion, linear for mechanical motion
- `write_prompt` reads from the same CONFIG the build reads from. That is the
  whole point — do not hand-write the prompt separately.
- Note the frame bounds your layout assumes, so an aspect change flags itself

---

## 14. Project setup

Claude Code is the right surface: Blender, the exported files, ffmpeg and git
all live on the same machine, so a script revision is a file edit and a render
check is a file read. No transfer step, and `blender --background --python` is
available for headless batches.

Cowork is the better fit when you are away from the machine, want inline visual
previews, or want scheduled render jobs — it handles the "render, look, critique"
loop nicely because images preview inline. A reasonable split is Claude Code for
building and Cowork for review and direction.

```
project/
├── CLAUDE.md              # this file
├── build.py               # the scene build script
├── config.py              # shot map, lenses, ID colours, frame ranges
├── scene.blend
├── out/
│   ├── shot_1A/
│   └── shot_1B/
└── generations/           # what came back from Seedance, dated
```

Keep `generations/` alongside the clay that produced it. Six weeks from now the
only way to know why a shot worked is to see the exact clay pass and the exact
prompt.

---

## 15. Model settings

**Strongest available model (Opus tier) for:**

- Writing the initial build script
- Diagnosing why a generation came back wrong — the genuinely hard part
- Any unfamiliar API surface or version difference
- Prompt architecture and reference role mapping
- Deciding whether a failure lives in the clay, the prompt, or the look refs

That last is the highest-value judgment in the whole workflow. Recognising that a
washed-out generation is an exposure problem in the clay rather than a prompt
problem, or that a floating subject is a missing contact shadow rather than a
model failure, saves real credits.

**A faster model (Sonnet tier) is fine for:** small parameter tweaks on a working
scene, re-rendering a known-good clay pass at a new aspect, routine
render-and-report cycles.

**Extended thinking** is worth enabling for initial authoring and diagnosis.
Unnecessary for "make the key light dimmer".

**Context length matters more than you would expect.** Reference images, script
revisions, generation reviews and render checks accumulate fast. Start a fresh
session per shot rather than carrying a long history, and rely on this file plus
`config.py` rather than earlier conversation.

---

## 16. Shot brief template

Fill this in before any building starts.

```
SHOT ID:            1A
DELIVERY:           1080x1080, 24fps, 12 seconds (288 frames)
SURFACE:            Dreamina UI / ModelArk API / reseller
GENERATION MODE:    Clay Renderer / Omni Reference

CAMERA
  Sensor:           36mm full frame
  Lens:             50mm
  Rig:              slow dolly push, 0.4 m/s
  Start framing:    medium, subject centre, eye level
  End framing:      close, subject fills 60% of frame height

SUBJECTS AND MAPPING
  orange box        -> product, see 02_look_product.png
  blue mannequin    -> hand and forearm, see 03_look_hand.png
  grey environment  -> kitchen counter, see 04_look_kitchen.png

LIGHTING
  Key:              sun, 45 degrees off camera left, 30 degrees elevation
  Fill:             area, camera right, 1/4 key
  Character:        warm morning window light

TIMELINE (frames at 24fps / seconds)
  0-96    / 0-4s    <state change one, visible end state>
  96-216  / 4-9s    <state change two>
  216-288 / 9-12s   <resolution, final frame holds>

PHYSICS
  Loose material:   chocolate chips (granular bed)
  Simulated:        local rigid body, ~400 bodies in the contact region only
  NOT simulated:    the wider bed is static instanced geometry
  Contract:         prompt must declare the bed a placeholder and supply the
                    dynamics — see section 7 and section 11

COMPOSITE AFTER GENERATION
  wordmark, legal line, pack copy

EXCLUSIONS
  no text, no captions, no logos, no music, no grey plastic, no void
```

The `NOT simulated` line is the one that gets skipped, and it is the one that
decides whether the prompt is right. Fill it in even when the answer is
"nothing" — an explicit "nothing" tells the next reader the motion in the
blockout is real and can be inherited, which is exactly the question the prompt
has to answer.

Second-by-second timing tables remove all ambiguity about pacing and make both
the animation code and the prompt close to mechanical. They are worth writing.
