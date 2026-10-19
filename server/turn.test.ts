import { test, expect, vi } from "vitest";
import { runTurn } from "./turn.ts";
import type { TurnRequest, TurnState } from "./turn.ts";
import { SCHEMES } from "./schemes.ts";
import { QUESTIONS, SAY_AGAIN, MISSING_NOTE, resultsSummary } from "./questions.ts";
import { sunita } from "./fixtures.ts";

function deps(chatReplies: string[], opts: { heard?: string; ttsFails?: boolean } = {}) {
  return {
    stt: vi.fn(async () => opts.heard ?? ""),
    chat: vi.fn(async () => chatReplies.shift() ?? ""),
    tts: vi.fn(async () => {
      if (opts.ttsFails) throw new Error("tts 500");
      return Buffer.from("mp3");
    }),
  };
}
const empty = (): TurnState => ({ profile: {}, history: [], asked: [] });
const typed = (text: string, state = empty()): TurnRequest => ({ text, lang: "hi", state });
const spoken = (state = empty()): TurnRequest => ({ audio: Buffer.from("x").toString("base64"), mime: "audio/webm", lang: "hi", state });
const llm = (facts: object, reply: string) => JSON.stringify({ facts, reply });

test("typed text: no STT, facts merged, next question asked", async () => {
  const d = deps([llm({ age: 45, occupation: "farmer" }, "अच्छा।")]);
  const out = await runTurn(typed("मैं 45 साल की किसान हूँ"), d);
  expect(d.stt).not.toHaveBeenCalled();
  expect(out.state.profile).toEqual({ age: 45, occupation: "farmer" });
  expect(out.state.asked).toHaveLength(1);
  expect(out.reply.startsWith("अच्छा।")).toBe(true);
  expect(out.reply.endsWith(QUESTIONS[out.state.asked[0]].hi)).toBe(true);
  expect(out.phase).toBe("asking");
  expect(out.schemes).toEqual([]);
});

test("complete profile → results, eligible cards first", async () => {
  const out = await runTurn(typed("बस इतना ही", { ...empty(), profile: sunita }), deps([llm({}, "ठीक है।")]));
  expect(out.phase).toBe("results");
  expect(out.schemes.map(c => c.id)).toEqual(
    ["pm-kisan", "namo-shetkari", "mjpjay", "ladki-bahin", "lek-ladki", "sukanya", "pmfby", "pm-jay"]);
  expect(out.reply).toContain(resultsSummary("hi", out.schemes.map(c => c.name)));
});

test("cap at 8 questions shows undecided schemes as likely", async () => {
  const profile = { gender: "female" as const };
  const out = await runTurn(typed("पता नहीं", { profile, history: [], asked: Array(8).fill("age") }), deps([llm({}, "ठीक है।")]));
  expect(out.phase).toBe("results");
  const undecided = SCHEMES.filter(s => s.check(profile).status === "needs").map(s => s.id);
  expect(undecided.length).toBeGreaterThan(0);
  for (const c of out.schemes.filter(c => undecided.includes(c.id))) {
    expect(c.status).toBe("likely");
    expect(c.note).toBe(MISSING_NOTE.hi);
  }
});

test("TTS failure still returns text", async () => {
  const out = await runTurn(typed("मैं 45 साल की हूँ"), deps([llm({ age: 45 }, "अच्छा।")], { ttsFails: true }));
  expect(out.audio).toBeNull();
  expect(out.reply.length).toBeGreaterThan(0);
});

test("bad JSON twice → say again, state unchanged", async () => {
  const state = { ...empty(), profile: { age: 40 } };
  const d = deps(["oops", "oops"]);
  const out = await runTurn(typed("कुछ भी", state), d);
  expect(out.reply).toBe(SAY_AGAIN.hi);
  expect(out.state).toEqual(state);
  expect(d.chat).toHaveBeenCalledTimes(2);
});

test("bad JSON then good → uses the good one", async () => {
  const d = deps(["oops", llm({ age: 30 }, "अच्छा।")]);
  const out = await runTurn(typed("मैं 30 साल का हूँ"), d);
  expect(d.chat).toHaveBeenCalledTimes(2);
  expect(out.state.profile).toEqual({ age: 30 });
});

test.each(["", " . ", "।"])("noise-only transcript %j → say again without LLM", async (heard) => {
  const d = deps([], { heard });
  const out = await runTurn(spoken(), d);
  expect(d.stt).toHaveBeenCalledTimes(1);
  expect(d.chat).not.toHaveBeenCalled();
  expect(out.reply).toBe(SAY_AGAIN.hi);
  expect(out.state).toEqual(empty());
});

test("history keeps last 6", async () => {
  const history = Array.from({ length: 6 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, text: `m${i}` }));
  const out = await runTurn(typed("मैं 45 साल की हूँ", { ...empty(), history }), deps([llm({ age: 45 }, "अच्छा।")]));
  expect(out.state.history).toHaveLength(6);
  expect(out.state.history.at(-2)).toEqual({ role: "user", text: "मैं 45 साल की हूँ" });
  expect(out.state.history.at(-1)).toEqual({ role: "assistant", text: out.reply });
});

test.each(["45", "₹90,000", "2"])("bare number answer %j goes to the LLM, not 'say again'", async (heard) => {
  const d = deps([llm({ age: 45 }, "अच्छा।")], { heard });
  const out = await runTurn(spoken(), d);
  expect(d.chat).toHaveBeenCalledTimes(1);
  expect(out.reply).not.toBe(SAY_AGAIN.hi);
});
