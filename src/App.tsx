import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { FIELDS } from "../server/profile.ts";
import type { Field, Lang, Profile } from "../server/profile.ts";
import type { TurnState } from "../server/turn.ts";
import type { SchemeCard } from "../server/schemes.ts";
import { GREETING } from "../server/questions.ts";
import { nextMicState, startRecording } from "./recorder.ts";
import type { MicDebug, MicEvent, MicState } from "./recorder.ts";
import { blobToBase64, sendTurn, speakUrl } from "./api.ts";
import { toWav16k } from "./wav.ts";
import type { ApiError } from "./api.ts";
import { ERRORS, FIELD_LABEL, UI, formatValue, resultsHeadline } from "./i18n.ts";

const LANGS: { lang: Lang; name: string }[] = [
  { lang: "hi", name: "हिंदी" }, { lang: "mr", name: "मराठी" }, { lang: "en", name: "English" },
];
const EMPTY: TurnState = { profile: {}, history: [], asked: [] };
const MAX_RECORD_MS = 25_000;
// Phone speakers lag the audio element's "ended" by a few hundred ms (more over Bluetooth). Opening the mic
// sooner switches Android to call mode, which turns the last words down and records them as "noise".
const LISTEN_DELAY_MS = 700;
// shortcut: mic diagnostics panel, shown only with ?debug=1; remove once mic tuning on real phones is settled
const DEBUG = new URLSearchParams(location.search).has("debug");

