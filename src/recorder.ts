export type MicState = "idle" | "recording" | "busy";
export type MicEvent = "down" | "up" | "key" | "timeout" | "done";
type Step = { state: MicState; action: "start" | "stop" | null };

const HOLD_MS = 300; // shorter than this is a tap (tap to start, tap again to stop); longer is push-to-talk

/** One mic button supporting hold-to-talk, tap-tap and Space; ignores everything while a turn is busy. */
export function nextMicState(s: MicState, e: MicEvent, heldMs: number): Step {
  if (s === "idle" && (e === "down" || e === "key")) return { state: "recording", action: "start" };
  if (s === "recording" && e === "up") return heldMs >= HOLD_MS ? { state: "busy", action: "stop" } : { state: s, action: null };
  if (s === "recording" && (e === "down" || e === "key" || e === "timeout")) return { state: "busy", action: "stop" };
  if (s === "busy" && e === "done") return { state: "idle", action: null };
  return { state: s, action: null };
}

/** Records with the browser's default format (Prisma accepts webm/ogg/m4a). */
export async function startRecording(): Promise<{ stop(): Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start();
  return {
    stop: () => new Promise((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorder.stop();
    }),
  };
}
