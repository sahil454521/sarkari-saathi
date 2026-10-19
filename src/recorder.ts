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
 * Background noise is the quietest level heard so far (the gaps between words), not the first moments:
 * hands-free listening opens just as people start answering, and treating that speech as "noise" set the
 * bar so high on phones that sentences were cut off or missed. Speech is re-judged against the current
 * floor each time, so words spoken before the floor was known still count.
 * silenceMs is 2 s because 1.2 s cut people off while they paused to think mid-answer; a tap still sends at once.
 */
export function createEndpointer(silenceMs = 2000, noSpeechMs = 8000) {
  let start: number | null = null, floor = Infinity;
  const heard: [number, number][] = []; // [time, level]; at most 250 in a 25 s recording
  const threshold = () => Math.max(0.02, floor * 3);
  const lastLoud = () => {
    for (let i = heard.length - 1; i >= 0; i--) if (heard[i][1] > threshold()) return heard[i][0];
    return null;
  };
  const endpoint = (level: number, now: number): Endpoint => {
    start ??= now;
    heard.push([now, level]);
    if (now - start >= 200) floor = Math.min(floor, level); // the first 200 ms can be mic start-up zeros
    const loud = lastLoud();
    if (loud !== null) return now - loud >= silenceMs ? "speech-ended" : "listening";
    return now - start >= noSpeechMs ? "no-speech" : "listening";
  };
  // For the ?debug=1 meter.
  const inspect = (now: number) => {
    const loud = lastLoud();
    return { noise: floor === Infinity ? 0 : floor, threshold: threshold(), quietMs: loud === null ? null : now - loud };
  };
  return Object.assign(endpoint, { inspect });
}

export type MicDebug = { level: number; noise: number; threshold: number; quietMs: number | null; settings: MediaTrackSettings };

/** Records with the browser's default format; onEndpoint fires once when the speaker stops (or never starts). */
export async function startRecording(
  onEndpoint?: (why: Exclude<Endpoint, "listening">) => void,
  onDebug?: (d: MicDebug) => void,
): Promise<{ stop(): Promise<Blob> }> {
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
    const settings = stream.getAudioTracks()[0]?.getSettings() ?? {};
    tick = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const level = Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length), now = performance.now();
      const r = endpoint(level, now);
      onDebug?.({ level, ...endpoint.inspect(now), settings });
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
