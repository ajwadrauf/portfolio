import type { AdMixTrack } from "./adDraft";

export type DecodedTrack = { track: AdMixTrack; samples: Float32Array[]; sampleRate: number };
export const MIX_SAMPLE_RATE = 48000;
export const MIX_MAX_BYTES = 64 * 1024 * 1024;

/** Deterministic stereo PCM render. Input clips are trimmed, never stretched or looped. */
export function mixSoundtrack(inputs: DecodedTrack[], duration: number, ducking: number, sampleRate = MIX_SAMPLE_RATE) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60 || !Number.isFinite(ducking) || ducking < 0 || ducking > 1 || !Number.isFinite(sampleRate) || sampleRate < 100 || sampleRate > 96000) throw new Error("Invalid mix duration, ducking or sample rate.");
  const length = Math.ceil(duration * sampleRate);
  const channels = [new Float32Array(length), new Float32Array(length)];
  const active = inputs.filter(({ track }) => track.enabled && track.gain > 0);
  const windows = active.filter(({ track }) => track.kind === "voice").map(({ track, samples, sampleRate: rate }) => ({ start: track.start, end: track.start + Math.max(0, Math.min(track.length, (samples[0]?.length ?? 0) / rate - track.trim)) }));
  for (const { track, samples, sampleRate: rate } of active) {
    if (!samples.length || !rate || [track.start, track.trim, track.length, track.gain, track.fadeIn, track.fadeOut].some((v) => !Number.isFinite(v) || v < 0)) throw new Error("Invalid audio track settings.");
    const audible = Math.min(track.length, samples[0].length / rate - track.trim, duration - track.start);
    const start = Math.round(track.start * sampleRate);
    for (let frame = 0; frame < Math.ceil(audible * sampleRate) && start + frame < length; frame++) {
      const elapsed = frame / sampleRate; const time = track.start + elapsed;
      let gain = track.gain;
      if (track.fadeIn > 0) gain *= Math.min(1, elapsed / track.fadeIn);
      if (track.fadeOut > 0) gain *= Math.min(1, Math.max(0, (audible - elapsed) / track.fadeOut));
      if (track.kind === "music") {
        let envelope = 0;
        for (const window of windows) {
          if (time >= window.start - 0.1 && time <= window.end + 0.2) envelope = Math.max(envelope, Math.min(1, (time - window.start + 0.1) / 0.1, (window.end + 0.2 - time) / 0.2));
        }
        gain *= 1 - Math.max(0, envelope) * ducking;
      }
      const sourceFrame = (track.trim + elapsed) * rate;
      const index = Math.floor(sourceFrame); const fraction = sourceFrame - index;
      for (let channel = 0; channel < 2; channel++) {
        const source = samples[Math.min(channel, samples.length - 1)];
        const value = (source[index] ?? 0) * (1 - fraction) + (source[index + 1] ?? source[index] ?? 0) * fraction;
        channels[channel][start + frame] += value * gain;
      }
    }
  }
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
  // One transparent master reduction avoids clipping while retaining relative balances.
  const masterGain = peak > 0.98 ? 0.98 / peak : 1;
  if (masterGain < 1) for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= masterGain;
  return { channels, sampleRate, masterGain, peak };
}

export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  if (channels.length !== 2 || channels[0].length !== channels[1].length) throw new Error("WAV needs matching stereo channels.");
  const frames = channels[0].length; const buffer = new ArrayBuffer(44 + frames * 4); const view = new DataView(buffer);
  const word = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  word(0, "RIFF"); view.setUint32(4, 36 + frames * 4, true); word(8, "WAVE"); word(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); word(36, "data"); view.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames; i++) for (let c = 0; c < 2; c++) { const value = Math.max(-1, Math.min(1, channels[c][i])); view.setInt16(44 + (i * 2 + c) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true); }
  return new Uint8Array(buffer);
}

/** Bound streamed bodies, including responses that omit or understate Content-Length. */
export async function readMixMedia(url: string, maxBytes = MIX_MAX_BYTES): Promise<ArrayBuffer> {
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error("The audio host could not be read. Its link may have expired or it may block browser access. Download the source, then use Add local audio."); }
  if (!response.ok) throw new Error(`Audio could not be read (${response.status}). Download the source and reattach it if its link expired.`);
  if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("A source exceeds the local mix limit of 64 MB.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("This browser cannot stream the audio source.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) throw new Error("Audio sources exceed the local mix limit of 64 MB."); chunks.push(value); } }
  catch (error) { await reader.cancel(); throw error; }
  const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; } return output.buffer;
}

export function mixManifest(tracks: AdMixTrack[], duration: number, ducking: number, videoUrl: string | null) {
  return { version: 1, durationSeconds: duration, sampleRate: MIX_SAMPLE_RATE, channels: 2, nativeVideoAudio: "Original video retains its original audio. The WAV contains only the enabled separate tracks; mute or mix native audio deliberately in your editor.", video: videoUrl ? { source: videoUrl, included: false, instruction: "Download original video separately." } : null, ducking: { reduction: ducking, attackSeconds: 0.1, releaseSeconds: 0.2, trigger: "enabled voice clip windows" }, tracks };
}
