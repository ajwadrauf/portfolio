"""Shot 1A — "The Wall" · PC The Decadent · 12 s · 4:3

Single source of truth for the shot. build.py reads every number from here and
write_prompt() emits prompt.txt from these same constants, so the clay render
and the Seedance prompt cannot drift apart (see CLAUDE.md §12).

Deliberately free of `import bpy`: nothing here needs Blender, so the whole shot
geometry can be printed, diffed and sanity-checked without launching it.
`python3 config.py` prints the geometry report.

1 Blender unit = 1 metre throughout.
"""

import math

import numpy as np

# --------------------------------------------------------------------------
# DELIVERY
# --------------------------------------------------------------------------
SHOT_ID = "1A"
SHOT_NAME = "The Wall"
PRODUCT = "PC The Decadent Chocolate Chip (classic)"
SURFACE = "<Dreamina UI / ModelArk API / reseller — confirm before upload>"
GENERATION_MODE = "Clay Renderer / Omni Reference"

FPS = 24
RES_FINAL = (960, 720)
RES_DRAFT = (640, 480)
ASPECT = RES_FINAL[0] / RES_FINAL[1]          # 1.3333 — every layout number below assumes this

# --------------------------------------------------------------------------
# BEATS — frame numbers live here and are never inlined anywhere else
# --------------------------------------------------------------------------
F_START = 1
F_ORBIT_END = 72          # end of the macro orbit; hero chip in three-quarter profile
F_PULL_END = 144          # bed has resolved as landscape; empty depression centred
F_COOKIE_IN = 144         # cookie enters
F_COOKIE_TOUCH = 164      # cookie contacts the depression floor
F_COOKIE_SETTLED = 186    # rocking damped out, chips finished spreading
F_ARC_END = 204           # end of the arc-and-rise; packs appear
F_LOCK = 276              # every animated thing is static from here
F_END = 288               # 288 frames @ 24 fps = 12.0 s

FRAME_RANGE = (F_START, F_END)
DURATION_S = (F_END - F_START + 1) / FPS
HOLD_FRAMES = F_END - F_LOCK          # the brief asks for a 12-frame locked tail

CHECKPOINTS = [1, 36, 72, 108, 144, 164, 204, 246, 288]

# --------------------------------------------------------------------------
# CAMERA — one continuous crane. Orbit, then pull back, then arc and rise.
# --------------------------------------------------------------------------
SENSOR_WIDTH = 36.0       # mm, full frame
SENSOR_FIT = "HORIZONTAL"
CLIP_START = 0.002        # 2 mm. The default 100 mm clip would eat the macro opening.
CLIP_END = 50.0

# (frame, distance_m_to_AIM, lens_mm, elevation_deg, azimuth_offset_deg)
#
# Distance is measured to the aim point, not to bed centre. The brief gives it as
# "camera to bed centre", but its own timeline orbits the HERO CHIP for the first
# 72 frames and then centres the DEPRESSION at f144 — two different points 55 mm
# apart. Measuring to the aim point reproduces every frame-width number in the
# brief exactly (36 / 36 / 162 / 305 / 1240 mm), which is what actually governs
# what the lens sees; from f144 on the aim IS bed centre, so the two readings
# agree everywhere the brief's layout table depends on them.
#
# Azimuth is relative to AZ0; "orbit right" is a positive offset.
CAM_TRACK = [
    (F_START,     0.10, 100.0,  2.0,   0.0),
    (F_ORBIT_END, 0.10, 100.0,  2.0,  40.0),   # orbit only, no dolly
    (F_PULL_END,  0.45, 100.0, 12.0,  40.0),   # pull back and lift, azimuth held
    (F_ARC_END,   0.72,  85.0, 22.0,  95.0),   # arc right 55 deg and rise
    (F_LOCK,      1.55,  45.0, 22.0,  95.0),   # crane out; settles here
    (F_END,       1.55,  45.0, 22.0,  95.0),   # ...and holds locked to the last frame
]

AZ0 = 205.0               # world azimuth of the camera at frame 1, degrees

# The brief asks for "no horizon, frame completely filled" at f1. The camera sits
# at chip-top level, and from there a level lens always sees a horizon: the top
# of the frame points at the sky. So the lens is tilted DOWN during the macro
# phase — the camera POSITION still follows the briefed 2 deg elevation track
# exactly, it is only the look target that drops. Eased out to zero by F_PULL_END,
# where the shot does want a horizon.
MACRO_TILT_DOWN_DEG = 3.0

