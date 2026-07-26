import { toArabicIndicDigits, ayahMarker, localizeDigits } from "@/features/quran/lib/page-groups";

describe("toArabicIndicDigits", () => {
  it("converts Western digits to Arabic-Indic", () => {
    expect(toArabicIndicDigits(107)).toBe("١٠٧");
    expect(toArabicIndicDigits(0)).toBe("٠");
    expect(toArabicIndicDigits(7)).toBe("٧");
  });
});

describe("ayahMarker", () => {
  // The U+06DD prefix follows the bundled FONT, not the platform. Mobile now
  // bundles Amiri Quran (matching web), which composes U+06DD with the digits
  // into ONE ornament — so the prefix belongs here. It was correctly OMITTED
  // while mobile bundled KFGQPC Uthmanic Script HAFS, which draws the ornament
  // around the digits itself and rendered a second, empty one (665897f).
  it("prefixes the Arabic-Indic ayah number with U+06DD", () => {
    expect(ayahMarker(7)).toBe("۝٧");
    expect(ayahMarker(107)).toBe("۝١٠٧");
  });
});

describe("localizeDigits", () => {
  it("formats Arabic-Indic digits for an 'ar' locale", () => {
    expect(localizeDigits(4, "ar")).toBe("٤");
    expect(localizeDigits(1, "ar-EG")).toBe("١");
  });

  it("formats Western digits for a non-'ar' locale", () => {
    expect(localizeDigits(4, "en")).toBe("4");
    expect(localizeDigits(1, "en-US")).toBe("1");
  });
});
