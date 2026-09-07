# TOKEN — a 12-second film

Five shots, one continuous run of 800 emissive tokens, cut hard.
**1920×1080 · 30 fps · 360 frames · 12.00 s.**

| Shot | Frames | In | Lens | Job |
| --- | ---: | ---: | ---: | --- |
| 1A | 75 | 0.00 s | 85 mm | SPARK — one token ignites in black |
| 1B | 90 | 2.50 s | 24 mm | FAST — push through the stream |
| 1C | 75 | 5.50 s | 65 mm | FASTER — the swarm compresses into understanding |
| 1D | 45 | 8.00 s | 65 mm | THE WALL — deadpan, colour drains |
| 1E | 75 | 9.50 s | 35 mm | RESET AND LAND — burst, then the wordmark |

## This is a final render, not a clay pass

[`public/blender/CLAUDE.md`](../../public/blender/CLAUDE.md) §6 specifies a clay
control pass: `Standard` view transform, no bloom, flat grey, structure only —
a *reference* for a video model to interpret. **None of that applies here.**
Nothing downstream interprets these frames; they are the deliverable. So this
build departs from §6 deliberately and in exactly three places, each marked at
the point of use:

- **`AgX`, not `Standard`.** The film is emitters against black. `Standard`
  clips every emitter to a flat white disc at the same value, and the difference
  between a token at 0.8 and one at 1.4 disappears. `AgX` keeps them apart.
- **Bloom is on.** In this build there is no EEVEE bloom property — it was
  removed and lives in the compositor. `setup_bloom()` builds a node group with
  a Glare node whose settings are input *sockets*, and whose `Type` socket is a
  menu taking display-cased strings (`"Bloom"`), not the old
  `SCREAMING_SNAKE` enum identifiers.
- **Emission, not clay.** One shared material, `M_emit`, driven per object by
  `object.color` through a `ShaderNodeObjectInfo`. 800 tokens, one material,
  every one independently animated in colour and brightness. A small diffuse
  lobe sits under the emission so the rim light has something in the film to
  fall on — a pure emitter cannot be lit, and without it the slabs read as glow
  shapes exactly where they are dimmest, in 1D and the top of 1E.

## The state contract

Each shot writes `state/<shot>_out.json`: the world transform and colour of
every token on its last frame. The next shot loads it and starts there. That is
the whole reason the cuts don't pop — the camera changes lens and position at
every cut, but no subject ever teleports.

`check_continuity()` runs on every build and reports the worst per-token delta
between this shot's frame 1 and the previous shot's saved final frame. It is
`0.000000 m` for all four cuts. Build the shots **in order** the first time;
after that any shot can be rebuilt alone.

## Files

| File | What it is |
| --- | --- |
| `token_config.py` | Every number in the film — beats, palette, camera moves, geometry. No `bpy` import, so `python3 token_config.py` prints the edit-time table without launching Blender. |
| `token_build.py` | The five shot builders, the checks, the render and the assemble. One self-contained script. |
| `state/` | **Generated.** The handoff JSON between shots. |
| `out/` | **Generated and gitignored.** Checkpoints, frames, per-shot clips, the assembled film. |

## Running it

```bash
python3 token_config.py                     # edit-time table + portability check
python3 token_build.py --all                # build + all checks, no pixels
python3 token_build.py --all --checkpoints  # + a still on every named beat
python3 token_build.py --shot 1C --checkpoints
python3 token_build.py --all --animation    # the full render
python3 token_build.py --assemble           # five shots -> one 12 s mp4
```

With Blender installed — renders on your GPU. On an Apple-silicon Mac that is
Metal, and there is nothing to select: EEVEE uses the system GPU backend
directly. (Device selection is a Cycles concern, and this film is EEVEE.)

```bash
blender --background --python token_build.py -- --all --animation
blender --background --python token_build.py -- --assemble
open out/film/TOKEN.mp4
```

