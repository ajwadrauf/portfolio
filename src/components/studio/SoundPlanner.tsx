"use client";

import { useEffect, useState } from "react";
import { estimateCost } from "@/lib/models";
import { buildComposition, cueSheet, estimatedReadSeconds, planSeconds, soundTemplate, timedCues, VOICES, VOICE_MODEL_ID, wordCount, type SoundPlan } from "@/lib/soundPlan";

type Take = { url: string; spec: string; mock: boolean };
type Props = {
  plan: SoundPlan | null; onChange: (plan: SoundPlan | null) => void;
  duration: number; problem: string | null; onMatchDuration: (seconds: number) => void;
  canMatchDuration: boolean; busy: boolean; live: boolean;
  scoreToPlan: boolean; onScoreToPlan: (value: boolean) => void;
  onVoice: (body: { text: string; voice: string; stability: number }, label: string) => Promise<{ audioUrl: string; mock: boolean }>;
};

export function SoundPlanner({ plan, onChange, duration, problem, onMatchDuration, canMatchDuration, busy, live, scoreToPlan, onScoreToPlan, onVoice }: Props) {
  const [selected, setSelected] = useState(0);
  const [voice, setVoice] = useState<string>("Rachel");
  const [stability, setStability] = useState(0.5);
  const [takes, setTakes] = useState<Record<string, Take>>({});
  const [actual, setActual] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [generating, setGenerating] = useState(false);
  const index = Math.min(selected, (plan?.scenes.length ?? 1) - 1);
  const scene = plan?.scenes[index];
  const spec = JSON.stringify([scene?.line.trim(), voice, stability]);
  const take = scene ? takes[scene.id] : undefined;
  const fresh = take?.spec === spec;
  const cues = plan ? timedCues(plan) : [];
  const total = plan ? planSeconds(plan) : 0;

  useEffect(() => { setMessage(""); setVoiceError(""); }, [plan]);
  function changeCue(update: Partial<SoundPlan["scenes"][number]>) {
    if (plan) onChange({ ...plan, scenes: plan.scenes.map((s, i) => i === index ? { ...s, ...update } : s) });
  }
  function useTemplate(id: "narrated" | "rhythm" | "cream") {
    onChange(soundTemplate(id)); setSelected(0);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage("Copied."); }
    catch { setMessage("Clipboard unavailable. Download the cue sheet instead."); }
  }
  function download() {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([cueSheet(plan)], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = "ad-sound-cue-sheet.md"; a.click(); URL.revokeObjectURL(url);
  }
  async function generateVoice() {
    if (!scene) return;
    const cue = scene; const settings = spec;
    setGenerating(true); setVoiceError("");
    try {
      const result = await onVoice({ text: cue.line.trim(), voice, stability }, `${cue.title} · ${voice} · voiceover`);
      setTakes((previous) => ({ ...previous, [cue.id]: { url: result.audioUrl, spec: settings, mock: result.mock } }));
    } catch (e) { setVoiceError(e instanceof Error ? e.message : "Could not generate voiceover"); }
    finally { setGenerating(false); }
  }

  return <section aria-labelledby="sound-planner-title" className="my-5 overflow-hidden rounded-xl border border-border-soft">
    <div className="bg-foreground px-5 py-6 text-background sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-60">Plan before the render</p>
      <h3 id="sound-planner-title" className="mt-2 text-2xl tracking-tight">Give every scene a sound.</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed opacity-80">Write the voice. Leave room to hear the product. Build a score around the moments that matter.</p>
      <ol className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {["01 · Script & cues", "02 · Audition voice", "03 · Lock picture", "04 · Score & mix"].map((step) => <li key={step} className="border-t border-current/25 pt-2">{step}</li>)}
      </ol>
    </div>
    <div className="space-y-4 p-4 sm:p-5">
      {!plan ? <>
        <p className="text-sm text-muted">Start with a template. Its timings are editable; it does not inspect or rewrite your uploaded film.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([['narrated', '30s · Narrated story', 'Hook, reveal, detail, payoff, CTA.'], ['rhythm', '30s · Product rhythm', 'Music and product sounds, no voice.'], ['cream', '18s · Cream in motion', 'A starting score for the ice-cream film.']] as const).map(([id, title, desc]) => <button type="button" key={id} onClick={() => useTemplate(id)} className="rounded-lg border border-border-soft p-4 text-left transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"><span className="block text-sm font-semibold">{title} <span aria-hidden>↗</span></span><span className="mt-1 block text-xs leading-relaxed text-muted">{desc}</span></button>)}
        </div>
      </> : <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{plan.title} <span className="ml-1 font-mono text-xs text-muted">{total}s planned / {duration}s video</span></p>
          <button type="button" onClick={() => { onChange(null); onScoreToPlan(false); }} className="min-h-11 text-xs text-muted underline">Remove plan</button>
        </div>
        {problem && <div role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{problem}{canMatchDuration && total !== duration && <button type="button" onClick={() => onMatchDuration(total)} className="mt-2 block min-h-11 font-semibold underline">Set video duration to {total}s</button>}</div>}
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <label className="block"><span className="label">Narration</span><select aria-label="Narration workflow" className="input mt-1" value={plan.narration} onChange={(e) => onChange({ ...plan, narration: e.target.value as SoundPlan['narration'] })}>
            <option value="external">ElevenLabs voice · mix in editor</option><option value="native">Video model speaks these lines</option><option value="none">No narration</option>
          </select></label>
          <label className="block"><span className="label">Tempo · BPM</span><input aria-label="Score tempo" type="number" min={40} max={200} className="input mt-1" value={plan.bpm} onChange={(e) => onChange({ ...plan, bpm: Number(e.target.value) })} /></label>
        </div>
        <p className="text-xs leading-relaxed text-muted">{plan.narration === "external" ? "Audition each line before spending on picture. The video is asked to leave speech out; keep the original voice files for the final mix. An off-screen voiceover needs no lip-sync." : plan.narration === "native" ? "The exact lines and intended windows are appended to the video prompt. Listen for wording, pronunciation and timing; a separate voice recording gives you more control." : "The video is asked to leave speech out. Let music, silence and physical product sounds tell the story."}</p>
        <div className="flex min-h-20 gap-1" role="group" aria-label="Sound scene timeline">
          {cues.map((cue, i) => <button type="button" key={cue.id} aria-pressed={i === index} aria-label={`Edit sound scene ${i + 1}: ${cue.title}`} onClick={() => setSelected(i)} style={{ flexGrow: cue.seconds, flexBasis: 0 }} className={`min-w-0 rounded-md border px-1 py-3 text-center transition ${i === index ? 'border-accent bg-accent text-white' : 'border-border-soft bg-surface-2 hover:border-accent'}`}><span className="block font-mono text-xs">{i + 1}</span><span className="mt-1 block break-words text-[10px] sm:text-xs">{cue.start.toFixed(0)}–{cue.end.toFixed(0)}s</span><span className="mt-1 hidden truncate text-[10px] sm:block">{cue.title}</span></button>)}
        </div>
        <p className="text-xs text-muted">At {plan.bpm} BPM, a 4/4 bar lasts {(240 / (plan.bpm || 120)).toFixed(2)}s. Match major changes to musical phrases when possible. Changing tempo here never moves the edit.</p>
        {scene && <div className="space-y-3 rounded-lg border border-border-soft bg-surface-2 p-4">
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <label className="block min-w-0"><span className="label">Scene {index + 1} · {cues[index].start.toFixed(1)}s in</span><input aria-label="Sound scene name" className="input mt-1" maxLength={80} value={scene.title} onChange={(e) => changeCue({ title: e.target.value })} /></label>
            <label className="block"><span className="label">Seconds</span><input aria-label="Sound scene duration" className="input mt-1" type="number" min={3} max={30} step={0.5} value={scene.seconds} onChange={(e) => changeCue({ seconds: Number(e.target.value) })} /></label>
          </div>
          {plan.narration !== "none" && <>
            <label className="block"><span className="label">Spoken words only · leave blank for breathing room</span><textarea aria-label="Scene narration script" className="input mt-1 min-h-20" maxLength={1200} value={scene.line} onChange={(e) => changeCue({ line: e.target.value })} placeholder="Write what the listener should hear. Keep stage directions out." /></label>
            <p className={`text-xs ${estimatedReadSeconds(scene.line) > scene.seconds - 0.5 ? 'text-warning' : 'text-muted'}`}>{wordCount(scene.line)} words · roughly {estimatedReadSeconds(scene.line).toFixed(1)}s at 140 words/min. {estimatedReadSeconds(scene.line) > scene.seconds - 0.5 ? "Tight fit: shorten the line or give it more time." : "Leave a little space for breaths and the product sound."} This is a planning estimate; measure the take.</p>
            {plan.narration === "external" && <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className="label">ElevenLabs voice</span><select aria-label="ElevenLabs voice" className="input mt-1" value={voice} onChange={(e) => setVoice(e.target.value)}>{VOICES.map((v) => <option key={v}>{v}</option>)}</select></label>
                <label><span className="label">Delivery stability</span><select aria-label="Voice stability" className="input mt-1" value={stability} onChange={(e) => setStability(Number(e.target.value))}><option value={0.5}>Natural · starting point</option><option value={1}>Steadier</option><option value={0}>More expressive</option></select></label>
              </div>
              <button type="button" className="btn-secondary" disabled={busy || !scene.line.trim() || /<[^>]*>/.test(scene.line)} onClick={() => void generateVoice()}>{generating ? "Recording voice…" : `${live ? 'Generate' : 'Preview demo'} voice for scene ${index + 1} · ${live ? `~$${estimateCost(VOICE_MODEL_ID, { characters: scene.line.trim().length }).toFixed(3)}` : '$0'}`}</button>
              <p className="text-xs leading-relaxed text-muted">Eleven v3 through fal · $0.10 / 1,000 characters. Punctuation shapes delivery; use shorter sentences for tighter timing. SSML break tags and a speed parameter are not used by this v3 integration.</p>
              {/<[^>]*>/.test(scene.line) && <p role="alert" className="text-xs text-warning">Remove markup from the spoken script. Add exact pauses between clips in your editor.</p>}
              {voiceError && <p role="alert" className="text-sm text-warning">{voiceError}</p>}
              {take && <div className="space-y-2 border-t border-border-soft pt-3">
                <p className="text-xs text-muted">{take.mock ? "Demo tone — no speech was generated" : fresh ? "Voice take ready" : "Earlier take — the script or voice settings have changed"}</p>
                <audio controls preload="metadata" src={take.url} className="w-full max-w-sm" onLoadedMetadata={(e) => { const seconds = e.currentTarget.duration; if (Number.isFinite(seconds)) setActual((previous) => ({ ...previous, [take.url]: seconds })); }} />
                {actual[take.url] !== undefined && !take.mock && <p className={`text-xs ${actual[take.url] > scene.seconds ? 'text-warning' : 'text-muted'}`}>Actual take: {actual[take.url].toFixed(1)}s / {scene.seconds}s window. {actual[take.url] > scene.seconds ? "Too long: shorten the script or adjust the plan before locking picture." : "Audition pronunciation and leave room for the transition."}</p>}
                <a className="inline-flex min-h-11 items-center text-xs font-semibold text-accent underline" href={take.url} target="_blank" rel="noreferrer" download>Download voice · place at {cues[index].start.toFixed(1)}s in editor</a>
              </div>}
            </>}
          </>}
          <label className="block"><span className="label">Music direction for this scene</span><textarea aria-label="Scene music direction" className="input mt-1 min-h-20" maxLength={400} value={scene.music} onChange={(e) => changeCue({ music: e.target.value })} /></label>
        </div>}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-soft p-4 text-sm"><input type="checkbox" checked={scoreToPlan} onChange={(e) => onScoreToPlan(e.target.checked)} className="mt-1 accent-[var(--accent)]" /><span><span className="font-semibold">Compose music to these scene lengths</span><span className="mt-1 block text-xs leading-relaxed text-muted">Uses ElevenLabs’ structured section durations. Voice lines stay out of the music request. Sections need at least 3 seconds; group shorter shots into a musical phrase. Audition accents against picture and align the final mix.</span></span></label>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" onClick={() => void copy(cueSheet(plan))}>Copy cue sheet</button><button type="button" className="btn-secondary" onClick={download}>Download cue sheet</button></div>
        <p role="status" className="text-xs text-muted">{message}</p>
        <details className="text-xs leading-relaxed text-muted"><summary className="min-h-11 cursor-pointer font-semibold text-foreground">Production notes & handoff</summary>
          <ol className="list-decimal space-y-2 pl-4">
            <li>Read the script aloud, audition the actual voice, then confirm the cut. For an existing Blender edit, shorten narration to fit its timing.</li>
            <li>For a voice-led product film, finish each phrase before a big reveal. Leave some scenes without words so product sounds can be heard.</li>
            <li>Generate the score against the confirmed scene lengths. Use a clear musical change at the reveal and a resolved tail at the end; every cut does not need a beat.</li>
            <li>Keep voice, music and effects separate for mixing. Lower the music beneath speech, soften distracting frequencies and place spot effects against picture. Check the export on headphones and a phone.</li>
            <li>If Seedance needs to hear the timing, upload one aligned MP3/WAV guide in References and select its voice or rhythm role. Scene voice clips start at zero; they are not a ready-made full-film reference. Voice and music references share a 30.2-second total allowance.</li>
            <li>Keep the original voice for your final export. Reference guidance does not promise an unchanged recording or exact lip-sync. This page does not assemble the final audio mix.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-3"><a className="underline" href="https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3/api" target="_blank" rel="noreferrer">Voice API</a><a className="underline" href="https://fal.ai/models/fal-ai/elevenlabs/music/api" target="_blank" rel="noreferrer">Music sections</a><a className="underline" href="https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices" target="_blank" rel="noreferrer">Voice prompting</a></div>
          <button type="button" className="mt-2 min-h-11 font-semibold text-accent underline" onClick={() => void copy(JSON.stringify(buildComposition(plan, "Instrumental commercial score"), null, 2))}>Copy composition-plan example</button>
        </details>
      </>}
    </div>
  </section>;
}