# --------------------------------------------------------------------------
# REAL-WORLD SCALE  (metres)
# --------------------------------------------------------------------------
CHIP_D = 0.009            # 9 mm base diameter
CHIP_H = 0.007            # 7 mm tall
COOKIE_D = 0.055          # 55 mm across
COOKIE_T = 0.008          # 8 mm thick — the classic is thin and crisp, NOT soft-baked
COOKIE_CHIPS = 12         # small chips proud of the top surface (brief: 10-14)

PACK_W = 0.130            # 300 g gusseted stand-up bag
PACK_H = 0.200
PACK_D = 0.065
PACK_BURY = 1.40          # x PACK_H below its own ground at the start of the rise.
                          # 1.05 left the fin seal only 10 mm under a surface that
                          # undulates +/-4 mm, and both inner packs broke through
                          # the chips at f204.
PACK_PITCH = 0.165        # centre-to-centre
PACK_COUNT = 4
PACK_ROW_W = PACK_PITCH * (PACK_COUNT - 1) + PACK_W    # 0.625 m outer silhouette

BED_REAL_HALF = 1.25      # real chip instances fill a 2.5 m square
BED_PLANE_HALF = 5.5      # displaced continuation plane, 11 m square
BED_PLANE_DIV = 1100      # 10 mm cells. At 520 the chip-scale relief landed on the
                          # grid's Nyquist limit and aliased away to a smooth floor,
                          # which is what made the bed edge visible at f288.
# ^ the brief says 8 m. At f288 the top of frame lands 6.26 m from a camera that
#   is 1.44 m out from centre, so the bed has to reach 4.83 m past centre plus
#   2.5 m of lateral spread. 8 m square (4 m half) is 0.9 m short of the top
#   frame edge and the void would show. 11 m square clears it with margin.
CYC_RADIUS = 14.0         # grey backdrop beyond that

HERO_R = 0.072            # hero chip, just outside the depression rim
HERO_AZ_OFFSET = 0.0      # placed between the frame-1 camera and bed centre
AIM_THIRD = 1.0 / 6.0     # lateral aim offset, as a fraction of frame width,
                          # so the hero chip lands on a third rather than dead centre

# The macro camera orbits at 0.10 m inside the bed. The brief asks for a 36 mm
# frame with 3-4 chips across it, but a chip 20 mm from the lens covers the whole
# frame by itself, so the lens needs clear space in front of it.
#
# Deleting the chips there was the obvious fix and the wrong one: it left a bald
# crescent that was invisible at f1 and glaring at f144, when the camera has
# pulled back far enough to see the whole area. Instead the BED dips along the
# orbit — a shallow trench the camera runs in. The chips follow the surface as
# usual, so the channel stays chip-covered from every later angle, and the ones
# on its inner lip still cross the near foreground the way the brief asks.
MACRO_SCOOP_D = 0.016
MACRO_SCOOP_SIGMA = 0.050   # narrow, so it does not compete with the depression

# Wide and shallow, not narrow and deep. What makes the hollow read at f144 is
# its DIAMETER against a 162 mm frame, not its depth — and depth costs dearly at
# f164, where the camera is only ~14 deg up: a 15 mm hollow with a 13 mm banked
# rim hid the landed cookie behind its own near edge almost entirely.
DEPRESSION_R = 0.042      # 84 mm across — half the f144 frame width
DEPRESSION_DEPTH = 0.009
DEPRESSION_RIM = 0.016    # width of the banked rim of chips around it
DEPRESSION_BANK = 0.60    # rim height as a fraction of depth

# --------------------------------------------------------------------------
# TERRAIN — the bed is a landscape, not a plane.
#
# The foreground ridge is load-bearing, not decoration. See GEOMETRY NOTE at
# the bottom of this file: without it the final frame in the brief cannot be
# built at all.
# --------------------------------------------------------------------------
RIDGE_X = 1.055           # crest distance from bed centre, toward the final camera
RIDGE_H = 0.319           # crest height — SOLVED at import from COOKIE_TARGET_DIST
COOKIE_TARGET_DIST = 0.45 # the brief's figure. RIDGE_H is derived from it rather
                          # than typed, so the published apparent sizes stay exact
                          # when anything else about the terrain changes.
