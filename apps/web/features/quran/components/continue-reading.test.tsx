import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import { ContinueReading } from "./continue-reading";

afterEach(() => window.localStorage.clear());

describe("ContinueReading", () => {
  it("renders nothing when there is no saved position", () => {
    const { container } = render(<ContinueReading surahNames={{ 2: "Al-Baqarah" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a resume link when a position is saved", () => {
    window.localStorage.setItem(
      "nour.quran.lastread",
      JSON.stringify({ surah: 2, ayah: 255 }),
    );
    render(<ContinueReading surahNames={{ 2: "Al-Baqarah" }} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("/quran/2"));
    expect(screen.getByText(/Al-Baqarah/)).toBeInTheDocument();
  });
});
