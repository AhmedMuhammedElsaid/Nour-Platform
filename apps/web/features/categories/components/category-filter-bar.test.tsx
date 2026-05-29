import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock the locale-aware router so useRouter works without the Next.js app
// context, and next-intl so useTranslations returns the English labels.
const mockPush = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({ all: "All", filterLabel: "Filter playlists by category" })[key] ?? key,
}));

// Stub useSearchParams to return empty params (no pre-existing sort/category).
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { CategoryFilterBar } from "./category-filter-bar";

const categories = [
  { id: "aaaaaaaaaaaaaaaaaaaaaaaa", slug: "quran", arName: "القرآن", enName: "Quran" },
  { id: "bbbbbbbbbbbbbbbbbbbbbbbb", slug: "fiqh", arName: "فقه", enName: "Fiqh" },
];

describe("CategoryFilterBar", () => {
  it("renders 'All' pill plus one bilingual pill per category", () => {
    render(<CategoryFilterBar categories={categories} activeSlug={undefined} />);

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    // Labels are bilingual: "arName · enName"
    expect(screen.getByRole("button", { name: /القرآن.*Quran/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /فقه.*Fiqh/i })).toBeInTheDocument();
  });

  it("clicking a category pill calls router.push with the category slug", async () => {
    const user = userEvent.setup();
    render(<CategoryFilterBar categories={categories} activeSlug={undefined} />);

    await user.click(screen.getByRole("button", { name: /القرآن.*Quran/i }));

    expect(mockPush).toHaveBeenCalledWith("/?category=quran");
  });

  it("clicking the 'All' pill calls router.push('/')", async () => {
    const user = userEvent.setup();
    render(<CategoryFilterBar categories={categories} activeSlug="quran" />);

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("applies the active visual class to the pill matching activeSlug", () => {
    render(<CategoryFilterBar categories={categories} activeSlug="fiqh" />);

    const fiqhButton = screen.getByRole("button", { name: /فقه.*Fiqh/i });
    const quranButton = screen.getByRole("button", { name: /القرآن.*Quran/i });
    const allButton = screen.getByRole("button", { name: "All" });

    expect(fiqhButton.className).toContain("bg-primary");
    expect(quranButton.className).toContain("border-primary/20");
    expect(allButton.className).toContain("border-primary/20");
  });

  it("applies the active class to 'All' when activeSlug is undefined", () => {
    render(<CategoryFilterBar categories={categories} activeSlug={undefined} />);

    const allButton = screen.getByRole("button", { name: "All" });
    expect(allButton.className).toContain("bg-primary");
    expect(allButton).toHaveAttribute("aria-current", "true");
  });

  it("sets aria-current on the active category pill", () => {
    render(<CategoryFilterBar categories={categories} activeSlug="quran" />);

    const quranButton = screen.getByRole("button", { name: /القرآن.*Quran/i });
    expect(quranButton).toHaveAttribute("aria-current", "true");

    const fiqhButton = screen.getByRole("button", { name: /فقه.*Fiqh/i });
    expect(fiqhButton).not.toHaveAttribute("aria-current");
  });
});
