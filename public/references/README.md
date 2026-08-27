# Starter motion references

Four abstract clips the Ad Lab offers as ready-made motion references, plus a
still frame for each. They are served from this site rather than uploaded, so
they cost nothing per use and never expire the way a storage URL does.

Expected files — the names are matched exactly by `src/lib/referenceClips.ts`:

| Clip | Video |
|---|---|
| Orbital drift | `orbital-drift.mp4` |
| Pulse grid | `pulse-grid.mp4` |
| Liquid bloom | `liquid-bloom.mp4` |
| Light sweep | `light-sweep.mp4` |

The MP4 is the only file needed. Cards autoplay muted once they scroll into
view, so the clip is its own preview.

Anything missing shows as a labelled gap in the picker rather than a broken
player, so partial installs are fine.

**Which files exist is read at build time**, because the Ad Lab prerenders.
`npm run dev` re-checks on every request so a clip appears as soon as you drop
it in, but a production server needs a rebuild — deploying picks it up because
the build runs then anyway. If a clip you have added is still showing as
missing, that is why.

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

## Do not add GIFs

A GIF of the clip seems like the obvious preview and is the one thing that
cannot work: the `poster` attribute renders a **static** image whatever you
hand it, so a browser draws frame one of the GIF and stops. You would pay
20-35MB per clip to display what a 40KB JPG displays.

It is also the wrong direction on size. A GIF has no interframe compression,
which is why the same few seconds runs 20MB as a GIF and 2MB as an MP4 — the
format you already have is the smaller one and the only one that moves.

An optional `<name>.jpg` still frame is supported and covers the instant
before the first frame decodes, but it is genuinely optional; without it the
video shows its own opening frame.

## Weight

Nothing loads until a card scrolls into view, and playback pauses when it
leaves, so a visitor who never reaches the References step downloads none of
it. Still worth keeping each clip near 2-3MB: on a Mac, QuickTime's
File > Export As > 720p re-encodes a heavy file down in one step.

## Licensing

Whatever you put here is served publicly from ajwadrauf.com, which is a
different act from using a clip inside a rendered output — most stock
licences distinguish between the two, and some prohibit redistributing the
original file. Worth a glance at the licence before adding anything bought.
Abstract motion is also cheap to originate: a few seconds of shader output or
a simple After Effects loop sidesteps the question entirely.
