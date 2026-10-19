import { test, expect } from "vitest";
import { createLimiter } from "./limits.ts";

test("allows max then blocks", () => {
  const allow = createLimiter(30, 600_000);
  for (let i = 0; i < 30; i++) expect(allow("a", 0)).toBe(true);
  expect(allow("a", 0)).toBe(false);
});
test("window resets", () => {
  const allow = createLimiter(30, 600_000);
  for (let i = 0; i < 31; i++) allow("a", 0);
  expect(allow("a", 600_001)).toBe(true);
});
test("keys are independent", () => {
  const allow = createLimiter(30, 600_000);
  for (let i = 0; i < 31; i++) allow("a", 0);
  expect(allow("b", 0)).toBe(true);
});
