import { test, expect, vi, afterEach } from "vitest";
import { fetchRetry } from "./http.ts";

afterEach(() => vi.unstubAllGlobals());

const res = (status: number) => new Response(null, { status });

test("retries once on 503 then returns the 200", async () => {
  const f = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
  vi.stubGlobal("fetch", f);
  const out = await fetchRetry("https://x.test", {}, 1000);
  expect(f).toHaveBeenCalledTimes(2);
  expect(out.status).toBe(200);
});

test("does not retry 400", async () => {
  const f = vi.fn().mockResolvedValue(res(400));
  vi.stubGlobal("fetch", f);
  const out = await fetchRetry("https://x.test", {}, 1000);
  expect(f).toHaveBeenCalledTimes(1);
  expect(out.status).toBe(400);
});

test("retries once on network error, then throws", async () => {
  const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", f);
  await expect(fetchRetry("https://x.test", {}, 1000)).rejects.toThrow("fetch failed");
  expect(f).toHaveBeenCalledTimes(2);
});

test("aborts after timeoutMs and retries", async () => {
  const hang = (_url: string, init: RequestInit) =>
    new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)));
  const f = vi.fn().mockImplementationOnce(hang).mockResolvedValueOnce(res(200));
  vi.stubGlobal("fetch", f);
  const out = await fetchRetry("https://x.test", {}, 50);
  expect(f).toHaveBeenCalledTimes(2);
  expect(out.status).toBe(200);
});
