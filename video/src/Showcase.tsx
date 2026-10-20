import { AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as loadMukta } from "@remotion/google-fonts/Mukta";
import { loadFont as loadKalam } from "@remotion/google-fonts/Kalam";
import { loadFont as loadTiro } from "@remotion/google-fonts/TiroDevanagariHindi";
import { FIELDS } from "../../server/profile.ts";
import type { Field } from "../../server/profile.ts";
import { FIELD_LABEL, UI, formatValue, resultsHeadline } from "../../src/i18n.ts";
import { buildTimeline, turns } from "./timeline.ts";
import type { Durations, Timeline } from "./timeline.ts";

const MUKTA = loadMukta("normal", { weights: ["400", "600", "700"], subsets: ["devanagari", "latin"] }).fontFamily;
const KALAM = loadKalam("normal", { weights: ["400", "700"], subsets: ["devanagari", "latin"] }).fontFamily;
const TIRO = loadTiro("normal", { subsets: ["devanagari", "latin"] }).fontFamily;

// The app's own tokens (src/index.css).
const C = { paper: "#EEF3EA", sheet: "#FBFCF8", ink: "#1B2A6B", stamp: "#6B2FA0", print: "#4A5649", rule: "#C9D3C4" };
const SCALE = 880 / 375; // the app is laid out at phone width and scaled up crisply

export function Showcase({ durations }: { durations: Durations }) {
  const tl = buildTimeline(durations);
  const frame = useCurrentFrame();
  const inPhone = frame >= tl.hook.from && frame < tl.title.from || frame >= tl.convo.from && frame < tl.how.from;
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: MUKTA, color: C.ink }}>
      {inPhone && <PhoneScene tl={tl} />}
      {frame >= tl.title.from && frame < tl.title.to && <TitleScene from={tl.title.from} />}
      {frame >= tl.how.from && frame < tl.how.to && <HowScene tl={tl} />}
      {frame >= tl.end.from && <EndScene from={tl.end.from} />}
      {tl.audio.map((a, i) => (
        <Sequence key={i} from={a.from} durationInFrames={a.frames} layout="none">
          <Audio src={staticFile(`audio/${a.file}`)} />
        </Sequence>
      ))}
      <Captions tl={tl} />
    </AbsoluteFill>
  );
}

/* ---------- the phone: the real app UI, driven by the captured conversation ---------- */

