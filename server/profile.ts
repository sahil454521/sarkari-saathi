import { z } from "zod";

export const LangSchema = z.enum(["hi", "mr", "en"]);
export type Lang = z.infer<typeof LangSchema>;

export const ProfileSchema = z.object({
  age: z.number().int().min(0).max(120).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  state: z.string().max(40).optional(),
  occupation: z
    .enum(["farmer", "street_vendor", "artisan", "daily_wage", "govt_job", "private_job", "homemaker", "student", "none"])
    .optional(),
  ownsFarmland: z.boolean().optional(),
  annualFamilyIncome: z.number().min(0).max(1e8).optional(),
  paysIncomeTax: z.boolean().optional(),
  rationCard: z.enum(["yellow", "orange", "white", "none"]).optional(),
  hasLpgConnection: z.boolean().optional(),
  isPregnant: z.boolean().optional(),
  daughterAges: z.array(z.number().int().min(0).max(120)).max(10).optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;
export type Field = keyof Profile;

// Order matters: it breaks ties when choosing the next question.
export const FIELDS: Field[] = [
  "age", "gender", "state", "occupation", "ownsFarmland", "annualFamilyIncome",
  "paysIncomeTax", "rationCard", "hasLpgConnection", "isPregnant", "daughterAges",
];

/** Facts come from the LLM, so each one is validated on its own; a bad one is dropped, not fatal. */
export function mergeProfile(p: Profile, facts: Record<string, unknown>): Profile {
  const out: Record<string, unknown> = { ...p };
  for (const key of FIELDS) {
    const value = facts[key];
    if (value === null || value === undefined) continue;
    if (ProfileSchema.shape[key].safeParse(value).success) out[key] = value;
  }
  return out as Profile;
}
