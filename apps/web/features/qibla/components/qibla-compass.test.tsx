import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QiblaCompass } from "./qibla-compass";

describe("QiblaCompass", () => {
  it("renders the Kaaba marker and cardinal labels in static mode", () => {
    const { container } = render(
      <QiblaCompass bearing={136} heading={null} label="Qibla 136° SE" />,
    );
    expect(screen.getByRole("img", { name: /Qibla/ })).toBeInTheDocument();
    expect(screen.getByText("🕋")).toBeInTheDocument();
    expect(screen.getByText("N")).toBeInTheDocument();
    // Static: rose is north-up (no rotation applied).
    const rose = container.querySelector("g[transform]");
    expect(rose?.getAttribute("transform")).toBe("rotate(0 120 120)");
    // Not aligned → marker uses the primary colour, not the sun highlight.
    expect(container.querySelector('[fill="var(--color-sun)"]')).toBeNull();
    // No celebration animation while off-target.
    expect(container.querySelector(".qibla-ping")).toBeNull();
    expect(container.querySelector(".qibla-kaaba")).toBeNull();
  });

  it("rotates the rose and highlights when the device faces the Qibla", () => {
    const { container } = render(
      <QiblaCompass bearing={136} heading={135} label="Qibla" />,
    );
    // Live: rose rotates by -heading.
    const rose = container.querySelector("g[transform]");
    expect(rose?.getAttribute("transform")).toBe("rotate(-135 120 120)");
    // |135 - 136| = 1° ≤ tolerance → marker lights up gold.
    expect(container.querySelector('[fill="var(--color-sun)"]')).not.toBeNull();
    // …and the celebration animation kicks in (pulsing Kaaba + sonar ping).
    expect(container.querySelector(".qibla-kaaba")).not.toBeNull();
    expect(container.querySelector(".qibla-ping")).not.toBeNull();
    expect(container.querySelector(".qibla-needle")).not.toBeNull();
  });
});
