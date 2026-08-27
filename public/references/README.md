# Starter motion references

Four abstract clips the Ad Lab offers as ready-made motion references, plus a
still frame for each. They are served from this site rather than uploaded, so
they cost nothing per use and never expire the way a storage URL does.

Expected files — the names are matched exactly by `src/lib/referenceClips.ts`:

| Clip | Video | Poster |
|---|---|---|
| Orbital drift | `orbital-drift.mp4` | `orbital-drift.jpg` |
| Pulse grid | `pulse-grid.mp4` | `pulse-grid.jpg` |
| Liquid bloom | `liquid-bloom.mp4` | `liquid-bloom.jpg` |
| Light sweep | `light-sweep.mp4` | `light-sweep.jpg` |

Anything missing shows as a labelled gap in the picker rather than a broken
player, so partial installs are fine.

## What makes a good one

Abstract, and that is the whole point. The model reads a clip's camera move,
cutting rhythm and energy, then applies them to your product — so a reference
with no subject in it has nothing to leak into the render. A clip of someone
holding a bottle will put their hand in your ad.

- **4-6 seconds.** These models read the move, not the content. Longer buys
  nothing and costs upload time.
- **Under 4MB.** The same cap the upload route enforces, so the two paths
  behave alike.
- **720p is plenty.** It is a motion reference, not footage.
- **No text, no faces, no recognisable products.**

## Posters

A single representative frame, same aspect as the clip. The picker shows it
before hover so the grid is not four black rectangles on load, and sets
`preload="none"` so nothing downloads until someone actually hovers.

## Licensing

Whatever you put here is served publicly from ajwadrauf.com, which is a
different act from using a clip inside a rendered output — most stock
licences distinguish between the two, and some prohibit redistributing the
original file. Worth a glance at the licence before adding anything bought.
Abstract motion is also cheap to originate: a few seconds of shader output or
a simple After Effects loop sidesteps the question entirely.
