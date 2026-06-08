import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AyahRow } from "./ayah-row";
import type { ReaderAyah } from "@repo/api/schemas/quran";

const ayah: ReaderAyah = {
  surah: 1,
  ayahInSurah: 2,
  numberGlobal: 2,
  juz: 1,
  page: 1,
  sajda: false,
  textUthmani: "ٱلْحَمْدُ لِلَّهِ",
  words: [{ position: 1, arabic: "ٱلْحَمْدُ", glossEn: "All praise" }],
  translation: "All praise is due to Allah",
  audioUrl: "https://x/001002.mp3",
};

function renderRow(overrides: Partial<React.ComponentProps<typeof AyahRow>> = {}) {
  return render(
    <AyahRow
      ayah={ayah}
      showTranslation
      translationDir="ltr"
      showWordByWord={false}
      isCurrent={false}
      isPlaying={false}
      isBookmarked={false}
      onPlay={vi.fn()}
      onToggleBookmark={vi.fn()}
      onOpenTafsir={vi.fn()}
      {...overrides}
    />,
  );
}

describe("AyahRow", () => {
  it("renders Arabic text and the ayah number", () => {
    renderRow();
    expect(screen.getByText(/ٱلْحَمْدُ لِلَّهِ/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the translation when enabled and hides it when disabled", () => {
    const { rerender } = renderRow();
    expect(screen.getByTestId("translation")).toBeInTheDocument();
    rerender(
      <AyahRow
        ayah={ayah}
        showTranslation={false}
        translationDir="ltr"
        showWordByWord={false}
        isCurrent={false}
        isPlaying={false}
        isBookmarked={false}
        onPlay={vi.fn()}
        onToggleBookmark={vi.fn()}
        onOpenTafsir={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("translation")).not.toBeInTheDocument();
  });

  it("renders word-by-word only when enabled", () => {
    renderRow({ showTranslation: false, showWordByWord: true });
    expect(screen.getByTestId("word-by-word")).toBeInTheDocument();
  });
});
