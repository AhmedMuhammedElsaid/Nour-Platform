import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import { AzkarReminderSettings } from "./azkar-reminder-settings";

function renderUI() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AzkarReminderSettings />
    </NextIntlClientProvider>,
  );
}

describe("AzkarReminderSettings", () => {
  beforeEach(() => localStorage.clear());

  it("is opt-in (off by default) and persists when enabled", async () => {
    const user = userEvent.setup();
    renderUI();
    const toggle = await screen.findByLabelText(en.prayer.azkar.enable);
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(JSON.parse(localStorage.getItem("nour.azkar.reminder")!).enabled).toBe(true);
  });

  it("reveals the schedule hint once enabled", async () => {
    const user = userEvent.setup();
    renderUI();
    const toggle = await screen.findByLabelText(en.prayer.azkar.enable);
    await user.click(toggle);
    // Either the background hint or the foreground-only fallback is shown.
    const hint = screen.queryByText(en.prayer.azkar.hint) ?? screen.queryByText(en.prayer.azkar.foregroundOnly);
    expect(hint).not.toBeNull();
  });
});
