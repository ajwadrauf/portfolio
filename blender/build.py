"""Shot 1A — "The Wall" · clay control pass builder.

One self-contained script, per CLAUDE.md §3: a scene built through chat cannot
be rebuilt, and this pass gets re-rendered many times.

    python3 build.py --checkpoints          # 9 checkpoint stills + top-down
    python3 build.py --draft --animation    # 640x480 clay clip
    python3 build.py --animation            # 960x720 clay clip
    python3 build.py --no-render            # build + report only

Headless EEVEE needs a GL context. On a machine with no GPU:

    LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless GALLIUM_DRIVER=llvmpipe \
        python3 build.py --checkpoints

Probed on Blender 5.0.1 (bpy wheel, Python 3.11). Notes on this build:
  * the render engine identifier is "BLENDER_EEVEE" — not BLENDER_EEVEE_NEXT
  * Action.fcurves is GONE (layered actions). Use fcurve_ensure_for_datablock,
    which exists on the instance even though hasattr on the type says no.
  * the view transform enum introspects as ["NONE"] until OCIO is pointed at the
    wheel's own config, which must happen BEFORE `import bpy` — see below.
"""

import os
import sys

# Must precede `import bpy`. Without it Blender finds no colour-management
# config, "Standard" is unavailable, and every clay value renders wrong.
if "OCIO" not in os.environ:
    for _base in (os.path.join(os.path.dirname(os.__file__), "site-packages"),
                  "/usr/local/lib/python3.11/dist-packages",
                  "/usr/lib/python3/dist-packages"):
        _c = os.path.join(_base, "bpy", "5.0", "datafiles", "colormanagement", "config.ocio")
        if os.path.exists(_c):
            os.environ["OCIO"] = _c
            break

import math
import json
import time

import bpy
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config as C

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "shot_%s" % C.SHOT_ID)
RNG = np.random.default_rng(20260901)


# ==========================================================================
# UTILITIES
# ==========================================================================
def log(msg):
    print("[1A] %s" % msg, flush=True)


def clear_scene():
    """CLAUDE.md §5: if clearing, save first or get explicit confirmation.
    Work has been permanently lost to this."""
    objs = [o for o in bpy.data.objects]
    factory = {"Cube", "Light", "Camera"}
    if objs and not set(o.name for o in objs) <= factory:
        backup = os.path.join(OUT, "pre_build_backup.blend")
        os.makedirs(OUT, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=backup, copy=True)
        log("scene was not factory-fresh; saved a backup to %s" % backup)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                 bpy.data.cameras, bpy.data.actions):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)


def mesh_from_arrays(name, verts, faces):
    """Fast mesh construction. from_pydata is far too slow at chip-bed scale;
    this path builds 1.7 M verts in under a second (probed)."""
    me = bpy.data.meshes.new(name)
    verts = np.asarray(verts, dtype=np.float32)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    totals = np.array([len(f) for f in faces], dtype=np.int32)
    starts = np.concatenate([[0], np.cumsum(totals)[:-1]]).astype(np.int32)
    loop_v = np.concatenate([np.asarray(f, dtype=np.int32) for f in faces])
    me.loops.add(int(totals.sum()))
    me.loops.foreach_set("vertex_index", loop_v)
    me.polygons.add(len(faces))
    me.polygons.foreach_set("loop_start", starts)
    me.update(calc_edges=True)
    me.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=np.int32))
    return me


def new_object(name, mesh, material=None, collection=None):
    ob = bpy.data.objects.new(name, mesh)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if material is not None and not mesh.materials:
        mesh.materials.append(material)
    return ob


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


def set_interpolation(obj, data_path, interp="BEZIER", easing="EASE_IN_OUT"):
    """Blender 4.4+/5.x layered actions: Action.fcurves no longer exists, so the
    curves have to be reached through layer -> strip -> channelbag."""
    for fc in _fcurves(obj):
        if fc.data_path != data_path:
            continue
        for kp in fc.keyframe_points:
            kp.interpolation = interp
            if interp == "BEZIER":
                kp.easing = easing


def key(obj, path, frames_values, interp="BEZIER", easing="EASE_IN_OUT"):
    for frame, value in frames_values:
        setattr(obj, path, value)
        obj.keyframe_insert(path, frame=frame)
    set_interpolation(obj, path, interp, easing)


def set_visibility_window(obj, start, end):
    """CLAUDE.md §7: visibility does NOT inherit. Hiding a parent empty leaves
    every child fully visible, so this is keyed on each object individually with
    CONSTANT interpolation for a hard cut."""
    for prop in ("hide_render", "hide_viewport"):
        if start > C.F_START:
            setattr(obj, prop, True)
            obj.keyframe_insert(prop, frame=start - 1)
        setattr(obj, prop, False)
        obj.keyframe_insert(prop, frame=start)
        obj.keyframe_insert(prop, frame=end)
        if end < C.F_END:
            setattr(obj, prop, True)
            obj.keyframe_insert(prop, frame=end + 1)
        set_interpolation(obj, prop, "CONSTANT")


# ==========================================================================
# MATERIALS
# ==========================================================================
def _ensure_nodes(datablock):
    """`use_nodes` is deprecated for removal in Blender 6.0, and on 5.x the node
    tree already exists the moment you call .new() — which is why it is going.
    Only touch it on builds old enough to actually need it."""
    if datablock.node_tree is None:
        datablock.use_nodes = True
    return datablock.node_tree


def make_clay(name, rgb):
    m = bpy.data.materials.new(name)
    bsdf = _ensure_nodes(m).nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgb
    bsdf.inputs["Roughness"].default_value = C.CLAY_ROUGHNESS
    bsdf.inputs["Metallic"].default_value = C.CLAY_METALLIC
    return m


def setup_clay_materials():
    mats = {"neutral": make_clay("clay_neutral", C.CLAY_NEUTRAL)}
    for key_, rgb in C.ID_COLORS.items():
        mats[key_] = make_clay("clay_%s" % key_, rgb)
    return mats


# ==========================================================================
# SCENE SETUP
# ==========================================================================
def setup_render_settings(draft=False):
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    sc.render.engine = C.ENGINE
    sc.eevee.taa_render_samples = C.TAA_SAMPLES
    if hasattr(sc.eevee, "use_shadows"):
        sc.eevee.use_shadows = True          # contact shadows are the whole point
    if hasattr(sc.eevee, "use_raytracing"):
        sc.eevee.use_raytracing = False      # replaces the old use_gtao / use_ssr
    res = C.RES_DRAFT if draft else C.RES_FINAL
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.pixel_aspect_x = sc.render.pixel_aspect_y = 1.0
    sc.render.fps = C.FPS
    sc.render.fps_base = 1.0
    sc.render.film_transparent = C.FILM_TRANSPARENT
    sc.render.use_motion_blur = C.USE_MOTION_BLUR
    sc.frame_start, sc.frame_end = C.FRAME_RANGE
    sc.view_settings.view_transform = C.VIEW_TRANSFORM
    sc.view_settings.look = C.VIEW_LOOK
    sc.view_settings.exposure = C.EXPOSURE
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    # opaque, near-18% grey world so nothing floats in a void
    world = bpy.data.worlds.new("clay_world")
    bg = _ensure_nodes(world).nodes["Background"]
    bg.inputs[0].default_value = (0.055, 0.055, 0.062, 1.0)
    bg.inputs[1].default_value = 1.0
    sc.world = world
    log("render: %s %dx%d @%dfps  view_transform=%s"
        % (C.ENGINE, res[0], res[1], C.FPS, sc.view_settings.view_transform))


def _ground_dir(az_deg):
    ar = math.radians(az_deg)
    return math.cos(ar), math.sin(ar)


def setup_lighting():
    """One key with an unambiguous direction plus a soft fill. Both fixed in
    world space — see the LIGHTING note in config.py for why the key is not
    carried on the camera."""
    final_az = C.AZ0 + C.CAM_TRACK[-1][4]
    made = []
    for name, az, elev, dist, size, power, colour in (
        ("key",  final_az - C.KEY_OFFSET_DEG,  C.KEY_ELEV_DEG,
         C.KEY_DISTANCE, C.KEY_SIZE, C.KEY_POWER, C.KEY_COLOR),
        ("fill", final_az - C.FILL_OFFSET_DEG, C.FILL_ELEV_DEG,
         C.FILL_DISTANCE, C.FILL_SIZE, C.FILL_POWER, C.FILL_COLOR),
    ):
        data = bpy.data.lights.new("L_%s" % name, type="AREA")
        data.shape = "SQUARE"
        data.size = size
        data.energy = power
        data.color = colour
        ob = bpy.data.objects.new("L_%s" % name, data)
        bpy.context.scene.collection.objects.link(ob)
        dx, dy = _ground_dir(az)
        er = math.radians(elev)
        ob.location = (dx * dist * math.cos(er), dy * dist * math.cos(er),
                       dist * math.sin(er) + 0.05)
        aim = Vector((0.0, 0.0, 0.0)) - Vector(ob.location)
        ob.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
        made.append((name, az, elev, power))
    for n, az, el, p in made:
        log("light %-4s azimuth %6.1f deg  elevation %4.1f deg  %.0f W" % (n, az, el, p))


