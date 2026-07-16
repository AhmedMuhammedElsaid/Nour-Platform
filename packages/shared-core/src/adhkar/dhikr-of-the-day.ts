import type { Azkar, DhikrItem } from "../schemas/azkar";

export type DhikrOfTheDay = {
  setId: string;
  itemIndex: number;
  item: DhikrItem;
};

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((current - start) / 86_400_000);
}

// Flattens items from every set passed in (existing set/item order, all
// published sets, no exclusion filter — unlike buildAdhkarPreview's
// excludeWake, this feature has no equivalent owner ask) into one pool, then
// picks a deterministic index by day-of-year so every visitor sees the same
// dhikr all day and it rotates at local midnight. No DB flag needed.
//
// Callers MUST pass a client-local `date` (or nothing, which defaults to
// `new Date()` at call time) and MUST call this client-side, never from a
// server component — "today" has to resolve in the visitor's own timezone,
// the same way adhkar-progress.ts's local today() already does. Computing it
// server-side would use the server's TZ and could disagree with the client's
// own progress-reset boundary.
export function pickDhikrOfTheDay(sets: Azkar[], date: Date = new Date()): DhikrOfTheDay | null {
  const pool: DhikrOfTheDay[] = sets.flatMap((set) =>
    set.items.map((item, itemIndex) => ({ setId: set.id, itemIndex, item })),
  );
  if (pool.length === 0) return null;
  const index = dayOfYear(date) % pool.length;
  return pool[index] ?? null;
}
