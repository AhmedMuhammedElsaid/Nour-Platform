import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PageReader, ReaderAyah } from "@repo/api/schemas/quran";

// Translations echo the key + interpolated values so we can assert stable text.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

import { MushafPageView } from "./mushaf-page-view";

function ayah(overrides: Partial<ReaderAyah>): ReaderAyah {
  return {
    surah: 1,
    ayahInSurah: 1,
    numberGlobal: 1,
    juz: 1,
    page: 1,
    sajda: false,
    textUthmani: "بِسْمِ ٱللَّهِ",
    words: [],
    translation: null,
    audioUrl: "https://x/001001.mp3",
    ...overrides,
  } as ReaderAyah;
}

// A page holding the tail end of An-Nas (114) and the start of Al-Falaq
// would never happen (surah order is reversed), but the shape below stands
// in for the real "two short surahs share a page" case: segment 1 continues
// a surah already in progress (no Bismillah), segment 2 opens a new surah
// mid-page (gets its own Bismillah — the static chrome above <Reader> only
// covers the entry surah, never one that starts mid-page).
const page: PageReader = {
  page: 582,
  juz: 30,
  prevPage: 581,
  nextPage: 583,
  segments: [
    {
      surah: { number: 113, name: { ar: "الفلق", en: "Al-Falaq" }, meaning: "The Daybreak", bismillahPre: true },
      showBismillah: false,
      ayahs: [
        ayah({ numberGlobal: 6215, ayahInSurah: 4, surah: 113, textUthmani: "وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ" }),
      ],
    },
    {
      surah: { number: 114, name: { ar: "الناس", en: "An-Nas" }, meaning: "Mankind", bismillahPre: true },
      showBismillah: true,
      ayahs: [
        ayah({ numberGlobal: 6221, ayahInSurah: 1, surah: 114, textUthmani: "قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ" }),
      ],
    },
  ],
  translationEdition: null,
  reciter: null,
};

describe("MushafPageView", () => {
  it("renders a surah-name banner for every segment", () => {
    render(<MushafPageView page={page} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getByText("الفلق")).toBeInTheDocument();
    expect(screen.getByText("الناس")).toBeInTheDocument();
    expect(screen.getByText(/Al-Falaq/)).toBeInTheDocument();
    expect(screen.getByText(/An-Nas/)).toBeInTheDocument();
  });

  it("only renders the Bismillah for the segment that opens a new surah", () => {
    render(<MushafPageView page={page} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getAllByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toHaveLength(1);
  });

  it("renders each segment's ayahs with inline markers", () => {
    render(<MushafPageView page={page} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getByTestId("mushaf-ayah-6215")).toBeInTheDocument();
    expect(screen.getByTestId("mushaf-ayah-6221")).toBeInTheDocument();
  });

  it("renders the page/juz footer once, from the page reader (not a segment)", () => {
    render(<MushafPageView page={page} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(
      screen.getByText((_, el) => el?.textContent === "pageN:582 · juzN:30"),
    ).toBeInTheDocument();
  });

  it("calls onPlay with the tapped ayah's numberGlobal, across segments", async () => {
    const onPlay = vi.fn();
    render(<MushafPageView page={page} activeGlobal={null} isPlaying={false} onPlay={onPlay} />);
    await userEvent.click(screen.getByTestId("mushaf-ayah-6221"));
    expect(onPlay).toHaveBeenCalledWith(6221);
  });
});
