# Connected AI Studio

Implemented 11 September 2026 on `codex/connected-studio`.

The Studio now carries a named project, its source assets, drafts and completed work between tools. The existing photo-based Packshot workflow remains available. Loading the VELUNE example creates an editable copy and never submits a generation request.

## Walkthrough

1. Open `/ai-studio` and choose **Load & explore VELUNE**, or use **Load VELUNE example** in the shared project bar.
2. Inspect the source assets in **Project & assets**. The Blender camera study, packaging concept, provisional report and contact sheet are available. The final Seedance film is explicitly pending.
3. In Packshots, choose **Explore VELUNE artwork** and **Load VELUNE carton artwork**. This loads the actual front-panel concept used in Blender. The proposed carton is 120 × 180 × 40 mm; these are scene dimensions, not an approved manufacturing specification. Other faces stay plain until supplied. Render views locally and keep a completed view in the project or send it to Campaign Studio.
4. Blender and Prompt Builder retain editable production drafts, reference assignments and shot timing. VELUNE uses a 15-second, 360-frame cut with 12 shots. Export the production ZIP or rehearse a camera move locally with Three.js. Applying a new rehearsal clears the old motion-guide assignment so it cannot imply the unchanged video contains the new move.
5. Campaign Studio supports an approved-hero workflow, actual format adaptations and locally typeset EN/FR copy. A completed asset can be inspected, exported or sent to Ad Lab. Paid attempts retain immutable input snapshots and saved video handles; reload recovery checks an existing job instead of buying another.
6. Ad Lab carries the project brief, named references and a compact scene board. Sound planning retains narration, score and effects. Finishing can align audio stems, adjust gains/fades and duck music under voice. It exports a PCM WAV mix plus an editor handoff; it does **not** mux a new MP4 or remove the source video's embedded sound.
7. Models compares the actual scenario with configured capabilities and estimates. **Use this route** transfers supported model choices to the relevant tool. Registry-only models cannot pretend to select an unavailable route. Build vs. Buy includes attempts and human review effort in a saved cost-per-accepted-asset scenario.
8. Playbook records human evidence and a decision against a particular asset/version. AI preflight reports remain actual model observations attached to completed takes; neither these observations nor loading an example grants approval. Making-of exports include only assets explicitly selected by the user.

## Data and paid requests

- Projects use IndexedDB (`ai-studio-projects-v1`), up to 24 projects and 100 MB per project. They are local to the browser and origin, not an authenticated cloud workspace. Export/import transfers work between devices; remote provider media links can expire.
- Atomic per-project patches preserve other tools' drafts. Async result callbacks retain the project that originated the work. Project changes and navigation flush relevant unsaved drafts.
- Portable exports remove request handles and authentication fields. Imported interrupted attempts are visible but cannot automatically resume or repeat paid work.
- Campaign generation saves the attempt before submitting; storage failure prevents the request. Transport failures while polling do not create another generation. Recovery and retries are explicit.
- The campaign download proxy validates HTTPS hosts and every redirect, validates media types and caps streamed bytes. It streams responses rather than buffering films into a response that can exceed Vercel's limit. See [Vercel's body-size guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
- Model prices are configured estimates, not freshly verified quotes or proof of account access. No new vendor credential is required for these local workflows.

## When Ajwad supplies the final VELUNE film

For a local project, use the named final-film attachment in **Project & assets**. This makes the comparison available for that working copy.

For the public reusable example, upload the actual film to the existing approved media hosting and set `VELUNE_FINAL_VIDEO` in `src/lib/studioProjects.ts` to its HTTPS URL. New example copies will then contain a ready final film. Existing copies intentionally retain their own work and are not silently overwritten. Inspect the result, update its source/production information and add its public presentation where appropriate; do not replace the placeholder with the Blender guide or the unrelated ice-cream result.

## Validation

All generation tests use mocked providers; browser verification used local demo mode. No paid generations were submitted.

- Production build and TypeScript passed.
- Connected-project tests cover real IndexedDB transactions, project isolation, limits, portable exports, source-bound review validation, routing and cost arithmetic.
- Campaign callback tests cover double clicks, storage failure, immutable source snapshots, failed status polling, reload recovery, project switching, exact local EN/FR layouts and bounded streamed downloads.
- Production-brief tests cover positional reference remapping, exact timing, multi-cut mode, export files and camera rehearsal contracts.
- Ad draft/mix, audio, preflight, campaign handoff/transfer, artwork, package preset, preview-guide and packshot checks passed.
- Browser checks covered VELUNE loading, actual artwork placement and local render, project asset reuse, camera playback, draft references, Ad scene navigation, Models → Packshots, saved cost assumptions and asset-version review separation. Navigation was inspected at 390 px and 1024 px as well as desktop; the mobile Ad scene strip does not cause page overflow.

The offline tests establish application behavior, not provider output quality or final VELUNE film fidelity. Those require a real supplied result and human review.
