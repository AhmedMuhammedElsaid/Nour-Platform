import { describe, expect, it } from "vitest";

import {
  ADHAN_PRAYER_KEYS,
  DEFAULT_ADHAN_SETTINGS,
  adhanSettingsSchema,
} from "./prayer-times";

describe("adhanSettingsSchema", () => {
  it("defaults to opt-in (enabled), all prayers on, volume 0.8", () => {
    const parsed = adhanSettingsSchema.parse({});
    expect(parsed).toEqual(DEFAULT_ADHAN_SETTINGS);
    expect(parsed.enabled).toBe(true);
    expect(parsed.volume).toBe(0.8);
    for (const key of ADHAN_PRAYER_KEYS) {
      expect(parsed.perPrayer[key]).toBe(true);
    }
  });

  it("clamps volume into the 0..1 range via schema rejection", () => {
    expect(adhanSettingsSchema.safeParse({ volume: 2 }).success).toBe(false);
    expect(adhanSettingsSchema.safeParse({ volume: -0.1 }).success).toBe(false);
    expect(adhanSettingsSchema.safeParse({ volume: 0.5 }).success).toBe(true);
  });

  it("rejects an unknown prayer key shape but accepts partial perPrayer", () => {
    const parsed = adhanSettingsSchema.parse({ perPrayer: { fajr: false } });
    expect(parsed.perPrayer.fajr).toBe(false);
    expect(parsed.perPrayer.dhuhr).toBe(true);
  });
});
