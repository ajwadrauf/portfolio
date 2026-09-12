> **11 September 2026 — current revision:** The VELUNE H3 example now uses nine new images; the two older chocolate studies were removed to meet the provider’s nine-image cap. Read [AD_LAB_PRESET.md](./AD_LAB_PRESET.md) and [VISUAL_REFERENCES.md](./VISUAL_REFERENCES.md) for the current pack, prompt and report master. The Blender video is unchanged. The Seedance example toggle is deferred. Older production notes below describe the original camera study and may refer to the original eight images.

# VELUNE — camera study and portfolio integration

## Review status

Source branch: `codex/velune-production`, based on production commit `518c421`.
Production branch: `claude/loblaw-ai-content-studio-701jhf`, **not `main`**.

Read `AGENTS.md` before editing. This Next.js 16.3.3 project includes the relevant documentation in `node_modules/next/dist/docs/`.

This is an **independent fictional concept in production**. The website presents actual Blender camera-study frames and supplied concept artwork. It does not present a finished Seedance film, commissioned client work, approved hero product imagery, generated voiceover or a mixed soundtrack.

On 10 September 2026, Ajwad explicitly authorized pushing this work to GitHub and having Codex update the live website directly. That approval covers publishing the current camera-study case study and its home/AI Studio cards. Paid appearance/audio generation still requires its own approval; publication does not authorize provider spending. Codex can continue website implementation without a separate Claude handoff.

## Website changes

- `/velune`: a new case study with the silent camera-study player, twelve selectable shot inspections, the creative decisions, real Blender corrections, keyframe contact sheet, concept packaging/report, production stages and proposed narration windows.
- Home: a VELUNE card beneath AI Content Studio and before the existing project pair. It uses the actual question-mark Blender frame and links clearly to the case study. Existing project links, motion studies and navigation remain intact.
- AI Studio overview: a compact VELUNE card using labelled packaging concept art. The existing Cream comparison and tool entries remain intact.
- Sitemap: adds `/velune`.

Main files:

```text
src/app/velune/page.tsx
src/components/velune/VelunePlayer.tsx
src/components/velune/VeluneCard.tsx
src/components/velune/Velune.module.css
src/components/velune/veluneStudy.ts
src/app/page.tsx
src/app/ai-studio/page.tsx
src/app/sitemap.ts
```

No API, billing, model, credential, navigation component or generation workflow was changed. There are no new dependencies.

## Media provenance

Only portfolio-ready VELUNE assets belong in `public/studio/velune/`:

| File | Provenance / purpose |
| --- | --- |
| `animatic.mp4` | Actual Blender camera animatic, 15 seconds / 360 pictures at 24 fps. Silent working geometry, pending camera approval. |
| `poster.jpg` | Actual 1920 × 1080 Blender render of picture 91: twelve chocolates form the question silhouette. |
| `contact-sheet.jpg` | Actual thirty-pose Blender review sheet, 1280 × 1632. |
| `packaging-concepts.jpg` | Optimized 1440 × 904 copy of the supplied `artwork/boxes_front.png`; visibly labelled flat concept art. |
| `report-concept.jpg` | Optimized 1440 × 810 copy of supplied `artwork/centre_report.png`. Single printed-artwork concept, not a finished product render. |

The source choreography index, source footage, original performer imagery, private job receipts, audio stems, heavy working sequences and `.blend` working files are not copied into public website assets. The original ZIP remains preserved outside the repository.

## Player and accessibility

- Native video controls, `playsInline`, metadata preload, no autoplay or forced sound.
- A descriptive text alternative covers the silent video; each shot has its own description.
- Select a shot to pause and seek to its first frame. The full sequence plays using native controls. Shot boundaries come directly from the supplied integer-frame timeline; the report retains its 72-frame interval and the final frame is picture 359.
- Initial poster state says “Explore the edit,” rather than implying the poster depicts shot 01. During playback/seeking the current shot description updates.
- Direct video download, full contact-sheet link, keyboard focus states and accessible button labels.
- CSS is local to VELUNE. Two explicitly scoped homepage rules preserve card button contrast and heading spacing against the homepage's existing ID-based resets.
- No before/after comparison is fabricated. Add a real comparison only once the finished counterpart has been generated and reviewed, and then revise the page's stage labels and credits to describe the actual work.

