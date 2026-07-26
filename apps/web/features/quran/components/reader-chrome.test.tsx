import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReaderChrome } from "./reader-chrome";
import { DEFAULT_PREFS, loadPrefs } from "../lib/quran-prefs";

vi.mock("../lib/quran-prefs", async () => {
  const actual = await vi.importActual<typeof import("../lib/quran-prefs")>("../lib/quran-prefs");
  return { ...actual, loadPrefs: vi.fn(() => actual.DEFAULT_PREFS) };
});

const mockedLoadPrefs = vi.mocked(loadPrefs);

function renderChrome() {
  return render(
    <ReaderChrome
      heading={<h1>سُورَةُ الكَهْف</h1>}
      details={<p>Al-Kahf · The Cave · 110</p>}
    />,
  );
}

beforeEach(() => {
  mockedLoadPrefs.mockReturnValue(DEFAULT_PREFS);
});

describe("ReaderChrome", () => {
  it("renders the full header in list layout", () => {
    mockedLoadPrefs.mockReturnValue({ ...DEFAULT_PREFS, layout: "list" });
    renderChrome();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/The Cave/)).toBeInTheDocument();
    expect(screen.getByRole("banner")).not.toHaveClass("sr-only");
  });

  it("drops the details in mushaf layout — MushafPageView already renders the surah banner and its Bismillah, so showing them here printed both twice", () => {
    mockedLoadPrefs.mockReturnValue({ ...DEFAULT_PREFS, layout: "mushaf" });
    renderChrome();

    expect(screen.queryByText(/The Cave/)).not.toBeInTheDocument();
  });

  it("keeps the h1 in the document (sr-only) in mushaf layout, so the page never loses its only heading", () => {
    mockedLoadPrefs.mockReturnValue({ ...DEFAULT_PREFS, layout: "mushaf" });
    renderChrome();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveClass("sr-only");
  });

  it("defaults to the mushaf treatment, matching DEFAULT_PREFS on the server", () => {
    renderChrome();

    expect(DEFAULT_PREFS.layout).toBe("mushaf");
    expect(screen.getByRole("banner")).toHaveClass("sr-only");
  });
});
