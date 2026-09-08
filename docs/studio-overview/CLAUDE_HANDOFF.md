# Improve the AI Content Studio overview

## Scope

Ajwad wants `/ai-studio` to communicate through visible work as well as prose. Add his ice-cream Blender animation in two passes, side by side, and make the page easier to scan and navigate. Implement this in your current application checkout while preserving the homepage and navigation work already completed.

**Read repository-root `AGENTS.md` first.** The reviewed application base is `3854053` on `claude/loblaw-ai-content-studio-701jhf`, not `main`. It includes Claude's new homepage, shared wordmark/palette, and prominent project buttons. Recheck current HEAD and preserve any later edits. Follow the installed Next.js documentation in `node_modules/next/dist/docs/` before framework changes.

This handoff branch is **`codex/studio-overview`**. It contains media and instructions, not an implemented redesign. Do not replace the entire application with this branch or reset your current work. The existing instruction is to show a reviewable result before publishing; do not merge into the deploying branch or deploy unless Ajwad explicitly asks.

## Get the assets

From your chosen implementation checkout, first check that these paths have no local edits, then import only the handoff files:

```sh
git fetch origin codex/studio-overview
git restore --source=origin/codex/studio-overview -- public/studio/cream docs/studio-overview
```

This does not import root `vercel.json`. The handoff branch's deployment guard disables only `codex/studio-overview`; if pushing another implementation branch before approval to publish, add an equivalent branch-specific guard without removing existing Vercel settings.

## What is wrong with the current page

- The opening and long mandate mapping delay the actual work. Show the Blender study before the detailed production philosophy.
- The overview presents four tools while Blender is only in navigation. Make the Blender-to-generative-video workflow visible and explain what each pass is for.
- Avoid the link-discoverability issue just fixed on the homepage: all primary destinations need obvious button styling before hover.
- The long model/price table duplicates the dedicated model page, and hardcoded totals such as “thirteen models” can drift. Give the registry a clear destination instead of repeating its entire contents.

## Proposed page order and copy

### 1. Compact editorial hero

Use the existing warm ivory, ink, plum and olive palette. Reuse the current fonts and shared navigation. A large headline and concise introduction should lead into the work without creating another full screen of copy.

**Headline:**

> Make the work.<br>
> Build the system.

**Introduction:**

> Product imagery, campaigns and motion, connected by clear briefs, model choices and quality checks. Explore the tools, then see how I plan the work in Blender before taking it into generative video.

Two visible buttons: **Explore the tools** → `#tools`, and **Watch the Blender study** → `#motion-study`. Keep the existing portfolio/recruitment context in supporting copy if useful; do not imply an unverified job title or employment claim.

### 2. Featured study: Cream in motion

Place this immediately after the hero, on a black or very dark surface with strong text contrast. On desktop, use a short editorial introduction beside the two portrait players. On smaller screens, move the introduction above them. Keep the two videos alongside each other when the space permits, with full-size links for close inspection.

**Title:** “Cream in motion.”

**Supporting line:** “18 seconds. Seven shots. One camera plan.”

**Explanation:**

> The motion guide settles the camera, timing and action. The shaded render adds lighting, texture and flavour colours. Both are built in Blender; the guide can then become a motion reference for a separate Seedance pass.

| Placement | Visible label | Source | Poster |
| --- | --- | --- | --- |
| Left | **Motion guide** · 720 × 1280 | `/studio/cream/motion-guide.mp4` | `/studio/cream/motion-guide-poster.jpg` |
| Right | **Shaded Blender render** · 1080 × 1920 | `/studio/cream/shaded-render.mp4` | `/studio/cream/shaded-render-poster.jpg` |

Below the left label: “Simple materials. Camera, timing and action.” Below the right: “Higher fidelity. Lighting, texture and colour.”

**Accuracy matters:** these are both authored Blender outputs. Do not call the right pane “Seedance result,” “AI final,” or “photoreal final.” The guide's matte colours identify geometry, not the final flavours. The tubs intentionally have placeholder packaging. The cream motion is procedural art direction, not a baked fluid simulation. This is a portfolio concept, not a claimed client campaign. Flavours are vanilla, chocolate and strawberry.

Add clear links from this section to **Build a Blender brief** (`/ai-studio/blender`) and **Open Ad Lab** (`/ai-studio/ads`). Do not automatically submit a generation or populate paid API inputs.

### 3. Clear ways into the tools

Use the heading **“Choose your starting point.”** Present these six destinations with concise, task-oriented descriptions and consistent, prominent link buttons:

| Destination | What a visitor can do |
| --- | --- |
| Ad Lab — `/ai-studio/ads` | Shape a product ad with a beat sheet, references and sound direction |
| Campaign Studio — `/ai-studio/studio` | Build an editable campaign brief and a multi-format creative pack |
| Packshot Studio — `/ai-studio/packshots` | Generate product views and review reconstructed angles |
| Blender — `/ai-studio/blender` | Build a shot brief for editable 3D motion guidance |
| Prompt Builder — `/ai-studio/prompts` | Give references distinct roles and plan the timeline |
| Model landscape — `/ai-studio/models` | Compare the configured models and choose a route for the job |

