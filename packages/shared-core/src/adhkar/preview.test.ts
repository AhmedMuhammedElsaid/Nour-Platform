import { describe, expect, it } from "vitest";

import {
  ADHKAR_PREVIEW_COUNT,
  ADHKAR_PREVIEW_ICONS,
  ADHKAR_WAKE_EN_SLUG,
  buildAdhkarPreview,
  previewAdhkarIcon,
} from "./preview";

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

const sets = [
  { en: { slug: "morning-adhkar" } },
  { en: { slug: "evening-adhkar" } },
  { en: { slug: "sleep-adhkar" } },
  { en: { slug: ADHKAR_WAKE_EN_SLUG } },
  { en: { slug: "prayer-adhkar" } },
  { en: { slug: "mosque-adhkar" } },
];

describe("buildAdhkarPreview", () => {
  it("keeps all 5 (incl. Wake-up) with correct positional icons when excludeWake is unset", () => {
    const preview = buildAdhkarPreview(sets);
    expect(preview.map((p) => p.set.en.slug)).toEqual([
      "morning-adhkar",
      "evening-adhkar",
      "sleep-adhkar",
      ADHKAR_WAKE_EN_SLUG,
      "prayer-adhkar",
    ]);
    expect(preview.map((p) => p.icon)).toEqual(ADHKAR_PREVIEW_ICONS.slice(0, 5));
  });

  it("drops Wake-up and keeps every other set's ORIGINAL icon when excludeWake is set", () => {
    const preview = buildAdhkarPreview(sets, { excludeWake: true });
    expect(preview.map((p) => p.set.en.slug)).toEqual([
      "morning-adhkar",
      "evening-adhkar",
      "sleep-adhkar",
      "prayer-adhkar",
    ]);
    // Prayer keeps ITS OWN icon (index 4, 🤲) rather than shifting into wake's slot (⏰).
    expect(preview.map((p) => p.icon)).toEqual(["🌅", "🌙", "😴", "🤲"]);
  });

  it("never backfills Mosque (index 5) to make up for the excluded Wake-up card", () => {
    const preview = buildAdhkarPreview(sets, { excludeWake: true });
    expect(preview.some((p) => p.set.en.slug === "mosque-adhkar")).toBe(false);
    expect(preview).toHaveLength(4);
  });
});
