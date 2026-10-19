import { fileURLToPath } from "node:url";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { LangSchema } from "./profile.ts";
import { stt, tts } from "./gnani.ts";
import { chat } from "./llm.ts";
import { SCHEMES } from "./schemes.ts";
import { GREETING, cardSpeech } from "./questions.ts";
import { TurnRequestSchema, runTurn } from "./turn.ts";
import { createLimiter } from "./limits.ts";

const app = express();
// Render chain measured 2026-10-19: client → Cloudflare → Render LB → internal proxy. With 1, req.ip was Render's
// internal IP, so every visitor shared one rate-limit bucket. 3 hops makes req.ip the real caller.
app.set("trust proxy", 3);

// Status and timing only: never log transcripts, text, profile or audio.
app.use("/api", (req, res, next) => {
  const start = performance.now();
  res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Math.round(performance.now() - start)}ms`));
  next();
});
app.use(express.json({ limit: "3mb" }));

const perIp = createLimiter(30, 10 * 60_000);
// shortcut: counts live in memory, so a restart (Render free tier sleeps after 15 idle min) resets them; watch the Gnani credits dashboard, and move counts to a store if abuse shows up
const daily = createLimiter(300, 24 * 60 * 60_000); // ~0.45 Gnani credit per turn

app.post("/api/turn", async (req, res) => {
  if (!perIp(req.ip ?? "unknown") || !daily("global")) { res.status(429).json({ error: "limit" }); return; }
  if (typeof req.body?.audio === "string" && req.body.audio.length > 2_796_204) { res.status(413).json({ error: "too_large" }); return; }
  const parsed = TurnRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad_request" }); return; }
  try {
    res.json(await runTurn(parsed.data, { stt, chat, tts }));
  } catch (err) {
    console.error(`turn failed: ${(err as Error).message}`);
    res.status(502).json({ error: "upstream" });
  }
});

// Only fixed texts (13 scheme cards + greeting, × 3 languages), cached, so TTS spend is bounded without a rate limit.
const speakCache = new Map<string, Buffer>();
app.get("/api/speak", async (req, res) => {
  const lang = LangSchema.safeParse(req.query.lang);
  const scheme = SCHEMES.find((s) => s.id === req.query.scheme);
  if (!lang.success || (!scheme && req.query.greeting !== "1")) { res.status(400).json({ error: "bad_request" }); return; }
  const key = `${scheme?.id ?? "greeting"}:${lang.data}`;
  try {
    let audio = speakCache.get(key);
    if (!audio) {
      audio = await tts(scheme ? cardSpeech(scheme.text[lang.data], lang.data) : GREETING[lang.data], lang.data);
      speakCache.set(key, audio);
    }
    res.type("audio/mpeg").send(audio);
  } catch (err) {
    console.error(`speak failed: ${(err as Error).message}`);
    res.status(502).json({ error: "upstream" });
  }
});

app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));

// Body-parser errors: oversized body → 413, malformed JSON → 400.
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.status === 413 ? 413 : err.status >= 400 && err.status < 500 ? 400 : 500;
  res.status(status).json({ error: status === 413 ? "too_large" : status === 400 ? "bad_request" : "upstream" });
};
app.use(onError);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Sarkari Saathi on http://localhost:${port}`));
