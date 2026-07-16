import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DhikrOfTheDayCard } from "./dhikr-of-the-day-card";
import type { Azkar } from "@repo/api/schemas/azkar";

const oneItemSet: Azkar = {
  id: "set1",
  kind: "morning",
  status: "published",
  order: 0,
  ar: { title: "أذكار الصباح", slug: "azkar-alsabah" },
  en: { title: "Morning Adhkar", slug: "morning-adhkar" },
  items: [{ ar: "سبحان الله", en: "Glory be to Allah", repeat: 3 }],
} as Azkar;

beforeEach(() => {
  window.localStorage.clear();
});

describe("DhikrOfTheDayCard", () => {
  it("renders nothing when there are no items in any published set", () => {
    const { container } = render(<DhikrOfTheDayCard sets={[]} locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the picked item's Arabic text and links to its parent set", () => {
    render(<DhikrOfTheDayCard sets={[oneItemSet]} locale="en" />);
    expect(screen.getByText("سبحان الله")).toBeInTheDocument();
    expect(screen.getByText("Glory be to Allah")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/adhkar/morning-adhkar");
  });

  it("increments the counter on tap and persists to nour.adhkar.progress", () => {
    render(<DhikrOfTheDayCard sets={[oneItemSet]} locale="en" />);
    fireEvent.click(screen.getByTestId("dhikr-of-the-day-counter"));
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("nour.adhkar.progress")!).sets.set1["0"],
    ).toBe(1);
  });

  it("clamps at the item's repeat count and shows the completed mark", () => {
    render(<DhikrOfTheDayCard sets={[oneItemSet]} locale="en" />);
    const counter = screen.getByTestId("dhikr-of-the-day-counter");
    fireEvent.click(counter);
    fireEvent.click(counter);
    fireEvent.click(counter);
    fireEvent.click(counter); // ignored — already at repeat=3
    expect(screen.getByLabelText("completed")).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("nour.adhkar.progress")!).sets.set1["0"],
    ).toBe(3);
  });

  it("resumes an already-completed item from the store without re-prompting from zero", () => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    window.localStorage.setItem(
      "nour.adhkar.progress",
      JSON.stringify({ date: todayStr, sets: { set1: { "0": 3 } } }),
    );
    render(<DhikrOfTheDayCard sets={[oneItemSet]} locale="en" />);
    expect(screen.getByLabelText("completed")).toBeInTheDocument();
  });
});