Retain accurate existing product details. Link cards may be clickable as a whole, but the action inside must visibly look clickable. Do not nest a link or button inside another link. Preserve the homepage's accessible button treatment; do not revert to small accent text.

### 4. Shorter production story and access note

Keep the existing hands-on production, workflow, model-evaluation and governance story, but condense it into a scannable section after the visible work and tools. Use existing facts and links to **Playbook**, **Build vs. Buy**, and **Model landscape** for detail. Remove the duplicate long price table from this overview rather than maintaining a second registry.

Avoid universal or dated model claims and invented metrics. If a count is necessary, derive it from the registry and describe what is counted accurately; multiple routes can belong to one model family. Prefer describing capability coverage without a count.

Keep a concise note that browsing/demo exploration is open and live generation uses the existing passcode/cost controls. Preserve the actual gating and estimated-cost behaviour. Keep Ajwad's existing email and LinkedIn contact destinations.

## Comparison interaction requirements

- Native `<video>` elements, full **9:16** framing and `object-fit: contain`. Both clips are exactly **18 seconds / 24 fps**. Never crop them into landscape cards.
- One clearly labelled **Play both / Pause both** control, plus **Restart** and a shared seek control. Both start from the same time. Correct noticeable drift while playing; this is coordinated browser playback, not a claim of frame-perfect synchronization.
- Click/tap either player to operate the pair, with visible play affordances before playback and keyboard-accessible controls.
- No autoplay, no indefinite loop, and no unnecessary mute control: both files are silent. Honour reduced motion and require deliberate playback for everyone.
- Use the supplied matching posters and `preload="none"`. Do not download or decode both full movies on page load.
- Pause both when the comparison leaves view, the tab becomes hidden, or one movie fails. Handle rejected `play()` calls and buffering honestly; do not leave a “Pause” label while nothing plays, or let one pane continue alone. Cancel stale asynchronous playback attempts after pause, navigation or unmount.
- Provide clearly labelled **Open motion guide** and **Open shaded render** links for native full-size playback, including a useful fallback when JavaScript or paired playback is unavailable.
- Support chapter selection using the exact time map below. Selecting a chapter should seek both panes, including before the videos have loaded. Shared seek must also work while paused.
- Dispose listeners, observers and any synchronization timers on unmount. Verify client navigation away and back does not duplicate playback handlers.

| Start | End | Chapter | Camera/action |
| --- | --- | --- | --- |
| 0 s | 2 s | Macro | Grazing macro arc across vanilla ridges |
| 2 s | 5 s | Spoon lift | Rising three-quarter dolly and cream release |
| 5 s | 7.5 s | Cream spiral | Low-to-high orbit around the scoop |
| 7.5 s | 10 s | Flavour burst | Orbit through three scoops and ingredients |
| 10 s | 12.5 s | Runway | Lateral product track |
| 12.5 s | 15 s | Overhead | Rotating descent over the three tubs |
| 15 s | 18 s | Hero landing | Pullback and rise, then final hold |

## Implementation boundaries

- Main page: `src/app/ai-studio/page.tsx`; keep content server-rendered.
- Suggested player: a new client component under `src/components/studio/` with a CSS module. No new video-player dependency is necessary.
- Existing `src/components/ClayCompare.tsx` uses a 4:3 crop, looping and sound controls. Do not reuse it unchanged for these portrait, silent clips; avoid regressing its existing consumers.
- Reuse the current design tokens. Keep styles scoped to this overview and comparison. Do not rewrite `Nav.tsx`, shared global styles, the implemented homepage, or `Reveal.tsx` for this task.
- Preserve Studio tools, authentication, model routing, request sizing and generation APIs. No secrets or `.env.local` values are needed to build the overview.
- The supplied MP4s are approximately 7 MB combined and ready for static hosting. Keep them under `public/studio/cream/` initially; external media hosting can be a later explicit choice.

## Acceptance and handback

Run the repository's build and available checks. Review at 1440, 1024, 736, 390, 360 and 320 px. Verify no page overflow, no video cropping, readable player labels, visible focus, and touch targets of at least 44 px. Measure video requests before interaction to confirm lazy loading.

Exercise paired play/pause/restart, seeking and chapters before/after first load, the end of the film, one failed source, buffering, visibility changes, and client navigation. Smoke-check links into the existing Studio tools without submitting paid generations. Inspect mobile layout and report physical-device performance as unverified unless actually measured.

Show Ajwad desktop/mobile screenshots and a working local or otherwise explicitly approved preview. Explain that both passes are Blender renders. Keep the production branch and live site unchanged until he asks to publish.
