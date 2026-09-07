"""TOKEN — 12-second portfolio film for ajwadrauf.com. Five shots, 360 frames.

Single source of truth. No `import bpy`, so `python3 token_config.py` prints the
whole film's geometry and timing without launching Blender.

THE DEPARTURE FROM CLAUDE.md: these are FINAL RENDERS, not clay control passes.
Nothing here is handed to a video model. The discipline stays — real camera, real
scale, aim through constraints, subjects never linear — but the output is the
finished look, which changes three things §6 would otherwise dictate:

  * View transform is AgX, not Standard. §6 says Standard because AgX crushes the
    flat ID colours a generation model reads for subject mapping. There is no
    generation step here, and the entire film is emissive geometry, which Standard
    clips to white the moment it glows. AgX rolls the highlights off instead.
  * Bloom is on. A clay pass must never bloom; a film about glowing tokens must.
  * Materials are emission shaders, not clay.

1 Blender unit = 1 metre.
"""

import math
import os
import re

# --------------------------------------------------------------------------
# DELIVERY
# --------------------------------------------------------------------------
FILM = "TOKEN"
FPS = 30                      # not 24 — hard freezes read better at 30
RES_FINAL = (1920, 1080)
RES_DRAFT = (960, 540)
ASPECT = RES_FINAL[0] / RES_FINAL[1]
SENSOR_WIDTH = 36.0           # full frame, set explicitly, never inherited

# --------------------------------------------------------------------------
# PALETTE — sRGB hex. Converted to linear at use; Blender stores colour linearly.
# --------------------------------------------------------------------------
VOID        = "#000000"       # background, every shot. True black, not near-
                             # black: on an OLED panel a lit pixel at #0B0B0C
                             # is a visibly grey rectangle around the frame,
                             # and this film is emitters against nothing.
TOKEN_WHITE = "#F2EFE9"       # default token emission, warm off-white
CYAN        = "#38E1D0"       # 1C only, the compressing core
AMBER       = "#FF6B2C"       # 1E only, the flood
DEAD_GREY   = "#4A4A4E"       # 1D only, fully desaturated


def hex_to_linear(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), a)


# --------------------------------------------------------------------------
# THE ONE ASSET — every shot instances this
# --------------------------------------------------------------------------
TOKEN_DIM = (0.006, 0.006, 0.014)   # 6 x 6 x 14 mm
TOKEN_BEVEL = 0.0008                # real bevel; a flat proxy reads as a sprite
SWARM_CUBE = 1.20                   # the swarm occupies roughly a 1.2 m cube
TOKEN_COUNT = 800                   # 300 still reads; past 1500 buys nothing
SCATTER_SEED = 20260906             # seed ONCE. Every shot reuses this array.

EMIT_BASE = 12.0                    # token emission strength at rest
EMIT_IGNITE = 26.0                  # peak on ignition
EMIT_DEAD = 0.15                    # 1D drops to ~15% of its 1C value

# --------------------------------------------------------------------------
# THE CONSTANT LIGHT — the one non-emissive light in the film.
# Its only job is edge definition so slabs read as solids, not glow shapes.
# Direction is identical in all five shots and must never be re-derived per shot.
# --------------------------------------------------------------------------
SLAB_ALBEDO = (0.34, 0.36, 0.40, 1.0)   # the lit lobe under the emission
SLAB_ROUGHNESS = 0.34
RIM_AZIMUTH_DEG = 40.0        # camera left
RIM_ELEV_DEG = 25.0
RIM_DISTANCE = 2.2
RIM_SIZE = 1.4
RIM_POWER = 6.0               # very low on purpose
RIM_COLOR = (0.72, 0.80, 1.0)  # cold

# --------------------------------------------------------------------------
# SHOTS — each file starts at frame 1. Do NOT offset to global timeline.
# (id, frames, lens_mm, motion_blur, one-line job)
# --------------------------------------------------------------------------
SHOTS = {
    "1A": dict(frames=75, lens=85.0, blur=False,
               job="SPARK — one token ignites in black"),
    "1B": dict(frames=90, lens=24.0, blur=True,
               job="FAST — push through the stream"),
    "1C": dict(frames=75, lens=65.0, blur=False,
               job="FASTER — the swarm compresses into understanding"),
    "1D": dict(frames=45, lens=65.0, blur=False,
               job="THE WALL — deadpan, colour drains"),
    "1E": dict(frames=75, lens=35.0, blur="SPLIT",
               job="RESET AND LAND — burst, then the wordmark"),
}
SHOT_ORDER = ["1A", "1B", "1C", "1D", "1E"]

