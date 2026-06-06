import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { AdhkarReader } from "./adhkar-reader";
import type { SerializedAzkar } from "../types";

const azkar: SerializedAzkar = {
  id: "set1",
  kind: "morning",
  locale: "ar",
  title: "أذكار الصباح",
  slug: "azkar-alsabah",
  items: [
    { ar: "سبحان الله", repeat: 3, en: "Glory be to Allah" },
    { ar: "الحمد لله", repeat: 1 },
  ],
};

beforeEach(() => window.localStorage.clear());

describe("AdhkarReader", () => {
  it("shows the first dhikr and its repeat target", () => {
    render(<AdhkarReader azkar={azkar} />);
    expect(screen.getByText("سبحان الله")).toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("0");
    expect(screen.getByTestId("counter")).toHaveTextContent("3");
  });

  it("increments the counter on tap and persists", () => {
    render(<AdhkarReader azkar={azkar} />);
    fireEvent.click(screen.getByTestId("counter"));
    expect(screen.getByTestId("counter")).toHaveTextContent("1");
    expect(
      JSON.parse(window.localStorage.getItem("nour.adhkar.progress")!).sets.set1["0"],
    ).toBe(1);
  });

  it("auto-advances to the next dhikr when the repeat target is reached", () => {
    render(<AdhkarReader azkar={azkar} />);
    const counter = screen.getByTestId("counter");
    fireEvent.click(counter); // 1
    fireEvent.click(counter); // 2
    fireEvent.click(counter); // 3 -> complete -> advance
    expect(screen.getByText("الحمد لله")).toBeInTheDocument();
  });

  it("does not count past the repeat target on the last dhikr", () => {
    render(<AdhkarReader azkar={azkar} />);
    const counter = screen.getByTestId("counter");
    fireEvent.click(counter); // 1
    fireEvent.click(counter); // 2
    fireEvent.click(counter); // 3 -> complete first item -> advance to last (repeat 1)
    expect(screen.getByText("الحمد لله")).toBeInTheDocument();
    fireEvent.click(counter); // 1 -> last item complete (repeat target reached)
    const countValue = () => counter.querySelector("span")?.textContent;
    expect(countValue()).toBe("1");
    fireEvent.click(counter); // one extra tap must be ignored
    expect(countValue()).toBe("1");
  });

  it("resets a stale day's progress on mount", () => {
    window.localStorage.setItem(
      "nour.adhkar.progress",
      JSON.stringify({ date: "2000-01-01", sets: { set1: { "0": 3 } } }),
    );
    render(<AdhkarReader azkar={azkar} />);
    expect(screen.getByTestId("counter")).toHaveTextContent("0");
  });

  it("resumes progress from a persisted same-day count", () => {
    // Seed today's date with a count of 2 for item 0
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    window.localStorage.setItem(
      "nour.adhkar.progress",
      JSON.stringify({ date: todayStr, sets: { set1: { "0": 2 } } }),
    );
    render(<AdhkarReader azkar={{ ...azkar, locale: "ar" }} />);
    expect(screen.getByTestId("counter")).toHaveTextContent("2");
  });
});
