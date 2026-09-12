# VELUNE Ad Lab preset — H3 revision 2

11 September 2026. **Load VELUNE example** creates a fresh `VELUNE v2 · working copy` with the new reference pack. It never generates, spends, overwrites an existing take or migrates a user's edited draft.

## Loaded configuration

- H3 Max Reference (`minimax/h3-max/reference-to-video`), 15 seconds, 16:9, 768p.
- Eleven ordered JPEGs and the existing 15-second Blender guide: twelve reference files in total, with no collage, portraits, report image or audio attachment added to the request.
- Full revised prompt and twelve scene cards, from `veluneAdContent.ts` and `veluneDirection.ts`. The downloadable master is built from the same source.
- External soundtrack selected; four scene voice lines, an 80 BPM music brief in five sections, and five effects with nine planned placements.
- Compose-to-scene-lengths and music-as-reference stay off initially. No first/end frame, generated music, generated effect or completed video is fabricated.

The prompt preserves the edit schedule and main camera moves while explicitly overriding the original opening/ending cast and framing, static working poses, two-piece serving and placeholder materials. It uses H3's `Image 1` / `Video 1` naming. The original Blender media, scene file and camera-study descriptions remain unchanged. General production planning uses the revised final-picture instructions.

H3 receives `reference_image_urls`, `reference_video_urls`, `reference_audio_urls`, integer duration, uppercase `768P`, `prompt_expansion_mode: balanced` and an enabled safety checker. It has no documented native-audio-off switch: quiet ambience is prompt guidance, and the native track is discarded during separate ElevenLabs finishing. The current 768p example estimate is about $3.69 using the app's 11 September pricing formula; actual provider billing can differ.

## Sound and graphics

The existing voice, music and effect timings remain a plan against the fifteen-second cut. Audition and align to the accepted picture. Loading a template does not generate sound. One carton tick can be reused for three placements.

The revised Centre Report SVG lives in the project's finishing documents and the downloadable pack. It pairs the individual carton photos with the three-centre serving. Exact headings are typeset. It is not sent as another H3 reference and is not automatically composited into a provider result. S11 and package lettering still require finishing review.

## Compatibility and verification

The original eight reference files remain on disk and in the API allowlist/dimension catalog. Old saved URLs are not replaced with v2 files. A fresh example uses versioned IDs and URLs, so new binding order does not change the identity of old references.

Checked: actual example hydration in the browser, eleven image files plus one video, valid positional bindings, loaded 15s/16:9/768p H3 selection, separate sound plan, current download contents, original JPEG/Blender bytes retained, old URLs still submitted unchanged, and validation before paid submission. All automated provider calls are mocked. No paid render was run.

Run `check-velune-ad-preset.cjs`, `check-h3-video.cjs`, `check-ad-reference-submit.cjs`, `check-production-brief.cjs`, `check-connected-studio.cjs` and `check-campaign-workspace.cjs`, then `npm run build`.

The Seedance example toggle is deferred at the user's request. The archived Seedance master and existing model picker are not a revised Seedance example. Individual attachment tests can help isolate rejection, but do not guarantee that the combined images and unchanged Blender guide will be accepted.

References: [H3 schema](https://fal.ai/models/minimax/h3-max/reference-to-video/api), [H3 pricing](https://fal.ai/models/minimax/h3-max/reference-to-video).
