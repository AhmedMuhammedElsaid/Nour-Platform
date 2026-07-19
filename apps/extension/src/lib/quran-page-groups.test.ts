import { describe, expect, it } from "vitest";

import { ayahMarker, toArabicIndicDigits } from "./quran-page-groups";

describe("toArabicIndicDigits", () => {
  it("converts Western digits to Arabic-Indic", () => {
    expect(toArabicIndicDigits(107)).toBe("١٠٧");
    expect(toArabicIndicDigits(0)).toBe("٠");
    expect(toArabicIndicDigits(7)).toBe("٧");
  });
});

describe("ayahMarker", () => {
  it("prefixes the Arabic-Indic ayah number with U+06DD", () => {
    expect(ayahMarker(7)).toBe("۝٧");
    expect(ayahMarker(107)).toBe("۝١٠٧");
  });
});
