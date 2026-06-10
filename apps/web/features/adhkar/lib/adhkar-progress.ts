// Device-local adhkar progress (APP_CONTEXT: device-local, no auth). Resets
// each calendar day so morning/evening adhkar behave like a daily checklist.

import { z } from "zod";

import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

const STORAGE_KEY = "nour.adhkar.progress";

const azkarProgressSchema = z.object({
  date: z.string(), // YYYY-MM-DD (local)
  sets: z.record(z.string(), z.record(z.string(), z.number())), // setId -> itemIndex -> count
});
export type AzkarProgress = z.infer<typeof azkarProgressSchema>;

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function empty(): AzkarProgress {
  return { date: today(), sets: {} };
}

export function readAzkarProgress(): AzkarProgress {
  return readDeviceStore(STORAGE_KEY, azkarProgressSchema, empty());
}

function write(p: AzkarProgress): void {
  writeDeviceStore(STORAGE_KEY, p);
}

// Clears all progress if the stored date is not today. Call on mount.
export function resetIfNewDay(): AzkarProgress {
  const current = readAzkarProgress();
  if (current.date === today()) return current;
  const fresh = empty();
  write(fresh);
  return fresh;
}

// Sets the absolute count for one dhikr (clamped at >= 0). Returns new state.
export function recordDhikrCount(
  setId: string,
  itemIndex: number,
  count: number,
): AzkarProgress {
  const p = readAzkarProgress();
  const set = p.sets[setId] ?? {};
  set[String(itemIndex)] = Math.max(0, count);
  p.sets[setId] = set;
  write(p);
  return p;
}

// Clears all recorded counts for one set so the user can start it over.
// Other sets and the stored date are left untouched. Returns new state.
export function resetSet(setId: string): AzkarProgress {
  const p = readAzkarProgress();
  delete p.sets[setId];
  write(p);
  return p;
}

export function getDhikrCount(setId: string, itemIndex: number): number {
  return readAzkarProgress().sets[setId]?.[String(itemIndex)] ?? 0;
}

// True when every item's recorded count >= its required repeat.
export function isSetComplete(setId: string, repeats: number[]): boolean {
  const set = readAzkarProgress().sets[setId] ?? {};
  return repeats.every((r, i) => (set[String(i)] ?? 0) >= r);
}

// Count of items fully completed — drives the landing progress bar.
export function completedCount(setId: string, repeats: number[]): number {
  const set = readAzkarProgress().sets[setId] ?? {};
  return repeats.reduce((n, r, i) => n + ((set[String(i)] ?? 0) >= r ? 1 : 0), 0);
}
