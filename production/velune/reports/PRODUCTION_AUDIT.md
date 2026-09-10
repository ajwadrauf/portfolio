# VELUNE production audit — 10 September 2026

**Current gate:** prepare and review the actual Blender camera pass. No paid generation, external asset upload, selected voice, approved appearance library or final film exists. The source package is preserved. The working copy is `velune-production/work`; this report does not supersede the live Blender render report.

## What is actually present

The source contains a detailed 12-shot adaptation, 360-picture edit map, 16 design targets, 30 pose targets, flat SVG/PNG package fronts, a printed-report concept, title overlays, a Blender generator and audio/API templates. Of the 16 design targets, only **D01** (flat carton fronts) and **D15** (report concept) are supplied. The other 14 design images have not been created. All **30 camera poses have now been rendered** as provisional PNGs under `work/blender/renders/keyframes/pose_NNN.png`. They establish framing and motion, but are not approved appearance references. The manifest’s `references/approved/` pose paths remain future beauty-reference targets; a locally rendered camera pose must not be mislabelled as approved. The supplied report and boxes use illustrated placeholder food art. `references/source_choreography_index.jpg` is a 30-image local contact sheet of the old reference; no original reference clip/audio was observed. It must not enter fal uploads or portfolio assets.

Blender has now run successfully and produced actual `.blend` files plus all 30 camera-pose images. A complete, silent 15-second guide is currently rendering at 1920 × 1080; it is not marked complete or approved in this audit. Confirmed environment: Blender 5.2.1 LTS, Apple M4 Pro with a 16-core Metal GPU and 24 GiB RAM, approximately 91 GiB free disk at start, FFmpeg 9.0.1, Python 3.12.8. EEVEE at 960 × 540 with 32 samples rendered representative frames in under a second each. Blender's local hardware initialization needed approved process escalation after a sandbox crash; it then ran successfully. The main agent repaired the EEVEE engine name, layered-action curves, cut shell/filling geometry, ingredient contact, lighting and deterministic camera-space titles; the spread is being corrected separately. These are camera-preview improvements, not proof of photoreal final quality or camera approval.

`production_status.json` records the input inventory and hashes. It is a dated snapshot; do not treat its camera/finish status as newer than a later reviewed render.

## Timing and references

The integer timeline is coherent: 12 shots, 11 cuts, 360 pictures at 24 fps. S11/report gets 72 frames; S12 gets 46 frames; the mixed soundtrack must contain 720,000 samples per channel at 48 kHz. Keep the original cut map. In particular, do not submit a 9-frame carton clip as if it met the provider's minimum reference length.

The optional repair-guide helper now creates 4-second, 96-frame single-setup clips with 12 leading hold frames, the original action, and trailing holds. S11 is skipped. It writes unapproved shot-specific job files and prompts under `work/studio/shot_jobs`, so a repair no longer accidentally uses the 15-second master instruction. The runner validates 96-frame repairs separately from the 360-frame master. Guide creation itself is local and free. Matching an AI take to its nominal trim remains a visual/editing task.

The package's suggested full-film appearance bundle (D03, D04, D06, D08, D09, D10, D12) is only a starting subset. It omits carton identity and natural ingredient references. Before each job, bind a small purpose-specific set explicitly:

| Setup | Relevant design references after approval | Motion/pose authority |
|---|---|---|
| Opening/ending tunnel | D08 host, D10 tunnel, D16 ending | P01–P03, P29–P30; preserve same person |
| Three cartons | D01 fronts, D02 three-quarter/back | P04–P06; deterministic lettering, identical geometry |
| Question/spread | D03 master bonbon + approved spread look developed from Blender | P07–P14; exact 12-piece silhouette and timed merge |
| Macro centre | D04 cut half, D08/D09 people, D11 assembly | P15–P17; stable fork, moving background |
| Studio pullback | D03 bonbon, D09 wardrobe/identity, D12 set | P18–P22; three left/two right, real camera translation |
| Ingredients/serving | D13 raspberry, D14 pistachio, D06 caramel, D03 shell | P23–P26; stable contact and two-piece serving |
| Report | D15 updated with approved rendered product art | Deterministic surface; bypass generative lettering |

Do not attach all 46 targets by default. The 30 current camera poses were rendered locally and did not require paid image generation. After the camera pass is approved, appearance refinement should preserve that composition. Unseen sides/back of cartons remain a design task. Fictional performers need approved identities; crude rig renders cannot establish final skin/hair detail.

## Verified provider plan and budget

Public official fal documentation was fetched on 10 September 2026, with no credentials or paid calls. Local source snapshots are under `reports/provider-docs`. Availability in documentation does not establish account access, balance, live reliability or output quality.

| Function | Endpoint | Current documented basis |
|---|---|---|
| Guided video | `bytedance/seedance-2.5/reference-to-video` | 4–30 second output; 480p/720p/1080p; video references 1.8–30.2 seconds each and 30.2 seconds combined |
| Music | `fal-ai/elevenlabs/music` | $0.60 per output minute, rounded up; composition sections 3,000–120,000 ms |
| Voice | `fal-ai/elevenlabs/tts/eleven-v3` | $0.10 per 1,000 characters; stock voice/name, stability, timestamps, language, text normalization |
| Effects | `fal-ai/elevenlabs/sound-effects/v2` | $0.002 per second; 0.5–22 seconds |

