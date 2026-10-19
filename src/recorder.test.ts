import { test, expect } from "vitest";
import { nextMicState } from "./recorder.ts";
import type { MicEvent, MicState } from "./recorder.ts";

test.each<[MicState, MicEvent, number, MicState, "start" | "stop" | null]>([
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
])("%s + %s (held %i ms) → %s, %s", (from, event, held, to, action) => {
  expect(nextMicState(from, event, held)).toEqual({ state: to, action });
});