function PhoneScene({ tl }: { tl: Timeline }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const showResults = frame >= tl.results.from;
  const filled = new Map(tl.fills.filter((x) => x.at <= frame).map((x) => [x.field, x.at]));
  const profile = turns[turns.length - 1].profile as Record<Field, unknown>;
  const q = [...tl.questions].reverse().find((x) => x.at <= frame);
  const question = q?.mr;
  const heard = [...tl.heard].reverse().find((h) => h.at <= frame);
  const speaking = tl.speaking.find((s) => frame >= s.from && frame < s.to);
  const thinking = tl.thinking.some((s) => frame >= s.from && frame < s.to);
  const appTalking = tl.appSpeaking.some((s) => frame >= s.from && frame < s.to);
  const askingField = !showResults && question ? turns.find((t) => t.question?.mr === question)?.question?.field : undefined;
  // Push in on the phone for the one-sentence, three-field moment.
  const zoom = interpolate(frame, [tl.wow.from - 6, tl.wow.from + 10, tl.wow.to - 8, tl.wow.to + 8], [1, 1.1, 1.1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  // The hook is on screen from frame 0 (it is the thumbnail); after the title the phone slides back in.
  const enter = frame < tl.title.from ? 1 : spring({ frame: frame - tl.convo.from, fps, config: { damping: 200 } });
  // The results page scrolls as a whole, header included.
  const scroll = interpolate(frame - tl.results.from, [120, 360], [0, -460], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 40 }}>
      <div style={{ width: 920, height: 1580, borderRadius: 90, background: "#111", padding: 20, boxShadow: "0 40px 80px -30px rgba(27,42,107,.5)",
        transform: `translateY(${(1 - enter) * 120}px) scale(${zoom})`, transformOrigin: "50% 35%", opacity: enter }}>
        <div style={{ width: 880, height: 1540, borderRadius: 72, overflow: "hidden", background: C.paper, position: "relative" }}>
          {/* During the conversation the page sticks to its bottom, like a chat, so the newest line never hides under the mic. */}
          <div style={{ width: 375, height: (showResults ? 1540 : 1090) / SCALE, transform: `scale(${SCALE})`, transformOrigin: "top left", padding: "14px 16px", boxSizing: "border-box",
            display: "flex", flexDirection: "column", justifyContent: showResults ? "flex-start" : "flex-end" }}>
           <div style={{ minHeight: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, transform: `translateY(${scroll}px)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: TIRO, fontSize: 20 }}>सरकारी साथी</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.print }}>↺ {UI.startOver.mr}</span>
            </div>
            {showResults ? <Results tl={tl} /> : (
              <>
                <FormCard filled={filled} profile={profile} asking={askingField && !filled.has(askingField) ? { field: askingField, at: q!.at } : undefined} />
                {question && <p style={{ fontFamily: TIRO, fontSize: 23, lineHeight: 1.35, margin: 0, opacity: thinking ? 0.5 : 1 }}>{question}</p>}
                {heard && <p style={{ fontSize: 15, color: C.print, margin: 0 }}><b>{UI.youSaid.mr}:</b> “{typeOn(heard.text, frame - heard.at)}”</p>}
              </>
            )}
           </div>
          </div>
          {!showResults && <Mic speaking={speaking} thinking={thinking} appTalking={appTalking} />}
        </div>
      </div>
      {frame < tl.title.from && <Banner text="She spoke. The form filled itself." from={tl.fills[0].at} />}
      {frame >= tl.convo.from && frame < tl.results.from && <Footnote text="Real app output · waits shortened · Sunita's voice: ElevenLabs (synthetic)" opacity={interpolate(zoom, [1, 1.03], [1, 0], { extrapolateRight: "clamp" })} />}
    </AbsoluteFill>
  );
}

const typeOn = (text: string, frames: number) => text.slice(0, Math.max(0, Math.floor(frames * 2.2)));

const ASKED = new Set(turns.flatMap((t) => (t.question ? [t.question.field] : [])));

function FormCard({ filled, profile, asking }: { filled: Map<Field, number>; profile: Record<Field, unknown>; asking?: { field: Field; at: number } }) {
  const frame = useCurrentFrame();
  const rows = FIELDS.filter((f) => filled.has(f));
  const grow = (at: number) => ({ boxSizing: "border-box" as const, overflow: "hidden", maxHeight: interpolate(frame - at, [0, 8], [0, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) });
  return (
    <div style={{ background: C.sheet, border: `1px solid ${C.rule}`, borderRadius: 12, padding: "10px 16px 6px", boxShadow: "0 8px 24px -16px rgba(27,42,107,.35)" }}>
      <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 4, fontSize: 14, fontWeight: 700, color: C.print }}>{UI.formTitle.mr}</div>
      {rows.length === 0 && !asking && <p style={{ fontFamily: KALAM, fontSize: 18, color: C.print, margin: "10px 0" }}>{UI.tagline.mr}</p>}
      {rows.map((f) => {
        const p = interpolate(frame - filled.get(f)!, [0, 16], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={f} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.rule}`, ...(ASKED.has(f) ? {} : grow(filled.get(f)!)) }}>
            <span style={{ fontSize: 16, color: C.print }}>{FIELD_LABEL[f].mr}</span>
            <span style={{ flex: 1, borderBottom: "1px dotted rgba(74,86,73,.4)" }} />
            <span style={{ fontFamily: KALAM, fontWeight: 700, fontSize: 20, clipPath: `inset(0 ${p}% 0 0)` }}>
              {/* Kalam's 9 reads as a 1 at feed size, so digits go in Mukta */}
              {formatValue(f, profile[f] as never, "mr").split(/(\d[\d,]*)/).map((part, i) => (i % 2 ? <span key={i} style={{ fontFamily: MUKTA }}>{part}</span> : part))}
            </span>
          </div>
        );
      })}
      {asking && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", ...grow(asking.at) }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.stamp }}>{FIELD_LABEL[asking.field].mr}</span>
          <span style={{ flex: 1, borderBottom: "2px dashed rgba(107,47,160,.5)" }} />
          <span style={{ fontFamily: KALAM, fontSize: 20, color: C.stamp }}>?</span>
        </div>
      )}
    </div>
  );
}

