import { toArabicIndicDigits, ayahMarker, localizeDigits } from "@/features/quran/lib/page-groups";

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
