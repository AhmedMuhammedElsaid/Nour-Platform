import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { PlayerClearanceSpacer } from "./player-clearance-spacer";

// The spacer's whole job is to reserve the fixed player bar's height in normal
// flow. It must contribute nothing to the a11y tree and must read its height
// from --player-height rather than a constant — the bar is ~101px when it wraps
// on mobile and 72px on desktop, so any hardcoded value is wrong somewhere.
describe("PlayerClearanceSpacer", () => {
  it("is hidden from assistive tech", () => {
    const { container } = render(<PlayerClearanceSpacer />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("derives its height from --player-height, defaulting to zero", () => {
    const { container } = render(<PlayerClearanceSpacer />);
    const el = container.firstElementChild as HTMLElement;

    // Falls back to 0px so no space is reserved when nothing is queued.
    expect(el.style.height).toBe("var(--player-height, 0px)");
  });

  it("renders no content of its own", () => {
    const { container } = render(<PlayerClearanceSpacer />);
    expect(container.firstElementChild).toBeEmptyDOMElement();
  });
});
