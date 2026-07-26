import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PageReader, ReaderAyah, QuranWord } from "@repo/api/schemas/quran";

// Translations echo the key + interpolated values so we can assert stable text.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

import { MushafPageView } from "./mushaf-page-view";

// Placeholder ayah text (2 words) — NOT the full Bismillah below, just a
// stand-in default so individual test ayahs don't need their own textUthmani.
const PLACEHOLDER_TEXT = "بِسْمِ ٱللَّهِ";
// The full Bismillah, exactly as it renders in the reader chrome. Copied
// programmatically from mushaf-page-view.tsx rather than hand-typed --
// combining-mark order is invisible in review and a retyped copy is a real,
// already-shipped bug class.
const FULL_BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

function word(overrides: Partial<QuranWord> & { position: number; arabic: string }): QuranWord {
  return { ...overrides };
}

function ayah(overrides: Partial<ReaderAyah>): ReaderAyah {
  return {
    surah: 1,
    ayahInSurah: 1,
    numberGlobal: 1,
    juz: 1,
    page: 1,
    sajda: false,
    textUthmani: PLACEHOLDER_TEXT,
    words: [],
    translation: null,
    audioUrl: "https://x/001001.mp3",
    ...overrides,
  } as ReaderAyah;
}

// A page holding the tail end of Al-Falaq (113) and the start of An-Nas
// (114) stands in for the real "two short surahs share a page" case:
// segment 1 continues a surah already in progress (no Bismillah), segment 2
// opens a new surah mid-page (gets its own Bismillah — the static chrome
// above <Reader> only covers the entry surah, never one that starts
// mid-page).
//
// Every word carries `line`/`page` here so `buildPageRows` succeeds and the
// rows path renders — the reflow-fallback path is exercised separately below
// with a page whose words omit `line`.
const laidOutPage: PageReader = {
  page: 582,
  juz: 30,
  prevPage: 581,
  nextPage: 583,
  segments: [
    {
      surah: {
        number: 113,
        name: { ar: "الفلق", en: "Al-Falaq" },
        meaning: "The Daybreak",
        bismillahPre: true,
        ayahCount: 5,
      },
      showBismillah: false,
      ayahs: [
        ayah({
          numberGlobal: 6215,
          ayahInSurah: 4,
          surah: 113,
          words: [
            word({ position: 1, arabic: "AAAA", line: 10, page: 582 }),
            word({ position: 2, arabic: "BBBB", line: 10, page: 582 }),
            word({ position: 3, arabic: "CCCC", line: 10, page: 582 }),
          ],
        }),
        // Al-Falaq's actual last ayah (5) matches segment.surah.ayahCount, so
        // THIS line is the one that ends the surah — centred, not justified.
        ayah({
          numberGlobal: 6216,
          ayahInSurah: 5,
          surah: 113,
          words: [
            word({ position: 1, arabic: "DDDD", line: 11, page: 582 }),
            word({ position: 2, arabic: "EEEE", line: 11, page: 582 }),
          ],
        }),
      ],
    },
    {
      surah: {
        number: 114,
        name: { ar: "الناس", en: "An-Nas" },
        meaning: "Mankind",
        bismillahPre: true,
        ayahCount: 6,
      },
      showBismillah: true,
      ayahs: [
        ayah({
          numberGlobal: 6221,
          ayahInSurah: 1,
          surah: 114,
          words: [
            word({ position: 1, arabic: "FFFF", line: 12, page: 582 }),
            word({ position: 2, arabic: "GGGG", line: 12, page: 582 }),
          ],
        }),
      ],
    },
  ],
  translationEdition: null,
  reciter: null,
};

// Same shape, but words carry no `line` — buildPageRows bails to null and the
// component must fall back to the original reflowed-paragraph rendering.
const unlaidOutPage: PageReader = {
  ...laidOutPage,
  segments: laidOutPage.segments.map((segment) => ({
    ...segment,
    ayahs: segment.ayahs.map((a) => ({
      ...a,
      words: a.words.map((w) => ({ position: w.position, arabic: w.arabic })),
    })),
  })),
};

