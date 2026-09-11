# Live package preview: inspection guides

Branch: `codex/package-preview-guides`. The existing package shapes, artwork mapping and export sizes are preserved.

## Controls

- **Measurements** adds dimension leaders that follow the package's external bounding box as the camera rotates. Width, height and depth remain readable below the preview even when a dimension is edge-on or its label would collide.
- **Grid** adds a calibrated grid in the camera's view plane and a scale bar. Grid spacing adapts to the package size and viewport. This is a visual scale reference, not a claim that the on-screen image is life-size.
- Labels use the same mm/inch selection as the dimension fields. Toggling aids or changing display units does not modify package geometry or assigned artwork.
- Both aids start off and are independent. They belong to the preview, not to the saved artwork project or delivered packshots.
- Bag dimensions describe the supplied external bounds of an illustrative shape, not film width, seam dimensions or a simulation of how the bag will fill.

## Technology

The interface is a React client component written in TypeScript within the Next.js application. Three.js creates the package geometry and WebGL renders it using the browser's graphics hardware. A rectangular carton uses measured box proportions; the pillow bag is a procedurally deformed segmented box.

Each assigned panel becomes a CanvasTexture with its own crop, rotation, fitting and background. The renderer uses an orthographic camera, standard materials and a small studio-light setup. PDF.js rasterizes uploaded PDF pages locally before they enter the same crop/texture workflow.

The new guides are drawn on a separate transparent 2D canvas. Camera projection aligns the leaders with the 3D model; a physical-to-world scale factor calibrates the grid and ruler. PNG export reads only the WebGL canvas, so guides cannot be baked into the seven exported views or images sent to Campaign Studio. Drawing happens on interactions and resize, with no continuous animation loop or paid API request.

This preview does not require a running Blender instance. AI is not used to redraw the artwork or calculate its dimensions. The entered measurements determine the geometry; confirming those measurements remains part of preparing the package.

## Verification

```sh
node scripts/check-preview-guides.cjs
node scripts/check-packaging.cjs
node scripts/check-package-presets.cjs
node scripts/check-campaign-handoff.cjs
npm run build -- --webpack
git diff --check
```

The guide suite passes 479 checks using real Three.js camera math and mocked browser canvases: physical scale, inches, extreme dimensions, bag bounds, label collisions, component lifecycle, unchanged textures, and export restoration after errors. Existing geometry, preset and Campaign Studio handoff checks pass.

Browser QA verified independent toggles, mm/inch labels, free rotation and fixed views, a cookie carton and pillow bag, and the 390px mobile layout with no horizontal overflow. All seven actual 1024px PNG outputs were byte-for-byte identical when rendered with guides enabled versus disabled. Toggling guides did not mark the artwork batch stale. No paid generation was used.
