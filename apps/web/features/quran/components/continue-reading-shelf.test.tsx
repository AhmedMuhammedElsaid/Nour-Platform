import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ContinueReadingShelf } from "./continue-reading-shelf";

afterEach(() => window.localStorage.clear());

describe("ContinueReadingShelf", () => {
  it("renders nothing when no last-read", () => {
    const { container } = render(<ContinueReadingShelf />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links to the saved ayah by numberGlobal", () => {
    window.localStorage.setItem("nour.quran.lastread", JSON.stringify({
      surah: 2, ayah: 255, numberGlobal: 262, surahName: "Al-Baqara",
    }));
    render(<ContinueReadingShelf />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/quran/2#ayah-262");
    expect(screen.getByText(/Al-Baqara/)).toBeInTheDocument();
  });
});
