# VELUNE generation checkpoints

The portfolio repository and Ad Lab remain the normal review interface. This small local runner is an optional production fallback, with the same fal-hosted Seedance/ElevenLabs endpoints. It is not connected to the website's request history or spending display. Do not buy the same take in both interfaces. Nothing in this working pack authorizes a paid call or asset upload.

## Before any paid execution

1. Review the actual Blender camera pass and contact sheet. All 30 provisional camera-pose PNGs now exist in `blender/renders/keyframes`; the full 1920 × 1080 silent guide is still rendering. These outputs are not approved appearance references. Keep the accepted `.blend` and guide unchanged.
2. Approve the appearance references and voice. Never upload `source_choreography_index.jpg`; its old identities/artwork are a choreography comparison only. Supplied carton/report fronts are still concept art.
3. Read `../../reports/PRODUCTION_AUDIT.md`, especially input-video billing and missing references. Confirm the exact asset list, take plan, and a spending ceiling with the user.
4. Run the desired command without `--execute`. It shows the payload, missing files, SHA-256 input fingerprint, estimate and a 25% planning reserve. Save that review.
5. Only after explicit approval, record it in `spending_approval.json`: approval flags, authorized ceiling, exact fingerprint(s), and a dated note describing the user authorization. Also mark the specific video job `approved:true` after its camera review. Changing files/voice/prompt/resolution changes the fingerprint and needs a new review.

```bash
node studio/fal_runner.mjs video
node studio/fal_runner.mjs music
node studio/fal_runner.mjs tts VO03 --voice Rachel
node studio/fal_runner.mjs sfx FX04
node studio/check_runner.mjs
```

Rachel is an example stock voice for payload inspection, **not a selected/approved project voice**. Direction notes are creative instructions for auditioning and are not silently added as speech, unsupported API fields, or music lyrics.

## Queue and recovery

After approval, verify that `FAL_KEY` is available securely to the chosen server process; all four endpoints use that key. The checked pre-existing local projects have no `.env.local` file, so this audit could not establish local key presence. This does not determine the deployed website’s configuration. Uploading video/image assets also needs the existing `@fal-ai/client` package accessible to this runner. Do not copy an `.env.local` file into this folder. No SDK is needed for dry runs or the direct queue polling path.

Append `--execute` to submit the approved plan. The runner:

- creates a receipt and reserves its estimated cost plus 25% **before** uploading/submitting;
- checks the approved exact fingerprint and cumulative reserved budget under a submission lock;
- uploads only the listed project assets and persists URLs;
- makes one direct queue POST, without automatic submission retries;
- writes the accepted request ID/status URL/result URL immediately and exits.

Use the printed resume command to check the same job. This performs GETs only:

```bash
node studio/fal_runner.mjs --resume studio/outputs/RECEIPT_NAME.receipt.json
```

Run it again if still pending. A 503, timeout or reload does not buy another take. Completed result JSON and media URL stay in the same receipt. Download the accepted result into the appropriate `audio`/`plates` working folder only after inspecting it; the runner deliberately does not call it an approved final.

If submission returns no usable ID, the receipt says `submission_unknown`. Inspect the fal dashboard and recover the existing handle manually; do not delete the record and retry. A stale `.submission.lock` also requires checking receipts/running jobs before clearing it. Prepared or uncertain records conservatively continue to reserve budget. Actual provider cost is left `null` until checked against billing; do not equate the local estimate with an invoice. This is a local planning limit, not a provider-enforced hard billing cap.

A new creative take needs a distinct plan/seed and a newly authorized fingerprint. The runner rejects repeating the same fingerprint, including completed takes. Keep receipts private: they contain project prompts, local paths and generated asset URLs, but no key values.

## Repair takes and finishing

After camera approval and a complete `blender/renders/guide/frame_0001.png`–`frame_0360.png` sequence:

```bash
python3 edit/make_generation_guides.py
node studio/fal_runner.mjs video --job studio/shot_jobs/S05.json
```

The helper creates eleven four-second guides: 12 leading hold frames, the original shot's unchanged action, then a held last pose to 96 frames. S11/report is excluded. It also creates **unapproved** per-shot job/prompt files without overwriting edited job files. Add the chosen `@ImageN` bindings explicitly. The generated `nominal_trims.json` names the intended crop; actual Seedance timing still needs comparison and alignment. The four-second guide is not part of the 15-second final export.

The final editor owns all eleven cuts, labels, opening/ending text, the entire 72-frame report and exact audio cue placement. Narration is separate from music; the score's empty lyric arrays must stay empty. Four narration takes, one music file and optional SFX are stems, not a finished mix.

`edit/conform_master.py` now refuses short audio instead of silently padding it, and validates **decoded** picture/sample counts. It still expects an already reviewed picture edit and a complete mixed soundtrack. It cannot repair incorrect shots, rushed speech, drift or clipping.
