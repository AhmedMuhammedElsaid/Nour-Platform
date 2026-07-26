import "@/lib/i18n"; // initialise i18next so labels resolve (default: en)
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { PageSegment } from "@repo/shared-core/schemas/quran";
import type { PageRow } from "@repo/shared-core/quran/page-rows";

import { BISMILLAH, MushafSegment } from "@/features/quran/components/mushaf-page";

const segment: PageSegment = {
  surah: { number: 1, name: { ar: "الفاتحة", en: "Al-Fatihah" }, meaning: "The Opening", bismillahPre: true },
  showBismillah: false,
  ayahs: [
    { numberGlobal: 5, ayahInSurah: 5, textUthmani: "الرَّحْمَٰنِ" } as never,
    { numberGlobal: 6, ayahInSurah: 6, textUthmani: "الرَّحِيمِ" } as never,
  ],
};

function renderSegment(overrides: Partial<React.ComponentProps<typeof MushafSegment>> = {}) {
  const onSelectAyah = jest.fn();
  render(
    <MushafSegment
      segment={segment}
      rows={null}
      fontSize={30}
      activeGlobal={null}
      selectedGlobal={null}
      onSelectAyah={onSelectAyah}
      {...overrides}
    />,
  );
  return { onSelectAyah };
}

describe("MushafSegment — reflow fallback (rows: null, words carry no line data)", () => {
  it("renders the centered surah-name banner (Arabic title + EN name · meaning)", () => {
    renderSegment();
    expect(screen.getByText("Al-Fatihah · The Opening")).toBeTruthy();
    expect(screen.getByText("الفاتحة")).toBeTruthy();
  });

  // The banner stays per-segment rather than being hoisted into the reader's
  // fixed header: pageData.segments[0] is whichever surah owns the page's FIRST
  // ayah, so a page-level header built from it captions a mid-page surah with
  // the preceding surah's name.
  it("captions each segment with its OWN surah, not the page's first", () => {
    renderSegment({
      segment: {
        ...segment,
        surah: { number: 106, name: { ar: "قريش", en: "Quraysh" }, meaning: "Quraysh", bismillahPre: true },
      },
    });
    expect(screen.getByText("قريش")).toBeTruthy();
    expect(screen.queryByText("الفاتحة")).toBeNull();
  });

  it("renders each ayah's text and inline Arabic-Indic marker", () => {
    renderSegment();
    expect(screen.getByText(/الرَّحْمَٰنِ/)).toBeTruthy();
    expect(screen.getByText("٥")).toBeTruthy();
    expect(screen.getByText(/الرَّحِيمِ/)).toBeTruthy();
    expect(screen.getByText("٦")).toBeTruthy();
  });

  it("shows the Bismillah only when the segment's showBismillah is true", () => {
    renderSegment({ segment: { ...segment, showBismillah: true } });
    expect(screen.getByText(/بِسْمِ ٱللَّهِ/)).toBeTruthy();
  });

  it("hides the Bismillah when showBismillah is false", () => {
    renderSegment();
    expect(screen.queryByText(/بِسْمِ ٱللَّهِ/)).toBeNull();
  });

  it("fires onSelectAyah with the ayah's numberGlobal on press", () => {
    const { onSelectAyah } = renderSegment();
    fireEvent.press(screen.getByTestId("mushaf-ayah-5"));
    expect(onSelectAyah).toHaveBeenCalledWith(5);
  });

  // Regression guard for the device-confirmed bug: <Text>'s default
  // variant="body" carries `text-base` (16dp), which on a nested span beats the
  // size inherited from the paragraph's inline style — so the mushaf rendered at
  // 16dp regardless of the fitted size until every span restated it.
  it("restates the fitted fontSize on every nested ayah span", () => {
    renderSegment({ fontSize: 30 });
    expect(screen.getByTestId("mushaf-ayah-5").props.style).toEqual(
      expect.objectContaining({ fontSize: 30, lineHeight: 66 }),
    );
    expect(screen.getByText("٥").props.style).toEqual(
      expect.objectContaining({ fontSize: 30, lineHeight: 66 }),
    );
  });

  it("scales the whole segment from the auto-fitted fontSize", () => {
    renderSegment({ segment: { ...segment, showBismillah: true }, fontSize: 20 });
    // Ayah paragraph sits at the fitted size with web's 2.2 leading; the banner
    // and Bismillah derive from it so the block scales as one.
    expect(screen.getByText("الفاتحة").props.style).toEqual(
      expect.objectContaining({ fontSize: 26 }), // 20 * 1.3
    );
    // Match via the exported constant, never a retyped literal — the Uthmani
    // Bismillah's combining-mark ORDER is not visually distinguishable, and
    // retyping it is what produced the diacritic bug fixed in e246d7f.
    expect(screen.getByText(BISMILLAH).props.style).toEqual(
      expect.objectContaining({ fontSize: 22 }), // 20 * 1.1
    );
  });
});

