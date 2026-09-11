# Proposed AI assistance for packaging artwork

Status: proposal, not an enabled AI feature. Company presets and geometry are separate, deterministic features. No AI request should run when opening the page, selecting a preset, uploading artwork, or changing dimensions.

## Recommended first release

Add an **Analyze this artwork** action beside the existing crop editor. Before submission, show the exact page or selected region that will be sent to Google, the configured reasoning model, and a short notice that this is a paid analysis. Reuse the existing server-side `GEMINI_API_KEY` and `GEMINI_REASONING_MODEL`; no new provider account or image-generation model is required.

Return a review panel with:

- Suggested artwork regions and likely faces. **Preview crop** places a suggestion in the existing crop editor; the user still checks it and presses **Assign artwork**.
- Printed measurements, their units, the exact supporting text, and what they describe: assembled package, individual panel, flat sheet, label, bleed, safe area, or unknown.
- A suggested package family or a match to one of the actual saved preset IDs, with the visible evidence and uncertainty. A package weight or SKU name alone must never determine its dimensions.
- Conflicts and missing evidence: inconsistent dimensions, unreadable small type, uncertain front/back assignment, absent side artwork, proof marks inside a crop, or unsupported geometry.

Keep each recommendation unapplied until the user explicitly accepts it. Never rewrite logos, nutrition tables, barcodes, regulatory marks or other printed artwork. Report “not established” rather than fabricate a complete carton measurement or certify a label.

For example, a printed 2.25 × 4 inch label establishes the label size (57.15 × 101.6 mm), not the finished package's width, height and depth. A flat film width is likewise not an inflated chips bag's width. Present both values with their scope; do not silently put them into the package dimensions.

## Implementation fit

Use the bounded validation and spending pattern from `src/app/api/ad/preflight/route.ts` and `src/lib/adPreflightServer.ts`. The generic `/api/analyze` is not the right template for this paid inspection: it does not have the same budget and unknown-outcome handling.

- Submit one locally rasterized page/selected area as a bounded JPEG/PNG; keep original files and unused pages local. Display the actual outgoing region. Do not collect supplier contact details as output fields.
- Validate image bytes, image bounds, page/crop identity and request size before consuming the live-session budget.
- Require live access, configuration and budget. Demo mode must explain that analysis is unavailable, not return invented findings.
- Use one structured Gemini response, a timeout and no automatic paid retries. Validate the returned schema and all coordinate ranges on the server. Treat artwork text as untrusted data, never instructions.
- Bind the response to source file, page, region and request ID. A response for a replaced page must not change the current crop or geometry. Keep earlier findings visible with an explicit stale state.
- Separate AI confidence from human approval. Applying a suggestion is not a certification of its correctness.
- Record model and time with the findings. Show usage-based cost when returned; do not label analysis free. Preserve a spent receipt if the provider result is uncertain and never retry automatically.
- The existing signed-cookie budget is advisory and is not atomic across tabs. Client single-flight prevents accidental repeated clicks; strict account-wide spend limits would require durable server-side job/account storage.

## Validation before enabling

Use mocked providers to verify that uploads and preset changes make zero paid calls; one deliberate analysis click makes one call; malformed images or coordinates cannot spend/apply; flat-sheet and label dimensions cannot silently become assembled dimensions; stale responses cannot modify a new source; unknown outcomes do not resubmit; and invalid AI output does not consume a second generation automatically. A short live analysis should be tested only when the user deliberately requests it.

## Sources

Google documents image-region detection in normalized coordinates and structured schema responses. These capabilities support the proposed interface; they do not guarantee packaging measurements or crop correctness.

- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini document understanding](https://ai.google.dev/gemini-api/docs/document-processing)

Reviewed 2026-09-10. Keep the repository's configured model unless a model migration is separately evaluated.