All four endpoints use a server-side `FAL_KEY`; no separate ElevenLabs key is needed. A presence-only check found no `.env.local` file in either pre-existing `portfolio-cream-film` or `portfolio-review`. The previous local health server on port 3029 was not running. Local credential presence therefore remains unverified; this does not establish whether the deployed website is configured. No credential values were printed or copied, and no authenticated generation was attempted.

**Video references are billable too.** At 720p the documented rough reference-video rate is $0.2838 per input/output video second. A 15-second guide plus 15-second output therefore estimates $8.514, including both input and output. Prices are USD estimates; tokens/output dimensions and current billing can differ.

| Proposed paid stage | Estimated generation cost |
|---|---:|
| One 15-second full-guide appearance test at 480p | $3.97 |
| One 15-second full-guide appearance test at 720p | $8.51 |
| One 15-second full-guide appearance test at 1080p | $20.95 |
| One 4-second repair using a 4-second guide at 720p | $2.27 |
| One 15-second structured instrumental score | $0.60 |
| Four narration lines, 74 characters total | $0.0074 |
| All 10 listed effects, 7.6 generated seconds total | $0.0152 |
| One 720p full test + one score + all proposed voice/effects | **$9.14** |
| The same, with 25% planning reserve | **$11.43** |
| Above plus two 720p repair takes and one extra score | **$14.28** before reserve; **$17.85** with 25% |

The 480p test is a cheaper motion/identity experiment, not a 1080p deliverable. A 720p plate upscaled into a 1920 × 1080 master is still sourced from 720p. Do not describe upscale as native 1080p. Do not generate eleven repairs automatically; determine which shots need them after the first comparison. Producing all eleven at 720p adds roughly $24.97. Image generation, storage, taxes and provider/account adjustments are excluded because no image model/quantity has been selected. Their cost needs a separate explicit estimate before purchase. Recheck provider rates immediately before spending if the run happens later.

Sources: [Seedance reference schema and pricing](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video/llms.txt), [Music schema and pricing](https://fal.ai/models/fal-ai/elevenlabs/music/llms.txt), [Music nested OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/elevenlabs/music), [Voice schema and pricing](https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3/llms.txt), [Effects schema and pricing](https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2/llms.txt).

## Audio production decisions

The existing score plan is valid: 4,708 + 5,375 + 4,917 = 15,000 ms, with all three sections above 3 seconds. Keep those longer musical sections rather than trying to create a 9-frame music section. At 80 BPM, each carton lasts half a beat; the rest of the edit does not share that grid. Let small separately placed effects accent selected cuts. Music section timing does not guarantee that the model will place a particular beat on a particular picture.

`force_instrumental` is documented for prompt-mode music only. The structured plan correctly omits it, uses empty `lines` arrays and negative vocal styles. Narration must never go into those lyric arrays. Listen for unwanted vocals and creative quality before using a take. Keep musical decay within 15 seconds and duck around the four voice windows.

Audition VO03 first after stock-voice approval: “Velune. The Centre Report.” has only 2.04 seconds, including a natural pause. The model payload has no duration/speed field. Check actual pronunciation of veh-LOON and intelligibility. If too long, ask for a shorter script or simpler “Velune.” take; do not silently accelerate it. A voice direction note in JSON is not automatically sent as acting instruction, pronunciation markup or spoken words. Four separate takes allow timing corrections but need consistency review with one selected voice.

The whole soundtrack is voiceover, not actor lip-sync. Generate picture without native audio as already planned; keep narration, score and effects separate until an editor mixes them. Use FX02, FX03 and FX07 as reusable ticks, not a separate paid request per repeat. FX01/05/09/10 are optional; omit taste contact if the approved picture does not show it. Avoid cartoon over-scoring all 12 appearances.

## Repairs made in the working utilities

- Replaced blocking `subscribe` with a durable queue receipt: planned inputs/cost before submission, request ID immediately on acceptance, and explicit GET-only resume. Status failure never triggers a new paid POST.
- Added exact-input SHA-256 approval, a no-spend default approval record, duplicate-plan protection, sequential submission lock and conservative 25% budget reservation. Uncertain submission outcomes remain recorded and require dashboard reconciliation. No budget is silently refunded on a failure.
- Added validated 4-second repair jobs alongside the 15-second master. External source artwork is rejected as an appearance input. Existing source files are untouched.
- Removed automatic silent padding of short mixes from the conform utility. It now refuses incomplete audio and checks decoded picture/sample counts, not only container duration. It still does not judge the edit, mix or perceived sound.

The runner is a local fallback, not an additional website integration. Its private receipts are not synchronized to Ad Lab history; choose one route for each paid take. `work/studio/README_EXECUTION.md` gives dry-run, approval and resume instructions. No execute command was run.

## Review checklist

Completed: source/inventory audit; provider schema/pricing audit; dry runs of four job types; offline runner validation; all 11 repair sequence frame-map checks; synthetic short-audio rejection; Python syntax checks. Main Blender execution and visual corrections are being recorded by the camera workstream. The website workstream is preparing a truthful provisional concept case study.

Next: inspect the complete 360-frame camera pass and key silhouettes; resolve framing/pose changes; approve or revise product/performer/look references; select a stock voice; show the precise upload list and total budget; obtain approval before any paid stage; compare each generated plate against Blender; place separate audio stems; validate/listen to the final master; review portfolio before publishing.

No final commercial, appearance approval, audible quality review, authenticated provider success, paid spend, public upload or deployment is claimed by this audit.
