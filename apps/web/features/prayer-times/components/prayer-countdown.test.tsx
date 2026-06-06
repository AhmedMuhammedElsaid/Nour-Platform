import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vals?: Record<string, unknown>) =>
    vals ? `${key}:${JSON.stringify(vals)}` : key,
}));

import { PrayerCountdown } from "./prayer-countdown";

describe("PrayerCountdown", () => {
  it("names the next prayer and renders an h/m countdown", () => {
    const target = new Date(Date.now() + (2 * 3600 + 14 * 60) * 1000);
    render(<PrayerCountdown nextKey="asr" target={target} />);
    // prayer name key
    expect(screen.getByText(/asr/)).toBeInTheDocument();
    // countdown key with h/m args (2h, allow ±1m drift on m)
    expect(screen.getByText(/countdown:.*"h":2/)).toBeInTheDocument();
  });
});