function Mic({ speaking, thinking, appTalking }: { speaking?: { from: number; file: string }; thinking: boolean; appTalking: boolean }) {
  const frame = useCurrentFrame();
  const label = speaking ? UI.tapToStop.mr : thinking ? UI.thinking.mr : appTalking ? UI.speaking.mr : UI.holdToSpeak.mr;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: 270, height: 270, display: "grid", placeItems: "center" }}>
        {speaking && <Waveform from={speaking.from} file={speaking.file} />}
        {speaking && [0, 1].map((i) => {
          const r = ((frame + i * 16) % 32) / 32;
          return <div key={i} style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", border: `6px solid ${C.stamp}`, transform: `scale(${1 + r * 0.6})`, opacity: 1 - r }} />;
        })}
        <div style={{ width: 260, height: 260, borderRadius: "50%", background: speaking ? C.stamp : C.ink, display: "grid", placeItems: "center", color: C.sheet, zIndex: 1 }}>
          {thinking ? <Dots /> : <Icon d={MIC} size={110} />}
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 2, background: C.paper, borderRadius: 999, padding: "0 24px", fontSize: 40, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/** Bars around the mic, driven by the real loudness of Sunita's clip. */
const MIC = "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3";
const SPEAKER = "M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14";
// Line icons: emoji like 🎙 render as flat black glyphs in the headless renderer.
function Icon({ d, size }: { d: string; size: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

function Waveform({ from, file }: { from: number; file: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(`audio/${file}`));
  if (!audioData) return null;
  const bars = visualizeAudio({ fps, frame: frame - from, audioData, numberOfSamples: 32 });
  return (
    <>{bars.map((v, i) => {
      const angle = (i / bars.length) * Math.PI * 2;
      const len = 16 + Math.min(1, v * 6) * 60;
      return <div key={i} style={{ position: "absolute", width: 10, height: len, borderRadius: 5, background: C.stamp, opacity: 0.85,
        transform: `rotate(${angle}rad) translateY(-${150 + len / 2}px)` }} />;
    })}</>
  );
}

function Dots() {
  const frame = useCurrentFrame();
  return <div style={{ display: "flex", gap: 22 }}>{[0, 1, 2].map((i) => (
    <div key={i} style={{ width: 30, height: 30, borderRadius: "50%", background: C.sheet, opacity: 0.25 + 0.75 * Math.abs(Math.sin((frame - i * 5) / 6)) }} />
  ))}</div>;
}

function Results({ tl }: { tl: Timeline }) {
  const frame = useCurrentFrame() - tl.results.from;
  const { fps } = useVideoConfig();
  const schemes = turns[turns.length - 1].schemes;
  const tapAt = tl.results.tap - tl.results.from;
  const tap = spring({ frame: frame - tapAt, fps, config: { damping: 12 } });
  return (
    <div>
      <h2 style={{ fontFamily: TIRO, fontSize: 28, lineHeight: 1.2, margin: "4px 0 12px", fontWeight: 400 }}>{resultsHeadline(schemes.length, "mr")}</h2>
      {schemes.map((s, i) => {
        const appear = spring({ frame: frame - 12 - i * 9, fps, config: { damping: 200 } });
        const stamp = spring({ frame: frame - 26 - i * 9, fps, config: { damping: 9, stiffness: 160 } });
        return (
          <div key={s.id} style={{ position: "relative", background: C.sheet, border: `1px solid ${C.rule}`, borderRadius: 12, padding: 14, marginBottom: 10,
            opacity: appear, transform: `translateY(${(1 - appear) * 40}px)` }}>
            <span style={{ position: "absolute", top: 10, right: 10, border: `2px ${s.status === "likely" ? "dashed" : "solid"} ${C.stamp}`, borderRadius: 6,
              padding: "1px 7px", fontSize: 13, fontWeight: 700, color: C.stamp, transform: `rotate(-8deg) scale(${interpolate(stamp, [0, 1], [1.8, 1])})`, opacity: Math.min(1, stamp * 2) }}>
              {s.status === "eligible" ? UI.eligible.mr : UI.likely.mr}
            </span>
            <div style={{ fontFamily: TIRO, fontSize: 18, paddingRight: 80, lineHeight: 1.3 }}>{s.name}</div>
            <div style={{ fontSize: 15, marginTop: 4, lineHeight: 1.35 }}>{s.benefit}</div>
            {s.id === "pm-kisan" && (
              <div style={{ marginTop: 8, display: "inline-block", border: `2px solid ${C.ink}`, borderRadius: 999, padding: "3px 12px", fontSize: 14, fontWeight: 600,
                background: frame >= tapAt ? C.ink : "transparent", color: frame >= tapAt ? C.sheet : C.ink, transform: `scale(${frame >= tapAt ? 1 + 0.15 * (1 - tap) : 1})` }}>
                🔊 {UI.listen.mr}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- full-screen scenes ---------- */

function TitleScene({ from }: { from: number }) {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  const pop = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 40, padding: 80, textAlign: "center" }}>
      <div style={{ fontSize: 40, letterSpacing: 10, fontWeight: 600, color: C.print, opacity: pop(0) }}>SARKARI SAATHI</div>
      <div style={{ fontFamily: TIRO, fontSize: 190, lineHeight: 1.1, transform: `scale(${pop(4)})` }}>सरकारी साथी</div>
      <div style={{ fontSize: 58, lineHeight: 1.3, maxWidth: 900, opacity: pop(14) }}>Find government schemes<br />just by talking</div>
      <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
        {["मराठी", "हिंदी", "English"].map((l, i) => (
          <div key={l} style={{ fontFamily: TIRO, fontSize: 56, border: `4px solid ${C.ink}`, borderRadius: 999, padding: "8px 40px", background: C.sheet, transform: `scale(${pop(22 + i * 5)})` }}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function HowScene({ tl }: { tl: Timeline }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { from: nFrom, frames: nFrames } = tl.how.narration;
  const at = (fraction: number) => nFrom + Math.round(nFrames * fraction);
  const steps = [
    { at: tl.how.from + 4, icon: <Icon d={MIC} size={70} />, title: "Sunita speaks", sub: "Marathi, Hindi or English", chip: "" },
    { at: at(0.02), icon: "◉", title: "Gnani Prisma", sub: "speech → text", chip: turns[0].heard },
    { at: at(0.2), icon: "{ }", title: "Small LLM", sub: "picks out the facts", chip: "age 45 · farmer · Maharashtra" },
    { at: at(0.44), icon: "§", title: "Plain rules", sub: "decide who qualifies", chip: "13 schemes · eligible / likely" },
    { at: at(0.8), icon: <Icon d={SPEAKER} size={70} />, title: "Gnani Timbre", sub: "text → voice", chip: "" },
  ];
  return (
    <AbsoluteFill style={{ padding: "110px 90px", gap: 0 }}>
      <div style={{ fontFamily: TIRO, fontSize: 76, marginBottom: 50 }}>How it works</div>
      {steps.map((s, i) => {
        const p = spring({ frame: frame - s.at, fps, config: { damping: 200 } });
        const line = interpolate(frame - s.at, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const gnani = s.title.startsWith("Gnani");
        return (
          <div key={s.title}>
            {i > 0 && <div style={{ marginLeft: 66, width: 6, height: 60 * line, background: C.rule }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: p, transform: `translateX(${(1 - p) * -60}px)` }}>
              <div style={{ width: 138, height: 138, flexShrink: 0, borderRadius: 34, display: "grid", placeItems: "center", fontSize: 58, fontWeight: 700,
                background: gnani ? C.stamp : C.sheet, color: gnani ? C.sheet : C.ink, border: `4px solid ${gnani ? C.stamp : C.ink}` }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>{s.title}</div>
                <div style={{ fontSize: 40, color: C.print }}>{s.sub}</div>
                {s.chip && <div style={{ marginTop: 10, display: "inline-block", fontFamily: KALAM, fontSize: 34, background: C.sheet, border: `2px solid ${C.rule}`, borderRadius: 14, padding: "4px 18px", maxWidth: 680 }}>{s.chip}</div>}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 64, fontFamily: TIRO, fontSize: 64, color: C.stamp, opacity: interpolate(frame, [at(0.5), at(0.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        The AI listens. The code decides.
      </div>
    </AbsoluteFill>
  );
}

function EndScene({ from }: { from: number }) {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  const pop = (d: number) => spring({ frame: frame - d, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ background: C.ink, color: C.sheet, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 34, padding: 70 }}>
      <div style={{ fontFamily: TIRO, fontSize: 170, transform: `scale(${pop(0)})` }}>सरकारी साथी</div>
      <div style={{ fontSize: 52, opacity: pop(8) }}>Try it: sarkari-saathi-kjgb.onrender.com</div>
      <div style={{ fontSize: 40, opacity: pop(12) }}>github.com/sahil454521/sarkari-saathi</div>
      <div style={{ marginTop: 30, fontSize: 56, fontWeight: 700, border: `4px solid ${C.sheet}`, borderRadius: 24, padding: "18px 40px", transform: `scale(${pop(18)})` }}>
        Built on Gnani Prisma + Timbre
      </div>
      <div style={{ fontSize: 40, opacity: pop(24) }}>#GnaniAI #GreatIndianAIInternshipChallenge</div>
      <div style={{ position: "absolute", bottom: 60, fontSize: 28, opacity: 0.75 }}>Sunita is an invented persona · her voice: ElevenLabs (synthetic) · narration and app voice: Gnani Timbre</div>
    </AbsoluteFill>
  );
}

/* ---------- overlays ---------- */

function Captions({ tl }: { tl: Timeline }) {
  const frame = useCurrentFrame();
  const c = tl.captions.find((x) => frame >= x.from && frame < x.to);
  if (!c || frame >= tl.end.from) return null;
  const who = c.who === "sunita" ? "Sunita" : c.who === "app" ? "Sarkari Saathi" : "";
  const fade = interpolate(frame, [c.from, c.from + 5, c.to - 5, c.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: c.who === "narrator" && frame >= tl.how.from ? 70 : 40, display: "flex", justifyContent: "center", opacity: fade }}>
      <div style={{ background: c.who === "sunita" ? C.stamp : C.ink, color: C.sheet, borderRadius: 26, padding: "16px 30px", fontSize: 40, lineHeight: 1.3, textAlign: "center", maxWidth: 960 }}>
        {who && <span style={{ fontWeight: 700, opacity: 0.85 }}>{who}: </span>}{c.text}
      </div>
    </div>
  );
}

function Banner({ text, from }: { text: string; from: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - from, fps, config: { damping: 14 } });
  return (
    <div style={{ position: "absolute", top: 1665, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${p})` }}>
      <div style={{ background: C.stamp, color: C.sheet, fontSize: 52, fontWeight: 700, padding: "18px 40px", borderRadius: 24, transform: "rotate(-2deg)" }}>{text}</div>
    </div>
  );
}

function Footnote({ text, opacity }: { text: string; opacity: number }) {
  return <div style={{ position: "absolute", top: 1622, left: 0, right: 0, textAlign: "center", fontSize: 24, color: C.print, opacity }}>{text}</div>;
}
