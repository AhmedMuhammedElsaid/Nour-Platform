import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReaderAyah } from "@repo/api/schemas/quran";
import type { AyahPageGroup } from "../lib/page-groups";

// Translations echo the key + interpolated values so we can assert stable text.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

import { MushafPage } from "./mushaf-page";

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

const group: AyahPageGroup = {
  page: 1,
  juz: 1,
  ayahs: [
    ayah({ numberGlobal: 1, ayahInSurah: 1, textUthmani: "بِسْمِ ٱللَّهِ" }),
    ayah({ numberGlobal: 2, ayahInSurah: 2, textUthmani: "ٱلْحَمْدُ لِلَّهِ" }),
  ],
};

describe("MushafPage", () => {
  it("renders each ayah's Uthmani text with an inline ayah marker", () => {
    render(<MushafPage group={group} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(screen.getByText(/بِسْمِ ٱللَّهِ/)).toBeInTheDocument();
    expect(screen.getByText(/ٱلْحَمْدُ لِلَّهِ/)).toBeInTheDocument();
    expect(screen.getByText("۝١")).toBeInTheDocument();
    expect(screen.getByText("۝٢")).toBeInTheDocument();
  });

  it("renders the page/juz footer", () => {
    render(<MushafPage group={group} activeGlobal={null} isPlaying={false} onPlay={vi.fn()} />);
    expect(
      screen.getByText((_, el) => el?.textContent === "pageN:1 · juzN:1"),
    ).toBeInTheDocument();
  });

  it("calls onPlay with the tapped ayah's numberGlobal", async () => {
    const onPlay = vi.fn();
    render(<MushafPage group={group} activeGlobal={null} isPlaying={false} onPlay={onPlay} />);
    await userEvent.click(screen.getByTestId("mushaf-ayah-2"));
    expect(onPlay).toHaveBeenCalledWith(2);
  });

  it("marks the active, playing ayah as pressed", () => {
    render(<MushafPage group={group} activeGlobal={2} isPlaying onPlay={vi.fn()} />);
    expect(screen.getByTestId("mushaf-ayah-2")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("mushaf-ayah-1")).toHaveAttribute("aria-pressed", "false");
  });
});
