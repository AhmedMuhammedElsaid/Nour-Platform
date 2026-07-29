import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vals?: Record<string, unknown>) =>
    vals ? `${key}:${JSON.stringify(vals)}` : key,
}));

import { PrayerCountdown } from "./prayer-countdown";

// `now` is a prop rather than wall-clock state (that seeding is what tripped
// React's hydration mismatch), so these assertions are exact, not regex-loose.
const NOW = Date.UTC(2026, 6, 29, 12, 0, 0);

describe("PrayerCountdown", () => {
  it("names the next prayer and renders an H:MM:SS clock", () => {
    const target = new Date(NOW + (2 * 3600 + 14 * 60 + 5) * 1000);
    render(<PrayerCountdown nextKey="asr" target={target} locale="en" now={NOW} />);
    expect(screen.getByText(/asr/)).toBeInTheDocument();
    expect(screen.getByText("2:14:05")).toBeInTheDocument();
  });

  it("drops the hours segment under an hour (MM:SS)", () => {
    const target = new Date(NOW + (4 * 60 + 30) * 1000);
    render(<PrayerCountdown nextKey="asr" target={target} locale="en" now={NOW} />);
    expect(screen.getByText("04:30")).toBeInTheDocument();
  });

  it("renders the countdown from `now`, not from the wall clock", () => {
    // Guards the hydration fix: a component that re-read Date.now() internally
    // would ignore the prop and this would drift.
    const target = new Date(NOW + 90 * 1000);
    render(<PrayerCountdown nextKey="asr" target={target} locale="en" now={NOW} />);
    expect(screen.getByText("01:30")).toBeInTheDocument();
  });
});
