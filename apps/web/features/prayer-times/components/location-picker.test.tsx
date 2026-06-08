import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import type { PrayerLocation } from "@repo/api/schemas/prayer-times";

import { LocationPicker } from "./location-picker";

const current: PrayerLocation = { lat: 30.0444, lng: 31.2357, label: "Cairo" };

describe("LocationPicker", () => {
  it("filters cities by query and emits the chosen city", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<LocationPicker locale="en" current={current} onSelect={onSelect} />);

    await user.type(screen.getByRole("textbox"), "dub");
    const option = await screen.findByRole("button", { name: /Dubai/i });
    await user.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ label: "Dubai" });
  });

  it("pins the active location at the top of the list", () => {
    render(<LocationPicker locale="en" current={current} onSelect={vi.fn()} />);
    // The pinned row shows the current label and the 'current' marker.
    const pinned = screen.getByRole("button", { name: /Cairo.*currentLocation/i });
    expect(pinned).toHaveAttribute("aria-current", "true");
  });
});
