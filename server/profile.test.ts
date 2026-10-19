import { test, expect } from "vitest";
import { mergeProfile } from "./profile.ts";

test("mergeProfile overwrites, drops invalid/null/unknown facts individually", () => {
  const out = mergeProfile({ age: 40, state: "Maharashtra" },
    { age: 300, gender: "female", state: null, foo: 1, occupation: "farmer", annualFamilyIncome: "pachas hazaar" });
  expect(out).toEqual({ age: 40, state: "Maharashtra", gender: "female", occupation: "farmer" });
});
test("corrections overwrite earlier values", () => {
  expect(mergeProfile({ age: 40 }, { age: 62 })).toEqual({ age: 62 });
});
test("adult daughter ages are valid", () => {
  expect(mergeProfile({}, { daughterAges: [45] })).toEqual({ daughterAges: [45] });
});
test("fractional ages round down to whole years instead of being dropped", () => {
  expect(mergeProfile({}, { age: 45.7, daughterAges: [0.5, 7] })).toEqual({ age: 45, daughterAges: [0, 7] });
});
