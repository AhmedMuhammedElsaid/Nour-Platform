import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock the locale-aware navigation + next/navigation so the hooks work without
// the Next.js app context (mirrors category-filter-bar.test.tsx).
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/quran/1",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { DEFAULT_PREFS } from "../lib/quran-prefs";

describe("ReaderSettingsSheet", () => {
  it("toggles word-by-word and calls onChange with the new prefs", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet
        prefs={DEFAULT_PREFS}
        onChange={onChange}
        editions={[]}
        reciters={[]}
      />,
    );
    fireEvent.click(screen.getByLabelText(/reading settings/i));
    fireEvent.click(screen.getByLabelText(/word.by.word/i));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showWordByWord: !DEFAULT_PREFS.showWordByWord }),
    );
  });

  it("toggles translation visibility", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet
        prefs={DEFAULT_PREFS}
        onChange={onChange}
        editions={[]}
        reciters={[]}
      />,
    );
    fireEvent.click(screen.getByLabelText(/reading settings/i));
    fireEvent.click(screen.getByLabelText(/show translation/i));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showTranslation: !DEFAULT_PREFS.showTranslation }),
    );
  });
});
