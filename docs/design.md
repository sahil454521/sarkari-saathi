# Sarkari Saathi — Design Spec

Date: 2026-10-19 · Author: Sahil Pathak · Status: awaiting review

A voice-first mobile web app that helps people who struggle to read or type find the government schemes they qualify for. They talk in Hindi/Hinglish, Marathi or English; it asks short follow-up questions aloud and answers with the schemes they likely qualify for and the documents to carry.

## 1. Goal and success criteria

Built for Gnani AI's Great Indian AI Internship Challenge (closes **Nov 10, 2026, 11:59 PM IST**, no extensions).

Shortlisting = verified engagement on the LinkedIn/X demo post → eligibility check (genuine Gnani usage) → individual interview. No build guarantees an offer; this spec maximises the controllable parts:

1. A working, voice-first app that **genuinely uses Gnani Prisma (STT) and Timbre (TTS)**, plus Gnani Evon (LLM) for the demo.
2. A 60-second demo that hooks in the first 3 seconds and is easy to share.
3. Code small and clear enough that Sahil can explain every line in the interview.
4. Targets awards: **Real Deal** (real-world impact), **Main Character** (Marathi), **Mixed Vibes** (Hinglish), **Solo Ninja**, **Demo Day Drop**.

Contest rules that constrain the build: use at least one Gnani model/API; synthetic data only in the demo (no real phone/Aadhaar/PAN/calls); no misleading demos; post must be live before submission with `#GnaniAI #GreatIndianAIInternshipChallenge` and Gnani tagged.

## 2. Users

Primary: adults in rural and semi-urban Maharashtra (and Hindi-speaking users anywhere) with low literacy or low comfort typing, using a cheap Android phone. Secondary: family members or CSC operators helping them.

Demo personas (synthetic):
- **Sunita**, 45, woman farmer, Nashik, family income ₹90,000, yellow ration card, daughter aged 2 → speaks Marathi.
- **Ramesh**, 34, street vendor, Pune, income ₹1.2L, orange ration card → speaks Hinglish.
- **Kamla Devi**, 72, homemaker, Maharashtra → speaks Hindi.

## 3. Architecture

Stack: **Vite + React + TypeScript + Tailwind** (frontend), **Express 5 + TypeScript + zod** (backend), one package, one deploy. Matches Sahil's existing projects.

```
Phone browser                              Express server (all API keys live here)
pick language: हिंदी / मराठी / English
hold (or tap) mic → record
release ──POST /api/turn──────────────────► 1. Prisma STT        → transcript   (skipped if typed text)
  { audio|text, lang, state }               2. LLM (1 call)      → { facts, reply }  zod-validated
                                            3. merge facts into profile
                                            4. rules.ts          → per-scheme result + next question field
                                            5. compose reply:
                                               still asking  → LLM ack + template question for next field
                                               done          → LLM ack + template results summary
                                            6. Timbre TTS        → mp3 (base64)
◄── { heard, reply, audio, state, phase, schemes } ┘
play audio · show "आपने कहा", profile chips, scheme cards
```

Principle: **the LLM listens, code decides.** The LLM only (a) extracts facts and (b) writes short natural sentences. Eligibility is decided by plain TypeScript rules over curated scheme data; the next question and the results summary come from templates. The LLM never decides who qualifies.

No database, no login. The browser holds all conversation state and sends it each turn; the server stores nothing.

### Folder layout

```
sarkari-saathi/
  index.html
  src/                     # React app
    main.tsx  App.tsx  recorder.ts  api.ts  i18n.ts
  server/
    index.ts               # express app, routes, static
    limits.ts              # in-memory rate limiter
    http.ts                # fetchRetry(): timeout + one retry on 429/5xx
    gnani.ts               # stt(), tts()
    llm.ts                 # chat() via OpenAI-compatible fetch
    turn.ts                # the /api/turn pipeline
    profile.ts             # Profile zod schema + merge
    schemes.ts             # 13 schemes: text (hi/mr/en) + check()
    questions.ts           # pickNextField() + question templates (hi/mr/en)
    *.test.ts              # vitest
  scripts/smoke.ts         # real-API round trip: Timbre → Prisma
  .env.example  README.md
```

## 4. API contract

### `POST /api/turn` (JSON, body limit 3 MB)

Request:
```ts
{
  audio?: string        // base64 of the recorded blob
  mime?: string         // e.g. "audio/webm;codecs=opus"
  text?: string         // typed input; exactly one of audio | text, max 500 chars
  lang: "hi" | "mr" | "en"
  state: {
    profile: Profile
    history: { role: "user" | "assistant"; text: string }[]   // last 6, each ≤ 500 chars
    asked: Field[]      // fields already asked about, in order (max 20)
  }
}
```

