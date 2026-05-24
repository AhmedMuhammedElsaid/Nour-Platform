import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation so useRouter works without the Next.js app context.
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { CategoryFilterBar } from "./category-filter-bar";

const categories = [
  { id: "aaaaaaaaaaaaaaaaaaaaaaaa", slug: "quran", name: "Quran" },
  { id: "bbbbbbbbbbbbbbbbbbbbbbbb", slug: "fiqh", name: "Fiqh" },
];

describe("CategoryFilterBar", () => {
  it("renders 'All' pill plus one pill per category", () => {
    render(<CategoryFilterBar categories={categories} activeSlug={undefined} />);

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quran" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fiqh" })).toBeInTheDocument();
  });

  it("clicking a category pill calls router.push with the category slug", async () => {
    const user = userEvent.setup();
    render(<CategoryFilterBar categories={categories} activeSlug={undefined} />);

    await user.click(screen.getByRole("button", { name: "Quran" }));

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

    const fiqhButton = screen.getByRole("button", { name: "Fiqh" });
    const quranButton = screen.getByRole("button", { name: "Quran" });
    const allButton = screen.getByRole("button", { name: "All" });

    // Active pill uses bg-primary; inactive pills use border-input.
    expect(fiqhButton.className).toContain("bg-primary");
    expect(quranButton.className).toContain("border-input");
    expect(allButton.className).toContain("border-input");
  });

  it("applies the active class to 'All' when activeSlug is undefined", () => {
    render(<CategoryFilterBar categories={categories} activeSlug={undefined} />);

    const allButton = screen.getByRole("button", { name: "All" });
    expect(allButton.className).toContain("bg-primary");
    expect(allButton).toHaveAttribute("aria-current", "true");
  });

  it("sets aria-current on the active category pill", () => {
    render(<CategoryFilterBar categories={categories} activeSlug="quran" />);

    const quranButton = screen.getByRole("button", { name: "Quran" });
    expect(quranButton).toHaveAttribute("aria-current", "true");

    // Inactive pills and All must not carry aria-current.
    const fiqhButton = screen.getByRole("button", { name: "Fiqh" });
    expect(fiqhButton).not.toHaveAttribute("aria-current");
  });
});
