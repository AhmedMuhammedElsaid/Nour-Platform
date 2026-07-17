import { describe, expect, it } from "vitest";

import {
  aladhanStorageKey,
  deserializeMonth,
  localKey,
  parseTiming,
  serializeMonth,
} from "./aladhan";
import type { PrayerDay } from "./compute";

describe("parseTiming", () => {
  it("parses an iso8601 timing as an absolute instant (city offset, not device)", () => {
    // 05:39 at UTC+3 = 02:39 UTC, regardless of the machine running this test.
    const d = parseTiming("2026-10-29T05:39:00+03:00", 2026, 10, 29);
    expect(d?.getTime()).toBe(Date.UTC(2026, 9, 29, 2, 39, 0));
  });

  it("carries Aladhan's per-date DST offset across the Egypt fall-back (Oct 2026)", () => {
    // Live API fixture: Fajr 2026-10-29 is +03:00 (summer), 2026-10-30 is
    // +02:00 (winter). The absolute instants must reflect each day's OWN offset.
    const before = parseTiming("2026-10-29T05:39:00+03:00", 2026, 10, 29);
    const after = parseTiming("2026-10-30T04:40:00+02:00", 2026, 10, 30);
    expect(before?.getTime()).toBe(Date.UTC(2026, 9, 29, 2, 39, 0));
    expect(after?.getTime()).toBe(Date.UTC(2026, 9, 30, 2, 40, 0));
  });

  it("falls back to device-local parsing for the legacy HH:MM form", () => {
    const d = parseTiming("05:30 (EET)", 2026, 7, 17);
    expect(d?.getTime()).toBe(new Date(2026, 6, 17, 5, 30, 0, 0).getTime());
  });

  it("returns null for malformed timings instead of an Invalid Date", () => {
    expect(parseTiming("garbage", 2026, 7, 17)).toBeNull();
    expect(parseTiming("2026-13-99Tnot-a-time", 2026, 7, 17)).toBeNull();
  });
});

describe("aladhanStorageKey", () => {
  it("is versioned v2 and scoped by location, method, madhab, and month", () => {
    const key = aladhanStorageKey(30.0444, 31.2357, "Egyptian", "standard", 2026, 10);
    expect(key).toBe("nour.prayer.calendar.v2.30.04-31.24-Egyptian-standard-2026-10");
  });
});

describe("serializeMonth / deserializeMonth", () => {
  const day: PrayerDay = {
    date: new Date(2026, 9, 29),
    instants: [
      { key: "fajr", time: new Date(Date.UTC(2026, 9, 29, 2, 39, 0)) },
      { key: "sunrise", time: null },
    ],
  };

  it("round-trips instants as absolute epochs", () => {
    const out = deserializeMonth(serializeMonth({ [localKey(2026, 10, 29)]: day }));
    const fajr = out?.["2026-10-29"]?.instants.find((i) => i.key === "fajr");
    expect(fajr?.time?.getTime()).toBe(Date.UTC(2026, 9, 29, 2, 39, 0));
  });

  it("round-trips a null (malformed) instant as null, not epoch-0", () => {
    const out = deserializeMonth(serializeMonth({ [localKey(2026, 10, 29)]: day }));
    const sunrise = out?.["2026-10-29"]?.instants.find((i) => i.key === "sunrise");
    expect(sunrise?.time).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    expect(deserializeMonth("{not json")).toBeNull();
  });
});
