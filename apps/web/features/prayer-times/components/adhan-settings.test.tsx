import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import { AdhanSettings } from "./adhan-settings";

function renderUI() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AdhanSettings />
    </NextIntlClientProvider>,
  );
}

describe("AdhanSettings", () => {
  beforeEach(() => localStorage.clear());

  it("toggles the master switch and persists", async () => {
    const user = userEvent.setup();
    renderUI();
    const toggle = await screen.findByLabelText(en.prayer.adhan.enable);
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(JSON.parse(localStorage.getItem("nour.prayer.adhan")!).enabled).toBe(true);
  });

  it("reveals per-prayer toggles once enabled", async () => {
    const user = userEvent.setup();
    renderUI();
    await user.click(await screen.findByLabelText(en.prayer.adhan.enable));
    expect(screen.getByLabelText(en.prayer.fajr)).toBeChecked();
  });
});