RIDGE_SIGMA = 0.30        # gaussian half-width of the swell
SWELL_H = 0.010           # low-frequency undulation elsewhere on the bed
SWELL_SCALE = 0.42

# Mid-scale relief: shallow mounds a few centimetres high, roughly 120-200 mm
# apart. This is what actually kills the horizon at f1 — a camera sitting at
# chip-top level on a FLAT bed always sees sky at the top of frame, however far
# the lens is tilted down, and tilting far enough to hide it turns the macro
# opening into a top-down shot of chip lids instead of the briefed three-quarter
# profile. Mounds put chips in the background instead, which is what "inside the
# chip background" means.
#
# Masked out inside MESO_CLEAR_R so it cannot tilt the pack row or fill in the
# depression; the composition inside that radius stays exactly as designed.
MESO_H = 0.034
MESO_CLEAR_R = 0.30
MESO_RAMP = 0.14
MESO_CELL = 0.22          # mound spacing

# Value noise rather than sin(x)*cos(y). From the hero angles a sine grid passes
# as gentle relief, but it is an unmistakable regular lattice seen from directly
# above and it corrugates the far field at f288.
_MESO_HALF = 6.0
_MESO_N = int(2 * _MESO_HALF / MESO_CELL) + 2
_MESO_GRID = np.random.default_rng(4711).random((_MESO_N + 1, _MESO_N + 1)) * 2.0 - 1.0


def _meso_noise(x, y):
    u = np.clip((x + _MESO_HALF) / MESO_CELL, 0, _MESO_N - 1e-6)
    v = np.clip((y + _MESO_HALF) / MESO_CELL, 0, _MESO_N - 1e-6)
    i0, j0 = u.astype(np.int32), v.astype(np.int32)
    fu, fv = u - i0, v - j0
    fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
    g = _MESO_GRID
    return (g[i0, j0] * (1 - fu) * (1 - fv) + g[i0 + 1, j0] * fu * (1 - fv)
            + g[i0, j0 + 1] * (1 - fu) * fv + g[i0 + 1, j0 + 1] * fu * fv)

# A berm directly behind the hero chip, across the whole 40 deg orbit.
#
# The macro tilt plus the mid-scale mounds cleared the horizon at f1 but not at
# f36 and f72 — by then the camera has swung round to an azimuth whose background
# happens to be flat, and a band of grey cyc opens along the top of frame. Mounds
# masked out inside MESO_CLEAR_R cannot help there, because that is exactly the
# radius the orbit lives in. This is one deliberate rise placed where the lens
# looks for the whole of the first three seconds.
BERM_R = 0.26
BERM_H = 0.052
BERM_SIGMA = 0.150

# --------------------------------------------------------------------------
# ID COLOUR MAP — linear base colour, straight onto Principled Base Color.
# NOT sRGB hex.  Every entry here is a subject the prompt maps to a reference.
# --------------------------------------------------------------------------
CLAY_NEUTRAL = (0.18, 0.18, 0.18, 1.0)     # bed continuation, cyc, everything unmapped

ID_COLORS = {
    "chips":     (0.05, 0.20, 0.80, 1.0),   # blue    MAPPED -> semi-sweet chocolate chips
    "cookie":    (0.90, 0.35, 0.02, 1.0),   # orange  MAPPED -> hero cookie, classic Decadent
    "pack_chip": (0.10, 0.60, 0.15, 1.0),   # green   MAPPED -> The Decadent Chocolate Chip
    "pack_soft": (0.75, 0.05, 0.55, 1.0),   # magenta MAPPED -> The Decadent Soft Baked
    "pack_pb":   (0.95, 0.80, 0.05, 1.0),   # yellow  MAPPED -> The Decadent Peanut Butter Chunk
    "pack_rev":  (0.05, 0.70, 0.75, 1.0),   # cyan    MAPPED -> The Reverse Decadent
}
CLAY_ROUGHNESS = 0.55
CLAY_METALLIC = 0.0

