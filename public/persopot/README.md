# Persopot card frames

The home page shows a three-frame strip on the Persopot card: one garment
reference and the same garment rendered on two trained identities. It makes
the point the copy makes in words — one input, any number of people.

## Right now they load from persopot.com

The card declares each frame with a local path and a `hosted` fallback:

```
src:    /persopot/garment.jpg
hosted: https://persopot.com/marketing/home/outfit-source.jpg
```

The local file wins whenever it exists. Until then the frame is served from
persopot.com, so the strip works today with nothing committed here.

## Committing local copies is better

Hotlinking couples this site to persopot.com's asset paths. If those move or
that deployment changes, the frames break here with no warning — and the
portfolio is the thing that needs to be reliable. Local copies also load
faster and survive persopot.com being down.

Save these three, and they take over on the next build:

| File          | From                                              |
| ------------- | ------------------------------------------------- |
| `garment.jpg` | `persopot.com/marketing/home/outfit-source.jpg`   |
| `tryon-1.jpg` | `persopot.com/marketing/home/outfit-result-1.jpg` |
| `tryon-2.jpg` | `persopot.com/marketing/home/outfit-result-2.jpg` |

Take the originals at those paths rather than the `/_next/image?...&w=256`
versions, which are resized for the marketing page.

## Sizing

Frames render about 90–160px wide, so roughly 400px on the short edge is
plenty. The strip is `aspect-[4/3]` with object-cover, so portrait sources are
centre-cropped — crop the two try-on frames to the same framing as each other
or the row looks accidental.

A frame with neither a committed file nor a `hosted` URL is dropped, and a
strip left with no frames disappears rather than leaving a gap.