describe("MushafSegment — printed-page rows (rows present)", () => {
  // A tiny two-line Al-Fatihah slice: banner, Bismillah, then two lines, the
  // second (ayah 7, the surah's last ayah) centred as the true end of the surah.
  // Line 1's words are deliberately NOT "ٱلرَّحْمَٰنِ" (ar-Rahman) — that word
  // already appears inside the Bismillah row's own text, and a text query for
  // it would then ambiguously match both rows.
  const rows: PageRow[] = [
    { kind: "surah-banner", surahNumber: 1 },
    { kind: "bismillah", surahNumber: 1 },
    {
      kind: "line",
      lineNumber: 1,
      surahNumber: 1,
      endsSurah: false,
      words: [
        { arabic: "ٱلْحَمْدُ", numberGlobal: 5, ayahInSurah: 5, endsAyah: true },
        { arabic: "لِرَبِّ", numberGlobal: 6, ayahInSurah: 6, endsAyah: false },
      ],
    },
    {
      kind: "line",
      lineNumber: 2,
      surahNumber: 1,
      endsSurah: true,
      words: [{ arabic: "ٱلصِّرَٰطَ", numberGlobal: 7, ayahInSurah: 7, endsAyah: true }],
    },
  ];

  function renderRows(overrides: Partial<React.ComponentProps<typeof MushafSegment>> = {}) {
    const onSelectAyah = jest.fn();
    render(
      <MushafSegment
        segment={segment}
        rows={rows}
        fontSize={30}
        activeGlobal={null}
        selectedGlobal={null}
        onSelectAyah={onSelectAyah}
        {...overrides}
      />,
    );
    return { onSelectAyah };
  }

  it("renders rows in order: banner, Bismillah, then each line", () => {
    renderRows();
    expect(screen.getByText("الفاتحة")).toBeTruthy();
    expect(screen.getByText(BISMILLAH)).toBeTruthy();
    expect(screen.getByText(/ٱلْحَمْدُ/)).toBeTruthy();
    expect(screen.getByText(/ٱلصِّرَٰطَ/)).toBeTruthy();
  });

  it("fires onSelectAyah with the run's numberGlobal on press", () => {
    const { onSelectAyah } = renderRows();
    fireEvent.press(screen.getByTestId("mushaf-ayah-7"));
    expect(onSelectAyah).toHaveBeenCalledWith(7);
  });

  it("restates the fitted fontSize on every nested word/marker span", () => {
    renderRows({ fontSize: 30 });
    expect(screen.getByTestId("mushaf-ayah-7").props.style).toEqual(
      expect.objectContaining({ fontSize: 30, lineHeight: 66 }),
    );
  });

  it("does NOT render the reflow-fallback paragraph when rows are present", () => {
    renderRows();
    // The fallback renders the whole ayah's textUthmani as one string
    // ("الرَّحْمَٰنِ") — the rows path renders per-word runs instead, so that
    // exact fallback string must not appear.
    expect(screen.queryByText("الرَّحْمَٰنِ")).toBeNull();
  });
});