# Left-to-right in the final frame. Colour AND position are both stated in the
# prompt so they reinforce each other — position wording alone gets ignored.
PACK_ORDER = ["pack_chip", "pack_soft", "pack_pb", "pack_rev"]
PACK_NAMES = {
    "pack_chip": "The Decadent Chocolate Chip",
    "pack_soft": "The Decadent Soft Baked",
    "pack_pb":   "The Decadent Peanut Butter Chunk",
    "pack_rev":  "The Reverse Decadent",
}
# Export package, in upload order. Most surfaces index references by UPLOAD
# ORDER, not filename, so @Image n is derived from this list rather than typed —
# the clip is file 01 and is @Video 1, which makes 08_look_lighting.png @Image 7,
# not @Image 8. Getting that off by one silently rebinds every reference role.
CLAY_FILE = "01_clay_%s.mp4" % SHOT_ID
CLAY_SOURCE = ("https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/"
               "01_clay_1A.mp4")

# (filename, subject key, what it defines, source asset)
#
# The PC logo is deliberately absent. It is a registered mark, generative video
# garbles type reliably and differently on every frame, and the whole post plan
# depends on compositing artwork over the plate from the identical camera.
# Uploading it invites the model to reproduce an approximation of it.
_BLOB = "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/PC-Decadent-Example/"
LOOK_FILES = [
    # Both crops come out of the classic pack front, which is one enlarged hero
    # cookie sitting on a full bleed of semi-sweet chips — the two references
    # this shot needs most, in the definitive photograph of the product.
    #
    # It must be the CLASSIC. Every SKU has a different background: Soft Baked is
    # dark chocolate, Reverse Decadent is white, Peanut Butter is a peanut butter
    # swirl with no chips at all. Crop from any of those and the bed is the wrong
    # chocolate for all 31,430 chips.
    ("02_look_chips.png",        "chips",     "macro semi-sweet chips",
     _BLOB + "the-decadent.png  [CROP: background only, no cookie, no type]"),
    ("03_look_cookie.png",       "cookie",    "classic Decadent hero cookie",
     _BLOB + "the-decadent.png  [CROP: the cookie only, no pack edge, no type]"),
    ("04_look_pack_chip.png",    "pack_chip", "The Decadent Chocolate Chip",
     _BLOB + "the-decadent.png"),
    ("05_look_pack_soft.png",    "pack_soft", "The Decadent Soft Baked",
     _BLOB + "soft-baked.png"),
    ("06_look_pack_pb.png",      "pack_pb",   "The Decadent Peanut Butter Chunk",
     _BLOB + "peanut-butter.png"),
    ("07_look_pack_reverse.png", "pack_rev",  "The Reverse Decadent",
     _BLOB + "reverse-decadent.png"),
    ("08_look_pack_side.png",    "pack_side", "gusset depth and fin seal — SHAPE ONLY",
     _BLOB + "side-view-package.png"),
]

# Assets that must NOT be uploaded as generation references.
COMPOSITE_ONLY = [
    (_BLOB + "pc_logo_red-pc_rgb_rev_en.png",
     "PC wordmark — registered mark, composited over the plate after generation"),
    (_BLOB + "example-cookies.jpg",
     "three thick soft-baked-style cookies — WRONG SKU and the wrong count; it "
     "fights both the 8 mm thin proxy and the one-cookie constraint"),
]


def image_ref(key):
    """@Image n for a subject, derived from upload order."""
    for i, (_f, k, _d, _s) in enumerate(LOOK_FILES):
        if k == key:
            return "@Image %d" % (i + 1)
    raise KeyError(key)

# --------------------------------------------------------------------------
# LIGHTING
#
# The key is fixed in WORLD space, not carried on the camera. The camera turns
# 95 deg across the shot; a camera-parented key would swing the shadows through
# 95 deg with it, which reads as a moving light source and breaks the "one clear
# light direction, consistent across the shot" check in CLAUDE.md §8.
#
# It is anchored 40 deg camera-left of the FINAL camera azimuth, because the
# final frame is the pack shot. At frame 1 that same fixed light sits 55 deg off
# the camera axis on the other side — still a raking side key, which is what the
# macro opening needs for chip specular. Both ends of the shot work.
# --------------------------------------------------------------------------
KEY_OFFSET_DEG = 40.0
KEY_ELEV_DEG = 35.0
KEY_DISTANCE = 2.6
KEY_SIZE = 1.9
KEY_POWER = 62.0
KEY_COLOR = (1.0, 0.93, 0.84)      # warm