def setup_cameras():
    """A real sensor and a real focal length. The camera is BAKED per frame
    rather than keyed only at the track points: the move is an orbit plus an arc,
    and letting Blender interpolate between two positions would cut the chord and
    quietly change every framing number in the brief."""
    data = bpy.data.cameras.new("C_shot1A")
    data.sensor_width = C.SENSOR_WIDTH
    data.sensor_fit = C.SENSOR_FIT
    data.clip_start = C.CLIP_START
    data.clip_end = C.CLIP_END
    data.dof.use_dof = C.USE_DOF
    cam = bpy.data.objects.new("C_shot1A", data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    prev = None
    for f in range(C.F_START, C.F_END + 1):
        pos = Vector(C.camera_position(f))
        aim = Vector(C.look_target(f))
        cam.location = pos
        quat = (aim - pos).to_track_quat("-Z", "Y")
        eul = quat.to_euler("XYZ", prev) if prev else quat.to_euler("XYZ")
        prev = eul
        cam.rotation_euler = eul
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        data.lens = C.camera_state(f)[1]
        data.keyframe_insert("lens", frame=f)
    for path in ("location", "rotation_euler"):
        set_interpolation(cam, path, "LINEAR")
    for fc in _fcurves(data):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return cam


# ==========================================================================
# GEOMETRY BUILDERS
# ==========================================================================
# A chocolate chip is NOT a cone. primitive_cone_add gives a spike and the model
# resolves a spike as a spike. This is a lathed profile: flat base, slight belly
# low down, tapering to a rounded apex.
CHIP_PROFILE = [
    (1.000, 0.000),   # flat base edge
    (1.020, 0.130),   # belly, just above the base
    (0.988, 0.285),
    (0.905, 0.440),   # the wall stays steep here — a smooth taper from the base
    (0.775, 0.590),   # reads as a dome, and a dome comes back as an egg
    (0.615, 0.725),
    (0.435, 0.840),
    (0.245, 0.930),
    (0.105, 0.982),
    (0.000, 1.000),   # small rounded tip, not a spike and not a hemisphere
]


def build_chip_arrays(segments):
    """Local-space verts/faces for one chip, apex on +Z, base at z=0."""
    rings = CHIP_PROFILE[:-1]
    verts, faces = [], []
    for r_frac, z_frac in rings:
        for s in range(segments):
            a = 2.0 * math.pi * s / segments
            verts.append((r_frac * C.CHIP_D / 2 * math.cos(a),
                          r_frac * C.CHIP_D / 2 * math.sin(a),
                          z_frac * C.CHIP_H))
    apex = len(verts)
    verts.append((0.0, 0.0, C.CHIP_H))
    base = len(verts)
    verts.append((0.0, 0.0, 0.0))
    for r in range(len(rings) - 1):
        for s in range(segments):
            n = (s + 1) % segments
            faces.append((r * segments + s, r * segments + n,
                          (r + 1) * segments + n, (r + 1) * segments + s))
    top = (len(rings) - 1) * segments
    for s in range(segments):
        n = (s + 1) % segments
        faces.append((top + s, top + n, apex))
        faces.append((n, s, base))          # flat base cap
    return np.array(verts, dtype=np.float32), faces


def _rot_matrices(tilt, spin, roll):
    """Batched Z(roll) * Y(tilt) * Z(spin) rotation matrices."""
    n = len(tilt)
    ct, st = np.cos(tilt), np.sin(tilt)
    cs, ss = np.cos(spin), np.sin(spin)
    cr, sr = np.cos(roll), np.sin(roll)
    Z1 = np.zeros((n, 3, 3)); Z1[:, 0, 0] = cs; Z1[:, 0, 1] = -ss
    Z1[:, 1, 0] = ss; Z1[:, 1, 1] = cs; Z1[:, 2, 2] = 1.0
    Y = np.zeros((n, 3, 3)); Y[:, 0, 0] = ct; Y[:, 0, 2] = st
    Y[:, 1, 1] = 1.0; Y[:, 2, 0] = -st; Y[:, 2, 2] = ct
    Z2 = np.zeros((n, 3, 3)); Z2[:, 0, 0] = cr; Z2[:, 0, 1] = -sr
    Z2[:, 1, 0] = sr; Z2[:, 1, 1] = cr; Z2[:, 2, 2] = 1.0
    return Z2 @ Y @ Z1


def instance_chips(name, points, tilts, spins, rolls, segments, material, scales=None):
    """Bake many chips into a single mesh. One object renders far faster than
    tens of thousands, and the bed never needs to move."""
    base_v, base_f = build_chip_arrays(segments)
    n, nv = len(points), len(base_v)
    mats = _rot_matrices(tilts, spins, rolls)
    if scales is not None:
        mats = mats * scales[:, None, None]
    verts = np.einsum("nij,vj->nvi", mats, base_v) + points[:, None, :]
    faces = []
    for i in range(n):
        off = i * nv
        faces.extend([tuple(int(k) + off for k in f) for f in base_f])
    me = mesh_from_arrays(name, verts.reshape(-1, 3), faces)
    return new_object(name, me, material)


def build_cookie_mesh(name, segments=72, rings=7):
    """55 mm across, 8 mm thick, wavy rim, a very slight dome, and 12 small chips
    proud of the top. A perfect disc comes back as a coin or a poker chip; a
    thick profile comes back soft-baked, which is the wrong SKU."""
    R, T = C.COOKIE_D / 2, C.COOKIE_T
    dome = 0.16 * T

    def rim(a):
        return R * (1.0 + 0.030 * math.sin(3 * a + 0.7)
                    + 0.020 * math.sin(5 * a + 2.1)
                    + 0.012 * math.sin(8 * a + 4.3))

    verts, faces = [], []
    # ring 0 is a SINGLE centre vertex. Building it as N coincident verts left a
    # fan of degenerate faces that shaded as a dark smudge in the cookie's middle.
    top_c = len(verts); verts.append((0.0, 0.0, T / 2 + dome))
    bot_c = len(verts); verts.append((0.0, 0.0, -T / 2 + 0.10 * T))
    top_rings, bot_rings = [[top_c]], [[bot_c]]
    for ri in range(1, rings):
        u = ri / (rings - 1)
        idx = []
        for s in range(segments):
            a = 2.0 * math.pi * s / segments
            r = u * rim(a)
            idx.append(len(verts))
            verts.append((r * math.cos(a), r * math.sin(a),
                          T / 2 + dome * (1.0 - u * u)))
        top_rings.append(idx)
    for ri in range(1, rings):
        u = ri / (rings - 1)
        idx = []
        for s in range(segments):
            a = 2.0 * math.pi * s / segments
            r = u * rim(a)
            idx.append(len(verts))
            verts.append((r * math.cos(a), r * math.sin(a),
                          -T / 2 + 0.10 * T * (1.0 - u * u)))
        bot_rings.append(idx)
    for ri in range(rings - 1):
        for s in range(segments):
            n = (s + 1) % segments
            if ri == 0:
                faces.append((top_rings[1][s], top_rings[1][n], top_c))
                faces.append((bot_rings[1][n], bot_rings[1][s], bot_c))
            else:
                faces.append((top_rings[ri][s], top_rings[ri][n],
                              top_rings[ri + 1][n], top_rings[ri + 1][s]))
                faces.append((bot_rings[ri][n], bot_rings[ri][s],
                              bot_rings[ri + 1][s], bot_rings[ri + 1][n]))
    for s in range(segments):                       # rim wall
        n = (s + 1) % segments
        faces.append((top_rings[-1][n], top_rings[-1][s],
                      bot_rings[-1][s], bot_rings[-1][n]))

    # chips studded across the top — the classic is densely studded with many
    # small chips, not a few large chunks, and that count is a real signal
    cv, cf = build_chip_arrays(10)
    cv = cv * 0.72
    placed = []
    tries = 0
    while len(placed) < C.COOKIE_CHIPS and tries < 900:
        tries += 1
        a = RNG.uniform(0, 2 * math.pi)
        rr = math.sqrt(RNG.uniform(0.02, 0.62)) * R
        p = (rr * math.cos(a), rr * math.sin(a))
        if any(math.dist(p, q) < 0.0092 for q in placed):
            continue
        placed.append(p)
        u = rr / R
        z = T / 2 + dome * (1.0 - u * u) - 0.0022      # sunk so it sits proud, not perched
        off = len(verts)
        tilt = RNG.uniform(-0.20, 0.20)
        ct, st = math.cos(tilt), math.sin(tilt)
        for vx, vy, vz in cv:
            verts.append((p[0] + vx * ct + vz * st, p[1] + vy,
                          z - vx * st + vz * ct))
        faces.extend([tuple(int(k) + off for k in f) for f in cf])
    return mesh_from_arrays(name, np.array(verts, dtype=np.float32), faces)


def build_pack_mesh(name, segments=48, rings=28):
    """A gusseted stand-up bag: soft rounded verticals, a slight bulge at the
    belly, a pinched fin seal across the top, a flat base.

    First pass came back as a rounded box — the exact "packs read as cereal
    boxes" failure in the brief. Three things fix it: a rounder cross-section
    (lower superellipse exponent), a real shoulder taper above the belly, and a
    fin that actually collapses to a flat blade and flares slightly wider than
    the bag, which is the silhouette cue that says "bag" rather than "carton".
    """
    W, D, H = C.PACK_W, C.PACK_D, C.PACK_H
    expo = 2.45                              # 3.4 was too square

    def superellipse(t, w, d):
        c, s_ = math.cos(t), math.sin(t)
        return (w / 2 * math.copysign(abs(c) ** (2.0 / expo), c),
                d / 2 * math.copysign(abs(s_) ** (2.0 / expo), s_))

    def smooth(t):
        t = min(1.0, max(0.0, t))
        return t * t * (3 - 2 * t)

    def profile(v):
        bulge = 1.0 + 0.125 * math.sin(math.pi * (v ** 0.72))    # belly low down
        wf = df = bulge
        if v > 0.55:                                   # shoulders draw in
            t = smooth((v - 0.55) / 0.30)
            wf *= 1.0 - 0.17 * t
            df *= 1.0 - 0.30 * t
        if v > 0.83:                                   # pinched fin seal
            t = smooth((v - 0.83) / 0.17)
            df *= 1.0 - 0.975 * t
            wf *= 1.0 + 0.10 * t                       # the fin overhangs slightly
        if v < 0.11:                                   # gusset flare at the base
            t = 1.0 - v / 0.11
            df *= 1.0 + 0.30 * t * t
            wf *= 1.0 + 0.05 * t * t
        return W * wf, D * df

    verts, faces, ring_idx = [], [], []
    for ri in range(rings):
        v = (ri / (rings - 1)) ** 0.92
        w, d = profile(v)
        idx = []
        for s_ in range(segments):
            t = 2.0 * math.pi * s_ / segments
            x, y = superellipse(t, w, d)
            idx.append(len(verts))
            verts.append((x, y, v * H))
        ring_idx.append(idx)
    for ri in range(rings - 1):
        for s_ in range(segments):
            n = (s_ + 1) % segments
            faces.append((ring_idx[ri][s_], ring_idx[ri][n],
                          ring_idx[ri + 1][n], ring_idx[ri + 1][s_]))
    base_c = len(verts); verts.append((0.0, 0.0, 0.0))
    for s_ in range(segments):
        n = (s_ + 1) % segments
        faces.append((ring_idx[0][n], ring_idx[0][s_], base_c))
    # close the fin as a flat blade rather than a cone, so the top edge is a line
    top = ring_idx[-1]
    for s_ in range(segments // 2):
        a, b = top[s_], top[(segments - 1 - s_) % segments]
        c_, d_ = top[(s_ + 1) % segments], top[(segments - 2 - s_) % segments]
        if c_ == d_ or a == b:
            continue
        faces.append((a, c_, d_, b))
    return mesh_from_arrays(name, np.array(verts, dtype=np.float32), faces)


def build_bed_plane(material, divisions=None):
    """Displaced continuation plane in the same blue as the chips, carrying the
    bed past the last real instance. Without it the instanced bed edge and the
    void behind it are visible at f288, and the model builds a wall there.

    The relief has to be sampled properly. At 520 divisions over 11 m the cells
    were 21 mm and the chip-scale displacement was also ~21 mm, so it landed
    exactly on the grid's Nyquist limit, aliased away, and left a smooth floor
    with a visible ring where the real chips stopped.
    """
    half = C.BED_PLANE_HALF
    divisions = divisions or C.BED_PLANE_DIV
    g = np.linspace(-half, half, divisions)
    X, Y = np.meshgrid(g, g, indexing="ij")
    Z = C.bed_height(X, Y)              # the same terrain the chips sit on
    R = np.hypot(X, Y)

    # Chip-scale relief on top, ramped in outside the depression so the hollow
    # still reads as empty. Value noise, not sines: summed sin(X)*sin(Y) octaves
    # stayed visibly axis-aligned and read as woven fabric across the far field.
    ramp = np.clip((R - (C.DEPRESSION_R + C.DEPRESSION_RIM)) / 0.06, 0.0, 1.0)
    lumps, amp = np.zeros_like(X), 1.0
    for cell, seed in ((0.030, 11), (0.062, 12), (0.130, 13)):
        n = int(2 * half / cell) + 2
        grid = np.random.default_rng(seed).random((n + 1, n + 1))
        u = np.clip((X + half) / cell, 0, n - 1e-6)
        v = np.clip((Y + half) / cell, 0, n - 1e-6)
        i0, j0 = u.astype(np.int32), v.astype(np.int32)
        fu, fv = u - i0, v - j0
        fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
        lumps += amp * (
            grid[i0, j0] * (1 - fu) * (1 - fv) + grid[i0 + 1, j0] * fu * (1 - fv)
            + grid[i0, j0 + 1] * (1 - fu) * fv + grid[i0 + 1, j0 + 1] * fu * fv)
        amp *= 0.55
    Z = Z + (C.CHIP_H * 0.62) * (lumps / 2.05) * ramp - 0.0022
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1)
    i = np.arange(divisions - 1)
    a, b = np.meshgrid(i, i, indexing="ij")
    v0 = (a * divisions + b).ravel()
    quads = np.stack([v0, v0 + 1, v0 + divisions + 1, v0 + divisions], axis=1)
    me = mesh_from_arrays("M_bed_continuation", verts, quads)
    return new_object("bed_continuation", me, material)


def build_cyc(material):
    """Soft warm backdrop. A CLOSED dome, starting below the horizon and closing
    at the apex.

    The first version was an open bowl whose rim sat below eye level, so the
    macro camera — which is 8 mm off the ground — looked straight past it into
    the world background and the top quarter of frame 1 came back pure black.
    A void edge reads as a scene boundary and the model builds a wall there.

    It is an emission shader, not Principled: a cyc 16 m away receives almost no
    light from a key sized for a 9 mm chip, so a lit backdrop renders near-black
    however grey its base colour is. Emission puts it at a dependable ~16% grey.
    """
    segs, rings, R, H, FLOOR = 72, 16, 16.0, 13.0, -2.5
    verts, faces, idx = [], [], []
    for ri in range(rings):
        v = ri / (rings - 1)
        r = R * math.cos(v * math.pi / 2)
        z = FLOOR + (H - FLOOR) * math.sin(v * math.pi / 2)
        if ri == rings - 1:
            break
        row = []
        for s_ in range(segs):
            a = 2 * math.pi * s_ / segs
            row.append(len(verts))
            verts.append((r * math.cos(a), r * math.sin(a), z))
        idx.append(row)
    apex = len(verts); verts.append((0.0, 0.0, H))
    for ri in range(len(idx) - 1):
        for s_ in range(segs):
            n = (s_ + 1) % segs
            faces.append((idx[ri][n], idx[ri][s_], idx[ri + 1][s_], idx[ri + 1][n]))
    for s_ in range(segs):
        n = (s_ + 1) % segs
        faces.append((idx[-1][n], idx[-1][s_], apex))
    me = mesh_from_arrays("M_cyc", np.array(verts, dtype=np.float32), faces)

    mat = bpy.data.materials.new("clay_cyc_emit")
    nt = _ensure_nodes(mat)
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.155, 0.158, 0.170, 1.0)
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    return new_object("cyc", me, mat)


