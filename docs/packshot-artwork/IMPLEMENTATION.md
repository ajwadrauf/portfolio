# Packshot artwork implementation

Implementation branch: `codex/packshot-artwork`, based on production `ba82c0f`. Production branch: `claude/loblaw-ai-content-studio-701jhf`.

## Implemented scope

The packshot studio now has a **From artwork / dielines** workspace alongside the existing photo workflow. Photo mode remains the initial selection. Artwork mode maps locally prepared panel images onto a measured rectangular carton using Three.js; it makes no generative image request.

Supported inputs are PDF, PNG, JPEG and WebP. PDF pages render in the browser through a same-origin PDF.js worker. Users select a page, crop each printed panel, and assign it to front, back, left, right, top or bottom. Face controls support clockwise quarter-turn rotation, contain/cover fitting and a background color. Unassigned faces stay the selected plain box color.

The carton accepts width, height and depth in millimetres or inches, stored canonically in millimetres. The editable starting dimensions are an example, not measurements extracted from the source. Matte and satin settings adjust the material preview.

The preview supports drag, arrow keys, rotation buttons, seven named views and reset. Front, back, left, right, top, bottom and a front/right/top hero export as square PNGs at 1024, 2048 or 4096 pixels, subject to the browser's graphics limits. All seven views use a common orthographic scale and white background. Individual PNG downloads and a ZIP with a configuration/source-crop manifest are available. Saved box-project JSON files retain assigned panel images and settings; original source files must be retained separately for future recropping.

## Workflow

1. Open **From artwork / dielines** and import the original PDF or image.
2. Choose a page and crop only the printed panel. Exclude proof notes, dimensions, color bars, cutting guides and bleed. Assign the crop to the intended face; repeat for other faces.
3. Enter confirmed assembled box measurements and select the finish and plain-face color. A proof's page dimensions do not determine the box dimensions.
4. Inspect every face in the preview. Correct rotation, fit and backgrounds; verify any remaining plain faces are intentional.
5. Choose an output size and render the seven views. Changes to geometry or face artwork mark earlier results as stale.
6. Review and download the PNGs/ZIP. Save a box project to keep the assigned artwork. The optional photo-workflow handoff uses the six face renders as references; subsequent AI generation is a separate operation and can alter printed details.

## Limits and local data

- Geometry is a rectangular box. Cylinders, pouches, irregular wraps, tapered cartons, bevels, board thickness, physical folds and closure flaps are not modelled.
- Cropping and face assignment are manual. There is no automatic dieline unfolding, dimension extraction, panel recognition or proof-cleanup guarantee. Anything retained in the crop appears in the texture.
- Original artwork is sampled into textures, not redrawn by AI. Browser rasterization, resampling, lighting and material shading still affect rendered pixels. This is not an exact print-color proof, physical-packaging validation, barcode certification or retailer/compliance certification.
- Artwork files are limited to 40 MB each, 50 PDF pages, 12 sources and 120 MB of total sources. Images are limited to 80 megapixels; prepared panel images have a maximum side of 4096 pixels. A small raster source cannot gain additional detail from a larger export.
- Source files, PDF rendering, crops, box rendering, ZIP generation and project save/open run locally in the browser. The artwork workflow does not upload the source files or make paid AI calls. Generated local assets persist only in the current session unless downloaded. Switching modes preserves the mounted artwork session; a page reload does not.
- Choosing the optional AI/photo workflow is a separate path: its generated requests use the selected reference renders. Preserve the local PNGs as the deterministic artwork-mapped originals.
- WebGL is required. A failed or lost graphics context displays a retry action; unsupported output sizes report an error instead of silently returning a smaller image.

## Key files

| File | Responsibility |
| --- | --- |
| `src/app/ai-studio/packshots/PackshotStudio.tsx` | Mode switch, preserved photo workflow, optional reference handoff |
| `src/components/packshots/ArtworkStudio.tsx` | Source/page/crop UI, face assignment, dimensions, project files and exports |
| `src/lib/artwork.ts` | Local image/PDF loading, original-source crops and download helpers |
| `src/lib/packaging.ts` | Shared contracts, measured geometry, face orientation, coverage and manifest |
| `src/components/packshots/BoxPreview.tsx` | Client lifecycle, lazy renderer, interactive controls and export ref |
| `src/components/packshots/box-renderer.ts` | Three.js textures, cameras, material settings, PNG capture and cleanup |
| `public/pdf.worker.min.mjs` | Same-origin PDF.js worker matching the installed package |

## Verification

```sh
node scripts/check-packaging.cjs
node scripts/check-packshot.cjs
node scripts/check-artwork.cjs
node scripts/check-ad-audio.cjs
node scripts/check-ad-preflight.cjs
npm run build -- --webpack
git diff --check
```

`check-packaging.cjs` passes 618 offline checks against the installed Three.js BoxGeometry: measured ratios, material assignment, actual UV orientation on all six faces, seven-angle framing for tall/wide/cubic fixtures, rotation/fit math and manifest coverage. `check-packshot.cjs` passes 36 photo prompt/size/route checks with mocked providers. `check-artwork.cjs` uses real PNG and PDF pixels to verify original-resolution crops, pages, bounds, cancellation and local download helpers. Audio and preflight regression checks pass with mocked providers. Production build passes.

Browser QA on the local app verified image and two-page PDF intake, page selection, numeric crops, front/right/top mapping and readable orientation, millimetre/inch conversion, seven 2048px PNG results, blank-face labels, invalid-dimension blocking, mode retention, stale-render notices, reference transfer, the full-size source dialog and six free demo results. Demo results cannot be marked reviewed or sent to paid finishing. Mobile 390px and desktop 1440px layouts have no horizontal overflow. The browser console reported no errors. Local health confirmed all provider keys absent; no paid requests were made.

ZIP/project buttons completed without application errors, but the in-app browser did not expose a completed download event or saved file. A physical browser download/project round-trip was therefore not confirmed in this environment. Automated tests cover the local export helper; broader browser downloads and WebGL context-loss recovery remain manual follow-up checks.

The public worker is copied from `node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs`. Keep it in sync when upgrading PDF.js; the legacy build includes compatibility polyfills while remaining lazy-loaded.

Preview buttons have explicit minimum targets of 29 × 29 pixels for rotation/reset, 39 × 32 pixels for view selectors, and a 32-pixel minimum height for retry. Every preview control supports keyboard focus; the canvas accepts arrow keys and Home for reset.
