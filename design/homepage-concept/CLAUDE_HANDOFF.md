# Homepage redesign — implementation handoff

## Request and current state

Ajwad asked for a redesigned homepage, incorporating his Blender animation, an interactive 3D element, and a stronger story about staying ahead as AI models change. This branch shares a complete standalone concept for implementation. It does **not** implement or deploy a replacement homepage.

Read the repository-root **`AGENTS.md` first**. The project uses Next.js 16.3.3, React 19.2.8, Tailwind 4 and TypeScript at the reviewed commit. Follow the installed Next.js documentation in `node_modules/next/dist/docs/` before changing framework code, and recheck package versions if the branch has advanced.

| Context | Value |
| --- | --- |
| Repository | `ajwadrauf/portfolio` |
| Design handoff branch | `codex/homepage-concept` |
| Design folder | `design/homepage-concept/` |
| Reviewed application base | `6ec61e6` |
| Existing deploying/default branch | `claude/loblaw-ai-content-studio-701jhf` — **not `main`** |
| Deployment status | No application changes or deployment in this handoff |

Preserve Ajwad's current instruction to preview changes before deployment. Make a reviewable implementation and obtain an explicit instruction before merging into the deploying branch or publishing. Root `vercel.json` on this handoff branch disables Vercel deployment for this exact branch name. If implementation uses another branch, that setting does not cover it; configure an equivalent branch-specific disable before pushing while the no-deployment instruction applies. Preserve any Vercel settings added by subsequent work.

## Get the design into an existing Claude checkout

Read and preview directly on the handoff branch, or fetch the folder into your chosen implementation branch without replacing current application code:

```sh
git fetch origin codex/homepage-concept
git show origin/codex/homepage-concept:design/homepage-concept/CLAUDE_HANDOFF.md
# In a clean implementation checkout; this command brings in only the concept folder.
git restore --source=origin/codex/homepage-concept -- design/homepage-concept
```

Check for local edits to this folder before restoring. Do not reset the user's checkout or overwrite unrelated work. Importing just the folder does not copy the root deployment guard.

Run the standalone preview as described in [README.md](README.md). Inspect the desktop, mobile and assembled screenshots alongside the functioning page. Treat this as a component/content reference, not HTML to inject wholesale with `dangerouslySetInnerHTML`.

## Page structure and exact direction

1. **Portfolio navigation:** Ajwad Rauf wordmark, Selected work, My approach, Let's talk. Keep Studio navigation independent.
2. **Hero:** “AI moves fast. I make it work.” Support it with “I turn emerging AI into creative work and production systems people can actually use.” The interactive sculpture occupies the other half on desktop and stacks on mobile.
3. **TOKEN film:** black cinematic section with the actual revised 12-second Blender movie and accessible play/pause, progress and fullscreen controls. Use the included poster and film. No autoplay or decorative replacement of the user's movie.
4. **Selected work:** AI Content Studio, Persopot, Project Forge. The HTML contains the proposed complete descriptions and destination links. Keep the ice-cream pictures labelled “Current exploration / Ice cream / concept references.” Do not present those references as generated Studio outputs. Persopot and Forge illustrations are conceptual graphic treatments.
5. **Approach:** “The next model is coming. So is the next brief.” Explain testing emerging capabilities against production needs: packaging, French copy, deadlines, budget, and repeatable workflows. Close the story with “Staying ahead is a practice. Curiosity. Testing. Shipping. Repeat.”
6. **Contact:** “Let's build what's next.” Keep the real contact details and Toronto location. Preserve current project facts; recheck anything changed since the reviewed base.

Use the full copy in `page-fragment.html`. Keep the warm ivory, plum accents, olive surfaces and black film section. Space Grotesk supplies the main voice; Instrument Serif adds expressive emphasis. Match the supplied hierarchy and spacing rather than replacing the design with generic cards.

## Map to the existing Next.js application

These are proposed implementation locations; adapt names to repository conventions.

| Existing or proposed file | Implementation responsibility |
| --- | --- |
| `src/app/page.tsx` | Server-rendered homepage sections, content and project links |
| `src/components/HomeNav.tsx` | Portfolio navigation; preserve desktop/mobile and anchor behaviour |
| `src/components/home/TokenSculpture.tsx` (new) | Client component for the Three.js scene and assembly control |
| `src/components/home/TokenFilm.tsx` (new) | Client component for movie controls and visibility handling |
| `src/components/home/token-wordmark.ts` (new) | Typed coordinate data converted from `assets/wordmark.js` |
| A homepage CSS module or scoped styles | Port `styles.css` without overriding Studio tokens globally |
| `src/app/layout.tsx` or a homepage font module | Reuse the existing Space Grotesk; load Instrument Serif using the installed Next.js font API |
| `public/homepage/` (new) | Film, poster and three reference JPEGs, or approved equivalent asset hosting |

