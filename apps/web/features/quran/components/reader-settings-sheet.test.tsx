import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock the locale-aware navigation + next/navigation so the hooks work without
// the Next.js app context (mirrors category-filter-bar.test.tsx).
const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/quran/1",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
// Translations echo the key so we can assert against stable text (mirrors
// readers-shelf.test.tsx).
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { DEFAULT_PREFS } from "../lib/quran-prefs";

const EDITIONS = [
  {
    slug: "en.sahih",
    language: "en",
    name: "Sahih International",
    author: "Saheeh International",
    type: "translation" as const,
    dir: "ltr" as const,
  },
];
const RECITERS = [
  { slug: "qatami", name: "Nasser Al Qatami", audioBase: "https://example.com/qatami" },
  { slug: "husary", name: "Mahmoud Khalil Al-Husary", audioBase: "https://example.com/husary" },
];

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
}

describe("ReaderSettingsSheet", () => {
  afterEach(() => {
    pushMock.mockClear();
  });

  it("does not call onChange while a setting is only staged in the draft", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet prefs={DEFAULT_PREFS} onChange={onChange} editions={[]} reciters={[]} />,
    );
    openSheet();
    fireEvent.click(screen.getByLabelText("wordByWord"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits the staged draft to onChange on Save", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet prefs={DEFAULT_PREFS} onChange={onChange} editions={[]} reciters={[]} />,
    );
    openSheet();
    fireEvent.click(screen.getByLabelText("wordByWord"));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showWordByWord: !DEFAULT_PREFS.showWordByWord }),
    );
  });

  it("toggling showTranslation stages but does not commit until Save", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet prefs={DEFAULT_PREFS} onChange={onChange} editions={[]} reciters={[]} />,
    );
    openSheet();
    fireEvent.click(screen.getByLabelText("showTranslation"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showTranslation: !DEFAULT_PREFS.showTranslation }),
    );
  });

  it("Cancel discards staged changes — reopening shows the committed prefs, not the draft", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet prefs={DEFAULT_PREFS} onChange={onChange} editions={[]} reciters={[]} />,
    );
    openSheet();
    fireEvent.click(screen.getByLabelText("wordByWord"));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onChange).not.toHaveBeenCalled();

    openSheet();
    const checkbox = screen.getByLabelText("wordByWord") as HTMLInputElement;
    expect(checkbox.checked).toBe(DEFAULT_PREFS.showWordByWord);
  });

  it("selecting a reciter pill and saving navigates with the new query param", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet
        prefs={DEFAULT_PREFS}
        onChange={onChange}
        editions={EDITIONS}
        reciters={RECITERS}
      />,
    );
    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Mahmoud Khalil Al-Husary" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ reciterSlug: "husary" }));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("reciter=husary"));
  });

  it("does not navigate on Save when translation/reciter were not changed", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet
        prefs={DEFAULT_PREFS}
        onChange={onChange}
        editions={EDITIONS}
        reciters={RECITERS}
      />,
    );
    openSheet();
    fireEvent.click(screen.getByLabelText("wordByWord"));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("selecting the Mushaf layout pill marks it selected", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet prefs={DEFAULT_PREFS} onChange={onChange} editions={[]} reciters={[]} />,
    );
    openSheet();
    const mushafPill = screen.getByRole("button", { name: "layoutMushaf" });
    fireEvent.click(mushafPill);
    expect(mushafPill).toHaveAttribute("aria-pressed", "true");
  });

  it("live preview shows the translation caption only while showTranslation is on in the draft", () => {
    const onChange = vi.fn();
    render(
      <ReaderSettingsSheet
        prefs={{ ...DEFAULT_PREFS, showTranslation: false }}
        onChange={onChange}
        editions={[]}
        reciters={[]}
      />,
    );
    openSheet();
    expect(screen.queryByText("settingsPreviewTranslation")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("showTranslation"));
    expect(screen.getByText("settingsPreviewTranslation")).toBeInTheDocument();
  });
});
