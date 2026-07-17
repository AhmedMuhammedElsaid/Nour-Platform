import { describe, expect, it } from "vitest";

import { islamicHeroTextsAr, islamicHeroTextsEn, pickHeroTextOfTheDay } from "./hero-text";

// Same day-of-year formula the implementation uses, duplicated here so tests
// can compute an independent expected index (mirrors dhikr-of-the-day.test.ts).
function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((current - start) / 86_400_000);
}

describe("pickHeroTextOfTheDay", () => {
  it("is deterministic for the same date and locale", () => {
    const date = new Date("2026-03-10T09:00:00");
    expect(pickHeroTextOfTheDay("ar", date)).toEqual(pickHeroTextOfTheDay("ar", date));
  });

  it("picks the ar pool entry at dayOfYear % pool.length", () => {
    const date = new Date("2026-03-10T09:00:00");
    const expectedIndex = dayOfYear(date) % islamicHeroTextsAr.length;
    expect(pickHeroTextOfTheDay("ar", date)).toBe(islamicHeroTextsAr[expectedIndex]);
  });

  it("picks the en pool entry at dayOfYear % pool.length", () => {
    const date = new Date("2026-03-10T09:00:00");
    const expectedIndex = dayOfYear(date) % islamicHeroTextsEn.length;
    expect(pickHeroTextOfTheDay("en", date)).toBe(islamicHeroTextsEn[expectedIndex]);
  });

  it("rotates to a different line on a different day", () => {
    const day1 = pickHeroTextOfTheDay("ar", new Date("2026-01-01"));
    const day2 = pickHeroTextOfTheDay("ar", new Date("2026-01-02"));
    expect(day1).not.toBe(day2);
  });

  it("picks independently per locale (not the same index requirement)", () => {
    const date = new Date("2026-05-05");
    expect(islamicHeroTextsAr).toContain(pickHeroTextOfTheDay("ar", date));
    expect(islamicHeroTextsEn).toContain(pickHeroTextOfTheDay("en", date));
  });
});