export default function App() {
  const [lang, setLang] = useState<Lang | null>(null);
  const [turn, setTurn] = useState<TurnState>(EMPTY);
  const [said, setSaid] = useState("");
  const [heard, setHeard] = useState("");
  const [phase, setPhase] = useState<"asking" | "results">("asking");
  const [schemes, setSchemes] = useState<SchemeCard[]>([]);
  const [mic, setMic] = useState<MicState>("idle");
  const [tapMode, setTapMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [replay, setReplay] = useState<{ src: string; listenAfter: boolean } | null>(null);

  // Refs, because recording and requests finish in callbacks created by earlier renders.
  const micRef = useRef<MicState>("idle");
  const turnRef = useRef<TurnState>(EMPTY);
  const downAt = useRef(0);
  const recording = useRef<ReturnType<typeof startRecording> | null>(null);
  const timer = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const conv = useRef(0); // bumped on start over / new language, so replies from an older conversation are dropped
  const langRef = useRef<Lang | null>(null);
  const listenTimer = useRef(0);
  // ?debug=1 only
  const [meter, setMeter] = useState<MicDebug | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const endReason = useRef("");
  const listen = useRef({ n: 0, t0: 0, peak: 0, longestPause: 0, lastQuiet: 0, last: null as MicDebug | null });

  function dlog(msg: string) {
    if (DEBUG) setDebugLog((log) => [...log.slice(-40), `${(performance.now() / 1000).toFixed(1)}s ${msg}`]);
  }

  function onMicDebug(d: MicDebug) {
    const s = listen.current;
    s.peak = Math.max(s.peak, d.level);
    if ((d.quietMs ?? 0) < s.lastQuiet) s.longestPause = Math.max(s.longestPause, s.lastQuiet); // a pause just ended
    s.lastQuiet = d.quietMs ?? 0;
    s.last = d;
    setMeter(d);
  }

  function logListenEnd() {
    const s = listen.current, d = s.last;
    dlog(`listen ${s.n} end: ${endReason.current || "?"} after ${((performance.now() - s.t0) / 1000).toFixed(1)} s` +
      ` · noise ${d?.noise.toFixed(3)} thr ${d?.threshold.toFixed(3)} · peak ${s.peak.toFixed(3)} · longest pause ${(s.longestPause / 1000).toFixed(1)} s`);
  }

  /** listenAfter: open the mic when the reply finishes, so the conversation runs hands-free. */
  function play(src: string, listenAfter = false) {
    // One element for the whole session: the language tap unlocks it, so phones let later replies play unprompted.
    const a = (audio.current ??= new Audio());
    clearTimeout(listenTimer.current);
    a.pause();
    a.src = src;
    a.onended = () => {
      setSpeaking(false);
      dlog(`reply audio ended${listenAfter ? ", listening in 0.7 s" : ""}`);
      if (listenAfter) listenSoon();
    };
    setReplay(null);
    setSpeaking(true);
    a.play().catch((err) => { // still blocked: offer a play button
      if ((err as Error).name === "AbortError") return; // we paused it ourselves (mic pressed), not a block
      dlog(`reply audio blocked by the browser: ${(err as Error).name}`);
      setSpeaking(false);
      setReplay({ src, listenAfter });
    });
  }

  function listenSoon() {
    listenTimer.current = window.setTimeout(() => step("key"), LISTEN_DELAY_MS);
  }

  function stopAudio() {
    audio.current?.pause();
    setSpeaking(false);
  }

  function setMicState(s: MicState) {
    micRef.current = s;
    setMic(s);
  }

  function finish() {
    setMicState(nextMicState(micRef.current, "done", 0).state);
  }

  function step(e: MicEvent) {
    const l = langRef.current;
    if (!l) return;
    const { state, action } = nextMicState(micRef.current, e, performance.now() - downAt.current);
    setMicState(state);
    if (action === "start") {
      clearTimeout(listenTimer.current); // a tap during the wait replaces the automatic start
      stopAudio();
      setError(null);
      setTapMode(e !== "down"); // hands-free and Space starts end on silence or a tap, not on release
      if (DEBUG) {
        const s = listen.current;
        Object.assign(s, { n: s.n + 1, t0: performance.now(), peak: 0, longestPause: 0, lastQuiet: 0, last: null });
        dlog(`listen ${s.n} start (${e === "key" ? "auto or keyboard" : "button"})`);
      }
      endReason.current = "";
      // Speech then silence sends the turn like a release would; hearing nothing just stops listening.
      recording.current = startRecording((why) => {
        endReason.current = why === "speech-ended" ? "2 s silence" : "no speech for 8 s";
        step(why === "speech-ended" ? "timeout" : "cancel");
      }, DEBUG ? onMicDebug : undefined);
      recording.current.catch((err) => {
        dlog(`mic failed to open: ${(err as Error).name}`);
        clearTimeout(timer.current);
        recording.current = null;
        setMicState("idle");
        setError(UI.micDenied[l]);
        setTyping(true);
      });
      timer.current = window.setTimeout(() => { endReason.current = "25 s cap"; step("timeout"); }, MAX_RECORD_MS);
    } else if (action === "cancel") {
      if (DEBUG) logListenEnd();
      clearTimeout(timer.current);
      recording.current?.then((r) => r.stop()).catch(() => {});
      recording.current = null;
    } else if (e === "up" && state === "recording") {
      setTapMode(true); // a quick tap: keep listening until the next tap
    } else if (action === "stop") {
      if (DEBUG) logListenEnd();
      clearTimeout(timer.current);
      const rec = recording.current;
      recording.current = null;
      if (!rec) return finish();
      const id = conv.current;
      rec.then((r) => r.stop()).then((blob) => (blob.size ? send({ blob }, id) : finish()), finish);
    }
  }

  async function send(input: { blob: Blob } | { text: string }, id: number) {
    const l = langRef.current!;
    try {
      const base = { lang: l, state: turnRef.current };
      // A press right after the mic opens leaves a clip too short to decode: treat it as nothing heard.
      const wav = "blob" in input ? await toWav16k(input.blob).catch(() => null) : null;
      if ("blob" in input && !wav) {
        dlog("recording too short to decode, listening again");
        if (id === conv.current) listenSoon();
        return;
      }
      const res = await sendTurn(wav ? { ...base, audio: await blobToBase64(wav), mime: wav.type } : { ...base, text: (input as { text: string }).text });
      if (id !== conv.current) return;
      turnRef.current = res.state;
      setTurn(res.state);
      setHeard(res.heard);
      dlog(`heard: "${res.heard}"`);
      setSaid(res.reply);
      setPhase(res.phase);
      setSchemes(res.schemes);
      // Keep listening after spoken turns; someone typing may not be able to speak.
      const listenAfter = res.phase === "asking" && "blob" in input;
      if (res.audio) play(`data:audio/mpeg;base64,${res.audio}`, listenAfter);
      else {
        // TTS failed (e.g. Gnani rate limit): the reply is on screen, so keep the conversation going anyway.
        dlog("reply came back without audio");
        if (listenAfter) listenSoon();
      }
    } catch (err) {
      dlog(`turn failed: ${(err as Error).message}`);
      if (id === conv.current) setError(ERRORS[(err as Error).message as ApiError]?.[l] ?? ERRORS.upstream[l]);
    } finally {
      if (id === conv.current) finish();
    }
  }

  function submitText(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("text") as HTMLInputElement;
    const text = input.value.trim();
    if (!text || micRef.current !== "idle") return;
    input.value = "";
    stopAudio();
    setError(null);
    setMicState("busy");
    send({ text }, conv.current);
  }

  function chooseLang(l: Lang) {
    conv.current++;
    langRef.current = l;
    document.documentElement.lang = l;
    turnRef.current = EMPTY;
    setTurn(EMPTY);
    setLang(l);
    setSaid(GREETING[l]);
    setHeard("");
    setPhase("asking");
    setSchemes([]);
    setError(null);
    play(speakUrl(l), true);
  }

  function startOver() {
    conv.current++;
    langRef.current = null;
    stopAudio();
    clearTimeout(timer.current);
    clearTimeout(listenTimer.current);
    recording.current?.then((r) => r.stop()).catch(() => {});
    recording.current = null;
    setMicState("idle");
    setLang(null);
    setTyping(false);
    setReplay(null);
  }

  // Space toggles the mic (keyboard users), except while typing in a field or focused on another control.
  useEffect(() => {
    if (!lang || phase === "results") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat) return;
      if ((e.target as HTMLElement).closest("input, textarea, a, button:not(.mic)")) return;
      e.preventDefault();
      endReason.current = "keyboard";
      step("key");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  // The payoff should be the first thing on screen, not below an 11-line form.
  useEffect(() => { if (phase === "results") window.scrollTo({ top: 0 }); }, [phase]);

  const status = !lang ? "" : mic === "recording" ? (tapMode ? UI.tapToStop[lang] : UI.listening[lang])
    : mic === "busy" ? UI.thinking[lang] : speaking ? UI.speaking[lang] : UI.holdToSpeak[lang];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {!lang ? (
        <main className="flex flex-1 flex-col justify-center gap-10 py-8">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-print uppercase">Sarkari Saathi</p>
            <h1 className="font-display text-6xl leading-[1.15]">सरकारी साथी</h1>
            <ul className="mt-5 space-y-1 font-hand text-xl leading-snug">
              {LANGS.map(({ lang: l }) => <li key={l} lang={l}>{UI.tagline[l]}</li>)}
            </ul>
          </div>
          <div className="space-y-3">
            {LANGS.map(({ lang: l, name }) => (
              <button key={l} lang={l} onClick={() => chooseLang(l)}
                className="flex min-h-16 w-full items-center justify-between rounded-2xl border-2 border-ink bg-sheet px-5 py-3 text-left transition-colors hover:bg-ink hover:text-sheet active:bg-ink active:text-sheet">
                <span className="font-display text-3xl">{name}</span>
                <span className="text-base">{UI.langButton[l]} →</span>
              </button>
            ))}
          </div>
        </main>
      ) : (
        <>
          <header className="flex items-center justify-between py-2">
            <span className="font-display text-xl">सरकारी साथी</span>
            <button onClick={startOver} className="min-h-12 rounded-full px-4 text-base font-semibold text-print hover:text-ink">
              ↺ {UI.startOver[lang]}
            </button>
          </header>

          <main className="flex flex-1 flex-col gap-5 pb-4">
            {phase === "asking" ? (
              <>
                <FormCard profile={turn.profile} asking={turn.asked.at(-1)} lang={lang} />
                <p aria-live="polite" className={`font-display text-2xl leading-snug transition-opacity ${mic === "busy" ? "opacity-50" : ""}`}>{said}</p>
              </>
            ) : (
              <>
                <Results schemes={schemes} lang={lang} onListen={(id) => play(speakUrl(lang, id))} />
                <FormCard profile={turn.profile} lang={lang} />
              </>
            )}

            {heard && phase === "asking" && (
              <p className="text-base text-print"><span className="font-semibold">{UI.youSaid[lang]}:</span> “{heard}”</p>
            )}
          </main>

          {phase === "asking" ? (
            <section className="sticky bottom-0 -mx-4 flex flex-col items-center gap-3 bg-paper/95 px-4 pt-3 pb-4 backdrop-blur">
              {error && <p role="alert" className="w-full rounded-lg border border-alert/30 bg-sheet px-3 py-2 text-base text-alert">{error}</p>}
              {replay && (
                <button onClick={() => play(replay.src, replay.listenAfter)} className="min-h-12 rounded-full border-2 border-ink px-5 font-semibold">▶ {UI.listen[lang]}</button>
              )}
              <button
                className={`mic grid size-28 place-items-center rounded-full text-sheet shadow-lg transition-colors ${mic === "recording" ? "listening bg-stamp" : mic === "busy" ? "cursor-wait bg-ink/60" : "bg-ink"}`}
                aria-label={`${UI.micLabel[lang]}: ${status}`}
                aria-pressed={mic === "recording"}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  downAt.current = performance.now();
                  endReason.current = "mic button pressed";
                  step("down");
                }}
                onPointerUp={() => { endReason.current = `mic button released (held ${Math.round(performance.now() - downAt.current)} ms)`; step("up"); }}
                onPointerCancel={() => { endReason.current = "touch cancelled by the browser"; step("up"); }}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); endReason.current = "keyboard"; step("key"); } }}
              >
                {mic === "busy" ? <Dots /> : <MicIcon />}
              </button>
              <p className="min-h-6 text-center text-base font-semibold" aria-hidden>{status}</p>
              {typing ? (
                <form onSubmit={submitText} className="flex w-full gap-2">
                  <input name="text" maxLength={500} autoComplete="off" placeholder={UI.typePlaceholder[lang]} aria-label={UI.typeInstead[lang]}
                    className="min-h-12 flex-1 rounded-xl border-2 border-rule bg-sheet px-3 text-lg focus:border-ink focus:outline-none" />
                  <button disabled={mic !== "idle"} className="min-h-12 rounded-xl bg-ink px-4 font-semibold text-sheet disabled:opacity-50">{UI.send[lang]}</button>
                </form>
              ) : (
                <button onClick={() => setTyping(true)} className="min-h-12 px-3 text-base text-print underline underline-offset-4">⌨ {UI.typeInstead[lang]}</button>
              )}
            </section>
          ) : (
            <div className="pb-4">
              <button onClick={startOver} className="min-h-14 w-full rounded-2xl bg-ink text-lg font-semibold text-sheet">↺ {UI.startOver[lang]}</button>
            </div>
          )}
        </>
      )}
      {DEBUG && lang && (
        <section aria-label="Mic debug" className="mb-2 rounded-lg border border-rule bg-sheet p-2 font-mono text-xs text-print">
          {/* bar: live loudness; red line: the "speaking" threshold */}
          <div className="relative h-3 rounded bg-rule/50">
            <div className="h-3 rounded bg-ink" style={{ width: `${Math.min(100, ((meter?.level ?? 0) / 0.3) * 100)}%` }} />
            <div className="absolute top-0 h-3 w-0.5 bg-alert" style={{ left: `${Math.min(100, ((meter?.threshold ?? 0) / 0.3) * 100)}%` }} />
          </div>
          <p className="mt-1">
            level {meter?.level.toFixed(3) ?? "-"} · thr {meter?.threshold.toFixed(3) ?? "-"} · noise {meter?.noise.toFixed(3) ?? "-"} · quiet {meter?.quietMs ?? "-"} ms
          </p>
          <p>
            echoCancel {String(meter?.settings.echoCancellation)} · noiseSupp {String(meter?.settings.noiseSuppression)} · autoGain {String(meter?.settings.autoGainControl)}
          </p>
          <button onClick={() => navigator.clipboard?.writeText(debugLog.join("\n"))} className="my-1 min-h-10 rounded border border-ink px-3">Copy log</button>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap">{debugLog.join("\n")}</pre>
        </section>
      )}
      <footer className="border-t border-rule py-3 text-center text-sm text-print">{UI.footer[lang ?? "hi"]}</footer>
    </div>
  );
}