On macOS the binary lives inside the app bundle, so either put it on `PATH` or
call it directly:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python token_build.py -- --all --animation
```

**Recent desktop builds cannot write video at all.** Blender 5.2.1 LTS on macOS
arm64 supports `AVIF, JPEG, OPEN_EXR, PNG, WEBP, BMP, CINEON, DPX, IRIS,
JPEG2000, HDR, TARGA, TARGA_RAW, TIFF` — no video format. The build detects this,
renders a PNG sequence instead, and encodes with an external `ffmpeg`:

```bash
brew install ffmpeg
```

Time one shot before committing to all 360 frames — 1D is 45 frames:

```bash
blender --background --python token_build.py -- --shot 1D --animation
```

On a machine with no GPU, EEVEE still needs a GL context:

```bash
LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless GALLIUM_DRIVER=llvmpipe \
  python3 token_build.py --all --draft --checkpoints
```

## Checks that run on every build

| Check | Why |
| --- | --- |
| `check_continuity()` | Frame 1 against the previous shot's saved final frame, per token. A cut that pops is the one failure this film cannot absorb. |
| `report_speeds()` | Mean and peak m/s for the camera and for a sample of subjects, measured off the real fcurves rather than the config maths. |
| `check_linearity()` | Flags any subject whose frame-to-frame step is constant to within 5%. Constant velocity is the tell that something was typed rather than animated — except where it is the point, like 1B's camera and 1D's wipe, which are LINEAR on purpose. |
| `check_framing()` | Projects every prop's bounding box through the camera on **every** frame and flags anything spanning more than 1.6 frames, plus any beat where the swarm has left the frame. 1D's wipe and 1E's shockwave are exempt by name — both are supposed to leave the frame. |
| `check_type_room()` | Where type is comped in the edit, the frame still has to leave room for it. Measures the display luminance of the zone each type moment lands in, off the rendered checkpoint, at **both ends of the hold** — a zone that is bright when the type comes up but dark for the rest of it is one the edit can work with. |
| `check_film_moves()` | Runs on `--assemble`. ffmpeg returning 0 says it wrote a file, not that the file is a film: a 12-second video of one repeated frame exits 0 and looks correct in every log. This decodes the first, middle and last frames back out and warns if they are identical. Tested in both directions against a synthetic moving clip and a synthetic still. |

`check_framing` exists because three separate bugs cost a render pass each, and
all three were size errors that looked like plausible numbers in the source:

- a **0.30 m core** in 1C, in a frame that is 0.64 m wide at 65 mm from 1.15 m —
  it rendered as a full-frame white-out with its rings as arcs running off every
  edge;
- 1E's **shockwave scaling to 46×**, which stopped being an event travelling
  through the swarm and became the background;
- 1B's **lattice at the same 1.25 m as the flat structures** — it is the only
  three-dimensional one, so its near face was inside the lens and it read as
  noise rather than a cube.

Sizes are a rendering question. They get measured against the render.

## The end card

1E lands on `AJWAD RAUF` made of the same 800 tokens as the rest of the film,
with the credit set beneath it as real text geometry.

The split is forced by measurement. 800 tokens is a fixed budget, and what
decides legibility is the gap between them relative to cap height — not cap
height itself. Measured on the payoff frame at 1920×1080:

| Wordmark | chars | cap | gap | ratio | |
| --- | ---: | ---: | ---: | ---: | --- |
| `TOKEN` | 5 | 276 px | 22 px | 8% | crisp |
| `CLAUDE` | 6 | 242 px | 29 px | 12% | crisp |
| `AJWAD RAUF` | 10 | 195 px | 24 px | 12% | crisp |
| `BUILT WITH / CLAUDE` | 16 | 204 px | 41 px | 20% | dotted |
| `BUILT WITH / CLAUDE / IN BLENDER` | 26 | 215 px | 35 px | 16% | broken |

Cap height barely moves across those; the gap is what kills it. Past about ten
characters the strokes stop being strokes at this token count, whatever the
layout — so anything longer is set as type instead. That also keeps "entirely in
Blender" true of the finished frame rather than true of everything except the
frame.

`E_CREDIT_LINES` holds `(text, width, alpha, fade delay)` per line and
`E_CREDIT_GAPS` the clearance below each. Width sets size, which sets hierarchy.
Two things only the render showed: gaps of 0.042 m let one line's descenders
touch the next line's caps, and the block sat high enough to leave a dead third
at the bottom of frame.

## Not rendered here

**The film is not rendered in the container it was built in.** There is no GPU
there, so EEVEE falls back to llvmpipe at roughly 18 s a frame even at 960×540.
On an M-series Mac the same work measures **0.4 s a frame at 1920×1080** — the
45-frame 1D renders in 0.3 min, so all 360 frames is about two and a half
minutes. That ratio, roughly 200×, is why the render belongs on your machine and
only the construction belongs in the container.

What is built and inspected there: all five shots, and every named beat rendered
as a checkpoint still at 960×540 and looked at. Every check above runs clean on
every shot. Reviewing those stills is what found the bugs listed below — none of
them raised an error, and all of them survived being reasoned about.

## What the probe found

- **`Action.fcurves` no longer exists.** Layered actions mean curves are reached
  through `action.layers[…].strips[…].channelbag(slot).fcurves`.
- **`RenderSettings` has no `animation_data`.** Keyframing the shutter looks like
  it should live on `scene.render`; the curve actually lands on the *scene*,
  under the data path `"render.motion_blur_shutter"`.
- **`use_motion_blur` is not keyframeable, `motion_blur_shutter` is.** 1E is the
  only shot that changes blur mid-take, and it does it by driving the shutter to
  zero rather than toggling the flag.
- **Bloom is a compositor node group**, not a render property:
  `scene.compositing_node_group`. Glare settings are input sockets, so they are
  keyframeable, and the `Type` socket takes `"Bloom"`, not `"BLOOM"`.
- **The Glare node's `Size` socket does nothing under `Bloom`.** Measured on the
  brightest frame in the film, `Size` 1 and `Size` 9 produce identical pixels;
  `Threshold` 0.6 to 1.5 moves the frame by 0.011. `Strength` is the only lever
  that moves Bloom at all, and the numbers behind the value in `token_config.py`
  are in the comment above it. `Size` is a Fog Glow control.
- **Blender 5.2.1 ships NumPy 2; the `bpy` 5.0.1 wheel ships 1.26.** Anything
  NumPy 2.0 removed runs clean on the wheel and raises on the desktop build —
  and it raises *partway through a render*. `arr.ptp()` did exactly that: 1A
  through 1D rendered at 1920×1080, then 1E died on the line that logs the
  wordmark's size. `python3 token_config.py` now scans `token_build.py` for
  every name NumPy 2.0 removed and prints what to use instead. It needs no
  Blender, so it runs before the render rather than 285 frames into it.
- **No FFMPEG writer** in the `bpy` wheel or in Blender 5.2.1 LTS on macOS. Test
  it by assigning and catching the `TypeError`, whose message enumerates what the
  build really supports — `ImageFormatSettings.bl_rna` lists `FFMPEG` either way,
  because the class-level enum is not the instance's.

## Two bugs worth keeping written down

**`object.color` does nothing unless the material reads it.** The first pass used
a flat emissive material for the animated props, so every `object.color`
keyframe was silently ignored: 1A's caret never went out, 1C's core never
brightened, and 1E's shockwave never faded — it just grew to 46× and stayed.
Everything animated now goes through `shared_emit()`, whose node tree reads
`ShaderNodeObjectInfo → Color`.

**A text mesh's vertices are not ordered around the outline.** Sampling
the wordmark down the vertex array drew chords between unrelated points on
different letters, and 1E's payoff frame rendered as a horizontal smear with
swooshes through it. `wordmark_targets()` samples along `me.edges` by arc length
instead, which is where the real connectivity is, and distributes the 800 tokens
evenly rather than clustering them wherever the font needed control points.
