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
    textUthmani: "بِسْمِ ٱللَّهِ",
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
        ayah({ numberGlobal: 6215, ayahInSurah: 4, surah: 113, textUthmani: "وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ" }),
      ],
    },
    {
      surah: { number: 114, name: { ar: "الناس", en: "An-Nas" }, meaning: "Mankind", bismillahPre: true },
      showBismillah: true,
      ayahs: [
        ayah({ numberGlobal: 6221, ayahInSurah: 1, surah: 114, textUthmani: "قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ" }),
      ],
    },
  ],
  translationEdition: null,
  reciter: null,
};

// A single-segment page (the common case) — no straddling surah boundary,
// so no part indicator should render.
const singlePartPage: PageReader = {
  ...page,
  page: 1,
  segments: [page.segments[0]!],
};

describe("MushafPageView", () => {
  it("renders exactly one segment's surah banner for the given part", () => {
    render(<MushafPageView page={page} part={0} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getByText("الفلق")).toBeInTheDocument();
    expect(screen.getByText(/Al-Falaq/)).toBeInTheDocument();
    expect(screen.queryByText("الناس")).not.toBeInTheDocument();
    expect(screen.queryByText(/An-Nas/)).not.toBeInTheDocument();
  });

  it("renders the OTHER segment when part is 1, not part 0", () => {
    render(<MushafPageView page={page} part={1} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getByText("الناس")).toBeInTheDocument();
    expect(screen.getByText(/An-Nas/)).toBeInTheDocument();
    expect(screen.queryByText("الفلق")).not.toBeInTheDocument();
    expect(screen.queryByText(/Al-Falaq/)).not.toBeInTheDocument();
  });

  it("only renders the Bismillah for the segment that opens a new surah", () => {
    render(<MushafPageView page={page} part={1} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getAllByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toHaveLength(1);
  });

  it("renders only the visible segment's ayahs", () => {
    render(<MushafPageView page={page} part={0} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getByTestId("mushaf-ayah-6215")).toBeInTheDocument();
    expect(screen.queryByTestId("mushaf-ayah-6221")).not.toBeInTheDocument();
  });

  it("renders the page/juz footer with a part indicator when the page has 2+ parts", () => {
    render(<MushafPageView page={page} part={0} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(
      screen.getByText((_, el) => el?.textContent === "pageN:582 pagePart:1,2 · juzN:30"),
    ).toBeInTheDocument();
  });

  it("omits the part indicator for a single-part page", () => {
    render(
      <MushafPageView page={singlePartPage} part={0} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />,
    );
    expect(
      screen.getByText((_, el) => el?.textContent === "pageN:1 · juzN:30"),
    ).toBeInTheDocument();
  });

  it("calls onPlay with the tapped ayah's numberGlobal", async () => {
    const onPlay = vi.fn();
    render(<MushafPageView page={page} part={1} activeGlobal={null} isPlaying={false} onPlay={onPlay} />);
    await userEvent.click(screen.getByTestId("mushaf-ayah-6221"));
    expect(onPlay).toHaveBeenCalledWith(6221);
  });
});
