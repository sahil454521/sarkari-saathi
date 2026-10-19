export type MicState = "idle" | "recording" | "busy";
export type MicEvent = "down" | "up" | "key" | "timeout" | "cancel" | "done";
type Step = { state: MicState; action: "start" | "stop" | "cancel" | null };

const HOLD_MS = 300; // shorter than this is a tap (tap to start, tap again to stop); longer is push-to-talk

/** One mic button supporting hold-to-talk, tap-tap and Space; ignores everything while a turn is busy. */
export function nextMicState(s: MicState, e: MicEvent, heldMs: number): Step {
  if (s === "idle" && (e === "down" || e === "key")) return { state: "recording", action: "start" };
  if (s === "recording" && e === "up") return heldMs >= HOLD_MS ? { state: "busy", action: "stop" } : { state: s, action: null };
  if (s === "recording" && (e === "down" || e === "key" || e === "timeout")) return { state: "busy", action: "stop" };
  if (s === "recording" && e === "cancel") return { state: "idle", action: "cancel" };
  if (s === "busy" && e === "done") return { state: "idle", action: null };
  return { state: s, action: null };
}

export type Endpoint = "listening" | "speech-ended" | "no-speech";

/**
 * Decides when the speaker has finished, from mic loudness samples (RMS, 0–1) taken about every 100 ms.
 * The first 300 ms measure the room's background noise, so a noisy home and a quiet room both work.
 */
export function createEndpointer(silenceMs = 1200, noSpeechMs = 8000): (level: number, now: number) => Endpoint {
  let start: number | null = null, noise = 0, samples = 0, lastLoud: number | null = null;
  return (level, now) => {
    start ??= now;
    if (now - start < 300) {
      noise = (noise * samples + level) / ++samples;
      return "listening";
    }
    if (level > Math.max(0.02, noise * 3)) lastLoud = now;
    if (lastLoud !== null) return now - lastLoud >= silenceMs ? "speech-ended" : "listening";
    return now - start >= noSpeechMs ? "no-speech" : "listening";
  };
}

/** Records with the browser's default format; onEndpoint fires once when the speaker stops (or never starts). */
export async function startRecording(onEndpoint?: (why: Exclude<Endpoint, "listening">) => void): Promise<{ stop(): Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const release = () => { clearInterval(tick); stream.getTracks().forEach((t) => t.stop()); ctx.close(); };
  let tick = 0;
  try {
    await ctx.resume(); // created after the language tap, but some phones still start it suspended
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const endpoint = createEndpointer();
    tick = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const r = endpoint(Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length), performance.now());
      if (r !== "listening") { clearInterval(tick); onEndpoint?.(r); }
    }, 100);

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.start();
    return {
      stop: () => new Promise((resolve) => {
        recorder.onstop = () => { release(); resolve(new Blob(chunks, { type: recorder.mimeType })); };
        recorder.stop();
      }),
    };
  } catch (err) {
    release(); // never leave the mic indicator on
    throw err;
  }
}
