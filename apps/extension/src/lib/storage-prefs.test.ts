import { describe, expect, it } from "vitest";

import { DEFAULT_QURAN_PREFS } from "./storage";

describe("DEFAULT_QURAN_PREFS", () => {
  it("has the expected shape and defaults", () => {
    expect(DEFAULT_QURAN_PREFS.translationSlug).toBe("en.sahih");
    expect(DEFAULT_QURAN_PREFS.reciterSlug).toBe("qatami");
    expect(DEFAULT_QURAN_PREFS.showTranslation).toBe(true);
    expect(DEFAULT_QURAN_PREFS.showWordByWord).toBe(false);
    expect(DEFAULT_QURAN_PREFS.fontScale).toBe(1);
    // Mushaf (Safha) layout is now the default reading mode (was "list").
    expect(DEFAULT_QURAN_PREFS.layout).toBe("mushaf");
  });

  it("fontScale is within the allowed range [0.8, 1.6]", () => {
    expect(DEFAULT_QURAN_PREFS.fontScale).toBeGreaterThanOrEqual(0.8);
    expect(DEFAULT_QURAN_PREFS.fontScale).toBeLessThanOrEqual(1.6);
  });
});
