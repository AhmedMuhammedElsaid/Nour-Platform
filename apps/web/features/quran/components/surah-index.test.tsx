import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

import { SurahIndex } from "./surah-index";

const surahs: QuranSurah[] = [
  {
    number: 1,
    name: { ar: "الفاتحة", en: "Al-Fatihah" },
    meaning: "The Opener",
    revelationPlace: "meccan",
    ayahCount: 7,
    pageStart: 1,
    pageEnd: 1,
    bismillahPre: true,
  },
  {
    number: 2,
    name: { ar: "البقرة", en: "Al-Baqarah" },
    meaning: "The Cow",
    revelationPlace: "medinan",
    ayahCount: 286,
    pageStart: 2,
    pageEnd: 49,
    bismillahPre: true,
  },
];

afterEach(() => window.localStorage.clear());

describe("SurahIndex", () => {
  it("renders a card per surah linking to the autoplay reader", () => {
    render(<SurahIndex surahs={surahs} />);
    expect(screen.getByText("Al-Fatihah")).toBeInTheDocument();
    expect(screen.getByText("Al-Baqarah")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/quran/1?autoplay=1");
  });

  it("shows a plain number badge when there is no saved reading position", () => {
    render(<SurahIndex surahs={surahs} />);
    const badge = screen.getByText("1");
    expect(badge.style.background).toBe("");
  });

  it("shows a progress ring on the surah matching the last-read position", () => {
    window.localStorage.setItem(
      "nour.quran.lastread",
      JSON.stringify({ surah: 2, ayah: 143 }),
    );
    render(<SurahIndex surahs={surahs} />);
    const badge = screen.getByText("2");
    const ring = badge.parentElement;
    expect(ring?.style.background).toContain("conic-gradient");
    expect(ring?.style.background).toContain("50%");
  });
});
