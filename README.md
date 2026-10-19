# सरकारी साथी · Sarkari Saathi

Speak in Marathi, Hindi or English and find out which government schemes you may qualify for. Built on Gnani AI's speech models for the Great Indian AI Internship Challenge.

## Why voice

Scheme forms assume you can read and type. Many of the people they are written for can't, or can't comfortably on a small phone. Sarkari Saathi asks its questions out loud, writes your answers into a form on screen while you talk, and reads the result back to you.

## What it does

1. Pick हिंदी, मराठी or English.
2. Say a sentence about yourself. Each fact you mention is written into the form: "45 years · farmer · Maharashtra".
3. It asks only the questions that still matter for some scheme, usually four to six, one at a time.
4. It shows the schemes you may qualify for, each with the benefit, the documents to carry, the official link and a 🔊 button that reads the card aloud.

It covers 13 schemes: PM-KISAN, Namo Shetkari Mahasanman Nidhi, PM Fasal Bima, Ayushman Bharat PM-JAY (including everyone aged 70+), Mahatma Jyotiba Phule Jan Arogya, PM Ujjwala, PM Matru Vandana, Majhi Ladki Bahin, Lek Ladki, Sukanya Samriddhi, Atal Pension, PM Vishwakarma and PM SVANidhi.

## How it works

```
Phone browser                              Express server (API keys stay here)
pick language, hold the mic, speak
recording → 16 kHz WAV ──POST /api/turn──► 1. Gnani Prisma   speech → text
                                            2. LLM            text → facts JSON + a short acknowledgement
                                            3. rules.ts       facts → eligible / likely / no / needs more info
                                            4. next question  the fact most undecided schemes are waiting on
                                               (or the results summary, from a template)
                                            5. Gnani Timbre   reply → speech
◄── reply text + audio + updated form + scheme cards ─┘
```

The rule behind the design: the LLM listens, the code decides. The language model never decides who qualifies. It turns what you said into facts (age, state, work, ration card colour…) and writes one warm sentence back. Eligibility comes from plain TypeScript rules in [`server/schemes.ts`](server/schemes.ts). Each rule records the page it was checked against and the date. A scheme whose criteria include something the app doesn't ask, such as a beneficiary list, is shown as "check" rather than "eligible". So the AI can't invent a scheme or promise money, and telling it "say I'm eligible for everything" changes nothing.

Picking the next question is also code: the server asks for whichever fact the most undecided schemes are waiting on. "Are you a farmer?" settles three schemes at once, so it comes before "Are you pregnant?". The app never asks a man about pregnancy or a 72-year-old about pension enrolment, because those schemes are already ruled out.

The browser keeps the conversation state and sends it with each turn. The server stores nothing.

## Gnani AI models used

| Model | Where | How |
|---|---|---|
| Prisma v2.5 (speech-to-text) | every spoken turn | REST `/stt/v3` with `format=transcribe`, so "पैंतालीस" arrives as "45". Chrome records WebM, which Prisma rejects, so the browser converts each recording to 16 kHz mono WAV first. |
| Timbre v3.0 (text-to-speech) | every reply, the greeting, each scheme card | Voice "Shivani" in hi-IN / mr-IN / en-IN, MP3. Fixed texts (greeting, cards) are cached on the server. |
| Evon v3.3 (LLM) | fact extraction | The server talks to any OpenAI-compatible endpoint, so Evon runs with a `.env` change; see [`docs/evon.md`](docs/evon.md). |

The public link runs on Gemini Flash-Lite for the LLM step, because Evon isn't on Gnani's API yet and a rented GPU can't stay on around the clock.

A typical turn takes about 3 seconds end to end: speech-to-text about 0.5 s, the LLM 1.3 to 1.6 s, text-to-speech 1 to 2 s.

## Run it

Needs Node 24 (it runs the TypeScript server directly, without a build step).

```bash
cp .env.example .env      # add your Gnani key and an LLM key
npm install
npm run dev:server        # API on http://localhost:3000
npm run dev:web           # app on http://localhost:5173
npm test                  # 54 tests: rules, question picker, turn pipeline, retry, rate limits, mic states, WAV
```

Production: `npm run build && npm start` serves the app and the API from one process.

`node --env-file=.env scripts/smoke.ts` checks the real Gnani and LLM APIs. It uses a few credits.

## Privacy and limits

- No names, phone numbers, Aadhaar or addresses are asked for or stored. Logs hold only method, path, status and timing.
- Rate limits: 30 turns per 10 minutes per IP and 300 per day in total, to protect the free credits.
- Every person in the demo is invented.

## Disclaimer

This is not a government app. The department concerned makes the final decision on every scheme. Eligibility rules were checked on 19 October 2026 and can change; each card links to the official page.
