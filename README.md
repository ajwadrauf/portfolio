# AI Content Studio — Portfolio Demo

A working AI production pipeline: **one product photo in, a multi-format
retail campaign out.** Upload a product image and the app analyzes it,
interviews you only where needed, writes one campaign brief, and generates
8 deliverables — hero still, format adaptations (9:16, 16:9), bilingual
EN/FR promo tiles with rendered headline text, a seasonal variant, and two
videos with native audio — routing each to the model best suited and priced
for the job.

**Stack**: Next.js (App Router) · Gemini API (Gemini Flash reasoning/vision,
Nano Banana image models, Veo 3.1 video) · fal.ai (Flux 2 Pro, Kling 3.0) ·
Tailwind CSS 4 · Zod.

## Pages

| Route | What it is |
|---|---|
| `/` | Landing — the pitch, pipeline and metrics |
| `/studio` | The live generating tool (5-step wizard) |
| `/packshots` | GS1 planogram packshot generator: product-on-white at every angle from existing reference photos, with grounded-vs-reconstructed QA flags, plus A/B challenger bake-offs |
| `/ads` | Ad Lab: preset mini product ad recipes (structured scene-by-scene prompts with audio design) — swap in any SKU, AI-compose the final Veo prompt, generate |
| `/models` | Model landscape: costs, strengths, ready/emerging/not-viable |
| `/build-vs-buy` | One-pager: suites vs. aggregators vs. direct APIs |
| `/playbook` | Production playbook: workflow, prompt system, quality gates, governance |

## Running locally

```bash
npm install
npm run dev
```

With no API keys the app runs in **demo mode**: every endpoint returns
clearly-labeled zero-cost mocks, so the entire wizard can be exercised
end-to-end without spending a cent.

## Going live (do this in order — it protects your credits)

### 1. Get keys

- **Gemini**: create an API key at https://aistudio.google.com/apikey
  (covers reasoning, vision, Nano Banana image gen, and Veo video).
- **fal.ai**: create a key at https://fal.ai/dashboard/keys
  (covers Flux stills and Kling video).

Set them in `.env.local` (never commit this file):

```bash
GEMINI_API_KEY=...
FAL_KEY=...
```

Either key alone works — deliverables whose provider has no key simply
render as mocks. Set `DRY_RUN=1` to force demo mode even with keys present.

### 2. Verify model IDs before the first paid call

Model IDs and endpoint slugs move fast. They all live in
`src/lib/models.ts` and can be overridden by env var without code changes:

| Env var | Default | Verify at |
|---|---|---|
| `GEMINI_REASONING_MODEL` | `gemini-2.5-flash` | https://ai.google.dev/gemini-api/docs/models |
| `GEMINI_IMAGE_PRO_MODEL` | `gemini-3-pro-image-preview` | same |
| `GEMINI_IMAGE_FAST_MODEL` | `gemini-2.5-flash-image` | same |
| `GEMINI_VEO_MODEL` | `veo-3.1-generate-preview` | same |
| `GEMINI_VEO_FAST_MODEL` | `veo-3.1-fast-generate-preview` | same |
| `FAL_FLUX_ENDPOINT` | `fal-ai/flux-2-pro` | https://fal.ai/models |
| `FAL_KONTEXT_ENDPOINT` | `fal-ai/flux-pro/kontext/max/multi` | https://fal.ai/models |
| `FAL_SEEDREAM_ENDPOINT` | `fal-ai/bytedance/seedream/v4/edit` | https://fal.ai/models |
| `FAL_KLING_ENDPOINT` | `fal-ai/kling-video/v3/standard/image-to-video` | https://fal.ai/models |

### 3. Cheap smoke test (≈ $0.10 total)

1. Start the app with keys set; the Studio banner should show both providers
   connected.
2. Run **one** deliverable first: deselect everything except *Story
   Adaptation* (Nano Banana Flash, ~$0.04). Confirm it renders.
3. Then one Flux still (~$0.05). Then — only when stills work — one video
   (Kling ~$0.50 or Veo Fast ~$1.20).
4. Only after that, run a full pack.

If a call fails with a "model not found" style error, the model ID moved —
fix the env var per the table above, don't retry blindly.

### 4. Cost controls built in

- Pre-flight estimate + confirmation dialog before any live generation.
- Cost-efficient models are the defaults; premium tiers are explicit choices.
- Session spend tracker (top right of the Studio) persists per browser.
- Videos poll for up to 10 minutes; a timeout does **not** mean the charge
  failed — check the provider dashboard before re-running.

## Architecture notes

- **Demo mode as a first-class feature** — every route mocks itself when its
  provider key is absent (`src/lib/mock.ts`). UX work and training never
  burn credits.
- **Server-side prompt assembly** — deliverable prompts are built on the
  server from the (human-edited) brief + per-format templates
  (`src/lib/deliverables.ts`), so the client can't send malformed prompts
  to paid APIs.
- **Image grounding** — the uploaded photo is passed to every generation
  (reference image for stills, first frame for video), so outputs feature
  the actual product, not a look-alike. The client downscales/re-encodes to
  JPEG ≤1024px before upload to keep payloads small.
- **Async video** — initiate-then-poll: the start route returns an operation
  name (Veo) or queue request id (fal) immediately; the client polls a
  stateless status route every 12s (≤10 min). Veo files are streamed
  through `/api/video-file`, which attaches the API key server-side (locked
  to Google's host) so the key never reaches the browser.
- **One config for the model market** — IDs, prices and strengths live in
  `src/lib/models.ts`; swapping a model is a config edit, not a rebuild.

## Deploying

Any Node host works. Vercel is simplest: import the repo, set the env vars,
deploy. Video generation needs function `maxDuration` ≥ 60s (configured
per-route; on Vercel this requires a plan that allows it).