# ==========================================================================
# SCATTER
# ==========================================================================
def jittered_lattice(spacing, r_in, r_out, jitter=0.46):
    """Poisson-ish scatter on a jittered hex lattice. Deterministic count and no
    rejection loop, which matters at ~25 000 chips, and the jitter keeps chips
    overlapping and jumbled rather than laid out in rows."""
    dy = spacing * math.sqrt(3) / 2
    rows = int(math.ceil(2 * r_out / dy)) + 2
    cols = int(math.ceil(2 * r_out / spacing)) + 2
    pts = []
    for j in range(rows):
        y = -r_out + j * dy
        xoff = (spacing / 2) if (j % 2) else 0.0
        for i in range(cols):
            pts.append((-r_out + i * spacing + xoff, y))
    p = np.array(pts, dtype=np.float64)
    p += RNG.uniform(-jitter, jitter, p.shape) * spacing
    r = np.hypot(p[:, 0], p[:, 1])
    return p[(r >= r_in) & (r < r_out)]


def _ridge_patch_centre():
    ax, ay = C.final_axis()
    return C.RIDGE_X * ax, C.RIDGE_X * ay


def scatter_points():
    """Chip centres for the whole bed, densest where the lens actually resolves
    them. Nothing is placed inside the depression: it has to read as empty."""
    zones, prev = [], 0.0
    for outer, spacing in C.SCATTER_ZONES_FINAL if not DRAFT else C.SCATTER_ZONES_DRAFT:
        zones.append(jittered_lattice(spacing, prev, outer))
        prev = outer
    pts = np.concatenate(zones)
    # dense re-scatter over the near foreground ridge
    cx, cy = _ridge_patch_centre()
    keep = np.hypot(pts[:, 0] - cx, pts[:, 1] - cy) > C.RIDGE_PATCH_R
    patch = jittered_lattice(C.RIDGE_PATCH_SPACING if not DRAFT else 0.016,
                             0.0, C.RIDGE_PATCH_R)
    patch = patch + np.array([cx, cy])
    pts = np.concatenate([pts[keep], patch])
    r = np.hypot(pts[:, 0], pts[:, 1])
    return pts[(r > C.DEPRESSION_R * 0.99) & (r < C.BED_REAL_HALF * 1.45)]