describe("MushafPageView — laid-out rows", () => {
  it("renders the surah cartouche only for the segment that starts on this page", () => {
    render(
      <MushafPageView page={laidOutPage} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />,
    );
    // 113 continues mid-surah on this page — no cartouche/banner text for it.
    expect(screen.queryByText("الفلق")).not.toBeInTheDocument();
    // 114 opens fresh on this page — gets the cartouche + its Bismillah.
    expect(screen.getByText("الناس")).toBeInTheDocument();
    expect(screen.getByText(/An-Nas/)).toBeInTheDocument();
    expect(screen.getByText(FULL_BASMALA)).toBeInTheDocument();
  });

  it("renders rows in order: continuing lines, then the new surah's cartouche/bismillah/line", () => {
    const { container } = render(
      <MushafPageView page={laidOutPage} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />,
    );
    const text = container.textContent ?? "";
    const iLine10 = text.indexOf("AAAA");
    const iLine11 = text.indexOf("DDDD");
    const iCartouche = text.indexOf("الناس");
    const iBismillah = text.indexOf(FULL_BASMALA);
    const iLine12 = text.indexOf("FFFF");
    expect(iLine10).toBeGreaterThanOrEqual(0);
    expect(iLine11).toBeGreaterThan(iLine10);
    expect(iCartouche).toBeGreaterThan(iLine11);
    expect(iBismillah).toBeGreaterThan(iCartouche);
    expect(iLine12).toBeGreaterThan(iBismillah);
  });

  it("centres the surah's true final line and justifies the others", () => {
    render(
      <MushafPageView page={laidOutPage} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />,
    );
    // Line 11 (ayah 6216, ayahInSurah 5) is Al-Falaq's real last ayah, and
    // segment.surah.ayahCount is 5 — this segment DOES end the surah here.
    const line11 = screen.getByTestId("mushaf-ayah-6216").closest("p");
    expect(line11?.className).toContain("text-center");
    const line10 = screen.getByTestId("mushaf-ayah-6215").closest("p");
    expect(line10?.className).toContain("text-align:justify");
  });

  it("calls onPlay with the tapped ayah's numberGlobal, across segments", async () => {
    const onPlay = vi.fn();
    render(
      <MushafPageView page={laidOutPage} activeGlobal={null} isPlaying={false} onPlay={onPlay} />,
    );
    await userEvent.click(screen.getByTestId("mushaf-ayah-6221"));
    expect(onPlay).toHaveBeenCalledWith(6221);
  });

  it("renders the page/juz footer once, from the page reader", () => {
    render(
      <MushafPageView page={laidOutPage} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />,
    );
    expect(
      screen.getByText((_, el) => el?.textContent === "pageN:582 · juzN:30"),
    ).toBeInTheDocument();
  });
});

describe("MushafPageView — reflow fallback (no per-word line data)", () => {
  it("still renders every segment's banner, Bismillah, and ayahs", () => {
    render(
      <MushafPageView page={unlaidOutPage} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />,
    );
    expect(screen.getByText("الفلق")).toBeInTheDocument();
    expect(screen.getByText("الناس")).toBeInTheDocument();
    expect(screen.getAllByText(FULL_BASMALA)).toHaveLength(1);
    expect(screen.getByTestId("mushaf-ayah-6215")).toBeInTheDocument();
    expect(screen.getByTestId("mushaf-ayah-6221")).toBeInTheDocument();
  });

  it("still calls onPlay with the tapped ayah's numberGlobal", async () => {
    const onPlay = vi.fn();
    render(
      <MushafPageView page={unlaidOutPage} activeGlobal={null} isPlaying={false} onPlay={onPlay} />,
    );
    await userEvent.click(screen.getByTestId("mushaf-ayah-6221"));
    expect(onPlay).toHaveBeenCalledWith(6221);
  });
});
