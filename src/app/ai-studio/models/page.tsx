import type { Metadata } from "next";
import { MODELS } from "@/lib/models";
import { ModelExplorer } from "@/components/studio/ModelExplorer";

export const metadata: Metadata = {
  title: "Model Landscape — AI Content Studio",
  description:
    "The 2026 AI production model landscape: image and video models compared by strengths, cost and the jobs they should own.",
};

const IMAGE_NOTES = [
  {
    name: "Nano Banana Pro (Gemini 3 Pro Image)",
    take: "The studio's default for detailed product stills and text-sensitive work. Review generated lettering against approved copy. Campaign Studio also offers locally typeset EN/FR layouts when exact words should remain editable.",
  },
  {
    name: "Nano Banana 2 / Flash Image",
    take: "The configured lower-cost image route for variations. Compare it against an approved hero and check the actual output; lower cost alone does not establish that it meets the brief.",
  },
  {
    name: "Flux 2 Pro (Black Forest Labs)",
    take: "A configured route for photographic hero imagery. Use the same product reference when comparing its material detail and lighting with another route; evaluate the result on the actual campaign rather than a general ranking.",
  },
  {
    name: "Ideogram (not wired in, on the radar)",
    take: "The typography specialist. If the studio's flyer/promo tile volume grows, a dedicated text-in-image model is the next evaluation — a good example of the continuous pilot-and-adopt loop.",
  },
];

const VIDEO_NOTES = [
  {
    name: "Veo 3.1 (Google)",
    take: "The direct Gemini video route used by this studio, including Fast and Standard choices. Native audio is supported; reference-audio input and a native-audio off switch are not implemented on this route here. Inspect picture and sound together before choosing a take.",
  },
  {
    name: "Kling 3.0 (Kuaishou)",
    take: "Two configured fal routes for short product motion. This app offers fixed 5- or 10-second durations. Standard returns silent picture; Pro is treated as audio-on. Compare the exact scenario above rather than a blanket price multiple.",
  },
  {
    name: "Seedance 2.5 (ByteDance) — reference-to-video",
    take: "The configured multimodal route for the Blender-to-film workflow. Image, video and audio references each receive a role and positional token. The app supports up to 30-second output and limits reference output to 480p or 720p. A motion guide supplies direction; generated timing, product identity and text still need review. Video inputs affect the estimate as well as the output duration.",
  },
  {
    name: "Runway Gen-4",
    take: "The configured image-to-video route can be tested against the same product brief. Motion brushes and a general video-to-video editor are not wired into this studio; controls in a vendor's own application should not be confused with this integration.",
  },
  {
    name: "Models outside the configured roster",
    take: "A model appearing in a vendor announcement does not make it an available route here. Adoption requires an endpoint adapter, input validation, a cost estimate and a test against a real production brief. Keep projects exportable so the work survives a vendor change.",
  },
];

export default function ModelsPage() {
  const images = Object.values(MODELS).filter((m) => m.kind === "image");
  const videos = Object.values(MODELS).filter((m) => m.kind === "video");
  const audio = Object.values(MODELS).filter((m) => ["music", "sfx", "voice"].includes(m.kind));

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <p className="chip mb-4">Configured routes · Reviewed 10 September 2026</p>
      <h1 className="text-[clamp(2rem,4vw,2.75rem)] tracking-[-0.035em]">
        The model landscape, and why routing beats picking
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        There is no single best model — there are jobs, and models that are
        currently best at them, at a price. A production studio&apos;s edge is a
        routing table it re-evaluates monthly, not a favorite tool. This page is
        the live routing table behind the Studio demo.
      </p>

      <ModelExplorer />

      <details className="mt-10 rounded-md border border-border-soft p-5"><summary className="cursor-pointer text-xl">Configured model inventory</summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border-soft text-left text-muted">
              <th className="py-2 pr-4 font-semibold">Model</th>
              <th className="py-2 pr-4 font-semibold">Billing basis</th>
              <th className="py-2 font-semibold">Job it owns here</th>
            </tr>
          </thead>
          <tbody>
            {[...images, ...videos, ...audio].map((m) => (
              <tr key={m.id} className="border-b border-border-soft/50 align-top">
                <td className="py-3 pr-4 font-semibold">{m.label}</td>
                <td className="py-3 pr-4 whitespace-nowrap text-muted">
                  {m.id.startsWith("seedance") ? "Tokens · size + output + video input" : m.unit === "character" ? "Characters" : m.billingIncrementSeconds ? "Started minute" : m.unit === "image" ? "Output size + applicable references" : "Output seconds"}
                </td>
                <td className="py-3 text-muted">{m.bestFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted/70">
        Rates are configured estimates, not live quotes. Use the scenario controls above and verify the linked provider source before budgeting a production run.
      </p>
      </details>

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