def place_on_bed(pts):
    """Snap every chip to the bed surface and sink it slightly. Floating proxies
    produce floating subjects; a chip with no contact shadow gives the model no
    reason to ground it."""
    n = len(pts)
    tilt = RNG.uniform(0.0, math.radians(C.CHIP_TILT_MAX_DEG), n) * RNG.uniform(0.35, 1.0, n)
    spin = RNG.uniform(0, 2 * math.pi, n)
    roll = RNG.uniform(0, 2 * math.pi, n)
    scale = RNG.uniform(*C.CHIP_SCALE_RANGE, n)
    z = C.bed_height(pts[:, 0], pts[:, 1])
    z += (C.CHIP_D / 2) * scale * np.sin(tilt) * 0.55 - C.CHIP_SINK
    return np.stack([pts[:, 0], pts[:, 1], z], axis=1), tilt, spin, roll, scale


# ==========================================================================
# BUILD
# ==========================================================================
def build_shot_1a(mats):
    log("scattering chips ...")
    pts = scatter_points()
    r = np.hypot(pts[:, 0], pts[:, 1])

    ring_m = (r >= C.DEPRESSION_R * 0.99) & (r < C.SPREAD_RING_R)   # pushed by the landing
    macro_m = (r >= C.SPREAD_RING_R) & (r < 0.16)                   # seen at 36 mm frame width
    bulk_m = r >= 0.16

    animated = []

    # --- chips the cookie pushes outward -----------------------------------
    ring_pts, ring_tilt, ring_spin, ring_roll, ring_scale = place_on_bed(pts[ring_m])
    chip_v, chip_f = build_chip_arrays(20)
    hero_i = int(np.argmin(np.abs(np.hypot(ring_pts[:, 0], ring_pts[:, 1]) - C.HERO_R)))
    for i in range(len(ring_pts)):
        m = _rot_matrices(ring_tilt[i:i + 1], ring_spin[i:i + 1], ring_roll[i:i + 1])[0]
        me = mesh_from_arrays("M_chip_ring_%03d" % i, (chip_v @ m.T) * ring_scale[i], chip_f)
        nm = "chip_hero" if i == hero_i else "chip_ring_%03d" % i
        ob = new_object(nm, me, mats["chips"])          # MAPPED: blue -> @Image 1
        ob.location = tuple(ring_pts[i])
        animated.append((ob, tuple(ring_pts[i])))
    log("  %d ring chips (hero chip = %s)" % (len(ring_pts), animated[hero_i][0].name))

    # --- static bed ---------------------------------------------------------
    mp, mt, ms, mr, msc = place_on_bed(pts[macro_m])
    instance_chips("chips_macro", mp, mt, ms, mr, 26, mats["chips"], msc)
    bp, bt, bs, br, bsc = place_on_bed(pts[bulk_m])
    instance_chips("chips_bulk", bp, bt, bs, br, 10, mats["chips"], bsc)
    log("  %d macro chips + %d bulk chips = %d total"
        % (len(mp), len(bp), len(ring_pts) + len(mp) + len(bp)))

    build_bed_plane(mats["chips"])
    build_cyc(mats["neutral"])

    # --- hero cookie --------------------------------------------------------
    cookie = new_object("cookie", build_cookie_mesh("M_cookie"), mats["cookie"])
    # MAPPED: orange -> @Image 2, classic Decadent
    animate_cookie(cookie)

    # --- four packs ---------------------------------------------------------
    pack_mesh = build_pack_mesh("M_pack")
    packs = []
    for spec in C.pack_positions():
        ob = new_object("pack_%s" % spec["key"], pack_mesh, mats[spec["key"]])
        # MAPPED: see config.PACK_NAMES / config.LOOK_FILES
        if not ob.data.materials or ob.data.materials[0] != mats[spec["key"]]:
            ob.data = pack_mesh.copy()
            ob.data.materials.clear()
            ob.data.materials.append(mats[spec["key"]])
        packs.append((ob, spec))
    animate_packs(packs)

    animate_spread(animated)
    return cookie, [p[0] for p in packs], [a[0] for a in animated]


def animate_cookie(cookie):
    """Descends slower than gravity on purpose — that is correct for food, and
    the prompt says so explicitly so the model is not left inventing a reason."""
    final = C.cookie_final()
    fx, fy, fz = final["pos"]
    tilt_end = math.radians(final["tilt_deg"])
    ax, ay = C.final_axis()
    drop = C.SPEED_BUDGET["cookie descent"][2] * \
        (C.F_COOKIE_TOUCH - C.F_COOKIE_IN) / C.FPS
    ground0 = C.bed_height(0.0, 0.0)

    def centre_z(ground, tilt):
        return ground + (C.COOKIE_T / 2) * math.cos(tilt) + (C.COOKIE_D / 2) * math.sin(tilt)

    # Distribute the ridge climb by ARC LENGTH, not by distance along the ground.
    # Advancing "along" uniformly makes the cookie sprint through the steep middle
    # of the ridge, where it is gaining height as fast as it is moving forward:
    # peak speed hit 0.91 m/s against a 0.40 mean. Resampling by path length keeps
    # the speed even and leaves the easing to the ends where it belongs.
    _s = np.linspace(0.0, 1.0, 400)
    _pts = np.array([[ax * C.RIDGE_X * u, ay * C.RIDGE_X * u,
                      centre_z(C.bed_height(ax * C.RIDGE_X * u, ay * C.RIDGE_X * u),
                               tilt_end * u)] for u in _s])
    _cum = np.concatenate([[0.0], np.cumsum(
        np.linalg.norm(np.diff(_pts, axis=0), axis=1))])
    _path_len = float(_cum[-1])
    _cum = _cum / _path_len

    frames = []
    for f in range(C.F_COOKIE_IN, C.F_END + 1):
        if f <= C.F_COOKIE_TOUCH:                       # descent
            t = C._smoothstep((f - C.F_COOKIE_IN) / (C.F_COOKIE_TOUCH - C.F_COOKIE_IN))
            x = y = 0.0
            z = centre_z(ground0, 0.0) + drop * (1.0 - t)
            tilt = 0.0
        elif f <= C.F_ARC_END:                          # settle in the hollow
            t = min(1.0, (f - C.F_COOKIE_TOUCH) / max(1, C.F_COOKIE_SETTLED - C.F_COOKIE_TOUCH))
            rock = math.radians(3.2) * math.exp(-4.5 * t) * math.cos(t * 11.0)
            x = y = 0.0
            z = centre_z(ground0, abs(rock))
            tilt = rock
        else:                                           # climb the ridge, tilt up
            t = C._smoothstep(min(1.0, (f - C.F_ARC_END) / (C.F_LOCK - C.F_ARC_END)))
            u = float(np.interp(t, _cum, _s))           # arc-length reparameterised
            along = C.RIDGE_X * u
            x, y = ax * along, ay * along
            tilt = tilt_end * u
            z = centre_z(C.bed_height(x, y), tilt)
        frames.append((f, x, y, z, tilt))

    # Tip the cookie BACK about the horizontal axis perpendicular to the final
    # view direction, so its face ends up square to the lens. Composing an Euler
    # and then rotating it about Z rolled the cookie sideways instead — it read
    # as a coin falling over, and foreshortened the width that the brief's 15%
    # figure depends on. Rodrigues about (-ay, ax, 0) sends the face normal to
    # exactly (ax.sin t, ay.sin t, cos t), which is the direction of the camera.
    axis = Vector((-ay, ax, 0.0)).normalized()
    prev = None
    for f, x, y, z, tilt in frames:
        cookie.location = (x, y, z)
        eul = Matrix.Rotation(tilt, 4, axis).to_euler("XYZ", prev) if prev \
            else Matrix.Rotation(tilt, 4, axis).to_euler("XYZ")
        cookie.rotation_euler = eul
        cookie.keyframe_insert("location", frame=f)
        cookie.keyframe_insert("rotation_euler", frame=f)
        prev = eul
    for path in ("location", "rotation_euler"):
        set_interpolation(cookie, path, "LINEAR")
    set_visibility_window(cookie, C.F_COOKIE_IN, C.F_END)
    log("cookie: lands f%d, climbs a %.0f mm path, ends %.0f mm from camera "
        "leaning %.1f deg"
        % (C.F_COOKIE_TOUCH, _path_len * 1000, final["distance"] * 1000,
           final["tilt_deg"]))