FILL_OFFSET_DEG = -55.0
FILL_ELEV_DEG = 18.0
FILL_DISTANCE = 3.0
FILL_SIZE = 3.0
FILL_POWER = 15.0                  # ~1/4 key
FILL_COLOR = (0.86, 0.90, 1.0)

# --------------------------------------------------------------------------
# RENDER
# --------------------------------------------------------------------------
ENGINE = "BLENDER_EEVEE"           # probed: the only identifier this build offers
TAA_SAMPLES = 16
VIEW_TRANSFORM = "Standard"        # never AgX — it crushes the ID colour separation
VIEW_LOOK = "None"
EXPOSURE = 0.0
FILM_TRANSPARENT = False
USE_MOTION_BLUR = False
USE_DOF = False

# Chip scatter density by zone: (outer_radius_m, poisson_min_distance_m).
# Density falls off outward because past ~1.4 m a chip is under 4 px even in the
# widest frame; the displaced continuation plane carries the read from there.
SCATTER_ZONES_FINAL = [(0.35, 0.0116), (0.80, 0.0132), (BED_REAL_HALF, 0.0158)]
# The zones above are radii from bed centre, but at f288 the closest thing to the
# lens is the ridge crest at RIDGE_X — which falls in the OUTERMOST, sparsest
# zone, so the near foreground came back as scattered chips on a smooth floor.
# This patch re-scatters that area at near-macro density.
RIDGE_PATCH_R = 0.44
RIDGE_PATCH_SPACING = 0.0106
SCATTER_ZONES_DRAFT = [(0.35, 0.0125), (0.80, 0.0165), (BED_REAL_HALF, 0.0230)]

CHIP_TILT_MAX_DEG = 34.0
CHIP_SCALE_RANGE = (0.80, 1.26)   # real chips are not uniform; a uniform bed reads as a texture
CHIP_SINK = 0.0008                # how far the base is buried. Too deep and every chip reads as a dome.
SPREAD_RING_R = 0.078              # chips inside this get pushed out by the landing
SPREAD_MAX = 0.020                 # how far the outermost of them travels

# --------------------------------------------------------------------------
# SPEED BUDGET — the brief's table, in m/s. report_speeds() checks against it.
# At macro scale everything is slower than the human-scale table in CLAUDE.md §6.
# --------------------------------------------------------------------------
SPEED_BUDGET = {
    "camera macro orbit":   (F_START, F_ORBIT_END, 0.028),
    "camera pull back":     (F_ORBIT_END, F_PULL_END, 0.12),
    "camera arc and rise":  (F_PULL_END, F_ARC_END, 0.25),
    "camera crane out":     (F_ARC_END, F_END, 0.24),
    "cookie descent":       (F_COOKIE_IN, F_COOKIE_TOUCH, 0.22),
    # Not in the brief's table. The brief fixes the cookie 0.45 m from a camera
    # that is 1.55 m from bed centre, so it has to cover 1.10 m during the crane;
    # over F_ARC_END..F_LOCK that is 0.37 m/s and there is no slower way to
    # satisfy the layout. Budgeted explicitly rather than left unmeasured.
    "cookie ridge glide":   (F_ARC_END, F_LOCK, 0.40),
}


# --------------------------------------------------------------------------
# DERIVED GEOMETRY
# --------------------------------------------------------------------------
def _lerp(a, b, t):
    return a + (b - a) * t


def _smoothstep(t):
    """Matches the BEZIER / EASE_IN_OUT curve Blender puts between keyframes
    closely enough to predict framing. Actual speeds are measured off the real
    fcurves in report_speeds(), not from this."""
    return t * t * (3.0 - 2.0 * t)


def camera_state(frame):
    """(distance, lens, elevation_deg, azimuth_deg) at a frame."""
    track = CAM_TRACK
    if frame <= track[0][0]:
        f, d, l, e, a = track[0]
        return d, l, e, AZ0 + a
    for i in range(len(track) - 1):
        f0, d0, l0, e0, a0 = track[i]
        f1, d1, l1, e1, a1 = track[i + 1]
        if f0 <= frame <= f1:
            t = _smoothstep((frame - f0) / (f1 - f0)) if f1 > f0 else 0.0
            return (_lerp(d0, d1, t), _lerp(l0, l1, t),
                    _lerp(e0, e1, t), AZ0 + _lerp(a0, a1, t))
    f, d, l, e, a = track[-1]
    return d, l, e, AZ0 + a


