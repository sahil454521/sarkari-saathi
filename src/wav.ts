// Gnani Prisma rejects Chrome's WebM recordings (stt 400), so recordings are sent as 16 kHz mono WAV.
const RATE = 16_000;

/** 16-bit mono PCM WAV from float samples in [-1, 1] (out-of-range values are clamped). */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE");
  text(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const c = Math.max(-1, Math.min(1, s));
    v.setInt16(44 + i * 2, Math.round(c < 0 ? c * 32768 : c * 32767), true);
  });
  return v.buffer;
}

/** Decode whatever the browser recorded and resample it to 16 kHz mono WAV. */
export async function toWav16k(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer()).finally(() => ctx.close());
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return new Blob([encodeWav(rendered.getChannelData(0), RATE)], { type: "audio/wav" });
}