def animate_packs(packs):
    """Hidden until f204, then they rise into a shallow row. Visibility is keyed
    per object, not on a parent — see set_visibility_window."""
    for ob, spec in packs:
        x, y, ground = spec["pos"]
        ax, ay = C.final_axis()
        ob.rotation_euler = (0.0, 0.0, math.atan2(ay, ax) + math.pi / 2)
        key(ob, "location", [
            (C.F_ARC_END, (x, y, ground - C.PACK_H * C.PACK_BURY)),
            (C.F_LOCK,    (x, y, ground - 0.004)),
            (C.F_END,     (x, y, ground - 0.004)),
        ])
        set_visibility_window(ob, C.F_ARC_END, C.F_END)


def animate_spread(animated):
    """The landing pushes a low ring of chips outward. Nearest chips move most.

    Eased OUT, not in-out: chips shoved by an impact leave fast and decelerate.
    The default ease-in-out has them creep away from a cookie that already
    landed, which is the one thing in the beat the prompt cannot explain."""
    inner = C.DEPRESSION_R
    for ob, (x, y, z) in animated:
        r = math.hypot(x, y)
        f = max(0.0, 1.0 - (r - inner) / max(1e-6, C.SPREAD_RING_R - inner))
        d = C.SPREAD_MAX * (f ** 1.6)
        if d < 1e-5 or r < 1e-6:
            continue
        nx, ny = x / r, y / r
        rest = (x + nx * d, y + ny * d,
                C.bed_height(x + nx * d, y + ny * d) + (z - C.bed_height(x, y)))
        key(ob, "location", [
            (C.F_COOKIE_TOUCH, (x, y, z)),
            (C.F_COOKIE_SETTLED, rest),
            (C.F_END, rest),
        ], easing="EASE_OUT")


# ==========================================================================
# CHECKS
# ==========================================================================
def report_speeds(cam, movers, group=None, group_label="pushed chips"):
    """Peak and mean per-second displacement, measured off the real fcurves —
    not off the config maths — so a retiming mistake shows up immediately.
    Printed per object as well as per budgeted move, per the brief."""
    sc = bpy.context.scene
    tracked = [("camera", cam)] + [(o.name, o) for o in movers]
    # The chips the landing pushes are animated too, and the brief asks for every
    # animated object. 152 of them would drown the table, so they are measured in
    # full and reported as one worst-case line.
    group = list(group or [])
    tracked += [("%s#%d" % (group_label, i), o) for i, o in enumerate(group)]
    pos = {n: [] for n, _ in tracked}
    vis = {n: [] for n, _ in tracked}
    for f in range(C.F_START, C.F_END + 1):
        sc.frame_set(f)
        for n, o in tracked:
            pos[n].append(Vector(o.matrix_world.translation))
            vis[n].append(not o.hide_viewport)

    def speeds(name, f0=C.F_START, f1=C.F_END):
        """Frames where the object is hidden are skipped: a hidden object leaves
        the depsgraph, so its matrix_world goes stale and the frame it reappears
        on reads as a huge phantom jump that nothing on screen actually makes."""
        p, v = pos[name], vis[name]
        return [(p[i + 1] - p[i]).length * C.FPS
                for i in range(f0 - 1, min(f1, C.F_END) - 1)
                if v[i] and v[i + 1]]

    log("")
    log("speeds (m/s)            frames        mean    peak    budget")
    ok = True
    for label, (f0, f1, budget) in C.SPEED_BUDGET.items():
        name = "camera" if label.startswith("camera") else "cookie"
        seg = speeds(name, f0, f1)
        if not seg:
            continue
        mean, peak = sum(seg) / len(seg), max(seg)
        flag = "" if mean <= budget * 1.18 else "   <-- OVER BUDGET"
        if flag:
            ok = False
        log("  %-20s %4d-%-4d  %7.3f %7.3f %7.3f%s"
            % (label, f0, f1, mean, peak, budget, flag))

    log("")
    log("peak per-second displacement, every animated object:")
    if group:
        worst, worst_name = 0.0, ""
        for i in range(len(group)):
            seg = speeds("%s#%d" % (group_label, i))
            if seg and max(seg) > worst:
                worst, worst_name = max(seg), group[i].name
        log("  %-22s %7.3f m/s  worst of %d (%s)"
            % (group_label, worst, len(group), worst_name))
    for name in pos:
        if name.startswith(group_label + "#"):
            continue
        seg = speeds(name)
        if not seg:
            continue
        peak = max(seg)
        at = [i for i, x in enumerate(vis[name]) if x][0] + seg.index(peak) + 1
        note = ""
        if name == "cookie":
            glide = speeds("cookie", C.F_ARC_END, C.F_LOCK)
            note = "   (ridge glide mean %.3f)" % (sum(glide) / len(glide))
        log("  %-22s %7.3f m/s  at f%d%s" % (name, peak, at, note))
    return ok


def check_exposure(path):
    """Measured, not eyeballed. A raking key on thousands of 9 mm chips clips
    easily, and clipped highlights erase the geometry the model reads."""
    img = bpy.data.images.load(path)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, img.channels)[:, :3]
    bpy.data.images.remove(img)
    hot = float((px.max(axis=1) >= 0.985).mean())
    dead = float((px.max(axis=1) <= 0.02).mean())
    return hot, dead


# Hue of each linear ID colour, so the classifier and the palette cannot drift.
def _hue_of(rgb):
    r, g, b = rgb[:3]
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == mn:
        return 0.0
    d = mx - mn
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return h * 60.0


def _classify(px):
    """Assign every pixel to the nearest ID hue, exclusively.

    Two earlier attempts failed here. Independent hue windows let the cyan pack's
    mask swallow half the bed, because the warm key raises green on the blue
    chips and drags them toward cyan. Nearest-chromaticity was worse still —
    normalising by max collapses the cookie's orange onto the yellow pack.
    Nearest-HUE with the chips themselves as a competing class fixes both: a blue
    chip is closer to 228 deg than to 184, so it can never be counted as a pack.
    """
    classes = list(C.ID_COLORS.items())
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    mx, mn = px.max(axis=-1), px.min(axis=-1)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6,
                 np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
    sat = np.where(mx <= 1e-6, 0.0, (mx - mn) / np.maximum(mx, 1e-6))
    valid = (sat > 0.42) & (mx > 0.14)
    best_d = np.full(px.shape[:2], 1e9, dtype=np.float32)
    best_i = np.full(px.shape[:2], -1, dtype=np.int32)
    for i, (_name, rgb) in enumerate(classes):
        dh = np.abs(((h - _hue_of(rgb) + 180.0) % 360.0) - 180.0)
        upd = dh < best_d
        best_d, best_i = np.where(upd, dh, best_d), np.where(upd, i, best_i)
    ok = valid & (best_d < 26.0)
    return {name: (best_i == i) & ok for i, (name, _rgb) in enumerate(classes)}


def _dominant_extent(counts, frac=0.12):
    """Bounds of the largest contiguous run of rows/columns that actually carry
    the subject. Percentile bounds still stretched the cyan pack across half the
    frame, because the blue chips it gets confused with are scattered everywhere
    rather than clustered in a tail."""
    thr = counts.max() * frac
    above = counts > thr
    best, cur = (0, -1), None
    for i, v in enumerate(above):
        if v and cur is None:
            cur = i
        elif not v and cur is not None:
            if i - cur > best[1] - best[0]:
                best = (cur, i - 1)
            cur = None
    if cur is not None and len(above) - cur > best[1] - best[0]:
        best = (cur, len(above) - 1)
    return best


def check_layout(path):
    """Measure the finished frame against the brief's apparent-size table.

    The geometry solver says the cookie is 15.3 % of frame width; this reads it
    back off actual pixels, so a mistake anywhere between the config and the
    render is caught rather than assumed away. It is what caught the cookie
    rolling sideways instead of tipping back."""
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, img.channels)[..., :3]
    bpy.data.images.remove(img)
    px = px[::-1]                                     # Blender rows are bottom-up
    masks = _classify(px)
    d, lens, _, _ = C.camera_state(C.F_END)
    ck = C.cookie_final()
    want = {"cookie": C.apparent(C.COOKIE_D, ck["distance"], lens)[0] * 100}
    for k in C.PACK_ORDER:
        want[k] = C.apparent(C.PACK_W, d, lens)[0] * 100
    log("")
    log("final-frame layout, measured off the render (brief: cookie 15%% w / 20%% h,"
        " pack 10%% / 21%%, row 50%%):")
    out, xs = {}, []
    for name in ["cookie"] + C.PACK_ORDER:
        m = masks.get(name)
        if m is None or m.sum() < 40:
            log("  %-11s NOT FOUND" % name)
            continue
        # Percentile bounds, not min/max: a few stray misclassified pixels at
        # opposite corners of the frame otherwise report a subject as 100% wide.
        c0, c1 = _dominant_extent(m.sum(axis=0))
        r0, r1 = _dominant_extent(m.sum(axis=1))
        pw, ph = (c1 - c0 + 1) / w * 100, (r1 - r0 + 1) / h * 100
        cx = (c0 + c1) / 2 / w * 100
        out[name] = (pw, ph, cx)
        if name != "cookie":
            xs += [c0, c1]
        log("  %-11s %5.1f%% w  %5.1f%% h   centre x %5.1f%%   (predicted %4.1f%% w,"
            " %d px)" % (name, pw, ph, cx, want[name], int(m.sum())))
    if xs:
        log("  %-11s %5.1f%% w" % ("pack row", (max(xs) - min(xs) + 1) / w * 100))
    return out


