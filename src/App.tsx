import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { FIELDS } from "../server/profile.ts";
import type { Field, Lang, Profile } from "../server/profile.ts";
import type { TurnState } from "../server/turn.ts";
import type { SchemeCard } from "../server/schemes.ts";
import { GREETING } from "../server/questions.ts";
import { nextMicState, startRecording } from "./recorder.ts";
import type { MicEvent, MicState } from "./recorder.ts";
import { blobToBase64, sendTurn, speakUrl } from "./api.ts";
import { toWav16k } from "./wav.ts";
import type { ApiError } from "./api.ts";
import { ERRORS, FIELD_LABEL, UI, formatValue, resultsHeadline } from "./i18n.ts";

const LANGS: { lang: Lang; name: string }[] = [
  { lang: "hi", name: "हिंदी" }, { lang: "mr", name: "मराठी" }, { lang: "en", name: "English" },
];
const EMPTY: TurnState = { profile: {}, history: [], asked: [] };
const MAX_RECORD_MS = 25_000;

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
  const [replay, setReplay] = useState<string | null>(null);

  // Refs, because recording and requests finish in callbacks created by earlier renders.
  const micRef = useRef<MicState>("idle");
  const turnRef = useRef<TurnState>(EMPTY);
  const downAt = useRef(0);
  const recording = useRef<ReturnType<typeof startRecording> | null>(null);
  const timer = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const conv = useRef(0); // bumped on start over / new language, so replies from an older conversation are dropped

  function play(src: string) {
    audio.current?.pause();
    const a = new Audio(src);
    audio.current = a;
    a.onended = () => setSpeaking(false);
    setReplay(null);
    setSpeaking(true);
    a.play().catch(() => { setSpeaking(false); setReplay(src); }); // autoplay blocked: offer a play button
  }

  function stopAudio() {
    audio.current?.pause();
    audio.current = null;
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
    if (!lang) return;
    const { state, action } = nextMicState(micRef.current, e, performance.now() - downAt.current);
    setMicState(state);
    if (action === "start") {
      stopAudio();
      setError(null);
      setTapMode(false);
      recording.current = startRecording();
      recording.current.catch(() => {
        clearTimeout(timer.current);
        recording.current = null;
        setMicState("idle");
        setError(UI.micDenied[lang]);
        setTyping(true);
      });
      timer.current = window.setTimeout(() => step("timeout"), MAX_RECORD_MS);
    } else if (e === "up" && state === "recording") {
      setTapMode(true); // a quick tap: keep listening until the next tap
    } else if (action === "stop") {
      clearTimeout(timer.current);
      const rec = recording.current;
      recording.current = null;
      if (!rec) return finish();
      const id = conv.current;
      rec.then((r) => r.stop()).then((blob) => (blob.size ? send({ blob }, id) : finish()), finish);
    }
  }

  async function send(input: { blob: Blob } | { text: string }, id: number) {
    const l = lang!;
    try {
      const base = { lang: l, state: turnRef.current };
      const res = await sendTurn("text" in input
        ? { ...base, text: input.text }
        : await toWav16k(input.blob).then(async (wav) => ({ ...base, audio: await blobToBase64(wav), mime: wav.type })));
      if (id !== conv.current) return;
      turnRef.current = res.state;
      setTurn(res.state);
      setHeard(res.heard);
      setSaid(res.reply);
      setPhase(res.phase);
      setSchemes(res.schemes);
      if (res.audio) play(`data:audio/mpeg;base64,${res.audio}`);
    } catch (err) {
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
    document.documentElement.lang = l;
    turnRef.current = EMPTY;
    setTurn(EMPTY);
    setLang(l);
    setSaid(GREETING[l]);
    setHeard("");
    setPhase("asking");
    setSchemes([]);
    setError(null);
    play(speakUrl(l));
  }

  function startOver() {
    conv.current++;
    stopAudio();
    clearTimeout(timer.current);
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
                <button onClick={() => play(replay)} className="min-h-12 rounded-full border-2 border-ink px-5 font-semibold">▶ {UI.listen[lang]}</button>
              )}
              <button
                className={`mic grid size-28 place-items-center rounded-full text-sheet shadow-lg transition-colors ${mic === "recording" ? "listening bg-stamp" : mic === "busy" ? "cursor-wait bg-ink/60" : "bg-ink"}`}
                aria-label={`${UI.micLabel[lang]}: ${status}`}
                aria-pressed={mic === "recording"}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); downAt.current = performance.now(); step("down"); }}
                onPointerUp={() => step("up")}
                onPointerCancel={() => step("up")}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); step("key"); } }}
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
