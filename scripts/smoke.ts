// Real-API smoke check. Uses Gnani credits. Run: node --env-file=.env scripts/smoke.ts
//
// Results 2026-10-19 (plan Task 2 Step 7):
//   STT round trip hi/mr:  ok; ITN turns "पैंतालीस" into "45"; TTS ~1.5 s, STT ~0.5 s
//   Timbre reads "₹6,000": yes (Prisma heard "₹6,000" back in hi and mr), so amounts stay as digits
//   LLM JSON-schema mode:  ok with gemini-flash-latest, 2.3–4.1 s; reasoning_effort "none" made no difference
//   Voice picked:          Shivani (default) until the user listens to scripts/out/voice-*.mp3
//   Credits per STT / TTS: 8 calls = 1.50 credits; TTS ≈ ₹0.0027/char, STT ≈ ₹27/hour → ~0.45 credit per turn

import { mkdirSync, writeFileSync } from "node:fs";
import type { Lang } from "../server/profile.ts";
import { stt, tts } from "../server/gnani.ts";
import { chat } from "../server/llm.ts";

const out = new URL("./out/", import.meta.url);
mkdirSync(out, { recursive: true });

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  const start = performance.now();
  try {
    const result = await fn();
    console.log(`${label}: ok (${Math.round(performance.now() - start)} ms)`);
    return result;
  } catch (err) {
    console.log(`${label}: FAILED ${err}`);
  }
}

const sentences: [Lang, string][] = [
  ["hi", "नमस्ते, मेरी उम्र पैंतालीस साल है, मैं नाशिक में खेती करती हूँ। ₹6,000 सालाना मिलते हैं।"],
  ["mr", "नमस्कार, माझं वय पंचेचाळीस वर्षं आहे, मी नाशिकमध्ये शेती करते. मला वर्षाला ₹6,000 मिळतात."],
];

for (const [lang, text] of sentences) {
  const audio = await timed(`tts ${lang}`, () => tts(text, lang));
  if (!audio) continue;
  writeFileSync(new URL(`${lang}.mp3`, out), audio);
  const heard = await timed(`stt ${lang}`, () => stt(new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), lang));
  console.log(`  said:  ${text}\n  heard: ${heard}`);
}

const greeting = "नमस्ते! मैं सरकारी साथी हूँ। अपने बारे में बताइए — उम्र, काम, और कहाँ रहते हैं?";
for (const voice of ["Shivani", "Kalpana", "Vasudha", "Riyaa"]) {
  const audio = await timed(`voice ${voice}`, () => tts(greeting, "hi", voice));
  if (audio) writeFileSync(new URL(`voice-${voice}.mp3`, out), audio);
}

const raw = await timed("llm", () => chat(
  [{ role: "user", content: 'Reply with {"ok": true}' }],
  { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
));
console.log(`  raw: ${raw}`);
console.log(`audio files in ${out.pathname}`);
