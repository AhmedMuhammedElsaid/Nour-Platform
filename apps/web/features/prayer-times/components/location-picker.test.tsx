import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { LocationPicker } from "./location-picker";

describe("LocationPicker", () => {
  it("filters cities by query and emits the chosen city", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<LocationPicker locale="en" onSelect={onSelect} />);

    await user.type(screen.getByRole("textbox"), "dub");
    const option = await screen.findByRole("button", { name: /Dubai/i });
    await user.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ label: "Dubai" });
  });
});
