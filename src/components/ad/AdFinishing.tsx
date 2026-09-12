"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AdMixTrack, AdSceneCard } from "@/lib/adDraft";
import { encodeWav, mixManifest, mixSoundtrack, readMixMedia, MIX_MAX_BYTES, type DecodedTrack } from "@/lib/adMix";

import { SoundtrackPreview } from "./SoundtrackPreview";
import styles from "./AdFinishing.module.css";

type Props = { tracks: AdMixTrack[]; onChange: Dispatch<SetStateAction<AdMixTrack[]>>; available: AdMixTrack[]; duration: number; ducking: number; onDucking: (value: number) => void; videoUrl: string | null; originalAudioAvailable?: boolean; sceneCards: AdSceneCard[]; onSaveMix: (dataUrl: string, manifest: Record<string, unknown>) => Promise<void> };
function download(data: Blob, name: string) { const url = URL.createObjectURL(data); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function dataUrl(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not save the mix.")); reader.readAsDataURL(blob); }); }

export function AdFinishing({ tracks, onChange, available, duration, ducking, onDucking, videoUrl, originalAudioAvailable = false, sceneCards, onSaveMix }: Props) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [rendered, setRendered] = useState<{ url: string; bytes: Uint8Array; key: string; masterGain: number } | null>(null);
  const lock = useRef(false); const active = useRef(true);
  const key = JSON.stringify([tracks, duration, ducking]); const fresh = rendered?.key === key;
  const missing = available.filter((source) => !tracks.some((track) => track.id === source.id && track.url === source.url));
  const invalid = tracks.some((track) => track.enabled && (track.start >= duration || track.fadeIn + track.fadeOut > track.length));
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => () => { if (rendered) URL.revokeObjectURL(rendered.url); }, [rendered]);
  function update(id: string, change: Partial<AdMixTrack>) { onChange(tracks.map((track) => track.id === id ? { ...track, ...change } : track)); }
  async function attach(file?: File) {
    if (!file || lock.current || tracks.length >= 60) return;
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|webm)$/i.test(file.name)) { setError("Choose an audio file."); return; }
    if (file.size > 16 * 1024 * 1024) { setError("Keep each local audio file under 16 MB so the project can save it. Trim or compress the source first."); return; }
    lock.current = true; setBusy(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const type = file.type.startsWith("audio/") ? file.type : extension === "wav" ? "audio/wav" : extension === "m4a" ? "audio/mp4" : extension === "ogg" ? "audio/ogg" : extension === "webm" ? "audio/webm" : "audio/mpeg";
      const url = await dataUrl(new Blob([file], { type }));
      onChange((previous) => [...previous, { id: `local-${crypto.randomUUID()}`, name: file.name.slice(0, 300), url, kind: "effect", start: 0, trim: 0, length: duration, gain: 1, fadeIn: 0.05, fadeOut: 0.1, enabled: true }]); setError("");
    } catch { setError("Could not read the audio file."); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  async function renderMix() {
    if (lock.current || invalid) return; lock.current = true; setBusy(true); setError(""); setMessage("");
    let context: AudioContext | undefined;
    try {
      context = new AudioContext(); const decoded: DecodedTrack[] = []; let bytes = 0;
      for (const track of tracks.filter((track) => track.enabled)) {
        const source = await readMixMedia(track.url, MIX_MAX_BYTES - bytes); bytes += source.byteLength;
        const buffer = await context.decodeAudioData(source);
        if (buffer.duration > 600) throw new Error(`${track.name} is too long for this short-form mixer. Trim the source first.`);
        decoded.push({ track, sampleRate: buffer.sampleRate, samples: Array.from({ length: Math.min(buffer.numberOfChannels, 2) }, (_, i) => buffer.getChannelData(i)) });
      }
      if (!decoded.length) throw new Error("Add and enable at least one real audio take.");
      const result = mixSoundtrack(decoded, duration, ducking); const wav = encodeWav(result.channels, result.sampleRate);
      if (active.current) setRendered({ url: URL.createObjectURL(new Blob([new Uint8Array(wav)], { type: "audio/wav" })), bytes: wav, key, masterGain: result.masterGain });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "A source could not be read. Its host may block browser mixing; download and reattach the audio."); }
    finally { await context?.close(); lock.current = false; if (active.current) setBusy(false); }
  }
  async function bundle() {
    if (!fresh || !rendered || lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const { zipSync, strToU8 } = await import("fflate"); const manifest = { ...mixManifest(tracks, duration, ducking, videoUrl), masterGain: rendered.masterGain };
      const files = { "soundtrack.wav": rendered.bytes, "mix-settings.json": strToU8(JSON.stringify(manifest, null, 2)), "scene-cues.json": strToU8(JSON.stringify(sceneCards, null, 2)), "README.txt": strToU8("Editor handoff — not a finished MP4.\nPlace soundtrack.wav at time 0. It contains only the enabled separate audio tracks.\nDownload the original video using the source in mix-settings.json; its native audio is unchanged. Mute it or deliberately mix it beneath this WAV in your editor.\nOriginal source audio links and exact timing/trim/gain/fades are recorded in mix-settings.json. Clips are not time-stretched or looped. Music ducks across enabled voice clip windows with 100 ms attack and 200 ms release.\nReview pronunciation, timing, levels and rights before delivery. The Ad Lab video preflight excludes this separate soundtrack.\n") };
      download(new Blob([new Uint8Array(zipSync(files, { level: 1 }))], { type: "application/zip" }), "ad-editor-handoff.zip");
      try { await onSaveMix(await dataUrl(new Blob([new Uint8Array(rendered.bytes)], { type: "audio/wav" })), manifest); if (active.current) setMessage("Editor bundle downloaded. The mixed WAV and its settings are saved in this project."); }
      catch (e) { if (active.current) setError(`Bundle downloaded, but project save failed: ${e instanceof Error ? e.message : "storage unavailable"}`); }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not create the editor bundle."); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  return <section id="ad-finish" className={styles.section} aria-labelledby="finish-title">
    <header className={styles.header}>
      <p className={styles.eyebrow}>Soundtrack finishing · no generation charge</p>
      <h2 id="finish-title">Bring the film and sound together.</h2>
      <p>Your picture is one part. Shape the voice, music and effects into a finished stereo WAV, then listen with your video before handing it to your editor.</p>
      <ol className={styles.journey} aria-label="Soundtrack finishing steps"><li>01 · Add takes</li><li>02 · Time & balance</li><li>03 · Listen & export</li></ol>
    </header>
    <div className={styles.body}>
    <div className={styles.step}><h3>01 · Add your audio takes</h3><span>{tracks.length} added · {tracks.filter((track) => track.enabled).length} included in WAV</span></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" className="btn-secondary" disabled={!missing.length || busy || tracks.length + missing.filter((source) => !tracks.some((track) => track.id === source.id)).length > 60} onClick={() => onChange((previous) => [...previous.map((track) => { const replacement = missing.find((source) => source.id === track.id); return replacement ? { ...track, url: replacement.url, name: replacement.name, kind: replacement.kind } : track; }), ...missing.filter((source) => !previous.some((track) => track.id === source.id))])}>Use {missing.length || "available"} ready audio {missing.length === 1 ? "take" : "takes"}</button><label className="text-xs font-semibold">Add local audio · up to 16 MB<input className="mt-1 block max-w-full text-xs" type="file" accept="audio/*,.mp3,.wav,.m4a" disabled={busy || tracks.length >= 60} onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    {!tracks.length && <p className="mt-3 text-sm text-muted">Generate or recover music, effects or scene voice above, then add those real takes here. Demo tones are excluded.</p>}
    <div className={`${styles.step} ${styles.divider}`}><h3>02 · Time & balance</h3><span>{duration}s soundtrack</span></div>
    <p className="text-xs text-muted">Open a track to adjust its position, trim, level and fades. Existing scene timings are kept.</p>
    <div className="mt-4 space-y-3">{tracks.map((track) => <details key={track.id} className="rounded-lg border border-border-soft p-3"><summary className="cursor-pointer text-sm font-semibold">{track.name} · {track.kind} · {track.start.toFixed(1)}s in</summary><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={track.enabled} onChange={(e) => update(track.id, { enabled: e.target.checked })} />Include in WAV</label><button type="button" className="min-h-11 text-xs text-muted underline" onClick={() => onChange(tracks.filter((t) => t.id !== track.id))}>Remove track</button></div><audio controls preload="none" src={track.url} className="mb-3 w-full max-w-sm" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <label><span className="label">Track role</span><select className="input mt-1" value={track.kind} onChange={(event) => update(track.id, { kind: event.target.value as AdMixTrack["kind"] })}><option value="voice">Voice · triggers ducking</option><option value="music">Music · lowers under voice</option><option value="effect">Effect · independent level</option></select></label>
      {([{ field: "start", label: "Start in film · s", max: duration, min: 0 }, { field: "trim", label: "Skip into source · s", max: 600, min: 0 }, { field: "length", label: "Play for · s", max: duration, min: 0.05 }, { field: "gain", label: "Gain · 1 = original", max: 2, min: 0 }, { field: "fadeIn", label: "Fade in · s", max: 30, min: 0 }, { field: "fadeOut", label: "Fade out · s", max: 30, min: 0 }] as const).map(({ field, label, max, min }) => <label key={field}><span className="label">{label}</span><input className="input mt-1" type="number" min={min} max={max} step={0.05} value={Number(track[field].toFixed(3))} onChange={(e) => update(track.id, { [field]: Math.min(max, Math.max(min, Number(e.target.value))) })} /></label>)}
    </div></details>)}</div>
    <label className="mt-4 block max-w-sm"><span className="label">Lower music under voice · {Math.round(ducking * 100)}%</span><input className="mt-2 w-full accent-[var(--accent)]" type="range" min={0} max={1} step={0.05} value={ducking} onChange={(e) => onDucking(Number(e.target.value))} /></label>
    <p className="mt-1 text-xs text-muted">Ducking follows enabled voice clip windows, including silent pauses within each clip. 100 ms attack · 200 ms release. Audio ends at the cut; clips are never stretched or looped.</p>
    {invalid && <p role="alert" className="mt-3 text-sm text-warning">Keep track starts inside the cut and the combined fades no longer than each track window.</p>}
    <div className={`${styles.step} ${styles.divider}`}><h3>03 · Listen & export</h3><span>Separate stereo WAV</span></div>
    <p className="text-xs text-muted">Render to hear your mix. The WAV contains the enabled tracks above. Combine it with the original video in your editor for the final MP4.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="btn-primary" disabled={busy || invalid || !tracks.some((track) => track.enabled)} onClick={() => void renderMix()}>{busy ? "Working locally…" : "Render soundtrack preview"}</button>{fresh && rendered && <><button type="button" className="btn-secondary" disabled={busy} onClick={() => download(new Blob([new Uint8Array(rendered.bytes)], { type: "audio/wav" }), "ad-soundtrack.wav")}>Download mixed WAV</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => void bundle()}>Download editor bundle & save mix</button></>}</div>
    {rendered && !fresh && <p className="mt-3 text-sm text-warning">The track settings changed. Render again to preview or export the current mix.</p>}
    {fresh && rendered && <>
      <SoundtrackPreview key={`${rendered.url}:${videoUrl}`} soundtrackUrl={rendered.url} videoUrl={videoUrl} originalAudioAvailable={originalAudioAvailable} />
      <p className="mt-3 text-xs text-muted">{rendered.masterGain < 1 ? `Master gain reduced to ${(rendered.masterGain * 100).toFixed(0)}% to prevent clipping. ` : ""}The separate soundtrack is outside the video AI review.</p>
    </>}
    {videoUrl && <a href={videoUrl} target="_blank" rel="noreferrer" download className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">Download original video · native audio unchanged</a>}
    {error && <p role="alert" className="mt-3 text-sm text-warning">{error}</p>}<p role="status" className="mt-3 text-sm text-muted">{message}</p>
    </div>
  </section>;
}
