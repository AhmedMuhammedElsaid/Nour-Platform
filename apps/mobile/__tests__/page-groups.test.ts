import { toArabicIndicDigits, ayahMarker, localizeDigits } from "@/features/quran/lib/page-groups";

describe("toArabicIndicDigits", () => {
  it("converts Western digits to Arabic-Indic", () => {
    expect(toArabicIndicDigits(107)).toBe("١٠٧");
    expect(toArabicIndicDigits(0)).toBe("٠");
    expect(toArabicIndicDigits(7)).toBe("٧");
  });
});

describe("ayahMarker", () => {
  // No U+06DD prefix on mobile: the bundled Uthmani font already encloses
  // Arabic-Indic digits in the end-of-ayah ornament, so the prefix drew a
  // second, empty ornament beside the numbered one on device.
  it("renders the bare Arabic-Indic ayah number, with no U+06DD prefix", () => {
    expect(ayahMarker(7)).toBe("٧");
    expect(ayahMarker(107)).toBe("١٠٧");
    expect(ayahMarker(7)).not.toContain("۝");
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
