import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { BookmarksList } from "./bookmarks-list";

afterEach(() => window.localStorage.clear());

describe("BookmarksList", () => {
  it("shows an empty state when there are no bookmarks", () => {
    render(<BookmarksList />);
    expect(screen.getByTestId("bookmarks-empty")).toBeInTheDocument();
  });

  it("lists bookmarks grouped by surah with deep links", () => {
    window.localStorage.setItem(
      "nour.quran.bookmarks",
      JSON.stringify([
        { surah: 1, ayah: 1, numberGlobal: 1, surahName: "Al-Faatiha" },
        { surah: 2, ayah: 255, numberGlobal: 262, surahName: "Al-Baqara" },
      ]),
    );
    render(<BookmarksList />);
    expect(screen.getByText(/Al-Faatiha/)).toBeInTheDocument();
    expect(screen.getByText(/Al-Baqara/)).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/quran/2#ayah-262")).toBe(true);
  });
});
