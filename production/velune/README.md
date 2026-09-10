# VELUNE production source

This directory preserves the repaired, executed camera-study generator, supplied VELUNE artwork, integer timeline, appearance/audio instructions, safe queue runner and dated validation evidence. The original ZIP is preserved separately on Ajwad's computer. Source reference footage and its contact sheet are deliberately excluded.

The website serves the actual silent camera study from `public/studio/velune/animatic.mp4`. It is 1920 × 1080, 24 fps, exactly 360 pictures / 15.000 seconds. It is not a finished commercial. Ajwad authorized GitHub publication and the live case-study update on 10 September 2026. Appearance generation, audio and provider spending remain unapproved.

## Rebuild locally

Blender 5.2.1 LTS, FFmpeg/ffprobe and Python with Pillow were used. From this directory's `work` folder:

```bash
blender -b --python blender/build_velune.py -- --output blender/VELUNE_camera_review.blend --width 1920 --samples 32 --render-keyframes --render-guide
python3 edit/export_camera_review.py
node studio/check_runner.mjs
```

On the Mac, Blender's executable is `/Applications/Blender.app/Contents/MacOS/Blender`. Use normal system permissions; the desktop agent needed its approved process escalation for graphics initialization. No scene download, extra Blender add-on or provider key is needed for the local render.

Outputs are gitignored. Do not overwrite the website's reviewed assets until a replacement has been inspected. Optional `--guide-start` / `--guide-end` select Blender frame ranges for repairing a shot without rendering every frame again; the saved scene still contains all 360 pictures.

## Continue production

Read the [Claude handoff](../../docs/velune/CLAUDE_HANDOFF.md). The full brief is `work/PRODUCTION_BRIEF.md`; current limits and verified provider prices are in `reports/PRODUCTION_AUDIT.md`. The working reference manifest keeps camera renders separate from approved appearance files. Rebuilding the scene regenerates the thirty local poses; it does not approve them.

`work/studio/README_EXECUTION.md` documents dry-run, exact-plan approval, budget reservation and GET-only queue recovery. No spending or upload is enabled by default. Do not add credentials to these files or commit private receipts. The sample package imports `@fal-ai/client` only for authorized storage uploads; local dry runs and polling do not require installing it.

The dated validation reports describe the rendered local checkpoint. Run checks again after changing the source; a preserved report is not evidence for a later render.
