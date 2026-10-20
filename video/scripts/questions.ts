// The app's replies are "acknowledgement + question"; the montage plays just the question, spoken from the app's
// own template text in the same Timbre voice. Run after capture: node --env-file=../.env scripts/questions.ts
import { readFileSync, writeFileSync } from "node:fs";
import { tts } from "../../server/gnani.ts";
import { QUESTIONS } from "../../server/questions.ts";
import type { Field } from "../../server/profile.ts";

const dataUrl = new URL("../public/data.json", import.meta.url);
const data = JSON.parse(readFileSync(dataUrl, "utf8"));
for (const [i, turn] of data.turns.entries()) {
  if (turn.phase !== "asking") continue;
  const field = turn.asked.at(-1) as Field;
  writeFileSync(new URL(`../public/audio/question-${i + 1}.mp3`, import.meta.url), await tts(QUESTIONS[field].mr, "mr"));
  turn.question = { field, mr: QUESTIONS[field].mr, en: QUESTIONS[field].en, audio: `question-${i + 1}.mp3` };
  console.log(`after turn ${i + 1}: asks ${field}`);
}
writeFileSync(dataUrl, JSON.stringify(data, null, 2));
