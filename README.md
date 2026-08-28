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
| `FAL_RUNWAY_ENDPOINT` | `fal-ai/runway-gen4/turbo/image-to-video` | https://fal.ai/models |
| `FAL_SEEDANCE_VIDEO_ENDPOINT` | `bytedance/seedance-2.5/image-to-video` | https://fal.ai/models |
| `FAL_SEEDANCE_REF_ENDPOINT` | `bytedance/seedance-2.5/reference-to-video` | https://fal.ai/models |
| `FAL_MUSIC_ENDPOINT` | `fal-ai/elevenlabs/music` | https://fal.ai/models |

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

Needs a Node host — the API routes are server-side, so static hosts
(GitHub Pages, shared cPanel hosting) will not work. Vercel is simplest.

1. Import the GitHub repo at https://vercel.com/new
2. Set the production branch under **Settings → Git**
3. Add environment variables under **Settings → Environment Variables**
   (see the gate table below — set these *before* the first deploy, so the
   site is never briefly live with ungated keys)
4. Add the custom domain under **Settings → Domains** and follow the DNS
   records Vercel shows you

Every route caps at `maxDuration = 60`, which fits Vercel's Hobby tier.
Video generation is unaffected: the start route returns an operation id
immediately and the browser polls, so no single request runs long.

### Pointing a Namecheap domain at it

Keeping DNS at Namecheap (rather than moving nameservers to Vercel) leaves
any email and existing records on the domain untouched. In Namecheap:
**Domain List → Manage → Advanced DNS**, with **Nameservers** left on
*Namecheap BasicDNS*.

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | the IP on Vercel's domain card | Automatic |
| CNAME Record | `www` | the target on Vercel's domain card | Automatic |

Use the values Vercel shows for *your* project rather than any figure found
in a blog post. Vercel now assigns per-project anycast addresses, so the
long-standing `76.76.21.21` / `cname.vercel-dns.com` pair is no longer the
answer for every project — it still resolves, but the card is the source of
truth.

Two Namecheap-specific things that waste an afternoon otherwise:

- **Delete the parking records first.** A fresh Namecheap domain ships with
  a `CNAME @ → parkingpage.namecheap.com` and a URL Redirect record. An
  apex A record cannot coexist with them, and Namecheap will not always say
  so clearly.
- **The host field is `@` and `www`, not the domain.** Namecheap appends
  the domain itself; typing `ajwadrauf.com` there produces
  `ajwadrauf.com.ajwadrauf.com`.

Add both the apex (`ajwadrauf.com`) and `www` in Vercel, and set whichever
you prefer as primary — Vercel redirects the other. HTTPS is issued
automatically once the records resolve; propagation is usually minutes, but
give it up to an hour before assuming something is wrong.

Check it from outside your own browser cache with:

```bash
dig +short ajwadrauf.com
dig +short www.ajwadrauf.com
```

### Protecting your API keys on a public deployment

A public URL with real keys would otherwise let anyone spend your credits.
The live-mode gate handles this: **without the passcode the site serves demo
mode**, so browsing is open to everyone and only generation is gated.

Set these in Vercel:

| Variable | Purpose |
|---|---|
| `LIVE_PASSCODE` | Unlocks live generation. Share it in your application. |
| `SESSION_SECRET` | Signs the session cookie. Any long random string. |
| `LIVE_BUDGET` | Live generations per unlocked session (default 40). |

Generate strong values with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

How it holds up:

- The passcode never reaches the browser; it is compared server-side in
  constant time.
- Unlocking issues an **HMAC-signed, HttpOnly** cookie — JavaScript cannot
  read it and it cannot be forged or edited without `SESSION_SECRET`.
- The remaining budget lives **inside** the signed cookie, so editing it to
  get more generations invalidates the signature and locks the session.
- Unlock attempts are rate-limited per IP (8 per 15 min) with a uniform
  delay on failure, so brute-forcing is slow and pointless against a
  high-entropy passcode.
- **Every paid route re-checks the gate server-side.** A crafted request
  with no valid cookie receives mocks, never a live generation.
- If you deploy keys *without* a passcode, a red **"⚠ Ungated live keys"**
  banner runs under the nav on every studio page, naming the risk and the
  fix — the misconfiguration is impossible to miss rather than merely
  visible.

Still worth setting provider-side caps as a final backstop:
https://ai.studio/spend for Gemini, and a spending limit in the fal.ai
dashboard.