Response:
```ts
{
  heard: string                     // transcript or typed text
  reply: string                     // what the app says (also shown as text)
  audio: string | null              // base64 mp3; null if TTS failed (text still shown)
  state: { profile; history; asked }
  phase: "asking" | "results"
  schemes: SchemeCard[]             // only eligible + likely, eligible first; empty while asking
}
type SchemeCard = { id; status: "eligible" | "likely"; name; benefit; documents: string[]; url; note?: string }  // text in lang
```

### `GET /api/speak?lang=mr&scheme=pm-kisan` and `GET /api/speak?lang=mr&greeting=1`

Returns `audio/mpeg`. Only fixed texts (scheme card summary or greeting), never arbitrary text, so nobody can use the endpoint to burn TTS credits on their own text. Results are cached in memory per (key, lang).

## 5. Gnani integration

Base URL `https://api.vachana.ai`, header `X-API-Key-ID: $GNANI_API_KEY`.

**STT — Prisma** `POST /stt/v3`, multipart: `audio_file`, `language_code`, `format=transcribe` (ITN, so "पैंतालीस" → "45"). Built with Node's global `FormData`/`Blob`, no multer. Response `{ success, transcript }`.

**TTS — Timbre** `POST /api/v1/tts/inference`, JSON: `{ text, model: "timbre-v3.0", voice, language, speed: 1.0, audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "mp3", bitrate: "64k" } }`. Response is raw audio bytes.

Language mapping:

| UI | STT `language_code` | TTS `language` | LLM reply language |
|---|---|---|---|
| hi | `hi-IN` | `hi-IN` | Hindi in Devanagari; common English words allowed (Hinglish) |
| mr | `mr-IN` | `mr-IN` | Marathi in Devanagari |
| en | `en-IN` | `en-IN` | Simple Indian English |

Voice: one timbre-v3.0 voice for all three languages (all v3.0 voices support all 10 languages). Default `Shivani`; final pick made in week 1 by listening to 3–4 voices.

## 6. LLM

Config via env: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Called with plain `fetch` to `${LLM_BASE_URL}/chat/completions`, `temperature: 0.2`, `response_format` = JSON schema of the output below, 15 s timeout.

- Dev and public link: **Gemini** via its OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai`), current Flash model (exact id confirmed at build time).
- Demo recording: **Gnani Evon v3.3** via llama.cpp `llama-server` on Kaggle (§12).

Output (zod-validated):
```ts
{ facts: Partial<Profile>, reply: string }   // reply ≤ 2 sentences
```

Prompt inputs: UI language, current profile, last 6 history messages, the latest user text.

Prompt rules:
- Put in `facts` only things the user stated in this message; never guess. Corrections overwrite.
- `reply` is a brief, warm acknowledgement of what was understood. **No question** (the server appends the next question or the results summary). Never mention schemes, money or eligibility.
- Off-topic requests get a polite one-line redirect.

Invalid JSON or schema mismatch → one retry → else profile unchanged and reply = fixed "please say that again" template.

## 7. Profile

```ts
Profile = {
  age?: number                      // 0–120
  gender?: "male" | "female" | "other"
  state?: string                    // Indian state name, normalised to English (e.g. "Maharashtra")
  occupation?: "farmer" | "street_vendor" | "artisan" | "daily_wage" | "govt_job" | "private_job" | "homemaker" | "student" | "none"
  ownsFarmland?: boolean
  annualFamilyIncome?: number       // rupees, 0–1e8
  paysIncomeTax?: boolean
  rationCard?: "yellow" | "orange" | "white" | "none"
  hasLpgConnection?: boolean
  isPregnant?: boolean
  daughterAges?: number[]           // each 0–120 (adult daughters are valid), max 10 entries
}
```

The browser's profile is untrusted input: the server parses it with zod on every request (unknown keys stripped, out-of-range values rejected → 400). No names, phone numbers, Aadhaar or addresses are collected.

## 8. Schemes and rules

13 schemes:

| Area | Central | Maharashtra |
|---|---|---|
| Farmers | PM-KISAN, PM Fasal Bima Yojana | Namo Shetkari Mahasanman Nidhi |
| Health | Ayushman Bharat PM-JAY (incl. Vay Vandana, all aged 70+) | Mahatma Jyotiba Phule Jan Arogya Yojana |
| Women / mothers | PM Ujjwala Yojana, PM Matru Vandana Yojana | Mukhyamantri Majhi Ladki Bahin Yojana |
| Girl child | Sukanya Samriddhi Yojana | Lek Ladki Yojana |
| Workers | Atal Pension Yojana, PM Vishwakarma, PM SVANidhi | — |

Each scheme in `schemes.ts`:
```ts
{
  id: string
  text: Record<Lang, { name: string; benefit: string; documents: string[]; note?: string }>
  url: string                 // official scheme page
  source: string              // official page the rule was verified against
  checkedOn: string           // date verified, e.g. "2026-10-21"
  check(p: Profile): RuleResult
}
type RuleResult =
  | { status: "eligible" }                  // all criteria known and met
  | { status: "likely"; note: Record<Lang,string> }  // known facts fit; final check only an office can do (e.g. SECC list)
  | { status: "no" }                        // ruled out; never shown or read out
  | { status: "needs"; fields: Field[] }    // can't decide yet
