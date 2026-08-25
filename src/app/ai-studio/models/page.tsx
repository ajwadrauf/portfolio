import type { Metadata } from "next";
import { MODELS } from "@/lib/models";

export const metadata: Metadata = {
  title: "Model Landscape — AI Content Studio",
  description:
    "The 2026 AI production model landscape: image and video models compared by strengths, cost and the jobs they should own.",
};

const IMAGE_NOTES = [
  {
    name: "Nano Banana Pro (Gemini 3 Pro Image)",
    take: "The reasoning-driven image model. Where it wins: text rendered inside images (packaging, promo badges, bilingual headlines), brand consistency across a series, and instruction-based editing. This makes it the backbone of retail versioning — EN/FR promo tiles are its signature use case here.",
  },
  {
    name: "Nano Banana 2 / Flash Image",
    take: "The volume tier. Roughly a quarter of Pro's price, fast, and good enough for format adaptations and seasonal rethemes where the hero already set the look. High-volume pipelines live or die on knowing when 'good enough' is good enough.",
  },
  {
    name: "Flux 2 Pro (Black Forest Labs)",
    take: "Best pure photorealism in market — food photography, texture, natural light. When the image itself is the product (hero shots, editorial), Flux earns its place. Weaker at in-image text, which is why routing matters instead of picking one 'best' model.",
  },
  {
    name: "Ideogram (not wired in, on the radar)",
    take: "The typography specialist. If the studio's flyer/promo tile volume grows, a dedicated text-in-image model is the next evaluation — a good example of the continuous pilot-and-adopt loop.",
  },
];

const VIDEO_NOTES = [
  {
    name: "Veo 3.1 (Google)",
    take: "The quality ceiling: native 4K, native 48kHz synchronized audio, best lip-sync available. The Fast tier at ~$0.15/s changes the economics of drafting — iterate on Fast, finish on Standard. Deep Gemini API integration means one vendor surface for reasoning + stills + motion.",
  },
  {
    name: "Kling 3.0 (Kuaishou)",
    take: "The value play at ~$0.10/s — 4-7x cheaper than premium tiers — with uniquely strong subject consistency across shots. That consistency is exactly what product content needs: the same can, jar or bag recognizable in every cut.",
  },
  {
    name: "Seedance 2.0 (ByteDance)",
    take: "The short-form product-ad workhorse: structured generation with strong multi-shot consistency — define the shot upfront and get repeatable results across a batch. Wired in as a video option here, and the natural default for high-volume vertical performance creative.",
  },
  {
    name: "Runway Gen-4",
    take: "The creative-control surface: motion brush, camera control, video-to-video. Built around iteration rather than one-shot generation, which is why it stays the tool a studio team works in daily — also wired in here so the same brief can be pushed through it.",
  },
  {
    name: "Sora 2 (OpenAI)",
    take: "A cautionary tale, on purpose: OpenAI discontinued the app in April 2026 and sunsets the API in September 2026. Building on it would have stranded a pipeline. Vendor-risk assessment is a core studio discipline, not paranoia.",
  },
];

export default function ModelsPage() {
  const images = Object.values(MODELS).filter((m) => m.kind === "image");
  const videos = Object.values(MODELS).filter((m) => m.kind === "video");

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <p className="chip mb-4">Point of view · August 2026</p>
      <h1 className="text-[clamp(2rem,4vw,2.75rem)] tracking-[-0.035em]">
        The model landscape, and why routing beats picking
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        There is no single best model — there are jobs, and models that are
        currently best at them, at a price. A production studio&apos;s edge is a
        routing table it re-evaluates monthly, not a favorite tool. This page is
        the live routing table behind the Studio demo.
      </p>

      <h2 className="mt-12 text-xl">Wired into this demo</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border-soft text-left text-muted">
              <th className="py-2 pr-4 font-semibold">Model</th>
              <th className="py-2 pr-4 font-semibold">List price</th>
              <th className="py-2 font-semibold">Job it owns here</th>
            </tr>
          </thead>
          <tbody>
            {[...images, ...videos].map((m) => (
              <tr key={m.id} className="border-b border-border-soft/50 align-top">
                <td className="py-3 pr-4 font-semibold">{m.label}</td>
                <td className="py-3 pr-4 whitespace-nowrap text-muted">
                  {m.unit === "image" ? `$${m.unitCost}/image` : `$${m.unitCost}/second`}
                </td>
                <td className="py-3 text-muted">{m.bestFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted/70">
        List prices as of August 2026; they inform the Studio&apos;s pre-flight cost
        estimator and are kept in one config file so drift is a one-line fix.
      </p>

      <h2 className="mt-12 text-xl">Stills — the read</h2>
      <div className="mt-4 space-y-4">
        {IMAGE_NOTES.map((n) => (
          <div key={n.name} className="card p-5">
            <h3 className="font-semibold">{n.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{n.take}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl">Video — the read</h2>
      <div className="mt-4 space-y-4">
        {VIDEO_NOTES.map((n) => (
          <div key={n.name} className="card p-5">
            <h3 className="font-semibold">{n.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{n.take}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl">Ready / emerging / not yet viable</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="card border-success/40 p-5">
          <p className="font-semibold text-success">Ready to use</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
            <li>Stills generation & editing for adaptations and versioning</li>
            <li>Text-in-image promo tiles (with a QA gate)</li>
            <li>Short-form video (5–8s) with native audio</li>
            <li>EN/FR headline localization with human review</li>
          </ul>
        </div>
        <div className="card border-warning/40 p-5">
          <p className="font-semibold text-warning">Emerging — pilot now</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
            <li>Multi-shot narrative spots (Seedance-class models)</li>
            <li>Automated brand-compliance checking</li>
            <li>Video restyling of existing footage (WAN-class)</li>
          </ul>
        </div>
        <div className="card border-danger/40 p-5">
          <p className="font-semibold text-danger">Not yet viable</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
            <li>Unreviewed publish-direct pipelines</li>
            <li>Long-form (30s+) fully generated spots at broadcast QC</li>
            <li>Photoreal likenesses of real people (policy, not tech)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
