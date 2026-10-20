// Runs Sunita's six voice clips through the real app pipeline (Gnani Prisma -> LLM -> rules -> Gnani Timbre)
// and saves every real output the video shows. Uses Gnani credits (about 3). Run: npm run capture
import { readFileSync, writeFileSync } from "node:fs";
import { runTurn } from "../../server/turn.ts";
import type { TurnState } from "../../server/turn.ts";
import { stt, tts } from "../../server/gnani.ts";
import { chat } from "../../server/llm.ts";
import { SCHEMES } from "../../server/schemes.ts";
import { GREETING, cardSpeech } from "../../server/questions.ts";

const AUDIO = new URL("../public/audio/", import.meta.url);
const save = (name: string, data: Buffer) => writeFileSync(new URL(name, AUDIO), data);
const NARRATOR = "Avinash"; // a second Timbre voice, so the narrator doesn't sound like the app

const NARRATION = {
  title: "Meet Sarkari Saathi. Find the government schemes you may qualify for, just by talking.",
  how: "Gnani Prisma hears her. A small model picks out the facts. Plain rules decide, so it cannot invent a scheme. Gnani Timbre speaks back.",
  end: "Sarkari Saathi. Built on Gnani AI.",
};

let state: TurnState = { profile: {}, history: [], asked: [] };
const turns = [];
for (let i = 1; i <= 6; i++) {
  const clip = readFileSync(new URL(`sunita-${i}.mp3`, AUDIO));
  const res = await runTurn({ audio: clip.toString("base64"), mime: "audio/mpeg", lang: "mr", state }, { stt, chat, tts });
  if (res.audio) save(`reply-${i}.mp3`, Buffer.from(res.audio, "base64"));
  state = res.state;
  turns.push({ said: `sunita-${i}.mp3`, heard: res.heard, reply: res.reply, replyAudio: res.audio ? `reply-${i}.mp3` : null,
    profile: res.state.profile, asked: res.state.asked, phase: res.phase, schemes: res.schemes });
  console.log(`turn ${i}: heard "${res.heard}" -> ${res.phase}${res.phase === "results" ? ` (${res.schemes.length} schemes)` : ""}`);
}

save("greeting.mp3", await tts(GREETING.mr, "mr"));
const kisan = SCHEMES.find((s) => s.id === "pm-kisan")!;
save("card-pm-kisan.mp3", await tts(cardSpeech(kisan.text.mr, "mr"), "mr"));
for (const [id, text] of Object.entries(NARRATION)) save(`narration-${id}.mp3`, await tts(text, "en", NARRATOR));

writeFileSync(new URL("../public/data.json", import.meta.url), JSON.stringify({
  greeting: { text: GREETING.mr, audio: "greeting.mp3" },
  turns,
  card: { id: "pm-kisan", audio: "card-pm-kisan.mp3" },
  narration: Object.fromEntries(Object.entries(NARRATION).map(([id, text]) => [id, { text, audio: `narration-${id}.mp3` }])),
}, null, 2));
console.log("saved public/data.json and audio");