def hero_chip_pos():
    """The chip the macro orbit is built around."""
    ar = math.radians(AZ0 + HERO_AZ_OFFSET)
    x, y = HERO_R * math.cos(ar), HERO_R * math.sin(ar)
    return x, y, bed_height(x, y)


def _aim_blend(frame):
    """0 = orbiting the hero chip, 1 = centred on the depression."""
    if frame <= F_ORBIT_END:
        return 0.0
    if frame >= F_PULL_END:
        return 1.0
    return _smoothstep((frame - F_ORBIT_END) / (F_PULL_END - F_ORBIT_END))


def macro_tilt(frame):
    """Extra downward lens tilt, degrees, during the macro phase."""
    return MACRO_TILT_DOWN_DEG * (1.0 - _aim_blend(frame))


def look_target(frame):
    """Where the lens actually points: the aim point, dropped by the macro tilt.
    Separate from aim_point() because the camera POSITION must keep following the
    briefed elevation track — only the tilt changes."""
    d = camera_state(frame)[0]
    x, y, z = aim_point(frame)
    return x, y, z - d * math.tan(math.radians(macro_tilt(frame)))


def aim_point(frame):
    """What the camera is pointed at. Drifts from the hero chip to the
    depression across the pull-back, which is what turns a macro portrait of one
    chip into a centred landscape without a cut."""
    d, lens, _e, az = camera_state(frame)
    hx, hy, hz = hero_chip_pos()
    t = _aim_blend(frame)
    # offset sideways so the hero chip sits on a third at frame 1, not dead centre
    off = frame_width(d, lens) * AIM_THIRD * (1.0 - t)
    ar = math.radians(az)
    rx, ry = math.sin(ar), -math.cos(ar)          # camera-right on the ground
    x = _lerp(hx, 0.0, t) + rx * off
    y = _lerp(hy, 0.0, t) + ry * off
    z = _lerp(hz + CHIP_H * 0.55, 0.0, t)
    return x, y, z


def camera_position(frame):
    d, _l, e, az = camera_state(frame)
    er, ar = math.radians(e), math.radians(az)
    ax, ay, az_ = aim_point(frame)
    return (ax + d * math.cos(er) * math.cos(ar),
            ay + d * math.cos(er) * math.sin(ar),
            az_ + d * math.sin(er))


def frame_width(distance, lens):
    """Horizontal extent the sensor covers at a given distance, in metres."""
    return distance * SENSOR_WIDTH / lens


def final_axis():
    """Unit vector on the ground pointing from bed centre toward the final camera."""
    ar = math.radians(AZ0 + CAM_TRACK[-1][4])
    return math.cos(ar), math.sin(ar)


def macro_arc_distance(x, y):
    """Distance from a point to the macro camera's orbit arc.

    Written from constants only — bed_height() calls it and camera_position()
    calls bed_height(), so it must not depend on the camera rig."""
    hx = HERO_R * math.cos(math.radians(AZ0 + HERO_AZ_OFFSET))
    hy = HERO_R * math.sin(math.radians(AZ0 + HERO_AZ_OFFSET))
    d0 = CAM_TRACK[0][1]
    span = CAM_TRACK[1][4]
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    dx, dy = x - hx, y - hy
    out = np.abs(np.hypot(dx, dy) - d0)
    on_arc = ((np.degrees(np.arctan2(dy, dx)) - AZ0) % 360.0) <= span
    for ang in (AZ0, AZ0 + span):
        px = hx + d0 * math.cos(math.radians(ang))
        py = hy + d0 * math.sin(math.radians(ang))
        out = np.where(on_arc, out, np.minimum(out, np.hypot(x - px, y - py)))
    return out


def macro_berm_centre():
    """Behind the hero chip, at the mid-point of the orbit's azimuth sweep."""
    hx = HERO_R * math.cos(math.radians(AZ0 + HERO_AZ_OFFSET))
    hy = HERO_R * math.sin(math.radians(AZ0 + HERO_AZ_OFFSET))
    a = math.radians(AZ0 + 180.0 + CAM_TRACK[1][4] / 2.0)
    return hx + BERM_R * math.cos(a), hy + BERM_R * math.sin(a)


