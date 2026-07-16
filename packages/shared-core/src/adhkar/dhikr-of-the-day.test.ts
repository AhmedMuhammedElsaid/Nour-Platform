import { describe, expect, it } from "vitest";

import type { Azkar, DhikrItem } from "../schemas/azkar";
import { pickDhikrOfTheDay } from "./dhikr-of-the-day";

function item(ar: string, repeat = 1): DhikrItem {
  return { ar, repeat };
}

function set(id: string, items: DhikrItem[]): Azkar {
  return {
    id,
    kind: "other",
    status: "published",
    order: 0,
    ar: { title: id, slug: `${id}-ar` },
    en: { title: id, slug: `${id}-en` },
    items,
  } as Azkar;
}

// Same day-of-year formula the implementation uses (1-indexed: Jan 1 = 1),
// duplicated here so tests can compute an independent expected index.
function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((current - start) / 86_400_000);
}

describe("pickDhikrOfTheDay", () => {
  it("returns null for an empty sets array", () => {
    expect(pickDhikrOfTheDay([], new Date("2026-01-01"))).toBeNull();
  });

  it("returns null when every set has no items", () => {
    const sets = [set("a", []), set("b", [])];
    expect(pickDhikrOfTheDay(sets, new Date("2026-01-01"))).toBeNull();
  });

  it("is deterministic for the same date and input", () => {
    const sets = [set("a", [item("one"), item("two"), item("three")])];
    const date = new Date("2026-03-10T09:00:00");
    expect(pickDhikrOfTheDay(sets, date)).toEqual(pickDhikrOfTheDay(sets, date));
  });

  it("picks the pool entry at dayOfYear % pool.length", () => {
    const sets = [set("a", [item("one"), item("two"), item("three")])];
    const date = new Date("2026-03-10T09:00:00");
    const expectedIndex = dayOfYear(date) % 3;
    const result = pickDhikrOfTheDay(sets, date);
    expect(result?.itemIndex).toBe(expectedIndex);
    expect(result?.item.ar).toBe(["one", "two", "three"][expectedIndex]);
  });

  it("rotates to a different item on a different day when the pool has more than one entry", () => {
    const sets = [set("a", [item("one"), item("two")])];
    const day1 = pickDhikrOfTheDay(sets, new Date("2026-01-01"));
    const day2 = pickDhikrOfTheDay(sets, new Date("2026-01-02"));
    expect(day1?.item.ar).not.toBe(day2?.item.ar);
  });

  it("skips sets with no items and flattens only sets that have them", () => {
    const sets = [set("empty", []), set("real", [item("only-one")])];
    const result = pickDhikrOfTheDay(sets, new Date("2026-05-05"));
    expect(result).toEqual({ setId: "real", itemIndex: 0, item: item("only-one") });
  });

  it("keeps the source setId/itemIndex pair when picking from the middle of a set", () => {
    const sets = [set("a", [item("first"), item("second"), item("third")])];
    // Force index 1 by walking forward to a date whose dayOfYear % 3 === 1.
    let date = new Date("2026-01-01");
    while (dayOfYear(date) % 3 !== 1) date = new Date(date.getTime() + 86_400_000);
    const result = pickDhikrOfTheDay(sets, date);
    expect(result).toEqual({ setId: "a", itemIndex: 1, item: item("second") });
  });
});
