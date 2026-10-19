import type { Lang } from "./profile.ts";
import { fetchRetry } from "./http.ts";
import { encodeWav } from "../src/wav.ts"; // same encoder the browser uses for uploads

const BASE = "https://api.vachana.ai";
const LANG_CODE: Record<Lang, string> = { hi: "hi-IN", mr: "mr-IN", en: "en-IN" };
export const VOICE = "Shivani";

const authHeader = () => ({ "X-API-Key-ID": process.env.GNANI_API_KEY ?? "" });

// Prisma infers the format from the file name, so it must match what the browser recorded.
const EXT: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
  "audio/aac": "aac", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/flac": "flac",
};

const RATE = 16_000;
const MAX_PIECE_SEC = 8;

/** Gnani Prisma speech-to-text (REST). Long app recordings are transcribed in pieces, see splitAtPauses. */
export async function stt(audio: Blob, lang: Lang): Promise<string> {
  const pcm = audio.type === "audio/wav" ? await appWavSamples(audio) : null;
  if (!pcm || pcm.length <= MAX_PIECE_SEC * RATE) return sttOnce(audio, lang);
  const texts: string[] = [];
  for (const piece of splitAtPauses(pcm, RATE)) // one at a time: Gnani answers 429 to parallel requests
    texts.push(await sttOnce(new Blob([encodeWav(Float32Array.from(piece, (x) => x / 32768), RATE)], { type: "audio/wav" }), lang));
  return texts.filter(Boolean).join(" ");
}

/**
 * Prisma returned an empty transcript (with success: true) for a 15 s browser recording whose two halves each
 * transcribed perfectly, so long recordings are cut into pieces of at most 8 s, each cut at the quietest
 * 100 ms in the last 3 s before the limit, so words aren't sliced.
 */
export function splitAtPauses(pcm: Int16Array, rate: number): Int16Array[] {
  const max = MAX_PIECE_SEC * rate, win = rate / 10, pieces: Int16Array[] = [];
  let start = 0;
  while (pcm.length - start > max) {
    let cut = start + max, quietest = Infinity;
    for (let w = start + max - 3 * rate; w + win <= start + max; w += win / 2) {
      let energy = 0;
      for (let i = w; i < w + win; i++) energy += pcm[i] * pcm[i];
      if (energy < quietest) { quietest = energy; cut = w + win / 2; }
    }
    pieces.push(pcm.subarray(start, cut));
    start = cut;
  }
  pieces.push(pcm.subarray(start));
  return pieces;
}

/** Samples of a 16 kHz mono 16-bit WAV, the format the app uploads; null for anything else (sent whole). */
async function appWavSamples(audio: Blob): Promise<Int16Array | null> {
  const buf = await audio.arrayBuffer();
  if (buf.byteLength < 46) return null;
  const v = new DataView(buf), tag = (at: number) => String.fromCharCode(...new Uint8Array(buf, at, 4));
  const ok = tag(0) === "RIFF" && tag(8) === "WAVE" && tag(36) === "data" &&
    v.getUint16(22, true) === 1 && v.getUint32(24, true) === RATE && v.getUint16(34, true) === 16;
  return ok ? new Int16Array(buf.slice(44, 44 + Math.floor((buf.byteLength - 44) / 2) * 2)) : null;
}

async function sttOnce(audio: Blob, lang: Lang): Promise<string> {
  const form = new FormData();
  form.append("audio_file", audio, `audio.${EXT[audio.type.split(";")[0]] ?? "webm"}`);
  form.append("language_code", LANG_CODE[lang]);
  form.append("format", "transcribe");
  const res = await fetchRetry(`${BASE}/stt/v3`, { method: "POST", headers: authHeader(), body: form }, 15_000);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(`stt ${res.status}`);
  return String(body.transcript ?? "");
}

/** Gnani Timbre text-to-speech; returns mp3 bytes. */
export async function tts(text: string, lang: Lang, voice = VOICE): Promise<Buffer> {
  const res = await fetchRetry(`${BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text, model: "timbre-v3.0", voice, language: LANG_CODE[lang], speed: 1.0,
      audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "mp3", bitrate: "64k" },
    }),
  }, 15_000);
  if (!res.ok) throw new Error(`tts ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