def bed_height(x, y):
    """Terrain height of the chip bed at a world XY.

    ONE implementation, vectorised, serving a single scalar lookup and the
    1.2 M-point continuation-plane grid identically. The chip scatter, the
    continuation plane, the pack row and the cookie's path all read this, so they
    cannot disagree about where the ground is. An earlier version kept a separate
    numpy copy inside build.py, which is two places to edit and one silent
    divergence away from chips floating over their own floor.
    """
    scalar = np.isscalar(x) and np.isscalar(y)
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    ax, ay = final_axis()
    along, across = x * ax + y * ay, -x * ay + y * ax
    r = np.hypot(x, y)

    ridge = RIDGE_H * np.exp(-(((along - RIDGE_X) ** 2) + (across * 0.55) ** 2)
                             / (2.0 * RIDGE_SIGMA ** 2))
    swell = SWELL_H * (np.sin(x / SWELL_SCALE * 2.4) * np.cos(y / SWELL_SCALE * 1.9))
    meso = (MESO_H * np.clip((r - MESO_CLEAR_R) / MESO_RAMP, 0.0, 1.0)
            * _meso_noise(x, y))
    scoop = -MACRO_SCOOP_D * np.exp(
        -(macro_arc_distance(x, y) / MACRO_SCOOP_SIGMA) ** 2)
    bx, by = macro_berm_centre()
    berm = BERM_H * np.exp(-((x - bx) ** 2 + (y - by) ** 2)
                           / (2.0 * BERM_SIGMA ** 2))

    # the depression, and the rim of chips banked around it
    dip = -DEPRESSION_DEPTH * np.cos(
        np.clip(r / DEPRESSION_R, 0.0, 1.0) * math.pi / 2) ** 0.6
    t = np.clip((r - DEPRESSION_R) / DEPRESSION_RIM, 0.0, 1.0)
    bank = DEPRESSION_DEPTH * DEPRESSION_BANK * np.sin(t * math.pi)
    hollow = np.where(r < DEPRESSION_R, dip,
                      np.where(r < DEPRESSION_R + DEPRESSION_RIM, bank, 0.0))

    out = ridge + swell + meso + scoop + berm + hollow
    return float(out) if scalar else out


def cookie_final():
    """Where the cookie ends up, and how far it is leaning.

    Solved, not typed: the cookie sits on the ridge crest, tilted until its face
    normal points at the final camera position, and the ridge height was chosen
    so that this lands it exactly at the brief's 0.45 m / 15 % of frame width.
    """
    ax, ay = final_axis()
    cx, cy, cz = camera_position(F_END)
    x, y = RIDGE_X * ax, RIDGE_X * ay
    ground = bed_height(x, y)
    # tilt so the face points at the camera
    horiz = math.hypot(cx - x, cy - y)
    z, tilt = ground + COOKIE_D / 2, 0.0
    for _ in range(24):                       # z depends on tilt and vice versa
        tilt = math.pi / 2 - math.atan2(cz - z, horiz)
        z = ground + (COOKIE_T / 2) * math.cos(tilt) + (COOKIE_D / 2) * math.sin(tilt)
    dist = math.dist((x, y, z), (cx, cy, cz))
    return {"pos": (x, y, z), "tilt_deg": math.degrees(tilt),
            "ground": ground, "distance": dist}


def pack_positions():
    """Four packs in a shallow row at the bed-centre plane, perpendicular to the
    final view axis, centred on it."""
    ax, ay = final_axis()
    rx, ry = -ay, ax                       # camera-right on the ground
    spots = [((i - (PACK_COUNT - 1) / 2.0) * PACK_PITCH) for i in range(PACK_COUNT)]
    xy = [(rx * off, ry * off) for off in spots]
    # One common shelf height for the whole row rather than per-pack terrain.
    # The brief asks for a "shallow row"; letting each pack follow the mounds
    # staggered them by up to 26 mm, which reads as sloppy set dressing. Taking
    # the highest of the four means none floats — the lower ones simply stand a
    # little deeper in the chips, which is what a bag on a loose bed does anyway.
    ground = max(float(bed_height(x, y)) for x, y in xy)
    return [{"key": k, "pos": (x, y, ground), "offset": off}
            for k, (x, y), off in zip(PACK_ORDER, xy, spots)]


