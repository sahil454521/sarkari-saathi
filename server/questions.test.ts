import { test, expect } from "vitest";
import { FIELDS } from "./profile.ts";
import type { RuleResult } from "./schemes.ts";
import { pickNextField, QUESTIONS, NO_MATCH, resultsSummary } from "./questions.ts";

const shared: RuleResult[] = [{ status: "needs", fields: ["age", "gender"] }, { status: "needs", fields: ["gender"] }];

test("picks the field most schemes need", () => expect(pickNextField(shared, [])).toBe("gender"));
test("ties break by FIELDS order", () =>
  expect(pickNextField([{ status: "needs", fields: ["state"] }, { status: "needs", fields: ["age"] }], [])).toBe("age"));
test("skips a field already asked twice", () => expect(pickNextField(shared, ["gender", "gender"])).toBe("age"));
test("returns null when nothing needs input", () =>
  expect(pickNextField([{ status: "eligible" }, { status: "no" }], [])).toBeNull());
test("every field has a question in every language", () =>
  FIELDS.forEach(f => (["hi", "mr", "en"] as const).forEach(l => expect(QUESTIONS[f][l].length).toBeGreaterThan(0))));
test("resultsSummary lists names and falls back to NO_MATCH", () => {
  const s = resultsSummary("en", ["A", "B"]);
  ["2", "A", "B"].forEach(x => expect(s).toContain(x));
  expect(resultsSummary("hi", [])).toBe(NO_MATCH.hi);
});
