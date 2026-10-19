import { test, expect } from "vitest";
import { createEndpointer, nextMicState } from "./recorder.ts";
import type { MicEvent, MicState } from "./recorder.ts";

test.each<[MicState, MicEvent, number, MicState, "start" | "stop" | "cancel" | null]>([
  ["idle", "down", 0, "recording", "start"],
  ["idle", "key", 0, "recording", "start"],
  ["recording", "up", 300, "busy", "stop"],     // held long enough: push-to-talk release
  ["recording", "up", 299, "recording", null],  // quick tap: keep recording until the next tap
  ["recording", "down", 0, "busy", "stop"],
  ["recording", "key", 0, "busy", "stop"],
  ["recording", "timeout", 0, "busy", "stop"],
  ["busy", "done", 0, "idle", null],
  ["busy", "down", 0, "busy", null],            // pressing while thinking/speaking is ignored
  ["busy", "key", 0, "busy", null],
  ["busy", "up", 500, "busy", null],
  ["idle", "up", 500, "idle", null],
  ["idle", "done", 0, "idle", null],
  ["recording", "cancel", 0, "idle", "cancel"], // heard nothing: stop listening without sending
  ["idle", "cancel", 0, "idle", null],
  ["busy", "cancel", 0, "busy", null],
])("%s + %s (held %i ms) → %s, %s", (from, event, held, to, action) => {
  expect(nextMicState(from, event, held)).toEqual({ state: to, action });
});

/** Feeds [level, untilMs] segments every 100 ms; returns the first non-"listening" result and when it happened. */
function run(segments: [number, number][]) {
  const endpoint = createEndpointer();
  let t = 0;
  for (const [level, until] of segments)
    for (; t < until; t += 100) { const r = endpoint(level, t); if (r !== "listening") return { r, t }; }
  return { r: "listening", t };
}

test("ends the turn after 2 s of silence following speech", () =>
  expect(run([[0.01, 300], [0.2, 1500], [0.01, 5000]])).toEqual({ r: "speech-ended", t: 1400 + 2000 }));
test("a 1.5 s thinking pause mid-answer does not end the turn", () =>
  expect(run([[0.01, 300], [0.2, 1000], [0.01, 2500], [0.2, 3000], [0.01, 8000]])).toEqual({ r: "speech-ended", t: 2900 + 2000 }));
test("a short pause inside a sentence does not end the turn", () =>
  expect(run([[0.01, 300], [0.2, 1000], [0.01, 1800], [0.2, 2500], [0.01, 6000]])).toEqual({ r: "speech-ended", t: 2400 + 2000 }));
test("no speech for 8 s stops listening", () =>
  expect(run([[0.01, 9000]])).toEqual({ r: "no-speech", t: 8000 }));
test("steady background noise is not mistaken for speech", () =>
  expect(run([[0.06, 9000]])).toEqual({ r: "no-speech", t: 8000 }));
test("speech is still detected over a noisy background", () =>
  expect(run([[0.06, 300], [0.3, 1500], [0.06, 5000]])).toEqual({ r: "speech-ended", t: 1400 + 2000 }));
