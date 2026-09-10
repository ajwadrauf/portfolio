# Saved VELUNE scene validation

Source: `VELUNE_camera_review.blend`. Blender 5.2.1 LTS.

**30 checks passed; 0 failed.**

The validator opened the saved file and never saved or changed it. All picture indices below are zero-based.

- PASS — 15 seconds / 360 pictures / 24 fps
- PASS — Twelve exact camera markers
- PASS — Three cartons share the nine-frame rigid motion
- PASS — Exactly twelve bonbon roots
- PASS — Empty fork through n78 and one bonbon birth each n79..90
- PASS — Twelve visible bonbons at n91 and n92
- PASS — Bonbon solids hidden from n100
- PASS — Exactly one spread mesh visible per picture n93..112
- PASS — Saved spread geometry is connected and manifold
- PASS — CAM_MACRO remains stationary throughout S06
- PASS — PISTACHIO_HALF remains stationary throughout S06
- PASS — OBSERVER_A moves during S06
- PASS — OBSERVER_B moves during S06
- PASS — Laboratory contains three left / two right specimens
- PASS — Laboratory products stay fixed
- PASS — Specimen pedestal meets the plinth underside
- PASS — Lab camera holds through n164
- PASS — Lab camera physically dollies n164..189 at 50 mm
- PASS — Lab camera centre remains outside foreground bodies/console
- PASS — Report gets exactly 72 consecutive pictures
- PASS — Opening title visible only n0..41
- PASS — Closing title visible only n314..359
- PASS — Taste fork absent opening, present ending
- PASS — HOST_A has final-shot movement
- PASS — TASTE_FORK has final-shot movement
- PASS — HOST_A_eye-1 has subtle final local eye response
- PASS — HOST_A_eye1 has subtle final local eye response
- PASS — Host mouth changes in ending
- PASS — Same host object used by both tunnel views
- PASS — Validator left the source blend unchanged

## Visual inspection and scope

- Inspected rendered n91: twelve distinct bonbons form the question; fork remains below them and the hand is deliberately cropped.
- Inspected rendered n112: the question interior is filled and the spread remains connected over the fork; this is a motion-guide surface, not final food beauty.
- Inspected rendered n189: the foreground people frame the five fixed specimens without hiding their count. Intended shoulder/arm construction overlaps are proxy modelling joints.
- Inspected updated rendered n174/n189: the plum pedestal column now supports the specimen plinth, replacing the previous floating appearance. Its upper face meets the underside of the plinth; all five specimens remain visible.
- Inspected rendered n113/n139: macro observers exchange lower/upper positions around a fixed cut chocolate and fork. Their eyes remain camera-forward rather than dynamically tracking the product. No unintended product/body overlap is visible.
- Inspected rendered n42: carton is supported by the pedestal; the label stays on its front face and the intended side mattes remain.
- Inspected rendered n314: host sits in the central tunnel aperture; tasting fork is at mouth height; closing tagline remains legible. Mouth/fork contact is deliberate.
- Characters, eyes and facial response are intentionally stylized proxy geometry. This test establishes rig motion and visibility, not photoreal performance or final identity quality.
- No broad all-object intersection scan was run: nested shell/filling, fork contact and assembled proxy anatomy contain intended overlaps. The targeted lab-camera check is scoped explicitly above.

Detailed values, marker bindings, visibility counts and source SHA-256 are in `saved-scene-validation.json`.
