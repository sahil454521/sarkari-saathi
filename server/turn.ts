import { z } from "zod";
import { FIELDS, LangSchema, ProfileSchema, mergeProfile } from "./profile.ts";
import type { Field, Lang } from "./profile.ts";
import type { stt, tts } from "./gnani.ts";
import type { chat, ChatMessage } from "./llm.ts";
import { SCHEMES } from "./schemes.ts";
import type { SchemeCard } from "./schemes.ts";
import { MISSING_NOTE, QUESTIONS, SAY_AGAIN, pickNextField, resultsSummary } from "./questions.ts";

const MAX_QUESTIONS = 8;
const MAX_TEXT = 500;

export const TurnRequestSchema = z.object({
  audio: z.string().max(2_796_204).optional(), // base64 of ≤ 2 MB
  mime: z.string().max(100).optional(),
  text: z.string().max(MAX_TEXT).optional(),
  lang: LangSchema,
  state: z.object({
    profile: ProfileSchema,
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(MAX_TEXT) })).max(6),
    asked: z.array(z.enum(FIELDS as [Field, ...Field[]])).max(20),
  }),
}).refine((r) => (r.audio === undefined) !== (r.text === undefined), { message: "send exactly one of audio or text" });

export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export type TurnState = TurnRequest["state"];
export type TurnResponse = {
  heard: string; reply: string; audio: string | null; state: TurnState; phase: "asking" | "results"; schemes: SchemeCard[];
};
export type Deps = { stt: typeof stt; chat: typeof chat; tts: typeof tts };

// Plain types without ranges: mergeProfile enforces ranges, and strict JSON-schema modes reject many keywords.
const p = ProfileSchema.shape;
const LlmOutputSchema = z.object({
  facts: z.object({
    age: z.number().nullable(), gender: p.gender.unwrap().nullable(), state: z.string().nullable(),
    occupation: p.occupation.unwrap().nullable(), ownsFarmland: z.boolean().nullable(),
    annualFamilyIncome: z.number().nullable(), paysIncomeTax: z.boolean().nullable(),
    rationCard: p.rationCard.unwrap().nullable(), hasLpgConnection: z.boolean().nullable(),
    isPregnant: z.boolean().nullable(), daughterAges: z.array(z.number()).nullable(),
  }),
  reply: z.string(),
});
const { $schema: _, ...LLM_JSON_SCHEMA } = z.toJSONSchema(LlmOutputSchema);

const LANGUAGE: Record<Lang, string> = {
  hi: "Hindi in Devanagari script (common English words are fine)",
  mr: "Marathi in Devanagari script",
  en: "simple Indian English",
};

const SYSTEM_PROMPT = `You are Sarkari Saathi, a warm helper that finds Indian government schemes for people by voice. You never decide eligibility.
From the user's latest message, put only facts they clearly stated into "facts"; use null for anything not stated in this message. Corrections replace earlier values.
Normalise "state" to its English name, e.g. "Maharashtra". "annualFamilyIncome" is yearly family income in rupees. "daughterAges" lists the ages of all daughters; [] if they say they have none.
"reply": one or two short, warm sentences in {LANGUAGE} acknowledging what you understood. Do not ask any question. Do not mention schemes, money amounts or eligibility.
If the message is off-topic, reply with one polite sentence bringing them back to talking about themselves.`;

/** Parse the LLM's raw text; null when it isn't the { facts, reply } shape we need. */
function parseLlm(raw: string): { facts: Record<string, unknown>; reply: string } | null {
  try {
    const out = JSON.parse(raw);
    const okFacts = out?.facts && typeof out.facts === "object" && !Array.isArray(out.facts);
    return okFacts && typeof out.reply === "string" && out.reply.trim() ? { facts: out.facts, reply: out.reply.trim() } : null;
  } catch {
    return null;
  }
}

export async function runTurn(req: TurnRequest, deps: Deps): Promise<TurnResponse> {
  const { lang, state } = req;
  const sayAgain = (heard: string): TurnResponse =>
    ({ heard, reply: SAY_AGAIN[lang], audio: null, state, phase: "asking", schemes: [] });

  const heard = (req.text ?? await deps.stt(new Blob([Buffer.from(req.audio!, "base64")], { type: req.mime }), lang)).trim();
  if (!/\p{L}/u.test(heard)) return withAudio(sayAgain(heard), lang, deps);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT.replace("{LANGUAGE}", LANGUAGE[lang]) },
    { role: "user", content: JSON.stringify({ language: lang, profile: state.profile, recentConversation: state.history, userJustSaid: heard }) },
  ];
  const llm = parseLlm(await deps.chat(messages, LLM_JSON_SCHEMA)) ?? parseLlm(await deps.chat(messages, LLM_JSON_SCHEMA));
  if (!llm) return withAudio(sayAgain(heard), lang, deps);

  const profile = mergeProfile(state.profile, llm.facts);
  const results = SCHEMES.map((s) => s.check(profile));
  const next = state.asked.length >= MAX_QUESTIONS ? null : pickNextField(results, state.asked);

  let reply: string, asked = state.asked, phase: TurnResponse["phase"] = "asking", schemes: SchemeCard[] = [];
  if (next) {
    reply = `${llm.reply} ${QUESTIONS[next][lang]}`;
    asked = [...asked, next];
  } else {
    phase = "results";
    SCHEMES.forEach((s, i) => {
      const r = results[i];
      if (r.status === "no") return;
      const note = r.status === "likely" ? r.note[lang] : r.status === "needs" ? MISSING_NOTE[lang] : undefined;
      schemes.push({ id: s.id, status: r.status === "eligible" ? "eligible" : "likely", ...s.text[lang], url: s.url, ...(note && { note }) });
    });
    schemes.sort((a, b) => (a.status === b.status ? 0 : a.status === "eligible" ? -1 : 1)); // stable: keeps SCHEMES order
    reply = `${llm.reply} ${resultsSummary(lang, schemes.map((c) => c.name))}`;
  }

  // Replies can outgrow the request limit; trim so the next turn's state still validates.
  const history = [...state.history, { role: "user" as const, text: heard }, { role: "assistant" as const, text: reply }]
    .slice(-6).map((m) => ({ ...m, text: m.text.slice(0, MAX_TEXT) }));
  return withAudio({ heard, reply, audio: null, state: { profile, history, asked }, phase, schemes }, lang, deps);
}

async function withAudio(res: TurnResponse, lang: Lang, deps: Deps): Promise<TurnResponse> {
  try {
    return { ...res, audio: (await deps.tts(res.reply, lang)).toString("base64") };
  } catch {
    return res; // text still shows; audio is a nice-to-have
  }
}