# 1E is the only shot where the shutter is keyframed mid-take.
# use_motion_blur is NOT keyframeable (probed); motion_blur_shutter IS, so the
# blur is switched by driving the shutter to zero rather than toggling the flag.
E_BLUR_LAST_FRAME = 45
SHUTTER_ON = 0.55
SHUTTER_OFF = 0.0

# --------------------------------------------------------------------------
# BEATS — local frames. Named constants; never inlined in the build.
# --------------------------------------------------------------------------
A_BLINK_END = 36        # 0-1.2s   caret blinks twice, mechanically
A_SWELL_END = 45        # 1.2-1.5s third blink holds and swells
A_END = 75              # 1.5-2.5s ignites and breathes; last half second still

B_SPLIT_END = 9         # 0-0.3s   one token -> ~40
B_STREAM_END = 30       # 0.3-1.0s full stream
B_STRUCT_END = 66       # 1.0-2.2s lattice, pipeline, grid — 12 frames each
B_END = 90              # 2.2-3.0s clean parallel motion, NO deceleration
B_STRUCTURES = ["lattice", "pipeline", "grid"]
B_STRUCT_HOLD = 4       # frames each structure holds before coming apart
B_STRUCT_DRIFT = 0.30   # fraction of stream speed it drifts back through frame
# Per structure: how far AHEAD of the camera it hangs, and how big it is. The
# lattice is the only three-dimensional one, so at the flat structures' 1.25 m
# its near face is already inside the lens and it reads as noise, not a cube.
B_STRUCT_SPEC = {
    "lattice":  dict(lead=2.30, size=1.05),
    "pipeline": dict(lead=1.25, size=1.35),
    "grid":     dict(lead=1.25, size=1.35),
}
B_STRUCT_BURST = 1.7    # outward multiplier when it comes apart
B_STRUCT_MIN_Y = 0.3    # tokens starting behind this never join — no upstream flyers
B_JOIN_FRACTION = 0.86  # of the eligible tokens; the rest keep streaming past
# The last structure has to hand a FULL frame to 1C, which freezes whatever it
# finds. At 3.4 m/s the swarm clears the lens in well under the 24 frames left,
# so it re-forms into a stream at these depths and runs to the cut slower.
# Parameterised by where the swarm ENDS UP, not by where it is thrown, because
# the end is what 1C inherits. Thrown depths plus per-token speed put the
# slowest tokens 0.15 m off a lens, where a 14 mm slab is a blown-out bar across
# the frame edge. TWO cameras have to be cleared, not one: 1B ends at y = -0.10
# and 1C sits at y = -1.15, so the band starts far enough forward to stay 0.40 m
# clear of the first and 1.45 m clear of the second.
B_TAIL_FINAL_Y = (0.30, 1.90)
B_TAIL_SPEED = 0.55           # fraction of stream speed over the last 24 frames
# and it re-forms into a NARROW tube rather than dispersing: 1C picks the swarm
# up on a 65 mm lens whose frame is 0.64 m wide, so a swarm flung out to +/-1.1 m
# hands 1C an empty frame to freeze.
B_TAIL_RADIUS = 0.26
# HALF the non-joiners are pushed deep so the stream keeps arriving under the
# structures; the other half stay where they were. Pushing all of them back
# empties the near field, and the near field is where the speed lives — those
# are the tokens that streak past the frame edges at 24 mm. 5.0 m is as far as
# is useful: at 3.4 m/s against a camera closing at 0.3, anything beyond that
# never reaches the lens inside the 3 seconds this shot has.
B_STREAM_DEPTH = 5.0
B_STREAM_DEEP_FRACTION = 0.5
B_SPEED_JITTER = 0.25   # +/- per-token speed offset; uniform fields read as particles

C_FREEZE_END = 3        # 0-0.1s   hard stop, 3 frames maximum
C_ABSORB_END = 42       # 0.1-1.4s rings draw, tokens spiral in and are absorbed
C_DENSE_END = 66        # 1.4-2.2s scaffold assembles, core at its brightest
C_END = 75              # 2.2-2.5s completely still — 1D depends on this

