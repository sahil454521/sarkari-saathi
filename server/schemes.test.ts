import { test, expect } from "vitest";
import type { Profile } from "./profile.ts";
import { SCHEMES } from "./schemes.ts";
import { sunita, ramesh, kamla } from "./fixtures.ts";

const shown = (p: Profile): Record<string, string> =>
  Object.fromEntries(SCHEMES.map(s => [s.id, s.check(p).status]).filter(([, st]) => st === "eligible" || st === "likely"));

// Unasked official criteria (PM-KISAN land date, Ladki Bahin offset, Lek Ladki birth order) keep these at "likely" (spec §8).
test("Sunita", () => expect(shown(sunita)).toEqual({ "pm-kisan": "likely", "namo-shetkari": "likely", pmfby: "likely",
  "pm-jay": "likely", mjpjay: "eligible", "ladki-bahin": "likely", "lek-ladki": "likely", sukanya: "eligible" }));
test("Ramesh", () => expect(shown(ramesh)).toEqual({ "pm-jay": "likely", mjpjay: "eligible", apy: "eligible", "pm-svanidhi": "likely" }));
test("Kamla (70+, adult daughter)", () => expect(shown(kamla)).toEqual({ "pm-jay": "eligible", mjpjay: "eligible", ujjwala: "likely" }));
test("full personas leave nothing undecided", () =>
  [sunita, ramesh, kamla].forEach(p => SCHEMES.forEach(s => expect(s.check(p).status).not.toBe("needs"))));
test("income-tax payer loses pm-kisan, namo-shetkari, ladki-bahin", () => {
  const s = shown({ ...sunita, paysIncomeTax: true });
  ["pm-kisan", "namo-shetkari", "ladki-bahin"].forEach(id => expect(s[id]).toBeUndefined());
});
test("outside Maharashtra: no state schemes", () => {
  const s = shown({ ...sunita, state: "Bihar" });
  ["namo-shetkari", "mjpjay", "ladki-bahin", "lek-ladki"].forEach(id => expect(s[id]).toBeUndefined());
  expect(s["pm-kisan"]).toBe("likely"); // central scheme still shown outside Maharashtra
});
test("state spelling variants count as Maharashtra", () =>
  expect(shown({ ...sunita, state: " MAHARASHTRA " })).toEqual(shown(sunita)));
test("daughter aged 3 makes lek-ladki likely", () => expect(shown({ ...sunita, daughterAges: [3] })["lek-ladki"]).toBe("likely"));
test("empty profile: nothing ruled out yet", () => SCHEMES.forEach(s => expect(s.check({}).status).toBe("needs")));
test("men are never asked about pregnancy", () =>
  SCHEMES.forEach(s => { const r = s.check({ gender: "male" }); if (r.status === "needs") expect(r.fields).not.toContain("isPregnant"); }));
test("every scheme has text in all languages, a source and a check date", () =>
  SCHEMES.forEach(s => (["hi", "mr", "en"] as const).forEach(l => {
    expect(s.text[l].name && s.text[l].benefit && s.text[l].documents.length).toBeTruthy();
    expect(s.source).toMatch(/^https:\/\//); expect(s.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  })));
test("family income above ₹1 lakh rules out lek-ladki", () =>
  expect(shown({ ...sunita, annualFamilyIncome: 150000 })["lek-ladki"]).toBeUndefined());
test("white ration card makes mjpjay likely, not eligible", () =>
  expect(shown({ ...sunita, rationCard: "white" }).mjpjay).toBe("likely"));