/** The signature: a government form that fills itself in, in ballpoint ink, as the person talks. */
function FormCard({ profile, asking, lang }: { profile: Profile; asking?: Field; lang: Lang }) {
  const filled = FIELDS.filter((f) => profile[f] !== undefined);
  const blank = asking && profile[asking] === undefined ? asking : undefined;
  return (
    <section aria-label={UI.formTitle[lang]} className="rounded-xl border border-rule bg-sheet px-4 pt-3 pb-2 shadow-[0_1px_0_var(--color-rule),0_8px_24px_-16px_rgb(27_42_107/0.35)]">
      {/* letter-spacing would break the Devanagari headline (shirorekha), so it's English-only */}
      <h2 className={`border-b-2 border-ink pb-1 text-sm font-bold text-print ${lang === "en" ? "tracking-[0.12em] uppercase" : ""}`}>{UI.formTitle[lang]}</h2>
      {filled.length === 0 && !blank ? (
        <p className="py-3 font-hand text-lg text-print">{UI.tagline[lang]}</p>
      ) : (
        <dl>
          {filled.map((f) => (
            <div key={f} className="flex items-baseline gap-2 border-b border-rule py-1.5 last:border-0">
              <dt className="shrink-0 text-base text-print">{FIELD_LABEL[f][lang]}</dt>
              <span aria-hidden className="flex-1 border-b border-dotted border-print/40" />
              <dd className="ink-in font-hand text-xl font-bold">{formatValue(f, profile[f]!, lang)}</dd>
            </div>
          ))}
          {blank && (
            <div className="flex items-baseline gap-2 py-1.5">
              <dt className="shrink-0 text-base font-semibold text-stamp">{FIELD_LABEL[blank][lang]}</dt>
              <span aria-hidden className="flex-1 border-b-2 border-dashed border-stamp/50" />
              <dd className="font-hand text-xl text-stamp">?</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function Results({ schemes, lang, onListen }: { schemes: SchemeCard[]; lang: Lang; onListen: (id: string) => void }) {
  return (
    <section aria-live="polite">
      <h2 className="font-display text-3xl leading-tight">{resultsHeadline(schemes.length, lang)}</h2>
      <ul className="mt-4 space-y-3">
        {schemes.map((s, i) => (
          <li key={s.id} className="relative rounded-xl border border-rule bg-sheet p-4">
            <span style={{ animationDelay: `${200 + i * 140}ms` }}
              className={`stamp absolute top-3 right-3 rounded-md border-2 border-stamp px-2 py-0.5 text-sm font-bold text-stamp uppercase ${s.status === "likely" ? "border-dashed" : ""}`}>
              {s.status === "eligible" ? UI.eligible[lang] : UI.likely[lang]}
            </span>
            <h3 className="pr-24 font-display text-xl leading-snug">{s.name}</h3>
            <p className="mt-1 text-lg leading-snug">{s.benefit}</p>
            <p className="mt-2 text-base text-print"><span className="font-semibold">{UI.documents[lang]}:</span> {s.documents.join(" · ")}</p>
            {s.note && <p className="mt-2 text-base text-stamp">{s.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onListen(s.id)} className="min-h-12 rounded-full border-2 border-ink px-4 font-semibold">🔊 {UI.listen[lang]}</button>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-full px-3 font-semibold underline underline-offset-4">
                {UI.officialSite[lang]} ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function Dots() {
  return <span aria-hidden className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="dot size-2.5 rounded-full bg-sheet" />)}</span>;
}
