import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vals?: Record<string, unknown>) =>
    vals ? `${key}:${JSON.stringify(vals)}` : key,
}));

import { PrayerCountdown } from "./prayer-countdown";

describe("PrayerCountdown", () => {
  it("names the next prayer and renders a live HH:MM:SS clock", () => {
    const target = new Date(Date.now() + (2 * 3600 + 14 * 60) * 1000);
    render(<PrayerCountdown nextKey="asr" target={target} locale="en" />);
    // prayer name key
    expect(screen.getByText(/asr/)).toBeInTheDocument();
    // ≥1h remaining → H:MM:SS clock (unpadded hour, e.g. 2:13:59)
    expect(screen.getByText(/^\d{1,2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("drops the hours segment under an hour (MM:SS)", () => {
    const target = new Date(Date.now() + (4 * 60 + 30) * 1000);
    render(<PrayerCountdown nextKey="asr" target={target} locale="en" />);
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
  });
});
