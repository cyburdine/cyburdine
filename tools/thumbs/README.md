# Gallery thumbnail plates

The eight project tiles on the home page do not use a crop of the article's
hero photo. Each is a designed 1600x900 plate: the subject cut out on THE
BOOTH's field, the project's name set huge behind it, and a name / rule /
meta lockup in IBM Plex.

The Таксофон plate was built this way by hand and the harness was thrown
away with the scratch directory, so the next change to it meant rebuilding
the whole thing from the JPEG. This directory is that harness, kept.

```
./build.sh                     render every plate
./build.sh replay pagepress    render some
python3 -m http.server 8792 --directory out   # then open /contact.html
```

Output lands in `site/assets/images/articles/<slug>-thumb.webp`.

## What is here

| | |
|---|---|
| `plates/<slug>.html` | one document per plate; the design decisions specific to that plate are commented in its own `<style>` |
| `plate.css` | the shared design — field, ghost, subject, lockup — and why each part is shaped the way it is |
| `matte.js` | the background knockout: an edge-in flood fill with erode and feather |
| `build.sh` | renders each plate in headless Chrome and encodes to webp |
| `sources/` | application captures that exist nowhere else in the repo |
| `photos/` | symlink to `site/assets/images/articles`, so plates can reuse article photography |
| `out/` | rendered PNGs and `contact.html`, the proofing view. Not deployed |

## Three things that will bite

**Proof at tile size, not plate size.** A tile renders at about 272px
through `grayscale(.55) brightness(.82)` and a 1px scanline grid. A plate
balanced to look right on its own goes muddy in the grid, and any detail
finer than the lockup disappears entirely — an earlier pass had a
label/value HUD in the corner that turned to grey mush. `out/contact.html`
shows both sizes side by side for exactly this reason.

**No scanlines in a plate.** `.cy-project__media::after` already lays a
grid over every thumbnail. A second grid at the plate's own pitch moirés
against it.

**Re-rendering a live plate needs a new filename.** Images ship stable
names under `Cache-Control: max-age=604800`, `deploy.sh` only cache-busts
`/assets/{css,js}`, and there is no Cloudflare purge in this pipeline. The
first build of a `-thumb.webp` is free because the URL is new; changing one
that has already shipped and deploying it in place serves the old bytes
from the edge for up to a week. Rename it (`-thumb2.webp`) and update
`site/index.html`. `build.sh` deliberately does not hash the filename — that
would move the URL on every antialiasing wobble.

## Adding a plate

Copy the closest existing `plates/*.html`, point it at a source, and pick
the ghost/lockup text. Then decide how the subject gets isolated — there
are three answers in here and the right one depends on the photograph:

- **flood-fill matte** (`data-matte` on the `<img>`) when the background is
  a connected region touching the frame edge: the camera on the floor, the
  figure on the cyclorama, the popup on its flat backdrop. Tune `tol` (drift
  from the accepted neighbour — lets the fill ride a gradient) against
  `hardTol` (drift from the seed colour, ever — stops it eating the subject).
- **`clip-path`** when the subject is a simple geometric shape and the
  background is not separable by colour. Firepype's rack has status LEDs
  sitting as far from the dark background as the bright drive does; no
  tolerance splits them, and the drive is a quadrilateral.
- **neither**, when the frame has no subject in it at all. Spirefall is a
  full alley scene; it keeps the photo as the field, graded toward the
  palette, and takes the same lockup. Inventing a silhouette there would
  have been worse than admitting the exception.

Then add the tile to `site/index.html` — and remember the gallery header's
`// NN records` count is hardcoded.