def check_clearance(cam):
    """The camera cranes out over the foreground ridge. Assert it never gets so
    close to the bed that chips clip through the near plane."""
    sc = bpy.context.scene
    worst, worst_f = 1e9, 0
    for f in range(C.F_ARC_END, C.F_END + 1):
        sc.frame_set(f)
        p = cam.matrix_world.translation
        clr = p.z - C.bed_height(p.x, p.y)
        if clr < worst:
            worst, worst_f = clr, f
    log("minimum camera clearance over the bed: %.0f mm at f%d (near clip %.0f mm)"
        % (worst * 1000, worst_f, C.CLIP_START * 1000))
    return worst > C.CLIP_START * 3


# ==========================================================================
# EXPORT
# ==========================================================================
def _render_to(path):
    sc = bpy.context.scene
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_checkpoints(cam, frames=None):
    sc = bpy.context.scene
    sc.camera = cam
    for f in (frames or C.CHECKPOINTS):
        t = time.time()
        sc.frame_set(f)
        p = os.path.join(OUT, "checks", "chk_%04d" % f)
        _render_to(p)
        hot, dead = check_exposure(p + ".png")
        flag = ""
        if hot > 0.004:
            flag += "  <-- CLIPPING"
        if dead > 0.010:
            flag += "  <-- CRUSHED/VOID"
        log("checkpoint f%-4d %5.1fs   clipped %.2f%%  black %.2f%%%s"
            % (f, time.time() - t, hot * 100, dead * 100, flag))


def render_topdown():
    """Worth two minutes: the only unambiguous read on pack row spacing and the
    forced-perspective offset. It is a diagram, and is excluded from the prompt's
    visual style."""
    sc = bpy.context.scene
    data = bpy.data.cameras.new("C_topdown")
    data.type = "ORTHO"
    data.ortho_scale = 2.05
    ob = bpy.data.objects.new("C_topdown", data)
    sc.collection.objects.link(ob)
    # centred on the composition (packs at bed centre, cookie out on the ridge),
    # not on bed centre — otherwise the cookie sits in the corner of the diagram
    ax, ay = C.final_axis()
    mid = C.RIDGE_X * 0.5
    ob.location = (ax * mid, ay * mid, 3.0)
    # Roll so the final view axis runs straight DOWN the frame: packs at the top,
    # cookie at the bottom. The whole point of this still is an unambiguous read
    # on row spacing and the forced-perspective offset, and it does not give one
    # with the axis lying across a diagonal.
    ob.rotation_euler = (0.0, 0.0,
                         math.radians(C.AZ0 + C.CAM_TRACK[-1][4] - 270.0))
    keep = sc.camera
    sc.camera = ob
    sc.frame_set(C.F_END)
    _render_to(os.path.join(OUT, "stills", "topdown_blocking"))
    sc.camera = keep


def export_stills(cam):
    """Copy from the checkpoints where the frame is already rendered. Every one
    of these frames is also a CHECKPOINT, and re-rendering four of them costs
    five minutes a pass on a software GL machine for identical pixels."""
    import shutil
    sc = bpy.context.scene
    sc.camera = cam
    os.makedirs(os.path.join(OUT, "stills"), exist_ok=True)
    for name, f in (("first_frame", C.F_START), ("last_frame", C.F_END),
                    ("beat_0144", C.F_PULL_END), ("beat_0204", C.F_ARC_END)):
        dst = os.path.join(OUT, "stills", name + ".png")
        src = os.path.join(OUT, "checks", "chk_%04d.png" % f)
        if os.path.exists(src):
            shutil.copyfile(src, dst)
            continue
        sc.frame_set(f)
        _render_to(os.path.join(OUT, "stills", name))


def _has_ffmpeg_writer(sc):
    """Ask by assigning, not by reading the enum.

    bpy.types.ImageFormatSettings.bl_rna lists FFMPEG whether or not the build
    can actually write it — the same class-vs-instance trap as the view transform
    enum, which introspects as ["NONE"] while "Standard" assigns fine. The only
    honest test is to try it. The pip `bpy` wheel ships no FFMPEG writer; official
    Blender builds do.
    """
    keep = sc.render.image_settings.file_format
    try:
        sc.render.image_settings.file_format = "FFMPEG"
        return True
    except TypeError:
        return False
    finally:
        sc.render.image_settings.file_format = keep


def render_clay(cam, draft=False, sequence=False):
    """Render the clay pass.

    Straight to H.264 in ONE pass by default. The previous version rendered a PNG
    sequence and then called render(animation=True) a SECOND time with the format
    switched to FFMPEG — which re-rendered all 288 frames to produce pixels that
    were already sitting on disk, for exactly double the wall time.

    --sequence writes PNGs instead, for when you want individual frames to grade
    or re-encode; encode those with encode_sequence() or any external ffmpeg.
    """
    sc = bpy.context.scene
    sc.camera = cam
    can_encode = _has_ffmpeg_writer(sc)
    if sequence or not can_encode:
        if not can_encode:
            log("this build has no FFMPEG writer — rendering a PNG sequence instead")
        os.makedirs(os.path.join(OUT, "frames"), exist_ok=True)
        sc.render.image_settings.file_format = "PNG"
        sc.render.filepath = os.path.join(OUT, "frames", "f_")
    else:
        sc.render.image_settings.file_format = "FFMPEG"
        ff = sc.render.ffmpeg
        ff.format = "MPEG4"
        ff.codec = "H264"
        ff.constant_rate_factor = "HIGH"
        ff.ffmpeg_preset = "GOOD"
        ff.gopsize = 12
        ff.audio_codec = "NONE"
        sc.render.filepath = os.path.join(OUT, C.CLAY_FILE[:-4])
    t = time.time()
    bpy.ops.render.render(animation=True)
    mins = (time.time() - t) / 60.0
    if sc.render.image_settings.file_format == "FFMPEG":
        # Blender appends the frame range to movie filenames (name0001-0288.mp4).
        _tidy_movie_name()
        out = os.path.join(OUT, C.CLAY_FILE)
        size = os.path.getsize(out) / 1e6 if os.path.exists(out) else 0.0
        log("clay pass: %s  %.1f MB  in %.1f min" % (C.CLAY_FILE, size, mins))
    else:
        n = len([f for f in os.listdir(os.path.join(OUT, "frames"))
                 if f.endswith(".png")])
        log("clay pass: %d PNG frames in %.1f min" % (n, mins))
        encode_sequence()


def _tidy_movie_name():
    """Blender names movie output <filepath><start>-<end>.<ext>. Rename it to the
    plain name the export package and prompt.txt both refer to."""
    stem = C.CLAY_FILE[:-4]
    for fn in os.listdir(OUT):
        if fn.startswith(stem) and fn.endswith(".mp4") and fn != C.CLAY_FILE:
            os.replace(os.path.join(OUT, fn), os.path.join(OUT, C.CLAY_FILE))
            return


def encode_sequence():
    """Encode the PNG sequence with an external ffmpeg, if one is on PATH.
    Settings straight from CLAUDE.md §9 — yuv420p needs even dimensions."""
    import shutil as _sh
    import subprocess
    frames = os.path.join(OUT, "frames")
    out = os.path.join(OUT, C.CLAY_FILE)
    png = sorted(f for f in os.listdir(frames) if f.endswith(".png"))
    if not png:
        log("no frames to encode")
        return
    # -start_number matters: the demuxer looks for index 0 by default and gives
    # up after a few misses, so a range render starting at f_0200 finds nothing.
    start = int(png[0][2:-4])
    cmd = ["ffmpeg", "-y", "-framerate", str(C.FPS),
           "-start_number", str(start), "-i", os.path.join(frames, "f_%04d.png"),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
           "-movflags", "+faststart", out]
    if not _sh.which("ffmpeg"):
        log("no ffmpeg on PATH. Encode the sequence with:")
        log("  " + " ".join(cmd))
        return
    t = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        log("ffmpeg failed:\n%s" % r.stderr[-600:])
        return
    log("encoded %s in %.1f s" % (C.CLAY_FILE, time.time() - t))


