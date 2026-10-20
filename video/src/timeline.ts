import type { Field } from "../../server/profile.ts";
import data from "../public/data.json";

export const FPS = 30;
const f = (s: number) => Math.round(s * FPS);

export type Durations = Record<string, number>; // seconds, keyed by audio file name
export type Who = "sunita" | "app" | "narrator";
type Span = { from: number; to: number };
export type AudioCue = { file: string; from: number; frames: number; fadeOut?: boolean };
export type Caption = Span & { text: string; who: Who };

// English subtitles for Sunita's Marathi lines (the Marathi is on screen in the app's "you said" line).
const SUNITA_EN = [
  "I'm a 45-year-old woman farmer. I live in Nashik.",
  "Yellow ration card, a two-year-old daughter, family income ninety thousand a year.",
  "No, I don't pay income tax.",
  "Yes, the land is in my name.",
  "Yes, we have gas.",
  "No.",
];

type Turn = (typeof data.turns)[number] & { question?: { field: Field; mr: string; en: string; audio: string } };
export const turns = data.turns as Turn[];

/**
 * Everything the video does, in frames, laid out from the real audio lengths.
 * Waits the app spends thinking are shortened (the video says so on screen).
 */
export function buildTimeline(d: Durations) {
  const audio: AudioCue[] = [], captions: Caption[] = [];
  const fills: { field: Field; at: number }[] = [];
  const speaking: (Span & { file: string })[] = [], appSpeaking: Span[] = [], thinking: Span[] = [];
  const heard: { at: number; text: string }[] = [], questions: { at: number; mr: string }[] = [];
  const play = (file: string, at: number, who: Who | null, text?: string) => {
    const dur = d[file] ?? 1;
    audio.push({ file, from: f(at), frames: f(dur) });
    if (who && text) captions.push({ from: f(at), to: f(at + dur), text, who });
    return at + dur;
  };
  const fillFields = (turnIndex: number, at: number, step: number) => {
    const before = turnIndex === 0 ? [] : Object.keys(turns[turnIndex - 1].profile);
    const added = (Object.keys(turns[turnIndex].profile) as Field[]).filter((k) => !before.includes(k));
    added.forEach((field, i) => fills.push({ field, at: f(at + i * step) }));
    return at + added.length * step;
  };
  const sunitaSays = (i: number, at: number) => {
    const file = `sunita-${i + 1}.mp3`;
    const end = play(file, at, "sunita", SUNITA_EN[i]);
    speaking.push({ from: f(at), to: f(end), file });
    thinking.push({ from: f(end), to: f(end + 0.25) });
    heard.push({ at: f(end + 0.25), text: turns[i].heard });
    return end + 0.25;
  };
  const appAsks = (afterTurn: number, at: number) => {
    const q = turns[afterTurn].question!;
    questions.push({ at: f(at), mr: q.mr });
    const end = play(q.audio, at, "app", q.en);
    appSpeaking.push({ from: f(at), to: f(end) });
    return end + 0.1;
  };

  // 1. Hook: she speaks, the form fills itself.
  const hook = { from: 0, to: 0 };
  let t = sunitaSays(0, 0.3);
  t = fillFields(0, t, 0.2) + 0.3;
  hook.to = f(t);

  // 2. Title (text only, to keep it short).
  const title = { from: f(t), to: f(t + 2.6) };
  t += 2.6;

  // 3. The ration-card question and the one-sentence, three-field answer, then the hands-free montage.
  const convo = { from: f(t), to: 0 };
  t = appAsks(0, t + 0.15);
  t = sunitaSays(1, t);
  const wow = { from: f(t), to: 0 };
  t = fillFields(1, t, 0.28) + 0.7;
  wow.to = f(t);
  for (let i = 2; i < 6; i++) {
    t = appAsks(i - 1, t); // every question is spoken, as in the app, so each answer has its question
    t = sunitaSays(i, t);
    t = fillFields(i, t, 0.2) + 0.2;
  }
  convo.to = f(t);

  // 4. Results: cards and stamps, then a card read aloud.
  const results = { from: f(t), to: 0, tap: f(t + 2.8) };
  audio.push({ file: data.card.audio, from: results.tap, frames: f(4.8), fadeOut: true });
  t += 7.6;
  results.to = f(t);

  // 5. How it works.
  const how = { from: f(t), to: 0, narration: { from: f(t + 0.2), frames: f(d["narration-how.mp3"] ?? 9) } };
  t = play("narration-how.mp3", t + 0.2, "narrator", data.narration.how.text) + 0.4;
  how.to = f(t);

  // 6. End card.
  const end = { from: f(t), to: 0 };
  t = play("narration-end.mp3", t + 0.3, "narrator", data.narration.end.text) + 0.6;
  end.to = f(t);

  return { total: f(t), hook, title, convo, wow, results, how, end, audio, captions, fills, speaking, appSpeaking, thinking, heard, questions };
}

export type Timeline = ReturnType<typeof buildTimeline>;

/** Every audio file the timeline might play, for measuring durations up front. */
export const AUDIO_FILES = [
  ...turns.map((_, i) => `sunita-${i + 1}.mp3`),
  ...turns.flatMap((t) => (t.question ? [t.question.audio] : [])),
"narration-how.mp3", "narration-end.mp3", data.card.audio,
];
