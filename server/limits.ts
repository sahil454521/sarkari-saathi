/** Fixed-window counter per key: returns false once `max` calls happened inside the current window. */
export function createLimiter(max: number, windowMs: number): (key: string, now?: number) => boolean {
  // shortcut: map grows with unique IPs until restart; add a sweep if traffic grows
  const windows = new Map<string, { start: number; count: number }>();
  return (key, now = Date.now()) => {
    const w = windows.get(key);
    if (!w || now - w.start > windowMs) {
      windows.set(key, { start: now, count: 1 });
      return true;
    }
    return ++w.count <= max;
  };
}