# 1C/1D geometry. The frame at 65 mm from 1.15 m is 0.64 x 0.36 m, so a 0.30 m
# core is not a core, it is a white-out — and rings at 0.44 are arcs running off
# every edge. Every size below is set against that measured frame.
C_CAM_DIST = 1.15
C_CORE_R0 = 0.085               # at the freeze: 27% of frame width
C_CORE_R1 = 0.030               # at its brightest: 9%, a hard point
C_RING_R = (0.105, 0.130, 0.155)  # the widest is 87% of frame HEIGHT
C_ABSORB_R = 0.030              # tokens land on the bright core's surface
C_SWIRL_DEG = (34.0, 58.0)      # half-turn of the inward spiral, per token
C_RING_DRAW = 14                # frames each ring takes to draw itself


D_SWEEP_END = 3         # 0-0.1s   a thin line sweeps left to right — LINEAR
D_SWEEP_Y = 0.35        # metres in front of the frozen core
# The wipe's travel is DERIVED from the lens, not typed. Typed at +/-1.1 m it
# cleared the frame edge before frame 1 and the wipe was never on screen: at
# 65 mm the visible half-width at the sweep plane is only 0.42 m.
D_SWEEP_OVERSHOOT = 1.25
D_DRAIN_END = 14        # 0.1-0.45s saturation to zero, emission to 15%
D_END = 45              # 0.45-1.5s one full second of nothing. Do not shorten.

E_WAVE_START = 6        # 0.2s     shockwave launches after 6 frames of counter
E_WAVE_END = 11         # colour returns across the frame in ~6 frames
E_APEX = 42             # 1.4s     burst runs out of energy and reverses
E_COLLAPSE_END = 60     # 2.0s     every token on its vertex, staggered
E_LATE_TOKEN = 66       # 2.2s     one token arrives late. Do not cut it.
E_END = 75
E_ARRIVAL_STAGGER = 20  # frames across which arrivals are spread
E_LATE_LAG = 8          # how far behind the pack the late token runs
E_WORDMARK = "TOKEN"    # what the 800 tokens land on. Any string works —
                        # wordmark_targets() samples the font outline and
                        # scales it to a fixed width, so length does not matter.

# --------------------------------------------------------------------------
# CAMERA MOVES — (start_offset, end_offset) in metres, plus aim empty name.
# Rotation is NEVER keyframed. Every shot aims through a TRACK_TO constraint.
# `ease` is a real Blender interpolation identifier and is passed straight to
# key() — the table is wired, not descriptive.
# --------------------------------------------------------------------------
CAM = {
    "1A": dict(aim="AIM_spark",  dist=(0.520, 0.480), rise=0.0,  roll=0.0,
               ease="BEZIER"),  # push closes 40mm, just above noticing
    "1B": dict(aim="AIM_stream", travel=0.900, lead=0.400, roll=3.0,
               ease="LINEAR"),  # a constant push is mechanically constant
    "1C": dict(aim="AIM_core",   locked=True),   # zero keyframes
    "1D": dict(aim="AIM_core",   locked=True),   # identical rig to 1C
    "1E": dict(aim="AIM_burst",  pull=0.800, rise=0.200, ease="BEZIER"),
}

# --------------------------------------------------------------------------
# TYPE — comped in the edit, not rendered. Local frame is the authority.
# E_WORDMARK is the one exception: it is geometry, because tokens assembling
# into it is the payoff. Listed here so the build can keep frame clear for it.
# --------------------------------------------------------------------------
# Each entry carries the zone the type sits in, so "keep frame clear for it" is
# something the build can measure rather than something it merely asserts.
TYPE_MOMENTS = [
    ("1B", 51, "FAST", 18, "lower"),
    ("1C", 45, "FASTER", 18, "lower"),
    ("1D",  6, "LIMIT REACHED + resets in 00:03", 39, "lower"),
    ("1E",  1, "∞", 6, "centre"),
    ("1E", 42, "ajwadrauf.com", 33, "lower"),   # below the wordmark, not over it
]
# x0, x1, y0, y1 in frame fractions, origin bottom-left as Blender's pixels are
TYPE_ZONES = {"lower": (0.08, 0.92, 0.06, 0.26),
              "centre": (0.08, 0.92, 0.40, 0.60)}
TYPE_ROOM_MAX = 0.42            # mean luminance a zone may carry and still hold type

