# Shot 1A — "The Wall" · clay control pass

A Blender clay control pass for **PC The Decadent**, built to the conventions in
[`public/blender/CLAUDE.md`](../public/blender/CLAUDE.md) from the shot brief
`shot_1A_decadent_brief.md`.

12 s · 4:3 · 24 fps · 288 frames · one continuous clip · 960×720.

This is **Lane A only**. The clip carries camera path, blocking, timing,
occlusion order and light direction. It carries no brand colour, no material and
no type — those are Lane B stills and post. Mixing the two lanes is the single
most common way this workflow fails.

## Files

| File | What it is |
| --- | --- |
| `config.py` | Every number in the shot. No `bpy` import, so `python3 config.py` prints the full geometry report without launching Blender. |
| `build.py` | The scene build, the checks, and the export package. One self-contained script. |
| `out/shot_1A/` | Generated: `prompt.txt`, `metadata.json`, `README.txt`, stills, frames, clip. |

`build.py` reads every constant from `config.py`, and `write_prompt()` emits
`prompt.txt` from those same constants — so the clay render and the Seedance
prompt cannot drift apart.

## Running it

```bash
python3 build.py --no-render        # build + all checks, no pixels
python3 build.py --checkpoints      # 9 checkpoint stills, top-down, beat stills
python3 build.py --frames 1,288     # just those frames
python3 build.py --draft --animation
python3 build.py --animation        # 960x720, 288 frames, H.264
```

On a machine with no GPU, EEVEE still needs a GL context — prefix with:

```bash
LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless GALLIUM_DRIVER=llvmpipe
```

## What the probe found (Blender 5.0.1, `bpy` wheel)

The guide says not to trust training data about the Blender API. Four things
here would each have failed silently inside a long script:

- The render engine identifier is `BLENDER_EEVEE`. It is the *only* engine the
  wheel exposes until the Cycles add-on is enabled.
- **`Action.fcurves` no longer exists.** Layered actions mean curves are reached
  through `action.layers[…].strips[…].channelbag(slot).fcurves`.
  `fcurve_ensure_for_datablock` exists on the *instance* even though `hasattr`
  on `bpy.types.Action` returns `False` — read the live object, not the type.
- **`OCIO` must be set before `import bpy`**, or the view transform enum contains
  only `NONE`, `"Standard"` is unavailable, and every clay value renders wrong.
  `build.py` points it at the wheel's own `config.ocio` at import time.
- The wheel ships FFMPEG, so the H.264 encode happens inside Blender and no
  external `ffmpeg` binary is needed.

## Checks that run on every build

| Check | Why |
| --- | --- |
| `report_speeds()` | Mean and peak m/s per budgeted move **and** per animated object, measured off the real fcurves rather than the config maths. Frames where an object is hidden are skipped — a hidden object leaves the depsgraph, and its stale `matrix_world` otherwise reports a 7.9 m/s phantom jump. |
| `check_clearance()` | The crane passes over the foreground ridge. Asserts it never comes within 3× the near clip of the bed. |
| `check_exposure()` | % of pixels clipped to white or crushed to black, per checkpoint. A raking key on 50 000 chips clips easily, and clipped highlights erase the geometry the model reads. |
| `check_layout()` | Measures the finished frame's subjects **off actual pixels** and compares them to the brief's apparent-size table. |

`check_layout` is what caught the cookie rotating about the wrong axis: it was
rolling sideways like a falling coin instead of tipping back face-on, which
foreshortened the width the brief's 15% figure depends on. It measured 12.2%
against a predicted 15.3%, and the render looked plausible enough to pass by eye.

Measured on the current build:

```
cookie       15.3% w   18.1% h   centre x 49.8%     (brief: 15% / 20%, centred)
pack_chip    12.1% w   21.7% h   centre x 29.6%     (brief: 10% / 21%)
pack_soft    12.0% w   22.5% h   centre x 43.1%
pack_pb      11.9% w   21.9% h   centre x 56.7%
pack_rev     12.3% w   22.1% h   centre x 70.4%
pack row     52.9% w                                (brief: 50%)
```

Packs measure ~12% rather than 10% because the brief's figure uses the nominal
130 mm flat width, and a gusseted bag with a belly bulge is ~12% wider than flat.
That is the proxy being correct, not the layout being off.

## Where this departs from the brief

**The final frame as written cannot be built.** The brief puts the cookie 0.45 m
from a camera that is 1.55 m from bed centre at 22°:

```
camera height        1.55 · sin 22°  =  581 mm
cookie centre on bed                 =   26 mm
vertical drop                        =  555 mm   >  450 mm
```

The height difference alone exceeds the straight-line distance, so no point on
the bed is 0.45 m from that camera. Worse, the nearest bed point actually inside
the frame is 929 mm out, where a 55 mm cookie reads 7.4% of frame width against
10.5% for each pack — the cookie comes back **smaller** than the packs, which
inverts the entire point of the shot.

Resolution: every camera number is kept exactly as briefed (the pack row's
10 / 21 / 50% all verify against it), and the bed is given a foreground ridge for
the cookie to climb. `RIDGE_H` is *solved* from the brief's own 0.45 m rather
than typed, so the published apparent sizes land exactly as written. The ridge is
on-theme rather than a patch — the creative spine is "pull out until you realise
it is a landscape", and a landscape has relief — and it keeps the cookie in
continuous ground contact, which a levitating hero cookie would not.

Two smaller departures, both documented at the point of use in `config.py`:

- **The continuation plane is 11 m square, not 8 m.** At f288 the top of frame
  lands 6.26 m from a camera 1.44 m out from centre, so the bed has to reach
  4.83 m past centre plus 2.5 m of lateral spread. 8 m is 0.9 m short and the
  void shows.
- **The lens tilts down 3° during the macro phase, and the bed dips along the
  orbit.** The brief asks for "no horizon, frame completely filled" at f1, but a
  camera at chip-top level on a flat bed always sees sky at the top of frame.
  Camera *position* still follows the briefed 2° elevation track exactly.

## Not done in this pass

**The full 288-frame clip has not been rendered here.** This container has no
GPU, so EEVEE runs on llvmpipe at roughly 80 s/frame at 960×720 — about 6½ hours
for the clip. `build.py --animation` produces it unchanged on a machine with a
GPU, where the same render is minutes.

What *has* been rendered and inspected: all nine checkpoints, the top-down
blocking still, and the beat stills — at full 960×720, with the exposure and
layout checks passing on each.

The Lane B look references (`02_look_chips.png` … `08_look_lighting.png`) are
**not** generated here. They are photographs and brand assets, not Blender
output. `README.txt` and `metadata.json` in the export folder carry the upload
order they must be dropped into; note that the clip is `@Video 1`, which makes
`08_look_lighting.png` **`@Image 7`**, not `@Image 8`. `prompt.txt` derives every
`@Image n` from that one list so the indices cannot drift.

Per the brief, `03_look_cookie.png` should be cropped from the 800 px classic
pack front — the Russ Rudd enlargement — not from the soft-baked photo currently
in the folder, which is the wrong SKU.
