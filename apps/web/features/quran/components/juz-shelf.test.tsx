import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { QuranSurah } from "@repo/api/schemas/quran";

// Mock the locale-aware Link as a plain anchor so we can assert the href.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { JuzShelf } from "./juz-shelf";

const surah = (over: Partial<QuranSurah> & Pick<QuranSurah, "number" | "name" | "ayahCount">): QuranSurah => ({
  meaning: "x",
  revelationPlace: "meccan",
  pageStart: 1,
  pageEnd: 1,
  bismillahPre: true,
  ...over,
});

const surahs: QuranSurah[] = [
  surah({ number: 1, name: { ar: "الفاتحة", en: "Al-Fatihah" }, ayahCount: 7 }),
  surah({ number: 2, name: { ar: "البقرة", en: "Al-Baqarah" }, ayahCount: 286 }),
  surah({ number: 3, name: { ar: "آل عمران", en: "Aal-i-Imraan" }, ayahCount: 200 }),
];

describe("JuzShelf", () => {
  it("groups Al-Fatihah (whole) and Al-Baqarah (partial) under Juz 1", () => {
    render(<JuzShelf surahs={surahs} />);
    const juz1 = screen.getByText("Juz 1").closest("section")!;
    expect(within(juz1).getByText("Al-Fatihah")).toBeInTheDocument();
    expect(within(juz1).getByText("7 ayahs")).toBeInTheDocument();
    expect(within(juz1).getByText("Al-Baqarah")).toBeInTheDocument();
    expect(within(juz1).getByText("ayahs 1-141")).toBeInTheDocument();
  });

  it("shows only the remaining ayah range of Al-Baqarah under Juz 2, no Al-Fatihah", () => {
    render(<JuzShelf surahs={surahs} />);
    const juz2 = screen.getByText("Juz 2").closest("section")!;
    expect(within(juz2).queryByText("Al-Fatihah")).not.toBeInTheDocument();
    expect(within(juz2).getByText("Al-Baqarah")).toBeInTheDocument();
    expect(within(juz2).getByText("ayahs 142-252")).toBeInTheDocument();
  });

  it("links each surah row to its autoplay reader", () => {
    render(<JuzShelf surahs={surahs} />);
    const juz1 = screen.getByText("Juz 1").closest("section")!;
    const links = within(juz1).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/quran/1?autoplay=1");
    expect(links[1]).toHaveAttribute("href", "/quran/2?autoplay=1");
  });

  it("renders all 30 juz sections", () => {
    render(<JuzShelf surahs={surahs} />);
    for (let j = 1; j <= 30; j++) {
      expect(screen.getByText(`Juz ${j}`)).toBeInTheDocument();
    }
  });
});