# --------------------------------------------------------------------------
# CHECKPOINTS — frames worth looking at. Quarters of the shot length land
# between beats and hide exactly the moments that go wrong, so every entry
# here is a named beat instead.
# --------------------------------------------------------------------------
CHECKPOINTS = {
    "1A": [1, A_BLINK_END, A_SWELL_END, 60, A_END],
    "1B": [1, 22, 36, 48, 60, B_END],           # 36/48/60 are the three holds
    "1C": [1, C_FREEZE_END, 24, C_ABSORB_END, C_DENSE_END, C_END],
    "1D": [1, 2, D_SWEEP_END, D_DRAIN_END, 30, D_END],   # f2 is the wipe
    "1E": [1, E_WAVE_END, E_APEX, 56, E_COLLAPSE_END, E_END],
}
# Both ends of every type hold are beats: a zone that is bright when the type
# comes up but dark for the rest of the hold is a frame the edit can work with,
# and judging it on its first frame alone would fail the whole shot for it.
for _s, _f, _t, _h, _z in TYPE_MOMENTS:
    CHECKPOINTS.setdefault(_s, []).extend([_f, _f + _h - 1])


def type_hold_frames(shot, f, hold):
    n = frames_of(shot)
    return sorted({min(max(1, f), n), min(max(1, f + hold - 1), n)})


def checkpoints_of(shot):
    n = frames_of(shot)
    fs = CHECKPOINTS.get(shot) or [1, n // 4, n // 2, (3 * n) // 4, n]
    return sorted({min(max(1, int(f)), n) for f in fs})


# --------------------------------------------------------------------------
# RENDER
# --------------------------------------------------------------------------
# A prop wider than this many frames is not a prop, it is the background.
FRAME_FILL_LIMIT = 1.6
# Two things are supposed to exceed the frame. 1D's sweep is a wipe: a bar that
# stopped at the frame edge would read as an object crossing, not as a wipe. 1E's
# shockwave is an event that travels out THROUGH the swarm and past the lens —
# its whole job is to leave. Everything else that fills the frame is a bug.
FRAME_FILL_EXEMPT = {"sweep", "shockwave"}
# 1D is deliberately a still frame of one object; everywhere else the swarm has
# to actually be on screen at every beat.
MIN_TOKENS_IN_FRAME = {"1B": (22, 120), "1C": (1, 120), "1E": (1, 120)}

ENGINE = "BLENDER_EEVEE"        # probed: the only engine this build offers
TAA_SAMPLES = 64                # finals, not clay — 16 was for a control pass
VIEW_TRANSFORM = "AgX"          # see the module docstring for why not Standard
VIEW_LOOK = "None"
EXPOSURE = 0.0

# Bloom. There is NO EEVEE bloom property in this build — it was removed and
# lives in the compositor now. Glare settings are input SOCKETS, so they are
# keyframeable, and the Type socket is a MENU taking display-cased strings
# ("Bloom", "Fog Glow"), NOT the old SCREAMING_SNAKE enum identifiers.
GLARE_TYPE = "Bloom"
# Strength is the ONLY lever that moves this. Measured on 1C f45, the brightest
# frame in the film (mean display luminance of the lower third / the corners):
#
#   Size    1 .. 9      0.520 / 0.377   — identical at every value. Size is a
#                                         Fog Glow control; Bloom ignores it.
#   Threshold 0.6 -> 1.5  0.520 -> 0.509  — the core is far above both.
#   Strength 0.55         0.520 / 0.377   the void reads mid-teal, corner to corner
#   Strength 0.20         0.409 / 0.293   a glow around the core, black corners
#   Strength 0.00         0.193 / 0.172   the floor
#
# 0.55 washed the whole frame and left the type nowhere to sit at 1C f45 and
# 1D f6. 0.20 keeps the halo and gives the palette's true black back.
GLARE_STRENGTH = 0.20
GLARE_SIZE = 8              # Fog Glow only — set, but Bloom does not read it
GLARE_THRESHOLD = 0.6

STATE_DIR = "state"             # //state/1A_out.json, etc.


def frames_of(shot):
    return SHOTS[shot]["frames"]


def seconds_of(shot):
    return SHOTS[shot]["frames"] / FPS


def edit_time(shot, local_frame):
    """Edit-timeline seconds for a local frame. Frame 1 of each shot sits at
    that shot's start; the local frame is the authority and edit time derives."""
    start = sum(SHOTS[s]["frames"] for s in SHOT_ORDER[:SHOT_ORDER.index(shot)])
    return (start + local_frame - 1) / FPS


def frame_width_at(distance, lens):
    return distance * SENSOR_WIDTH / lens


# --------------------------------------------------------------------------
# PORTABILITY
# --------------------------------------------------------------------------
# Blender 5.2.1 ships NumPy 2; the bpy 5.0.1 wheel ships 1.26. Anything NumPy 2
# removed therefore runs clean on the wheel and dies on the desktop build — and
# it dies partway through a render, which is the expensive place to find out.
# `arr.ptp()` did exactly that: four shots rendered, then 1E raised on the line
# that logs the wordmark's size. This file needs no Blender, so it runs anywhere.
NUMPY2_REMOVED = [
    (r"\.ptp\(\)",         "arr.ptp() -> np.ptp(arr)"),
    (r"\.itemset\(",        "arr.itemset(i, v) -> arr[i] = v"),
    (r"\.newbyteorder\(",   "arr.newbyteorder() -> arr.view(dtype.newbyteorder())"),
    (r"np\.float_\b",       "np.float_ -> np.float64"),
    (r"np\.unicode_\b",     "np.unicode_ -> np.str_"),
    (r"np\.in1d\b",         "np.in1d -> np.isin"),
    (r"np\.alltrue\b",      "np.alltrue -> np.all"),
    (r"np\.sometrue\b",     "np.sometrue -> np.any"),
    (r"np\.product\b",      "np.product -> np.prod"),
    (r"np\.cumproduct\b",   "np.cumproduct -> np.cumprod"),
    (r"np\.row_stack\b",    "np.row_stack -> np.vstack"),
    (r"np\.NaN\b",          "np.NaN -> np.nan"),
    (r"np\.Inf\b",          "np.Inf -> np.inf"),
]


def check_numpy2(path=None):
    """Flag anything NumPy 2.0 removed, before a render finds it."""
    path = path or os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "token_build.py")
    if not os.path.exists(path):
        return True
    bad = []
    for i, line in enumerate(open(path), 1):
        if line.lstrip().startswith("#"):
            continue
        for pat, fix in NUMPY2_REMOVED:
            if re.search(pat, line):
                bad.append((i, fix))
    for i, fix in bad:
        print("  NUMPY 2 REMOVED: %s:%d  %s" % (os.path.basename(path), i, fix))
    if not bad:
        try:
            import numpy
            here = numpy.__version__
        except ImportError:
            here = "not installed"
        print("numpy %s here, and nothing NumPy 2.0 removed is used — so this "
              "also runs on Blender 5.2's numpy 2" % here)
    return not bad


