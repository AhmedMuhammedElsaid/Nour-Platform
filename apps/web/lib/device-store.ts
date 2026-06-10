import type { ZodType } from "zod";

/*
 * The one way to read/write device-local state (nour.* localStorage keys).
 * Zod-validates on read: corrupt JSON, old shapes, and storage failures all
 * degrade to the caller's fallback — a shape change can never crash a
 * returning visitor. SSR-safe: returns the fallback when window is absent.
 */
export function readDeviceStore<T>(
  key: string,
  schema: ZodType<T>,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeDeviceStore<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode/quota) — state stays in-memory */
  }
}
