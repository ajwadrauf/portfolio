# Home page output strip

This folder holds the finished work that appears at the top of ajwadrauf.com,
directly under the hero — before any of the writing.

**Why it matters more than anything else on the page.** The role asks for
exceptional craft, conceptual thinking and visual storytelling. Without this
folder the home page is an argument about production systems with no
production in it, and the actual output sits two clicks deep behind a
passcode that most readers will never enter.

## What to add

Generate them in the Ad Lab and Packshot Studio, download, and drop the files
here. The names below are what `src/lib/showcase.ts` currently expects — change
either side, as long as they match.

| File | What it should be |
|---|---|
| `reverse-rewind.mp4` + `reverse-rewind.jpg` | The 14s reverse-assembly cut, 9:16 |
| `anti-gravity.mp4` + `anti-gravity.jpg` | The anti-gravity assembly, 9:16 |
| `packshot-grid.jpg` | Planogram angles, square |
| `bilingual-tile.jpg` | An EN/FR promo tile, 4:5 |

The `.jpg` beside each `.mp4` is its poster — the frame shown before the clip
plays. Export one from the render; without it the tile is a grey box until the
video loads.

## Rules the code enforces

- **Missing files are dropped, not rendered.** Anything in the manifest whose
  file is not here at build time is filtered out. If none exist, the whole
  section disappears rather than showing broken frames to a recruiter.
- **Detection happens at build time**, because the home page is prerendered.
  Adding a file needs a rebuild — pushing to Vercel does that anyway, but
  locally you need to restart `next dev`.
- **Motion plays only while on screen**, and respects `prefers-reduced-motion`
  by showing the poster with a play control instead.

## These have to be committed

Vercel builds from git, so a file that only exists on your Mac will never
appear on the live site. Add them, commit them, push. They are deliberately
**not** gitignored for that reason — which is also why the size limits below
matter: git keeps every version of a binary forever.

## Keep them small

These load before anything else on the site, so they set the first-impression
speed.

- Clips: **under ~3MB each.** Trim to the strongest 5–8 seconds — nobody
  watches a full 14s loop in a grid, and the point is the craft, not the
  duration.
- Stills: **under ~400KB.** Export at roughly 2× the displayed size; the tiles
  render around 350px wide at most.

```bash
# Trim and compress a clip for the strip
ffmpeg -i in.mp4 -t 6 -vf "scale=-2:1280" -c:v libx264 -crf 30 -an out.mp4

# Pull a poster frame from it
ffmpeg -i out.mp4 -vf "select=eq(n\,0)" -q:v 3 out.jpg
```

`-an` drops the audio deliberately: the tiles are muted, so the track is bytes
nobody hears.

## Captions

Each entry carries a model and a cost in `src/lib/showcase.ts`. Keep them
accurate — the claim being made is not "this looks good" but "this looks good,
made this way, for this much, repeatably." A wrong number there undercuts the
one thing the rest of the site is careful about.
