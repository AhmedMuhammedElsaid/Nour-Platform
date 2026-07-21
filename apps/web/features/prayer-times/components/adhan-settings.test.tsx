import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import { AdhanSettings } from "./adhan-settings";

function renderUI() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AdhanSettings />
    </NextIntlClientProvider>,
  );
}

// Web adhan playback is switched off site-wide (see AdhanSettings) — this now
// renders a static notice, not the old enable/per-prayer/volume form.
describe("AdhanSettings", () => {
  it("shows the unavailable-on-web notice and no controls", () => {
    renderUI();
    expect(screen.getByText(en.prayer.adhan.unavailableWeb)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
