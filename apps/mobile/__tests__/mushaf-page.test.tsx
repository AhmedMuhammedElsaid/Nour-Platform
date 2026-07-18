import "@/lib/i18n"; // initialise i18next so labels resolve (default: en)
import { fireEvent, render, screen } from "@testing-library/react-native";

import { MushafPage } from "@/features/quran/components/mushaf-page";
import type { AyahPageGroup } from "@/features/quran/lib/page-groups";

const group: AyahPageGroup = {
  page: 2,
  juz: 1,
  ayahs: [
    { numberGlobal: 5, ayahInSurah: 5, textUthmani: "الرَّحْمَٰنِ" } as never,
    { numberGlobal: 6, ayahInSurah: 6, textUthmani: "الرَّحِيمِ" } as never,
  ],
};

function renderPage(overrides: Partial<React.ComponentProps<typeof MushafPage>> = {}) {
  const onSelectAyah = jest.fn();
  render(
    <MushafPage
      group={group}
      fontScale={1}
      showBismillah={false}
      activeGlobal={null}
      selectedGlobal={null}
      onSelectAyah={onSelectAyah}
      {...overrides}
    />,
  );
  return { onSelectAyah };
}

describe("MushafPage", () => {
  it("renders each ayah's text and inline Arabic-Indic marker", () => {
    renderPage();
    expect(screen.getByText(/الرَّحْمَٰنِ/)).toBeTruthy();
    expect(screen.getByText("۝٥")).toBeTruthy();
    expect(screen.getByText(/الرَّحِيمِ/)).toBeTruthy();
    expect(screen.getByText("۝٦")).toBeTruthy();
  });

  it("renders the Page/Juz footer", () => {
    renderPage();
    expect(screen.getByText("Page 2 · Juz 1")).toBeTruthy();
  });

  it("shows the Bismillah only when the prop is set", () => {
    renderPage({ showBismillah: true });
    expect(screen.getByText(/بِسْمِ ٱللَّهِ/)).toBeTruthy();
  });

  it("hides the Bismillah by default", () => {
    renderPage();
    expect(screen.queryByText(/بِسْمِ ٱللَّهِ/)).toBeNull();
  });

  it("fires onSelectAyah with the ayah's numberGlobal on press", () => {
    const { onSelectAyah } = renderPage();
    fireEvent.press(screen.getByTestId("mushaf-ayah-5"));
    expect(onSelectAyah).toHaveBeenCalledWith(5);
  });
});
