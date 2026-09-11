import { H3_RESOLUTIONS, h3Cost } from "@/lib/h3Video";
import type { VideoResolution } from "@/lib/videoCost";

export function H3VideoSettings({ resolution, onChange, seconds, imagePixels, videoSeconds, audioSeconds, pending }: {
  resolution: VideoResolution; onChange: (value: VideoResolution) => void; seconds: number;
  imagePixels: number; videoSeconds: number; audioSeconds: number; pending: boolean;
}) {
  const quote = (value: string) => h3Cost({ seconds, resolution: value, imagePixels, videoSeconds, audioSeconds });
  const current = quote(resolution);
  const descriptions = { "480p": "Draft · check motion and shot order", "768p": "Native · recommended for the first full film", "1080p": "Refined from 768p · higher output cost" };
  return <fieldset className="mt-5 border-t border-border-soft pt-4">
    <legend className="label pt-4">H3 Max resolution</legend>
    <div className="mt-2 grid gap-2 md:grid-cols-3">{H3_RESOLUTIONS.map((value) => <label key={value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${resolution === value ? "border-accent bg-accent/[0.04]" : "border-border-soft bg-surface"}`}>
      <input type="radio" name="resolution" className="mt-1 accent-[var(--accent)]" checked={resolution === value} onChange={() => onChange(value)} />
      <span><span className="block text-sm font-semibold">{value} · ~${quote(value).total.toFixed(2)}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{descriptions[value]}</span></span>
    </label>)}</div>
    <p className="mt-3 text-xs leading-relaxed text-muted">Estimated picture ${current.output.toFixed(2)} + reference inputs ${current.references.toFixed(2)} = <strong className="text-foreground">~${current.total.toFixed(2)}</strong>. ElevenLabs is separate. {pending && "Reading media metadata; this estimate is provisional."}</p>
    <details className="mt-2 text-xs leading-relaxed text-muted"><summary className="min-h-9 cursor-pointer font-semibold text-accent">How H3 pricing works</summary><p>Output is $0.05/s at 480p, $0.08/s at 768p or $0.16/s at 1080p. References share 4,096 included tokens; additional tokens cost $0.02 per 1,000. Images use measured pixel area and clips use measured duration. No promotional discount is assumed.</p><p className="mt-2">The 1080p reference-video estimate uses the 768p source rate; fal does not publish a separate 1080p input table. Confirm the final charge in fal.</p><a className="inline-flex min-h-9 items-center font-semibold underline" href="https://fal.ai/models/minimax/h3-max/reference-to-video" target="_blank" rel="noreferrer">H3 Max pricing ↗</a></details>
  </fieldset>;
}