def _encode_via_vse(frames, png):
    """Encode existing stills with Blender's own sequencer. No re-render, and no
    external ffmpeg binary — which matters on macOS, where Blender ships FFmpeg
    but the CLI is not installed by default."""
    sc = bpy.data.scenes.new("encode_%s" % C.SHOT_ID)
    im = bpy.data.images.load(os.path.join(frames, png[0]))
    sc.render.resolution_x, sc.render.resolution_y = im.size
    bpy.data.images.remove(im)
    sc.render.fps, sc.render.fps_base = C.FPS, 1.0
    sc.frame_start, sc.frame_end = 1, len(png)
    sc.render.image_settings.file_format = "FFMPEG"
    ff = sc.render.ffmpeg
    ff.format, ff.codec = "MPEG4", "H264"
    ff.constant_rate_factor, ff.ffmpeg_preset = "HIGH", "GOOD"
    ff.gopsize, ff.audio_codec = 12, "NONE"
    sc.render.filepath = os.path.join(OUT, C.CLAY_FILE[:-4])
    se = sc.sequence_editor_create()
    # 5.x renamed SequenceEditor.sequences to .strips
    coll = getattr(se, "strips", None) or se.sequences
    strip = coll.new_image("clay", os.path.join(frames, png[0]), 1, 1)
    for f in png[1:]:
        strip.elements.append(f)
    bpy.ops.render.render(animation=True, scene=sc.name)
    _tidy_movie_name()


def encode_existing():
    """Stitch an already-rendered PNG sequence into the clip.

    Rendering 288 frames and then finding no encoder is a bad place to end up,
    and re-rendering to fix it is worse: the frames are the expensive part and
    they are already on disk."""
    frames = os.path.join(OUT, "frames")
    png = sorted(f for f in os.listdir(frames)
                 if f.endswith(".png")) if os.path.isdir(frames) else []
    if not png:
        log("no frames in %s — render first with --animation --sequence" % frames)
        return
    if _has_ffmpeg_writer(bpy.context.scene):
        log("encoding %d frames with Blender's own FFMPEG writer" % len(png))
        _encode_via_vse(frames, png)
    else:
        log("this build has no FFMPEG writer; trying an external ffmpeg")
        encode_sequence()
    probe_clip()


def probe_clip():
    """Read the finished clip back and report what an uploader will see. The
    spec limits are real: 300-6000 px, aspect 0.4-2.5, under 200 MB, 24 fps."""
    path = os.path.join(OUT, C.CLAY_FILE)
    if not os.path.exists(path):
        return
    size = os.path.getsize(path) / 1e6
    clip = bpy.data.movieclips.load(path)
    w, h = clip.size
    frames, fps = clip.frame_duration, clip.fps
    bpy.data.movieclips.remove(clip)
    log("clip: %dx%d  aspect %.3f  %d frames @ %.0f fps  %.1f s  %.1f MB"
        % (w, h, w / h, frames, fps, frames / max(fps, 1), size))
    for ok, msg in (
        (w % 2 == 0 and h % 2 == 0, "dimensions must be even for yuv420p"),
        (300 <= min(w, h) and max(w, h) <= 6000, "dimensions outside 300-6000 px"),
        (0.4 <= w / h <= 2.5, "aspect outside 0.4-2.5"),
        (size < 200, "over the 200 MB ceiling"),
        (abs(fps - C.FPS) < 0.5, "frame rate is not %d" % C.FPS),
    ):
        if not ok:
            log("  WARNING: %s" % msg)


def write_prompt():
    """Emitted from CONFIG, not hand-written, so the prompt and the render cannot
    drift apart (CLAUDE.md §10, §12)."""
    def s(f):
        return (f - 1) / C.FPS
    packs = C.pack_positions()
    roles = [
        "@Video 1 is a clay blockout. Inherit only camera movement, shot-size",
        "transitions, subject trajectories, blocking, timing, occlusion order, and",
        "the direction of the light.",
        "The blue chips become semi-sweet chocolate chips as defined by %s."
        % C.image_ref("chips"),
        "The orange disc becomes the hero cookie defined by %s — one thin,"
        % C.image_ref("cookie"),
        "crisp, densely studded classic chocolate chip cookie, not a thick soft-baked one.",
    ]
    for i, spec in enumerate(packs):
        k = spec["key"]
        colour = {"pack_chip": "green", "pack_soft": "magenta",
                  "pack_pb": "yellow", "pack_rev": "cyan"}[k]
        pos = ["leftmost", "second from left", "third from left", "rightmost"][i]
        roles.append("The %s form, %s in the row, becomes %s as defined by %s."
                     % (colour, pos, C.PACK_NAMES[k], C.image_ref(k)))
    roles += [
        "%s defines chocolate colour, sheen and surface character." % C.image_ref("chips"),
        "%s defines the cookie's proportions, crumb, and chip distribution."
        % C.image_ref("cookie"),
        "%s defines lighting mood and contrast only." % C.image_ref("lighting"),
    ]
    d, lens, _e, _a = C.camera_state(C.F_END)
    txt = f"""MODE: {C.GENERATION_MODE}
MATERIALS: @Video 1 clay blockout · {C.image_ref("chips")} chips · {C.image_ref("cookie")} cookie · {C.image_ref("pack_chip")}-{C.image_ref("pack_rev").split()[1]} packs · {C.image_ref("lighting")} lighting
SETTINGS: Match @Video 1 duration and camera route · 4:3 · 720p · {C.FPS}fps · {C.DURATION_S:.0f}s

[Reference roles]
""" + "\n".join(roles) + f"""

[Creative direction]
A single continuous macro-to-wide move through a landscape made entirely of
chocolate chips, in which one hero cookie settles into the chips and the range
rises behind it — warm, high-end food commercial photography, one raking key
light, shot on a full-frame {lens:.0f}mm at the wide end.

[Timeline]
{s(C.F_START):.0f}-{s(C.F_ORBIT_END):.1f}s: Buried inside the bed of chocolate chips, three or four chips
  filling the whole frame. The camera orbits slowly to the right around one hero
  chip, ending on it in three-quarter profile. No horizon, no background.
{s(C.F_ORBIT_END):.1f}-{s(C.F_PULL_END):.1f}s: The camera pulls back and lifts. The wall of chips resolves into
  a landscape of chips stretching to the horizon. It comes to rest on an empty
  round depression in the chips, centred in frame.
{s(C.F_PULL_END):.1f}-{s(C.F_ARC_END):.1f}s: One cookie descends into the depression in slow motion, slower
  than gravity, and settles. A low ring of chips is pushed outward around it. The
  camera arcs right and rises.
{s(C.F_ARC_END):.1f}-{s(C.F_END):.0f}s: The camera cranes back and up. The cookie glides forward onto the
  near ridge of chips and tilts up to lean face-on to the lens, filling the
  foreground. Four packs rise out of the chips into a shallow row behind it. The
  final frame locks and holds still.

[Global]
Exactly one cookie and exactly four packs throughout — no more, no fewer.
Continuous lighting from one direction for the entire clip. No cuts other than
those in @Video 1. Photoreal, warm, appetising, high-end food commercial finish.
The cookie is the largest object in the final frame; it is far closer to the lens
than the packs, which is why it reads larger despite being much smaller.
Deep focus — everything sharp.

[Exclusions]
No text, no captions, no subtitles, no on-screen type, no logos, no wordmarks, no
printed pack graphics, no watermarks, no background music. No hands, no people,
no extra cookies, no fifth pack. Do not inherit primitive geometry, flat grey
materials, blue plastic cones, placeholder shapes, axes, guide lines, path
curves, camera frustums, or the empty set from @Video 1. Use it only for camera
movement, blocking, motion paths, timing, occlusion order, and light direction.
"""
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "prompt.txt"), "w") as fh:
        fh.write(txt)
    log("wrote prompt.txt")


