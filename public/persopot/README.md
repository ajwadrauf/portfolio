# Persopot card frames

The home page shows a three-frame strip on the Persopot card: one garment
reference and the same garment rendered on two trained identities. The point
it makes visually is the one the copy makes in words — one input, any number
of people.

Save the three files here, exactly these names:

| File          | What it is                                                               |
| ------------- | ------------------------------------------------------------------------ |
| `garment.png` | The source garment on its own — the forest green crew sweater on a hanger |
| `tryon-1.png` | That sweater rendered on the first trained identity                      |
| `tryon-2.png` | That sweater rendered on the second trained identity                     |

`.jpg` is fine too — change the extensions in `frames` in `src/app/page.tsx`
to match.

They render at roughly 90-160px wide in a row, so anything from about 400px
on the short edge is plenty. Crop them to a consistent shape before saving:
the strip sets `aspect-[4/3]` with object-cover, so portrait sources are
centre-cropped, and the two try-on frames should share the same framing as
each other or the row will look accidental.

Until all three are present the strip does not render at all — `page.tsx`
drops frames whose files are missing rather than showing broken images. So a
partial upload shows nothing, not a gap.
