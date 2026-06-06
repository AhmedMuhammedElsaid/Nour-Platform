import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

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

beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no real scrollIntoView — stub it so the auto-scroll call is observable.
  Element.prototype.scrollIntoView = vi.fn();
});

const cards = () => screen.getAllByTestId("dhikr-card");
const counters = () => screen.getAllByTestId("counter");

describe("AdhkarReader (scroll list)", () => {
  it("renders every dhikr as a card", () => {
    render(<AdhkarReader azkar={azkar} />);
    expect(cards()).toHaveLength(2);
    expect(screen.getByText("سبحان الله")).toBeInTheDocument();
    expect(screen.getByText("الحمد لله")).toBeInTheDocument();
  });

  it("increments the tapped card's count and persists", () => {
    render(<AdhkarReader azkar={azkar} />);
    fireEvent.click(counters()[0]!);
    expect(within(cards()[0]!).getByText("1")).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("nour.adhkar.progress")!).sets.set1["0"],
    ).toBe(1);
  });

  it("marks done, advances active, and auto-scrolls when the active card completes", () => {
    render(<AdhkarReader azkar={azkar} />);
    fireEvent.click(counters()[0]!); // 1
    fireEvent.click(counters()[0]!); // 2
    fireEvent.click(counters()[0]!); // 3 -> complete item 0
    expect(cards()[0]!).toHaveAttribute("data-done");
    expect(cards()[1]!).toHaveAttribute("data-active");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("does not count past the repeat target", () => {
    render(<AdhkarReader azkar={azkar} />);
    fireEvent.click(counters()[0]!);
    fireEvent.click(counters()[0]!);
    fireEvent.click(counters()[0]!); // complete at 3
    fireEvent.click(counters()[0]!); // ignored
    expect(within(cards()[0]!).getByText("3")).toBeInTheDocument();
  });

  it("resets a stale day's progress on mount", () => {
    window.localStorage.setItem(
      "nour.adhkar.progress",
      JSON.stringify({ date: "2000-01-01", sets: { set1: { "0": 3 } } }),
    );
    render(<AdhkarReader azkar={azkar} />);
    expect(cards()[0]!).not.toHaveAttribute("data-done");
  });

  it("resumes same-day progress from the store", () => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    window.localStorage.setItem(
      "nour.adhkar.progress",
      JSON.stringify({ date: todayStr, sets: { set1: { "0": 2 } } }),
    );
    render(<AdhkarReader azkar={azkar} />);
    expect(within(cards()[0]!).getByText("2")).toBeInTheDocument();
  });

  it("tapping a non-active card counts it without changing active or scrolling", () => {
    render(<AdhkarReader azkar={azkar} />);
    fireEvent.click(counters()[1]!); // card 1 is NOT active (card 0 is)
    expect(within(cards()[1]!).getByText("1")).toBeInTheDocument();
    expect(cards()[0]!).toHaveAttribute("data-active");
    expect(cards()[1]!).not.toHaveAttribute("data-active");
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("reaches all-done after completing every card, with no active card", () => {
    render(<AdhkarReader azkar={azkar} />);
    fireEvent.click(counters()[0]!); // 1
    fireEvent.click(counters()[0]!); // 2
    fireEvent.click(counters()[0]!); // 3 -> card 0 done, advance to card 1
    fireEvent.click(counters()[1]!); // card 1 (repeat 1) done -> all complete
    expect(cards()[0]!).toHaveAttribute("data-done");
    expect(cards()[1]!).toHaveAttribute("data-done");
    expect(cards()[0]!).not.toHaveAttribute("data-active");
    expect(cards()[1]!).not.toHaveAttribute("data-active");
  });
});
