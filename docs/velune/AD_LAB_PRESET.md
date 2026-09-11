# VELUNE Ad Lab production preset

11 September 2026. “Load VELUNE example” at the top of Studio creates a new project copy. Ad Lab now hydrates that copy with the complete H3 Max prompt, one Blender motion video and eight appearance images in their declared order.

The defaults are H3 Max Reference, 15 seconds, 16:9, 768p and External soundtrack. Exclusions are in the prompt. No product-first-frame image, end frame, generated media, request handles or paid work is fabricated or resumed. Existing saved projects keep their drafts.

Sound starts with the named VELUNE 15-second plan: five three-second musical groups at 80 BPM, external ElevenLabs narration, Rachel/Natural audition settings, four script lines and absolute voice windows. The music brief is already populated. Composition-to-plan and audio-reference upload stay off until the user deliberately enables them; composition continues to select Layered as in the existing workflow.

| Voice | Start | Target end |
| --- | ---: | ---: |
| What's within? | 7/24 | 29/24 |
| Something wonderful. | 79/24 | 110/24 |
| Velune. The Centre Report. | 249/24 | 298/24 |
| Wonder within. | 322/24 | 351/24 |

Five reusable effect prompts include individual generation lengths and nine editorial placements. The carton and ingredient ticks reuse one recorded take across their three positions. Local finishing receives the planned timing when the user adds ready takes; mock output remains excluded. Windows are editable and require auditioning so the mix does not truncate words. Existing mix tracks are not silently repositioned.

The obsolete cookie “Load the worked example” button and its unused handler were removed from the Your prompt header. Text-file import remains. The cookie example source remains available to other pages that use it.

The canonical current preset content is `src/lib/veluneAdContent.ts`; the prompt also matches `production/velune/work/prompts/h3_max_master.txt`. The Ad Lab music brief is preserved in `production/velune/work/prompts/adlab_music_brief.txt`. The older three-section production score is a separate option, not the UI template.

Validation: offline preset/schema/reference/placement checks, existing sound/draft/project tests, production build, and browser checks of loading and restoring the example. Loading the preset has no generation side effects.

## H3 Max integration (11 September 2026)

The route is `minimax/h3-max/reference-to-video`, using the existing `FAL_KEY`. Optional endpoint override: `FAL_H3_MAX_REF_ENDPOINT`. The image-to-video endpoint cannot replace this route: VELUNE uses eight images plus the 15-second Blender guide.

The request uses `reference_image_urls`, `reference_video_urls`, `reference_audio_urls`, integer `duration`, uppercase `768P`, `prompt_expansion_mode: balanced`, and `enable_safety_checker: true`. It sends no Seedance aliases, `generate_audio`, end-frame field or separate negative prompt. Exclusions remain in the prompt. H3 prompt references read `Image 1` and `Video 1`; stored binding IDs stay stable and are formatted for the selected model.

Before a paid submission, both form and route check 5–15 whole seconds of output, at most 12 combined reference files, each video/audio clip 2–15 seconds, and at most 15 seconds total per temporal modality. Audio requires a visual reference. Custom input dimensions and durations must be measured; the bundled VELUNE media uses its verified catalogue metadata. No excess references are silently removed.

H3 has native audio and no documented API mute switch. External soundtrack requests no speech/music and minimal native ambience, then the native track is discarded in the edit. It does not generate ElevenLabs files automatically. Audition voice; generate picture; settle the edit; compose the instrumental score; generate and place spot effects; render the mixed WAV in Local finishing; combine that WAV with picture in an editor. The original MP4 download retains its original audio. A picture retry should use External soundtrack again to avoid starting a new score.

At current list rates, this 15-second 768p example estimates about $3.60 including reference inputs, excluding ElevenLabs. 480p estimates about $1.78. 1080p output costs $0.16/s; its reference-video estimate uses the 768p source rate because fal does not publish a separate 1080p input table. The UI labels that assumption. No launch discount is assumed.

Existing project copies, generated audio and saved drafts are not overwritten. Click **Load VELUNE example** to create a fresh H3 copy. The old `seedance_master.txt` remains an archived alternative; `h3_max_master.txt` and `VELUNE_H3_PROMPT` are the current Ad Lab direction. A successful moderation decision, exact cut timing and final visual quality still require an actual generation and review. Implementation tests make no paid requests.

Sources: [H3 API contract](https://fal.ai/models/minimax/h3-max/reference-to-video/api), [H3 reference pricing](https://fal.ai/models/minimax/h3-max/reference-to-video).
