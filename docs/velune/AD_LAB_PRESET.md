# VELUNE Ad Lab production preset

11 September 2026. “Load VELUNE example” at the top of Studio creates a new project copy. Ad Lab now hydrates that copy with the complete run-pack Seedance prompt, one Blender motion video and eight appearance images in their declared order.

The defaults are Seedance 2.5 Reference, 15 seconds, 16:9, 720p and Silent. Exclusions are in the prompt. No product-first-frame image, end frame, generated media, request handles or paid work is fabricated or resumed. Existing saved projects keep their drafts.

Sound starts with the named VELUNE 15-second plan: five three-second musical groups at 80 BPM, external ElevenLabs narration, Rachel/Natural audition settings, four script lines and absolute voice windows. The music brief is already populated. Composition-to-plan and audio-reference upload stay off until the user deliberately enables them; composition continues to select Layered as in the existing workflow.

| Voice | Start | Target end |
| --- | ---: | ---: |
| What's within? | 7/24 | 29/24 |
| Something wonderful. | 79/24 | 110/24 |
| Velune. The Centre Report. | 249/24 | 298/24 |
| Wonder within. | 322/24 | 351/24 |

Five reusable effect prompts include individual generation lengths and nine editorial placements. The carton and ingredient ticks reuse one recorded take across their three positions. Local finishing receives the planned timing when the user adds ready takes; mock output remains excluded. Windows are editable and require auditioning so the mix does not truncate words. Existing mix tracks are not silently repositioned.

The obsolete cookie “Load the worked example” button and its unused handler were removed from the Your prompt header. Text-file import remains. The cookie example source remains available to other pages that use it.

The canonical current preset content is `src/lib/veluneAdContent.ts`; the prompt also matches `production/velune/work/prompts/seedance_master.txt`. The Ad Lab music brief is preserved in `production/velune/work/prompts/adlab_music_brief.txt`. The older three-section production score is a separate option, not the UI template.

Validation: offline preset/schema/reference/placement checks, existing sound/draft/project tests, production build, and browser checks of loading and restoring the example. Loading the preset has no generation side effects.