def apparent(size_m, distance, lens):
    """Fraction of frame width / height an object of a given size subtends."""
    fw = frame_width(distance, lens)
    return size_m / fw, size_m / (fw / ASPECT)


def _solve_ridge_height():
    """Pick the crest height that puts the cookie exactly COOKIE_TARGET_DIST from
    the final camera. Solved rather than typed: the terrain has several
    contributions and any change to them would otherwise silently move the
    cookie's apparent size off the brief's published table."""
    global RIDGE_H
    lo, hi = 0.05, 0.60
    for _ in range(60):
        RIDGE_H = (lo + hi) / 2.0
        if cookie_final()["distance"] > COOKIE_TARGET_DIST:
            lo = RIDGE_H                      # too far -> needs a higher crest
        else:
            hi = RIDGE_H
    RIDGE_H = round((lo + hi) / 2.0, 5)


_solve_ridge_height()


# --------------------------------------------------------------------------
# GEOMETRY NOTE — the one place this build departs from the brief
#
# The brief's final-frame table asks for the cookie 0.45 m from the camera at
# 15 % of frame width, with the camera 1.55 m from bed centre at 22 deg.
# Those cannot both hold for a cookie lying on the bed:
#
#   camera height        = 1.55 * sin 22        = 581 mm
#   cookie centre on bed =                      =  26 mm
#   vertical drop        =                      = 555 mm  >  450 mm
#
# The straight-line distance is already exceeded by the height difference alone,
# so there is no position on the bed that is 0.45 m from that camera. Worse, the
# nearest bed point actually inside the frame is 929 mm out, where a 55 mm cookie
# reads 7.4 % of frame width against 10.5 % for each pack — the cookie comes back
# SMALLER than the packs, which inverts the entire point of the shot.
#
# Resolution: keep every camera number exactly as briefed (the pack row's
# 10 % / 21 % / 50 % all verify against it, and the brief is emphatic those were
# computed for 4:3), and give the bed a foreground ridge for the cookie to climb.
# RIDGE_H is solved backwards from the brief's own 0.45 m, so the published
# apparent sizes land exactly as written. The ridge is on-theme rather than a
# patch — the creative spine is "pull out until you realise it is a landscape",
# and a landscape has relief. It also keeps the cookie in continuous ground
# contact, which a levitating hero cookie would not.
# --------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Shot {SHOT_ID} — {SHOT_NAME}")
    print(f"{RES_FINAL[0]}x{RES_FINAL[1]}  {ASPECT:.4f}:1  {FPS} fps  "
          f"{F_END} frames  {DURATION_S:.1f} s  hold {HOLD_FRAMES} f\n")
    print(f"{'frame':>6} {'dist':>7} {'lens':>6} {'elev':>6} {'azim':>7} "
          f"{'frame w':>9} {'frame h':>9}")
    for f, *_ in CAM_TRACK:
        d, l, e, az = camera_state(f)
        fw = frame_width(d, l)
        print(f"{f:>6} {d:>7.3f} {l:>6.1f} {e:>6.1f} {az:>7.1f} "
              f"{fw*1000:>8.0f}m {fw/ASPECT*1000:>8.0f}m")
    ck = cookie_final()
    print(f"\ncookie final: {ck['distance']*1000:.0f} mm from camera, "
          f"leaning {ck['tilt_deg']:.1f} deg, ridge crest {ck['ground']*1000:.0f} mm")
    d, l, _, _ = camera_state(F_END)
    w, h = apparent(COOKIE_D, ck["distance"], l)
    print(f"  apparent: {w*100:.1f}% frame width, {h*100:.1f}% frame height   "
          f"(brief: 15% / 20%)")
    w, h = apparent(PACK_W, d, l)
    print(f"  each pack: {w*100:.1f}% width, "
          f"{apparent(PACK_H, d, l)[1]*100:.1f}% height   (brief: 10% / 21%)")
    print(f"  pack row : {apparent(PACK_ROW_W, d, l)[0]*100:.1f}% width          "
          f"(brief: 50%)")
