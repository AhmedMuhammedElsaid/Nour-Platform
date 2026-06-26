import { get, set, type AzkarProgress } from "./storage";

// Device-local adhkar progress, mirroring web/mobile. The reader holds the full
// AzkarProgress object in memory and writes it whole on each tap (no read-modify-
// write race). Resets when the stored date is not today.

export function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Loads progress, persisting a fresh reset if the stored day has rolled over.
export async function loadProgress(): Promise<AzkarProgress> {
  const stored = await get("nour.adhkar.progress");
  if (stored.date === today()) return stored;
  const fresh: AzkarProgress = { date: today(), sets: {} };
  await set("nour.adhkar.progress", fresh);
  return fresh;
}

export async function saveProgress(progress: AzkarProgress): Promise<void> {
  await set("nour.adhkar.progress", progress);
}

export function getCount(progress: AzkarProgress, setId: string, itemIndex: number): number {
  return progress.sets[setId]?.[String(itemIndex)] ?? 0;
}

// Number of items whose recorded count has reached its required repeat.
export function completedCount(
  progress: AzkarProgress,
  setId: string,
  repeats: number[],
): number {
  const set = progress.sets[setId] ?? {};
  return repeats.reduce((n, r, i) => n + ((set[String(i)] ?? 0) >= r ? 1 : 0), 0);
}
