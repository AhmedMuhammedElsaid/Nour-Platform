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

  it("is on by default and persists an opt-out", async () => {
    const user = userEvent.setup();
    renderUI();
    const toggle = await screen.findByLabelText(en.prayer.azkar.enable);
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem("nour.azkar.reminder")!).enabled).toBe(false);
  });

  it("shows the schedule hint while enabled (the default)", async () => {
    renderUI();
    await screen.findByLabelText(en.prayer.azkar.enable);
    // Either the background hint or the foreground-only fallback is shown.
    const hint = screen.queryByText(en.prayer.azkar.hint) ?? screen.queryByText(en.prayer.azkar.foregroundOnly);
    expect(hint).not.toBeNull();
  });
});
