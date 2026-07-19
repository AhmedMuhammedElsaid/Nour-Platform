import "@/lib/i18n"; // initialise i18next so labels resolve (default: en)
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { PageSegment } from "@repo/shared-core/schemas/quran";

import { MushafSegment } from "@/features/quran/components/mushaf-page";

const segment: PageSegment = {
  surah: { number: 1, name: { ar: "الفاتحة", en: "Al-Fatihah" }, meaning: "The Opening", bismillahPre: true },
  showBismillah: false,
  ayahs: [
    { numberGlobal: 5, ayahInSurah: 5, textUthmani: "الرَّحْمَٰنِ" } as never,
    { numberGlobal: 6, ayahInSurah: 6, textUthmani: "الرَّحِيمِ" } as never,
  ],
};

function renderSegment(overrides: Partial<React.ComponentProps<typeof MushafSegment>> = {}) {
  const onSelectAyah = jest.fn();
  render(
    <MushafSegment
      segment={segment}
      fontScale={1}
      activeGlobal={null}
      selectedGlobal={null}
      onSelectAyah={onSelectAyah}
      {...overrides}
    />,
  );
  return { onSelectAyah };
}

describe("MushafSegment", () => {
  it("renders the centered surah-name banner (Arabic title + EN subtitle)", () => {
    renderSegment();
    expect(screen.getByText("Al-Fatihah")).toBeTruthy();
    // Arabic name is flanked by ornamental bracket glyphs within one Text node.
    expect(screen.getByText(/﴾ الفاتحة ﴿/)).toBeTruthy();
  });

  it("renders each ayah's text and inline Arabic-Indic marker", () => {
    renderSegment();
    expect(screen.getByText(/الرَّحْمَٰنِ/)).toBeTruthy();
    expect(screen.getByText("۝٥")).toBeTruthy();
    expect(screen.getByText(/الرَّحِيمِ/)).toBeTruthy();
    expect(screen.getByText("۝٦")).toBeTruthy();
  });

  it("shows the Bismillah only when the segment's showBismillah is true", () => {
    renderSegment({ segment: { ...segment, showBismillah: true } });
    expect(screen.getByText(/بِسْمِ ٱللَّهِ/)).toBeTruthy();
  });

  it("hides the Bismillah when showBismillah is false", () => {
    renderSegment();
    expect(screen.queryByText(/بِسْمِ ٱللَّهِ/)).toBeNull();
  });

  it("fires onSelectAyah with the ayah's numberGlobal on press", () => {
    const { onSelectAyah } = renderSegment();
    fireEvent.press(screen.getByTestId("mushaf-ayah-5"));
    expect(onSelectAyah).toHaveBeenCalledWith(5);
  });
});