def write_readme(draft=False):
    res = C.RES_DRAFT if draft else C.RES_FINAL
    ck = C.cookie_final()
    d, lens, _e, _a = C.camera_state(C.F_END)
    lines = [
        "Shot %s - \"%s\"   %s" % (C.SHOT_ID, C.SHOT_NAME, C.PRODUCT),
        "=" * 72, "",
        "Clay control pass for Seedance 2.5. Lane A only: this clip carries camera",
        "path, blocking, timing, occlusion order and light direction. It carries no",
        "brand colour, no material and no type - those are Lane B stills and post.",
        "",
        "DELIVERY   %dx%d - 4:3 - %d fps - %d frames - %.1f s - last %d frames locked"
        % (res[0], res[1], C.FPS, C.F_END, C.DURATION_S, C.HOLD_FRAMES),
        "SURFACE    %s" % C.SURFACE,
        "MODE       %s" % C.GENERATION_MODE,
        "", "UPLOAD ORDER - most surfaces index by upload order, not filename.", "",
        "  @Video 1   %s" % C.CLAY_FILE,
    ]
    for i, (fn, _k, desc) in enumerate(C.LOOK_FILES):
        lines.append("  @Image %-2d  %-26s %s" % (i + 1, fn, desc))
    lines += [
        "", "SUBJECT MAPPING - linear base colour, not sRGB hex.", "",
    ]
    labels = dict(C.PACK_NAMES, chips="semi-sweet chocolate chips",
                  cookie="hero cookie, classic Decadent")
    for k, rgb in C.ID_COLORS.items():
        label = labels[k]
        lines.append("  %-10s %-22s -> %-9s %s"
                     % (k, "(%.2f, %.2f, %.2f)" % rgb[:3], C.image_ref(k), label))
    lines += [
        "", "CAMERA", "",
        "  %d mm full frame, sensor_fit %s, DOF off, motion blur off"
        % (C.SENSOR_WIDTH, C.SENSOR_FIT),
        "  near clip %.0f mm - the default 100 mm would cut into the macro opening"
        % (C.CLIP_START * 1000),
        "",
        "   frame     dist     lens    elev     azim    frame w    frame h",
    ]
    for f, *_ in C.CAM_TRACK:
        dd, ll, ee, aa = C.camera_state(f)
        fw = C.frame_width(dd, ll)
        lines.append("  %6d %8.3f %8.1f %7.1f %8.1f %8.0f mm %8.0f mm"
                     % (f, dd, ll, ee, aa, fw * 1000, fw / C.ASPECT * 1000))
    lines += [
        "", "FINAL FRAME - forced perspective is doing the work. The cookie is a",
        "quarter the height of a pack and still reads as the largest object,",
        "because it sits three times closer to the lens.", "",
        "  cookie   %.0f mm from lens, leaning %.0f deg   %.1f%% frame width"
        % (ck["distance"] * 1000, ck["tilt_deg"],
           C.apparent(C.COOKIE_D, ck["distance"], lens)[0] * 100),
        "  packs    %.2f m from lens, %d mm apart      %.1f%% each, row %.1f%%"
        % (d, C.PACK_PITCH * 1000, C.apparent(C.PACK_W, d, lens)[0] * 100,
           C.apparent(C.PACK_ROW_W, d, lens)[0] * 100),
        "  order    left to right: %s" % ", ".join(C.PACK_ORDER),
        "  the cookie sits in front of the GAP between packs 2 and 3, never in",
        "  front of a pack, which removes the occlusion ambiguity entirely.",
        "", "COMPOSITE AFTER GENERATION - nothing with readable type goes through",
        "the generator. It garbles type reliably, and it is a registered mark.", "",
    ]
    for item in ["four pack fronts (exact artwork)", "PC wordmark",
                 "The Decadent logotype", "300 g", "legal line", "superscripts",
                 "end card", "music and sound design"]:
        lines.append("  - %s" % item)
    lines += [
        "", "REBUILD", "",
        "  python3 build.py --checkpoints        # stills, layout + exposure checks",
        "  python3 build.py --draft --animation  # %dx%d clip" % C.RES_DRAFT,
        "  python3 build.py --animation          # %dx%d clip" % C.RES_FINAL,
        "",
        "  Built with Blender %s. On a machine with no GPU, prefix with:"
        % bpy.app.version_string,
        "  LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless GALLIUM_DRIVER=llvmpipe",
        "",
    ]
    with open(os.path.join(OUT, "README.txt"), "w") as fh:
        fh.write("\n".join(lines) + "\n")
    log("wrote README.txt")


def write_metadata(draft=False):
    res = C.RES_DRAFT if draft else C.RES_FINAL
    track = []
    for f, *_ in C.CAM_TRACK:
        d, lens, e, az = C.camera_state(f)
        fw = C.frame_width(d, lens)
        track.append({"frame": f, "distance_m": round(d, 4), "lens_mm": lens,
                      "elevation_deg": e, "azimuth_deg": round(az, 2),
                      "frame_width_mm": round(fw * 1000, 1),
                      "frame_height_mm": round(fw / C.ASPECT * 1000, 1)})
    ck = C.cookie_final()
    d, lens, _, _ = C.camera_state(C.F_END)
    meta = {
        "shot": C.SHOT_ID, "name": C.SHOT_NAME, "product": C.PRODUCT,
        "surface": C.SURFACE, "mode": C.GENERATION_MODE,
        "delivery": {"resolution": list(res), "aspect": "4:3", "fps": C.FPS,
                     "frames": C.F_END, "seconds": C.DURATION_S,
                     "locked_tail_frames": C.HOLD_FRAMES},
        "camera": {"sensor_mm": C.SENSOR_WIDTH, "sensor_fit": C.SENSOR_FIT,
                   "clip_start_m": C.CLIP_START, "dof": C.USE_DOF, "track": track},
        "beats": {"orbit_end": C.F_ORBIT_END, "pull_end": C.F_PULL_END,
                  "cookie_touch": C.F_COOKIE_TOUCH, "arc_end": C.F_ARC_END,
                  "lock": C.F_LOCK, "end": C.F_END},
        "id_colors_linear": {k: list(v) for k, v in C.ID_COLORS.items()},
        "clay_neutral_linear": list(C.CLAY_NEUTRAL),
        "roughness": C.CLAY_ROUGHNESS, "metallic": C.CLAY_METALLIC,
        "final_frame": {
            "cookie_distance_mm": round(ck["distance"] * 1000, 1),
            "cookie_lean_deg": round(ck["tilt_deg"], 1),
            "cookie_pct_frame_w": round(C.apparent(C.COOKIE_D, ck["distance"], lens)[0] * 100, 1),
            "cookie_pct_frame_h": round(C.apparent(C.COOKIE_D, ck["distance"], lens)[1] * 100, 1),
            "pack_pct_frame_w": round(C.apparent(C.PACK_W, d, lens)[0] * 100, 1),
            "pack_pct_frame_h": round(C.apparent(C.PACK_H, d, lens)[1] * 100, 1),
            "pack_row_pct_frame_w": round(C.apparent(C.PACK_ROW_W, d, lens)[0] * 100, 1),
            "pack_order_left_to_right": C.PACK_ORDER,
        },
        "speed_budget_ms": {k: v[2] for k, v in C.SPEED_BUDGET.items()},
        "composite_after_generation": [
            "four pack fronts (exact artwork)", "PC wordmark", "The Decadent logotype",
            "300 g", "legal line", "superscripts", "end card", "music"],
        "blender": bpy.app.version_string,
        "upload_order": ([{"ref": "@Video 1", "file": C.CLAY_FILE}]
                         + [{"ref": "@Image %d" % (i + 1), "file": fn,
                             "subject": k, "describes": desc}
                            for i, (fn, k, desc) in enumerate(C.LOOK_FILES)]),
    }
    with open(os.path.join(OUT, "metadata.json"), "w") as fh:
        json.dump(meta, fh, indent=2)
    log("wrote metadata.json")


# ==========================================================================
# MAIN
# ==========================================================================
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
DRAFT = "--draft" in argv


def main():
    t0 = time.time()
    os.makedirs(OUT, exist_ok=True)

    if "--encode-only" in argv:      # frames already exist; skip the whole build
        encode_existing()
        return

    clear_scene()
    setup_render_settings(draft=DRAFT)
    mats = setup_clay_materials()
    setup_lighting()
    cam = setup_cameras()
    cookie, packs, ring = build_shot_1a(mats)
    log("built in %.1fs" % (time.time() - t0))

    speeds_ok = report_speeds(cam, [cookie] + packs, group=ring)
    clear_ok = check_clearance(cam)
    if not speeds_ok:
        log("NOTE: a move is over its budget — see the speed table above")
    if not clear_ok:
        log("WARNING: camera passes too close to the bed; raise the crane or lower RIDGE_H")

    write_prompt()
    write_metadata(draft=DRAFT)
    write_readme(draft=DRAFT)

    if "--range" in argv:
        lo, hi = (int(v) for v in argv[argv.index("--range") + 1].split(","))
        bpy.context.scene.frame_start, bpy.context.scene.frame_end = lo, hi
        log("frame range clamped to %d-%d" % (lo, hi))

    if "--no-render" in argv:
        log("built, no render requested")
        return
    if "--frames" in argv:
        picked = [int(x) for x in argv[argv.index("--frames") + 1].split(",")]
        render_checkpoints(cam, picked)
        if C.F_END in picked:
            check_layout(os.path.join(OUT, "checks", "chk_%04d.png" % C.F_END))
    if "--topdown" in argv:
        render_topdown()
    if "--checkpoints" in argv:
        render_checkpoints(cam)
        check_layout(os.path.join(OUT, "checks", "chk_%04d.png" % C.F_END))
        render_topdown()
        export_stills(cam)
    if "--animation" in argv:
        render_clay(cam, draft=DRAFT, sequence="--sequence" in argv)
        probe_clip()
    log("done in %.1f min" % ((time.time() - t0) / 60.0))


main()
