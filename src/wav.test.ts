import { test, expect } from "vitest";
import { encodeWav } from "./wav.ts";

const text = (v: DataView, at: number) => String.fromCharCode(...[0, 1, 2, 3].map(i => v.getUint8(at + i)));

test("writes a 16-bit mono PCM WAV header for the given rate", () => {
  const v = new DataView(encodeWav(new Float32Array(10), 16000));
  expect(v.byteLength).toBe(44 + 10 * 2);
  expect(text(v, 0)).toBe("RIFF");
  expect(v.getUint32(4, true)).toBe(36 + 20);
  expect(text(v, 8)).toBe("WAVE");
  expect(text(v, 12)).toBe("fmt ");
  expect(v.getUint16(20, true)).toBe(1);      // PCM
  expect(v.getUint16(22, true)).toBe(1);      // mono
  expect(v.getUint32(24, true)).toBe(16000);  // sample rate
  expect(v.getUint32(28, true)).toBe(32000);  // byte rate
  expect(v.getUint16(32, true)).toBe(2);      // block align
  expect(v.getUint16(34, true)).toBe(16);     // bits per sample
  expect(text(v, 36)).toBe("data");
  expect(v.getUint32(40, true)).toBe(20);
});

test("converts and clamps samples to 16-bit", () => {
  const v = new DataView(encodeWav(new Float32Array([0, 1, -1, 2, -2, 0.5]), 16000));
  expect([0, 1, 2, 3, 4, 5].map(i => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767, -32768, 16384]);
});
