# Ad Lab: preflight against a finished take

Implementation verification, 10 September 2026: 93 offline preflight checks and the existing audio contract suite pass. The production webpack build passes. Browser QA exercised the actual component with clearly labelled, local-only simulated fixtures: desktop and 390px mobile layout, flags and evidence, timestamp seeking, report copying, and switching to an unreviewed recovered take. The temporary fixture route was removed before publishing. No paid Gemini inspection was performed; the first live review is still the end-to-end provider validation.

This feature brings the playbook's pre-flight checklist to the generated video. A completed take gets an explicit review action. The report distinguishes observations the AI can make from decisions that still need a person and documentary evidence. A failed or incomplete report remains useful: it gives the reviewer a concrete list of what to fix or establish before publishing.

## Review contract

- Review the finished video, not an illustration of a successful review.
- Keep the nineteen playbook checks as the common policy source.
- Keep rights, consent, approved-platform decisions, disclosure obligations and named human approval separate from visual or audio observations. The AI cannot supply those approvals.
- Bind the report to the selected take and the request metadata captured when that take was submitted. Later prompt edits must not rewrite its provenance.
- Missing inputs, missing model findings and unsupported conclusions stay unresolved.
- An explicit review action may use the configured AI analysis provider. Loading a result, restoring a saved report and changing tabs must not purchase another review.
- A saved browser report is a working review record, not an immutable audit log or certification.

## What is checked

The shared definition is `src/lib/adPreflight.ts`. It supplies the same nineteen policy requirements to the playbook and the completed-take review. Each requirement keeps its fixed identifier, wording and remedy; a provider response cannot replace the policy.

The report contains twenty-six rows:

| Source | Rows | What the result means |
| --- | ---: | --- |
| Browser metadata | 1 | Compare measured duration and shape with the original submission. Codec, loudness and platform acceptance remain separate. |
| AI observations | 6 | Product consistency; readable labels and prices; claims and overall impression; people and endorsements; motion and framing; embedded soundtrack. |
| Playbook policy | 19 | Documentary or human requirements. AI may flag a possible concern, but cannot approve them. |

Missing, invalid or duplicate model findings become `unverified`. Timestamp links are limited to finite times within the video. A style or motion reference cannot establish product identity; the visual-product row stays unresolved without a product reference, unless there is a concern to flag.

Declaring a fictional concept can mark the four real-product requirements not applicable. That exemption explicitly records the user's declaration; it is not an AI verification, and an AI concern still takes precedence. Rights, consent, disclosure and named approval remain unresolved.

`pass` on an AI observation means no issue was identified within that review's coverage. It does not establish legal compliance, provenance or readiness to publish. The report's overall state always requires a human decision.

## Take provenance

Ad Lab freezes the submission prompt, model, duration, aspect, audio mode and reference names/roles when the generation starts. Polling recovery carries that snapshot forward. A recovered take with no saved snapshot stays explicit about missing original context instead of borrowing whatever happens to be in the form now.

The browser retains a small history of completed-take metadata. Reference image files are kept in memory only, so a reload can restore the take's context without silently retaining or resending its source images. Reports should be read against the take they name; adding music or voice later changes the asset that needs review.

## Review interaction and recovery

The completed-video panel introduces the review, identifies what is sent to Gemini, estimates the analysis charge and links back to the playbook. Product type and intended channel are optional declarations. The user initiates the analysis with **Run AI preflight**; a render completing does not submit a review automatically.

Results open with flagged and unresolved items. Each expandable item separates its evidence, basis and next action. Timestamp buttons pause and seek the generated video. Filters expose all checks or passed observations. The report states its model, date, sampling coverage and limitations. Human reviewer/notes fields are saved separately and do not turn the policy rows green.

The full Markdown export includes the unresolved checks, original generation context and review limits. There is no external publishing action in this workflow.

Browser storage uses three bounded journals:

| Key | Contents |
| --- | --- |
| `adlab-completed-takes-v1` | Up to twelve completed takes with their original request metadata. |
| `adlab-preflight-reports-v1` | Up to twelve reports plus user declarations and human follow-up notes. |
| `adlab-preflight-pending-v1` | Up to twelve review attempts recorded before submitting. |

A saved report restores only for the matching take/video and current checklist version. Malformed cache entries are ignored. A response must match the submitted review request ID and video before it is applied. Switching takes unmounts the old review panel; a late result is saved for its original asset without attaching to the new video.

