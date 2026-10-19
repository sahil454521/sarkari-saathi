import type { Lang } from "../server/profile.ts";
import type { TurnRequest, TurnResponse } from "../server/turn.ts";

export type ApiError = "limit" | "too_large" | "upstream" | "bad_request" | "network";
const KNOWN: ApiError[] = ["limit", "too_large", "upstream", "bad_request"];

/** 60 s timeout: a sleeping Render free instance can take ~50 s to wake. */
export async function sendTurn(req: TurnRequest): Promise<TurnResponse> {
  let res: Response;
  try {
    res = await fetch("/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("network");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(KNOWN.includes(body.error) ? body.error : "upstream");
  }
  return res.json();
}

export const speakUrl = (lang: Lang, schemeId?: string) =>
  `/api/speak?lang=${lang}&${schemeId ? `scheme=${encodeURIComponent(schemeId)}` : "greeting=1"}`;

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
