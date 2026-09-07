"""TOKEN — build and render the five shots.

    python3 token_build.py --shot 1A --no-render      # build + checks only
    python3 token_build.py --shot 1A --checkpoints    # stills to look at
    python3 token_build.py --shot 1A --draft --animation
    python3 token_build.py --all --draft --animation  # all five, in order

With Blender installed (renders on your GPU, which is the point):

    blender --background --python token_build.py -- --shot 1A --checkpoints

Probed on Blender 5.0.1. Findings that would each fail silently:

  * There is NO EEVEE bloom property. It was removed; bloom is a compositor
    Glare node now.
  * The compositor is `scene.compositing_node_group`, a node-group datablock.
    Source it from a RENDER LAYERS node — a NodeGroupInput renders pure black —
    and terminate on NodeGroupOutput. CompositorNodeComposite no longer exists.
  * Glare settings are input SOCKETS, not properties, so they are keyframeable.
    The Type socket is a MENU taking display-cased strings: "Bloom", "Fog Glow".
    The old SCREAMING_SNAKE identifiers raise TypeError.
  * The compositor namespace has no Mix or Math node at all.
  * `use_motion_blur` is NOT keyframeable; `motion_blur_shutter` IS. 1E switches
    blur mid-take by driving the shutter to zero.
  * Action.fcurves is gone (layered actions) — reach curves through
    layer -> strip -> channelbag.
"""

import glob
import json
import math
import os
import sys

if "OCIO" not in os.environ:                      # belt-and-braces; see shot 1A notes
    _h = []
    for _b in sys.path:
        if _b:
            _h += glob.glob(os.path.join(_b, "bpy", "*", "datafiles",
                                         "colormanagement", "config.ocio"))
    if _h:
        os.environ["OCIO"] = sorted(_h)[-1]

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import token_config as C

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
STATE = os.path.join(HERE, C.STATE_DIR)


def log(m):
    print("[TOKEN] %s" % m, flush=True)


# ==========================================================================
# UTILITIES
# ==========================================================================
def _fcurves(obj):
    ad = obj.animation_data
    if not ad or not ad.action:
        return []
    out = []
    for layer in ad.action.layers:
        for strip in layer.strips:
            try:
                bag = strip.channelbag(ad.action_slot)
            except Exception:
                continue
            if bag:
                out.extend(bag.fcurves)
    return out


def shape(obj, path, interp="BEZIER", easing="EASE_IN_OUT", frames=None):
    """Set interpolation on one property's curves. Blender 4.4+/5.x layered
    actions: Action.fcurves does not exist, so curves come through the
    layer -> strip -> channelbag chain.

    `frames` restricts the change to those keyframes. Without it a second key()
    call on the same property re-shapes every keyframe already there — which
    silently turned the caret's mechanical CONSTANT blink into a soft BEZIER
    fade, and the blink being mechanical is the setup for 1D's joke."""
    want = None if frames is None else {round(float(f)) for f in frames}
    for fc in _fcurves(obj):
        if fc.data_path != path:
            continue
        for kp in fc.keyframe_points:
            if want is not None and round(float(kp.co[0])) not in want:
                continue
            kp.interpolation = interp
            if interp == "BEZIER":
                kp.easing = easing


def key(obj, path, frames_values, interp="BEZIER", easing="EASE_IN_OUT"):
    """Keyframe a property. The default is a curve, not a ramp — subjects in
    this film are never linear, and constant-velocity subject motion is the
    clearest tell of unedited keyframes."""
    for f, v in frames_values:
        setattr(obj, path, v)
        obj.keyframe_insert(path, frame=f)
    shape(obj, path, interp, easing, frames=[f for f, _ in frames_values])


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                 bpy.data.cameras, bpy.data.actions, bpy.data.node_groups,
                 bpy.data.curves, bpy.data.worlds):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)


# ==========================================================================
# STATE — the handoff that stops the cuts popping
# ==========================================================================
def save_state(shot, tokens, frame):
    """Dump every token's transform at the shot's last frame. The next shot
    opens from exactly this. Do not eyeball it and do not re-scatter with a
    fresh seed per shot."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    rows = []
    for t in tokens:
        m = t.matrix_world
        rows.append({"loc": list(m.translation),
                     "rot": list(t.rotation_euler),
                     "scale": list(t.scale),
                     "color": list(t.color)})
    os.makedirs(STATE, exist_ok=True)
    p = os.path.join(STATE, "%s_out.json" % shot)
    with open(p, "w") as fh:
        json.dump({"shot": shot, "frame": frame, "count": len(rows),
                   "tokens": rows}, fh)
    log("state -> %s (%d tokens at f%d)" % (os.path.basename(p), len(rows), frame))
    return p


def load_state(shot):
    p = os.path.join(STATE, "%s_out.json" % shot)
    if not os.path.exists(p):
        return None
    with open(p) as fh:
        return json.load(fh)


# ==========================================================================
# MATERIALS
# ==========================================================================
def emissive_material(name):
    """ONE material for every token. Colour and brightness come from each
    object's own `color` property through an Object Info node, so 800 tokens
    share one shader and still ignite independently — which is what 1E needs,
    where each token lights as the wave reaches it rather than on a timer.

    RGB carries hue. Alpha carries emission strength, scaled up in the shader,
    because object.color is the only per-object value that is keyframeable."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = nt.nodes["Material Output"]
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = C.EMIT_IGNITE
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(oi.outputs["Color"], em.inputs["Color"])
    nt.links.new(oi.outputs["Alpha"], mul.inputs[0])
    nt.links.new(mul.outputs[0], em.inputs["Strength"])
    # A pure emitter cannot be lit, so the rim light would have nothing in the
    # film to fall on and the slabs would read as glow shapes. A small diffuse
    # lobe under the emission gives it something to catch. It is invisible at
    # ignition strength and does its work exactly where it should: 1D's drained
    # wall and 1E's dead swarm before the wave reaches it.
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = C.SLAB_ALBEDO
    bsdf.inputs["Roughness"].default_value = C.SLAB_ROUGHNESS
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(em.outputs["Emission"], add.inputs[0])
    nt.links.new(bsdf.outputs["BSDF"], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs["Surface"])
    return m


def shared_emit():
    """The ONE emissive material. Everything that needs its brightness or hue
    animated must use this: object.color drives it through an Object Info node,
    and object.color is the only per-object value that is keyframeable.

    A fixed emission shader ignores object.color completely, so keyframing the
    colour of anything wearing one is a silent no-op — which is what left the
    caret lit through the whole of 1A, stopped the 1C core brightening as it
    compressed, and let 1E's shockwave grow to fill the frame and stay there."""
    return bpy.data.materials.get("M_emit") or emissive_material("M_emit")