## Validation

- `npx next typegen` and `npx tsc --noEmit`: passed.
- `npm run build -- --webpack`: passed, including the new static `/velune` route.
- `git diff --check`: passed.
- Local headless Chrome checks: `/velune`, `/`, `/ai-studio` at 1440, 768, 390 and 320 pixels wide; no horizontal overflow or JavaScript exceptions. Both existing entry pages expose the new VELUNE link.
- Desktop and mobile screenshots visually reviewed, including actual poster/contact sheet/artwork. Homepage CTA text was found to be affected by the existing link reset and corrected before handoff.
- Provider calls: none. Existing generation endpoints are untouched.
- Actual media playback: the browser reports 1920 × 1080 / 15.000 seconds; no autoplay, native controls present. All twelve shot buttons seek to the intended first frame and pause. Full normal-speed playback reaches the end, with S12 selected; every displayed process image loads and no JavaScript error occurs.

Local preview: `http://127.0.0.1:3032/velune`.

This worktree shares the existing installation via a gitignored `node_modules` symlink. This Next/Turbopack build rejects a symlink that exits its project filesystem root, so local preview/build use `--webpack`. There is no app configuration workaround or dependency change. A normal fresh installation can use the project's standard commands.

## Finish and publication gates

1. Review the camera study and approve or correct its poses, counts, projection and timing.
2. Approve appearance references and a spending ceiling before paid Seedance/ElevenLabs submissions.
3. Audition voice, score and effects separately, then finish the exact edit and final mix. The proposed narration on this page is a plan, not a transcript of existing audio.
4. Replace provisional media/status only with actual reviewed results. Preserve deterministic packaging/report typography where generation drifts.
5. Publication of the current camera-study integration is authorized. Ship all VELUNE components, page entries and required web media together through the existing production branch. Review later finished-film replacements when those assets exist.

## Production outputs and playback verification

Browser evidence is saved outside Git in `velune-production/review/website/`: `playback-results.json`, `velune-final-desktop.png`, `velune-final-mobile.png`, and `home-card.png`. Responsive checks covered all three affected routes at four widths. The browser playback test uses the actual local animatic, without provider requests or fixtures.

The rendered local checkpoint lives at `/Users/ajwadrauf/Documents/New project/velune-production`:

- `work/blender/VELUNE_camera_review.blend`: actual editable Blender 5.2.1 LTS scene, six artwork images packed.
- `exports/VELUNE_camera_animatic_15s.mp4`: silent H.264/yuv420p, 1920 × 1080, 360 decoded pictures, constant 24 fps, precisely 15.000 seconds. All picture timestamps were checked. SHA-256: `0d86410969827339dac4876fa749a531653c3c7bdc9a9375b26f00504c29fdca`.
- `exports/VELUNE_Camera_Review.zip`: portable review bundle with the packed scene, video, poster and contact sheet.
- `work/blender/renders/guide`: the complete lossless PNG sequence, retained locally for repairs.

Repaired production sources are also checked into `production/velune/work`, with dated verification under `production/velune/reports`. Read its README to rebuild. No scene, working sequence, source choreography image or private receipt is included in Git. The approved appearance folder remains empty, and no audio has been generated.

Saved-scene validation passed 30 checks. All twenty baked spread meshes passed connectivity/manifold/intersection checks. All 360 pictures were visually inspected in six sequence sheets, with larger keyframes used for composition/contact. Food and people remain provisional, and the macro observers currently face camera. The supplied reference clip itself was absent, so this is an adaptation of the written timing and contact sheet, not a certified frame-for-frame source reconstruction.

The full production audit records current fal pricing, which bills input video as well as output. One 15-second 720p test plus the proposed audio is estimated at US$9.14, or US$11.43 with a 25% reserve, excluding reference images and retries. These numbers are estimates, not authorization. Neither checked existing worktree contained `.env.local`; deployed configuration was not inferred from that local absence. No credential values were copied or printed.
