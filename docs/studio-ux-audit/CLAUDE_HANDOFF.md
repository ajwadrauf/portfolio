# AI Content Studio — UX audit and proposed implementation scope

Prepared for Ajwad Rauf on 8 September 2026. **Audit only: no application code changed, pushed or deployed.**

## Context for Claude

Review the latest `claude/loblaw-ai-content-studio-701jhf` branch before implementing. The source audited here was commit [`fcf831d`](https://github.com/ajwadrauf/portfolio/commit/fcf831d), including the new “Cream in motion” overview. Do not replace it with an earlier homepage or studio concept. Read root `AGENTS.md` first and the relevant installed Next.js documentation in `node_modules/next/dist/docs/` before editing code.

Ajwad wants the existing tools to be easier to use, with all functionality retained. Keep the current design language. This is a targeted usability pass, not a redesign of the generation pipeline. The optional additions below are proposals, separate from the fixes.

## What was checked

Live pages were inspected in an isolated Chromium browser at desktop 1440×1000 and mobile 390×844. Additional narrow checks covered the main tools at 320px and 736px. Source inspection covered the shared components, forms and related state handling. All ten routes returned HTTP 200; no page-level JavaScript exceptions or page-wide horizontal overflow were observed in those checks.

| Route under `/ai-studio` | Main outcome |
| --- | --- |
| Overview | Retain the new Blender comparison and tool links; apply shared navigation improvements. |
| `/ads` | Improve orientation, imported-prompt feedback and error placement in a long workflow. |
| `/studio` | Fix keyboard access to the initial product upload. |
| `/packshots` | Improve reference-field labelling and shared spend wording; retain batch actions. |
| `/prompts` | Improve field labels and small controls; propose recoverable drafts. |
| `/blender` | Improve repeated-field labels and builder orientation; preserve both output modes. |
| `/blender/the-wall` | Ensure the parent Blender section remains identifiable in navigation. |
| `/models` | Make comparison easier on mobile; optionally add discovery filters. |
| `/build-vs-buy` | Resolve an internal contradiction in the comparison copy. |
| `/playbook` | Expose section navigation on mobile without removing the article. |

Keyboard checks covered upload, the unlock overlay and form navigation. Draft checks covered internal navigation, reload and Clear in Prompt Builder. Prompt-to-Ad-Lab handoff was checked twice, including an updated second prompt.

These are browser and source findings, not a complete accessibility certification. Screen-reader use, real iOS/Safari, authenticated generation and provider output quality were not tested. Non-read API calls were blocked during browser checks; no generations or unlock requests were submitted. Vendor capabilities and prices were not independently re-researched for this UX audit.

## Fix first

### 1. Make Campaign Studio’s upload keyboard-operable — high priority

**Confirmed:** “Browse files” is a `span` inside a clickable `div`. Neither is focusable; the actual file input is hidden. A keyboard user cannot start the primary upload flow.

Source: [StudioWizard.tsx, upload control](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/studio/StudioWizard.tsx#L504).

Use a real `button type="button"` for Browse files, calling the existing file-input handler. Preserve drag/drop, accepted formats, resizing, loading states and downstream analysis. Avoid nested interactive controls or duplicate picker events from bubbling.

**Acceptance:** Tab reaches Browse files; Enter and Space open the picker; selecting the same fixture through picker and drop follows the same existing path. Focus remains visible. Test without making a paid analysis request.

### 2. Finish the unlock overlay’s modal behaviour — high priority

**Confirmed:** The password field receives initial focus, but Escape does not close the overlay. Tabbing forward from Cancel while Unlock is disabled moves focus to background page controls. The overlay lacks dialog semantics.

Source: [LiveGate.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/components/LiveGate.tsx#L139).

Use a native dialog or an accessible modal pattern with an associated title, modal semantics, focus containment, Escape dismissal and return of focus to the opener. Preserve the existing initial focus. Give Passcode a persistent label; associate and announce unlock errors. Preserve passcode submission, cookie handling, live/demo states and server budget enforcement.

**Acceptance:** Tab and Shift+Tab remain inside; Escape and Cancel close; focus returns to the triggering control; opening from a downstream generation action also returns focus sensibly. Background controls cannot be activated while the dialog is open. This follows the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### 3. Associate field names and improve small touch targets — high priority

**Source-confirmed examples:** Prompt Builder’s block headings are not associated with their textareas; reference media/job controls lack persistent associated labels. Some repeated Blender subject/beat fields have the same issue. Packshots’ reference-angle selector and Ad Lab’s direct-URL field need clearer field names.

Start with [PromptBuilder.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/prompts/PromptBuilder.tsx#L217), [BlenderBriefBuilder.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/blender/BlenderBriefBuilder.tsx#L277), [PackshotStudio.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/packshots/PackshotStudio.tsx#L736) and [AdLab.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/ads/AdLab.tsx#L2588).

Use stable IDs and labels or `aria-labelledby` pointing to existing headings. Repeated controls should identify their item, such as “Reference 2 purpose” or “Beat 3 action.” Keep placeholders as examples. Connect help and errors with `aria-describedby`; retain current validation rules. See [W3C guidance on labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html).

The shared [Why control](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/components/Why.tsx#L53) is approximately 15×15px. Several secondary text controls are similarly small. Enlarge their effective hit areas and keep visible focus styling. Aim for 44px touch targets where practical; do not classify every control below 44px as a standards failure. WCAG’s AA target-size minimum is 24px with defined exceptions: [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). The Why component already has an accessible name and dismissal behaviour—preserve those.

## Improve workflow clarity

### 4. Make navigation useful on mobile — medium priority

**Confirmed:** The global navigation is horizontally scrollable, but the scrollbar is hidden and the active item is not brought into view. On Playbook at 390px, the active link starts around x=747, outside the visible viewport. Exact-path matching also leaves the Blender case-study route without a highlighted parent section.

Source: [Nav.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/components/Nav.tsx#L45).

Preferred proposal: a compact mobile “Tools & guides” menu with a clearly visible current-page label; retain the full desktop navigation and all nine destinations. A smaller alternative is to keep the strip, visibly signal overflow and scroll the active item into view. Add `aria-current="page"` for exact matches and distinct parent-section highlighting for nested routes. Consider “Campaign Studio” where there is room, to distinguish it from the whole AI Content Studio.

Playbook is approximately 14,175px tall at 390px, while its table of contents is explicitly hidden below the desktop breakpoint. Add an “On this page” disclosure using the existing section data and anchors. Preserve the desktop contents and all article content. Source: [playbook/page.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/playbook/page.tsx#L243).

**Acceptance:** Every route is discoverable by keyboard and touch at 320/390px, current location is visible, anchor targets clear the sticky header, and browser Back works normally.

### 5. Give long forms a compact progress summary — medium priority

**Observed:** Ad Lab’s default mobile workflow is roughly 11,000px tall. Its individual sections explain the work well, but users have to travel a long way between setup, prompt and generation. This is a usability recommendation, not a broken-flow finding.

Add compact section-jump navigation and a summary of the selected model, duration, aspect, estimated cost and next unresolved requirement. Reuse the existing derived step structure and validation state. The summary must respect both the concept lane and the existing-prompt lane; do not invent a fixed eight-step flow for both.

Sources: [AdLab derived steps](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/ads/AdLab.tsx#L1388), [lane selection](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/ads/AdLab.tsx#L1829), [generation review](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/ads/AdLab.tsx#L3515).

For Blender, retain the existing hero “builder” shortcut. Add a clear current output-mode label and compact links between the explanation, builder and output if needed. Do not collapse important instructions by default without retaining an obvious way to reveal them.

**Acceptance:** Jump links do not submit forms. A sticky summary does not obscure fields, output controls or the mobile keyboard. Any mirrored action uses the existing handler and disabled state, with no additional API calls or changed generation eligibility.

### 6. Confirm imports and keep errors near the affected action — medium priority

**Verified working:** Prompt Builder imports into Ad Lab successfully, including a changed second prompt. Do not rewrite the importer based on a premature loading-state snapshot. Blender’s handoff already selects its appropriate lane.

Add a visible receipt after import, for example: “Prompt and 14-second duration imported,” with a “Review prompt” jump link and attachment instructions derived from existing reference checks. Preserve token conversion, positional ordering, lane semantics and duration transfer. Do not claim files were imported when only prompt text/settings were transferred.

Source: [AdLab handoff handling](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/ads/AdLab.tsx#L671).

The global error display is near the top of Ad Lab, far from some initiating actions. Show failures near the affected operation, announce them, preserve entered data, and retain technical details/request IDs in an expandable support section. Preserve existing reference-specific errors and render recovery. Do not auto-retry paid requests or recast every 422 as a false positive.

Source: [AdLab global error display](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/ads/AdLab.tsx#L1824).

**Acceptance:** Test import and failure states with mocked responses; the user sees what arrived, what failed and what action is available without returning to the page top.

### 7. Clarify spend and comparison copy — medium priority

**Source-confirmed:** “Session spend” uses the shared `studio-session-spend` key in localStorage across Ad Lab, Campaign Studio and Packshots. It persists beyond a page session and is not an authoritative billing statement.

Rename the display to “Estimated spend on this browser” or similarly accurate wording, with a brief scope explanation. Preserve calculations, persistence and server-side budget enforcement. Do not add a “reset budget” action. Sources: [StudioWizard.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/studio/StudioWizard.tsx#L101), [PackshotStudio.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/packshots/PackshotStudio.tsx#L169), [AdLab.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/ads/AdLab.tsx#L131).

Build vs. Buy’s table says creative suites have “None — UI only” workflow integration, while the same page describes plugins, MCP and REST APIs. Align the summary with the page’s own more nuanced explanation, such as “Varies by suite and plan.” This flags an internal contradiction, not an independent verification of every vendor claim. Source: [build-vs-buy/page.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/build-vs-buy/page.tsx#L73).

## Optional additions worth considering

### A. Recoverable drafts and Undo — strongest addition

Prompt Builder retained its draft through internal navigation in this tested version, but a full reload cleared it. Clear also erased it immediately with no Undo. Blender’s builder similarly initializes from component state; its refresh behaviour was inferred from code, not separately tested.

Add versioned autosave for text/settings, a saved/restored indicator, and Undo for Clear or loading a worked example. Start with Prompt Builder and the two Blender output modes; consider other forms after agreeing on attachment handling. Keep existing prompt generation/export behaviour unchanged.

Persist no passcodes or API keys. Do not put large base64 files into localStorage. If attachments are not retained, preserve role/order metadata and explicitly request reattachment. Handle unavailable storage gracefully. Keep Playbook’s checklist reset-per-asset behaviour; its lack of persistence is intentional.

Acceptance: reload restores the same draft; mode changes do not overwrite another draft unexpectedly; Clear/example loading can be undone; storage failure does not stop editing. Sources: [PromptBuilder state](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/prompts/PromptBuilder.tsx#L59), [Blender builder state](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/blender/BlenderBriefBuilder.tsx#L72).

### B. Model search and mobile comparison

The Models table has a 640px minimum width. It scrolls within its container correctly, but comparing a model with its “job” column requires horizontal panning on mobile. Add stacked mobile rows/cards and optional search/category filters while retaining the complete desktop table and notes.

Use the existing model registry; do not fork pricing/capability data. Audio entries already exist in the registry but the current table selects only image/video entries. Exposing them is a useful optional extension, with their correct units. Do not change model IDs, prices, routing or generation controls as part of this UX pass. Source: [models/page.tsx](https://github.com/ajwadrauf/portfolio/blob/fcf831d/src/app/ai-studio/models/page.tsx#L51).

### C. Campaign output bundle — lower priority

Consider “Download completed pack” for Campaign Studio’s completed outputs, alongside every existing individual download. Include only finished assets and communicate any omissions. Packshots already has Download all and Retry failed; do not rebuild those features. This needs output-state testing and is separate from the basic accessibility fixes.

## Preserve and verify

Keep all routes, model choices, recipe/custom-prompt lanes, reference roles/tokens, upload limits and encoders, exclusion handling, audio options, exports, pricing calculations, live/demo gating and render recovery. Keep existing missing-reference warnings and the allowed “Generate anyway” path; a new summary should explain existing rules, not impose new ones.

Retain the two Blender videos and their distinction as motion guide and shaded render. Both are Blender outputs; do not relabel the shaded render as a Seedance result. Preserve the comparison controls and current portfolio styling. Do not simplify the existing Reveal component’s scroll checks/failsafe.

Suggested implementation order: shared accessibility fixes → mobile navigation and field labels → workflow feedback/copy → separately selected additions. Review the final diff to ensure API routes, payloads and routing logic have not changed incidentally.

After implementation, run the repository’s required checks and focused UI tests: keyboard upload/modal; 320/390/736/1440px layouts; both Ad Lab lanes; repeated prompt handoff; mocked loading/error/completed states; existing batch actions and recovery. If autosave is included, test reload, Undo and unavailable storage. A successful production render was not part of this audit. No deployment is requested by this handoff itself.
