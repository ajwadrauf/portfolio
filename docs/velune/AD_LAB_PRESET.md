# VELUNE Ad Lab preset — H3 revision 2

11 September 2026. **Load VELUNE example** creates a fresh `VELUNE v2 · 9-image working copy` with the new reference pack. It never generates, spends, overwrites an existing take or migrates a user's edited draft.

## Loaded configuration

- H3 Max Reference (`minimax/h3-max/reference-to-video`), 15 seconds, 16:9, 768p.
- Nine ordered JPEGs and the existing 15-second Blender guide: ten reference files in total, with no collage, portraits, report image or audio attachment added to the request.
- Full revised prompt and twelve scene cards, from `veluneAdContent.ts` and `veluneDirection.ts`. The downloadable master is built from the same source.
- External soundtrack selected; four scene voice lines, an 80 BPM music brief in five sections, and five effects with nine planned placements.
- Compose-to-scene-lengths and music-as-reference stay off initially. No first/end frame, generated music, generated effect or completed video is fabricated.

The prompt preserves the edit schedule and main camera moves while explicitly overriding the original opening/ending cast and framing, static working poses, two-piece serving and placeholder materials. It uses H3's `Image 1` / `Video 1` naming. The original Blender media, scene file and camera-study descriptions remain unchanged. General production planning uses the revised final-picture instructions.

H3 receives `reference_image_urls`, `reference_video_urls`, `reference_audio_urls`, integer duration, uppercase `768P`, `prompt_expansion_mode: balanced` and an enabled safety checker. It has no documented native-audio-off switch: quiet ambience is prompt guidance, and the native track is discarded during separate ElevenLabs finishing. The current 768p example estimate is about $3.63 using the app's 11 September pricing formula; actual provider billing can differ.

## Sound and graphics

The existing voice, music and effect timings remain a plan against the fifteen-second cut. Audition and align to the accepted picture. Loading a template does not generate sound. One carton tick can be reused for three placements.

The revised Centre Report SVG lives in the project's finishing documents and the downloadable pack. It pairs the individual carton photos with the three-centre serving. Exact headings are typeset. It is not sent as another H3 reference and is not automatically composited into a provider result. S11 and package lettering still require finishing review.

## Compatibility and verification

The original eight reference files remain on disk and in the API allowlist/dimension catalog. Old saved URLs are not replaced with v2 files. A fresh example uses versioned IDs and URLs, so new binding order does not change the identity of old references.

Checked: actual example hydration in the browser, nine image files plus one video, valid positional bindings, loaded 15s/16:9/768p H3 selection, separate sound plan, current download contents, original JPEG/Blender bytes retained, old URLs still submitted unchanged, and validation before paid submission. All automated provider calls are mocked. No paid render was run.

Run `check-velune-ad-preset.cjs`, `check-h3-video.cjs`, `check-ad-reference-submit.cjs`, `check-production-brief.cjs`, `check-connected-studio.cjs` and `check-campaign-workspace.cjs`, then `npm run build`.

The Seedance example toggle is deferred at the user's request. The archived Seedance master and existing model picker are not a revised Seedance example. Individual attachment tests can help isolate rejection, but do not guarantee that the combined images and unchanged Blender guide will be accepted.

References: [H3 schema](https://fal.ai/models/minimax/h3-max/reference-to-video/api), [H3 pricing](https://fal.ai/models/minimax/h3-max/reference-to-video).

## Provider limit correction

The first v2 request was rejected with `reference_image_urls max_length=9` (request `01a09361-ca68-7b42-ad06-80a9a95ea918`). The [full fal OpenAPI schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=minimax/h3-max/reference-to-video) confirms separate maxima: 9 images, 3 videos, 3 audio clips, plus 12 files combined. Both client ceilings and server validation now enforce these before submission.

The older whole bonbon and pistachio centre are omitted. All nine new stills remain. Image 7 supplies the whole bonbon shape; Image 6 supplies the solo left pistachio half and the three-flavour serving. References and filenames are consecutively renumbered. Loading a fresh example updates all bindings together; existing user drafts are not silently rewritten.

## Carton continuity and closing light revision

After review of the next H3 take, S02–S04 now require the finished photographic carton artwork for every frame of each turn. S04 explicitly excludes the guide’s shield/V artwork and tan proxy setting, and cuts directly to S05 at 2.875s. The guide supplies motion and timing only; it is never inserted footage.

S12 retains the approved composition. It starts warm and bright at 13.083s, gently dims the distant glow and environmental fill by roughly one stop from 13.500–14.700s, then holds the darker look through 15s. A soft product key and plate rim remain, keeping the three centres readable. This is lighting direction, not a fade to black. Images, cut schedule, model and sound plan are unchanged. Prompt guidance still needs verification in the next generated take.