```

**Rule accuracy:** every `check()` is written from the official source at build time and records `source` + `checkedOn`. A criterion that can't be confirmed from an official source is either modelled as `likely` with a note, or the scheme is dropped. Rules never return `eligible` when the official criteria include something we don't ask (such as a beneficiary list); that's `likely`.

**Next question** (`pickNextField`): count each field across all schemes currently `needs`; pick the field with the highest count; tie-break by fixed order `age, gender, state, occupation, ownsFarmland, annualFamilyIncome, paysIncomeTax, rationCard, hasLpgConnection, isPregnant, daughterAges`. A field already asked twice is skipped (no loops).

**Question templates** (`questions.ts`): one short spoken question per field × 3 languages, written to be answerable in a few words.

**First turn:** the greeting asks an open question ("अपने बारे में बताइए — उम्र, काम, और कहाँ रहते हैं?") so one answer can fill several facts at once.

**Switch to results** when no scheme is `needs`, or after 8 questions. At the cap, schemes still `needs` are shown as `likely` with a "some details missing" note. Results summary template: count + scheme names, e.g. "आप इन 5 योजनाओं के लिए पात्र हो सकते हैं: …". Results end the conversation; "शुरू से" starts a new one.

## 9. Screen (single page, mobile-first)

1. **Start:** title "सरकारी साथी", three large language buttons (हिंदी / मराठी / English). Tap → greeting plays (cached) → conversation.
2. **Conversation:**
   - Current question in large text.
   - Big round mic. Hold to talk, or tap once to start and tap again to stop. Auto-stop at 25 s. Keyboard: Space toggles.
   - States: idle · listening (pulsing ring + seconds counter) · thinking ("सोच रहा हूँ…") · speaking (tap to skip).
   - "आपने कहा: …" line under the mic.
   - Profile chips that fill in as facts arrive (👩 45 · किसान · महाराष्ट्र).
   - ⌨️ toggle reveals a text box (accessibility; also saves STT credits while testing).
3. **Results:** headline count, then scheme cards (name, benefit, documents, official link, 🔊 which plays `/api/speak`). Eligible before likely. Mic hidden. "शुरू से" (start over) button.
4. **Footer, always visible:** "यह सरकारी ऐप नहीं है। अंतिम निर्णय संबंधित विभाग करता है।" (this is not a government app; the department makes the final decision), in the chosen language.

Accessibility: tap targets ≥ 48 px, aria-labels on all icon buttons, everything spoken is also shown as text, visible focus states, respects `prefers-reduced-motion`.

Recording: `MediaRecorder` with the browser's default type, sent as-is (Prisma accepts OGG/M4A; Chrome's WebM to be confirmed in week 1, see §14).

## 10. Errors and limits

| Case | Behaviour |
|---|---|
| Mic permission denied | Message with how to allow it; ⌨️ typing offered |
| Empty / unusable transcript | Fixed "please say that again" template in chosen language; no LLM call |
| Gnani or LLM 429 / 5xx / timeout | One retry with 500 ms backoff, then a friendly text error; state unchanged |
| TTS fails but rest succeeds | Return text with `audio: null` |
| LLM bad JSON | One retry, then "please say that again"; profile unchanged |
| Invalid request body / state | 400 with a generic message |
| Audio > 2 MB or > 25 s | Client stops at 25 s; server rejects > 2 MB with 413 |
| Rate limit | Per IP: 30 turns / 10 min; global: 1,500 turns / day; 429 with a friendly message |

## 11. Security and privacy

- All API keys server-side only, read from env; `.env` git-ignored; `.env.example` committed.
- Same-origin only (no CORS enabled). `app.set("trust proxy", 1)` on Render so the per-IP limit sees real IPs.
- Untrusted inputs validated with zod: body, `state`, `lang`, text length, audio size.
- `/api/speak` serves fixed texts only.
- Prompt injection can't change eligibility: the LLM only proposes facts; rules decide. Users can still state false facts, which is inherent to self-reported screening, so results say "may be eligible" and the footer disclaims.
- Nothing is stored or logged beyond request status and latency (no transcripts in logs).

## 12. Deployment and Evon

**Public app:** Render free web service. Build: `vite build`; start: `node server/index.ts` (Node 24 runs TypeScript natively, so the server has no build step), which serves `dist/` and `/api/*` over HTTPS (needed for the mic). Free tier sleeps; open the link a minute before any live demo.

**Evon for the demo:** Kaggle notebook (2× T4, 32 GB VRAM):
1. Download the quantized Evon GGUF (Q4_K_M) from Hugging Face.
2. Run `llama-server` with `-ngl 99`, `--jinja`, thinking disabled through the chat template kwargs (`enable_thinking: false`).
3. Expose it with a `cloudflared` quick tunnel.
4. Set `LLM_BASE_URL` to the tunnel URL and `LLM_MODEL` to the served name.
5. Run the persona test conversations, then record the demo.

`response_format` JSON schema makes llama.cpp constrain the output to valid JSON.

**Honesty rule:** the demo video and post state the LLM used. The public link runs on Gemini because the Kaggle session isn't 24/7; the README and post say so.

## 13. Testing

- **vitest, rules:** table-driven persona → expected eligible/likely scheme ids (at least the 3 demo personas plus edge cases: income tax payer, age 70+, male asked about pregnancy never, non-Maharashtra resident gets no state schemes).
- **vitest, `pickNextField`:** the most-shared field is asked first; fields asked twice are skipped; returns none when nothing is `needs`.
- **vitest, `turn.ts`:** with `stt`, `chat`, `tts` stubbed: asking → results transition, cap at 8 questions, TTS failure returns `audio: null`, LLM bad JSON → one retry → "please say that again" with profile unchanged.
- **`scripts/smoke.ts`** (manual, uses real credits): Timbre synthesises a Marathi sentence → Prisma transcribes it → print both and the latency. Also sends one Chrome WebM recording to Prisma to confirm the format.
- **Manual:** full conversation for each persona on a real Android phone over the deployed HTTPS link.

## 14. Verify in week 1 (each has a fallback decided now)

| Unknown | Check | If it fails |
|---|---|---|
| Prisma accepts Chrome's WebM/Opus | smoke script | Convert to 16 kHz mono WAV in the browser (`decodeAudioData` + `OfflineAudioContext`, ~25 lines) |
| Prisma `hi-IN` handles Hinglish speech well | smoke + manual | Use `en-IN` (Latin-script output, mixed audio supported) for the Hindi option |
| Credit cost per STT/TTS call | dashboard after smoke | Lower the global daily cap to fit 5,000 credits with a margin for demo recording |
| Gemini current Flash model id + JSON-schema support on the OpenAI endpoint | one request | Use `response_format: { type: "json_object" }` with the schema in the prompt |
| Evon GGUF exists and llama.cpp loads `nemotron_h` | Kaggle notebook | Run Evon with vLLM on a rented GPU for the recording only, or record with Gemini and say so |
| Each scheme's eligibility criteria | official sources | Model as `likely` or drop the scheme |

## 15. Launch kit (part of the deliverable)

- `README.md`: what it does, why voice, architecture diagram, "LLM listens, code decides", Gnani models used, how to run, honest LLM note.
- `docs/demo-script.md`: a 60-second script. 0–3 s hook (Sunita speaks Marathi, the app answers in Marathi); 3–40 s live conversation with chips filling in; 40–55 s results cards, one read aloud with 🔊; 55–60 s "Built on Gnani Prisma + Timbre + Evon" end card. Synthetic personas only.
- `docs/posts.md`: a LinkedIn post draft and an X thread draft with Gnani tagged and `#GnaniAI #GreatIndianAIInternshipChallenge`; the project explanation text for the submission form.
- Sahil posts and submits; nothing is posted automatically.

## 16. Timeline

| Week | Dates | Work |
|---|---|---|
| 1 | Oct 19–25 | Gnani key + smoke script; resolve §14 unknowns; schemes + rules + tests; `/api/turn`; basic screen working end to end |
| 2 | Oct 26 – Nov 1 | Full screen (chips, cards, states, typing); Marathi/Hindi texts proofread by a fluent speaker; Render deploy; real-phone testing; Evon on Kaggle |
| 3 | Nov 2–8 | Record and edit the 60-s demo; README + posts; **post by ~Nov 5**; submit with the nominated post links before Nov 10 |

## 17. Out of scope

Follow-up Q&A after results, phone calls / IVR, login, database, saving conversations, schemes of states other than Maharashtra, languages beyond hi/mr/en, applying for schemes on the user's behalf, document upload, streaming STT/TTS, a native app.
