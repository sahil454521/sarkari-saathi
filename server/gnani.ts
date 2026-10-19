import type { Lang } from "./profile.ts";
import { fetchRetry } from "./http.ts";

const BASE = "https://api.vachana.ai";
const LANG_CODE: Record<Lang, string> = { hi: "hi-IN", mr: "mr-IN", en: "en-IN" };
export const VOICE = "Shivani";

const authHeader = () => ({ "X-API-Key-ID": process.env.GNANI_API_KEY ?? "" });

// Prisma infers the format from the file name, so it must match what the browser recorded.
const EXT: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
  "audio/aac": "aac", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/flac": "flac",
};

/** Gnani Prisma speech-to-text (REST, ≤ 60 s clips). */
export async function stt(audio: Blob, lang: Lang): Promise<string> {
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
