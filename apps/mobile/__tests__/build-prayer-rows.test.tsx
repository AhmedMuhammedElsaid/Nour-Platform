import { buildPrayerRows } from "@/features/prayer-times/widget/build-prayer-rows";
import { readLocation } from "@/features/prayer-times/lib/prayer-settings-store";
import { DEFAULT_LOCATION } from "@repo/shared-core/schemas/prayer-times";

const location = { lat: 30.0444, lng: 31.2357, label: "Cairo", cityId: "cairo" as const };
const prefs = { method: "Egyptian" as const, madhab: "standard" as const };

describe("buildPrayerRows", () => {
  it("mid-day: highlights the correct next prayer and formats today's times", () => {
    // 2026-06-26 10:00 local — before Dhuhr, after Fajr/Sunrise.
    const now = new Date(2026, 5, 26, 10, 0, 0);
    const result = buildPrayerRows(location, prefs, now, "en");

    expect(result.city).toBe("Cairo");
    expect(result.rows).toHaveLength(6);
    expect(result.rows.map((r) => r.key)).toEqual([
      "fajr",
      "sunrise",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
    ]);
    // Exactly one row is highlighted, and it's the next upcoming prayer (dhuhr).
    const highlighted = result.rows.filter((r) => r.isNext);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]!.key).toBe("dhuhr");
    // Every row has a non-placeholder formatted time (adhan-js resolves for Cairo).
    for (const row of result.rows) {
      expect(row.time).not.toBe("—");
    }
  });

  it("after Isha: rolls both the highlight AND the displayed time to tomorrow's Fajr", () => {
    // 2026-06-26 23:30 local — well after Cairo's Isha.
    const now = new Date(2026, 5, 26, 23, 30, 0);
    const result = buildPrayerRows(location, prefs, now, "en");
    // Independently computed via a same-day mid-morning call (well before
    // ITS OWN Isha, so this reflects the 27th's own Fajr, not a roll-over).
    const tomorrowOnly = buildPrayerRows(location, prefs, new Date(2026, 5, 27, 3, 0, 0), "en");

    const highlighted = result.rows.filter((r) => r.isNext);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]!.key).toBe("fajr");
    // The displayed Fajr time must match tomorrow's actual Fajr — not
    // today's already-elapsed instant re-displayed under the highlight.
    expect(highlighted[0]!.time).toBe(tomorrowOnly.rows.find((r) => r.key === "fajr")!.time);
  });

  it("locale ar vs en: labels switch, city label switches", () => {
    const now = new Date(2026, 5, 26, 10, 0, 0);

    const en = buildPrayerRows(location, prefs, now, "en");
    expect(en.city).toBe("Cairo");
    expect(en.rows.find((r) => r.key === "fajr")?.label).toBe("Fajr");
    expect(en.rows.find((r) => r.key === "maghrib")?.label).toBe("Maghrib");

    const ar = buildPrayerRows(location, prefs, now, "ar");
    expect(ar.city).toBe("القاهرة");
    expect(ar.rows.find((r) => r.key === "fajr")?.label).toBe("الفجر");
    expect(ar.rows.find((r) => r.key === "maghrib")?.label).toBe("المغرب");
  });

  it("storage-empty readLocation() falls back to Cairo DEFAULT_LOCATION", async () => {
    // AsyncStorage is the official jest mock (empty by default, no prior setItem).
    const loc = await readLocation();
    expect(loc).toEqual(DEFAULT_LOCATION);
  });
});
