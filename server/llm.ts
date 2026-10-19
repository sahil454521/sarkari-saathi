import { fetchRetry } from "./http.ts";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * One chat completion against any OpenAI-compatible endpoint (Gemini, or Evon via llama.cpp).
 * Returns the raw message text; the caller parses and validates it.
 */
export async function chat(messages: ChatMessage[], schema: object): Promise<string> {
  const res = await fetchRetry(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name: "turn", strict: true, schema } },
    }),
  }, 15_000);
  if (!res.ok) throw new Error(`llm ${res.status}`);
  const body = await res.json();
  return String(body.choices?.[0]?.message?.content ?? "");
}