Use the installed framework documentation for client boundaries, dynamic imports, fonts, media and metadata. Add Three.js as an application dependency when implementing; the vendored files are for this standalone preview. Do not add a second React rendering layer. Preserve `THREE-LICENSE.txt` if redistributing the vendored runtime.

Convert own-domain absolute project links to internal Next links where appropriate. Preserve external Persopot and LinkedIn links. Retain current SEO metadata and accessibility while updating the homepage title/description to match the final copy. Do not carry the prototype's `noindex,nofollow` into an approved production homepage.

The prototype CSS imports Google Fonts and uses `#ajwad-home` for scoping. Replace the import with the repository's Next font approach in production. The standalone IIFE and `window.TOKEN_WORDMARK` are prototype wiring; use React refs, effects and typed imports in the app.

## 3D scope and required behaviour

The prototype uses Three.js **0.180.0**, one instanced mesh with **800 boxes / 9,600 triangles**, and a procedural studio environment. The wordmark target coordinates come from the original Blender project. The opening sculpture is a new browser-friendly interpretation, not a direct Blender scene import.

- Drag or touch the sculpture to orbit it. Keep vertical page scrolling usable on touch devices.
- **Assemble** forms AJWAD RAUF. **Explore again** returns to the sculpture; expose state with `aria-pressed`.
- The opening drift settles after approximately 4.5 seconds. Draw on interaction and stop rendering when idle, outside the viewport, or in a hidden tab.
- Cap device pixel ratio at 1.65 unless real-device measurements justify a different limit.
- Honour reduced motion: skip animated morphing and opening drift. Keep text and controls readable without WebGL or JavaScript.
- Load the 3D code in its client boundary without blocking the server-rendered headline. Provide a useful fallback on import failure or WebGL failure.
- Productionize lifecycle handling: cancel animation frames, disconnect observers, remove listeners, dispose geometry/material/environment/renderer on unmount, and handle context loss. Verify remounts and client navigation do not duplicate canvases or listeners. The standalone script is a single-page prototype and is not an effect cleanup implementation.

Keep this scope initially. Full Blender scenes, fluid simulations, heavy post-processing and continuous scroll-driven rendering are not required to reproduce this concept. Measure on a real midrange phone before treating performance as verified.

## Film and imagery

`assets/token-film.mp4` is the revised **1920 × 1080, 30 fps, 12-second** film. Its end card reads **“Built with GPT-6 Astra + Blender.”** The old **“I take the credit.”** sentence is gone; the name and `ajwadrauf.com` have more space between them. Keep the pitch-black background and the new end card. This is the portfolio-quality video, not the lower-resolution Seedance guide.

Use `preload="none"` with `token-poster.jpg`. Start playback only after a deliberate play action, pause offscreen/when the document is hidden, keep `playsinline`, and provide accessible controls with native fallback. Preserve 16:9 video framing without cropping the end card. Lazy-load the reference pictures with dimensions to avoid layout shifts. The JPEGs in this folder are already sized for the concept.

Do not invent customer quotes, traffic/revenue figures, model counts, awards, product screenshots or unsupported claims of performance. “Staying ahead” is supported by the demonstrated practice and tools, not a claim to know every new release.

## Existing functionality to preserve

- `src/components/Nav.tsx` and the `/ai-studio` application flows, authentication/passcode gating, model routing, media encoding and billing behaviour.
- `Reveal.tsx`: its scroll-position check and two-second failsafe support anchor jumps that an IntersectionObserver alone can miss. Do not simplify these away. Homepage content must remain visible when a section is jumped over or reached by an anchor.
- Existing case-study routes, contact links, metadata and responsive navigation.
- Existing environment configuration. No new generation API access is needed for this homepage. Use names from `.env.example` if discussing configuration; do not request or copy secret values.
- Avoid global changes to colours, typography or resets that alter Studio screens.

## Review before completion

The standalone concept has recorded browser checks in `review/checks.json`. Those results do not establish that a future React port works. For the implementation:

1. Run the repository's current build and appropriate available checks after reading package scripts.
2. Compare screenshots at 1440, 1024, 736, 390, 360 and 320 px. Check clipping, line breaks, spacing, film framing and mobile touch scrolling.
3. Exercise assembly/reset, drag, keyboard controls, video playback/pause/seek/fullscreen, section anchors and browser back/forward navigation.
4. Test reduced motion, disabled/failed WebGL and visible content before hydration. Check focus, contrast, headings and meaningful alternative text.
5. Verify 3D cleanup across client navigation, idle/offscreen rendering, movie lazy loading and actual mobile performance. Report measurements honestly.
6. Smoke-check Studio and existing case-study links for regressions. Confirm no unsupported marketing claims or accidental prototype `noindex` remain in the proposed production page.
7. Show Ajwad the reviewable implementation and what changed. Keep the deploying branch untouched until he asks to publish or merge.