# ==========================================================================
# SCENE SETUP
# ==========================================================================
def setup_render(shot, draft=False):
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    sc.render.engine = C.ENGINE
    sc.eevee.taa_render_samples = C.TAA_SAMPLES
    if hasattr(sc.eevee, "use_shadows"):
        sc.eevee.use_shadows = True
    res = C.RES_DRAFT if draft else C.RES_FINAL
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.fps = C.FPS
    sc.render.fps_base = 1.0
    sc.frame_start, sc.frame_end = 1, C.frames_of(shot)
    sc.view_settings.view_transform = C.VIEW_TRANSFORM
    sc.view_settings.look = C.VIEW_LOOK
    sc.view_settings.exposure = C.EXPOSURE
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"

    blur = C.SHOTS[shot]["blur"]
    sc.render.use_motion_blur = bool(blur)
    if blur == "SPLIT":
        # use_motion_blur is not keyframeable (probed). Drive the shutter to
        # zero instead: the burst needs blur, the landing must be sharp.
        sc.render.use_motion_blur = True
        sc.render.motion_blur_shutter = C.SHUTTER_ON
        sc.render.keyframe_insert("motion_blur_shutter", frame=C.E_BLUR_LAST_FRAME)
        sc.render.motion_blur_shutter = C.SHUTTER_OFF
        sc.render.keyframe_insert("motion_blur_shutter", frame=C.E_BLUR_LAST_FRAME + 1)
        # keyframe_insert is called on RenderSettings but the animation data
        # lands on the SCENE, under the data_path "render.motion_blur_shutter".
        # RenderSettings itself has no .animation_data at all.
        for fc in _fcurves(sc):
            if fc.data_path.endswith("motion_blur_shutter"):
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT"     # a hard switch, not a ramp
    elif blur:
        sc.render.motion_blur_shutter = C.SHUTTER_ON

    world = bpy.data.worlds.new("void")
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = C.hex_to_linear(C.VOID)
    bg.inputs[1].default_value = 1.0
    sc.world = world

    setup_bloom()
    # Assert the OUTCOME, not the mechanism. The view-transform enum introspects
    # as ["NONE"] at class level while "AgX" assigns fine, so the only honest
    # test is to read it back. An OCIO inherited from Nuke, Resolve or Houdini
    # would silently grade the whole film through another app's config.
    got = sc.view_settings.view_transform
    if got != C.VIEW_TRANSFORM:
        raise RuntimeError(
            "view transform is %r, not %r. OCIO=%s"
            % (got, C.VIEW_TRANSFORM, os.environ.get("OCIO", "<unset>")))
    # Blender sets OCIO to its own bundled config, which is fine. What matters
    # is an OCIO pointing somewhere else — Nuke, Resolve and Houdini all set it
    # globally, and that config would grade the whole film.
    ocio = os.environ.get("OCIO")
    foreign = bool(ocio) and not ocio.startswith(bpy.utils.resource_path("LOCAL"))
    log("Blender %s · %s %dx%d @%dfps · %s · blur=%s%s"
        % (bpy.app.version_string, C.ENGINE, res[0], res[1], C.FPS, got, blur,
           "  [FOREIGN OCIO: %s]" % ocio if foreign else ""))


