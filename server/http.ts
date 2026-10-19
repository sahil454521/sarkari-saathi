const retryable = (status: number) => status === 429 || status >= 500;

/** fetch with a timeout and exactly one retry (after 500 ms) on 429, 5xx, network error or timeout. */
export async function fetchRetry(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!retryable(res.status) || attempt === 1) return res;
    } catch (err) {
      if (attempt === 1) throw err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