An uncertain timeout or network failure leaves the pending marker and never retries automatically. The user is warned that another attempt may incur another analysis charge. Only an explicit server response that no provider submission was attempted clears that marker without a result. This marker prevents accidental silent retries; it is not a server-side resumable job queue or a provider billing receipt.

If the browser cannot save a pending receipt, it stops before sending the request and gives a storage remedy. The generated video and its existing download controls remain available.

## Backend and cost controls

`POST /api/ad/preflight` uses the existing `GEMINI_API_KEY`, `GEMINI_REASONING_MODEL` and live-session gate. The default reasoning model remains `gemini-2.5-flash`; no additional service or key is introduced. Missing Gemini configuration, dry run and a locked session return an unavailable response without fetching media or fabricating a report.

The route validates a request of at most 2 MB, a video of up to 60 seconds and at most three bounded JPEG/PNG/WebP reference images. It prepares the media before consuming a session slot. Every provider attempt consumes one existing live-session slot. After submission, failures preserve the refreshed session cookie and state that the outcome may have been billed; they do not restore the slot or trigger retries.

Public fal and Vercel Blob outputs are sent as native video URLs after a restricted HEAD check of their availability, MP4 content type and declared size. The public declared-size ceiling is 95 MB. Public redirects are rejected. Private Veo outputs use the existing relative video-file address shape, but the preflight adapter validates the exact Google API host and file path itself. It follows at most two redirects, only to the same file on that host, and streams no more than 12 MB before sending inline video. A Google credential is never forwarded to another host, file ID or arbitrary API path.

The server requests a native video review at four samples per second and includes only that MP4's embedded audio. Gemini receives fixed checklist IDs and a constrained response schema. A system instruction identifies media, reference metadata and the original brief as untrusted material to inspect. The saved context is JSON-encoded separately from review instructions. These measures reduce instruction confusion; they do not prove that a multimodal model can never be influenced by embedded instructions.

A usable response must say the video was inspected, describe visible content and include at least one valid observation. Other missing findings remain unresolved. An inaccessible video, invalid JSON or unusable response produces a review error, not a fictional completed checklist. The provider request has a 45-second timeout and automatic retries disabled.

The planning estimate uses standard Gemini 2.5 Flash input/output rates, the requested coverage and an output/thinking allowance. The UI describes it as approximately $0.04 for a take up to 60 seconds, with actual usage/model settings allowed to vary. Provider token usage is retained when available; the estimate is not an invoice. A custom reasoning model can have different rates. The review does not buy another Seedance video.

The report's SHA-256 fingerprint covers the video address, measured metadata, original submission, declarations, checklist version and hashes of submitted image data. It is an input fingerprint, not a downloaded-video checksum or proof that the file at a URL can never change. Local browser records are editable and not shared across devices.

## Coverage limits

- Four samples per second can miss quick cuts, small print and transient defects. Timestamp links are approximate.
- A visual match does not establish that a product reference is authentic capture, that a portion or claim is truthful, or that source processing is licensed.
- No face recognition, voice identity verification, legal certification, measured loudness or sample-accurate synchronization is performed.
- Separately previewed ElevenLabs music, narration and effects are outside the reviewed MP4. Review again after the final mix.
- Browser-reported duration and dimensions are labeled as metadata evidence; they are not a server-side technical media inspection.
- Public media is checked by HEAD and then opened by the provider. An absent/incorrect size header, expiring URL or subsequent upstream change can still cause a provider failure.

Implementation references: [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding), [native file input methods](https://ai.google.dev/gemini-api/docs/generate-content/file-input-methods), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini 2.5 Flash pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash), [Vercel Function limits](https://vercel.com/docs/functions/limitations).

## Validation

Run the offline contract checks with:

```sh
node scripts/check-ad-preflight.cjs
```

The script loads TypeScript modules in isolated VMs with empty environments and mocks all providers and remote fetches. It never reads local environment files or sends a paid request. A small React hook harness exercises the actual review component's effects and event handlers, including no automatic submission, double-click protection, exact-take restoration and late-response isolation. This is a behavioral test of the interaction code; visual layout and browser accessibility still need a real-browser pass.

As of 2026-09-10: **93 checks pass**, covering all nineteen canonical policy items, six AI observations plus delivery metadata, missing/duplicate/invalid findings, fictional-declaration limits, timestamp bounds, source-reference roles, request limits, URL/proxy/redirect restrictions, stream limits, request fingerprinting, untrusted-context separation, live gates, one submission per click, cache recovery, storage failure, stale responses, and spent-cookie retention after a failed provider attempt. All provider and network behavior in this suite is mocked. No paid model accuracy or final-media review is claimed by this test pass.
