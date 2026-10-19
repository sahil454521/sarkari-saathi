import { test, expect, vi, afterEach } from "vitest";
import { splitAtPauses, stt } from "./gnani.ts";
import { encodeWav } from "../src/wav.ts";

afterEach(() => vi.unstubAllGlobals());

const RATE = 16000;
/** Constant "speech" with silent gaps at the given [fromSec, toSec] ranges. */
function audio(seconds: number, gaps: [number, number][] = []): Int16Array {
  const pcm = new Int16Array(seconds * RATE).fill(1000);
  for (const [a, b] of gaps) pcm.fill(0, a * RATE, b * RATE);
  return pcm;
}

test("short recordings stay in one piece", () => {
  expect(splitAtPauses(audio(7), RATE)).toHaveLength(1);
});

test("long recordings are cut inside pauses, each piece at most 8 s, nothing lost", () => {
  const pcm = audio(20, [[6.5, 7.0], [13.0, 13.5]]);
  const parts = splitAtPauses(pcm, RATE);
  expect(parts.map((p) => p.length).reduce((a, b) => a + b)).toBe(pcm.length);
  parts.forEach((p) => expect(p.length).toBeLessThanOrEqual(8 * RATE));
  const cut1 = parts[0].length / RATE, cut2 = (parts[0].length + parts[1].length) / RATE;
  expect(cut1).toBeGreaterThanOrEqual(6.5); expect(cut1).toBeLessThanOrEqual(7.0);
  expect(cut2).toBeGreaterThanOrEqual(13.0); expect(cut2).toBeLessThanOrEqual(13.5);
});

test("speech with no pause still splits into pieces of at most 8 s", () => {
  const parts = splitAtPauses(audio(20), RATE);
  expect(parts.length).toBeGreaterThan(2);
  parts.forEach((p) => expect(p.length).toBeLessThanOrEqual(8 * RATE));
});

test("stt transcribes a long WAV piece by piece and joins the text in order", async () => {
  let n = 0;
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, transcript: `part${++n}` })));
  vi.stubGlobal("fetch", fetchMock);
  const pcm = audio(20, [[6.5, 7.0], [13.0, 13.5]]);
  const wav = new Blob([encodeWav(Float32Array.from(pcm, (x) => x / 32768), RATE)], { type: "audio/wav" });
  expect(await stt(wav, "hi")).toBe("part1 part2 part3");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("stt sends a short WAV as a single request", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, transcript: "हाँ" })));
  vi.stubGlobal("fetch", fetchMock);
  const wav = new Blob([encodeWav(new Float32Array(3 * RATE), RATE)], { type: "audio/wav" });
  expect(await stt(wav, "hi")).toBe("हाँ");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("pieces are sent one at a time (Gnani answers 429 to parallel requests)", async () => {
  let inFlight = 0, maxInFlight = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    maxInFlight = Math.max(maxInFlight, ++inFlight);
    await new Promise((r) => setTimeout(r, 10));
    inFlight--;
    return new Response(JSON.stringify({ success: true, transcript: "x" }));
  }));
  const pcm = audio(20, [[6.5, 7.0], [13.0, 13.5]]);
  await stt(new Blob([encodeWav(Float32Array.from(pcm, (x) => x / 32768), RATE)], { type: "audio/wav" }), "hi");
  expect(maxInFlight).toBe(1);
});