if __name__ == "__main__":
    total = sum(s["frames"] for s in SHOTS.values())
    print("%s — %d frames, %.1fs at %d fps, %dx%d\n"
          % (FILM, total, total / FPS, FPS, *RES_FINAL))
    print("%-4s %6s %7s %8s  %-6s %s" % ("shot", "frames", "seconds", "lens", "blur", "job"))
    print("  " + "-" * 76)
    t = 0.0
    for s in SHOT_ORDER:
        d = SHOTS[s]
        print("%-4s %6d %7.2f %7.0fmm  %-6s %s"
              % (s, d["frames"], d["frames"] / FPS, d["lens"], str(d["blur"]), d["job"]))
        t += d["frames"] / FPS
    print("\ntype comp — local frame is the authority, edit time derives:")
    for shot, f, txt, hold, zone in TYPE_MOMENTS:
        print("  %-3s f%-3d  %6.2fs  %-34s hold %-3df %s"
              % (shot, f, edit_time(shot, f), txt, hold, zone))
    print("\ntoken %.0f x %.0f x %.0f mm · %d instances · swarm %.2f m cube · seed %d"
          % (TOKEN_DIM[0] * 1000, TOKEN_DIM[1] * 1000, TOKEN_DIM[2] * 1000,
             TOKEN_COUNT, SWARM_CUBE, SCATTER_SEED))
    check_numpy2()
    print("palette:", ", ".join("%s %s" % (n, h) for n, h in
          [("void", VOID), ("white", TOKEN_WHITE), ("cyan", CYAN),
           ("amber", AMBER), ("grey", DEAD_GREY)]))
