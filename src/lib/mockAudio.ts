/**
 * Demo-mode music: synthesizes a short, pleasant chord loop as a WAV data URL
 * so the layered-audio workflow can be exercised end to end without spending.
 * Mono 22.05 kHz keeps the payload small enough to inline.
 */

const SAMPLE_RATE = 22050;

/** Simple major-ish progression (Hz), one chord per bar. */
const PROGRESSION = [
  [261.63, 329.63, 392.0], // C
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
];

export function mockMusicDataUrl(durationSeconds: number): string {
  const duration = Math.min(Math.max(durationSeconds, 3), 12);
  const total = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(total);
  const barLength = total / PROGRESSION.length;

  for (let i = 0; i < total; i++) {
    const bar = Math.min(Math.floor(i / barLength), PROGRESSION.length - 1);
    const tInBar = (i - bar * barLength) / SAMPLE_RATE;
    const t = i / SAMPLE_RATE;

    // Plucked envelope per bar, so it reads as rhythmic rather than droning.
    const pluck = Math.exp(-3 * tInBar);
    let value = 0;
    for (const freq of PROGRESSION[bar]) {
      value += Math.sin(2 * Math.PI * freq * t) * 0.22 * pluck;
    }
    // Soft eighth-note tick for pulse.
    const beatPhase = (t * 4) % 1;
    value += Math.sin(2 * Math.PI * 1200 * t) * 0.04 * Math.exp(-40 * beatPhase);

    // Fade in/out so the clip never clicks at the edges.
    const fade = Math.min(1, i / (SAMPLE_RATE * 0.05), (total - i) / (SAMPLE_RATE * 0.15));
    samples[i] = Math.max(-1, Math.min(1, value)) * fade;
  }

  return `data:audio/wav;base64,${encodeWav(samples).toString("base64")}`;
}

function encodeWav(samples: Float32Array): Buffer {
  const bytesPerSample = 2;
  const buffer = Buffer.alloc(44 + samples.length * bytesPerSample);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * bytesPerSample, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * bytesPerSample, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * bytesPerSample);
  }
  return buffer;
}
