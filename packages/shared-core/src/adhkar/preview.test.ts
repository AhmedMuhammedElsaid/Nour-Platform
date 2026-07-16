import { describe, expect, it } from "vitest";

import { ADHKAR_PREVIEW_COUNT, ADHKAR_PREVIEW_ICONS, previewAdhkarIcon } from "./preview";

describe("previewAdhkarIcon", () => {
  it("returns the positional icon for each of the 5 preview slots", () => {
    for (let i = 0; i < ADHKAR_PREVIEW_COUNT; i++) {
      expect(previewAdhkarIcon(i)).toBe(ADHKAR_PREVIEW_ICONS[i]);
    }
  });

  it("falls back to a generic icon past the array", () => {
    expect(previewAdhkarIcon(ADHKAR_PREVIEW_ICONS.length)).toBe("📿");
  });
});
