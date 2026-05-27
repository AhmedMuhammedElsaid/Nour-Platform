import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates Latin titles", () => {
    expect(slugify("My Playlist!")).toBe("my-playlist");
    expect(slugify("  Hello   World  ")).toBe("hello-world");
    expect(slugify("A--B")).toBe("a-b");
  });

  it("keeps Arabic letters and produces a non-empty slug (ADR 0002)", () => {
    expect(slugify("سورة البقرة")).toBe("سورة-البقرة");
    expect(slugify("القرآن الكريم").length).toBeGreaterThan(0);
  });

  it("strips punctuation but preserves cross-script letters/numbers", () => {
    expect(slugify("Surah 2: البقرة")).toBe("surah-2-البقرة");
  });

  it("falls back to a contentId suffix when normalization is empty", () => {
    expect(slugify("!!!", "507f1f77bcf86cd799439011")).toBe("item-439011");
    expect(slugify("...")).toBe("item");
  });

  it("never emits leading/trailing or doubled hyphens", () => {
    const slug = slugify("  --Foo & Bar--  ");
    expect(slug).not.toMatch(/^-|-$/);
    expect(slug).not.toMatch(/--/);
    expect(slug).toBe("foo-bar");
  });
});
