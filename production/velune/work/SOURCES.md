# Sources and scope

Source choreography: the user's uploaded videoplayback (1).mp4 and the prior PRODUCTION_BRIEF.md supplied in this conversation. The new pack inherits its 360-picture / 24 fps conform and shot boundaries. It is a new creative adaptation, not a new claim to have verified the source audio. All VELUNE branding, flavour treatments, dialogue, music and effects are proposed original creative. The source index is supplied only for local shot-comparison reference.

Primary API documentation checked 2026-09-09:

1. Seedance reference-to-video schema: https://fal.ai/models/bytedance/seedance-2.5/reference-to-video/api
2. Seedance workflow and limitations: https://fal.ai/seedance-2.5
3. ElevenLabs v3 TTS endpoint: https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3/api
4. ElevenLabs Music schema: https://fal.ai/models/fal-ai/elevenlabs/music/api
5. ElevenLabs Sound Effects v2: https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2/api

Implementation notes: the current reference schema lists @VideoN / @ImageN syntax, while another overview uses bracket notation. This pack follows the schema's @ syntax. The checked schema permits up to 30 images and 50 files across modalities, reference videos of 1.8–30.2 seconds and generated durations 4–30 seconds. No dedicated camera-matrix, depth-map or normal-map input is advertised there. Documentation is not a guarantee that generated cuts or movement will match the guide.

The v3 TTS-specific input schema supports text, voice, stability, timestamps and language_code; the runner intentionally does not borrow speed/style parameters from other voice endpoints. A voice name/ID must be selected before execution. Music composition sections have a documented 3,000 ms minimum; use three longer musical sections, not one section per visual shot. Use composition_plan with respect_sections_durations, not the prompt-only force_instrumental field. Empty lyric arrays and negative vocal styles specify the instrumental intent; reject any unwanted singing during review. SFX generation duration must be at least 0.5 seconds; trim longer generated assets to picture-accurate lengths later.

API requests have not been submitted or tested against an authenticated account. Price, availability, terms and schema may change; recheck before spending generation credits. No claim is made that VELUNE or its tagline is globally unique or trademark-cleared.

Current Ad Lab route (11 September 2026): H3 Max Reference. Contract: https://fal.ai/models/minimax/h3-max/reference-to-video/api ; pricing: https://fal.ai/models/minimax/h3-max/reference-to-video . The current video direction is prompts/h3_max_master.txt; the existing ElevenLabs briefs and exact cue placements still apply.