def setup_bloom():
    """Bloom lives in the compositor now — EEVEE has no bloom property in this
    build. Source from Render Layers: a NodeGroupInput renders pure black."""
    sc = bpy.context.scene
    ng = bpy.data.node_groups.new("comp_%s" % C.FILM, "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    glare = ng.nodes.new("CompositorNodeGlare")
    glare.inputs["Type"].default_value = C.GLARE_TYPE      # display-cased, not BLOOM
    glare.inputs["Strength"].default_value = C.GLARE_STRENGTH
    glare.inputs["Size"].default_value = C.GLARE_SIZE
    if "Threshold" in glare.inputs:
        glare.inputs["Threshold"].default_value = C.GLARE_THRESHOLD
    sat = ng.nodes.new("CompositorNodeHueSat")            # 1D drives this
    sat.name = "DRAIN"
    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(rl.outputs[0], glare.inputs["Image"])
    ng.links.new(glare.outputs[0], sat.inputs["Image"])
    ng.links.new(sat.outputs[0], out.inputs[0])
    sc.compositing_node_group = ng
    return ng


def setup_rim_light():
    """The one non-emissive light in the film. Its only job is edge definition
    so the slabs read as solid objects rather than glow shapes. Same angle,
    same strength, all five shots — it must never be re-derived per shot."""
    d = bpy.data.lights.new("L_rim", type="AREA")
    d.shape = "SQUARE"
    d.size = C.RIM_SIZE
    d.energy = C.RIM_POWER
    d.color = C.RIM_COLOR
    ob = bpy.data.objects.new("L_rim", d)
    bpy.context.scene.collection.objects.link(ob)
    az, el = math.radians(180.0 - C.RIM_AZIMUTH_DEG), math.radians(C.RIM_ELEV_DEG)
    ob.location = (C.RIM_DISTANCE * math.cos(el) * math.cos(az),
                   C.RIM_DISTANCE * math.cos(el) * math.sin(az),
                   C.RIM_DISTANCE * math.sin(el))
    ob.rotation_euler = (-Vector(ob.location)).to_track_quat("-Z", "Y").to_euler()
    return ob


def setup_camera(shot, aim_at=(0, 0, 0)):
    """A real camera, aimed through a constraint on a named empty. Rotation is
    never keyframed on any shot in this film — animate the empty for a change
    of attention, the camera location for the move."""
    spec = C.CAM[shot]
    data = bpy.data.cameras.new("C_%s" % shot)
    data.sensor_width = C.SENSOR_WIDTH          # explicit, never inherited
    data.sensor_fit = "HORIZONTAL"
    data.lens = C.SHOTS[shot]["lens"]
    data.clip_start = 0.002
    data.clip_end = 200.0
    cam = bpy.data.objects.new("C_%s" % shot, data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    aim = bpy.data.objects.new(spec["aim"], None)
    aim.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(aim)
    aim.location = aim_at

    ct = cam.constraints.new("TRACK_TO")
    ct.target = aim
    ct.track_axis = "TRACK_NEGATIVE_Z"
    ct.up_axis = "UP_Y"
    return cam, aim


# ==========================================================================
# THE ONE ASSET
# ==========================================================================
def build_token_mesh():
    """A beveled slab, 6 x 6 x 14 mm. Real thickness and a real bevel: a flat
    proxy reads as a sprite because in the blockout it was one."""
    w, d, h = C.TOKEN_DIM
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    ob = bpy.context.object
    ob.scale = (w / 2, d / 2, h / 2)
    bpy.ops.object.transform_apply(scale=True)
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = C.TOKEN_BEVEL
    bev.segments = 2
    bev.limit_method = "ANGLE"
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh().copy()
    bpy.data.objects.remove(ob, do_unlink=True)
    me.name = "M_token"
    return me


def make_tokens(mesh, mat, n, collection=None):
    obs = []
    coll = collection or bpy.context.scene.collection
    for i in range(n):
        o = bpy.data.objects.new("tok_%04d" % i, mesh)
        coll.objects.link(o)
        o.color = C.hex_to_linear(C.TOKEN_WHITE)[:3] + (1.0,)
        obs.append(o)
    if not mesh.materials:
        mesh.materials.append(mat)
    return obs


def scatter(n, seed=None, extent=None):
    """Seed ONCE and reuse the array. Re-scattering per shot with a fresh seed
    is the fastest way to make every cut pop."""
    rng = np.random.default_rng(seed if seed is not None else C.SCATTER_SEED)
    e = extent if extent is not None else C.SWARM_CUBE
    return rng.uniform(-e / 2, e / 2, (n, 3))


def tumble(rng, n):
    """Rotation on all three axes. A slab tumbling on one axis is the single
    most obvious tell in this whole film."""
    return rng.uniform(0, 2 * math.pi, (n, 3))


# ==========================================================================
# SHOT 1A — SPARK
# ==========================================================================
def build_1a():
    """Its job is to earn the next eleven seconds by refusing to hurry."""
    mat = emissive_material("M_emit")
    mesh = build_token_mesh()
    tok = make_tokens(mesh, mat, 1)[0]
    tok.location = (0, 0, 0)
    # never perfectly axis-aligned — a few degrees so it reads as an object
    tok.rotation_euler = (math.radians(7), math.radians(-11), math.radians(4))

    caret = bpy.data.objects.new("caret", _caret_mesh())
    bpy.context.scene.collection.objects.link(caret)
    caret.data.materials.append(shared_emit())
    caret.color = C.hex_to_linear(C.TOKEN_WHITE)[:3] + (0.55,)

    cam, aim = setup_camera("1A")
    spec = C.CAM["1A"]
    key(cam, "location", [(1, (0, -spec["dist"][0], 0)),
                          (C.A_END, (0, -spec["dist"][1], 0))],
        interp=spec["ease"])                              # eased: starts from rest

    # The blink is MECHANICAL. Two frames on, eight off, CONSTANT interpolation.
    # It is the joke setup for 1D and easing it would spoil that.
    on = C.hex_to_linear(C.TOKEN_WHITE)[:3] + (1.0,)
    off = (0, 0, 0, 0.0)
    beats = [(1, on), (3, off), (11, on), (13, off), (21, on)]
    key(caret, "color", beats, interp="CONSTANT")
    key(caret, "scale", [(21, (1, 1, 1)), (C.A_BLINK_END, (1, 1, 1)),
                         (C.A_SWELL_END, (1.6, 1.0, 1.9))])       # holds, then swells
    key(caret, "color", [(C.A_SWELL_END, on), (C.A_SWELL_END + 6, off)],
        interp="BEZIER")

    # the caret resolves into the token; ignition is a curve, not a ramp
    key(tok, "scale", [(C.A_SWELL_END, (0.15, 0.15, 0.15)),
                       (C.A_SWELL_END + 10, (1.0, 1.0, 1.0))], easing="EASE_OUT")
    ig = [(C.A_SWELL_END, (0, 0, 0, 0.0)),
          (C.A_SWELL_END + 8, on[:3] + (1.0,))]
    # then breathe: emission drifts on a slow sine so it reads alive, not static
    for f in range(C.A_SWELL_END + 8, C.A_END + 1, 5):
        t = (f - C.A_SWELL_END - 8) / max(1, C.A_END - C.A_SWELL_END - 8)
        a = 0.82 + 0.18 * math.sin(t * math.pi * 2.2)
        ig.append((f, on[:3] + (a,)))
    key(tok, "color", ig)
    return [tok], {"caret": caret, "cam": cam, "aim": aim}


def _caret_mesh():
    me = bpy.data.meshes.new("M_caret")
    w, h = 0.002, 0.014
    me.from_pydata([(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2),
                    (w / 2, 0, h / 2), (-w / 2, 0, h / 2)], [], [(0, 1, 2, 3)])
    me.update()
    return me


# ==========================================================================
# SHOT 1B — FAST
# ==========================================================================
def build_1b():
    """Genuinely overwhelming. This is what using every tool at once feels like."""
    mat = emissive_material("M_emit")
    mesh = build_token_mesh()
    toks = make_tokens(mesh, mat, C.TOKEN_COUNT)
    rng = np.random.default_rng(C.SCATTER_SEED)

    st = load_state("1A")
    origin = np.array(st["tokens"][0]["loc"]) if st else np.zeros(3)

    # a tube around the travel axis; the wide lens exaggerates the frame edges,
    # which is where the speed lives
    ang = rng.uniform(0, 2 * math.pi, C.TOKEN_COUNT)
    rad = 0.06 + rng.power(0.6, C.TOKEN_COUNT) * 0.55
    ystart = rng.uniform(-0.4, 2.6, C.TOKEN_COUNT)
    speed = rng.uniform(1 - C.B_SPEED_JITTER, 1 + C.B_SPEED_JITTER, C.TOKEN_COUNT)
    rot0 = tumble(rng, C.TOKEN_COUNT)
    spin = rng.uniform(-9, 9, (C.TOKEN_COUNT, 3))

    cam, aim = setup_camera("1B")
    spec = C.CAM["1B"]
    # The CAMERA on this shot is LINEAR. A constant push is mechanically constant.
    key(cam, "location", [(1, (0, -1.0, 0)), (C.B_END, (0, -1.0 + spec["travel"], 0))],
        interp=spec["ease"])
    key(cam, "rotation_euler", [(1, (0, 0, 0)),
                                (C.B_END, (0, math.radians(spec["roll"]), 0))],
        interp=spec["ease"])   # roll only — TRACK_TO owns the aim
    key(aim, "location", [(1, (0, -1.0 + spec["lead"], 0)),
                          (C.B_END, (0, -1.0 + spec["travel"] + spec["lead"], 0))],
        interp=spec["ease"])

    struct_targets = _structures(rng)
    per = (C.B_STRUCT_END - C.B_STREAM_END) // len(C.B_STRUCTURES)
    step0 = 3.4 / C.FPS                      # the flow rate the STRUCTURE uses

    def cam_y(f):
        return -1.0 + spec["travel"] * (f - 1) / (C.B_END - 1)

    def centre(f, hold, lead):
        """Structures hang ahead of the camera and drift back THROUGH it.
        Pinned to world zero they end up 0.3 m off a 24mm lens, and 800
        emissive tokens that close together are a white blob, not a lattice."""
        return np.array([0.0,
                         cam_y(f) + lead - (f - hold) * step0 * C.B_STRUCT_DRIFT,
                         0.0])

    # Most of the swarm joins every structure — that is the idea, the swarm
    # briefly agreeing on something. A slice keeps streaming past so the frame
    # never empties, and tokens already level with the camera are excluded so
    # nothing has to fly back upstream to take part.
    joiner = (ystart >= C.B_STRUCT_MIN_Y) & (rng.random(C.TOKEN_COUNT) < C.B_JOIN_FRACTION)
    jslot = np.zeros(C.TOKEN_COUNT, dtype=int)
    jslot[np.flatnonzero(joiner)] = np.arange(int(joiner.sum()))
    # half the non-joiners go deep: at 3.4 m/s a 3 m tube is empty by the halfway
    # mark and the stream has to still be arriving under the structures. Only
    # half, because the other half are the near field, and the near field is the
    # shot — those are the tokens that streak past the frame edges at 24 mm.
    deep = ~joiner & (rng.random(C.TOKEN_COUNT) < C.B_STREAM_DEEP_FRACTION)
    ystart[deep] = rng.uniform(2.6, C.B_STREAM_DEPTH, int(deep.sum()))
    final_y = rng.uniform(C.B_TAIL_FINAL_Y[0], C.B_TAIL_FINAL_Y[1], C.TOKEN_COUNT)
    tang = rng.uniform(0, 2 * math.pi, C.TOKEN_COUNT)
    trad = C.B_TAIL_RADIUS * np.sqrt(rng.random(C.TOKEN_COUNT))
    log("structures: %d tokens join, %d stream past · %s"
        % (int(joiner.sum()), int((~joiner).sum()),
           " / ".join("%s %d pts" % (n, len(struct_targets[n])) for n in C.B_STRUCTURES)))

    for i, t in enumerate(toks):
        base = 3.4 * speed[i]
        step = base / C.FPS
        p_split = origin + rng.normal(0, 0.02, 3)
        p_stream = np.array([math.cos(ang[i]) * rad[i], ystart[i], math.sin(ang[i]) * rad[i]])

        def flow(f):
            return (p_stream[0], p_stream[1] - step * (f - C.B_STREAM_END), p_stream[2])

        frames = [(1, tuple(origin)),
                  (C.B_SPLIT_END, tuple(p_split + (p_stream - origin) * 0.25)),
                  (C.B_STREAM_END, tuple(p_stream))]

        if joiner[i]:
            # three structures form and scatter in sequence: two frames to snap
            # together, four to hold, six to come apart. The hold is what makes
            # each read as an intention rather than an accident.
            for k, name in enumerate(C.B_STRUCTURES):
                pts = struct_targets[name]
                lead = C.B_STRUCT_SPEC[name]["lead"]
                off = pts[jslot[i] % len(pts)] + rng.normal(0, 0.004, 3)
                a = C.B_STREAM_END + k * per
                hold = a + per // 2
                f_in = hold - C.B_STRUCT_HOLD
                frames.append((f_in, tuple(centre(f_in, hold, lead) + off)))
                frames.append((hold, tuple(centre(hold, hold, lead) + off)))
                f_out = a + per
                p_out = centre(f_out, hold, lead) + off * C.B_STRUCT_BURST
                if k == len(C.B_STRUCTURES) - 1:
                    # The grid lets go into a tight parallel stream, not a
                    # dispersal: 1C freezes what is here through a 65 mm lens
                    # whose frame is 0.64 m wide. Solved backwards from where
                    # the token has to END, so its own speed cannot park it in
                    # either camera's lens.
                    p_out = np.array([
                        math.cos(tang[i]) * trad[i],
                        final_y[i] + step * (C.B_END - f_out) * C.B_TAIL_SPEED,
                        math.sin(tang[i]) * trad[i]])
                frames.append((f_out, tuple(p_out)))
            # still moving at the cut — 1C stops the swarm, not this shot
            frames.append((C.B_END,
                           (p_out[0],
                            p_out[1] - step * (C.B_END - f_out) * C.B_TAIL_SPEED,
                            p_out[2])))
        else:
            for f in (50, 70, C.B_END):
                frames.append((f, flow(f)))
        key(t, "location", frames, easing="EASE_OUT")
        key(t, "rotation_euler",
            [(1, tuple(rot0[i])), (C.B_END, tuple(rot0[i] + spin[i]))], interp="LINEAR")
        t.color = C.hex_to_linear(C.TOKEN_WHITE)[:3] + (0.85,)
    return toks, {"cam": cam, "aim": aim}


def _structures(rng):
    """Lattice, pipeline, grid. All the same white as the swarm — they are not
    separate subjects, they are the swarm briefly agreeing on something.

    Each shape has to read from a camera looking straight down +Y. A solid
    block of points is a blob and a run along the view axis is a single dot, so
    the lattice is a shell and the pipeline crosses the frame."""
    out = {}
    s = C.B_STRUCT_SPEC["lattice"]["size"]

    # the SHELL of a cube, turned off-axis. A solid block is a blob, and a cube
    # square to the lens is indistinguishable from the grid two beats later.
    g = np.linspace(-s / 2, s / 2, 10)
    lat = np.array([(x, y, z) for x in g for y in g for z in g])
    lat = lat[(np.abs(np.abs(lat) - s / 2) < 1e-6).any(axis=1)]
    ca, sa = math.cos(math.radians(28)), math.sin(math.radians(28))
    cb, sb = math.cos(math.radians(18)), math.sin(math.radians(18))
    ry = np.array([[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]])
    rx = np.array([[1, 0, 0], [0, cb, -sb], [0, sb, cb]])
    out["lattice"] = lat @ ry.T @ rx.T

    s = C.B_STRUCT_SPEC["pipeline"]["size"]
    # a trunk ACROSS the frame with branches. A run along the view axis is a
    # single dot from this camera; it has to cross the frame to read as a pipe.
    trunk = [(v, 0.0, 0.0) for v in np.linspace(-s / 2, s / 2, 220)]
    branch = []
    for bx, d in ((-0.32, 1), (-0.06, -1), (0.14, 1), (0.34, -1)):
        branch += [(bx * s, 0.0, d * v) for v in np.linspace(0.0, s * 0.42, 55)]
    out["pipeline"] = np.vstack([np.array(trunk), np.array(branch)])

    s = C.B_STRUCT_SPEC["grid"]["size"]
    # a plane facing the camera, so it reads as a grid and not as a line
    m = np.linspace(-s / 2, s / 2, 23)
    out["grid"] = np.array([(x, 0.0, z) for x in m for z in m])

    for k in out:
        out[k] = out[k] + rng.normal(0, 0.004, out[k].shape)
    return out


# ==========================================================================
# SHOT 1C — FASTER
# ==========================================================================
def build_1c():
    """The stillest shot in the film while claiming to be the fastest."""
    mat = emissive_material("M_emit")
    mesh = build_token_mesh()
    toks = make_tokens(mesh, mat, C.TOKEN_COUNT)
    rng = np.random.default_rng(C.SCATTER_SEED + 3)
    st = load_state("1B")
    if st:
        pos = np.array([r["loc"] for r in st["tokens"]])
        rot = np.array([r["rot"] for r in st["tokens"]])
    else:
        pos, rot = scatter(C.TOKEN_COUNT), tumble(rng, C.TOKEN_COUNT)

    core_mat = shared_emit()
    core = _icosphere("core", C.C_CORE_R0, core_mat)
    rings = [_torus("ring_%d" % i, r, core_mat) for i, r in enumerate(C.C_RING_R)]

    # Locked off. ZERO keyframes on the camera. It does not move again until 1E.
    cam, aim = setup_camera("1C")
    cam.location = (0.0, -C.C_CAM_DIST, 0.16)
    aim.location = (0, 0, 0)          # AIM_core, static — 1D inherits this rig

    def swirl(v, a):
        """Rotate about the camera's view axis (world Y). One sign for the whole
        swarm — mixed signs read as debris, one direction reads as a vortex."""
        ca, sa = math.cos(a), math.sin(a)
        return np.array([v[0] * ca - v[2] * sa, v[1], v[0] * sa + v[2] * ca])

    order = np.argsort(rng.random(C.TOKEN_COUNT))     # staggered by index
    for n, t in enumerate(toks):
        i = int(order[n])
        p0 = pos[n]
        # the hard stop: three frames maximum, and it should be brutal
        frames = [(1, tuple(p0)), (C.C_FREEZE_END, tuple(p0))]
        start = C.C_FREEZE_END + int((i / C.TOKEN_COUNT) * (C.C_ABSORB_END - C.C_FREEZE_END) * 0.7)
        land = min(C.C_ABSORB_END, start + 14)
        d = np.linalg.norm(p0[:3]) or 1.0
        # they SPIRAL in: constant angular rate while the radius collapses, so
        # the path curves. Straight radial lines read as a magnet, not a vortex.
        a = math.radians(rng.uniform(*C.C_SWIRL_DEG))
        mid = swirl(np.array(p0) / d, a) * d * 0.45
        surf = swirl(np.array(p0) / d, a * 2.0) * C.C_ABSORB_R   # all of them reach
        frames += [(start, tuple(p0)), ((start + land) // 2, tuple(mid)),
                   (land, tuple(surf)), (C.C_END, tuple(surf))]
        key(t, "location", frames, easing="EASE_IN")  # falling into something accelerates
        key(t, "rotation_euler",
            [(1, tuple(rot[n])), (land, tuple(rot[n] + rng.uniform(-4, 4, 3)))],
            interp="LINEAR")
        key(t, "scale", [(land - 1, (1, 1, 1)), (land, (0.01, 0.01, 0.01))],
            interp="CONSTANT")                        # absorbed on contact
        t.color = C.hex_to_linear(C.TOKEN_WHITE)[:3] + (0.8,)

    # the core gets SMALLER as it gets BRIGHTER — both together, that is the shot
    shrink = C.C_CORE_R1 / C.C_CORE_R0
    key(core, "scale", [(C.C_FREEZE_END, (1.0, 1.0, 1.0)),
                        (C.C_DENSE_END, (shrink,) * 3), (C.C_END, (shrink,) * 3)])
    key(core, "color", [(C.C_FREEZE_END, C.hex_to_linear(C.CYAN)[:3] + (0.12,)),
                        (C.C_DENSE_END, C.hex_to_linear(C.CYAN)[:3] + (1.0,)),
                        (C.C_END, C.hex_to_linear(C.CYAN)[:3] + (1.0,))])
    # The rings are the scaffold, and the brief has it assembling right up to
    # C_DENSE_END. Spread their starts so the LAST one lands exactly on that
    # beat — bunched at the top of the shot they were all finished by f33 and
    # the last second of 1C was a still frame before 1D's still frame.
    step = (C.C_DENSE_END - C.C_RING_DRAW - C.C_FREEZE_END) / max(1, len(rings) - 1)
    for i, r in enumerate(rings):
        a = int(round(C.C_FREEZE_END + i * step))
        key(r, "scale", [(a, (0.01, 0.01, 0.01)),
                         (a + C.C_RING_DRAW, (1, 1, 1))], easing="EASE_OUT")
        key(r, "rotation_euler",
            [(a, (math.radians(70 * i), 0, 0)),
             (C.C_DENSE_END, (math.radians(70 * i), 0, math.radians(120 + 40 * i)))])
        key(r, "color", [(a, C.hex_to_linear(C.CYAN)[:3] + (0.0,)),
                         (a + C.C_RING_DRAW, C.hex_to_linear(C.CYAN)[:3] + (0.5,))])
    return toks, {"cam": cam, "aim": aim, "core": core, "rings": rings}


def _icosphere(name, r, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=3)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o


def _torus(name, r, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.0035,
                                     major_segments=64, minor_segments=8)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o


# ==========================================================================
# SHOT 1D — THE WALL
# ==========================================================================
def build_1d():
    """Flat, calm and slightly funny. Play it completely straight.
    Nothing new is built: load 1C's state and change only material values."""
    mat = emissive_material("M_emit")
    mesh = build_token_mesh()
    toks = make_tokens(mesh, mat, C.TOKEN_COUNT)
    st = load_state("1C")
    core_mat = shared_emit()
    core = _icosphere("core", C.C_CORE_R0, core_mat)
    rings = [_torus("ring_%d" % i, r, core_mat) for i, r in enumerate(C.C_RING_R)]

    if st:
        for n, t in enumerate(toks):
            r = st["tokens"][n]
            t.location, t.rotation_euler, t.scale = r["loc"], r["rot"], r["scale"]
            t.color = r["color"]
    # the rings stopped wherever 1C's rotation left them. Copy that angle
    # verbatim; do not resolve it to anything neater. 1D inherits a frame, it
    # does not compose one.
    for i, rg in enumerate(rings):
        rg.rotation_euler = (math.radians(70 * i), 0, math.radians(120 + 40 * i))
        rg.color = C.hex_to_linear(C.CYAN)[:3] + (0.5,)
    core.scale = (C.C_CORE_R1 / C.C_CORE_R0,) * 3   # exactly where 1C left it
    core.color = C.hex_to_linear(C.CYAN)[:3] + (1.0,)

    cam, aim = setup_camera("1D")          # identical rig to 1C — copied, not rebuilt
    cam.location = (0.0, -C.C_CAM_DIST, 0.16)
    aim.location = (0, 0, 0)

    # the only moving object in the shot, and it is LINEAR: a mechanical wipe
    sweep = _sweep_plane(shared_emit())
    half = 0.5 * C.SENSOR_WIDTH / C.SHOTS["1D"]["lens"] * (C.C_CAM_DIST + C.D_SWEEP_Y)
    x = half * C.D_SWEEP_OVERSHOOT
    key(sweep, "location", [(1, (-x, C.D_SWEEP_Y, 0)),
                            (C.D_SWEEP_END, (x, C.D_SWEEP_Y, 0))], interp="LINEAR")
    key(sweep, "color", [(C.D_SWEEP_END, C.hex_to_linear(C.TOKEN_WHITE)[:3] + (0.6,)),
                         (C.D_SWEEP_END + 2, (0, 0, 0, 0.0))], interp="CONSTANT")

    # Saturation is driven once in the compositor rather than per material.
    ng = bpy.context.scene.compositing_node_group
    drain = ng.nodes["DRAIN"].inputs["Saturation"]
    drain.default_value = 1.0
    ng.nodes["DRAIN"].inputs["Saturation"].keyframe_insert("default_value",
                                                           frame=C.D_SWEEP_END)
    drain.default_value = 0.0
    ng.nodes["DRAIN"].inputs["Saturation"].keyframe_insert("default_value",
                                                           frame=C.D_DRAIN_END)
    # eased at the tail so the last of the colour lingers a few frames longer
    for fc in _fcurves(ng) or []:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "EASE_IN"

    for t in toks + [core] + rings:
        c = list(t.color)
        key(t, "color", [(C.D_SWEEP_END, tuple(c)),
                         (C.D_DRAIN_END, tuple(c[:3]) + (c[3] * C.EMIT_DEAD,)),
                         (C.D_END, tuple(c[:3]) + (c[3] * C.EMIT_DEAD,))],
            easing="EASE_IN")
    return toks, {"cam": cam, "aim": aim, "core": core, "rings": rings, "sweep": sweep}


def _sweep_plane(mat):
    me = bpy.data.meshes.new("M_sweep")
    me.from_pydata([(-0.004, 0, -0.7), (0.004, 0, -0.7),
                    (0.004, 0, 0.7), (-0.004, 0, 0.7)], [], [(0, 1, 2, 3)])
    me.update()
    o = bpy.data.objects.new("sweep", me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    return o


# ==========================================================================
# SHOT 1E — RESET AND LAND
# ==========================================================================
def wordmark_targets(n, text=None, target_width=1.35, rise=0.0):
    """Landing coordinates sampled from the actual font outline.

    Sampled along EDGES, not down the vertex array. A text mesh's vertices are
    not ordered around the outline, so interpolating between consecutive array
    entries draws chords between unrelated points on different letters — which
    renders as swooshes cutting across the wordmark rather than letterforms.
    Edges carry the real connectivity.

    The text mesh is a TARGET SET, not a subject: it is hidden from render. The
    letters are made of tokens or they are made of nothing."""
    bpy.ops.object.text_add()
    txt = bpy.context.object
    txt.name = "WORDMARK_targets"
    txt.data.body = text or C.E_WORDMARK
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.data.size = 0.34
    me = txt.to_mesh()
    verts = np.array([list(v.co) for v in me.vertices], dtype=float)
    edges = np.array([list(e.vertices) for e in me.edges], dtype=int)
    txt.to_mesh_clear()
    txt.hide_render = True
    txt.hide_viewport = True
    if len(verts) == 0 or len(edges) == 0:
        raise RuntimeError("wordmark produced no geometry — is a font available?")

    a, b = verts[edges[:, 0]], verts[edges[:, 1]]
    lengths = np.linalg.norm(b - a, axis=1)
    total = lengths.sum()
    # distribute tokens along the outline by arc length, so the density is even
    # rather than clustered wherever the font happened to need control points
    cum = np.concatenate([[0.0], np.cumsum(lengths)])
    want = (np.arange(n) + 0.5) / n * total
    idx = np.clip(np.searchsorted(cum, want) - 1, 0, len(edges) - 1)
    t = ((want - cum[idx]) / np.maximum(lengths[idx], 1e-9))[:, None]
    pts = a[idx] + (b[idx] - a[idx]) * t

    # scale to a known width so the wordmark reads at 960x540, and sit it
    # upright in the XZ plane facing the camera
    span = pts[:, 0].max() - pts[:, 0].min()
    pts *= target_width / max(span, 1e-9)
    out = np.zeros_like(pts)
    out[:, 0] = pts[:, 0] - (pts[:, 0].max() + pts[:, 0].min()) / 2
    out[:, 2] = pts[:, 1] - (pts[:, 1].max() + pts[:, 1].min()) / 2 + rise
    # np.ptp(a), not a.ptp(): the ndarray METHOD was removed in NumPy 2.0, and
    # Blender 5.2.1 ships NumPy 2 while the bpy 5.0.1 wheel ships 1.26. The
    # function form is correct on both.
    log("wordmark: %d verts / %d edges -> %d targets, %.2f x %.2f m"
        % (len(verts), len(edges), n,
           np.ptp(out[:, 0]), np.ptp(out[:, 2])))
    return out, txt


def _credit_text(name, body, width, alpha, top_z, fade_at):
    """Real text geometry, standing in the XZ plane, facing the camera."""
    bpy.ops.object.text_add()
    o = bpy.context.object
    o.name = name
    o.data.body = body
    o.data.align_x = "CENTER"
    o.data.align_y = "TOP"
    o.data.size = 0.1
    o.data.materials.append(shared_emit())
    o.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    o.scale = (width / max(o.dimensions.x, 1e-6),) * 3
    bpy.context.view_layer.update()
    o.location = (0.0, 0.0, top_z)
    white = C.hex_to_linear(C.TOKEN_WHITE)[:3]
    key(o, "color", [(1, white + (0.0,)),
                     (fade_at, white + (0.0,)),
                     (fade_at + 10, white + (alpha,)),
                     (C.E_END, white + (alpha,))], easing="EASE_OUT")
    bpy.context.view_layer.update()
    return o


def build_credit(below_z):
    """The credit stack, as type rather than tokens.

    Particles are the wrong medium for anything that has to be READ: 800 of them
    over 26 characters leaves a 16% gap-to-cap ratio and the letterforms come
    apart. Solid glyphs here, each line dimmer and later than the one above it,
    and rendered rather than comped so that "entirely in Blender" is true of the
    finished frame rather than true of everything except the frame."""
    out = []
    z = below_z
    for i, (body, width, alpha, delay) in enumerate(C.E_CREDIT_LINES):
        z -= C.E_CREDIT_GAPS[i]
        o = _credit_text("credit_%d" % i, body, width, alpha, z,
                         C.E_CREDIT_IN + delay)
        z -= o.dimensions.z
        out.append(o)
    return out


def build_1e():
    """This is the frame people pause on. Budget your re-rolls here."""
    mat = emissive_material("M_emit")
    mesh = build_token_mesh()
    toks = make_tokens(mesh, mat, C.TOKEN_COUNT)
    rng = np.random.default_rng(C.SCATTER_SEED + 7)
    st = load_state("1D")
    pos = (np.array([r["loc"] for r in st["tokens"]]) if st
           else scatter(C.TOKEN_COUNT, extent=0.5))
    rot = (np.array([r["rot"] for r in st["tokens"]]) if st
           else tumble(rng, C.TOKEN_COUNT))

    targets, txt = wordmark_targets(C.TOKEN_COUNT, rise=C.E_WORDMARK_RISE)
    credit = build_credit(float(np.min(targets[:, 2])))
    wave = _icosphere("shockwave", 0.02, shared_emit())
    # it travels outward THROUGH the swarm and is gone; it must not end up a
    # 0.9 m amber sphere sitting around the camera for the rest of the shot
    key(wave, "scale", [(C.E_WAVE_START, (0.02, 0.02, 0.02)),
                        (C.E_WAVE_END + 4, (34, 34, 34)),
                        (C.E_WAVE_END + 8, (34, 34, 34))], easing="EASE_OUT")
    key(wave, "color", [(1, C.hex_to_linear(C.AMBER)[:3] + (0.0,)),
                        (C.E_WAVE_START, C.hex_to_linear(C.AMBER)[:3] + (1.4,)),
                        (C.E_WAVE_END + 6, C.hex_to_linear(C.AMBER)[:3] + (0.0,))])
    key(wave, "hide_render", [(C.E_WAVE_END + 8, True)], interp="CONSTANT")

    cam, aim = setup_camera("1E")
    spec = C.CAM["1E"]
    cam.location = (0.0, -1.15, 0.16)
    # eased: it starts from rest AND comes to a dead stop inside the shot
    key(cam, "location", [(1, (0.0, -1.15, 0.16)),
                          (C.E_COLLAPSE_END, (0.0, -1.15 - spec["pull"], 0.16 + spec["rise"])),
                          (C.E_END, (0.0, -1.15 - spec["pull"], 0.16 + spec["rise"]))],
        interp=spec["ease"])
    # animate the EMPTY for the change of attention, the camera for the move
    key(aim, "location", [(1, (0, 0, 0)), (C.E_APEX, (0, 0, 0.45)),
                          (C.E_COLLAPSE_END, (0, 0, 0)), (C.E_END, (0, 0, 0))])

    dist = np.linalg.norm(pos, axis=1)
    reach = C.E_WAVE_START + (dist / max(dist.max(), 1e-6)) * (C.E_WAVE_END - C.E_WAVE_START)
    grey = C.hex_to_linear(C.DEAD_GREY)[:3]
    white = C.hex_to_linear(C.TOKEN_WHITE)[:3]
    amber = C.hex_to_linear(C.AMBER)[:3]

    # stagger by the target's HORIZONTAL position, not by array index. Edge
    # order round a font outline is arbitrary, so indexing by i resolved the
    # name right-to-left; ranking by x makes it assemble the way it reads.
    order = np.empty(C.TOKEN_COUNT, dtype=int)
    order[np.argsort(targets[:, 0], kind="stable")] = np.arange(C.TOKEN_COUNT)

    late = int(rng.integers(0, C.TOKEN_COUNT))
    for i, t in enumerate(toks):
        f_wave = int(round(reach[i]))
        # each token re-ignites the instant the wave TOUCHES it, not on a timer
        key(t, "color", [(1, tuple(grey) + (C.EMIT_DEAD,)),
                         (f_wave, tuple(grey) + (C.EMIT_DEAD,)),
                         (f_wave + 2, tuple(amber) + (1.35,)),
                         (f_wave + 10, tuple(white) + (0.95,))], easing="EASE_OUT")
        burst = pos[i] + rng.normal(0, 1, 3) * 0.35 + np.array([0, 0, 0.55])
        arrive = C.E_APEX + int((order[i] / C.TOKEN_COUNT) * C.E_ARRIVAL_STAGGER)
        if i == late:
            arrive += C.E_LATE_LAG          # the personality of the whole film
        arrive = min(arrive, C.E_END - 3)
        frames = [(1, tuple(pos[i])), (f_wave, tuple(pos[i])),
                  (C.E_APEX, tuple(burst)),                  # hard ease-out
                  (arrive, tuple(targets[i])),               # ease-in, staggered
                  (C.E_END, tuple(targets[i]))]
        key(t, "location", frames, easing="EASE_IN_OUT")
        # rotation resolves over the last frames of each token's flight,
        # not instantly on arrival
        key(t, "rotation_euler",
            [(1, tuple(rot[i])),
             (C.E_APEX, tuple(rot[i] + rng.uniform(-7, 7, 3))),
             (max(arrive - 6, C.E_APEX + 1), tuple(rot[i] + rng.uniform(-2, 2, 3))),
             (arrive, (0.0, 0.0, 0.0))], easing="EASE_OUT")
    log("late token: tok_%04d, arriving %d frames behind the pack" % (late, C.E_LATE_LAG))
    return toks, {"cam": cam, "aim": aim, "wave": wave, "wordmark": txt,
                  "credit": credit, "late": late}


BUILDERS = {"1A": build_1a, "1B": build_1b, "1C": build_1c,
            "1D": build_1d, "1E": build_1e}


# ==========================================================================
# CHECKS
# ==========================================================================
def report_speeds(shot, toks, extras):
    """Peak per-second displacement. The model is gone, but the eye is not:
    the shot still has to be physically legible."""
    sc = bpy.context.scene
    n = C.frames_of(shot)
    sample = toks[::max(1, len(toks) // 60)]
    track = [("camera", extras["cam"])] + [(t.name, t) for t in sample]
    pos = {k: [] for k, _ in track}
    for f in range(1, n + 1):
        sc.frame_set(f)
        for k, o in track:
            pos[k].append(Vector(o.matrix_world.translation))
    rows = []
    for k, p in pos.items():
        sp = [(p[i + 1] - p[i]).length * C.FPS for i in range(len(p) - 1)]
        rows.append((k, max(sp) if sp else 0.0, sum(sp) / max(1, len(sp))))
    cam_pk = next(r[1] for r in rows if r[0] == "camera")
    sub = [r for r in rows if r[0] != "camera"]
    log("speeds: camera peak %.2f m/s · subjects peak %.2f m/s, mean %.2f m/s (%d sampled)"
        % (cam_pk, max(r[1] for r in sub) if sub else 0,
           sum(r[2] for r in sub) / max(1, len(sub)), len(sub)))
    return rows


def check_linearity(shot, toks):
    """Subjects are never linear. Constant-velocity subject motion is the
    clearest tell of unedited keyframes, so flag any token whose speed barely
    varies across the shot."""
    sc = bpy.context.scene
    n = C.frames_of(shot)
    flat = 0
    for t in toks[::max(1, len(toks) // 40)]:
        p = []
        for f in range(1, n + 1):
            sc.frame_set(f)
            p.append(Vector(t.matrix_world.translation))
        sp = [(p[i + 1] - p[i]).length for i in range(len(p) - 1)]
        moving = [s for s in sp if s > 1e-6]
        if len(moving) > 8:
            var = (max(moving) - min(moving)) / max(max(moving), 1e-9)
            if var < 0.05:
                flat += 1
    if flat:
        log("WARNING: %d sampled tokens move at near-constant velocity" % flat)
    else:
        log("linearity: no sampled token moves at constant velocity")
    return flat == 0


def check_framing(shot, toks, extras):
    """Every prop measured against the frame it actually has to fit in.

    Three bugs cost a render pass each before this existed: a 0.30 m core in a
    0.64 m frame, a shockwave that grew to 46x and became the background, and a
    lattice whose near face was inside the lens. All three looked like plausible
    numbers in the source and like a white-out on screen. Sizes are a rendering
    question, so they get measured against the render, not reasoned about.

    Props are measured on EVERY frame, not just the checkpoints — the shockwave
    peaks at f15 and no checkpoint lands there. The swarm is counted at the
    checkpoints, because that is where the frame has to be worth looking at."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    cam = extras["cam"]
    props = []
    for k, v in extras.items():
        if k in ("cam", "aim", "wordmark", "late"):
            continue
        props += (v if isinstance(v, list) else [v])
    worst = {}
    for f in range(1, C.frames_of(shot) + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for ob in props:
            if ob.name in C.FRAME_FILL_EXEMPT:
                continue
            e = ob.evaluated_get(dg)
            if e.hide_render:
                continue
            pts = [world_to_camera_view(sc, cam, e.matrix_world @ Vector(c))
                   for c in e.bound_box]
            if max(p.z for p in pts) <= 0:
                continue                          # entirely behind the lens
            span = max(max(p.x for p in pts) - min(p.x for p in pts),
                       max(p.y for p in pts) - min(p.y for p in pts))
            if span > worst.get(ob.name, (0, 0))[0]:
                worst[ob.name] = (span, f)
    bad = 0
    for name, (span, f) in sorted(worst.items()):
        if span > C.FRAME_FILL_LIMIT:
            log("WARNING: %s — %s spans %.1f frames at f%d, it IS the frame"
                % (shot, name, span, f))
            bad += 1
    since, want = C.MIN_TOKENS_IN_FRAME.get(shot, (1, 0))
    for f in C.checkpoints_of(shot):
        if f < since:
            continue
        sc.frame_set(f)
        uv = [world_to_camera_view(sc, cam, t.matrix_world.translation) for t in toks]
        seen = sum(1 for p in uv if p.z > 0 and 0 <= p.x <= 1 and 0 <= p.y <= 1)
        if seen < want:
            log("WARNING: %s f%d — only %d tokens in frame" % (shot, f, seen))
            bad += 1
    if not bad:
        if worst:
            name = max(worst, key=lambda k: worst[k][0])
            span, at = worst[name]
            log("framing: %d props inside the frame (widest %s, %.2f frames at f%d),"
                " swarm present" % (len(worst), name, span, at))
        else:
            log("framing: no props in this shot, swarm present at every beat")
    return bad == 0


def check_type_room(shot):
    """Type is comped in the edit, not rendered — but the frame still has to
    leave room for it. This measures the zone each type moment lands in, off the
    rendered checkpoint, so "keep the lower third clear" is a number instead of
    an intention. Blender hands back linear floats from a PNG, so the values are
    encoded to display before the threshold is applied: the editor is looking at
    display pixels, not scene-referred ones."""
    def zone_luma(path, zone):
        img = bpy.data.images.load(path)
        w, h = img.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        bpy.data.images.remove(img)
        x0, x1, y0, y1 = C.TYPE_ZONES[zone]
        band = buf.reshape(h, w, 4)[int(y0 * h):int(y1 * h),
                                    int(x0 * w):int(x1 * w), :3]
        disp = np.clip(band, 0.0, 1.0) ** (1 / 2.2)
        return float((disp * (0.2126, 0.7152, 0.0722)).sum(axis=2).mean())

    d = os.path.join(OUT, shot, "checks")
    bad = 0
    for _, f, txt, hold, zone in [m for m in C.TYPE_MOMENTS if m[0] == shot]:
        got = []
        for ff in C.type_hold_frames(shot, f, hold):
            path = os.path.join(d, "chk_%04d.png" % ff)
            if os.path.exists(path):
                got.append((ff, zone_luma(path, zone)))
        if not got:
            continue
        # a zone that clears during the hold is one the edit can work with, so
        # only flag type that has nowhere to sit for the whole time it is up
        over = all(v > C.TYPE_ROOM_MAX for _, v in got)
        bad += over
        log("  type f%-3d %-6s %-30s zone %s%s"
            % (f, zone, txt[:30],
               " -> ".join("f%d %.3f" % g for g in got),
               "   NOWHERE TO SIT" if over else ""))
    return bad == 0


def check_continuity(shot):
    """Frame 1 of this shot must match the previous shot's saved final state.
    Get this wrong and the cuts pop."""
    order = C.SHOT_ORDER
    i = order.index(shot)
    if i == 0:
        return True
    prev = load_state(order[i - 1])
    if not prev:
        log("continuity: no %s_out.json yet — build the shots in order" % order[i - 1])
        return False
    sc = bpy.context.scene
    sc.frame_set(1)
    toks = [o for o in bpy.data.objects if o.name.startswith("tok_")]
    toks.sort(key=lambda o: o.name)
    if len(toks) != prev["count"] and prev["count"] != 1:
        log("continuity: %d tokens here vs %d saved" % (len(toks), prev["count"]))
        return False
    worst = 0.0
    for n, t in enumerate(toks[:prev["count"]]):
        d = (Vector(t.matrix_world.translation) - Vector(prev["tokens"][n]["loc"])).length
        worst = max(worst, d)
    ok = worst < 1e-4
    log("continuity vs %s_out: worst delta %.6f m  %s"
        % (order[i - 1], worst, "OK" if ok else "<-- CUT WILL POP"))
    return ok


# ==========================================================================
# EXPORT
# ==========================================================================
def _has_ffmpeg(sc):
    keep = sc.render.image_settings.file_format
    try:
        sc.render.image_settings.file_format = "FFMPEG"
        return True
    except TypeError:
        return False
    finally:
        sc.render.image_settings.file_format = keep


def render_checkpoints(shot):
    sc = bpy.context.scene
    frames = C.checkpoints_of(shot)
    d = os.path.join(OUT, shot, "checks")
    os.makedirs(d, exist_ok=True)
    import time
    for f in frames:
        t = time.time()
        sc.frame_set(f)
        sc.render.filepath = os.path.join(d, "chk_%04d" % f)
        bpy.ops.render.render(write_still=True)
        log("  %s f%-4d %5.1fs" % (shot, f, time.time() - t))
    return frames


def render_shot(shot, draft=False):
    """Render to a path with NO extension. Blender appends the frame range after
    whatever you write, so `1A_final.mp4` produces `1A_final.mp40001-0075.mp4`."""
    sc = bpy.context.scene
    sc.camera = [o for o in bpy.data.objects if o.type == "CAMERA"][0]
    d = os.path.join(OUT, shot)
    os.makedirs(d, exist_ok=True)
    import time
    t = time.time()
    if _has_ffmpeg(sc):
        sc.render.image_settings.file_format = "FFMPEG"
        ff = sc.render.ffmpeg
        ff.format, ff.codec = "MPEG4", "H264"
        ff.constant_rate_factor, ff.ffmpeg_preset = "HIGH", "GOOD"
        ff.gopsize, ff.audio_codec = 15, "NONE"
        sc.render.filepath = os.path.join(d, "%s_final" % shot)   # no extension
        bpy.ops.render.render(animation=True)
        _tidy(d, shot)
    else:
        log("no FFMPEG writer in this build — rendering a PNG sequence")
        sc.render.image_settings.file_format = "PNG"
        os.makedirs(os.path.join(d, "frames"), exist_ok=True)
        sc.render.filepath = os.path.join(d, "frames", "f_")
        bpy.ops.render.render(animation=True)
        _encode(d, shot)
    log("%s rendered in %.1f min" % (shot, (time.time() - t) / 60.0))


def _tidy(d, shot):
    for fn in os.listdir(d):
        if fn.startswith("%s_final" % shot) and fn.endswith(".mp4") \
                and fn != "%s_final.mp4" % shot:
            os.replace(os.path.join(d, fn), os.path.join(d, "%s_final.mp4" % shot))
            return


def _encode(d, shot):
    import shutil, subprocess
    frames = os.path.join(d, "frames")
    png = sorted(f for f in os.listdir(frames) if f.endswith(".png"))
    if not png:
        return
    out = os.path.join(d, "%s_final.mp4" % shot)
    cmd = ["ffmpeg", "-y", "-framerate", str(C.FPS), "-start_number",
           str(int(png[0][2:-4])), "-i", os.path.join(frames, "f_%04d.png"),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16",
           "-movflags", "+faststart", out]
    if not shutil.which("ffmpeg"):
        log("no ffmpeg on PATH. Encode with:\n  " + " ".join(cmd))
        return
    r = subprocess.run(cmd, capture_output=True, text=True)
    log("encoded %s_final.mp4" % shot if r.returncode == 0
        else "ffmpeg failed:\n%s" % r.stderr[-400:])


def assemble():
    """Five shots, one film. Hard cuts, no transitions, no re-encode of an
    encode: the per-shot PNG sequences are renumbered into one continuous run
    and encoded once, so the cut frames are exactly the frames that were
    rendered. 75+90+75+45+75 = 360 frames = 12.00 s at 30 fps."""
    import shutil, subprocess
    d = os.path.join(OUT, "film")
    frames = os.path.join(d, "frames")
    if os.path.isdir(frames):
        shutil.rmtree(frames)
    os.makedirs(frames)
    n = 0
    for shot in C.SHOT_ORDER:
        src = os.path.join(OUT, shot, "frames")
        got = sorted(glob.glob(os.path.join(src, "f_*.png")))
        want = C.frames_of(shot)
        if len(got) != want:
            log("%s has %d of %d frames — render it before assembling"
                % (shot, len(got), want))
            return
        for f in got:
            n += 1
            os.link(f, os.path.join(frames, "f_%04d.png" % n))
        log("  %s  %3d frames  -> %04d-%04d" % (shot, want, n - want + 1, n))
    out = os.path.join(d, C.FILM + ".mp4")
    cmd = ["ffmpeg", "-y", "-framerate", str(C.FPS), "-start_number", "1",
           "-i", os.path.join(frames, "f_%04d.png"),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16",
           "-movflags", "+faststart", out]
    if not shutil.which("ffmpeg"):
        log("%d frames staged. No ffmpeg on PATH — encode with:\n  %s"
            % (n, " ".join(cmd)))
        return
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        log("ffmpeg failed:\n%s" % r.stderr[-400:])
        return
    log("%s  %d frames  %.2f s  %.1f MB"
        % (out, n, n / float(C.FPS), os.path.getsize(out) / 1e6))
    check_film_moves(out, n)


def check_film_moves(path, n):
    """Decode the finished film back and prove it is not a still.

    ffmpeg returning 0 says it wrote a file, not that the file is a film. A
    12-second video of a single repeated frame exits 0 and looks correct in
    every log; the only way to know is to read the pixels back out. Three frames
    is enough: if the first, the middle and the last are byte-identical then
    something upstream collapsed and this is not worth uploading."""
    import shutil, subprocess, tempfile, hashlib
    if not shutil.which("ffmpeg"):
        return True
    picks = [1, max(1, n // 2), n]
    got, tmp = [], tempfile.mkdtemp()
    try:
        for f in picks:
            fp = os.path.join(tmp, "p_%04d.png" % f)
            r = subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", path,
                 "-vf", "select=eq(n\\,%d)" % (f - 1), "-frames:v", "1", fp],
                capture_output=True, text=True)
            if r.returncode or not os.path.exists(fp):
                log("could not read frame %d back out of the film" % f)
                return False
            got.append(hashlib.md5(open(fp, "rb").read()).hexdigest())
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if len(set(got)) == 1:
        log("WARNING: frames %s of the film are IDENTICAL — it encoded a still."
            % ", ".join(str(f) for f in picks))
        log("         check the source: "
            "md5 -q out/<shot>/frames/*.png | sort -u | wc -l")
        return False
    log("film moves: frames %s decode to %d distinct images"
        % ("/".join(str(f) for f in picks), len(set(got))))
    return True


# ==========================================================================
# MAIN
# ==========================================================================
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
DRAFT = "--draft" in argv


def arg(flag, default=None):
    return argv[argv.index(flag) + 1] if flag in argv else default


def build_one(shot, draft=False):
    log("")
    log("=== %s — %s ===" % (shot, C.SHOTS[shot]["job"]))
    clear_scene()
    setup_render(shot, draft=draft)
    setup_rim_light()
    toks, extras = BUILDERS[shot]()
    log("built: %d tokens, %d frames, %.0fmm lens"
        % (len(toks), C.frames_of(shot), C.SHOTS[shot]["lens"]))
    check_continuity(shot)
    report_speeds(shot, toks, extras)
    check_linearity(shot, toks)
    check_framing(shot, toks, extras)
    save_state(shot, toks, C.frames_of(shot))
    if "--checkpoints" in argv:
        render_checkpoints(shot)
        check_type_room(shot)
    if "--animation" in argv:
        render_shot(shot, draft=draft)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(STATE, exist_ok=True)
    if "--assemble" in argv:
        assemble()
        return
    shots = C.SHOT_ORDER if "--all" in argv else [arg("--shot", "1A")]
    for s in shots:
        if s not in C.SHOTS:
            log("unknown shot %r — one of %s" % (s, ", ".join(C.SHOT_ORDER)))
            return
        build_one(s, draft=DRAFT)
    log("")
    log("done. state in %s/, renders in %s/" % (C.STATE_DIR, "out"))


main()
